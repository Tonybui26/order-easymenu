/**
 * Build a kitchen-print payload for POS training mode.
 * Not persisted — used only for local docket printing.
 */

function mapPosOrderType(orderType) {
  if (orderType === "dine-in") return "dine-in";
  if (orderType === "takeaway") return "pick-up";
  if (orderType === "delivery") return "delivery";
  return null;
}

/**
 * @param {object} input
 * @param {Array} input.lines - unsent cart lines to print
 * @param {string|null} input.orderType - POS order type (dine-in, takeaway, …)
 * @param {string} input.tableNumber
 */
export function buildTrainingKitchenOrder({ lines = [], orderType, tableNumber }) {
  const mappedOrderType = mapPosOrderType(orderType);
  const trainingId = `training${Date.now()}`;

  const items = lines.map((line) => ({
    menuItemId: line.itemId,
    name: line.title,
    quantity: Number(line.quantity || 1),
    price: Number(line.price || 0),
    selectedVariants: line.selectedVariants || [],
    selectedModifiers: line.selectedModifiers || [],
  }));

  let table = tableNumber || "";
  if (mappedOrderType === "pick-up" || mappedOrderType === "delivery") {
    table = table || "takeaway";
  }

  return {
    _id: trainingId,
    orderType: mappedOrderType,
    table,
    items,
    status: "preparing",
    source: "pos",
    isTraining: true,
    createdAt: new Date().toISOString(),
    customerName: "Training",
    customerPhone: "",
    customerEmail: "",
    pickupTime: "Training",
  };
}
