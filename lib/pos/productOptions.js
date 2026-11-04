function libraryEntries(library) {
  if (!library) return [];
  if (library instanceof Map) return Array.from(library.entries());
  return Object.entries(library);
}

function modifierSubtitle(group) {
  if (!group) return "";
  if (group.allowMultiple === false) return "Select 1";
  if (group.isRequired) return "Required";
  return "Select multiple";
}

export function variantGroupsFromLibrary(globalVariants) {
  return libraryEntries(globalVariants)
    .map(([id, group]) => ({
      id,
      name: group?.groupName?.trim() || "Untitled variant",
      options: (group?.options || [])
        .filter((option) => option?.id)
        .map((option) => ({
          id: option.id,
          name: option.name?.trim() || "Untitled option",
        })),
    }))
    .filter((group) => group.options.length > 0);
}

export function modifierSetsFromLibrary(globalModifiers) {
  return libraryEntries(globalModifiers)
    .map(([id, group]) => ({
      id,
      name: group?.groupName?.trim() || "Untitled modifier set",
      subtitle: modifierSubtitle(group),
      options: (group?.options || [])
        .filter((option) => option?.id)
        .map((option) => ({
          id: option.id,
          name: option.name?.trim() || "Untitled option",
          priceModifier: Number(option.priceModifier) || 0,
        })),
    }))
    .filter((group) => group.options.length > 0);
}

export function variantPricesFromProduct(product) {
  const prices = {};
  if (product?.hasVariants !== true) return prices;
  for (const group of product.variants || []) {
    if (!group?.groupId) continue;
    const options = {};
    for (const option of group.options || []) {
      if (!option?.id || option.price == null || option.price === "") continue;
      options[option.id] = String(option.price);
    }
    if (Object.keys(options).length > 0) prices[group.groupId] = options;
  }
  return prices;
}

export function modifierSelectionFromProduct(product, modifierSets) {
  const byId = new Map((modifierSets || []).map((set) => [set.id, set]));
  const selection = {};
  for (const group of product?.modifierGroups || []) {
    const set = byId.get(group?.useGlobal);
    if (!set) continue;
    const valid = new Set(set.options.map((option) => option.id));
    const selected = (group.selectedIds || []).filter((id) => valid.has(id));
    selection[group.useGlobal] =
      selected.length > 0 ? selected : set.options.map((option) => option.id);
  }
  return selection;
}

export function variantPayload(variantPrices) {
  return Object.entries(variantPrices || {})
    .map(([groupId, options]) => ({
      groupId,
      options: Object.entries(options || {})
        .filter(([, price]) => price !== "")
        .map(([id, price]) => ({ id, price })),
    }))
    .filter((group) => group.options.length > 0);
}

export function modifierPayload(modifierSelection) {
  return Object.entries(modifierSelection || {}).map(([useGlobal, selectedIds]) => ({
    useGlobal,
    selectedIds,
  }));
}

export function hasPricedVariantOption(variantPrices) {
  return Object.values(variantPrices || {}).some((options) =>
    Object.values(options || {}).some((price) => {
      if (price === "" || price == null) return false;
      const amount = parseFloat(price);
      return Number.isFinite(amount) && amount >= 0;
    }),
  );
}

export function formatOptionPrice(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "$0.00";
  return `$${value.toFixed(2)}`;
}
