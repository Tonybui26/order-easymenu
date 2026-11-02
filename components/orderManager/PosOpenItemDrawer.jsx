"use client";

import { useEffect, useState } from "react";
import SideDrawer from "./SideDrawer";

/**
 * POS drawer for an open-item tab. Staff enter a custom name and unit price.
 */
export default function PosOpenItemDrawer({
  isOpen,
  onClose,
  onAdd,
  tabName = "",
  tabId = "",
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setName("");
    setPrice("");
  }, [isOpen, tabId]);

  const trimmedName = name.trim();
  const priceNumber = Number(price);
  const canAdd =
    trimmedName.length > 0 &&
    price.trim() !== "" &&
    Number.isFinite(priceNumber) &&
    priceNumber >= 0;

  function handleAdd() {
    if (!canAdd) return;
    onAdd?.({
      name: trimmedName,
      price: Math.round(priceNumber * 100) / 100,
    });
    onClose?.();
  }

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={tabName || "Open item"}
      subtitle="Enter the item name and price"
      side="left"
      widthClassName="w-[min(100%,28rem)]"
      contentKey="pos-open-item"
      bodyClassName="p-4"
      ariaLabel="Add open item"
      footer={
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          className="flex min-h-[48px] w-full items-center justify-center rounded-lg bg-[#984B28] text-sm font-semibold text-white transition-colors hover:bg-[#7f3f22] active:bg-[#6e361d] disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          Add to order
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-neutral-800">Item name</span>
          <input
            id="pos-open-item-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Staff meal"
            className="min-h-[48px] rounded-lg border border-neutral-300 bg-white px-4 text-base text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-500"
            autoComplete="off"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-neutral-800">Unit price</span>
          <input
            id="pos-open-item-price"
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="0.00"
            className="min-h-[48px] rounded-lg border border-neutral-300 bg-white px-4 text-base text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-500"
            autoComplete="off"
          />
        </label>
      </div>
    </SideDrawer>
  );
}
