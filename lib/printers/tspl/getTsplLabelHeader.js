import { normalizeLabelText } from "./buildTsplItemLabel.js";

/**
 * Line 1 text for a cup/item label from order context.
 * @param {Object} order
 * @returns {string|null} Header line, or null when none applies
 */
export function getTsplLabelHeader(order) {
  if (!order) return null;

  const orderType = String(order.orderType || "").trim();

  if (orderType === "dine-in") {
    const table = String(order.table || "").trim();
    if (!table) return null;
    return normalizeLabelText(`Table ${table}`);
  }

  if (orderType === "delivery") {
    const customerName = normalizeLabelText(order.customerName);
    return customerName ? `Delivery ${customerName}` : "Delivery";
  }

  // Pick-up / takeaway (default)
  const customerName = normalizeLabelText(order.customerName);
  return customerName ? `Pick-up ${customerName}` : "Pick-up";
}
