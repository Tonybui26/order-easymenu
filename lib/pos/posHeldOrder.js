/**
 * Client helpers for POS Held Orders cards and actions.
 * See easymenu docs/pos-held-orders-flow.md for the full lifecycle.
 */

export function isPosSourceHeldOrder(order) {
  return String(order?.source || "").trim() === "pos";
}

export function isSelfOrderingHeldOrder(order) {
  return !isPosSourceHeldOrder(order);
}

export function isPosPickupOrDeliveryHeldOrder(order) {
  const orderType = String(order?.orderType || "").trim();
  return orderType === "pick-up" || orderType === "delivery";
}

export function isPosDineInHeldOrder(order) {
  return String(order?.orderType || "").trim() === "dine-in";
}

export function computeHeldAggregateStatus(heldOrder) {
  const tickets = heldOrder?.tickets || [];
  const orderType = heldOrder?.orderType;

  if (tickets.length === 0) return "preparing";

  if (isPosDineInHeldOrder(heldOrder)) {
    return tickets.every(
      (ticket) => String(ticket.status || "").trim() === "delivered",
    )
      ? "delivered"
      : "preparing";
  }

  return tickets.every((ticket) => String(ticket.status || "").trim() === "ready")
    ? "ready"
    : "preparing";
}

/** Kitchen / service status label on Held cards (UI alias; DB statuses unchanged). */
export function getHeldAggregateStatusLabel(heldOrder, aggregateStatus) {
  if (isPosDineInHeldOrder(heldOrder)) {
    if (aggregateStatus === "delivered" && !heldOrder?.allPaid) {
      return "Served";
    }
    if (aggregateStatus === "preparing") return "Preparing";
    return "Delivered";
  }

  if (aggregateStatus === "ready") return "Ready";
  if (aggregateStatus === "delivered") return "Delivered";
  return "Preparing";
}

/**
 * Held card kitchen status + actions by order type.
 * Dine-in complete actions always persist `delivered`; labels differ by payment.
 */
export function getPosHeldCardActions(heldOrder) {
  const aggregateStatus =
    heldOrder?.aggregateStatus || computeHeldAggregateStatus(heldOrder);
  const allPaid = Boolean(heldOrder?.allPaid);
  const kitchenOpen = aggregateStatus === "preparing";

  if (isPosPickupOrDeliveryHeldOrder(heldOrder)) {
    return {
      aggregateStatus,
      showStatus: true,
      showReady: aggregateStatus === "preparing",
      showAllItemsServed: false,
      showComplete: aggregateStatus === "ready" && allPaid,
      completeLabel: "Complete",
    };
  }

  if (isPosDineInHeldOrder(heldOrder)) {
    const allServedAwaitingPay =
      aggregateStatus === "delivered" && !allPaid;

    return {
      aggregateStatus,
      showStatus: kitchenOpen || allServedAwaitingPay,
      showReady: false,
      showAllItemsServed: !allPaid && kitchenOpen,
      showComplete: allPaid && kitchenOpen,
      completeLabel: "Complete",
      allItemsServedLabel: "All Served",
    };
  }

  return {
    aggregateStatus,
    showStatus: false,
    showReady: false,
    showAllItemsServed: false,
    showComplete: false,
    completeLabel: "Complete",
  };
}

export function getTicketIdsByStatus(heldOrder, status) {
  return (heldOrder?.tickets || [])
    .filter((ticket) => String(ticket.status || "").trim() === status)
    .map((ticket) => String(ticket.orderId));
}

export function getTicketIdsNotDelivered(heldOrder) {
  return (heldOrder?.tickets || [])
    .filter((ticket) => String(ticket.status || "").trim() !== "delivered")
    .map((ticket) => String(ticket.orderId));
}

export function getAllTicketIds(heldOrder) {
  return (heldOrder?.tickets || heldOrder?.orderIds || []).map((entry) =>
    typeof entry === "string" ? entry : String(entry.orderId),
  );
}
