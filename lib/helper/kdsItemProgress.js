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

export function hasRecalledKdsLine(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  return items.some((item) => item?.kdsDone === false);
}

/** A completed ticket still has a line that has not been recalled. */
export function hasVisibleKdsCompletedLine(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  if (items.length === 0) return true;
  return items.some((item) => item?.kdsDone !== false);
}

/**
 * Preparing column while Kitchen Display is on.
 * A ready or delivered ticket stays here for the lines that were recalled.
 */
export function isKdsPreparingListOrder(order) {
  if (order?.status === "preparing") return true;
  return (
    (order?.status === "ready" || order?.status === "delivered") &&
    hasRecalledKdsLine(order)
  );
}

/**
 * Optimistic recall. One line is cleared and the status stays put.
 * Status returns to preparing only when no done line remains, or the whole ticket is recalled.
 */
export function buildRecalledOrder(order, { scope, itemId } = {}) {
  const items = (Array.isArray(order?.items) ? order.items : []).map((item) => {
    if (scope === "ticket" || String(item?._id) === String(itemId)) {
      return { ...item, kdsDone: false };
    }
    return item;
  });
  const allRecalled =
    scope === "ticket" ||
    (items.length > 0 && items.every((item) => item.kdsDone === false));
  return {
    ...order,
    items,
    status: allRecalled ? "preparing" : order?.status,
  };
}

/**
 * A line recall response can mark untouched lines as kdsDone false because
 * that field defaults to false. Keep those lines as they were.
 */
export function mergeRecalledOrder(previous, updated, { scope, itemId } = {}) {
  const previousItems = Array.isArray(previous?.items) ? previous.items : [];
  const updatedItems = Array.isArray(updated?.items) ? updated.items : [];
  const previousById = new Map(
    previousItems.map((item) => [String(item?._id), item]),
  );
  const items =
    scope === "item"
      ? updatedItems.map((item) => {
          const id = String(item?._id);
          if (id && id === String(itemId)) return { ...item, kdsDone: false };
          const prior = previousById.get(id);
          if (!prior) return item;
          return { ...item, kdsDone: prior.kdsDone };
        })
      : updatedItems;
  const allRecalled =
    scope === "ticket" ||
    (items.length > 0 && items.every((item) => item?.kdsDone === false));
  return {
    ...updated,
    items,
    status: allRecalled ? updated?.status : previous?.status,
  };
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

function pendingItemMatchesServer(item, entry) {
  if (entry?.done) return item?.kdsDone === true;
  return item?.kdsDone === false;
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
    if (pendingItemMatchesServer(item, entry)) {
      pending.delete(key);
      return item;
    }
    changed = true;
    return { ...item, kdsDone: entry.done };
  });
  if (!changed) return order;
  return { ...order, items };
}

/** Keep a recalled ticket on the live list until the poll includes it. */
export function mergePendingKdsOrders(fetched, previous, pending) {
  const list = Array.isArray(fetched) ? fetched : [];
  if (!pending?.size || !Array.isArray(previous) || previous.length === 0) {
    return list;
  }
  const seen = new Set(list.map((order) => String(order._id)));
  const extras = previous.filter(
    (order) =>
      !seen.has(String(order._id)) && hasPendingKdsUpdate(pending, order._id),
  );
  if (extras.length === 0) return list;
  return [...list, ...extras];
}

/**
 * Hold a recalled ticket at preparing until the server copy matches.
 * `pendingStatus` values are `{ status, seq }`.
 */
export function applyPendingKdsStatus(orders, pendingStatus) {
  if (!Array.isArray(orders) || !pendingStatus?.size) return orders;
  return orders.map((order) => {
    const entry = pendingStatus.get(String(order._id));
    const nextStatus = entry?.status;
    if (!nextStatus) return order;
    if (order.status === nextStatus) {
      pendingStatus.delete(String(order._id));
      return order;
    }
    return { ...order, status: nextStatus };
  });
}

/** Apply in-flight kitchen ticks, then keep recalls the poll has not returned yet. */
export function overlayInFlightKds(
  fetched,
  previous,
  pendingItems,
  pendingStatus,
) {
  const overlaid = applyPendingKdsStatus(
    applyPendingKdsDone(fetched, pendingItems),
    pendingStatus,
  );
  return mergePendingKdsOrders(overlaid, previous, pendingItems);
}
