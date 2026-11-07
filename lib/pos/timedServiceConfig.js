import { resolvePosConfig } from "@/lib/pos/posConfig";
import { calculatePosSurcharge } from "@/lib/pos/posSurcharges";

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

/**
 * Charge so far. Billed per started minute; an hourly rate is split evenly
 * across its 60 minutes. Rounded to cents.
 */
export function computeTimedServiceCharge(service, startedAt, now = Date.now()) {
  const start = new Date(startedAt).getTime();
  const price = Number(service?.price);
  if (!startedAt || Number.isNaN(start) || !Number.isFinite(price)) {
    return { minutes: 0, amount: 0 };
  }
  const elapsedMs = Math.max(0, now - start);
  const minutes = elapsedMs > 0 ? Math.ceil(elapsedMs / 60_000) : 0;
  const perMinute = service?.billingUnit === "minute" ? price : price / 60;
  return { minutes, amount: Math.round(perMinute * minutes * 100) / 100 };
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
  const charge = computeTimedServiceCharge(service, startedAt, at);
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
        name: `${service.name} · ${formatServiceMinutes(charge.minutes)}`,
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

export function formatTimedServiceRate(service) {
  const amount = Number(service?.price);
  if (!Number.isFinite(amount)) return "";
  const unit = service?.billingUnit === "minute" ? "minute" : "hour";
  return `$${amount.toFixed(2)} per ${unit}`;
}
