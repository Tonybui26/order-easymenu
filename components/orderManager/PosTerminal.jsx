"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, PanelBottomOpen, Plus } from "lucide-react";
import { motion } from "motion/react";
import toast from "react-hot-toast";
import { useMenuContext } from "@/components/context/MenuContext";
import { cn } from "@/lib/helper";
import {
  completePosSaleBatch,
  fetchPosResumeOrders,
  sendPosOrder,
  cancelPosOrderItem,
} from "@/lib/api/fetchApi";
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
import PosCancelSentLineDrawer, {
  POS_CANCEL_SENT_LINE_DRAWER_CLOSED,
} from "./PosCancelSentLineDrawer";
import PosChromeHeader from "./PosChromeHeader";
import DismissibleToast, {
  useDismissibleToast,
} from "@/components/orderManager/DismissibleToast";
import { printKitchenOrder } from "@/lib/helper/printKitchenOrder";

function mapPosOrderType(orderType) {
  if (orderType === "dine-in") return "dine-in";
  if (orderType === "takeaway") return "pick-up";
  return null;
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

function appendCheckOrderId(existingIds, orderId) {
  const id = String(orderId || "").trim();
  if (!id) return existingIds;
  if ((existingIds || []).includes(id)) return existingIds;
  return [...(existingIds || []), id];
}

function isSentCartLine(line) {
  return line?.kitchenStatus === "sent";
}

function isCancelledCartLine(line) {
  return line?.kitchenStatus === "cancelled";
}

function isOpenCartLine(line) {
  return !isSentCartLine(line) && !isCancelledCartLine(line);
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

function PosProductCard({ item, onAdd, disabled = false }) {
  return (
    <button
      type="button"
      onClick={() => onAdd?.(item)}
      disabled={disabled}
      className="relative flex w-full flex-col overflow-hidden rounded-lg bg-white shadow-[0_0_0_1px_#1a1a1a0f] transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
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
  const { menuContent, posLayouts, globalModifiers, globalVariants, storeProfile, itemGroups } =
    useMenuContext();
  const {
    toast: dismissibleToast,
    showToast: showDismissibleToast,
    hideToast: hideDismissibleToast,
  } = useDismissibleToast();
  const itemsById = useAllMenuItems(menuContent);

  const activeLayout = posLayouts?.[0] || null;
  const tabs = activeLayout?.tabs || [];

  const [selectedTabId, setSelectedTabId] = useState(null);
  const [cartLines, setCartLines] = useState([]);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [checkOrderIds, setCheckOrderIds] = useState([]);
  const [posCheckId, setPosCheckId] = useState(null);
  const [isCheckPaid, setIsCheckPaid] = useState(false);
  const [isResumedCheck, setIsResumedCheck] = useState(false);
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
  const [isOrderTypeMissing, setIsOrderTypeMissing] = useState(false);
  const [tableFieldShakeKey, setTableFieldShakeKey] = useState(0);
  const [cancelSentLineDrawer, setCancelSentLineDrawer] = useState(
    POS_CANCEL_SENT_LINE_DRAWER_CLOSED,
  );
  const [isVoidingLine, setIsVoidingLine] = useState(false);

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
          showDismissibleToast(result?.error || "Could not load held order");
          resumeLoadedRef.current = null;
          router.replace("/pos");
          return;
        }

        const resumeState = buildPosResumeState(result.orders);
        const lines = buildCartLinesFromResumeOrders(result.orders);

        setCustomizingItem(null);
        setCustomizingLineId(null);
        setSelectedVariants({});
        setSelectedModifiers({});
        setCartLines(lines);
        setCheckOrderIds(resumeState.orderIds);
        setActiveOrderId(resumeState.activeOrderId);
        setPosCheckId(resumeState.posCheckId);
        setTableNumber(resumeState.tableNumber);
        setOrderType(resumeState.orderType);
        setIsCheckPaid(resumeState.isCheckPaid);
        setIsResumedCheck(true);
        setIsOrderTypeMissing(false);
        router.replace("/pos");
      } catch (error) {
        if (!cancelled) {
          showDismissibleToast(error?.message || "Could not load held order");
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
  }, [resumeParam, menuContent, router]);

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
  const isViewOnly = isCheckPaid;
  const isTableFieldLocked = isViewOnly || isResumedCheck;

  const tableLabel = (() => {
    if (!orderType) {
      if (isOrderTypeMissing) return "SELECT ORDER TYPE";
      return "TABLE: --";
    }
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
        (line) =>
          line.itemId === item.id &&
          line.configKey === configKey &&
          isOpenCartLine(line),
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
    const activeLine = cartLines.find((line) => line.lineId === customizingLineId);
    if (isSentCartLine(activeLine) || isCancelledCartLine(activeLine)) return;
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
    if (isViewOnly) return;
    const line = cartLines.find((entry) => entry.lineId === lineId);
    if (!line || !isOpenCartLine(line)) return;

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
    if (isViewOnly) return;
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
    if (isViewOnly) return;
    const line = cartLines.find((entry) => entry.lineId === lineId);
    if (!line || !isOpenCartLine(line)) return;
    setKeypadDrawer({
      mode: "quantity",
      lineId,
      initialNumber: String(line?.quantity || 1),
    });
  }

  function handleRemoveLine(lineId) {
    const line = cartLines.find((entry) => entry.lineId === lineId);
    if (isViewOnly || !isOpenCartLine(line)) return;
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
    const line = cartLines.find((entry) => entry.lineId === lineId);
    if (!isOpenCartLine(line)) return;
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
    const line = cartLines.find((entry) => entry.lineId === lineId);
    if (!isOpenCartLine(line)) return;
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
    if (isTableFieldLocked) return;
    setTableNumber(number || "");
    setOrderType(nextOrderType || null);
    if (nextOrderType) setIsOrderTypeMissing(false);
  }

  function nudgeTableFieldForMissingOrderType() {
    setIsOrderTypeMissing(true);
    setTableFieldShakeKey((key) => key + 1);
  }

  function handleQuantityConfirm({ quantity }) {
    const lineId = keypadDrawer?.lineId;
    if (!lineId) return;

    const line = cartLines.find((entry) => entry.lineId === lineId);
    if (!isOpenCartLine(line)) return;

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
    setCheckOrderIds([]);
    setPosCheckId(null);
    setIsCheckPaid(false);
    setIsResumedCheck(false);
    setIsOrderTypeMissing(false);
    resumeLoadedRef.current = null;
    closeCustomization();
  }

  function handleGoToHeldOrders() {
    router.push("/pos/held");
  }

  function handleLogoHome() {
    handleClearOrder();
    setTableNumber("");
    setOrderType(null);
    setKeypadDrawer(null);
    setIsPaymentDrawerOpen(false);
    router.replace("/pos");
  }

  async function handleSendOrder() {
    if (isViewOnly || cartLines.length === 0 || isSending) return;

    const unsentLines = cartLines.filter(isOpenCartLine);
    if (unsentLines.length === 0) {
      showDismissibleToast("Nothing new to send");
      return;
    }

    const mappedOrderType = mapPosOrderType(orderType);
    if (!mappedOrderType) {
      nudgeTableFieldForMissingOrderType();
      return;
    }

    setIsSending(true);
    try {
      const payload = {
        orderType: mappedOrderType,
        items: buildPosSendItems(unsentLines),
      };
      if (tableNumber) payload.table = tableNumber;
      if (posCheckId) payload.posCheckId = posCheckId;

      const result = await sendPosOrder(payload);
      if (!result?.success || !result.order?._id) {
        showDismissibleToast(result?.error || "Failed to send order");
        return;
      }

      const sentLineIds = new Set(unsentLines.map((line) => line.lineId));
      const newOrderId = String(result.order._id);
      const nextCheckId =
        String(result.order?.posCheckId || "").trim() || posCheckId;

      setActiveOrderId(newOrderId);
      if (nextCheckId) setPosCheckId(nextCheckId);
      setCheckOrderIds((prev) => appendCheckOrderId(prev, newOrderId));
      setCartLines((prev) =>
        prev.map((line) =>
          sentLineIds.has(line.lineId)
            ? { ...line, kitchenStatus: "sent", sourceOrderId: newOrderId }
            : line,
        ),
      );
      if (customizingLineId && sentLineIds.has(customizingLineId)) {
        closeCustomization();
      }
      toast.success("Order sent to kitchen");

      // Each Send creates one kitchen order with only this fire's items — print that ticket.
      try {
        await printKitchenOrder(result.order, {
          storeProfile,
          itemGroups,
          source: "pos_send",
          notify: true,
          notifySuccess: false,
          silentNoPrinters: true,
          showCustomToast: (message) => showDismissibleToast(message),
        });
      } catch (printError) {
        console.error("POS send print error:", printError);
        showDismissibleToast("Kitchen ticket print failed");
      }
    } catch (error) {
      showDismissibleToast(error?.message || "Failed to send order");
    } finally {
      setIsSending(false);
    }
  }

  async function handleCompleteSale(paymentSummary) {
    const orderIdsToComplete =
      checkOrderIds.length > 0
        ? checkOrderIds
        : activeOrderId
          ? [activeOrderId]
          : [];

    if (orderIdsToComplete.length === 0) {
      showDismissibleToast("Send the order before completing payment");
      return;
    }
    if (!paymentSummary?.method || isCompletingSale) return;

    setIsCompletingSale(true);
    try {
      const result = await completePosSaleBatch({
        orderIds: orderIdsToComplete,
        method: paymentSummary.method,
        amountTendered: Number(paymentSummary.amountTendered || 0),
        changeDue: Number(paymentSummary.change || 0),
      });

      if (!result?.success) {
        showDismissibleToast(result?.error || "Failed to complete sale");
        return;
      }

      setCartLines([]);
      setActiveOrderId(null);
      setCheckOrderIds([]);
      setPosCheckId(null);
      setIsCheckPaid(false);
      setIsResumedCheck(false);
      setTableNumber("");
      setOrderType(null);
      setKeypadDrawer(null);
      resumeLoadedRef.current = null;
      closeCustomization();
      setIsPaymentDrawerOpen(false);
      toast.success("Sale completed");
    } catch (error) {
      showDismissibleToast(error?.message || "Failed to complete sale");
    } finally {
      setIsCompletingSale(false);
    }
  }

  function handleVoidSentLine(lineId) {
    if (isViewOnly) return;
    const line = cartLines.find((entry) => entry.lineId === lineId);
    if (!line || !isSentCartLine(line)) return;
    setCancelSentLineDrawer({ show: true, line });
  }

  async function handleConfirmCancelSentLine(reason) {
    const line = cancelSentLineDrawer.line;
    if (!line || isVoidingLine) return;

    const orderId = String(line.sourceOrderId || "").trim();
    if (!orderId) {
      showDismissibleToast("Cannot void item — missing order reference");
      return;
    }

    setIsVoidingLine(true);
    try {
      const result = await cancelPosOrderItem({
        orderId,
        lineId: line.lineId,
        reason,
      });
      if (!result?.success) {
        showDismissibleToast(result?.error || "Failed to void item");
        return;
      }

      const cancelledAt =
        result.item?.cancelledAt || new Date().toISOString();
      setCartLines((prev) =>
        prev.map((entry) =>
          entry.lineId === line.lineId
            ? {
                ...entry,
                kitchenStatus: "cancelled",
                cancelReason: reason,
                cancelledAt,
              }
            : entry,
        ),
      );
      if (line.lineId === customizingLineId) {
        closeCustomization();
      }
      setCancelSentLineDrawer(POS_CANCEL_SENT_LINE_DRAWER_CLOSED);
      toast.success("Item voided");
    } catch (error) {
      showDismissibleToast(error?.message || "Failed to void item");
    } finally {
      setIsVoidingLine(false);
    }
  }

  function handleOpenPayment() {
    if (isViewOnly) return;
    if (checkOrderIds.length === 0) {
      showDismissibleToast("Send the order before payment");
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

  const cartSubtotal = cartLines.reduce((sum, line) => {
    if (isCancelledCartLine(line)) return sum;
    return sum + Number(line.price || 0) * (line.quantity || 1);
  }, 0);
  const hasUnsentLines = cartLines.some(isOpenCartLine);

  return (
    <>
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#e8e8e8] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <PosChromeHeader onLogoClick={handleLogoHome} />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left: current order */}
        <section className="flex w-[34%] min-w-[280px] max-w-[440px] shrink-0 flex-col border-r border-neutral-300 bg-white pb-[env(safe-area-inset-bottom)]">
          <div className="flex shrink-0 items-stretch border-b border-neutral-200 bg-[#ececec] p-2">
            <motion.button
              key={tableFieldShakeKey}
              type="button"
              onClick={() => {
                if (isTableFieldLocked) return;
                setKeypadDrawer({ mode: "table" });
              }}
              disabled={isTableFieldLocked}
              initial={{ x: 0 }}
              animate={
                tableFieldShakeKey > 0 ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }
              }
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className={cn(
                "flex min-h-[52px] w-full items-center justify-center rounded-md bg-white px-4 text-base font-semibold shadow-[0_0_0_1px_#d4d4d4] transition-colors hover:bg-neutral-50 active:bg-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-800",
                isOrderTypeMissing && !orderType
                  ? "bg-red-50 text-red-700 shadow-[0_0_0_2px_#ef4444]"
                  : "text-neutral-700",
              )}
            >
              {tableLabel}
            </motion.button>
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
                    readOnly={isViewOnly}
                    allowVoidSentLine={!isViewOnly}
                    onSelect={handleSelectCartLine}
                    onQtyClick={handleQtyClick}
                    onRemoveLine={handleRemoveLine}
                    onVoidSentLine={handleVoidSentLine}
                    onRemoveVariant={handleRemoveVariant}
                    onRemoveModifier={handleRemoveModifier}
                  />
                ))}
              </ul>
            )}
          </div>

          <PosOrderPanelFooter
            subtotal={cartSubtotal}
            hasUnsentItems={hasUnsentLines}
            viewOnly={isViewOnly}
            onClear={handleClearOrder}
            onHold={handleGoToHeldOrders}
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
                  isViewOnly ||
                  checkOrderIds.length === 0 ||
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
            {customizingItem && isOpenCartLine(activeCartLine) ? (
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
                            disabled={isViewOnly}
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
    <DismissibleToast
      toast={dismissibleToast}
      onDismiss={hideDismissibleToast}
      className="right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))]"
    />
    <PosCancelSentLineDrawer
      drawerState={cancelSentLineDrawer}
      onClose={() => {
        if (!isVoidingLine) {
          setCancelSentLineDrawer(POS_CANCEL_SENT_LINE_DRAWER_CLOSED);
        }
      }}
      onConfirm={handleConfirmCancelSentLine}
      isSubmitting={isVoidingLine}
    />
    </>
  );
}
