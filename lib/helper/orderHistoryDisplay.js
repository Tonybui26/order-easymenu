import { pickCheckDiscountFromOrders } from "@/lib/pos/posResumeOrder";

const PAID_HISTORY_STATUSES = new Set([
  "paid",
  "partially_refunded",
  "refunded",
]);

const UNPAID_HISTORY_STATUSES = new Set(["pending", "failed", ""]);

export function isDeliveredHistoryOrder(order) {
  if (String(order?.status || "").trim() !== "delivered") return false;

  const paymentStatus = String(order?.paymentStatus || "pending").trim();
  return (
    PAID_HISTORY_STATUSES.has(paymentStatus) ||
    UNPAID_HISTORY_STATUSES.has(paymentStatus)
  );
}

/** POS-only delivered history row (legacy helper). */
export function isPosDeliveredHistoryOrder(order) {
  if (String(order?.source || "").trim() !== "pos") return false;
  return isDeliveredHistoryOrder(order);
}

/** @deprecated Use isPosDeliveredHistoryOrder */
export function isPaidDeliveredHistoryOrder(order) {
  return isPosDeliveredHistoryOrder(order);
}

/** One destructive action per row: refund when paid, delete when unpaid. */
export function resolveHistoryRowPrimaryAction(orders = []) {
  const statuses = orders.map((order) =>
    String(order?.paymentStatus || "pending").trim(),
  );

  if (statuses.some((status) => status === "paid")) {
    return "refund";
  }

  if (statuses.some((status) => UNPAID_HISTORY_STATUSES.has(status))) {
    return "delete";
  }

  return null;
}

export function formatOrderHistoryDate(isoDate, timezone) {
  if (!isoDate) return "—";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "—";

  const tz = String(timezone || "").trim() || "Australia/Melbourne";
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
  const datePart = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(date);

  return `${time} - ${datePart}`;
}

export function formatOrderHistoryOrderType(orderType, table) {
  const type = String(orderType || "").trim().toLowerCase();
  if (type === "dine-in") return "Dine-in";
  if (type === "delivery") return "Delivery";
  if (type === "pick-up" || type === "takeaway") return "Takeaway";

  const tableValue = String(table || "").trim().toLowerCase();
  if (tableValue === "takeaway" || tableValue === "pick-up") return "Takeaway";

  return "Takeaway";
}

export function formatOrderHistoryTableLabel(table) {
  const value = String(table || "").trim();
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower === "takeaway" || lower === "pick-up") return null;
  return value;
}

export function formatOrderHistoryOrderTypeWithTable(orderType, table) {
  const typeLabel = formatOrderHistoryOrderType(orderType, table);
  const tableLabel = formatOrderHistoryTableLabel(table);
  if (typeLabel === "Dine-in" && tableLabel) {
    return `${typeLabel} · Table ${tableLabel}`;
  }
  return typeLabel;
}

export function formatOrderHistoryShortOrderId(orderId) {
  return String(orderId || "").slice(-6).toUpperCase() || "—";
}

export function formatOrderHistoryOrderDetails(primaryOrder, ticketCount = 1) {
  const shortId = formatOrderHistoryShortOrderId(primaryOrder?._id);
  const typeLabel = formatOrderHistoryOrderTypeWithTable(
    primaryOrder?.orderType,
    primaryOrder?.table,
  );

  if (ticketCount > 1) {
    return `${ticketCount} tickets - ${typeLabel}`;
  }

  return `#${shortId} - ${typeLabel}`;
}

/** Drawer subtitle — order type (+ table) once; ticket ids live on each ticket block. */
export function formatOrderHistoryDrawerSubtitle(primaryOrder, ticketCount = 1) {
  const typeLabel = formatOrderHistoryOrderTypeWithTable(
    primaryOrder?.orderType,
    primaryOrder?.table,
  );

  if (ticketCount > 1) {
    return `${ticketCount} tickets - ${typeLabel}`;
  }

  return typeLabel;
}

const ONLINE_PAYMENT_METHODS = new Set([
  "stripe",
  "credit_card",
  "apple_pay",
  "google_pay",
]);

export function isOnlinePaymentMethod(paymentMethod) {
  return ONLINE_PAYMENT_METHODS.has(
    String(paymentMethod || "").trim().toLowerCase(),
  );
}

export function formatOrderHistoryPaymentMethod(paymentMethod) {
  const method = String(paymentMethod || "").trim().toLowerCase();
  if (isOnlinePaymentMethod(method)) return "Online";
  if (method === "counter-cash" || method === "cash") return "Cash";
  if (method === "counter-card") return "Card";
  if (!method) return "—";
  return method.charAt(0).toUpperCase() + method.slice(1);
}

export function formatOrderHistoryCustomer(order) {
  const name = String(
    order?.customerName || order?.customer?.name || "",
  ).trim();
  return name || "—";
}

/** Short Stripe payment id for history rows when no tax invoice exists. */
export function formatOrderHistoryPaymentIdReference(paymentIntentId) {
  const id = String(paymentIntentId || "").trim();
  if (!id) return null;

  const tail = id.replace(/^pi_/, "").slice(-8).toUpperCase();
  return tail ? `#${tail}` : id;
}

/** Tax invoice no, or payment id reference for online orders without one. */
export function formatOrderHistoryInvoiceReference(orders) {
  const list = Array.isArray(orders) ? orders : [orders];
  if (!list.length) return "—";

  const invoiceNo = String(list[0]?.taxInvoiceNo || "").trim();
  if (invoiceNo) return invoiceNo;

  for (const order of list) {
    const paymentRef = formatOrderHistoryPaymentIdReference(order?.paymentIntentId);
    if (paymentRef) return paymentRef;
  }

  return "—";
}

export function formatOrderHistoryInvoiceNo(order) {
  return formatOrderHistoryInvoiceReference([order]);
}

export function formatOrderHistoryTotal(order) {
  return `$${Number(order?.total || 0).toFixed(2)}`;
}

function roundMoney(amount) {
  return Math.round(Number(amount || 0) * 100) / 100;
}

export function sumOrderGroupGrossTotal(orders = []) {
  return roundMoney(
    orders.reduce((sum, order) => sum + Number(order?.total || 0), 0),
  );
}

export function sumOrderGroupSubtotal(orders = []) {
  return roundMoney(
    orders.reduce(
      (sum, order) => sum + Number(order?.subtotal ?? order?.total ?? 0),
      0,
    ),
  );
}

export function pickOrderGroupProcessingFee(orders = []) {
  return roundMoney(
    (orders || []).reduce(
      (max, order) => Math.max(max, Number(order?.processingFee || 0)),
      0,
    ),
  );
}

export function formatOrderHistoryDiscountLabel(checkDiscount) {
  if (
    !checkDiscount?.discountAmount ||
    Number(checkDiscount.discountAmount) <= 0 ||
    !checkDiscount?.discountType
  ) {
    return null;
  }

  if (
    checkDiscount.discountType === "percent" &&
    checkDiscount.discountPercent != null
  ) {
    return `-${Number(checkDiscount.discountPercent).toFixed(2)}%`;
  }

  return `-$${Number(checkDiscount.discountAmount).toFixed(2)}`;
}

/** Whole-check total: item subtotals minus discount plus card processing fee. */
export function computeOrderGroupCheckTotal(orders = []) {
  const subtotal = sumOrderGroupSubtotal(orders);
  const discount = pickCheckDiscountFromOrders(orders);
  const discountAmount = Number(discount?.discountAmount || 0);
  const processingFee = pickOrderGroupProcessingFee(orders);
  return Math.max(0, roundMoney(subtotal - discountAmount + processingFee));
}

export function sumOrderGroupRefundTotal(orders = []) {
  return roundMoney(
    orders.reduce((sum, order) => {
      const amount = Number(order?.refund?.amount);
      if (!Number.isFinite(amount) || amount <= 0) return sum;
      return sum + amount;
    }, 0),
  );
}

export function computeOrderGroupNetTotal(orders = []) {
  const gross = sumOrderGroupGrossTotal(orders);
  const refunded = sumOrderGroupRefundTotal(orders);
  return Math.max(0, roundMoney(gross - refunded));
}

export function formatRefundMethodLabel(refundMethod) {
  const method = String(refundMethod || "").trim().toLowerCase();
  if (method === "cash") return "Cash";
  if (method === "card") return "Card";
  return method ? method.charAt(0).toUpperCase() + method.slice(1) : "—";
}

export function formatRefundTypeLabel(refundType) {
  if (refundType === "partial") return "Partial refund";
  if (refundType === "full") return "Full refund";
  return "Refund";
}

export function formatOrderHistoryRefundDate(isoDate, timezone) {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;

  const tz = String(timezone || "").trim() || "Australia/Melbourne";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/** Refund lines aggregated across tickets on one tax invoice row. */
export function collectOrderGroupRefundSummary(orders = [], timezone) {
  const grossTotal = computeOrderGroupCheckTotal(orders);
  const refunds = [];

  for (const order of orders) {
    const refund = order?.refund;
    const amount = Number(refund?.amount);
    if (!refund || !Number.isFinite(amount) || amount <= 0) continue;

    refunds.push({
      orderId: String(order._id || ""),
      shortId: formatOrderHistoryShortOrderId(order._id),
      amount: roundMoney(amount),
      refundType: refund.refundType || null,
      refundMethod: refund.refundMethod || null,
      reason: String(refund.reason || "").trim() || null,
      processedAt: refund.processedAt || null,
      processedAtLabel: formatOrderHistoryRefundDate(
        refund.processedAt,
        timezone,
      ),
    });
  }

  const totalRefunded = roundMoney(
    refunds.reduce((sum, entry) => sum + entry.amount, 0),
  );

  return {
    hasRefund: totalRefunded > 0,
    grossTotal,
    totalRefunded,
    netTotal: Math.max(0, roundMoney(grossTotal - totalRefunded)),
    refunds,
  };
}

function sortOrdersOldestFirst(orders) {
  return [...orders].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  );
}

function pickCustomerOrder(orders) {
  for (const order of orders) {
    if (formatOrderHistoryCustomer(order) !== "—") return order;
  }
  return orders[0];
}

function pickPaymentMethod(orders) {
  for (const order of orders) {
    if (String(order?.paymentMethod || "").trim()) {
      return order.paymentMethod;
    }
  }
  return null;
}

/** Order to attach when sending a receipt email for a history row. */
export function pickHistoryReceiptOrder(orders = []) {
  const paid = orders.find(
    (order) => String(order?.paymentStatus || "").trim() === "paid",
  );
  return paid || orders[0] || null;
}

export function pickHistoryReceiptEmail(orders = []) {
  for (const order of orders) {
    const email = String(order?.customerEmail || "").trim();
    if (email) return email;
  }
  return "";
}

export function historyRowSupportsEmailReceipt(row) {
  if (row?.payment !== "Online") return false;
  return (row?.orders || []).some(
    (order) => String(order?.paymentStatus || "").trim() === "paid",
  );
}

/** Prefer dine-in + real table over takeaway when a check mixes order types. */
function isDineInWithTableOrder(order) {
  const type = String(order?.orderType || "").trim().toLowerCase();
  if (type !== "dine-in") return false;
  return Boolean(formatOrderHistoryTableLabel(order?.table));
}

function pickOrderTypeDisplayOrder(orders = []) {
  const dineInWithTable = orders.find(isDineInWithTableOrder);
  if (dineInWithTable) return dineInWithTable;
  return orders[0];
}

/** Group history rows by taxInvoiceNo; orders without one stay as single-ticket rows. */
export function groupOrdersByTaxInvoiceNo(orders) {
  const eligible = (orders || []).filter(isDeliveredHistoryOrder);
  const byInvoice = new Map();
  const standalone = [];

  for (const order of eligible) {
    const invoiceNo = String(order.taxInvoiceNo || "").trim();
    if (!invoiceNo) {
      standalone.push(order);
      continue;
    }

    if (!byInvoice.has(invoiceNo)) byInvoice.set(invoiceNo, []);
    byInvoice.get(invoiceNo).push(order);
  }

  const groups = [
    ...[...byInvoice.values()].map(sortOrdersOldestFirst),
    ...standalone.map((order) => [order]),
  ];

  return groups.sort(
    (a, b) => new Date(b[0].createdAt) - new Date(a[0].createdAt),
  );
}

export function buildOrderHistoryRows(orders, timezone) {
  return groupOrdersByTaxInvoiceNo(orders).map((group) => {
    const primary = group[0];
    const typeDisplayOrder = pickOrderTypeDisplayOrder(group);
    const ticketCount = group.length;
    const invoice = formatOrderHistoryInvoiceReference(group);
    const refundSummary = collectOrderGroupRefundSummary(group, timezone);
    const primaryAction = resolveHistoryRowPrimaryAction(group);

    return {
      id:
        String(primary?.taxInvoiceNo || "").trim() ||
        String(primary?.paymentIntentId || "").trim() ||
        String(primary._id),
      orderIds: group.map((order) => String(order._id)),
      orders: group,
      invoice,
      date: formatOrderHistoryDate(primary.createdAt, timezone),
      customer: formatOrderHistoryCustomer(pickCustomerOrder(group)),
      details: formatOrderHistoryOrderDetails(typeDisplayOrder, ticketCount),
      drawerSubtitle: formatOrderHistoryDrawerSubtitle(
        typeDisplayOrder,
        ticketCount,
      ),
      payment: formatOrderHistoryPaymentMethod(pickPaymentMethod(group)),
      grossTotal: refundSummary.grossTotal,
      refundSummary,
      primaryAction,
      total: `$${refundSummary.netTotal.toFixed(2)}`,
      timezone,
    };
  });
}

export const ORDER_HISTORY_PAYMENT_FILTER_ALL = "all";

export const ORDER_HISTORY_PAYMENT_FILTER_OPTIONS = [
  { id: ORDER_HISTORY_PAYMENT_FILTER_ALL, label: "All payments" },
  { id: "Online", label: "Online" },
  { id: "Cash", label: "Cash" },
  { id: "Card", label: "Card" },
];

export const ORDER_HISTORY_DATE_FILTER_TODAY = "today";

export const ORDER_HISTORY_DATE_FILTER_OPTIONS = [
  { id: ORDER_HISTORY_DATE_FILTER_TODAY, label: "Today", daysAgo: 0 },
  { id: "yesterday", label: "Yesterday", daysAgo: 1 },
  { id: "2days", label: "2 days ago", daysAgo: 2 },
  { id: "3days", label: "3 days ago", daysAgo: 3 },
];

/**
 * Local calendar-day bounds as UTC ISO strings for completed-orders API.
 * Matches Live Order Terminal: filter by the device's local day boundaries.
 * @param {string} [dateFilterId]
 * @returns {{ startDate: string, endDate: string }}
 */
export function getOrderHistoryDateRangeUTC(
  dateFilterId = ORDER_HISTORY_DATE_FILTER_TODAY,
) {
  const option =
    ORDER_HISTORY_DATE_FILTER_OPTIONS.find((item) => item.id === dateFilterId) ||
    ORDER_HISTORY_DATE_FILTER_OPTIONS[0];
  const daysAgo = Number.isFinite(option?.daysAgo) ? option.daysAgo : 0;

  const day = new Date();
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() - daysAgo);

  const startOfLocalDay = new Date(day);
  startOfLocalDay.setHours(0, 0, 0, 0);

  const endOfLocalDay = new Date(day);
  endOfLocalDay.setHours(23, 59, 59, 999);

  return {
    startDate: startOfLocalDay.toISOString(),
    endDate: endOfLocalDay.toISOString(),
  };
}

/**
 * Client-side filter for Order History table rows.
 * @param {Array} rows
 * @param {string} [searchQuery]
 * @param {string} [paymentFilter] - display payment label, or "all"
 */
export function filterOrderHistoryRows(
  rows = [],
  searchQuery = "",
  paymentFilter = ORDER_HISTORY_PAYMENT_FILTER_ALL,
) {
  const q = String(searchQuery || "")
    .trim()
    .toLowerCase();
  const payment = String(paymentFilter || ORDER_HISTORY_PAYMENT_FILTER_ALL).trim();

  return rows.filter((row) => {
    if (
      payment !== ORDER_HISTORY_PAYMENT_FILTER_ALL &&
      String(row.payment || "").trim() !== payment
    ) {
      return false;
    }

    if (!q) return true;

    const haystack = [
      row.invoice,
      row.date,
      row.customer,
      row.details,
      row.payment,
      row.total,
      ...(Array.isArray(row.orderIds) ? row.orderIds : []),
    ]
      .map((value) => String(value || "").toLowerCase())
      .join(" ");
    return haystack.includes(q);
  });
}
