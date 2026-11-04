import { DEFAULT_ITEM_GROUPS } from "@/lib/constants/itemGroups";

export function foodGroupOptions(itemGroups) {
  const byId = new Map((itemGroups || []).map((group) => [group.id, group]));
  return DEFAULT_ITEM_GROUPS.map((group) => {
    const savedName =
      typeof byId.get(group.id)?.name === "string"
        ? byId.get(group.id).name.trim()
        : "";
    return { id: group.id, name: savedName || group.name };
  });
}

export function foodGroupIdForItem(itemGroups, itemId) {
  for (const group of itemGroups || []) {
    if (!DEFAULT_ITEM_GROUPS.some((fallback) => fallback.id === group.id)) {
      continue;
    }
    if ((group.itemIds || []).includes(itemId)) return group.id;
  }
  return "";
}
