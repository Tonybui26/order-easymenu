const PAID_HISTORY_STATUSES = new Set([
  "paid",
  "partially_refunded",
  "refunded",
]);

export function isPaidDeliveredHistoryOrder(order) {
  if (String(order?.source || "").trim() !== "pos") return false;
  if (String(order?.status || "").trim() !== "delivered") return false;
  return PAID_HISTORY_STATUSES.has(String(order?.paymentStatus || "").trim());
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

export function formatOrderHistoryPaymentMethod(paymentMethod) {
  const method = String(paymentMethod || "").trim().toLowerCase();
  if (method === "counter-cash" || method === "cash") return "Cash";
  if (method === "counter-card") return "Card";
  if (method === "stripe" || method === "card") return "Card";
  if (!method) return "—";
  return method.charAt(0).toUpperCase() + method.slice(1);
}

export function formatOrderHistoryCustomer(order) {
  const name = String(
    order?.customerName || order?.customer?.name || "",
  ).trim();
  return name || "—";
}

export function formatOrderHistoryInvoiceNo(order) {
  return String(order?.taxInvoiceNo || "").trim() || "—";
}

export function formatOrderHistoryTotal(order) {
  return `$${Number(order?.total || 0).toFixed(2)}`;
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

/** Group POS history rows by taxInvoiceNo; orders without one stay as single-ticket rows. */
export function groupOrdersByTaxInvoiceNo(orders) {
  const eligible = (orders || []).filter(isPaidDeliveredHistoryOrder);
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
    const ticketCount = group.length;
    const invoiceNo = String(primary?.taxInvoiceNo || "").trim();
    const totalAmount =
      Math.round(
        group.reduce((sum, order) => sum + Number(order.total || 0), 0) * 100,
      ) / 100;

    return {
      id: invoiceNo || String(primary._id),
      orderIds: group.map((order) => String(order._id)),
      orders: group,
      invoice: invoiceNo || "—",
      date: formatOrderHistoryDate(primary.createdAt, timezone),
      customer: formatOrderHistoryCustomer(pickCustomerOrder(group)),
      details: formatOrderHistoryOrderDetails(primary, ticketCount),
      drawerSubtitle: formatOrderHistoryDrawerSubtitle(primary, ticketCount),
      payment: formatOrderHistoryPaymentMethod(pickPaymentMethod(group)),
      total: `$${totalAmount.toFixed(2)}`,
    };
  });
}
