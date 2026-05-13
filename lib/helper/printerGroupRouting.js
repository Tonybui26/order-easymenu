/**
 * Per-printer item routing based on item groups (Food / Drink / Misc).
 *
 * Rules (kept intentionally simple so the behaviour is easy to predict):
 *
 *   1. printer.groupIds is empty (or missing)  → printer prints every item it
 *      receives. This is the default and matches existing behaviour, so no
 *      existing printer changes when the feature ships.
 *
 *   2. printer.groupIds has at least one id    → printer prints ONLY items
 *      whose menuItemId belongs to one of those groups. Items in other groups
 *      AND items that aren't assigned to any group are dropped.
 *
 * Group membership lives on `menu.itemGroups[].itemIds` (see
 * easymenu/models/menu.js). Each line item on an order carries `menuItemId`
 * (see easymenu/models/order.js → orderItemSchema) which is the same id used
 * inside itemGroups, so the lookup is direct.
 *
 * The helpers below run on the device, just before we push print jobs into
 * the in-process print queue. They never touch the DB or the API.
 */

/**
 * Build a Map<menuItemId, Set<groupId>> from menu.itemGroups so we can classify
 * an item in O(1). Called once per print, not per item.
 *
 * @param {Array} itemGroups - menu.itemGroups[] from MenuContext
 * @returns {Map<string, Set<string>>}
 */
export function buildItemToGroupsMap(itemGroups) {
  const map = new Map();
  if (!Array.isArray(itemGroups)) return map;

  for (const group of itemGroups) {
    if (!group?.id || !Array.isArray(group.itemIds)) continue;
    for (const itemId of group.itemIds) {
      if (!map.has(itemId)) map.set(itemId, new Set());
      map.get(itemId).add(group.id);
    }
  }

  return map;
}

/**
 * Filter the items list for a single printer.
 *
 * @param {Array} items - order.items (each has menuItemId)
 * @param {Object} printer - printer doc with optional groupIds: string[]
 * @param {Map<string, Set<string>>} itemToGroups - from buildItemToGroupsMap
 * @returns {Array} items that should be printed to this printer
 */
export function filterItemsForPrinter(items, printer, itemToGroups) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const wantedGroups = Array.isArray(printer?.groupIds) ? printer.groupIds : [];

  // No filter set → print everything. Backwards compatible with all existing
  // printers (which don't have groupIds at all).
  if (wantedGroups.length === 0) return items;

  const wantedSet = new Set(wantedGroups);

  return items.filter((item) => {
    const groups = itemToGroups.get(item?.menuItemId);
    // No group assignment → drop. Strict mode requested by product: items with
    // no group attached are skipped on printers that have a filter set.
    if (!groups || groups.size === 0) return false;

    for (const gid of groups) {
      if (wantedSet.has(gid)) return true;
    }
    return false;
  });
}

/**
 * Plan a per-printer split for an order.
 *
 * Returns an array of { printer, items } entries — one per printer that has
 * at least one item to print. Printers that end up with zero items are
 * skipped entirely (we don't want to send empty dockets).
 *
 * @param {Object} order - the order to print (must have items[])
 * @param {Array} printers - printers that already passed forTakeaway/forDineIn
 * @param {Array} itemGroups - menu.itemGroups[] from MenuContext
 * @returns {Array<{printer: Object, items: Array}>}
 */
export function planPrintJobsByGroup(order, printers, itemGroups) {
  if (!Array.isArray(printers) || printers.length === 0) return [];

  const itemToGroups = buildItemToGroupsMap(itemGroups);

  // If no items have been assigned to any group at all (e.g. the admin hasn't
  // set up item-group memberships yet), the map is empty and every filtered
  // printer would silently drop everything. Fall back to "no filter" so
  // printing still works until groups are fully configured.
  const groupsConfigured = itemToGroups.size > 0;
  if (!groupsConfigured) {
    console.warn(
      "[printerGroupRouting] itemToGroups is empty — no items are assigned to any group. " +
        "Ignoring group filters on all printers so printing is not blocked. " +
        "Go to Admin → Menu → Groups and assign items to enable per-printer routing.",
    );
  }

  const plan = [];

  for (const printer of printers) {
    // Skip group filtering entirely when no memberships are configured.
    const items = groupsConfigured
      ? filterItemsForPrinter(order?.items, printer, itemToGroups)
      : order?.items || [];

    if (items.length === 0) continue;
    plan.push({ printer, items });
  }

  return plan;
}
