"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import SideDrawer from "@/components/orderManager/SideDrawer";

function sectionLabel(section) {
  return section?.sectionTitle?.trim() || "Untitled category";
}

export default function PosCreateProductModal({
  isOpen,
  sections,
  onClose,
  onCreate,
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [newCategoryTitle, setNewCategoryTitle] = useState("");
  const [posOnly, setPosOnly] = useState(true);
  const [available, setAvailable] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const hasCategories = (sections || []).length > 0;

  useEffect(() => {
    if (!isOpen) return;
    setName("");
    setDescription("");
    setPrice("");
    setCategoryId("");
    setNewCategoryTitle("");
    setPosOnly(true);
    setAvailable(true);
    setIsSaving(false);
  }, [isOpen]);

  const trimmedName = name.trim();
  const canSubmit =
    trimmedName.length > 0 &&
    (hasCategories ? Boolean(categoryId) : newCategoryTitle.trim().length > 0);

  async function handleSubmit() {
    if (!canSubmit || isSaving) return;
    setIsSaving(true);
    try {
      await onCreate?.({
        title: trimmedName,
        description: description.trim(),
        price: price.trim() === "" ? null : price.trim(),
        categoryId: hasCategories ? categoryId : "",
        newCategoryTitle: hasCategories ? "" : newCategoryTitle.trim(),
        posOnly,
        available,
      });
      onClose?.();
    } catch (error) {
      toast.error(error?.message || "Could not create the product");
      setIsSaving(false);
    }
  }

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="New product"
      closeDisabled={isSaving}
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canSubmit || isSaving}
            onClick={handleSubmit}
          >
            {isSaving ? "Creating..." : "Create product"}
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

          <div>
            <label className="block text-sm font-medium text-neutral-800" htmlFor="pos-product-price">
              Price
            </label>
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
