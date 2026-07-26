"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  PanelBottomOpen,
  Plus,
} from "lucide-react";
import toast from "react-hot-toast";
import { useMenuContext } from "@/components/context/MenuContext";
import { cn } from "@/lib/helper";
import { completePosSale, fetchPosResumeOrders, sendPosOrder } from "@/lib/api/fetchApi";
import {
  buildDefaultModifierSelections,
  buildDefaultVariantSelections,
  buildSelectedModifiersPayload,
  buildSelectedVariantsPayload,
  cartConfigKey,
  computeLineBasePrice,
  computeLineUnitPrice,
  itemNeedsCustomization,
  selectionMapsFromLine,
} from "@/lib/pos/itemCustomization";
import {
  buildCartLinesFromResumeOrders,
  buildPosResumeState,
} from "@/lib/pos/posResumeOrder";
import PosTableEntryDrawer from "./PosTableEntryDrawer";
import PosPaymentDrawer from "./PosPaymentDrawer";
import PosOrderPanelFooter from "./PosOrderPanelFooter";
import PosItemCustomizePanel from "./PosItemCustomizePanel";
import PosCartLine from "./PosCartLine";
import PosChromeHeader from "./PosChromeHeader";

function mapPosOrderType(orderType) {
  if (orderType === "dine-in") return "dine-in";
  return "pick-up";
}

function buildPosSendItems(cartLines) {
  return (cartLines || []).map((line) => ({
    lineId: line.lineId,
    menuItemId: line.itemId,
    name: line.title,
    price: Number(line.price || 0),
    quantity: Number(line.quantity || 1),
    selectedVariants: line.selectedVariants || [],
    selectedModifiers: line.selectedModifiers || [],
  }));
}

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
      <div className="px-2 py-2.5 text-center text-base font-semibold leading-snug text-neutral-900 xl:text-lg">
        {item.title || "Untitled"}
      </div>
    </button>
  );
}

export default function PosTerminal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeParam = searchParams.get("resume");
  const resumeLoadedRef = useRef(null);
  const { menuContent, posLayouts, globalModifiers, globalVariants } =
    useMenuContext();
  const itemsById = useAllMenuItems(menuContent);

  const activeLayout = posLayouts?.[0] || null;
  const tabs = activeLayout?.tabs || [];

  const [selectedTabId, setSelectedTabId] = useState(null);
  const [cartLines, setCartLines] = useState([]);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [resumeOrderIds, setResumeOrderIds] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [isCompletingSale, setIsCompletingSale] = useState(false);
  const [isResumingOrder, setIsResumingOrder] = useState(false);
  const [keypadDrawer, setKeypadDrawer] = useState(null);
  const [isPaymentDrawerOpen, setIsPaymentDrawerOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState("");
  const [orderType, setOrderType] = useState(null);
  const [customizingItem, setCustomizingItem] = useState(null);
  const [customizingLineId, setCustomizingLineId] = useState(null);
  const [selectedVariants, setSelectedVariants] = useState({});
  const [selectedModifiers, setSelectedModifiers] = useState({});

  useEffect(() => {
    if (!resumeParam || !menuContent) return;
    if (resumeLoadedRef.current === resumeParam) return;

    const orderIds = resumeParam
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (orderIds.length === 0) return;

    let cancelled = false;
    resumeLoadedRef.current = resumeParam;
    setIsResumingOrder(true);

    (async () => {
      try {
        const result = await fetchPosResumeOrders(orderIds);
        if (cancelled) return;

        if (!result?.success || !result.orders?.length) {
          toast.error(result?.error || "Could not load held order");
          resumeLoadedRef.current = null;
          router.replace("/pos");
          return;
        }

        const resumeState = buildPosResumeState(result.orders);
        const lines = buildCartLinesFromResumeOrders(result.orders, itemsById);

        setCustomizingItem(null);
        setCustomizingLineId(null);
        setSelectedVariants({});
        setSelectedModifiers({});
        setCartLines(lines);
        setResumeOrderIds(resumeState.orderIds);
        setActiveOrderId(resumeState.activeOrderId);
        setTableNumber(resumeState.tableNumber);
        setOrderType(resumeState.orderType);
        router.replace("/pos");
      } catch (error) {
        if (!cancelled) {
          toast.error(error?.message || "Could not load held order");
          resumeLoadedRef.current = null;
          router.replace("/pos");
        }
      } finally {
        if (!cancelled) setIsResumingOrder(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [resumeParam, menuContent, itemsById, router]);

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

  function addConfiguredLine(
    item,
    variantsPayload,
    modifiersPayload,
    unitPrice,
  ) {
    const basePrice = computeLineBasePrice(
      variantsPayload,
      Number(item.price || 0),
    );
    const configKey = cartConfigKey(variantsPayload, modifiersPayload);
    setCartLines((prev) => {
      const existingIndex = prev.findIndex(
        (line) => line.itemId === item.id && line.configKey === configKey,
      );
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
          basePrice,
          price: unitPrice,
          quantity: 1,
          selectedVariants: variantsPayload,
          selectedModifiers: modifiersPayload,
          configKey,
        },
      ];
    });
  }

  function buildLineFromSelections(item, variantMap, modifierMap) {
    const variantsPayload = buildSelectedVariantsPayload(item, variantMap);
    const modifiersPayload = buildSelectedModifiersPayload(
      item,
      modifierMap,
      globalModifiers || {},
    );
    const basePrice = computeLineBasePrice(
      variantsPayload,
      Number(item.price || 0),
    );
    const price = computeLineUnitPrice(basePrice, modifiersPayload);
    const configKey = cartConfigKey(variantsPayload, modifiersPayload);
    return {
      variantsPayload,
      modifiersPayload,
      basePrice,
      price,
      configKey,
    };
  }

  function closeCustomization() {
    setCustomizingItem(null);
    setCustomizingLineId(null);
    setSelectedVariants({});
    setSelectedModifiers({});
  }

  function openCustomization(item) {
    const variantMap = buildDefaultVariantSelections(
      item,
      globalVariants || {},
    );
    const modifierMap = buildDefaultModifierSelections(
      item,
      globalModifiers || {},
    );
    const built = buildLineFromSelections(item, variantMap, modifierMap);
    const lineId = `${item.id}-${Date.now()}`;

    setCartLines((prev) => [
      ...prev,
      {
        lineId,
        itemId: item.id,
        title: item.title || "Untitled",
        basePrice: built.basePrice,
        price: built.price,
        quantity: 1,
        selectedVariants: built.variantsPayload,
        selectedModifiers: built.modifiersPayload,
        configKey: built.configKey,
      },
    ]);

    setCustomizingLineId(lineId);
    setCustomizingItem(item);
    setSelectedVariants(variantMap);
    setSelectedModifiers(modifierMap);
  }

  function syncCustomizingLine(variantMap, modifierMap) {
    if (!customizingItem || !customizingLineId) return;
    const built = buildLineFromSelections(
      customizingItem,
      variantMap,
      modifierMap,
    );
    setCartLines((prev) =>
      prev.map((line) =>
        line.lineId === customizingLineId
          ? {
              ...line,
              basePrice: built.basePrice,
              price: built.price,
              selectedVariants: built.variantsPayload,
              selectedModifiers: built.modifiersPayload,
              configKey: built.configKey,
            }
          : line,
      ),
    );
  }

  function handleSelectCartLine(lineId) {
    const line = cartLines.find((entry) => entry.lineId === lineId);
    if (!line) return;

    const item = itemsById.get(line.itemId);
    if (!item || !itemNeedsCustomization(item)) {
      closeCustomization();
      return;
    }

    const maps = selectionMapsFromLine(line, item);
    setCustomizingLineId(lineId);
    setCustomizingItem(item);
    setSelectedVariants(maps.selectedVariants);
    setSelectedModifiers(maps.selectedModifiers);
  }

  function handleAddItem(item) {
    if (itemNeedsCustomization(item)) {
      openCustomization(item);
      return;
    }

    closeCustomization();
    addConfiguredLine(item, [], [], Number(item.price || 0));
  }

  function handleTabClick(tabId) {
    if (customizingItem) closeCustomization();
    setSelectedTabId(tabId);
  }

  function handleSelectVariant(groupId, optionId) {
    setSelectedVariants((prev) => {
      const next = { ...prev, [groupId]: optionId };
      syncCustomizingLine(next, selectedModifiers);
      return next;
    });
  }

  function handleToggleModifier(groupKey, optionId, maxSelection) {
    setSelectedModifiers((prev) => {
      const current = prev[groupKey] || [];
      const isSelected = current.includes(optionId);
      let nextGroup;

      if (maxSelection === 1) {
        nextGroup = isSelected ? [] : [optionId];
      } else if (isSelected) {
        nextGroup = current.filter((id) => id !== optionId);
      } else if (
        maxSelection &&
        maxSelection > 0 &&
        current.length >= maxSelection
      ) {
        nextGroup = [...current.slice(1), optionId];
      } else {
        nextGroup = [...current, optionId];
      }

      const next = { ...prev, [groupKey]: nextGroup };
      syncCustomizingLine(selectedVariants, next);
      return next;
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
    if (lineId === customizingLineId) closeCustomization();
  }

  function refreshLinePricing(line, selectedVariants, selectedModifiers) {
    const item = itemsById.get(line.itemId);
    const basePrice = computeLineBasePrice(
      selectedVariants,
      Number(item?.price || line.basePrice || 0),
    );
    const price = computeLineUnitPrice(basePrice, selectedModifiers);
    const configKey = cartConfigKey(selectedVariants, selectedModifiers);
    return {
      ...line,
      selectedVariants,
      selectedModifiers,
      basePrice,
      price,
      configKey,
    };
  }

  function handleRemoveVariant(lineId, optionId) {
    setCartLines((prev) =>
      prev.map((line) => {
        if (line.lineId !== lineId) return line;
        const selectedVariantsNext = (line.selectedVariants || []).filter(
          (variant) => variant.optionId !== optionId,
        );
        return refreshLinePricing(
          line,
          selectedVariantsNext,
          line.selectedModifiers || [],
        );
      }),
    );

    if (lineId === customizingLineId) {
      setSelectedVariants((prev) => {
        const next = { ...prev };
        Object.entries(next).forEach(([groupId, id]) => {
          if (id === optionId) delete next[groupId];
        });
        return next;
      });
    }
  }

  function handleRemoveModifier(lineId, optionId) {
    setCartLines((prev) =>
      prev.map((line) => {
        if (line.lineId !== lineId) return line;
        const selectedModifiersNext = (line.selectedModifiers || []).filter(
          (modifier) => modifier.optionId !== optionId,
        );
        return refreshLinePricing(
          line,
          line.selectedVariants || [],
          selectedModifiersNext,
        );
      }),
    );

    if (lineId === customizingLineId) {
      setSelectedModifiers((prev) => {
        const next = {};
        Object.entries(prev).forEach(([groupKey, ids]) => {
          next[groupKey] = (ids || []).filter((id) => id !== optionId);
        });
        return next;
      });
    }
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
    setActiveOrderId(null);
    setResumeOrderIds([]);
    resumeLoadedRef.current = null;
    closeCustomization();
  }

  async function handleSendOrder() {
    if (cartLines.length === 0 || isSending) return;

    setIsSending(true);
    try {
      const payload = {
        orderType: mapPosOrderType(orderType),
        items: buildPosSendItems(cartLines),
      };
      if (activeOrderId) payload.orderId = activeOrderId;
      if (tableNumber) payload.table = tableNumber;

      const result = await sendPosOrder(payload);
      if (!result?.success || !result.order?._id) {
        toast.error(result?.error || "Failed to send order");
        return;
      }

      setActiveOrderId(result.order._id);
      setCartLines((prev) =>
        prev.map((line) =>
          line.kitchenStatus === "sent"
            ? line
            : { ...line, kitchenStatus: "sent" },
        ),
      );
      toast.success(activeOrderId ? "Items sent" : "Order sent to kitchen");
    } catch (error) {
      toast.error(error?.message || "Failed to send order");
    } finally {
      setIsSending(false);
    }
  }

  async function handleCompleteSale(paymentSummary) {
    const orderIdsToComplete =
      resumeOrderIds.length > 0
        ? resumeOrderIds
        : activeOrderId
          ? [activeOrderId]
          : [];

    if (orderIdsToComplete.length === 0) {
      toast.error("Send the order before completing payment");
      return;
    }
    if (!paymentSummary?.method || isCompletingSale) return;

    setIsCompletingSale(true);
    try {
      for (let index = 0; index < orderIdsToComplete.length; index += 1) {
        const orderId = orderIdsToComplete[index];
        const isLast = index === orderIdsToComplete.length - 1;
        const result = await completePosSale(orderId, {
          method: paymentSummary.method,
          amountTendered: isLast
            ? Number(paymentSummary.amountTendered || 0)
            : 0,
          changeDue: isLast ? Number(paymentSummary.change || 0) : 0,
        });

        if (!result?.success) {
          toast.error(result?.error || "Failed to complete sale");
          return;
        }
      }

      setCartLines([]);
      setActiveOrderId(null);
      setResumeOrderIds([]);
      resumeLoadedRef.current = null;
      closeCustomization();
      setIsPaymentDrawerOpen(false);
      toast.success("Sale completed");
    } catch (error) {
      toast.error(error?.message || "Failed to complete sale");
    } finally {
      setIsCompletingSale(false);
    }
  }

  function handleOpenPayment() {
    if (!activeOrderId && resumeOrderIds.length === 0) {
      toast.error("Send the order before payment");
      return;
    }
    setIsPaymentDrawerOpen(true);
  }

  const keypadInitialNumber =
    keypadDrawer?.mode === "quantity"
      ? keypadDrawer.initialNumber
      : tableNumber;

  const activeCartLine = customizingLineId
    ? cartLines.find((line) => line.lineId === customizingLineId)
    : null;
  const panelSelections = activeCartLine
    ? selectionMapsFromLine(activeCartLine, customizingItem)
    : { selectedVariants, selectedModifiers };

  const cartSubtotal = cartLines.reduce(
    (sum, line) => sum + Number(line.price || 0) * (line.quantity || 1),
    0,
  );

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#e8e8e8] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <PosChromeHeader />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left: current order */}
        <section className="flex w-[34%] min-w-[280px] max-w-[440px] shrink-0 flex-col border-r border-neutral-300 bg-white pb-[env(safe-area-inset-bottom)]">
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

          <PosPaymentDrawer
            isOpen={isPaymentDrawerOpen}
            onClose={() => setIsPaymentDrawerOpen(false)}
            amountDue={cartSubtotal}
            onCompleteSale={handleCompleteSale}
          />

          <div className="min-h-0 flex-1 overflow-y-auto bg-white">
            {isResumingOrder ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-neutral-400">
                Loading held order…
              </div>
            ) : cartLines.length === 0 ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-neutral-400">
                Tap products to add them to this order
              </div>
            ) : (
              <ul>
                {cartLines.map((line) => (
                  <PosCartLine
                    key={line.lineId}
                    line={line}
                    isActive={line.lineId === customizingLineId}
                    onSelect={handleSelectCartLine}
                    onQtyClick={handleQtyClick}
                    onRemoveLine={handleRemoveLine}
                    onRemoveVariant={handleRemoveVariant}
                    onRemoveModifier={handleRemoveModifier}
                  />
                ))}
              </ul>
            )}
          </div>

          <PosOrderPanelFooter
            subtotal={cartSubtotal}
            hasItems={cartLines.length > 0}
            onClear={handleClearOrder}
            onSend={handleSendOrder}
          />
        </section>

        {/* Right: POS menu layout (tabs + products) */}
        <section className="flex min-w-0 flex-1">
          {/* Tabs column — z-30 + overhang so selected indicator sits on top of products */}
          <aside className="relative z-30 flex w-[120px] shrink-0 flex-col bg-[#e0e0e0] pb-[env(safe-area-inset-bottom)] sm:w-[150px]">
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
                      onClick={() => handleTabClick(tab.id)}
                      className={cn(
                        "relative flex min-h-[72px] w-full items-center justify-start px-3 py-6 text-left text-base font-semibold text-neutral-900 transition-opacity xl:text-lg",
                        isSelected || customizingItem
                          ? "z-20"
                          : "hover:opacity-90",
                        customizingItem &&
                          isSelected &&
                          "ring-2 ring-inset ring-black/10",
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
                className="flex w-full items-center justify-center gap-1.5 bg-neutral-300 px-3 py-4 text-sm font-semibold uppercase tracking-wide text-neutral-700 transition-colors hover:bg-neutral-600 hover:text-white active:bg-neutral-700 sm:gap-2 sm:py-5 xl:text-base"
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
                onClick={handleOpenPayment}
                disabled={
                  (!activeOrderId && resumeOrderIds.length === 0) ||
                  isCompletingSale ||
                  isResumingOrder
                }
                className="flex w-full items-center justify-center gap-0 bg-[#ef3636] px-3 py-6 text-base font-bold uppercase tracking-wide text-white transition-colors hover:bg-[#e0662e] active:bg-[#d45c24] disabled:cursor-not-allowed disabled:bg-neutral-400 disabled:hover:bg-neutral-400 sm:gap-1 sm:py-6 xl:text-lg"
              >
                <span className="text-xl">$</span>
                Pay
              </button>
            </div>
          </aside>

          {/* Products / item customization */}
          <div className="relative z-0 min-h-0 min-w-0 flex-1 overflow-hidden bg-[#f0f0f0]">
            {customizingItem ? (
              <PosItemCustomizePanel
                item={customizingItem}
                globalModifiers={globalModifiers || {}}
                globalVariants={globalVariants || {}}
                selectedVariants={panelSelections.selectedVariants}
                selectedModifiers={panelSelections.selectedModifiers}
                onSelectVariant={handleSelectVariant}
                onToggleModifier={handleToggleModifier}
              />
            ) : !selectedTab ? (
              <div className="flex h-full items-center justify-center text-sm text-neutral-500">
                Select a tab
              </div>
            ) : selectedRows.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-neutral-500">
                This tab has no products yet
              </div>
            ) : (
              <div className="h-full overflow-y-auto">
                <div className="flex flex-col gap-4 p-4">
                  {selectedRows.map((row) => {
                    const rowItems = (row.itemIds || [])
                      .map((id) => itemsById.get(id))
                      .filter(Boolean);

                    if (rowItems.length === 0) return null;

                    return (
                      <div
                        key={row.id}
                        className="grid grid-cols-4 gap-1 xl:grid-cols-5"
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
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
