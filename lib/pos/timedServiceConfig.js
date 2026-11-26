import { resolvePosConfig } from "@/lib/pos/posConfig";
import { calculatePosSurcharge } from "@/lib/pos/posSurcharges";
import {
  discountSegmentKey,
  formatTimedServiceActiveDiscountBadge,
  formatTimedServiceDiscountShortLabel,
  formatTimedServiceDiscountWindowLabel,
  listTimedServiceDiscountRules,
  pickActiveTimedServiceDiscount,
  resolveTimedServiceRateAt,
} from "@/lib/pos/timedServiceDiscounts";

const DEFAULT_STORE_TIMEZONE = "Australia/Melbourne";

function roundMoney(amount) {
  return Math.round(Number(amount || 0) * 100) / 100;
}

export function listActiveTimedServices(timedServices) {
  if (!Array.isArray(timedServices)) return [];
  return timedServices.filter(
    (service) =>
      service &&
      service.disabled !== true &&
      String(service.name || "").trim(),
  );
}

/**
 * The one timed service a table runs when manual open and close are both on.
 * Null when the store has none, more than one, or the flags are off.
 */
export function resolveSoleTableTimedService(menuConfig, timedServices) {
  if (menuConfig?.timedServicesEnabled !== true) return null;
  const posConfig = resolvePosConfig(menuConfig);
  if (
    posConfig.manualOpenTableEnabled !== true ||
    posConfig.manualCloseTableEnabled !== true
  ) {
    return null;
  }
  const active = listActiveTimedServices(timedServices);
  return active.length === 1 ? active[0] : null;
}

/** Effective billing rate after an active discount (else list price). */
export function getTimedServiceEffectivePrice(
  service,
  now = new Date(),
  storeTimezone = DEFAULT_STORE_TIMEZONE,
) {
  return resolveTimedServiceRateAt(service, now, storeTimezone);
}

/**
 * Charge so far. Billed per started minute; an hourly rate is split evenly
 * across its 60 minutes. Split-rate: each minute uses the discount active at
 * the start of that minute. Must match easymenu `computeTimedServiceCharge`.
 */
export function computeTimedServiceCharge(
  service,
  startedAt,
  now = Date.now(),
  storeTimezone = DEFAULT_STORE_TIMEZONE,
) {
  const start = new Date(startedAt).getTime();
  const end = new Date(now).getTime();
  if (!startedAt || Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return { minutes: 0, amount: 0, segments: [] };
  }

  const minutes = Math.ceil((end - start) / 60_000);
  if (minutes <= 0) return { minutes: 0, amount: 0, segments: [] };

  const rules = listTimedServiceDiscountRules(service);
  const hasAnyDiscount = rules.some((rule) => rule?.enabled === true);
  const unit = service?.billingUnit === "minute" ? "minute" : "hour";

  if (!hasAnyDiscount) {
    const price = getTimedServiceEffectivePrice(
      service,
      new Date(now),
      storeTimezone,
    );
    if (!Number.isFinite(price)) {
      return { minutes: 0, amount: 0, segments: [] };
    }
    const perMinute = unit === "minute" ? price : price / 60;
    const amount = roundMoney(perMinute * minutes);
    return {
      minutes,
      amount,
      segments: [
        {
          key: "list",
          label: "List price",
          minutes,
          amount,
          rate: price,
          unit,
        },
      ],
    };
  }

  let amount = 0;
  const segments = [];
  let openSegment = null;

  for (let i = 0; i < minutes; i += 1) {
    const at = new Date(start + i * 60_000);
    const discount = pickActiveTimedServiceDiscount(
      service,
      at,
      storeTimezone,
    );
    const price = getTimedServiceEffectivePrice(service, at, storeTimezone);
    if (!Number.isFinite(price)) continue;
    const perMinute = unit === "minute" ? price : price / 60;
    amount += perMinute;

    const key = discountSegmentKey(discount);
    if (!openSegment || openSegment.key !== key) {
      openSegment = {
        key,
        label: formatTimedServiceDiscountShortLabel(discount),
        minutes: 0,
        amount: 0,
        rate: price,
        unit,
      };
      segments.push(openSegment);
    }
    openSegment.minutes += 1;
    openSegment.amount = roundMoney(openSegment.amount + perMinute);
  }

  return { minutes, amount: roundMoney(amount), segments };
}

/**
 * Store surcharges on the time charge, like a dine-in ticket of that amount.
 * Must match easymenu `payTableTimedService` pricing.
 */
export function computeTimedServiceSurcharge(
  amount,
  { posSurcharges, storeProfile, at = Date.now() } = {},
) {
  if (!(Number(amount) > 0)) return { surcharges: [], totalSurchargeAmount: 0 };
  return calculatePosSurcharge({
    posSurcharges,
    orderType: "dine-in",
    subtotal: amount,
    timeZone: storeProfile?.timezone,
    stateOrRegion: storeProfile?.stateOrRegion,
    at: new Date(at),
  });
}

/**
 * In-memory ticket for the time so far, shaped like the one easymenu creates
 * at payment. Used to print a bill before the time is paid.
 */
export function buildTimedServiceBillOrder({
  service,
  startedAt,
  tableNames = [],
  posSurcharges,
  storeProfile,
  at = Date.now(),
}) {
  const charge = computeTimedServiceCharge(
    service,
    startedAt,
    at,
    storeProfile?.timezone,
  );
  const { surcharges, totalSurchargeAmount } = computeTimedServiceSurcharge(
    charge.amount,
    { posSurcharges, storeProfile, at },
  );
  const tables = tableNames.filter(Boolean);
  return {
    _id: `timed-service-${service.id}`,
    source: "pos",
    orderType: "dine-in",
    table: tables[0] || "",
    tables: tables.length > 1 ? tables : undefined,
    paymentStatus: "pending",
    status: "delivered",
    createdAt: new Date(at).toISOString(),
    items: [
      {
        menuItemId: `timed-service:${service.id}`,
        name: `${service.name} -- ${formatServiceMinutes(charge.minutes)}`,
        price: charge.amount,
        quantity: 1,
        lineId: `timed-service-${service.id}`,
        kitchenStatus: "sent",
      },
    ],
    subtotal: charge.amount,
    surcharges,
    surchargeTotal: totalSurchargeAmount,
    total: Math.round((charge.amount + totalSurchargeAmount) * 100) / 100,
  };
}

/** True when an open round on these seats already had its time paid. */
export function isTableServicePaid(rounds, tableNames) {
  const keys = new Set(
    (tableNames || [])
      .map((name) => String(name || "").trim().toLowerCase())
      .filter(Boolean),
  );
  return (rounds || []).some(
    (round) =>
      round?.serviceChargedAt &&
      (round.tables || []).some((name) =>
        keys.has(String(name || "").trim().toLowerCase()),
      ),
  );
}

export function formatServiceMinutes(minutes) {
  const total = Math.max(0, Math.floor(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours === 0) return `${mins}m`;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

export function formatTimedServiceRate(
  service,
  now = new Date(),
  storeTimezone = DEFAULT_STORE_TIMEZONE,
) {
  const amount = getTimedServiceEffectivePrice(service, now, storeTimezone);
  if (!Number.isFinite(amount)) return "";
  const unit = service?.billingUnit === "minute" ? "minute" : "hour";
  return `$${amount.toFixed(2)} per ${unit}`;
}

export function formatTimedServiceDiscountBadge(
  service,
  now = new Date(),
  storeTimezone = DEFAULT_STORE_TIMEZONE,
) {
  return formatTimedServiceActiveDiscountBadge(service, now, storeTimezone);
}

export function getTimedServiceCurrentDiscountSummary(
  service,
  now = new Date(),
  storeTimezone = DEFAULT_STORE_TIMEZONE,
) {
  const active = pickActiveTimedServiceDiscount(service, now, storeTimezone);
  if (!active) {
    return {
      badge: null,
      shortLabel: "List price",
      windowLabel: null,
    };
  }
  return {
    badge: formatTimedServiceActiveDiscountBadge(
      service,
      now,
      storeTimezone,
    ),
    shortLabel: formatTimedServiceDiscountShortLabel(active),
    windowLabel: formatTimedServiceDiscountWindowLabel(
      active,
      now,
      storeTimezone,
    ),
  };
}
