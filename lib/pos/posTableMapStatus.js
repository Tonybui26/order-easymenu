export const POS_TABLE_MAP_STATUS = {
  available: "available",
  orderSent: "orderSent",
  billPrinted: "billPrinted",
  waitingToServe: "waitingToServe",
};

/** Fills override the table's design background while status is not available. */
export const POS_TABLE_MAP_STATUS_FILL = {
  [POS_TABLE_MAP_STATUS.orderSent]: "#FDE68A",
  [POS_TABLE_MAP_STATUS.waitingToServe]: "#F59E0B",
  [POS_TABLE_MAP_STATUS.billPrinted]: "#99F6E4",
};

export const POS_TABLE_MAP_STATUS_LABEL = {
  [POS_TABLE_MAP_STATUS.available]: "Available",
  [POS_TABLE_MAP_STATUS.orderSent]: "Order sent",
  [POS_TABLE_MAP_STATUS.waitingToServe]: "Waiting to serve",
  [POS_TABLE_MAP_STATUS.billPrinted]: "Bill printed",
};

function isAllTicketsDelivered(heldEntry) {
  const tickets = heldEntry?.tickets || [];
  if (tickets.length === 0) return false;
  return tickets.every(
    (ticket) => String(ticket.status || "").trim() === "delivered",
  );
}

/**
 * Resolve POS table map color status from a held check entry.
 * @param {object|null} heldEntry
 * @param {{ trackFoodServedOnTableMap?: boolean }} [options]
 */
export function resolvePosTableMapStatus(
  heldEntry,
  { trackFoodServedOnTableMap = false } = {},
) {
  if (!heldEntry?.orderIds?.length) {
    return POS_TABLE_MAP_STATUS.available;
  }

  const allPaid = Boolean(heldEntry.allPaid);
  const billPrinted = Boolean(heldEntry.billPrinted);
  const allServed = isAllTicketsDelivered(heldEntry);
  const trackServe = Boolean(trackFoodServedOnTableMap);

  if (!trackServe) {
    if (allPaid) return POS_TABLE_MAP_STATUS.available;
    if (billPrinted) return POS_TABLE_MAP_STATUS.billPrinted;
    return POS_TABLE_MAP_STATUS.orderSent;
  }

  if (allPaid && allServed) return POS_TABLE_MAP_STATUS.available;
  if (!allPaid && (billPrinted || allServed)) {
    return POS_TABLE_MAP_STATUS.billPrinted;
  }
  if (!allServed) return POS_TABLE_MAP_STATUS.waitingToServe;
  return POS_TABLE_MAP_STATUS.available;
}

export function getPosTableMapStatusFill(status) {
  return POS_TABLE_MAP_STATUS_FILL[status] || null;
}

export function getPosTableMapLegendStatuses(trackFoodServedOnTableMap) {
  if (trackFoodServedOnTableMap) {
    return [
      POS_TABLE_MAP_STATUS.available,
      POS_TABLE_MAP_STATUS.waitingToServe,
      POS_TABLE_MAP_STATUS.billPrinted,
    ];
  }
  return [
    POS_TABLE_MAP_STATUS.available,
    POS_TABLE_MAP_STATUS.orderSent,
    POS_TABLE_MAP_STATUS.billPrinted,
  ];
}
