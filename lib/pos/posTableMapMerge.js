export const POS_TABLE_MAP_MERGE_SELECT_FILL = "#0EA5E9";
export const POS_TABLE_MAP_MERGE_SELECT_TEXT = "#ffffff";
export const POS_TABLE_MAP_MERGED_STROKE_WIDTH = 5;

const MERGE_GROUP_COLORS = [
  "#22C55E",
  "#3B82F6",
  "#EF4444",
  "#F97316",
  "#06B6D4",
  "#EAB308",
  "#EC4899",
  "#8B5CF6",
];

const STORAGE_PREFIX = "easymenu.posTableMergeGroups";

function storageKey(storeKey) {
  return `${STORAGE_PREFIX}:${storeKey || "default"}`;
}

function createGroupId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `merge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeMergeObjectId(value) {
  return String(value || "").trim();
}

function normalizeGroup(group) {
  const objectIds = [
    ...new Set(
      (group?.objectIds || [])
        .map(normalizeMergeObjectId)
        .filter(Boolean),
    ),
  ];
  if (objectIds.length < 2) return null;
  const color = String(group?.color || "").trim();
  if (!color) return null;
  return {
    id: String(group?.id || createGroupId()),
    color,
    objectIds,
  };
}

export function loadPosTableMergeGroups(storeKey) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(storeKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const groups = Array.isArray(parsed) ? parsed : parsed?.groups;
    if (!Array.isArray(groups)) return [];
    return groups.map(normalizeGroup).filter(Boolean);
  } catch {
    return [];
  }
}

export function savePosTableMergeGroups(storeKey, groups) {
  if (typeof window === "undefined") return;
  const next = (groups || []).map(normalizeGroup).filter(Boolean);
  window.localStorage.setItem(storageKey(storeKey), JSON.stringify(next));
}

export function findMergeGroupForObject(groups, objectId) {
  const id = normalizeMergeObjectId(objectId);
  if (!id) return null;
  return (groups || []).find((group) => group.objectIds.includes(id)) || null;
}

function nextMergeColor(groups) {
  const used = new Set((groups || []).map((group) => group.color));
  const unused = MERGE_GROUP_COLORS.find((color) => !used.has(color));
  if (unused) return unused;
  return MERGE_GROUP_COLORS[(groups || []).length % MERGE_GROUP_COLORS.length];
}

/**
 * Confirm a merge of selected map objects. Overlapping existing groups are unioned.
 */
export function confirmPosTableMerge(groups, selectedObjectIds) {
  const selected = [
    ...new Set(
      (selectedObjectIds || [])
        .map(normalizeMergeObjectId)
        .filter(Boolean),
    ),
  ];
  if (selected.length < 2) {
    return { groups: groups || [], merged: false };
  }

  const overlapping = (groups || []).filter((group) =>
    group.objectIds.some((id) => selected.includes(id)),
  );
  const remaining = (groups || []).filter(
    (group) => !overlapping.includes(group),
  );
  const objectIds = [
    ...new Set([
      ...overlapping.flatMap((group) => group.objectIds),
      ...selected,
    ]),
  ];
  const color = overlapping[0]?.color || nextMergeColor(remaining);

  return {
    groups: [
      ...remaining,
      {
        id: overlapping[0]?.id || createGroupId(),
        color,
        objectIds,
      },
    ],
    merged: true,
  };
}

export function getMergeGroupColorMap(groups) {
  const map = new Map();
  (groups || []).forEach((group) => {
    group.objectIds.forEach((id) => {
      map.set(id, group.color);
    });
  });
  return map;
}
