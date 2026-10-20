import { format, startOfHour } from "date-fns";
import { isOnlinePaymentMethod } from "@/lib/helper/orderHistoryDisplay";
import { pickCheckDiscountFromOrders } from "@/lib/pos/posResumeOrder";

const PAID_STATUSES = new Set(["paid", "partially_refunded", "refunded"]);
const REFUND_STATUSES = new Set(["partially_refunded", "refunded"]);
const CASH_METHODS = new Set(["cash", "counter-cash"]);
const CARD_METHODS = new Set(["counter-card", "credit-card"]);

function roundMoney(amount) {
  return Math.round(Number(amount || 0) * 100) / 100;
}

function paymentMethodOf(order) {
  return String(order?.paymentMethod || "").trim().toLowerCase();
}

/** One sale per POS check. QR orders have no posCheckId, so each order is a sale. */
function salesCheckKey(order) {
  const checkId = String(order?.posCheckId || "").trim();
  if (checkId) return `check:${checkId}`;
  return `order:${String(order?._id || "")}`;
}

function pickCheckPaymentMethod(orders) {
  const tender = (orders || []).find(
    (order) => order?.amountTendered != null && paymentMethodOf(order),
  );
  if (tender) return paymentMethodOf(tender);

  const withMethod = (orders || []).find((order) => paymentMethodOf(order));
  return withMethod ? paymentMethodOf(withMethod) : "";
}

function paymentBucket(method) {
  if (CASH_METHODS.has(method)) return "cash";
  if (CARD_METHODS.has(method)) return "card";
  if (isOnlinePaymentMethod(method)) return "other";
  return null;
}

function checkCreatedAtMs(tickets) {
  let earliest = null;
  for (const order of tickets || []) {
    const ms = Date.parse(order?.createdAt || "");
    if (!Number.isFinite(ms)) continue;
    if (earliest == null || ms < earliest) earliest = ms;
  }
  return earliest;
}

function isSameLocalDay(from, to) {
  return (
    from.getFullYear() === to.getFullYear() &&
    from.getMonth() === to.getMonth() &&
    from.getDate() === to.getDate()
  );
}

function emptySummary() {
  return {
    salesCount: 0,
    discountsTotal: 0,
    cashPayments: 0,
    creditCardPayments: 0,
    otherPayments: 0,
    totalSales: 0,
    weekendSurcharge: 0,
    serviceSurcharge: 0,
    totalSurcharge: 0,
    cashRefunds: 0,
    creditCardRefunds: 0,
    otherRefunds: 0,
    totalRefunds: 0,
  };
}

function paidSalesChecks(orders) {
  const paid = (orders || []).filter((order) =>
    PAID_STATUSES.has(String(order?.paymentStatus || "").trim()),
  );
  const checks = new Map();
  for (const order of paid) {
    const key = salesCheckKey(order);
    const list = checks.get(key);
    if (list) list.push(order);
    else checks.set(key, [order]);
  }
  return checks;
}

/**
 * Sales summary for one set of completed orders.
 * Refunded sales stay in the payment totals. Refunds are listed on their own.
 * @param {Array<object>} orders
 */
export function summarizeSales(orders) {
  const checks = paidSalesChecks(orders);
  if (checks.size === 0) return emptySummary();

  let discountsTotal = 0;
  let cashPayments = 0;
  let creditCardPayments = 0;
  let otherPayments = 0;
  let weekendSurcharge = 0;
  let serviceSurcharge = 0;
  let cashRefunds = 0;
  let creditCardRefunds = 0;
  let otherRefunds = 0;

  for (const tickets of checks.values()) {
    const discount = Number(
      pickCheckDiscountFromOrders(tickets)?.discountAmount || 0,
    );
    discountsTotal += discount;

    const gross = tickets.reduce(
      (sum, order) => sum + Number(order?.total || 0),
      0,
    );
    const amount = Math.max(0, roundMoney(gross - discount));
    const method = pickCheckPaymentMethod(tickets);

    if (CASH_METHODS.has(method)) cashPayments += amount;
    else if (CARD_METHODS.has(method)) creditCardPayments += amount;
    else if (isOnlinePaymentMethod(method)) otherPayments += amount;

    for (const order of tickets) {
      for (const line of order?.surcharges || []) {
        const type = String(line?.type || "").trim().toLowerCase();
        const lineAmount = Number(line?.amount || 0);
        if (!Number.isFinite(lineAmount) || lineAmount === 0) continue;
        if (type === "weekend") weekendSurcharge += lineAmount;
        else if (type === "service") serviceSurcharge += lineAmount;
      }

      const paymentStatus = String(order?.paymentStatus || "").trim();
      if (!REFUND_STATUSES.has(paymentStatus)) continue;

      const refundAmount = Number(order?.refund?.amount);
      if (!Number.isFinite(refundAmount) || refundAmount <= 0) continue;

      const refundMethod = String(order?.refund?.refundMethod || "")
        .trim()
        .toLowerCase();
      const paidBy = paymentMethodOf(order);

      if (refundMethod === "cash") cashRefunds += refundAmount;
      else if (refundMethod === "card" && isOnlinePaymentMethod(paidBy)) {
        otherRefunds += refundAmount;
      } else if (refundMethod === "card" && CARD_METHODS.has(paidBy)) {
        creditCardRefunds += refundAmount;
      }
    }
  }

  return {
    salesCount: checks.size,
    discountsTotal: roundMoney(discountsTotal),
    cashPayments: roundMoney(cashPayments),
    creditCardPayments: roundMoney(creditCardPayments),
    otherPayments: roundMoney(otherPayments),
    totalSales: roundMoney(cashPayments + creditCardPayments + otherPayments),
    weekendSurcharge: roundMoney(weekendSurcharge),
    serviceSurcharge: roundMoney(serviceSurcharge),
    totalSurcharge: roundMoney(weekendSurcharge + serviceSurcharge),
    cashRefunds: roundMoney(cashRefunds),
    creditCardRefunds: roundMoney(creditCardRefunds),
    otherRefunds: roundMoney(otherRefunds),
    totalRefunds: roundMoney(cashRefunds + creditCardRefunds + otherRefunds),
  };
}

/**
 * Sales trend for the chart. One point per hour when the range is a single
 * local day, otherwise one point per day.
 * @param {Array<object>} orders
 * @param {Date} from
 * @param {Date} to
 */
export function buildSalesTrend(orders, from, to) {
  const start = new Date(from);
  const end = new Date(to);
  if (!(start <= end)) return [];

  const byHour = isSameLocalDay(start, end);
  const buckets = new Map();

  if (byHour) {
    const cursor = startOfHour(start);
    const last = startOfHour(end);
    while (cursor <= last) {
      const key = cursor.getTime();
      buckets.set(key, emptyBucket(new Date(cursor), true));
      cursor.setTime(key + 60 * 60 * 1000);
    }
  } else {
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    const last = new Date(end);
    last.setHours(0, 0, 0, 0);
    while (cursor <= last) {
      const key = cursor.getTime();
      buckets.set(key, emptyBucket(new Date(cursor), false));
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  for (const tickets of paidSalesChecks(orders).values()) {
    const createdAt = checkCreatedAtMs(tickets);
    if (createdAt == null || createdAt < start.getTime() || createdAt > end.getTime()) {
      continue;
    }
    const when = new Date(createdAt);
    const bucketDate = byHour ? startOfHour(when) : new Date(when);
    if (!byHour) bucketDate.setHours(0, 0, 0, 0);
    const bucket = buckets.get(bucketDate.getTime());
    if (!bucket) continue;

    const discount = Number(
      pickCheckDiscountFromOrders(tickets)?.discountAmount || 0,
    );
    const gross = tickets.reduce(
      (sum, order) => sum + Number(order?.total || 0),
      0,
    );
    const amount = Math.max(0, roundMoney(gross - discount));
    const bucketName = paymentBucket(pickCheckPaymentMethod(tickets));
    if (bucketName) bucket[bucketName] = roundMoney(bucket[bucketName] + amount);
    bucket.total = roundMoney(bucket.cash + bucket.card + bucket.other);
  }

  return [...buckets.values()];
}

function emptyBucket(date, byHour) {
  return {
    label: format(date, byHour ? "h a" : "EEE d/MMM"),
    fullLabel: format(date, byHour ? "EEE d MMM yyyy, h:mm a" : "EEE d MMM yyyy"),
    cash: 0,
    card: 0,
    other: 0,
    total: 0,
  };
}
