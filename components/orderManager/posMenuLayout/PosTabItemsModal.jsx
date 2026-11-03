"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Check, Plus, Search } from "lucide-react";
import SideDrawer from "@/components/orderManager/SideDrawer";

export default function PosTabItemsModal({
  isOpen,
  onClose,
  tab,
  allItems,
  tabItemIds,
  onAddItems,
  onCreateProduct,
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(() => new Set());

  const alreadyOnTab = useMemo(() => new Set(tabItemIds || []), [tabItemIds]);

  useEffect(() => {
    if (!isOpen) return;
    setSelected(new Set());
    setSearch("");
  }, [isOpen, tab?.id]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (allItems || [])
      .filter((item) => {
        if (!q) return true;
        const title = (item.title || "").toLowerCase();
        const desc = (item.description || "").toLowerCase();
        const sections = (item.__sectionTitles || []).join(" ").toLowerCase();
        return title.includes(q) || desc.includes(q) || sections.includes(q);
      })
      .sort((a, b) => {
        const aOnTab = alreadyOnTab.has(a.id) ? 1 : 0;
        const bOnTab = alreadyOnTab.has(b.id) ? 1 : 0;
        return aOnTab - bOnTab;
      });
  }, [allItems, search, alreadyOnTab]);

  function toggleItem(itemId) {
    if (alreadyOnTab.has(itemId)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  const selectionCount = selected.size;
  const hasMenuItems = (allItems || []).length > 0;
  const hasAddableItems = (allItems || []).some((item) => !alreadyOnTab.has(item.id));
  const hasNoItemsLeftToAdd = hasMenuItems && !hasAddableItems;

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={tab ? `Add products to "${tab.name}"` : "Add products"}
      widthClassName="w-[min(100%,40rem)]"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" className="btn btn-ghost" onClick={onCreateProduct}>
            <Plus className="size-4" />
            New product
          </button>
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={selectionCount === 0}
              onClick={() => onAddItems?.(Array.from(selected))}
            >
              Add {selectionCount > 0 ? `(${selectionCount})` : ""}
            </button>
          </div>
        </div>
      }
    >
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search products by name, description, or category"
            className="input input-bordered w-full pl-9"
          />
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-lg border border-neutral-200">
          {hasNoItemsLeftToAdd ? (
            <p className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Every menu product is already on this tab.
            </p>
          ) : null}
          {filteredItems.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-neutral-500">
              {hasMenuItems
                ? "No products match your search."
                : "No products yet. Create one to add it to this tab."}
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {filteredItems.map((item) => {
                const isDisabled = alreadyOnTab.has(item.id);
                const isSelected = !isDisabled && selected.has(item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => toggleItem(item.id)}
                      disabled={isDisabled}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left ${
                        isDisabled
                          ? "cursor-not-allowed bg-neutral-50 opacity-70"
                          : isSelected
                            ? "bg-brand_accent/10"
                            : "hover:bg-neutral-50"
                      }`}
                    >
                      <span
                        className={`flex size-5 shrink-0 items-center justify-center rounded-md border ${
                          isSelected
                            ? "border-brand_accent bg-brand_accent text-white"
                            : "border-neutral-300 bg-white text-transparent"
                        }`}
                        aria-hidden
                      >
                        <Check className="size-3.5" strokeWidth={3} />
                      </span>
                      <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-neutral-100">
                        {item.PhotoSrc ? (
                          <Image
                            src={item.PhotoSrc}
                            alt={item.title || "Product"}
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-neutral-400">
                            No img
                          </div>
                        )}
                      </div>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-neutral-800">
                          {item.title || "Untitled product"}
                        </span>
                        <span className="block truncate text-xs text-neutral-500">
                          {item.__sectionTitles?.join(", ") || "No category"}
                        </span>
                        {item.posOnly === true ? (
                          <span className="block text-xs font-medium text-amber-800">
                            POS only
                          </span>
                        ) : null}
                        {isDisabled ? (
                          <span className="block text-xs text-amber-700">
                            Already on this tab
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
    </SideDrawer>
  );
}
