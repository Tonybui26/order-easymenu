/**
 * Per-printer item routing based on item groups (Food / Drink / Misc) and
 * an optional printer-only Backup group for leftover items.
 *
 * Rules:
 *
 *   1. printer.groupIds is empty (or missing)  → printer prints every item
 *      (catch-all). Unchanged when group routing is active.
 *
 *   2. printer.groupIds has menu group ids     → printer prints ONLY matching
 *      menu items (backup id is ignored for menu matching).
 *
 *   3. printer.groupIds includes "backup"      → printer also receives leftover
 *      items (ungrouped menu items, or groups with no dedicated printer).
 *
 *   4. menu.itemGroups[].skipPrinting === true → items in that group are
 *      excluded from all dockets (no error toast; silent skip).
 *
 *   5. variant/modifier groupName contains `[[Drink]]` (etc.) → those selections
 *      print on the matching group printer only, not on the item's primary group.
 *
 * Group routing is active only when the menu has group memberships AND at
 * least one printer has non-empty groupIds.
 */

import {
  BACKUP_GROUP_ID,
  DEFAULT_ITEM_GROUPS,
  DEFAULT_ITEM_GROUP_IDS,
} from "@/lib/constants/itemGroups";
import { buildDedicatedPrinterItems } from "@/lib/helper/modifierPrintRouting";

export const MENU_GROUP_IDS = DEFAULT_ITEM_GROUP_IDS;

/**
 * Build a Map<menuItemId, Set<groupId>> from menu.itemGroups so we can classify
 * an item in O(1). Called once per print, not per item.
 */
export function buildItemToGroupsMap(itemGroups) {
  const map = new Map();
  if (!Array.isArray(itemGroups)) return map;

  for (const group of itemGroups) {
    if (!group?.id || !Array.isArray(group.itemIds)) continue;
    if (group.id === BACKUP_GROUP_ID) continue;
    for (const itemId of group.itemIds) {
      if (!map.has(itemId)) map.set(itemId, new Set());
      map.get(itemId).add(group.id);
    }
  }

  return map;
}

/** Group ids where admin has enabled skip printing for the whole group. */
export function buildSkipPrintingGroupIds(itemGroups) {
  const set = new Set();
  if (!Array.isArray(itemGroups)) return set;

  for (const group of itemGroups) {
    if (group?.id && group.skipPrinting === true) {
      set.add(group.id);
    }
  }

  return set;
}

/** True when the item belongs to at least one group with skip printing enabled. */
export function isItemSkippedForPrinting(item, itemToGroups, skipPrintingGroupIds) {
  if (!skipPrintingGroupIds?.size) return false;

  const groups = itemToGroups.get(item?.menuItemId);
  if (!groups || groups.size === 0) return false;

  for (const gid of groups) {
    if (skipPrintingGroupIds.has(gid)) return true;
  }

  return false;
}

/** Remove order lines that belong to a skip-printing group before routing. */
export function filterPrintableOrderItems(
  orderItems,
  itemToGroups,
  skipPrintingGroupIds,
) {
  if (!Array.isArray(orderItems) || orderItems.length === 0) return [];
  if (!skipPrintingGroupIds?.size) return orderItems;

  return orderItems.filter(
    (item) => !isItemSkippedForPrinting(item, itemToGroups, skipPrintingGroupIds),
  );
}

/**
 * True when menu groups exist and at least one printer has dedicated groupIds.
 */
export function isGroupRoutingActive(printers, itemGroups) {
  const itemToGroups = buildItemToGroupsMap(itemGroups);
  const groupsConfigured = itemToGroups.size > 0;
  const hasDedicatedGroupPrinter = Array.isArray(printers)
    ? printers.some(
        (p) => Array.isArray(p?.groupIds) && p.groupIds.length > 0,
      )
    : false;
  return groupsConfigured && hasDedicatedGroupPrinter;
}

export function hasBackupPrinter(printers) {
  return Array.isArray(printers)
    ? printers.some((p) => p?.groupIds?.includes(BACKUP_GROUP_ID))
    : false;
}

export function getFirstBackupPrinter(printers) {
  if (!Array.isArray(printers)) return null;
  return printers.find((p) => p?.groupIds?.includes(BACKUP_GROUP_ID)) || null;
}

/**
 * Menu groups that have at least one dedicated printer (excluding backup).
 */
export function getCoveredMenuGroups(printers) {
  const covered = new Set();
  if (!Array.isArray(printers)) return covered;

  for (const printer of printers) {
    for (const gid of printer?.groupIds || []) {
      if (gid !== BACKUP_GROUP_ID && MENU_GROUP_IDS.includes(gid)) {
        covered.add(gid);
      }
    }
  }

  return covered;
}

/**
 * True when an order line item is a "leftover" for backup routing.
 *
 * Leftover means no Food/Drink/Misc printer will receive it in pass 1:
 *   - the menu item has no group assignment, or
 *   - every group the item belongs to lacks a dedicated printer
 *     (no printer with that groupId in groupIds, excluding backup).
 */
export function isLeftoverItem(item, itemToGroups, coveredMenuGroups) {
  const groups = itemToGroups.get(item?.menuItemId);
  if (!groups || groups.size === 0) return true;

  for (const gid of groups) {
    if (coveredMenuGroups.has(gid)) return false;
  }

  return true;
}

/**
 * Order line items eligible for the backup printer (pass 2).
 * See isLeftoverItem — ungrouped items and items whose groups have no
 * dedicated printer are leftovers; coveredMenuGroups is derived from printers.
 */
export function getLeftoverItems(orderItems, itemToGroups, printers) {
  if (!Array.isArray(orderItems) || orderItems.length === 0) return [];

  const coveredMenuGroups = getCoveredMenuGroups(printers);
  return orderItems.filter((item) =>
    isLeftoverItem(item, itemToGroups, coveredMenuGroups),
  );
}

/**
 * Filter the items list for a single printer (menu groups only; not backup).
 */
export function filterItemsForPrinter(items, printer, itemToGroups) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const wantedGroups = Array.isArray(printer?.groupIds) ? printer.groupIds : [];

  if (wantedGroups.length === 0) return items;

  const menuWantedGroups = wantedGroups.filter(
    (gid) => gid !== BACKUP_GROUP_ID && MENU_GROUP_IDS.includes(gid),
  );

  if (menuWantedGroups.length === 0) return [];

  const wantedSet = new Set(menuWantedGroups);

  return items.filter((item) => {
    const groups = itemToGroups.get(item?.menuItemId);
    if (!groups || groups.size === 0) return false;

    for (const gid of groups) {
      if (wantedSet.has(gid)) return true;
    }
    return false;
  });
}

function getGroupDisplayName(groupId, itemGroups) {
  const fromMenu = Array.isArray(itemGroups)
    ? itemGroups.find((g) => g.id === groupId)
    : null;
  if (fromMenu?.name) return fromMenu.name;

  const fromDefault = DEFAULT_ITEM_GROUPS.find((g) => g.id === groupId);
  return fromDefault?.name || groupId;
}

function getPrinterKey(printer) {
  return printer?._id || printer?.name || "";
}

function isItemInPlan(plan, item) {
  const menuItemId = item?.menuItemId;
  if (!menuItemId) return false;

  for (const entry of plan || []) {
    if (entry?.items?.some((planItem) => planItem?.menuItemId === menuItemId)) {
      return true;
    }
  }

  return false;
}

function mergeItemsIntoPlan(plan, printer, newItems) {
  if (!Array.isArray(newItems) || newItems.length === 0) return;

  const printerKey = getPrinterKey(printer);
  const existing = plan.find((entry) => getPrinterKey(entry.printer) === printerKey);

  if (existing) {
    const seen = new Set(existing.items.map((item) => item.menuItemId));
    for (const item of newItems) {
      if (!seen.has(item.menuItemId)) {
        existing.items.push(item);
        seen.add(item.menuItemId);
      }
    }
    return;
  }

  plan.push({ printer, items: [...newItems] });
}

/**
 * Order line items not assigned to any printer in the print plan.
 */
export function getUnroutedItems(orderItems, printPlan) {
  if (!Array.isArray(orderItems) || orderItems.length === 0) return [];

  return orderItems.filter((item) => !isItemInPlan(printPlan, item));
}

/**
 * Single item detail for routing alert toasts.
 */
export function formatUnroutedItemMessage(item, itemToGroups, itemGroups) {
  const name = item?.name || "Unknown item";
  const groups = itemToGroups.get(item?.menuItemId);

  if (!groups || groups.size === 0) {
    return `${name} (No group — no printer for this group)`;
  }

  const firstGroupId = [...groups][0];
  const displayName = getGroupDisplayName(firstGroupId, itemGroups);
  return `${name} (${displayName} — no printer for this group)`;
}

export function buildUnroutedPrintMessage(
  unroutedItems,
  itemToGroups,
  itemGroups,
) {
  const parts = unroutedItems.map((item) =>
    formatUnroutedItemMessage(item, itemToGroups, itemGroups),
  );
  return `Not printed (no grouped printer): ${parts.join("; ")}`;
}

export function buildBackupPrintMessage(
  backupPrintedItems,
  itemToGroups,
  itemGroups,
) {
  const parts = backupPrintedItems.map((item) =>
    formatUnroutedItemMessage(item, itemToGroups, itemGroups),
  );
  return `Sent to backup printer: ${parts.join("; ")}`;
}

/**
 * Plan print jobs, route leftovers to backup, and detect still-unrouted items.
 */
export function planPrintJobsWithRouting(order, printers, itemGroups) {
  const itemToGroups = buildItemToGroupsMap(itemGroups);
  const skipPrintingGroupIds = buildSkipPrintingGroupIds(itemGroups);
  const groupsConfigured = itemToGroups.size > 0;
  const routingActive = isGroupRoutingActive(printers, itemGroups);

  if (!groupsConfigured) {
    console.warn(
      "[printerGroupRouting] itemToGroups is empty — no items are assigned to any group. " +
        "Ignoring group filters on all printers so printing is not blocked. " +
        "Go to Admin → Menu → Groups and assign items to enable per-printer routing.",
    );
  }

  const plan = [];
  const orderItems = order?.items || [];
  const printableOrderItems = filterPrintableOrderItems(
    orderItems,
    itemToGroups,
    skipPrintingGroupIds,
  );

  if (!Array.isArray(printers) || printers.length === 0) {
    return {
      plan,
      unroutedItems: [],
      backupPrintedItems: [],
      routingActive,
      itemToGroups,
    };
  }

  if (!routingActive) {
    for (const printer of printers) {
      if (printableOrderItems.length === 0) continue;
      plan.push({ printer, items: printableOrderItems });
    }

    return {
      plan,
      unroutedItems: [],
      backupPrintedItems: [],
      routingActive,
      itemToGroups,
    };
  }

  // Pass 1: menu group printers + catch-all (empty groupIds).
  for (const printer of printers) {
    const groupIds = Array.isArray(printer?.groupIds) ? printer.groupIds : [];
    const menuWantedGroups = groupIds.filter(
      (gid) => gid !== BACKUP_GROUP_ID && MENU_GROUP_IDS.includes(gid),
    );

    let items =
      groupIds.length === 0
        ? printableOrderItems
        : filterItemsForPrinter(printableOrderItems, printer, itemToGroups);

    if (menuWantedGroups.length > 0) {
      items = buildDedicatedPrinterItems(
        items,
        printableOrderItems,
        menuWantedGroups,
        itemGroups,
      );
    }

    if (items.length === 0) continue;
    plan.push({ printer, items });
  }

  const leftoverItems = getLeftoverItems(
    printableOrderItems,
    itemToGroups,
    printers,
  );
  let backupPrintedItems = [];

  if (leftoverItems.length > 0 && hasBackupPrinter(printers)) {
    const backupPrinter = getFirstBackupPrinter(printers);
    mergeItemsIntoPlan(plan, backupPrinter, leftoverItems);
    backupPrintedItems = leftoverItems;
  }

  const unroutedItems = leftoverItems.filter((item) => !isItemInPlan(plan, item));

  return {
    plan,
    unroutedItems,
    backupPrintedItems,
    routingActive,
    itemToGroups,
  };
}

/**
 * Plan a per-printer split for an order.
 */
export function planPrintJobsByGroup(order, printers, itemGroups) {
  return planPrintJobsWithRouting(order, printers, itemGroups).plan;
}
