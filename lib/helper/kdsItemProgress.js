/** Indexes of lines already ticked on the kitchen display. */
export function getKdsDoneItemIndexes(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const indexes = [];
  for (let index = 0; index < items.length; index += 1) {
    if (items[index]?.kdsDone) indexes.push(index);
  }
  return indexes;
}

export function isOrderFullyMarkedDone(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  if (items.length === 0) return false;
  return items.every((item) => item?.kdsDone === true);
}

function isDineInOrder(order) {
  const canonicalOrderType = String(order?.orderType ?? "").trim();
  if (canonicalOrderType === "dine-in") return true;
  if (canonicalOrderType) return false;
  return Boolean(
    order?.table &&
      order.table !== "takeaway" &&
      String(order.table).toLowerCase() !== "pickup",
  );
}

function isPickupOrDeliveryOrder(order) {
  const canonicalOrderType = String(order?.orderType ?? "").trim();
  const isDelivery = canonicalOrderType === "delivery";
  const isDineIn = isDineInOrder(order);
  const isPickUp =
    canonicalOrderType === "pick-up" ||
    (!canonicalOrderType && !isDineIn && !isDelivery);
  return (
    isPickUp ||
    isDelivery ||
    order?.table === "takeaway" ||
    order?.table === "pickup"
  );
}

/**
 * Status to apply once every line on a preparing ticket is ticked.
 * Dine-in completes. Takeaway and delivery become ready.
 */
export function getStatusAfterAllItemsDone(order) {
  if (order?.status !== "preparing") return null;
  if (!isOrderFullyMarkedDone(order)) return null;
  if (isDineInOrder(order)) return "delivered";
  if (isPickupOrDeliveryOrder(order)) return "ready";
  return null;
}

export function hasPendingKdsUpdate(pending, orderId) {
  if (!pending?.size) return false;
  const prefix = `${orderId}:`;
  for (const key of pending.keys()) {
    if (String(key).startsWith(prefix)) return true;
  }
  return false;
}

/**
 * Keep in-flight ticks on top of a freshly fetched order list.
 * Drops a pending tick once the server copy already matches it.
 */
export function applyPendingKdsDone(orders, pending) {
  if (!Array.isArray(orders) || !pending?.size) return orders;
  return orders.map((order) => applyPendingKdsDoneToOrder(order, pending));
}

export function applyPendingKdsDoneToOrder(order, pending) {
  if (!order?.items?.length || !pending?.size) return order;
  let changed = false;
  const items = order.items.map((item) => {
    const itemId = item?._id;
    if (!itemId) return item;
    const key = `${order._id}:${itemId}`;
    const entry = pending.get(key);
    if (!entry) return item;
    if (Boolean(item.kdsDone) === entry.done) {
      pending.delete(key);
      return item;
    }
    changed = true;
    return { ...item, kdsDone: entry.done };
  });
  if (!changed) return order;
  return { ...order, items };
}
