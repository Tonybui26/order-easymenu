"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useMenuContext } from "@/components/context/MenuContext";
import SideDrawer from "@/components/orderManager/SideDrawer";
import { foodGroupOptions } from "@/lib/pos/foodGroups";
import {
  formatOptionPrice,
  hasPricedVariantOption,
  modifierPayload,
  modifierSelectionFromProduct,
  modifierSetsFromLibrary,
  variantGroupsFromLibrary,
  variantPayload,
  variantPricesFromProduct,
} from "@/lib/pos/productOptions";

function sectionLabel(section) {
  return section?.sectionTitle?.trim() || "Untitled category";
}

function isDecimalDraft(value) {
  return value === "" || /^\d*\.?\d*$/.test(value);
}

export default function PosCreateProductModal({
  isOpen,
  sections,
  product = null,
  onClose,
  onCreate,
  onSave,
}) {
  const { itemGroups, globalVariants, globalModifiers } = useMenuContext();
  const groupOptions = useMemo(
    () => foodGroupOptions(itemGroups),
    [itemGroups],
  );
  const variantGroups = useMemo(
    () => variantGroupsFromLibrary(globalVariants),
    [globalVariants],
  );
  const modifierSets = useMemo(
    () => modifierSetsFromLibrary(globalModifiers),
    [globalModifiers],
  );
  const isEditMode = Boolean(product?.id);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [pricingMode, setPricingMode] = useState("single");
  const [variantPrices, setVariantPrices] = useState({});
  const [modifierSelection, setModifierSelection] = useState({});
  const [categoryId, setCategoryId] = useState("");
  const [newCategoryTitle, setNewCategoryTitle] = useState("");
  const [itemGroupId, setItemGroupId] = useState("food");
  const [posOnly, setPosOnly] = useState(true);
  const [available, setAvailable] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const hasCategories = (sections || []).length > 0;
  const usesVariablePrice = pricingMode === "variable";

  useEffect(() => {
    if (!isOpen) return;
    setName(product?.title || "");
    setDescription(product?.description || "");
    setPrice(
      product?.price == null || product?.price === "" ? "" : String(product.price),
    );
    setPricingMode(product?.hasVariants === true ? "variable" : "single");
    setVariantPrices(variantPricesFromProduct(product));
    setModifierSelection(modifierSelectionFromProduct(product, modifierSets));
    setCategoryId(product?.categoryId || "");
    setNewCategoryTitle("");
    setItemGroupId(product?.itemGroupId || groupOptions[0]?.id || "food");
    setPosOnly(isEditMode ? product?.posOnly === true : true);
    setAvailable(isEditMode ? product?.available !== false : true);
    setIsSaving(false);
  }, [isOpen, product, isEditMode, groupOptions, modifierSets]);

  const trimmedName = name.trim();
  const canSubmit =
    trimmedName.length > 0 &&
    Boolean(itemGroupId) &&
    (hasCategories ? Boolean(categoryId) : !isEditMode && newCategoryTitle.trim().length > 0) &&
    (!usesVariablePrice || hasPricedVariantOption(variantPrices));

  function toggleVariantOption(groupId, optionId) {
    setVariantPrices((current) => {
      const group = { ...(current[groupId] || {}) };
      if (Object.prototype.hasOwnProperty.call(group, optionId)) {
        delete group[optionId];
      } else {
        group[optionId] = price.trim() === "" ? "" : price.trim();
      }
      const next = { ...current };
      if (Object.keys(group).length === 0) delete next[groupId];
      else next[groupId] = group;
      return next;
    });
  }

  function setVariantOptionPrice(groupId, optionId, value) {
    if (!isDecimalDraft(value)) return;
    setVariantPrices((current) => ({
      ...current,
      [groupId]: { ...(current[groupId] || {}), [optionId]: value },
    }));
  }

  function toggleModifierSet(set) {
    setModifierSelection((current) => {
      if (current[set.id]) {
        const next = { ...current };
        delete next[set.id];
        return next;
      }
      return {
        ...current,
        [set.id]: set.options.map((option) => option.id),
      };
    });
  }

  function toggleModifierOption(setId, optionId) {
    setModifierSelection((current) => {
      const selected = current[setId] || [];
      if (!selected.includes(optionId)) {
        return { ...current, [setId]: [...selected, optionId] };
      }
      if (selected.length === 1) {
        const next = { ...current };
        delete next[setId];
        return next;
      }
      return {
        ...current,
        [setId]: selected.filter((id) => id !== optionId),
      };
    });
  }

  async function handleSubmit() {
    if (!canSubmit || isSaving) return;
    setIsSaving(true);
    const payload = {
      title: trimmedName,
      description: description.trim(),
      pricingMode,
      price: usesVariablePrice || price.trim() === "" ? null : price.trim(),
      variants: usesVariablePrice ? variantPayload(variantPrices) : [],
      modifierGroups: modifierPayload(modifierSelection),
      categoryId: hasCategories ? categoryId : "",
      newCategoryTitle: hasCategories || isEditMode ? "" : newCategoryTitle.trim(),
      itemGroupId,
      posOnly,
      available,
    };
    try {
      if (isEditMode) {
        await onSave?.({ ...payload, itemId: product.id });
      } else {
        await onCreate?.(payload);
      }
      onClose?.();
    } catch (error) {
      toast.error(
        error?.message ||
          (isEditMode ? "Could not save the product" : "Could not create the product"),
      );
      setIsSaving(false);
    }
  }

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? "Edit product" : "New product"}
      closeDisabled={isSaving}
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canSubmit || isSaving}
            onClick={handleSubmit}
          >
            {isSaving ? "Saving..." : isEditMode ? "Save product" : "Create product"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={isSaving}
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block text-sm font-medium text-neutral-800" htmlFor="pos-product-name">
          Name
          <input
            id="pos-product-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Enter item title"
            className="input input-bordered mt-1.5 w-full"
          />
        </label>

        <label className="block text-sm font-medium text-neutral-800" htmlFor="pos-product-description">
          Description
          <textarea
            id="pos-product-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Description"
            className="textarea textarea-bordered mt-1.5 h-24 w-full"
          />
        </label>

        <label className="block text-sm font-medium text-neutral-800" htmlFor="pos-product-category">
          Category
          {hasCategories ? (
            <select
              id="pos-product-category"
              className="select select-bordered mt-1.5 w-full"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">Choose a category</option>
              {(sections || []).map((section) => (
                <option key={section.id} value={section.id}>
                  {sectionLabel(section)}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="pos-product-category"
              value={newCategoryTitle}
              onChange={(event) => setNewCategoryTitle(event.target.value)}
              placeholder="Category name"
              className="input input-bordered mt-1.5 w-full"
            />
          )}
        </label>

        <label className="block text-sm font-medium text-neutral-800" htmlFor="pos-product-food-group">
          Food group
          <select
            id="pos-product-food-group"
            className="select select-bordered mt-1.5 w-full"
            value={itemGroupId}
            onChange={(event) => setItemGroupId(event.target.value)}
          >
            {groupOptions.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          <span className="mt-1.5 block text-sm font-normal text-neutral-500">
            Kitchen printers for this group receive the product.
          </span>
        </label>

        <div>
          <label className="block text-sm font-medium text-neutral-800" htmlFor="pos-product-pricing">
            Price
          </label>
          <select
            id="pos-product-pricing"
            className="select select-bordered mt-1.5 w-full"
            value={pricingMode}
            onChange={(event) => setPricingMode(event.target.value)}
          >
            <option value="single">Single price</option>
            <option value="variable">Variable price</option>
          </select>
          {usesVariablePrice ? (
            <div className="mt-3 space-y-3">
              {variantGroups.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  No variant groups yet. Create them in the back office, then assign them here.
                </p>
              ) : (
                variantGroups.map((group) => (
                  <div
                    key={group.id}
                    className="overflow-hidden rounded-lg border border-neutral-200"
                  >
                    <p className="border-b border-neutral-100 px-3 py-2 text-sm font-semibold text-neutral-800">
                      {group.name}
                    </p>
                    <div className="divide-y divide-neutral-100">
                      {group.options.map((option) => {
                        const optionPrice = variantPrices[group.id]?.[option.id];
                        const isSelected = optionPrice !== undefined;
                        return (
                          <div key={option.id} className="flex items-center gap-3 px-3 py-2.5">
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm"
                              checked={isSelected}
                              onChange={() => toggleVariantOption(group.id, option.id)}
                              aria-label={`Offer ${option.name}`}
                            />
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-800">
                              {option.name}
                            </span>
                            <div className="input input-bordered input-sm flex w-24 shrink-0 items-center gap-1 px-2">
                              <span className="text-neutral-500">$</span>
                              <input
                                value={isSelected ? optionPrice : ""}
                                inputMode="decimal"
                                disabled={!isSelected}
                                onChange={(event) =>
                                  setVariantOptionPrice(group.id, option.id, event.target.value)
                                }
                                placeholder="0.00"
                                aria-label={`Price for ${option.name}`}
                                className="w-full bg-transparent outline-none disabled:text-neutral-300"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
              <p className="text-sm text-neutral-500">
                Set a price for each option you want on this product. Options without a price are left off.
              </p>
            </div>
          ) : (
            <div className="input input-bordered mt-1.5 flex items-center gap-2">
              <span className="text-neutral-500">$</span>
              <input
                id="pos-product-price"
                value={price}
                inputMode="decimal"
                onChange={(event) => {
                  if (isDecimalDraft(event.target.value)) setPrice(event.target.value);
                }}
                placeholder="0.00"
                className="w-full bg-transparent outline-none"
              />
            </div>
          )}
        </div>

        <div>
          <p className="text-sm font-medium text-neutral-800">Modifiers</p>
          <p className="mt-1 text-sm text-neutral-500">
            Assign sets created in the back office. Option prices stay with the set.
          </p>
          {modifierSets.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">
              No modifier sets yet. Create them in the back office, then assign them here.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {modifierSets.map((set) => {
                const selectedIds = modifierSelection[set.id] || [];
                const isAssigned = selectedIds.length > 0;
                return (
                  <div
                    key={set.id}
                    className="overflow-hidden rounded-lg border border-neutral-200"
                  >
                    <label className="flex items-center gap-3 px-3 py-2.5">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={isAssigned}
                        onChange={() => toggleModifierSet(set)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-neutral-800">
                          {set.name}
                        </span>
                        <span className="block truncate text-xs text-neutral-500">
                          {set.subtitle}
                        </span>
                      </span>
                    </label>
                    {isAssigned ? (
                      <div className="divide-y divide-neutral-100 border-t border-neutral-100">
                        {set.options.map((option) => (
                          <label
                            key={option.id}
                            className="flex items-center gap-3 px-3 py-2.5"
                          >
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm"
                              checked={selectedIds.includes(option.id)}
                              onChange={() => toggleModifierOption(set.id, option.id)}
                            />
                            <span className="min-w-0 flex-1 truncate text-sm text-neutral-800">
                              {option.name}
                            </span>
                            <span className="shrink-0 text-sm tabular-nums text-neutral-600">
                              {formatOptionPrice(option.priceModifier)}
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <label className="flex items-center justify-between gap-3 rounded-lg bg-neutral-50 px-3 py-3">
          <span>
            <span className="block text-sm font-medium text-neutral-900">
              Visible in menu
            </span>
            <span className="mt-0.5 block text-sm text-neutral-500">
              {posOnly
                ? "POS only keeps this product off the online store."
                : available
                  ? "Customers can see this product on the online store."
                  : "Hidden from the online store menu."}
            </span>
          </span>
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={available}
            onChange={(event) => setAvailable(event.target.checked)}
          />
        </label>

        <label className="flex items-center justify-between gap-3 rounded-lg bg-neutral-50 px-3 py-3">
          <span>
            <span className="block text-sm font-medium text-neutral-900">
              POS only
            </span>
            <span className="mt-0.5 block text-sm text-neutral-500">
              Only available on the POS. Hidden from the online store menu.
            </span>
          </span>
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={posOnly}
            onChange={(event) => setPosOnly(event.target.checked)}
          />
        </label>
      </div>
    </SideDrawer>
  );
}
