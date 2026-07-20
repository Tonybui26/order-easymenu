const DEFAULT_VARIANT_GROUP_NAME = "Select From";

function buildOptionRow({ sourceType, groupKey, groupName, option }) {
  if (!option?.id) return null;
  const optionName = (option.name || "").trim() || "Untitled option";
  return {
    id: `${sourceType}-${groupKey}-${option.id}`,
    sourceType,
    groupKey,
    groupName,
    typeLabel: sourceType === "variant" ? "Variant" : "Modifier",
    optionId: option.id,
    optionName,
    available: option.available !== false,
  };
}

export function flattenModifierAvailabilityRows(globalVariants, globalModifiers) {
  const rows = [];

  Object.entries(globalModifiers || {}).forEach(([groupKey, group]) => {
    const groupName = group?.groupName?.trim() || "Untitled modifier set";
    (group?.options || []).forEach((option) => {
      const row = buildOptionRow({
        sourceType: "modifier",
        groupKey,
        groupName,
        option,
      });
      if (row) rows.push(row);
    });
  });

  Object.entries(globalVariants || {}).forEach(([groupKey, group]) => {
    const groupName =
      group?.groupName?.trim() || DEFAULT_VARIANT_GROUP_NAME;
    (group?.options || []).forEach((option) => {
      const row = buildOptionRow({
        sourceType: "variant",
        groupKey,
        groupName,
        option,
      });
      if (row) rows.push(row);
    });
  });

  return rows;
}

export function filterModifierAvailabilityRows(rows, searchQuery = "") {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return rows || [];

  return (rows || []).filter((row) => {
    const haystack = [row.optionName, row.groupName, row.typeLabel]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function modifierRowMatchesQuery(row, q) {
  const needle = q.trim().toLowerCase();
  if (!needle) return false;
  const haystack = [row.optionName, row.groupName, row.typeLabel]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}
