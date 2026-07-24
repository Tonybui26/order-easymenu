"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Check, Plus } from "lucide-react";
import { useMenuContext } from "@/components/context/MenuContext";
import { cn } from "@/lib/helper";

function useAllMenuItems(menuContent) {
  return useMemo(() => {
    const map = new Map();
    (menuContent || []).forEach((section) => {
      (section.items || []).forEach((item) => {
        if (!item?.id || item?.isDraft) return;
        if (!map.has(item.id)) {
          map.set(item.id, item);
        }
      });
    });
    return map;
  }, [menuContent]);
}

function PosProductCard({ item, onAdd }) {
  return (
    <button
      type="button"
      onClick={() => onAdd?.(item)}
      className="relative flex w-[140px] shrink-0 flex-col overflow-hidden rounded-lg bg-white shadow-[0_0_0_1px_#1a1a1a0f] transition-transform active:scale-[0.98] sm:w-[160px]"
    >
      <span className="absolute left-2 top-2 z-10 flex size-8 items-center justify-center rounded-full bg-white text-neutral-600 shadow-sm ring-1 ring-black/5">
        <Plus size={18} strokeWidth={2.5} />
      </span>
      <div className="relative aspect-square w-full bg-neutral-100">
        {item.PhotoSrc ? (
          <Image
            src={item.PhotoSrc}
            alt={item.title || "Product"}
            fill
            sizes="160px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-neutral-400">
            No img
          </div>
        )}
      </div>
      <div className="px-2 py-2.5 text-center text-sm font-semibold leading-snug text-neutral-900">
        {item.title || "Untitled"}
      </div>
    </button>
  );
}

export default function PosTerminal() {
  const { menuContent, posLayouts } = useMenuContext();
  const itemsById = useAllMenuItems(menuContent);

  const activeLayout = posLayouts?.[0] || null;
  const tabs = activeLayout?.tabs || [];

  const [selectedTabId, setSelectedTabId] = useState(null);
  const [cartLines, setCartLines] = useState([]);

  useEffect(() => {
    if (tabs.length === 0) {
      setSelectedTabId(null);
      return;
    }
    const stillExists = tabs.some((tab) => tab.id === selectedTabId);
    if (!stillExists) {
      setSelectedTabId(tabs[0].id);
    }
  }, [tabs, selectedTabId]);

  const selectedTab = tabs.find((tab) => tab.id === selectedTabId) || null;
  const selectedRows = selectedTab?.rows || [];

  function handleAddItem(item) {
    setCartLines((prev) => [
      ...prev,
      {
        lineId: `${item.id}-${Date.now()}`,
        itemId: item.id,
        title: item.title || "Untitled",
        price: item.price ?? 0,
        quantity: 1,
      },
    ]);
  }

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#e8e8e8]">
      {/* Left: current order */}
      <section className="flex w-[34%] min-w-[280px] max-w-[440px] shrink-0 flex-col border-r border-neutral-300 bg-white">
        <header className="flex shrink-0 items-stretch border-b border-neutral-200 bg-[#ececec] p-2">
          <div className="flex min-h-[52px] w-full items-center justify-center rounded-md bg-white px-4 text-base font-semibold text-neutral-700 shadow-[0_0_0_1px_#d4d4d4]">
            TABLE: --
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white">
          {cartLines.length === 0 ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-neutral-400">
              Tap products to add them to this order
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {cartLines.map((line) => (
                <li
                  key={line.lineId}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-900">
                      {line.title}
                    </p>
                    <p className="text-xs text-neutral-500">
                      Qty {line.quantity}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-neutral-800">
                    ${Number(line.price || 0).toFixed(2)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Right: POS menu layout (tabs + products) */}
      <section className="flex min-w-0 flex-1">
        {/* Tabs column — z-30 + overhang so selected indicator sits on top of products */}
        <aside className="relative z-30 flex w-[120px] shrink-0 flex-col bg-[#e0e0e0] sm:w-[150px]">
          <div className="-mr-3 min-h-0 flex-1 overflow-y-auto pr-3">
            {tabs.length === 0 ? (
              <div className="p-3 text-center text-xs text-neutral-500">
                No POS tabs yet. Configure Menu layout in admin.
              </div>
            ) : (
              tabs.map((tab) => {
                const isSelected = tab.id === selectedTabId;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedTabId(tab.id)}
                    className={cn(
                      "relative flex min-h-[72px] w-full items-center justify-start px-3 py-4 text-left text-base font-bold text-neutral-900 transition-opacity",
                      isSelected ? "z-20" : "hover:opacity-90",
                    )}
                    style={{ backgroundColor: tab.backgroundColor || "#d9d9d9" }}
                  >
                    <span className="line-clamp-2 pr-5 leading-tight">
                      {tab.name}
                    </span>
                    {isSelected ? (
                      <span className="pointer-events-none absolute right-0 top-1/2 z-40 flex size-6 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full bg-red-500 text-white shadow-md ring-2 ring-white">
                        <Check size={14} strokeWidth={3} />
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Products for selected tab */}
        <div className="relative z-0 min-h-0 min-w-0 flex-1 overflow-y-auto bg-[#f0f0f0]">
          {!selectedTab ? (
            <div className="flex h-full items-center justify-center text-sm text-neutral-500">
              Select a tab
            </div>
          ) : selectedRows.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-neutral-500">
              This tab has no products yet
            </div>
          ) : (
            <div className="flex flex-col gap-4 p-4">
              {selectedRows.map((row) => {
                const rowItems = (row.itemIds || [])
                  .map((id) => itemsById.get(id))
                  .filter(Boolean);

                if (rowItems.length === 0) return null;

                return (
                  <div
                    key={row.id}
                    className="flex flex-wrap gap-3"
                  >
                    {rowItems.map((item) => (
                      <PosProductCard
                        key={`${row.id}-${item.id}`}
                        item={item}
                        onAdd={handleAddItem}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
