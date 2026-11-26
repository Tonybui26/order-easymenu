/**
 * Timed-service multi-rule discounts (mirrored from easymenu).
 * Must stay in sync with easymenu `lib/menu/timedServiceDiscounts.js`.
 */

import { applyProductDiscount } from "@/lib/pricing/productDiscount";

const DEFAULT_STORE_TIMEZONE = "Australia/Melbourne";

const WEEKDAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function roundMoney(amount) {
  return Math.round(Number(amount || 0) * 100) / 100;
}

function resolveStoreTimezone(timezone) {
  const tz = String(timezone ?? "").trim();
  return tz || DEFAULT_STORE_TIMEZONE;
}

function getStoreLocalWeekdayAndTime(now = new Date(), timeZone = DEFAULT_STORE_TIMEZONE) {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const parts = formatter.formatToParts(now);
    const weekday = String(
      parts.find((p) => p.type === "weekday")?.value ?? "",
    ).toLowerCase();
    const hour = String(
      parts.find((p) => p.type === "hour")?.value ?? "0",
    ).padStart(2, "0");
    const minute = String(
      parts.find((p) => p.type === "minute")?.value ?? "0",
    ).padStart(2, "0");
    return { weekday, currentTime: `${hour}:${minute}` };
  } catch {
    return {
      weekday: now
        .toLocaleDateString("en-US", { weekday: "long" })
        .toLowerCase(),
      currentTime: now.toTimeString().slice(0, 5),
    };
  }
}

function parseHHMMToMinutes(value) {
  const raw = String(value ?? "00:00").trim();
  const [hStr, mStr] = raw.split(":");
  const h = Number.parseInt(hStr, 10);
  const m = Number.parseInt(mStr, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return Math.min(23, Math.max(0, h)) * 60 + Math.min(59, Math.max(0, m));
}

function countEnabledDays(weeklyHours) {
  return WEEKDAY_ORDER.filter((day) => weeklyHours?.[day]?.enabled === true)
    .length;
}

function isWithinDateWindow(discount, now = new Date()) {
  const start = discount?.startDate ? new Date(discount.startDate) : null;
  const end = discount?.endDate ? new Date(discount.endDate) : null;

  if (start && !Number.isNaN(start.getTime()) && now < start) return false;
  if (end && !Number.isNaN(end.getTime()) && now > end) return false;
  return true;
}

/** Half-open weekly window: start inclusive, end exclusive. */
function isWithinTimedServiceDiscountWeeklyHours(
  weeklyHours,
  storeTimezone = DEFAULT_STORE_TIMEZONE,
  now = new Date(),
) {
  if (!weeklyHours || typeof weeklyHours !== "object") return true;
  if (countEnabledDays(weeklyHours) === 0) return true;

  const timeZone = resolveStoreTimezone(storeTimezone);
  const { weekday, currentTime } = getStoreLocalWeekdayAndTime(now, timeZone);
  const daySchedule = weeklyHours[weekday];
  if (!daySchedule?.enabled) return false;

  const windowStart = daySchedule.startTime ?? daySchedule.openTime;
  const windowEnd = daySchedule.endTime ?? daySchedule.closeTime;
  if (!windowStart || !windowEnd) return false;

  const current = parseHHMMToMinutes(currentTime);
  const start = parseHHMMToMinutes(windowStart);
  const end = parseHHMMToMinutes(windowEnd);
  if (!(end > start)) return false;

  return current >= start && current < end;
}

export function isTimedServiceDiscountActive(
  discount,
  now = new Date(),
  storeTimezone = DEFAULT_STORE_TIMEZONE,
) {
  if (!discount || discount.enabled !== true) return false;

  const type = String(discount.type || "").trim();
  if (type !== "percent" && type !== "dollar") return false;

  const value = Number(discount.value);
  if (!Number.isFinite(value) || value <= 0) return false;
  if (type === "percent" && value > 100) return false;

  if (!isWithinDateWindow(discount, now)) return false;
  return isWithinTimedServiceDiscountWeeklyHours(
    discount?.weeklyHours,
    storeTimezone,
    now,
  );
}

export function listTimedServiceDiscountRules(service) {
  const fromArray = Array.isArray(service?.discounts)
    ? service.discounts.filter((rule) => rule && typeof rule === "object")
    : [];
  if (fromArray.length > 0) return fromArray;
  if (service?.discount && typeof service.discount === "object") {
    return [service.discount];
  }
  return [];
}

export function pickActiveTimedServiceDiscount(
  service,
  now = new Date(),
  storeTimezone = DEFAULT_STORE_TIMEZONE,
) {
  for (const rule of listTimedServiceDiscountRules(service)) {
    if (isTimedServiceDiscountActive(rule, now, storeTimezone)) return rule;
  }
  return null;
}

export function resolveTimedServiceRateAt(
  service,
  now = new Date(),
  storeTimezone = DEFAULT_STORE_TIMEZONE,
) {
  const price = Number(service?.price);
  if (!Number.isFinite(price) || price < 0) return 0;
  const listPrice = roundMoney(price);
  const discount = pickActiveTimedServiceDiscount(
    service,
    now,
    storeTimezone,
  );
  if (!discount) return listPrice;
  return applyProductDiscount(listPrice, discount);
}

export function formatTimedServiceDiscountShortLabel(discount) {
  if (!discount || discount.enabled !== true) return "List price";
  const type = String(discount.type || "").trim();
  const value = Number(discount.value);
  if (!Number.isFinite(value) || value <= 0) return "List price";
  if (type === "percent") return `${roundMoney(value)}% off`;
  if (type === "dollar") return `$${roundMoney(value)} off`;
  return "List price";
}

export function formatTimedServiceActiveDiscountBadge(
  service,
  now = new Date(),
  storeTimezone = DEFAULT_STORE_TIMEZONE,
) {
  const active = pickActiveTimedServiceDiscount(service, now, storeTimezone);
  if (!active) return null;
  const type = String(active.type || "").trim();
  const value = Number(active.value);
  if (type === "percent") return `-${roundMoney(value)}% OFF`;
  if (type === "dollar") return `-$${roundMoney(value)} OFF`;
  return null;
}

/** Today's half-open window for a discount rule, e.g. "08:00–16:00". */
export function formatTimedServiceDiscountWindowLabel(
  discount,
  now = new Date(),
  storeTimezone = DEFAULT_STORE_TIMEZONE,
) {
  const weeklyHours = discount?.weeklyHours;
  if (!weeklyHours || typeof weeklyHours !== "object") return null;
  if (countEnabledDays(weeklyHours) === 0) return null;

  const timeZone = resolveStoreTimezone(storeTimezone);
  const { weekday } = getStoreLocalWeekdayAndTime(now, timeZone);
  const daySchedule = weeklyHours[weekday];
  if (!daySchedule?.enabled) return null;

  const windowStart = daySchedule.startTime ?? daySchedule.openTime;
  const windowEnd = daySchedule.endTime ?? daySchedule.closeTime;
  if (!windowStart || !windowEnd) return null;
  return `${windowStart}–${windowEnd}`;
}

export function discountSegmentKey(discount) {
  if (!discount || discount.enabled !== true) return "list";
  const type = String(discount.type || "").trim();
  const value = Number(discount.value);
  if (!Number.isFinite(value) || value <= 0) return "list";
  return `${type}:${roundMoney(value)}`;
}
