export const POS_TABLE_MAP_STATUS = {
  available: "available",
  orderSent: "orderSent",
  occupied: "occupied",
  billPrinted: "billPrinted",
  waitingToServe: "waitingToServe",
};

/** Fills override the table's design background while status is not available. */
export const POS_TABLE_MAP_STATUS_FILL = {
  [POS_TABLE_MAP_STATUS.orderSent]: "#FDE68A",
  [POS_TABLE_MAP_STATUS.occupied]: "#9209c8",
  [POS_TABLE_MAP_STATUS.waitingToServe]: "#F59E0B",
  [POS_TABLE_MAP_STATUS.billPrinted]: "#99F6E4",
};

/** Label color when a status fill overrides the table design background. */
export const POS_TABLE_MAP_STATUS_TEXT_COLOR = {
  [POS_TABLE_MAP_STATUS.occupied]: "#ffffff",
};

export const POS_TABLE_MAP_STATUS_LABEL = {
  [POS_TABLE_MAP_STATUS.available]: "Available",
  [POS_TABLE_MAP_STATUS.orderSent]: "Order sent",
  [POS_TABLE_MAP_STATUS.occupied]: "Occupied",
  [POS_TABLE_MAP_STATUS.waitingToServe]: "Waiting to serve",
  [POS_TABLE_MAP_STATUS.billPrinted]: "Bill printed",
};

function isAllTicketsDelivered(tickets) {
  if (!tickets.length) return false;
  return tickets.every(
    (ticket) => String(ticket.status || "").trim() === "delivered",
  );
}

/**
 * Tickets that drive floor serve colors (waiting to serve / occupied).
 * pending / confirmed / accepted = not in kitchen yet — do not treat as
 * waiting to serve (unpaid QR uses Occupied + QR / payment-due dots).
 */
function getTicketsForFloorServeStatus(heldEntry) {
  return (heldEntry?.tickets || []).filter((ticket) => {
    const status = String(ticket?.status || "").trim();
    if (!status || status === "cancelled") return false;
    if (["pending", "confirmed", "accepted"].includes(status)) return false;
    return true;
  });
}

/**
 * Resolve POS table map color status from a held check entry.
 * Always tracks kitchen serve state so paid undelivered checks stay visible.
 * Pay-at-counter stores that want Available on payment should enable
 * markAllTicketsDeliveredOnPayment.
 */
export function resolvePosTableMapStatus(heldEntry) {
  if (!heldEntry?.orderIds?.length) {
    return POS_TABLE_MAP_STATUS.available;
  }

  const allPaid = Boolean(heldEntry.allPaid);
  const billPrinted = Boolean(heldEntry.billPrinted);
  const serveTickets = getTicketsForFloorServeStatus(heldEntry);

  // Only pending (and/or cancelled) tickets — not sent to kitchen yet.
  // Unpaid QR pending: Occupied (table in use); payment-due / QR dots still apply.
  // Do not use Waiting to serve until kitchen has started.
  if (serveTickets.length === 0) {
    if (!allPaid && billPrinted) return POS_TABLE_MAP_STATUS.billPrinted;
    if (!allPaid) return POS_TABLE_MAP_STATUS.occupied;
    return POS_TABLE_MAP_STATUS.available;
  }

  const allServed = isAllTicketsDelivered(serveTickets);

  // - unpaid + not served → waiting to serve
  // - unpaid + served + no bill → occupied (open check; can still order more)
  // - unpaid + bill printed → bill printed
  // - paid + not served → waiting to serve (Complete clears table)
  // - paid + served → available
  // Sending more kitchen tickets clears billPrintedAt and restarts waiting to serve.
  if (allPaid && allServed) return POS_TABLE_MAP_STATUS.available;
  if (!allPaid && billPrinted) return POS_TABLE_MAP_STATUS.billPrinted;
  if (!allServed) return POS_TABLE_MAP_STATUS.waitingToServe;
  if (!allPaid) return POS_TABLE_MAP_STATUS.occupied;
  return POS_TABLE_MAP_STATUS.available;
}

export function getPosTableMapStatusFill(status) {
  return POS_TABLE_MAP_STATUS_FILL[status] || null;
}

export function getPosTableMapStatusTextColor(status) {
  return POS_TABLE_MAP_STATUS_TEXT_COLOR[status] || null;
}

export function getPosTableMapLegendStatuses() {
  return [
    POS_TABLE_MAP_STATUS.waitingToServe,
    POS_TABLE_MAP_STATUS.occupied,
    POS_TABLE_MAP_STATUS.billPrinted,
  ];
}
