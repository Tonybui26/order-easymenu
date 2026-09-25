import { isPosSourceHeldOrder } from "@/lib/pos/posHeldOrder";
import { heldEntryTableNames } from "@/lib/pos/posTableMapMerge";
import { normalizeTableMapTableName } from "@/lib/pos/posTableMaps";

/** QR self-order still active on a table (clears on delivered or cancelled). */
const ACTIVE_SELF_ORDER_TABLE_STATUSES = new Set([
  "pending",
  "confirmed",
  "accepted",
  "preparing",
  "ready",
]);

export function isActiveSelfOrderTableIndicatorStatus(status) {
  return ACTIVE_SELF_ORDER_TABLE_STATUSES.has(
    String(status || "").trim(),
  );
}

export function isSelfOrderingDineInTableHeldEntry(heldEntry) {
  if (!heldEntry || isPosSourceHeldOrder(heldEntry)) return false;
  if (String(heldEntry?.orderType || "").trim() !== "dine-in") return false;
  return heldEntryTableNames(heldEntry).length > 0;
}

export function heldEntryShowsSelfOrderTableDot(heldEntry) {
  if (!isSelfOrderingDineInTableHeldEntry(heldEntry)) return false;

  const tickets = heldEntry?.tickets || [];
  if (tickets.length === 0) {
    return isActiveSelfOrderTableIndicatorStatus(heldEntry?.status);
  }

  return tickets.some((ticket) =>
    isActiveSelfOrderTableIndicatorStatus(ticket?.status),
  );
}

/** Set of normalized table names with an active QR self-order. */
export function buildSelfOrderTableIndicatorKeys(heldOrders = []) {
  const keys = new Set();

  for (const entry of heldOrders) {
    if (!heldEntryShowsSelfOrderTableDot(entry)) continue;

    for (const tableName of heldEntryTableNames(entry)) {
      const key = normalizeTableMapTableName(tableName);
      if (key) keys.add(key);
    }
  }

  return keys;
}

export function hasSelfOrderTableIndicator(heldOrders, tableName) {
  const key = normalizeTableMapTableName(tableName);
  if (!key) return false;
  return buildSelfOrderTableIndicatorKeys(heldOrders).has(key);
}

function heldEntryHasUnpaidQrPayment(heldEntry) {
  if (!heldEntry) return false;

  const tickets = heldEntry.tickets || [];
  const qrIds = Array.isArray(heldEntry.qrOrderIds)
    ? heldEntry.qrOrderIds.map(String).filter(Boolean)
    : [];

  if (qrIds.length > 0) {
    const qrSet = new Set(qrIds);
    return tickets.some(
      (ticket) =>
        qrSet.has(String(ticket.orderId)) &&
        String(ticket?.paymentStatus || "").trim() !== "paid",
    );
  }

  // Pure QR / composite without explicit qrOrderIds: non-POS dine-in unpaid
  if (isPosSourceHeldOrder(heldEntry)) return false;
  if (String(heldEntry?.orderType || "").trim() !== "dine-in") return false;
  if (heldEntry.allPaid) return false;
  if (tickets.length === 0) return !Boolean(heldEntry.allPaid);
  return tickets.some(
    (ticket) => String(ticket?.paymentStatus || "").trim() !== "paid",
  );
}

/**
 * Tables with unpaid QR dine-in — red payment-due dot.
 * Only in pay-first mode (payment is the next staff action).
 * Serve-first / !payFirst uses Send to kitchen first; unpaid is expected.
 */
export function buildUnpaidQrPaymentTableIndicatorKeys(
  heldOrders = [],
  { payFirstMode = false } = {},
) {
  const keys = new Set();
  if (!payFirstMode) return keys;

  for (const entry of heldOrders || []) {
    if (!heldEntryHasUnpaidQrPayment(entry)) continue;

    for (const tableName of heldEntryTableNames(entry)) {
      const key = normalizeTableMapTableName(tableName);
      if (key) keys.add(key);
    }
  }

  return keys;
}

export function hasUnpaidQrPaymentTableIndicator(
  heldOrders,
  tableName,
  { payFirstMode = false } = {},
) {
  const key = normalizeTableMapTableName(tableName);
  if (!key) return false;
  return buildUnpaidQrPaymentTableIndicatorKeys(heldOrders, {
    payFirstMode,
  }).has(key);
}
