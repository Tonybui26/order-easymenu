import {
  getTableMapTableName,
  isTableMapTable,
  normalizeTableMapTableName,
} from "@/lib/pos/posTableMaps";

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

export function normalizeMergeTableName(value) {
  return String(value || "").trim();
}

function sortTableNames(names) {
  return [...names].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  );
}

function uniqueTableNames(values) {
  const names = [];
  const seen = new Set();
  for (const value of values || []) {
    const name = normalizeMergeTableName(value);
    if (!name) continue;
    const key = normalizeTableMapTableName(name);
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return sortTableNames(names);
}

function normalizeGroup(group, objectIdToName = null) {
  let tableNames = uniqueTableNames(group?.tableNames);

  // Migrate legacy object-id groups using the current floor plan.
  if (tableNames.length < 2 && objectIdToName && Array.isArray(group?.objectIds)) {
    tableNames = uniqueTableNames(
      group.objectIds.map((id) => objectIdToName.get(String(id || "").trim())),
    );
  }

  if (tableNames.length < 2) return null;
  const color = String(group?.color || "").trim();
  if (!color) return null;
  return {
    id: String(group?.id || createGroupId()),
    color,
    tableNames,
  };
}

export function buildTableMapObjectIdToName(tableMap) {
  const map = new Map();
  for (const object of tableMap?.objects || []) {
    if (!isTableMapTable(object)) continue;
    const id = String(object.id || "").trim();
    const name = getTableMapTableName(object);
    if (id && name) map.set(id, name);
  }
  return map;
}

export function loadPosTableMergeGroups(storeKey, tableMap = null) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(storeKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const groups = Array.isArray(parsed) ? parsed : parsed?.groups;
    if (!Array.isArray(groups)) return [];
    const objectIdToName = tableMap
      ? buildTableMapObjectIdToName(tableMap)
      : null;
    return groups
      .map((group) => normalizeGroup(group, objectIdToName))
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function savePosTableMergeGroups(storeKey, groups) {
  if (typeof window === "undefined") return;
  const next = (groups || []).map((group) => normalizeGroup(group)).filter(Boolean);
  window.localStorage.setItem(storageKey(storeKey), JSON.stringify(next));
}

export function findMergeGroupForTable(groups, tableName) {
  const target = normalizeTableMapTableName(tableName);
  if (!target) return null;
  return (
    (groups || []).find((group) =>
      (group.tableNames || []).some(
        (name) => normalizeTableMapTableName(name) === target,
      ),
    ) || null
  );
}

function nextMergeColor(groups) {
  const used = new Set((groups || []).map((group) => group.color));
  const unused = MERGE_GROUP_COLORS.find((color) => !used.has(color));
  if (unused) return unused;
  return MERGE_GROUP_COLORS[(groups || []).length % MERGE_GROUP_COLORS.length];
}

/**
 * Confirm a merge of selected table names. Overlapping existing groups are unioned.
 */
export function confirmPosTableMerge(groups, selectedTableNames) {
  const selected = uniqueTableNames(selectedTableNames);
  if (selected.length < 2) {
    return { groups: groups || [], merged: false };
  }

  const selectedKeys = new Set(
    selected.map((name) => normalizeTableMapTableName(name)),
  );
  const overlapping = (groups || []).filter((group) =>
    (group.tableNames || []).some((name) =>
      selectedKeys.has(normalizeTableMapTableName(name)),
    ),
  );
  const remaining = (groups || []).filter(
    (group) => !overlapping.includes(group),
  );
  const tableNames = uniqueTableNames([
    ...overlapping.flatMap((group) => group.tableNames),
    ...selected,
  ]);
  const color = overlapping[0]?.color || nextMergeColor(remaining);

  return {
    groups: [
      ...remaining,
      {
        id: overlapping[0]?.id || createGroupId(),
        color,
        tableNames,
      },
    ],
    merged: true,
  };
}

/** Color map keyed by normalized table name. */
export function getMergeGroupColorMap(groups) {
  const map = new Map();
  (groups || []).forEach((group) => {
    (group.tableNames || []).forEach((name) => {
      map.set(normalizeTableMapTableName(name), group.color);
    });
  });
  return map;
}

/**
 * Drop any merge group that overlaps the given seat names.
 * Returns the filtered groups (may be unchanged).
 */
export function removeGroupsOverlappingTables(groups, tableNames) {
  const keys = new Set(
    uniqueTableNames(tableNames).map((name) =>
      normalizeTableMapTableName(name),
    ),
  );
  if (!keys.size) return groups || [];
  return (groups || []).filter(
    (group) =>
      !(group.tableNames || []).some((name) =>
        keys.has(normalizeTableMapTableName(name)),
      ),
  );
}

/** Remove the whole merge group that contains the given table name. */
export function removeMergeGroupContainingTable(groups, tableName) {
  const target = normalizeTableMapTableName(tableName);
  if (!target) return groups || [];
  return (groups || []).filter(
    (group) =>
      !(group.tableNames || []).some(
        (name) => normalizeTableMapTableName(name) === target,
      ),
  );
}

/** Persist clearing merge groups that include any of the paid seats. */
export function clearPosTableMergeGroupsForTables(storeKey, tableNames) {
  const current = loadPosTableMergeGroups(storeKey);
  const next = removeGroupsOverlappingTables(current, tableNames);
  if (next.length === current.length) return current;
  savePosTableMergeGroups(storeKey, next);
  return next;
}

/** Stable stroke color from a held check identity (server-backed merges). */
export function getHeldMergeStrokeColor(heldEntry) {
  if (heldEntry?.allPaid) return null;
  const tables = Array.isArray(heldEntry?.tables) ? heldEntry.tables : [];
  if (tables.length < 2) return null;
  const key =
    String(heldEntry?.posCheckId || "").trim() ||
    tables
      .map((name) => normalizeTableMapTableName(name))
      .filter(Boolean)
      .sort()
      .join("|");
  if (!key) return null;

  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return MERGE_GROUP_COLORS[hash % MERGE_GROUP_COLORS.length];
}

export function heldEntryTableNames(heldEntry) {
  const fromTables = uniqueTableNames(heldEntry?.tables);
  if (fromTables.length) return fromTables;
  const single = normalizeMergeTableName(heldEntry?.table);
  return single ? [single] : [];
}
