/**
 * Per-product discount helpers (mirrored from easymenu).
 * Default: discount base/variant only; modifiers stay full price.
 * When discount.includeModifiers is true: discount base/variant + modifiers.
 */

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

function isWithinDiscountWeeklyHours(
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

  return currentTime >= windowStart && currentTime <= windowEnd;
}

function isWithinDiscountSchedule(
  discount,
  now = new Date(),
  storeTimezone = DEFAULT_STORE_TIMEZONE,
) {
  if (!isWithinDateWindow(discount, now)) return false;
  return isWithinDiscountWeeklyHours(
    discount?.weeklyHours,
    storeTimezone,
    now,
  );
}

export function isProductDiscountActive(
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

  return isWithinDiscountSchedule(discount, now, storeTimezone);
}

export function applyProductDiscount(amount, discount) {
  const total = roundMoney(amount);
  if (!(total > 0)) return 0;

  const type = String(discount?.type || "").trim();
  const value = Number(discount?.value);

  if (!Number.isFinite(value) || value <= 0) return total;

  if (type === "percent") {
    const pct = Math.min(value, 100);
    return roundMoney(Math.max(0, total * (1 - pct / 100)));
  }

  if (type === "dollar") {
    return roundMoney(Math.max(0, total - value));
  }

  return total;
}

export function getDiscountedLineUnitPrice(
  item,
  baseUnitPrice,
  modifiersTotal = 0,
  now = new Date(),
  storeTimezone = DEFAULT_STORE_TIMEZONE,
) {
  const base = roundMoney(baseUnitPrice);
  const mods = roundMoney(modifiersTotal);
  const discount = item?.discount;

  if (!isProductDiscountActive(discount, now, storeTimezone)) {
    return roundMoney(base + mods);
  }

  if (discount.includeModifiers === true) {
    return applyProductDiscount(base + mods, discount);
  }

  return roundMoney(applyProductDiscount(base, discount) + mods);
}
