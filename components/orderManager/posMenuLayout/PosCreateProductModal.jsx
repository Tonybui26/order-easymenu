"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useMenuContext } from "@/components/context/MenuContext";
import SideDrawer from "@/components/orderManager/SideDrawer";
import { foodGroupOptions } from "@/lib/pos/foodGroups";

function sectionLabel(section) {
  return section?.sectionTitle?.trim() || "Untitled category";
}

export default function PosCreateProductModal({
  isOpen,
  sections,
  product = null,
  onClose,
  onCreate,
  onSave,
}) {
  const { itemGroups } = useMenuContext();
  const groupOptions = useMemo(
    () => foodGroupOptions(itemGroups),
    [itemGroups],
  );
  const isEditMode = Boolean(product?.id);
  const hasVariants = product?.hasVariants === true;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [newCategoryTitle, setNewCategoryTitle] = useState("");
  const [itemGroupId, setItemGroupId] = useState("food");
  const [posOnly, setPosOnly] = useState(true);
  const [available, setAvailable] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const hasCategories = (sections || []).length > 0;

  useEffect(() => {
    if (!isOpen) return;
    setName(product?.title || "");
    setDescription(product?.description || "");
    setPrice(
      product?.price == null || product?.price === "" ? "" : String(product.price),
    );
    setCategoryId(product?.categoryId || "");
    setNewCategoryTitle("");
    setItemGroupId(product?.itemGroupId || groupOptions[0]?.id || "food");
    setPosOnly(isEditMode ? product?.posOnly === true : true);
    setAvailable(isEditMode ? product?.available !== false : true);
    setIsSaving(false);
  }, [isOpen, product, isEditMode, groupOptions]);

  const trimmedName = name.trim();
  const canSubmit =
    trimmedName.length > 0 &&
    Boolean(itemGroupId) &&
    (hasCategories ? Boolean(categoryId) : !isEditMode && newCategoryTitle.trim().length > 0);

  async function handleSubmit() {
    if (!canSubmit || isSaving) return;
    setIsSaving(true);
    const payload = {
      title: trimmedName,
      description: description.trim(),
      price: hasVariants || price.trim() === "" ? null : price.trim(),
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
            <label className="block text-sm font-medium text-neutral-800" htmlFor="pos-product-price">
              Price
            </label>
            {hasVariants ? (
              <p className="mt-1.5 text-sm text-neutral-500">
                This product uses variant prices. Change those in the back office.
              </p>
            ) : (
            <div className="input input-bordered mt-1.5 flex items-center gap-2">
              <span className="text-neutral-500">$</span>
              <input
                id="pos-product-price"
                value={price}
                inputMode="decimal"
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "" || /^\d*\.?\d*$/.test(value)) setPrice(value);
                }}
                placeholder="0.00"
                className="w-full bg-transparent outline-none"
              />
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
