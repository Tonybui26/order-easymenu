import { isPosSourceHeldOrder } from "@/lib/pos/posHeldOrder";
import { heldEntryTableNames } from "@/lib/pos/posTableMapMerge";
import { normalizeTableMapTableName } from "@/lib/pos/posTableMaps";

/** QR self-order still active on a table (clears on delivered or cancelled). */
const ACTIVE_SELF_ORDER_TABLE_STATUSES = new Set([
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
