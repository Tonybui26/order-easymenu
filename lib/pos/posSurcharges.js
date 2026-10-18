/**
 * POS cart surcharge preview. Must match easymenu `calculateSurcharges`
 * and `buildPosOrderPricing` (percentage of item subtotal, store timezone).
 */

const DEFAULT_STORE_TIMEZONE = "Australia/Melbourne";

function roundMoney(amount) {
  return Math.round(Number(amount || 0) * 100) / 100;
}

function isWeekend(date, timeZone) {
  const zone = String(timeZone || "").trim() || DEFAULT_STORE_TIMEZONE;
  try {
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      weekday: "short",
    }).format(date);
    return weekday === "Sat" || weekday === "Sun";
  } catch {
    const day = date.getDay();
    return day === 0 || day === 6;
  }
}

export function surchargeDescription(type) {
  if (type === "Weekend") return "Weekend Surcharge";
  if (type === "Service") return "Service Charge";
  if (type === "Holiday") return "Public Holiday Surcharge";
  return "Surcharge";
}

/** Combine saved surcharge rows into named receipt lines (Weekend Surcharge, Service Charge). */
export function mergeReceiptSurchargeLines(orders) {
  const totals = new Map();
  for (const order of orders || []) {
    for (const entry of order?.surcharges || []) {
      const amount = Number(entry?.amount || 0);
      if (!(amount > 0)) continue;
      const label =
        surchargeDescription(entry?.type) !== "Surcharge"
          ? surchargeDescription(entry.type)
          : String(entry?.description || "").trim() || "Surcharge";
      totals.set(label, (totals.get(label) || 0) + amount);
    }
  }
  return [...totals.entries()].map(([label, amount]) => ({
    label,
    amount: roundMoney(amount),
  }));
}

/** POS sends `pick-up`; surcharge rules store `pickup`. */
export function surchargeOrderTypeFromPos(orderType) {
  const value = String(orderType || "").trim();
  if (value === "dine-in") return "dine-in";
  if (value === "pick-up" || value === "takeaway" || value === "pickup") {
    return "pickup";
  }
  return null;
}

export function calculatePosSurcharge({
  posSurcharges = [],
  orderType,
  subtotal = 0,
  timeZone,
  at = new Date(),
}) {
  const surchargeOrderType = surchargeOrderTypeFromPos(orderType);
  const base = Math.max(0, Number(subtotal) || 0);
  if (!surchargeOrderType) {
    return { surcharges: [], totalSurchargeAmount: 0 };
  }

  const applicable = [];
  let totalSurchargeAmount = 0;

  for (const rule of posSurcharges || []) {
    if (!rule?.isEnabled) continue;
    if (rule.orderTypes !== "all" && rule.orderTypes !== surchargeOrderType) {
      continue;
    }

    let shouldApply = false;
    if (rule.type === "Weekend") shouldApply = isWeekend(at, timeZone);
    else if (rule.type === "Service") shouldApply = true;

    if (!shouldApply) continue;

    const amount = (base * Number(rule.feeValue || 0)) / 100;
    applicable.push({
      id: rule.id,
      type: rule.type,
      feeValue: rule.feeValue,
      amount,
      description: surchargeDescription(rule.type),
    });
    totalSurchargeAmount += amount;
  }

  return {
    surcharges: applicable,
    totalSurchargeAmount: roundMoney(totalSurchargeAmount),
  };
}
