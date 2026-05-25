/**
 * Default item groups (Food / Drink / Misc).
 *
 * Mirror of `easymenu/lib/constants/itemGroups.js`. The admin app owns the
 * source of truth — items are assigned to groups via /admin/menu/groups and
 * the membership lists are stored on `menu.itemGroups[].itemIds`.
 *
 * This file exists in the order-manager app so the printer setup UI and the
 * print-time routing logic can reference the same group ids without crossing
 * package boundaries. Keep both copies in sync until we promote this to a real
 * shared package.
 */

export const DEFAULT_ITEM_GROUPS = [
  { id: "food", name: "Food" },
  { id: "drink", name: "Drink" },
  { id: "misc", name: "Misc" },
];

export const DEFAULT_ITEM_GROUP_IDS = DEFAULT_ITEM_GROUPS.map((g) => g.id);

/** Printer-only routing id — not used for menu item assignment. */
export const BACKUP_GROUP_ID = "backup";

/** Groups shown in printer setup (menu groups + backup). */
export const PRINTER_ROUTING_GROUPS = [
  ...DEFAULT_ITEM_GROUPS,
  { id: BACKUP_GROUP_ID, name: "Backup (leftovers)" },
];

export const PRINTER_ROUTING_GROUP_IDS = PRINTER_ROUTING_GROUPS.map(
  (g) => g.id,
);
