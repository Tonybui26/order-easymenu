export function isCounterPayment(paymentMethod) {
  return (
    paymentMethod === "cash" ||
    paymentMethod === "counter-cash" ||
    paymentMethod === "counter-card"
  );
}

export function isDineInOrder(order) {
  const canonicalOrderType = String(order?.orderType ?? "").trim();
  if (canonicalOrderType === "dine-in") return true;
  const table = String(order?.table ?? "").trim();
  return Boolean(table && table !== "takeaway");
}

/** Matches easymenu menu.config.allowPayLaterAtCounter — only pilot stores opt in. */
export function isPayLaterAtCounterEnabled(menuConfig) {
  return Boolean(menuConfig?.allowPayLaterAtCounter);
}

export function isPayLaterEligible(order, menuConfig) {
  if (!isPayLaterAtCounterEnabled(menuConfig)) return false;
  if (!order) return false;
  return isDineInOrder(order) && isCounterPayment(order.paymentMethod);
}

/** Pay-later pilot: keep delivered orders in live list until payment is collected. */
export function shouldKeepDeliveredInActive(order, menuConfig) {
  if (!isPayLaterAtCounterEnabled(menuConfig)) return false;
  return (
    Boolean(order?.isPayLater) &&
    order.paymentStatus === "pending" &&
    order.status === "delivered"
  );
}

/**
 * Unpaid pending orders included in live polling.
 * Default stores: legacy counter-cash only. Pilot stores: all counter methods.
 */
export function isPendingCounterOrderInActiveList(order, menuConfig) {
  if (order.paymentStatus !== "pending") return false;
  if (isPayLaterAtCounterEnabled(menuConfig)) {
    return isCounterPayment(order.paymentMethod);
  }
  return order.paymentMethod === "counter-cash";
}

/** Client-side active-order filter (must stay aligned with easymenu GET /api/orders). */
export function filterOrdersForActiveList(orders, menuConfig) {
  return orders.filter((order) => {
    if (
      ["confirmed", "accepted", "preparing", "ready"].includes(order.status)
    ) {
      return true;
    }

    if (["cancelled", "delivered"].includes(order.status)) {
      return shouldKeepDeliveredInActive(order, menuConfig);
    }

    return isPendingCounterOrderInActiveList(order, menuConfig);
  });
}

/** New-tab queue: pay-later confirmed unpaid (pilot stores only). */
export function isPayLaterOrderInNewTab(order, menuConfig) {
  if (!isPayLaterAtCounterEnabled(menuConfig)) return false;
  return (
    order.status === "confirmed" &&
    order.paymentStatus === "pending" &&
    Boolean(order.isPayLater)
  );
}
