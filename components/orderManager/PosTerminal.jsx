"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Check,
  DollarSign,
  Headset,
  PanelBottomOpen,
  Plus,
  Printer,
  QrCode,
  X,
} from "lucide-react";
import { useMenuContext } from "@/components/context/MenuContext";
import { cn } from "@/lib/helper";
import PosTableEntryDrawer from "./PosTableEntryDrawer";
import PosOrderPanelFooter from "./PosOrderPanelFooter";
import Logo from "../../public/images/goeasymenu-logo-icon-white.svg";

const POS_HEADER_ACTIONS = [
  { id: "support", label: "Support", Icon: Headset },
  { id: "qr", label: "QR", Icon: QrCode },
  { id: "print", label: "Printer", Icon: Printer },
];

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
      className="relative flex w-full flex-col overflow-hidden rounded-lg bg-white shadow-[0_0_0_1px_#1a1a1a0f] transition-transform active:scale-[0.98]"
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
            sizes="20vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-neutral-400">
            No img
          </div>
        )}
      </div>
      <div className="px-2 py-2.5 text-center text-lg font-semibold leading-snug text-neutral-900">
        {item.title || "Untitled"}
      </div>
    </button>
  );
}

export default function PosTerminal() {
  const router = useRouter();
  const { menuContent, posLayouts } = useMenuContext();
  const itemsById = useAllMenuItems(menuContent);

  const activeLayout = posLayouts?.[0] || null;
  const tabs = activeLayout?.tabs || [];

  const [selectedTabId, setSelectedTabId] = useState(null);
  const [cartLines, setCartLines] = useState([]);
  const [keypadDrawer, setKeypadDrawer] = useState(null);
  const [tableNumber, setTableNumber] = useState("");
  const [orderType, setOrderType] = useState(null);

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

  const tableLabel = (() => {
    if (!tableNumber && !orderType) return "TABLE: --";
    if (orderType === "dine-in") return `TABLE: ${tableNumber || "--"}`;
    if (orderType === "buzzer") return `BUZZER: ${tableNumber || "--"}`;
    if (orderType === "takeaway")
      return `TAKEAWAY${tableNumber ? `: ${tableNumber}` : ""}`;
    if (orderType === "delivery")
      return `DELIVERY${tableNumber ? `: ${tableNumber}` : ""}`;
    return `TABLE: ${tableNumber || "--"}`;
  })();

  function handleAddItem(item) {
    setCartLines((prev) => {
      const existingIndex = prev.findIndex((line) => line.itemId === item.id);
      if (existingIndex >= 0) {
        return prev.map((line, index) =>
          index === existingIndex
            ? { ...line, quantity: (line.quantity || 1) + 1 }
            : line,
        );
      }
      return [
        ...prev,
        {
          lineId: `${item.id}-${Date.now()}`,
          itemId: item.id,
          title: item.title || "Untitled",
          price: item.price ?? 0,
          quantity: 1,
        },
      ];
    });
  }

  function handleQtyClick(lineId) {
    const line = cartLines.find((entry) => entry.lineId === lineId);
    setKeypadDrawer({
      mode: "quantity",
      lineId,
      initialNumber: String(line?.quantity || 1),
    });
  }

  function handleRemoveLine(lineId) {
    setCartLines((prev) => prev.filter((line) => line.lineId !== lineId));
  }

  function handleTableConfirm({ number, orderType: nextOrderType }) {
    setTableNumber(number || "");
    setOrderType(nextOrderType || null);
  }

  function handleQuantityConfirm({ quantity }) {
    const lineId = keypadDrawer?.lineId;
    if (!lineId) return;

    if (!quantity || quantity <= 0) {
      setCartLines((prev) => prev.filter((line) => line.lineId !== lineId));
      return;
    }

    setCartLines((prev) =>
      prev.map((line) =>
        line.lineId === lineId ? { ...line, quantity } : line,
      ),
    );
  }

  function handleKeypadConfirm(payload) {
    if (keypadDrawer?.mode === "quantity") {
      handleQuantityConfirm(payload);
      return;
    }
    handleTableConfirm(payload);
  }

  function handleClearOrder() {
    setCartLines([]);
  }

  const keypadInitialNumber =
    keypadDrawer?.mode === "quantity"
      ? keypadDrawer.initialNumber
      : tableNumber;

  const cartSubtotal = cartLines.reduce(
    (sum, line) => sum + Number(line.price || 0) * (line.quantity || 1),
    0,
  );

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#e8e8e8]">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b-4 border-[#f9b08c] bg-brand_accent px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <Image src={Logo} alt="EasyMenu" className="size-9" priority />
          <span className="text-lg font-bold text-white">
            Easy<span className="text-neutral-900">Menu</span>
          </span>
        </div>

        <div className="flex items-center gap-3 sm:gap-8">
          {POS_HEADER_ACTIONS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-label={label}
              onClick={() => {
                if (id === "qr") router.push("/");
              }}
              className="flex size-10 items-center justify-center rounded-xl bg-black/15 text-white transition-colors active:bg-black/25 sm:size-11"
            >
              <Icon size={28} strokeWidth={2} />
            </button>
          ))}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left: current order */}
        <section className="flex w-[34%] min-w-[280px] max-w-[440px] shrink-0 flex-col border-r border-neutral-300 bg-white">
          <div className="flex shrink-0 items-stretch border-b border-neutral-200 bg-[#ececec] p-2">
            <button
              type="button"
              onClick={() => setKeypadDrawer({ mode: "table" })}
              className="flex min-h-[52px] w-full items-center justify-center rounded-md bg-white px-4 text-base font-semibold text-neutral-700 shadow-[0_0_0_1px_#d4d4d4] transition-colors hover:bg-neutral-50 active:bg-neutral-100"
            >
              {tableLabel}
            </button>
          </div>

          <PosTableEntryDrawer
            isOpen={Boolean(keypadDrawer)}
            mode={keypadDrawer?.mode || "table"}
            onClose={() => setKeypadDrawer(null)}
            initialNumber={keypadInitialNumber}
            onConfirm={handleKeypadConfirm}
          />

          <div className="min-h-0 flex-1 overflow-y-auto bg-white">
            {cartLines.length === 0 ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-neutral-400">
                Tap products to add them to this order
              </div>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {cartLines.map((line) => {
                  const qty = line.quantity || 1;
                  const lineTotal = Number(line.price || 0) * qty;
                  return (
                    <li
                      key={line.lineId}
                      className="flex items-center gap-2.5 px-3 py-2.5"
                    >
                      <button
                        type="button"
                        onClick={() => handleQtyClick(line.lineId)}
                        className="inline-flex h-8 min-w-[2rem] shrink-0 items-center justify-center rounded-md border border-neutral-300 bg-white px-2 text-sm font-bold text-neutral-800 shadow-sm transition-colors hover:bg-neutral-50 active:bg-neutral-100"
                        aria-label={`Edit quantity of ${line.title}`}
                      >
                        {qty}
                      </button>
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-900">
                        {line.title}
                      </p>
                      <p className="shrink-0 text-sm font-semibold tabular-nums text-neutral-800">
                        ${lineTotal.toFixed(2)}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(line.lineId)}
                        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[#ef3636] text-white transition-colors hover:bg-[#e0662e] active:bg-[#d45c24]"
                        aria-label={`Remove ${line.title}`}
                      >
                        <X size={14} strokeWidth={2.5} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <PosOrderPanelFooter
            subtotal={cartSubtotal}
            onClear={handleClearOrder}
          />
        </section>

        {/* Right: POS menu layout (tabs + products) */}
        <section className="flex min-w-0 flex-1">
          {/* Tabs column — z-30 + overhang so selected indicator sits on top of products */}
          <aside className="relative z-30 flex w-[120px] shrink-0 flex-col bg-[#e0e0e0] sm:w-[190px]">
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
                        "relative flex min-h-[72px] w-full items-center justify-start px-3 py-7 text-left text-lg font-semibold text-neutral-900 transition-opacity",
                        isSelected ? "z-20" : "hover:opacity-90",
                      )}
                      style={{
                        backgroundColor: tab.backgroundColor || "#d9d9d9",
                      }}
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

            <div className="shrink-0">
              <button
                type="button"
                aria-label="Open drawer"
                className="flex w-full items-center justify-center gap-1.5 bg-neutral-300 px-3 py-4 text-sm font-semibold uppercase tracking-wide text-neutral-700 transition-colors hover:bg-neutral-600 hover:text-white active:bg-neutral-700 sm:gap-2 sm:py-5 sm:text-base"
              >
                <PanelBottomOpen
                  size={22}
                  strokeWidth={2.25}
                  className="shrink-0 sm:size-6"
                  aria-hidden
                />
                Open drawer
              </button>
              <button
                type="button"
                aria-label="Pay"
                className="flex w-full items-center justify-center gap-0 bg-[#ef3636] px-3 py-6 text-lg font-semibold uppercase tracking-wide text-white transition-colors hover:bg-[#e0662e] active:bg-[#d45c24] sm:gap-1 sm:py-6 sm:text-xl"
              >
                <span className="relative inline-flex size-7 items-center justify-center sm:size-8">
                  <DollarSign size={28} strokeWidth={2} />
                </span>
                Pay
              </button>
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
                    <div key={row.id} className="grid grid-cols-5 gap-3">
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
    </div>
  );
}
