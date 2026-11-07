/**
 * Client helpers for POS Held Orders cards and actions.
 * See easymenu docs/pos-held-orders-flow.md for the full lifecycle.
 */

import { isCounterPayment } from "@/lib/helper/payLater";

export function isPosSourceHeldOrder(order) {
  return String(order?.source || "").trim() === "pos";
}

const PLACEHOLDER_TABLES = new Set(["takeaway", "pickup", "pick-up", "delivery"]);

function hasHeldTableNumber(order) {
  const table = String(order?.table || "").trim().toLowerCase();
  if (table && !PLACEHOLDER_TABLES.has(table)) return true;

  const tables = Array.isArray(order?.tables) ? order.tables : [];
  return tables.some((name) => {
    const value = String(name || "").trim().toLowerCase();
    return value && !PLACEHOLDER_TABLES.has(value);
  });
}

/**
 * Held card channel badge.
 * Online is a storefront pick-up (or delivery) with no table number.
 */
export function getHeldOrderChannel(order) {
  if (isPosSourceHeldOrder(order)) return "pos";

  const orderType = String(order?.orderType || "").trim();
  if (orderType === "delivery") return "online";
  if (orderType === "pick-up" && !hasHeldTableNumber(order)) return "online";
  return "qr";
}

export function getHeldOrderChannelLabel(order) {
  const channel = getHeldOrderChannel(order);
  if (channel === "pos") return "POS";
  if (channel === "online") return "Online";
  return "QR";
}

export function isSelfOrderingHeldOrder(order) {
  return !isPosSourceHeldOrder(order);
}

export function isPosPickupOrDeliveryHeldOrder(order) {
  const orderType = String(order?.orderType || "").trim();
  return orderType === "pick-up" || orderType === "delivery";
}

/** Pick-up, delivery, or takeaway table held checks (POS + Self Ordering). */
export function isPickupOrDeliveryHeldOrder(heldOrder) {
  if (isPosPickupOrDeliveryHeldOrder(heldOrder)) return true;

  const table = String(heldOrder?.table || "").trim().toLowerCase();
  return table === "takeaway" || table === "pickup";
}

/** Takeaway / pick-up held checks (not delivery). */
export function isTakeawayPickupHeldOrder(order) {
  const orderType = String(order?.orderType || "").trim();
  if (orderType === "pick-up") return true;

  const table = String(order?.table || "").trim().toLowerCase();
  return table === "takeaway" || table === "pickup";
}

export function isPosDineInHeldOrder(order) {
  return String(order?.orderType || "").trim() === "dine-in";
}

/** Drawer / card primary title for a POS held check. */
export function getPosHeldDrawerTitle(order) {
  if (isPosDineInHeldOrder(order)) {
    const tables = Array.isArray(order?.tables)
      ? order.tables.map((name) => String(name || "").trim()).filter(Boolean)
      : [];
    if (tables.length > 1) return `Table ${tables.join(", ")}`;
    const table = String(order?.table || "").trim();
    return table ? `Table ${table}` : "Dine-in";
  }

  if (isTakeawayPickupHeldOrder(order)) {
    const name = String(order?.customerName || "").trim();
    return name || "Guest";
  }

  const invoice = String(order?.taxInvoiceNo || "").trim();
  if (invoice) return `Invoice ${invoice}`;

  const orderType = String(order?.orderType || "").trim();
  if (orderType === "delivery") {
    const name = String(order?.customerName || "").trim();
    return name || "Delivery";
  }

  return "Held check";
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

  const statuses = tickets.map((ticket) => String(ticket.status || "").trim());
  if (statuses.every((status) => status === "delivered")) return "delivered";
  if (statuses.every((status) => status === "ready" || status === "delivered")) {
    return "ready";
  }
  return "preparing";
}

/** Prefer ticket statuses so a stale server aggregate cannot relabel delivered checks. */
export function resolveHeldAggregateStatus(heldOrder) {
  if ((heldOrder?.tickets || []).length > 0) {
    return computeHeldAggregateStatus(heldOrder);
  }
  return heldOrder?.aggregateStatus || "preparing";
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
  const aggregateStatus = resolveHeldAggregateStatus(heldOrder);
  const allPaid = Boolean(heldOrder?.allPaid);
  const kitchenOpen = aggregateStatus === "preparing";

  if (isPickupOrDeliveryHeldOrder(heldOrder)) {
    const awaitingPay =
      !allPaid &&
      (aggregateStatus === "ready" || aggregateStatus === "delivered");

    return {
      aggregateStatus,
      showStatus: true,
      showReady: aggregateStatus === "preparing",
      showPay: awaitingPay,
      showAllItemsServed: false,
      showComplete: allPaid && aggregateStatus === "ready",
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
      showPay: allServedAwaitingPay,
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

/** Unpaid QR / online ticket that the guest chose to pay at the counter (cash or card). */
export function isUnpaidCounterSelfOrder(heldOrder) {
  if (!heldOrder || heldOrder.allPaid || heldOrder.isPayLater) return false;
  if (isCounterPayment(heldOrder.paymentMethod)) return true;

  return (heldOrder.tickets || []).some(
    (ticket) =>
      String(ticket?.paymentStatus || "pending").trim() !== "paid" &&
      !ticket?.isPayLater &&
      isCounterPayment(ticket?.paymentMethod),
  );
}

/**
 * Self Ordering held card actions.
 * Online (already paid) follows kitchen steps. Counter cash/card shows Pay until collected.
 */
export function getSelfOrderingHeldCardActions(heldOrder) {
  const primaryStatus = getSelfOrderingHeldPrimaryStatus(heldOrder);
  const isTableOrder = isSelfOrderingTableOrder(heldOrder);
  const isPickupOrDelivery = isPickupOrDeliveryHeldOrder(heldOrder);
  const unpaidCounter = isUnpaidCounterSelfOrder(heldOrder);

  const showPrepare =
    !unpaidCounter &&
    !["ready", "delivered", "cancelled"].includes(primaryStatus) &&
    (primaryStatus === "confirmed" || primaryStatus === "accepted");

  const showReady =
    isPickupOrDelivery && primaryStatus === "preparing";

  const awaitingPay =
    isPickupOrDelivery &&
    !heldOrder?.allPaid &&
    (primaryStatus === "ready" || primaryStatus === "delivered");

  const showCounterPay = unpaidCounter && primaryStatus !== "cancelled";

  const showComplete = (() => {
    if (["delivered", "cancelled"].includes(primaryStatus)) {
      return false;
    }
    if (isTableOrder && primaryStatus === "preparing") return true;
    if (isPickupOrDelivery && primaryStatus === "ready" && heldOrder?.allPaid) {
      return true;
    }
    return false;
  })();

  return {
    primaryStatus,
    showStatus: true,
    showPrepare,
    showReady,
    showPay: awaitingPay || showCounterPay,
    showAllItemsServed: false,
    showComplete,
    showCancel: primaryStatus !== "cancelled",
    completeLabel: "Complete",
  };
}
