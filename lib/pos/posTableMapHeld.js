import { isPosSourceHeldOrder } from "@/lib/pos/posHeldOrder";
import { normalizeTableMapTableName } from "@/lib/pos/posTableMaps";
import { heldEntryTableNames } from "@/lib/pos/posTableMapMerge";
import { isSelfOrderingDineInTableHeldEntry } from "@/lib/pos/posTableMapSelfOrder";

function heldEntryMatchesTable(heldEntry, targetKey) {
  return heldEntryTableNames(heldEntry).some(
    (name) => normalizeTableMapTableName(name) === targetKey,
  );
}

/** POS held check for a table seat (excludes QR / online). */
export function findPosHeldOrderForTable(heldOrders, tableName) {
  const target = normalizeTableMapTableName(tableName);
  if (!target) return null;

  return (
    (heldOrders || []).find((order) => {
      if (!isPosSourceHeldOrder(order)) return false;
      return heldEntryMatchesTable(order, target);
    }) || null
  );
}

/**
 * QR/online dine-in held checks for a table (paid and unpaid).
 * Unpaid pay-at-counter tickets occupy the map so staff can pay / send to kitchen.
 */
export function listSelfOrderingHeldOrdersForTable(heldOrders, tableName) {
  const target = normalizeTableMapTableName(tableName);
  if (!target) return [];

  return (heldOrders || []).filter((order) => {
    if (!isSelfOrderingDineInTableHeldEntry(order)) return false;
    return heldEntryMatchesTable(order, target);
  });
}

/**
 * Paid QR/online dine-in held checks for a table (may be multiple).
 * @deprecated Prefer listSelfOrderingHeldOrdersForTable / buildTableMapDrawerHeldEntry
 */
export function listPaidSelfOrderingHeldOrdersForTable(heldOrders, tableName) {
  return listSelfOrderingHeldOrdersForTable(heldOrders, tableName).filter(
    (order) => Boolean(order?.allPaid),
  );
}

/**
 * Paid QR/online dine-in held check for a table (first match).
 * @deprecated Prefer listSelfOrderingHeldOrdersForTable / buildTableMapDrawerHeldEntry
 */
export function findPaidSelfOrderingHeldOrderForTable(heldOrders, tableName) {
  return listPaidSelfOrderingHeldOrdersForTable(heldOrders, tableName)[0] || null;
}

export function isTableMapCompositeHeldEntry(heldEntry) {
  return Boolean(heldEntry?.isTableMapComposite);
}

export function getDrawerPosOrderIds(heldEntry) {
  if (!heldEntry) return [];
  if (Array.isArray(heldEntry.posOrderIds)) {
    return heldEntry.posOrderIds.map(String).filter(Boolean);
  }
  if (isPosSourceHeldOrder(heldEntry)) {
    return (heldEntry.orderIds || []).map(String).filter(Boolean);
  }
  return [];
}

export function getDrawerQrOrderIds(heldEntry) {
  if (!heldEntry) return [];
  if (Array.isArray(heldEntry.qrOrderIds)) {
    return heldEntry.qrOrderIds.map(String).filter(Boolean);
  }
  if (
    !isPosSourceHeldOrder(heldEntry) &&
    !isTableMapCompositeHeldEntry(heldEntry)
  ) {
    return (heldEntry.orderIds || []).map(String).filter(Boolean);
  }
  return [];
}

/** Unpaid ticket ids on a table-map drawer entry (POS and/or QR). */
export function getDrawerPayableOrderIds(heldEntry) {
  if (!heldEntry) return [];

  const tickets = heldEntry.tickets || [];
  if (tickets.length > 0) {
    return tickets
      .filter(
        (ticket) => String(ticket?.paymentStatus || "").trim() !== "paid",
      )
      .map((ticket) => String(ticket.orderId))
      .filter(Boolean);
  }

  if (heldEntry.allPaid) return [];
  return (heldEntry.orderIds || []).map(String).filter(Boolean);
}

export function drawerEntryHasPosCheck(heldEntry) {
  return getDrawerPosOrderIds(heldEntry).length > 0;
}

export function drawerEntryHasQrContext(heldEntry) {
  return getDrawerQrOrderIds(heldEntry).length > 0;
}

/**
 * Drawer model for a table: POS check and/or QR dine-in tickets (paid or unpaid).
 */
export function buildTableMapDrawerHeldEntry(heldOrders, tableName) {
  const target = normalizeTableMapTableName(tableName);
  if (!target) return null;

  const pos = findPosHeldOrderForTable(heldOrders, tableName);
  const qrEntries = listSelfOrderingHeldOrdersForTable(heldOrders, tableName);

  if (!pos && qrEntries.length === 0) return null;
  if (pos && qrEntries.length === 0) return pos;
  if (!pos && qrEntries.length === 1) return qrEntries[0];

  const parts = [pos, ...qrEntries].filter(Boolean);
  const posOrderIds = pos
    ? (pos.orderIds || []).map(String).filter(Boolean)
    : [];
  const qrOrderIds = qrEntries.flatMap((entry) =>
    (entry.orderIds || []).map(String).filter(Boolean),
  );
  const orderIds = [...posOrderIds, ...qrOrderIds];
  const tickets = parts.flatMap((entry) => entry.tickets || []);
  const total = parts.reduce((sum, entry) => sum + Number(entry.total || 0), 0);
  const amountDue = parts.reduce(
    (sum, entry) => sum + Number(entry.amountDue || 0),
    0,
  );
  const allPaid = parts.every((entry) => Boolean(entry.allPaid));
  const tables =
    Array.isArray(pos?.tables) && pos.tables.length > 0
      ? pos.tables
      : heldEntryTableNames(pos || qrEntries[0]);

  return {
    id: `table-map:${target}`,
    isTableMapComposite: true,
    orderIds,
    posOrderIds,
    qrOrderIds,
    posCheckId: pos?.posCheckId || null,
    taxInvoiceNo: pos?.taxInvoiceNo || qrEntries[0]?.taxInvoiceNo || null,
    orderType: "dine-in",
    table: String(tableName || "").trim() || tables[0] || "",
    tables,
    customerName: pos?.customerName || qrEntries[0]?.customerName || "",
    source: "mixed",
    tickets,
    aggregateStatus: pos?.aggregateStatus || qrEntries[0]?.aggregateStatus,
    status: pos?.status || qrEntries[0]?.status,
    total,
    allPaid,
    amountDue,
    posAllPaid: pos ? Boolean(pos.allPaid) : true,
    billPrinted: Boolean(pos?.billPrinted),
    createdAt: parts
      .map((entry) => entry.createdAt)
      .filter(Boolean)
      .sort((a, b) => new Date(a) - new Date(b))[0],
    heldAt: parts
      .map((entry) => entry.heldAt || entry.createdAt)
      .filter(Boolean)
      .sort((a, b) => new Date(a) - new Date(b))[0],
    orderCount: orderIds.length,
  };
}

/**
 * Table map tap / drawer target for a seat.
 */
export function findHeldOrderForTableMap(heldOrders, tableName) {
  return buildTableMapDrawerHeldEntry(heldOrders, tableName);
}
