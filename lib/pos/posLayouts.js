/**
 * POS menu layout helpers for the Order Manager editor.
 * Shape matches easymenu `menu.posLayouts`. The editor changes the first layout only.
 */

export const DEFAULT_POS_LAYOUT_NAME = "Default";

export function createDefaultPosLayout({
  id = "layout-default",
  name = DEFAULT_POS_LAYOUT_NAME,
  tabs = [],
} = {}) {
  return { id, name, tabs };
}

function normalizePosLayoutsArray(layouts) {
  return (layouts || [])
    .filter((layout) => layout && typeof layout === "object" && layout.id)
    .map((layout) => ({
      id: layout.id,
      name: layout.name || DEFAULT_POS_LAYOUT_NAME,
      tabs: Array.isArray(layout.tabs) ? layout.tabs : [],
    }));
}

/** Stable JSON for dirty-checking POS layout drafts. */
export function serializePosLayouts(layouts) {
  return JSON.stringify(normalizePosLayoutsArray(layouts || []));
}

export function clonePosLayouts(layouts) {
  return JSON.parse(serializePosLayouts(layouts));
}

function ensureDefaultPosLayout(layouts) {
  const list = Array.isArray(layouts) ? layouts : [];
  if (list.length > 0) return list;
  return [createDefaultPosLayout()];
}

/** Update tabs on the first layout. Creates a Default layout when none exists. */
export function updateDefaultPosLayoutTabs(layouts, tabsOrUpdater) {
  const list = ensureDefaultPosLayout(layouts).map((layout) => ({
    ...layout,
    tabs: Array.isArray(layout.tabs) ? layout.tabs : [],
  }));
  const currentTabs = list[0].tabs;
  const nextTabs =
    typeof tabsOrUpdater === "function"
      ? tabsOrUpdater(currentTabs)
      : tabsOrUpdater;
  list[0] = { ...list[0], tabs: nextTabs };
  return list;
}
