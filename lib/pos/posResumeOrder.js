import {
  cartConfigKey,
  computeLineBasePrice,
  computeLineUnitPrice,
} from "@/lib/pos/itemCustomization";

function mapPosUiOrderType(orderType) {
  if (orderType === "dine-in") return "dine-in";
  if (orderType === "pick-up") return "takeaway";
  return null;
}

function orderItemToCartLine(item, menuItemPrice) {
  const selectedVariants = item.selectedVariants || [];
  const selectedModifiers = item.selectedModifiers || [];
  const basePrice = computeLineBasePrice(
    selectedVariants,
    Number(menuItemPrice ?? item.price ?? 0),
  );
  const price = Number(item.price ?? computeLineUnitPrice(basePrice, selectedModifiers));

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
  };
}

/**
 * Build POS cart lines from resumed orders (orders oldest-first, items in ticket order).
 */
export function buildCartLinesFromResumeOrders(orders, itemsById = new Map()) {
  const sortedOrders = [...(orders || [])].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  );

  const lines = [];
  for (const order of sortedOrders) {
    for (const item of order.items || []) {
      if (item.kitchenStatus === "cancelled") continue;
      const menuItem = itemsById.get(item.menuItemId);
      lines.push(orderItemToCartLine(item, menuItem?.price));
    }
  }
  return lines;
}

export function buildPosResumeState(orders) {
  const sortedOrders = [...(orders || [])].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  );
  if (sortedOrders.length === 0) {
    return {
      orderIds: [],
      activeOrderId: null,
      tableNumber: "",
      orderType: null,
    };
  }

  const orderIds = sortedOrders.map((order) => String(order._id));
  const primary = sortedOrders[sortedOrders.length - 1];
  const orderType = mapPosUiOrderType(primary.orderType);

  return {
    orderIds,
    activeOrderId: String(primary._id),
    tableNumber: String(primary.table || "").trim(),
    orderType,
  };
}
