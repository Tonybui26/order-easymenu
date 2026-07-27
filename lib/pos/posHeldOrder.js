/**
 * Client helpers for POS Held Orders cards and actions.
 * See easymenu docs/pos-held-orders-flow.md for the full lifecycle.
 */

export function isPosPickupOrDeliveryHeldOrder(order) {
  const orderType = String(order?.orderType || "").trim();
  return orderType === "pick-up" || orderType === "delivery";
}

export function computeHeldAggregateStatus(tickets) {
  const list = tickets || [];
  if (list.length === 0) return "preparing";
  return list.every((ticket) => String(ticket.status || "").trim() === "ready")
    ? "ready"
    : "preparing";
}

/**
 * Which actions to show on a Held card (takeaway/delivery only).
 * @returns {{ showReady: boolean, showComplete: boolean, aggregateStatus: string }}
 */
export function getPosHeldTakeawayActions(heldOrder) {
  const aggregateStatus =
    heldOrder?.aggregateStatus ||
    computeHeldAggregateStatus(heldOrder?.tickets);

  if (!isPosPickupOrDeliveryHeldOrder(heldOrder)) {
    return { showReady: false, showComplete: false, aggregateStatus };
  }

  const allPaid = Boolean(heldOrder?.allPaid);

  return {
    aggregateStatus,
    showReady: aggregateStatus === "preparing",
    showComplete: aggregateStatus === "ready" && allPaid,
  };
}

export function getTicketIdsByStatus(heldOrder, status) {
  return (heldOrder?.tickets || [])
    .filter((ticket) => String(ticket.status || "").trim() === status)
    .map((ticket) => String(ticket.orderId));
}

export function getAllTicketIds(heldOrder) {
  return (heldOrder?.tickets || heldOrder?.orderIds || []).map((entry) =>
    typeof entry === "string" ? entry : String(entry.orderId),
  );
}
