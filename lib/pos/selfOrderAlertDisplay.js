/**
 * Self-order alert copy — table QR vs online pickup/takeaway.
 * Takeaway QR may still set table to "takeaway"; that is not a real table seat.
 */

export function getSelfOrderAlertTableNumber(table) {
  const value = String(table ?? "").trim();
  if (!value) return "";

  const normalized = value.toLowerCase();
  if (normalized === "takeaway" || normalized === "pickup") return "";

  return value;
}

/** Primary line on the self-order banner: table seat or customer name. */
export function formatSelfOrderAlertPrimaryLabel({ table, customerName } = {}) {
  const tableNumber = getSelfOrderAlertTableNumber(table);
  if (tableNumber) return `Table ${tableNumber}`;

  const name = String(customerName || "").trim();
  if (name) return name;

  return "Pickup order";
}

/** Batch summary title, e.g. "3 new orders". */
export function formatSelfOrderBatchTitle(count) {
  const total = Math.max(0, Number(count) || 0);
  if (total === 1) return "1 new order";
  return `${total} new orders`;
}

/** Comma-separated table/customer labels with overflow, e.g. "Table 3, Table 5, and 1 more". */
export function formatSelfOrderBatchDescription(orders = []) {
  const labels = orders.map((order) =>
    formatSelfOrderAlertPrimaryLabel({
      table: order.table,
      customerName: order.customerName,
    }),
  );

  if (labels.length <= 3) {
    return labels.join(", ");
  }

  const shown = labels.slice(0, 2);
  const remaining = labels.length - 2;
  return `${shown.join(", ")}, and ${remaining} more`;
}

/** macOS-style short relative time: now, 1m, 2m, 1h, … */
export function formatNotificationTimeAgo(createdAt, nowMs = Date.now()) {
  const ts = new Date(createdAt).getTime();
  if (Number.isNaN(ts)) return "now";

  const diffSec = Math.max(0, Math.floor((nowMs - ts) / 1000));
  if (diffSec < 60) return "now";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;

  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d`;
}
