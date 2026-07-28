import { cartConfigKey } from "@/lib/pos/itemCustomization";

function mapPosUiOrderType(orderType) {
  if (orderType === "dine-in") return "dine-in";
  if (orderType === "pick-up") return "takeaway";
  return null;
}

function modifiersExtraTotal(selectedModifiers = []) {
  return (
    Math.round(
      selectedModifiers.reduce(
        (sum, modifier) => sum + Number(modifier.priceModifier || 0),
        0,
      ) * 100,
    ) / 100
  );
}

/**
 * Rebuild a POS cart line from a saved order item.
 * Trust stored unit `price` (already includes variants + modifiers), same as QR.
 */
function orderItemToCartLine(item, orderId) {
  const selectedVariants = item.selectedVariants || [];
  const selectedModifiers = item.selectedModifiers || [];
  const price = Math.round(Number(item.price || 0) * 100) / 100;
  const basePrice = Math.max(
    0,
    Math.round((price - modifiersExtraTotal(selectedModifiers)) * 100) / 100,
  );

  return {
    lineId: item.lineId || `${item.menuItemId}-${Date.now()}`,
    itemId: item.menuItemId,
    title: item.name || "Untitled",
    basePrice,
    price,
    quantity: Number(item.quantity || 1),
    selectedVariants,
    selectedModifiers,
    configKey: cartConfigKey(selectedVariants, selectedModifiers),
    kitchenStatus: item.kitchenStatus || "sent",
    sourceOrderId: String(orderId),
    cancelReason: item.cancelReason || "",
    cancelledAt: item.cancelledAt || null,
  };
}

/**
 * Build POS cart lines from resumed orders (orders oldest-first, items in ticket order).
 */
export function buildCartLinesFromResumeOrders(orders) {
  const sortedOrders = [...(orders || [])].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  );

  const lines = [];
  for (const order of sortedOrders) {
    for (const item of order.items || []) {
      lines.push(orderItemToCartLine(item, order._id));
    }
  }
  return lines;
}

export function isPosResumeCheckPaid(orders) {
  const list = orders || [];
  return (
    list.length > 0 &&
    list.every((order) => String(order.paymentStatus || "").trim() === "paid")
  );
}

export function buildPosResumeState(orders) {
  const sortedOrders = [...(orders || [])].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  );
  if (sortedOrders.length === 0) {
    return {
      orderIds: [],
      activeOrderId: null,
      posCheckId: null,
      tableNumber: "",
      orderType: null,
      isCheckPaid: false,
    };
  }

  const orderIds = sortedOrders.map((order) => String(order._id));
  const primary = sortedOrders[sortedOrders.length - 1];
  const orderType = mapPosUiOrderType(primary.orderType);
  const posCheckId =
    String(primary.posCheckId || "").trim() ||
    String(sortedOrders.find((order) => order.posCheckId)?.posCheckId || "").trim() ||
    null;

  return {
    orderIds,
    activeOrderId: String(primary._id),
    posCheckId,
    tableNumber: String(primary.table || "").trim(),
    orderType,
    isCheckPaid: isPosResumeCheckPaid(sortedOrders),
  };
}
