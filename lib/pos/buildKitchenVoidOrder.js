/**
 * Build a kitchen-print payload for a voided POS cart line.
 * Used only for local docket printing — not persisted.
 *
 * Items intentionally omit kitchenStatus "cancelled" so existing
 * splitKitchenPrintOrders filters still leave the void line printable.
 */

function mapPosOrderType(orderType) {
  if (orderType === "dine-in") return "dine-in";
  if (orderType === "takeaway") return "pick-up";
  if (orderType === "delivery") return "delivery";
  if (orderType === "pick-up") return "pick-up";
  return null;
}

/**
 * @param {object} input
 * @param {object} input.line - voided cart line
 * @param {string} input.orderId - source order id (for docket #)
 * @param {string|null} input.orderType - POS order type
 * @param {string} [input.tableNumber]
 * @param {string} [input.cancelReason]
 * @param {string} [input.customerName]
 * @param {string} [input.customerPhone]
 * @param {string} [input.customerEmail]
 */
export function buildKitchenVoidOrder({
  line,
  orderId,
  orderType,
  tableNumber = "",
  cancelReason = "",
  customerName = "",
  customerPhone = "",
  customerEmail = "",
}) {
  const mappedOrderType = mapPosOrderType(orderType) || "dine-in";
  const id = String(orderId || "").trim() || `void${Date.now()}`;

  const items = [
    {
      menuItemId: line?.itemId,
      name: line?.title,
      quantity: Number(line?.quantity || 1),
      price: Number(line?.price || 0),
      notes: line?.notes || undefined,
      isTakeaway: line?.isTakeaway === true ? true : undefined,
      selectedVariants: line?.selectedVariants || [],
      selectedModifiers: line?.selectedModifiers || [],
    },
  ];

  let table = String(tableNumber || "").trim();
  if (mappedOrderType === "pick-up" || mappedOrderType === "delivery") {
    table = table || "takeaway";
  }

  return {
    _id: id,
    orderType: mappedOrderType,
    table,
    items,
    status: "preparing",
    source: "pos",
    isKitchenVoid: true,
    cancelReason: String(cancelReason || "").trim() || undefined,
    createdAt: new Date().toISOString(),
    customerName: customerName || "",
    customerPhone: customerPhone || "",
    customerEmail: customerEmail || "",
  };
}
