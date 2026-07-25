/**
 * POS helpers for item variants / modifiers selection and cart pricing.
 */

function clampNonNegInt(x, fallback) {
  const v = Math.floor(Number(x));
  if (!Number.isFinite(v) || v < 0) return fallback;
  return Math.min(999, v);
}

export function isOptionInStock(option) {
  return Boolean(option) && option.available !== false;
}

export function isVariantOptionInStock(optionId, groupKey, globalVariants) {
  const group = globalVariants?.[groupKey];
  // If the global library entry is missing, allow the item-attached option.
  if (!group?.options?.length) return true;
  const option = group.options.find((opt) => opt.id === optionId);
  if (!option) return true;
  return isOptionInStock(option);
}

export function modifierLimits(globalGroup, itemGroup) {
  if (globalGroup) {
    if (
      globalGroup.defaultMinSelection != null ||
      globalGroup.defaultMaxSelection !== undefined
    ) {
      const min = clampNonNegInt(globalGroup.defaultMinSelection, 0);
      const maxRaw = globalGroup.defaultMaxSelection;
      const max =
        maxRaw == null || maxRaw === "" ? null : clampNonNegInt(maxRaw, 0);
      return { minSelection: min, maxSelection: max };
    }
    const req = Boolean(globalGroup.isRequired);
    const multi = globalGroup.allowMultiple !== false;
    if (req && !multi) return { minSelection: 1, maxSelection: 1 };
    if (req && multi) return { minSelection: 1, maxSelection: null };
    if (!req && !multi) return { minSelection: 0, maxSelection: 1 };
    return { minSelection: 0, maxSelection: null };
  }

  if (!itemGroup) return { minSelection: 0, maxSelection: null };

  const hasNumeric =
    itemGroup.minSelection != null || itemGroup.maxSelection !== undefined;
  if (hasNumeric) {
    const min = clampNonNegInt(itemGroup.minSelection, 0);
    const maxRaw = itemGroup.maxSelection;
    const max =
      maxRaw == null || maxRaw === "" ? null : clampNonNegInt(maxRaw, 0);
    return { minSelection: min, maxSelection: max };
  }

  const req = Boolean(itemGroup.isRequired);
  const multi = itemGroup.allowMultiple !== false;
  if (req && !multi) return { minSelection: 1, maxSelection: 1 };
  if (req && multi) return { minSelection: 1, maxSelection: null };
  if (!req && !multi) return { minSelection: 0, maxSelection: 1 };
  return { minSelection: 0, maxSelection: null };
}

export function itemNeedsCustomization(item) {
  if (!item) return false;
  const hasVariantOptions =
    item.hasVariants &&
    (item.variants || []).some((group) => (group.options || []).length > 0);
  const hasModifierGroups = (item.modifierGroups || []).some(
    (group) => Boolean(group.useGlobal),
  );
  return hasVariantOptions || hasModifierGroups;
}

export function buildDefaultVariantSelections(item, globalVariants = {}) {
  const selected = {};
  if (!item?.hasVariants || !item.variants?.length) return selected;

  item.variants.forEach((variant) => {
    const inStock = (variant.options || []).filter((opt) =>
      isVariantOptionInStock(opt.id, variant.groupId, globalVariants),
    );
    if (inStock.length === 0) return;
    const cheapest = [...inStock].sort(
      (a, b) => Number(a.price || 0) - Number(b.price || 0),
    )[0];
    if (cheapest) selected[variant.groupId] = cheapest.id;
  });

  return selected;
}

export function buildDefaultModifierSelections(item, globalModifiers = {}) {
  const selected = {};
  if (!item?.modifierGroups?.length) return selected;

  item.modifierGroups.forEach((modifierGroup) => {
    const groupKey = modifierGroup.useGlobal;
    const globalGroup = globalModifiers[groupKey];
    const defaults = (modifierGroup.defaultSelections || []).filter(
      (optionId) => {
        const option = globalGroup?.options?.find((opt) => opt.id === optionId);
        return isOptionInStock(option);
      },
    );
    selected[groupKey] = defaults;
  });

  return selected;
}

export function getEnabledModifierOptions(modifierGroup, globalGroup) {
  if (!globalGroup?.options?.length) return [];
  const selectedIds =
    modifierGroup.selectedIds && modifierGroup.selectedIds.length > 0
      ? modifierGroup.selectedIds
      : globalGroup.options.map((o) => o.id);

  return selectedIds
    .map((id) => globalGroup.options.find((opt) => opt.id === id))
    .filter((opt) => isOptionInStock(opt));
}

export function computeConfiguredUnitPrice(
  item,
  selectedVariants = {},
  selectedModifiers = {},
  globalModifiers = {},
  globalVariants = {},
) {
  let total = 0;

  if (item?.hasVariants && item.variants?.length > 0) {
    item.variants.forEach((variant) => {
      const optionId = selectedVariants[variant.groupId];
      if (
        !optionId ||
        !isVariantOptionInStock(optionId, variant.groupId, globalVariants)
      ) {
        return;
      }
      const option = (variant.options || []).find((opt) => opt.id === optionId);
      if (option) total += Number(option.price || 0);
    });
  } else {
    total += Number(item?.price || 0);
  }

  (item?.modifierGroups || []).forEach((modifierGroup) => {
    const groupKey = modifierGroup.useGlobal;
    const globalGroup = globalModifiers[groupKey];
    const optionIds = selectedModifiers[groupKey] || [];
    optionIds.forEach((optionId) => {
      const option = globalGroup?.options?.find((opt) => opt.id === optionId);
      if (isOptionInStock(option)) {
        total += Number(option.priceModifier || 0);
      }
    });
  });

  return Math.round(total * 100) / 100;
}

export function buildSelectedVariantsPayload(item, selectedVariants = {}) {
  const payload = [];
  if (!item?.hasVariants || !item.variants?.length) return payload;

  item.variants.forEach((variant) => {
    const optionId = selectedVariants[variant.groupId];
    if (!optionId) return;
    const option = (variant.options || []).find((opt) => opt.id === optionId);
    if (!option) return;
    payload.push({
      groupName: variant.groupName,
      groupId: variant.groupId,
      optionId,
      optionName: option.name,
      price: Number(option.price || 0),
    });
  });

  return payload;
}

export function buildSelectedModifiersPayload(
  item,
  selectedModifiers = {},
  globalModifiers = {},
) {
  const payload = [];
  (item?.modifierGroups || []).forEach((modifierGroup) => {
    const groupKey = modifierGroup.useGlobal;
    const globalGroup = globalModifiers[groupKey];
    const optionIds = selectedModifiers[groupKey] || [];
    optionIds.forEach((optionId) => {
      const option = globalGroup?.options?.find((opt) => opt.id === optionId);
      if (!isOptionInStock(option)) return;
      payload.push({
        groupName: modifierGroup.groupName || globalGroup?.groupName,
        groupKey,
        optionId,
        optionName: option.name,
        priceModifier: Number(option.priceModifier || 0),
      });
    });
  });
  return payload;
}

export function validateCustomization(
  item,
  selectedVariants = {},
  selectedModifiers = {},
  globalModifiers = {},
  globalVariants = {},
) {
  if (item?.hasVariants && item.variants?.length > 0) {
    for (const variant of item.variants) {
      if (!(variant.options || []).length) continue;
      const optionId = selectedVariants[variant.groupId];
      if (!optionId) {
        return `Select an option for ${variant.groupName || "variant"}.`;
      }
      if (!isVariantOptionInStock(optionId, variant.groupId, globalVariants)) {
        return `Choose an in-stock option for ${variant.groupName || "variant"}.`;
      }
    }
  }

  for (const modifierGroup of item?.modifierGroups || []) {
    if (!modifierGroup.useGlobal) continue;
    const globalGroup = globalModifiers[modifierGroup.useGlobal];
    const enabled = getEnabledModifierOptions(modifierGroup, globalGroup);
    if (enabled.length === 0) continue;

    const { minSelection, maxSelection } = modifierLimits(
      globalGroup,
      modifierGroup,
    );
    const count = (selectedModifiers[modifierGroup.useGlobal] || []).filter(
      (optionId) => {
        const option = globalGroup?.options?.find((opt) => opt.id === optionId);
        return isOptionInStock(option);
      },
    ).length;

    if (minSelection > 0 && count < minSelection) {
      return `Choose at least ${minSelection} for ${modifierGroup.groupName || globalGroup?.groupName}.`;
    }
    if (maxSelection && maxSelection > 0 && count > maxSelection) {
      return `Choose up to ${maxSelection} for ${modifierGroup.groupName || globalGroup?.groupName}.`;
    }
  }

  return null;
}

export function computeLineBasePrice(selectedVariants = [], itemBasePrice = 0) {
  if (selectedVariants.length > 0) {
    return (
      Math.round(
        selectedVariants.reduce(
          (sum, variant) => sum + Number(variant.price || 0),
          0,
        ) * 100,
      ) / 100
    );
  }
  return Math.round(Number(itemBasePrice || 0) * 100) / 100;
}

export function computeLineUnitPrice(basePrice, selectedModifiers = []) {
  const modifiersTotal = selectedModifiers.reduce(
    (sum, modifier) => sum + Number(modifier.priceModifier || 0),
    0,
  );
  return Math.round((Number(basePrice || 0) + modifiersTotal) * 100) / 100;
}

export function selectionMapsFromLine(line, item = null) {
  const selectedVariants = {};
  (line?.selectedVariants || []).forEach((variant) => {
    if (!variant?.optionId) return;

    let groupId = variant.groupId;
    if (!groupId && item?.variants?.length) {
      const matchedGroup = item.variants.find(
        (group) =>
          group.groupId === variant.groupId ||
          group.groupName === variant.groupName ||
          (group.options || []).some((opt) => opt.id === variant.optionId),
      );
      groupId = matchedGroup?.groupId;
    }

    if (groupId) selectedVariants[groupId] = variant.optionId;
  });

  const selectedModifiers = {};
  (line?.selectedModifiers || []).forEach((modifier) => {
    if (!modifier?.optionId) return;

    let groupKey = modifier.groupKey;
    if (!groupKey && item?.modifierGroups?.length) {
      const matchedGroup = item.modifierGroups.find(
        (group) =>
          group.useGlobal === modifier.groupKey ||
          group.groupName === modifier.groupName ||
          (group.selectedIds || []).includes(modifier.optionId),
      );
      groupKey = matchedGroup?.useGlobal;
    }

    if (!groupKey) return;
    if (!selectedModifiers[groupKey]) selectedModifiers[groupKey] = [];
    if (!selectedModifiers[groupKey].includes(modifier.optionId)) {
      selectedModifiers[groupKey].push(modifier.optionId);
    }
  });

  return { selectedVariants, selectedModifiers };
}

export function cartConfigKey(selectedVariants = [], selectedModifiers = []) {
  const variants = [...selectedVariants]
    .map((v) => `${v.groupName}:${v.optionId}`)
    .sort()
    .join("|");
  const modifiers = [...selectedModifiers]
    .map((m) => `${m.groupName}:${m.optionId}`)
    .sort()
    .join("|");
  return `${variants}::${modifiers}`;
}

export function formatSelectionSummary(
  selectedVariants = [],
  selectedModifiers = [],
) {
  const names = [
    ...selectedVariants.map((v) => v.optionName),
    ...selectedModifiers.map((m) => m.optionName),
  ].filter(Boolean);
  return names.join(", ");
}
