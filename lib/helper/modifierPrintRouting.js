/**
 * Split order-line variants/modifiers by `[[Group]]` markers and build routed docket lines.
 */

import { getPreferredPrintName } from "@/lib/helper/printNameAlias";
import {
  parsePrintGroupMarker,
  resolvePrintGroupId,
  stripPrintGroupMarker,
} from "@/lib/helper/printGroupMarker";

/**
 * @typedef {{ groupName: string, optionId?: string, optionName?: string, [key: string]: unknown }} OrderSelection
 */

/**
 * Split selections into local (no marker) vs routed by target menu group id.
 * @param {OrderSelection[]|null|undefined} selections
 * @param {Array<{ id?: string, name?: string }>|null|undefined} itemGroups
 * @returns {{ local: OrderSelection[], routed: Map<string, OrderSelection[]> }}
 */
export function splitSelectionsByPrintGroup(selections, itemGroups) {
  const local = [];
  const routed = new Map();

  for (const selection of selections || []) {
    const parsed = parsePrintGroupMarker(selection?.groupName);
    if (!parsed) {
      local.push(selection);
      continue;
    }

    const groupId = resolvePrintGroupId(parsed.marker, itemGroups);
    if (!groupId) {
      local.push(selection);
      continue;
    }

    if (!routed.has(groupId)) routed.set(groupId, []);
    routed.get(groupId).push({
      ...selection,
      groupName: parsed.displayName || stripPrintGroupMarker(selection.groupName),
    });
  }

  return { local, routed };
}

/**
 * Remove variant/modifier selections tagged with `[[Group]]` from an order line
 * (used on the item's primary group printer, e.g. food docket for a combo).
 * @param {Record<string, unknown>} item
 * @param {Array<{ id?: string, name?: string }>|null|undefined} itemGroups
 */
export function stripRoutedSelectionsFromItem(item, itemGroups) {
  const modSplit = splitSelectionsByPrintGroup(item?.selectedModifiers, itemGroups);
  const varSplit = splitSelectionsByPrintGroup(item?.selectedVariants, itemGroups);

  return {
    ...item,
    selectedModifiers: modSplit.local,
    selectedVariants: varSplit.local,
  };
}

/**
 * Build synthetic order lines for modifier/variant values routed to a printer group.
 * Each selected option becomes `{ qty } x { optionName }` on the target docket.
 *
 * @param {Record<string, unknown>[]} orderItems
 * @param {string[]} targetGroupIds
 * @param {Array<{ id?: string, name?: string }>|null|undefined} itemGroups
 * @returns {Record<string, unknown>[]}
 */
export function buildRoutedSelectionPrintItems(
  orderItems,
  targetGroupIds,
  itemGroups,
) {
  if (!Array.isArray(orderItems) || targetGroupIds.length === 0) return [];

  const targetSet = new Set(targetGroupIds);
  const lines = [];

  for (const item of orderItems) {
    const modSplit = splitSelectionsByPrintGroup(item?.selectedModifiers, itemGroups);
    const varSplit = splitSelectionsByPrintGroup(item?.selectedVariants, itemGroups);
    const qty = item?.quantity ?? 1;

    for (const groupId of targetSet) {
      const modifiers = modSplit.routed.get(groupId) || [];
      const variants = varSplit.routed.get(groupId) || [];

      for (const selection of [...modifiers, ...variants]) {
        const optionName = getPreferredPrintName(selection?.optionName);
        if (!optionName) continue;

        const optionId = selection?.optionId || optionName;
        lines.push({
          name: optionName,
          quantity: qty,
          menuItemId: `${item?.menuItemId || "item"}__routed__${groupId}__${optionId}`,
          selectedModifiers: [],
          selectedVariants: [],
          price: item?.price,
        });
      }
    }
  }

  return lines;
}

/**
 * Prepare order lines for a dedicated group printer: native group items without
 * routed selections, plus synthetic lines for selections tagged for this group.
 *
 * @param {Record<string, unknown>[]} matchedItems
 * @param {Record<string, unknown>[]} allOrderItems
 * @param {string[]} menuWantedGroupIds
 * @param {Array<{ id?: string, name?: string }>|null|undefined} itemGroups
 */
export function buildDedicatedPrinterItems(
  matchedItems,
  allOrderItems,
  menuWantedGroupIds,
  itemGroups,
) {
  const strippedItems = (matchedItems || []).map((item) =>
    stripRoutedSelectionsFromItem(item, itemGroups),
  );
  const routedItems = buildRoutedSelectionPrintItems(
    allOrderItems,
    menuWantedGroupIds,
    itemGroups,
  );

  return [...strippedItems, ...routedItems];
}
