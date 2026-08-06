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

const SELF_ORDERING_STATUS_RANK = {
  pending: 0,
  confirmed: 1,
  accepted: 2,
  preparing: 3,
  ready: 4,
  delivered: 5,
};

/** Primary ticket status for Self Ordering held cards (actual DB status, not POS aggregate). */
export function getSelfOrderingHeldPrimaryStatus(heldOrder) {
  const tickets = heldOrder?.tickets || [];
  if (tickets.length === 0) return "confirmed";
  if (tickets.length === 1) {
    return String(tickets[0].status || "").trim() || "confirmed";
  }

  let leastAdvanced = "confirmed";
  let leastRank = Infinity;
  for (const ticket of tickets) {
    const status = String(ticket.status || "").trim() || "confirmed";
    const rank = SELF_ORDERING_STATUS_RANK[status] ?? 99;
    if (rank < leastRank) {
      leastRank = rank;
      leastAdvanced = status;
    }
  }
  return leastAdvanced;
}

const SELF_ORDERING_STATUS_LABELS = {
  pending: "Pending",
  confirmed: "Confirmed",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
  delivered: "Delivered",
};

export function getSelfOrderingHeldStatusLabel(status) {
  const normalized = String(status || "").trim();
  if (SELF_ORDERING_STATUS_LABELS[normalized]) {
    return SELF_ORDERING_STATUS_LABELS[normalized];
  }
  if (!normalized) return "—";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function isSelfOrderingTableOrder(heldOrder) {
  return isPosDineInHeldOrder(heldOrder);
}

function isSelfOrderingPickupOrDelivery(heldOrder) {
  const orderType = String(heldOrder?.orderType || "").trim();
  const table = String(heldOrder?.table || "").trim().toLowerCase();
  return (
    isPosPickupOrDeliveryHeldOrder(heldOrder) ||
    table === "takeaway" ||
    table === "pickup"
  );
}

/**
 * Self Ordering held card actions — mirrors Live Order Terminal (non-counter online flow).
 */
export function getSelfOrderingHeldCardActions(heldOrder) {
  const primaryStatus = getSelfOrderingHeldPrimaryStatus(heldOrder);
  const isTableOrder = isSelfOrderingTableOrder(heldOrder);
  const isPickupOrDelivery = isSelfOrderingPickupOrDelivery(heldOrder);

  const showPrepare =
    !["ready", "delivered", "cancelled"].includes(primaryStatus) &&
    (primaryStatus === "confirmed" || primaryStatus === "accepted");

  const showReady =
    isPickupOrDelivery && primaryStatus === "preparing";

  const showComplete = (() => {
    if (["ready", "delivered", "cancelled"].includes(primaryStatus)) {
      return false;
    }
    if (isTableOrder && primaryStatus === "preparing") return true;
    if (isPickupOrDelivery && primaryStatus === "ready") return true;
    return false;
  })();

  return {
    primaryStatus,
    showStatus: true,
    showPrepare,
    showReady,
    showAllItemsServed: false,
    showComplete,
    completeLabel: "Complete",
  };
}
