"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Plus } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import toast from "react-hot-toast";
import { useMenuContext } from "@/components/context/MenuContext";
import { usePosNavigate } from "@/components/context/PosNavigateContext";
import { cn } from "@/lib/helper";
import {
  completePosSaleBatch,
  fetchPosResumeOrders,
  sendPosOrder,
  cancelPosOrderItem,
  applyPosCheckDiscount,
} from "@/lib/api/fetchApi";
import { hydrateResumeOrders } from "@/lib/localDb/posLiveSnapshot";
import {
  flushOfflineSendOutbox,
  isOfflineAutoSyncEnabled,
  isOfflineSendEnabled,
  localTicketsAlreadySynced,
  lookupLocalIdsByServerOrderIds,
  onOfflineSendSynced,
  queueOfflinePosPayment,
  queueOfflinePosSend,
  syncLocalTicketsForInvoice,
} from "@/lib/localDb/offlineSendStore";
import { isStoreSecondTest } from "@/lib/store/isSecondTest";
import { isMongoObjectId } from "@/lib/localDb/localHeldOrders";
import {
  buildDefaultModifierSelections,
  buildDefaultVariantSelections,
  buildSelectedModifiersPayload,
  buildSelectedVariantsPayload,
  cartConfigKey,
  computeLineBasePrice,
  computeLineUnitPrice,
  itemHasCustomizableOptions,
  itemNeedsCustomization,
  selectionMapsFromLine,
} from "@/lib/pos/itemCustomization";
import {
  isExternalContextCartLine,
  planPosResumeApply,
  posCartLineReactKey,
} from "@/lib/pos/posResumeOrder";
import {
  buildCustomerDisplayCartSnapshot,
  updateCustomerDisplayCart,
} from "@/lib/customerDisplay/customerDisplay";
import PosTableEntryDrawer from "./PosTableEntryDrawer";
import PosDiscountDrawer from "./PosDiscountDrawer";
import PosTakeawayCustomerDrawer from "./PosTakeawayCustomerDrawer";
import PosPaymentDrawer from "./PosPaymentDrawer";
import PosOrderPanelFooter from "./PosOrderPanelFooter";
import PosItemCustomizePanel from "./PosItemCustomizePanel";
import PosCartLine from "./PosCartLine";
import PosItemNoteDrawer from "./PosItemNoteDrawer";
import PosCancelSentLineDrawer, {
  POS_CANCEL_SENT_LINE_DRAWER_CLOSED,
} from "./PosCancelSentLineDrawer";
import PosChromeHeader from "./PosChromeHeader";
import PosMenuSearch from "./PosMenuSearch";
import { usePosOpenCashDrawer } from "./usePosOpenCashDrawer";
import DismissibleToast, {
  useDismissibleToast,
} from "@/components/orderManager/DismissibleToast";
import { printKitchenOrder } from "@/lib/helper/printKitchenOrder";
import { buildTaxInvoiceReceiptFromPosCheck } from "@/lib/printers/receipt/buildTaxInvoiceReceiptFromPosCheck";
import { printTaxInvoiceReceipt } from "@/lib/printers/printTaxInvoiceReceipt";
import { resolvePosConfig, getPosHomePath, isRestaurantModeEnabled } from "@/lib/pos/posConfig";
import {
  isTyroPosCardReady,
  isLinklyPosCardReady,
  resolvePosPaymentsConfig,
} from "@/lib/pos/posPaymentsConfig";
import { useLinklyInflightRecovery } from "@/components/orderManager/useLinklyInflightRecovery";
import LinklyFailedSaleBanner from "@/components/orderManager/LinklyFailedSaleBanner";
import { clearLinklyLastTxnOutcome } from "@/lib/linkly/lastTxnOutcome";
import { printLinklyTxnReceipt } from "@/lib/printers/printLinklyTxnReceipt";
import { buildTrainingKitchenOrder } from "@/lib/pos/buildTrainingKitchenOrder";
import { clearPosTableMergeGroupsForTables } from "@/lib/pos/posTableMapMerge";
import { formatPosItemDisplayName } from "@/lib/helper/printNameAlias";
import { textMatchesAvailabilityQuery } from "@/lib/helper/availabilitySearchHelpers";

function resolveOrderTypeFromParam(value) {
  if (!value) return null;
  if (value === "takeaway") return "takeaway";
  if (value === "buzzer") return "buzzer";
  if (value === "delivery") return "delivery";
  return "dine-in";
}

/** Parse `tables` / `table` query values into sorted unique seat names. */
function parsePosTableNames(...rawValues) {
  const names = [];
  const seen = new Set();

  function push(value) {
    if (value == null) return;
    if (Array.isArray(value)) {
      value.forEach(push);
      return;
    }
    String(value)
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => {
        const key = part.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        names.push(part);
      });
  }

  rawValues.forEach(push);
  names.sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  );
  return names;
}

function formatPosTableNames(names) {
  return (names || []).join(", ");
}

function hasTakeawayTableReference(tableNumber) {
  return Boolean(String(tableNumber || "").trim());
}

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
    notes: line.notes || undefined,
    isTakeaway: line.isTakeaway === true ? true : undefined,
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

function isPayableCartLine(line) {
  return !isCancelledCartLine(line) && !isExternalContextCartLine(line);
}

const POS_TAB_CHECK_TRANSITION = {
  type: "spring",
  stiffness: 500,
  damping: 35,
};

const POS_TAB_PANEL_TRANSITION = { duration: 0.18, ease: "easeOut" };

function getPosPanelMotionProps(direction) {
  return {
    initial: { opacity: 0, y: direction * 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: direction * -12 },
    transition: POS_TAB_PANEL_TRANSITION,
  };
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

function PosProductCard({
  item,
  onAdd,
  disabled = false,
  useKitchenPrintAliases = false,
}) {
  const displayTitle =
    formatPosItemDisplayName(item.title, { useKitchenPrintAliases }) ||
    "Untitled";
  const hasImage = Boolean(item.PhotoSrc);

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
      {hasImage ? (
        <>
          <div className="relative aspect-square w-full bg-neutral-100">
            <Image
              src={item.PhotoSrc}
              alt={displayTitle}
              fill
              sizes="20vw"
              className="object-cover"
            />
          </div>
          <div className="px-2 py-2.5 text-center text-base font-semibold leading-snug text-neutral-900 xl:text-lg">
            {displayTitle}
          </div>
        </>
      ) : (
        <div className="flex aspect-square w-full items-center justify-center px-3 py-8">
          <span className="line-clamp-4 text-center text-base font-semibold leading-snug text-neutral-900 xl:text-lg">
            {displayTitle}
          </span>
        </div>
      )}
    </button>
  );
}

export default function PosTerminal() {
  const router = useRouter();
  const { navigate } = usePosNavigate();
  const searchParams = useSearchParams();
  const resumeParam = searchParams.get("resume");
  const payParam = searchParams.get("pay");
  const tableParam = searchParams.get("table");
  const tablesParam = searchParams.get("tables");
  const orderTypeParam = searchParams.get("orderType");
  const resumeLoadedRef = useRef(null);
  const openPayAfterResumeRef = useRef(false);
  const tablePrefilledRef = useRef(null);
  const pendingTakeawayRef = useRef(null);
  const {
    menuContent,
    posLayouts,
    globalModifiers,
    globalVariants,
    storeProfile,
    itemGroups,
    menuConfig,
  } = useMenuContext();
  const tableNamesFromUrl = resumeParam
    ? []
    : parsePosTableNames(tablesParam, tableParam);
  const tableNameFromUrl = formatPosTableNames(tableNamesFromUrl);
  const restaurantMode = isRestaurantModeEnabled(menuConfig);
  const orderTypeFromUrl = (() => {
    const fromParam = resolveOrderTypeFromParam(orderTypeParam);
    if (fromParam) return fromParam;
    if (!tableNameFromUrl) return null;
    // Restaurant mode: opening a table defaults to dine-in.
    if (restaurantMode) return "dine-in";
    return null;
  })();
  const {
    toast: dismissibleToast,
    showToast: showDismissibleToast,
    hideToast: hideDismissibleToast,
  } = useDismissibleToast();
  const itemsById = useAllMenuItems(menuContent);
  const searchableMenuItems = useMemo(
    () => Array.from(itemsById.values()),
    [itemsById],
  );
  const [menuSearchQuery, setMenuSearchQuery] = useState("");
  const trimmedMenuSearchQuery = menuSearchQuery.trim();
  const isMenuSearchActive = trimmedMenuSearchQuery.length > 0;
  const menuSearchResults = useMemo(() => {
    if (!isMenuSearchActive) return [];
    return searchableMenuItems.filter((item) =>
      textMatchesAvailabilityQuery(item.title || "", trimmedMenuSearchQuery),
    );
  }, [searchableMenuItems, trimmedMenuSearchQuery, isMenuSearchActive]);

  const activeLayout = posLayouts?.[0] || null;
  const tabs = activeLayout?.tabs || [];

  const [selectedTabId, setSelectedTabId] = useState(null);
  const [panelTransitionDirection, setPanelTransitionDirection] = useState(0);
  const prevSelectedTabIndexRef = useRef(-1);
  const [cartLines, setCartLines] = useState([]);
  const [enteringLineIds, setEnteringLineIds] = useState(() => new Set());
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [checkOrderIds, setCheckOrderIds] = useState([]);
  const [posCheckId, setPosCheckId] = useState(null);
  const [taxInvoiceNo, setTaxInvoiceNo] = useState("");
  const [isCheckPaid, setIsCheckPaid] = useState(false);
  const [isResumedCheck, setIsResumedCheck] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCompletingSale, setIsCompletingSale] = useState(false);
  const [isPrintingReceipt, setIsPrintingReceipt] = useState(false);
  const [isResumingOrder, setIsResumingOrder] = useState(false);
  const [keypadDrawer, setKeypadDrawer] = useState(null);
  const [isDiscountDrawerOpen, setIsDiscountDrawerOpen] = useState(false);
  const [checkDiscount, setCheckDiscount] = useState(null);
  const [isPaymentDrawerOpen, setIsPaymentDrawerOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState("");
  const [orderType, setOrderType] = useState(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [isTakeawayCustomerDrawerOpen, setIsTakeawayCustomerDrawerOpen] =
    useState(false);
  const [customizingItem, setCustomizingItem] = useState(null);
  const [customizingLineId, setCustomizingLineId] = useState(null);
  const [optionsLineId, setOptionsLineId] = useState(null);
  const [noteLineId, setNoteLineId] = useState(null);
  const [selectedVariants, setSelectedVariants] = useState({});
  const [selectedModifiers, setSelectedModifiers] = useState({});
  const [isOrderTypeMissing, setIsOrderTypeMissing] = useState(false);
  const [tableFieldShakeKey, setTableFieldShakeKey] = useState(0);
  const [isTablePrefilled, setIsTablePrefilled] = useState(false);
  const [cancelSentLineDrawer, setCancelSentLineDrawer] = useState(
    POS_CANCEL_SENT_LINE_DRAWER_CLOSED,
  );
  const [isVoidingLine, setIsVoidingLine] = useState(false);
  const { handleOpenCashDrawer } = usePosOpenCashDrawer(showDismissibleToast);
  const posConfig = useMemo(() => resolvePosConfig(menuConfig), [menuConfig]);
  const tyroPayments = useMemo(
    () => resolvePosPaymentsConfig(menuConfig).tyro,
    [menuConfig],
  );
  const linklyPayments = useMemo(
    () => resolvePosPaymentsConfig(menuConfig).linkly,
    [menuConfig],
  );
  const tyroCardEnabled = isTyroPosCardReady(menuConfig);
  const linklyCardEnabled = isLinklyPosCardReady(menuConfig);
  const [linklyFailedOutcome, setLinklyFailedOutcome] = useState(null);
  const [isLinklyReprintPending, setIsLinklyReprintPending] = useState(false);
  useLinklyInflightRecovery(linklyCardEnabled, {
    onOutcomeChange: (outcome) => {
      if (outcome?.markedFailed) setLinklyFailedOutcome(outcome);
      else setLinklyFailedOutcome(null);
    },
  });
  const isTrainingMode = Boolean(posConfig.trainingModeEnabled);
  const isPayFirstMode = Boolean(posConfig.payFirstModeEnabled);
  const useKitchenPrintAliases = Boolean(
    posConfig.showKitchenPrintAliasesOnPos,
  );

  useEffect(() => {
    if (!isTrainingMode || !resumeParam) return;
    showDismissibleToast("Held orders are not available in training mode");
    resumeLoadedRef.current = resumeParam;
    openPayAfterResumeRef.current = false;
    router.replace("/pos");
  }, [isTrainingMode, resumeParam, router, showDismissibleToast]);

  // Tap outside the revealed cart line closes Option (swipe-to-close is disabled).
  useEffect(() => {
    if (!optionsLineId) return;

    function handlePointerDown(event) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(`[data-pos-cart-line-id="${optionsLineId}"]`)) return;
      setOptionsLineId(null);
    }

    // Defer so the same gesture that opened Option does not immediately close it.
    const timer = window.setTimeout(() => {
      document.addEventListener("pointerdown", handlePointerDown, true);
    }, 50);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [optionsLineId]);

  const checkDiscountRef = useRef(checkDiscount);
  checkDiscountRef.current = checkDiscount;

  useEffect(() => {
    if (!isOfflineSendEnabled(menuConfig)) return;
    if (isOfflineAutoSyncEnabled(menuConfig)) {
      void flushOfflineSendOutbox();
    }
    return onOfflineSendSynced((detail) => {
      const serverOrderId = String(detail?.serverOrderId || "").trim();
      if (!serverOrderId) return;
      setCheckOrderIds((prev) => appendCheckOrderId(prev, serverOrderId));
      setActiveOrderId((prev) => prev || serverOrderId);
      if (detail.taxInvoiceNo) {
        setTaxInvoiceNo((prev) => prev || detail.taxInvoiceNo);
      }
      setCartLines((prev) =>
        prev.map((line) =>
          line.sourceOrderId === detail.localId
            ? { ...line, sourceOrderId: serverOrderId }
            : line,
        ),
      );
      const discount = checkDiscountRef.current;
      if (discount?.discountAmount > 0 && discount?.discountType) {
        void applyPosCheckDiscount({
          orderIds: [serverOrderId],
          discountAmount: discount.discountAmount ?? 0,
          discountPercent: discount.discountPercent ?? null,
          discountType: discount.discountType ?? null,
        });
      }
    });
  }, [menuConfig]);

  useEffect(() => {
    if (!resumeParam || !menuContent || isTrainingMode) return;
    if (resumeLoadedRef.current === resumeParam) return;

    const orderIds = resumeParam
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (orderIds.length === 0) return;

    const shouldOpenPay =
      payParam === "1" || payParam === "true" || payParam === "yes";
    openPayAfterResumeRef.current = shouldOpenPay;

    let cancelled = false;
    let painted = false;
    let paintedPlan = null;
    resumeLoadedRef.current = resumeParam;
    setIsResumingOrder(true);

    const applyPlan = (plan) => {
      setCustomizingItem(null);
      setCustomizingLineId(null);
      setSelectedVariants({});
      setSelectedModifiers({});
      setCartLines(plan.lines);
      setCheckOrderIds(plan.checkOrderIds);
      setActiveOrderId(plan.activeOrderId);
      setPosCheckId(plan.posCheckId);
      setTaxInvoiceNo(plan.taxInvoiceNo);
      setTableNumber(plan.tableNumber);
      setCustomerName(plan.customerName);
      setCustomerPhone(plan.customerPhone);
      setCustomerEmail(plan.customerEmail);
      setOrderType(plan.orderType);
      setIsCheckPaid(false);
      setIsResumedCheck(true);
      setCheckDiscount(plan.checkDiscount);
      setIsOrderTypeMissing(false);
      setIsTablePrefilled(plan.isTablePrefilled);
      painted = true;
      paintedPlan = plan;
      setIsResumingOrder(false);
    };

    const abandonResume = (message) => {
      showDismissibleToast(message || "Could not load held order");
      resumeLoadedRef.current = null;
      openPayAfterResumeRef.current = false;
      router.replace("/pos");
    };

    (async () => {
      try {
        const result = await hydrateResumeOrders(
          orderIds,
          (ids) => fetchPosResumeOrders(ids),
          {
            onOrders: (orders) => {
              if (cancelled) return;
              const plan = planPosResumeApply(orders, { restaurantMode });
              // Stale local rejects stay hidden until the live fetch decides.
              if (!plan.ok) return;
              applyPlan(plan);
            },
          },
        );
        if (cancelled) return;

        const networkFailed =
          !result?.success || !result.orders?.length;
        if (networkFailed) {
          if (painted) {
            if (
              openPayAfterResumeRef.current &&
              paintedPlan?.hasActiveUnpaidPos &&
              paintedPlan.checkOrderIds?.length > 0
            ) {
              setIsPaymentDrawerOpen(true);
            }
            openPayAfterResumeRef.current = false;
            router.replace("/pos");
            return;
          }
          abandonResume(result?.error);
          return;
        }

        const plan = planPosResumeApply(result.orders, { restaurantMode });
        if (!plan.ok) {
          abandonResume(plan.error);
          return;
        }
        if (!painted) applyPlan(plan);

        if (
          openPayAfterResumeRef.current &&
          plan.hasActiveUnpaidPos &&
          plan.checkOrderIds?.length > 0
        ) {
          setIsPaymentDrawerOpen(true);
        }
        openPayAfterResumeRef.current = false;
        router.replace("/pos");
      } catch (error) {
        if (cancelled) return;
        if (painted) {
          openPayAfterResumeRef.current = false;
          router.replace("/pos");
          return;
        }
        abandonResume(error?.message);
      } finally {
        if (!cancelled) setIsResumingOrder(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    resumeParam,
    payParam,
    menuContent,
    router,
    isTrainingMode,
    restaurantMode,
  ]);

  useLayoutEffect(() => {
    if (resumeParam) return;

    if (tableNameFromUrl) {
      setTableNumber(tableNameFromUrl);
      setOrderType(orderTypeFromUrl);
      setIsTablePrefilled(true);
      setIsOrderTypeMissing(false);
      tablePrefilledRef.current = tableNameFromUrl;
      router.replace("/pos");
      return;
    }

    if (!orderTypeParam) return;
    const fromParam = resolveOrderTypeFromParam(orderTypeParam);
    if (!fromParam) return;
    router.replace("/pos");
    if (fromParam === "takeaway") {
      pendingTakeawayRef.current = { tableNumber: "" };
      setIsTakeawayCustomerDrawerOpen(true);
      return;
    }
    setOrderType(fromParam);
    setIsOrderTypeMissing(false);
  }, [
    resumeParam,
    tableNameFromUrl,
    orderTypeFromUrl,
    orderTypeParam,
    router,
  ]);

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

  useEffect(() => {
    const nextIndex = tabs.findIndex((tab) => tab.id === selectedTabId);
    if (nextIndex < 0) return;

    const prevIndex = prevSelectedTabIndexRef.current;
    if (prevIndex >= 0 && nextIndex !== prevIndex) {
      setPanelTransitionDirection(nextIndex > prevIndex ? 1 : -1);
    } else {
      setPanelTransitionDirection(0);
    }

    prevSelectedTabIndexRef.current = nextIndex;
  }, [selectedTabId, tabs]);

  const selectedTab = tabs.find((tab) => tab.id === selectedTabId) || null;
  const selectedTabIndex = tabs.findIndex((tab) => tab.id === selectedTabId);
  const selectedRows = selectedTab?.rows || [];
  const isViewOnly = isCheckPaid;
  const resolvedTableNumber = tableNameFromUrl || tableNumber;
  const resolvedTableNames = parsePosTableNames(resolvedTableNumber);
  const resolvedPrimaryTable = resolvedTableNames[0] || "";
  const resolvedOrderType = orderTypeFromUrl || orderType;
  const isTableFromMap = Boolean(tableNameFromUrl);
  const isTableNumberLocked = isTablePrefilled || isTableFromMap;
  const disableTableNumberInput =
    isTableNumberLocked || (isResumedCheck && Boolean(resolvedTableNumber));
  const isTableFieldLocked = isViewOnly;
  const awaitingOrderType = !resolvedOrderType && !isTableFieldLocked;

  const tableLabel = (() => {
    if (!resolvedOrderType) {
      if (isOrderTypeMissing) return "SELECT ORDER TYPE";
      if (resolvedTableNumber) return `TABLE: ${resolvedTableNumber}`;
      return "DINE IN or TAKE AWAY";
    }
    if (resolvedOrderType === "dine-in") {
      return `TABLE: ${resolvedTableNumber || "--"}`;
    }
    if (resolvedOrderType === "buzzer") {
      return `BUZZER: ${resolvedTableNumber || "--"}`;
    }
    if (resolvedOrderType === "takeaway") {
      if (customerName) return `TAKEAWAY: ${customerName}`;
      return `TAKEAWAY${resolvedTableNumber ? `: ${resolvedTableNumber}` : ""}`;
    }
    if (resolvedOrderType === "delivery") {
      return `DELIVERY${resolvedTableNumber ? `: ${resolvedTableNumber}` : ""}`;
    }
    return `TABLE: ${resolvedTableNumber || "--"}`;
  })();

  function registerEnteringLine(lineId) {
    setEnteringLineIds((prev) => {
      const next = new Set(prev);
      next.add(lineId);
      return next;
    });
  }

  function clearEnteringLine(lineId) {
    setEnteringLineIds((prev) => {
      if (!prev.has(lineId)) return prev;
      const next = new Set(prev);
      next.delete(lineId);
      return next;
    });
  }

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
      const lineId = `${item.id}-${Date.now()}`;
      registerEnteringLine(lineId);
      return [
        {
          lineId,
          itemId: item.id,
          title: item.title || "Untitled",
          basePrice,
          price: unitPrice,
          quantity: 1,
          selectedVariants: variantsPayload,
          selectedModifiers: modifiersPayload,
          configKey,
        },
        ...prev,
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
    if (customizingItem) {
      setPanelTransitionDirection(-1);
    }
    setCustomizingItem(null);
    setCustomizingLineId(null);
    setSelectedVariants({});
    setSelectedModifiers({});
  }

  function openCustomization(item) {
    setPanelTransitionDirection(1);
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
    registerEnteringLine(lineId);

    setCartLines((prev) => [
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
      ...prev,
    ]);

    setCustomizingLineId(lineId);
    setCustomizingItem(item);
    setSelectedVariants(variantMap);
    setSelectedModifiers(modifierMap);
  }

  function syncCustomizingLine(variantMap, modifierMap) {
    if (!customizingItem || !customizingLineId) return;
    const activeLine = cartLines.find(
      (line) => line.lineId === customizingLineId,
    );
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

  function handleCartLineOptionsOpenChange(lineId, open) {
    setOptionsLineId((current) => {
      if (open) return lineId;
      return current === lineId ? null : current;
    });
  }

  function handleCartLineOptionsClick(lineId) {
    setOptionsLineId(null);
    setNoteLineId(lineId);
  }

  function handleCloseItemNoteDrawer() {
    setNoteLineId(null);
  }

  function handleSaveItemNote({ note, isTakeaway }) {
    if (!noteLineId) return;
    const nextNote = String(note || "").trim();
    const nextIsTakeaway = Boolean(isTakeaway);
    setCartLines((prev) =>
      prev.map((line) =>
        line.lineId === noteLineId
          ? {
              ...line,
              notes: nextNote || undefined,
              isTakeaway: nextIsTakeaway ? true : undefined,
            }
          : line,
      ),
    );
  }

  function handleSelectCartLine(lineId) {
    if (isViewOnly) return;
    setOptionsLineId(null);
    const line = cartLines.find((entry) => entry.lineId === lineId);
    if (!line || !isOpenCartLine(line)) return;

    const item = itemsById.get(line.itemId);
    if (!item || !itemHasCustomizableOptions(item, globalModifiers || {})) {
      closeCustomization();
      return;
    }

    const maps = selectionMapsFromLine(line, item);
    const nextIndex = cartLines.findIndex((entry) => entry.lineId === lineId);
    const prevIndex = customizingLineId
      ? cartLines.findIndex((entry) => entry.lineId === customizingLineId)
      : -1;

    if (prevIndex >= 0 && nextIndex !== prevIndex) {
      setPanelTransitionDirection(nextIndex > prevIndex ? 1 : -1);
    } else {
      setPanelTransitionDirection(1);
    }

    setCustomizingLineId(lineId);
    setCustomizingItem(item);
    setSelectedVariants(maps.selectedVariants);
    setSelectedModifiers(maps.selectedModifiers);
  }

  function handleAddItem(item) {
    if (isViewOnly) return;
    if (itemNeedsCustomization(item, globalModifiers || {})) {
      openCustomization(item);
      return;
    }

    closeCustomization();
    const variantMap = buildDefaultVariantSelections(item, globalVariants || {});
    const modifierMap = buildDefaultModifierSelections(
      item,
      globalModifiers || {},
    );
    const built = buildLineFromSelections(item, variantMap, modifierMap);
    addConfiguredLine(
      item,
      built.variantsPayload,
      built.modifiersPayload,
      built.price,
    );
  }

  function handleTabClick(tabId) {
    if (customizingItem) closeCustomization();
    setMenuSearchQuery("");
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
    if (lineId === optionsLineId) setOptionsLineId(null);
    if (lineId === noteLineId) setNoteLineId(null);
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
    if (isViewOnly) return;
    const nextTableNumber = disableTableNumberInput
      ? resolvedTableNumber
      : number;

    if (nextOrderType === "takeaway") {
      const tableRef = String(nextTableNumber || "").trim();
      if (hasTakeawayTableReference(tableRef)) {
        setTableNumber(tableRef);
        setOrderType("takeaway");
        setIsOrderTypeMissing(false);
        return;
      }
      pendingTakeawayRef.current = {
        tableNumber: nextTableNumber || "",
      };
      setIsTakeawayCustomerDrawerOpen(true);
      return;
    }

    setTableNumber(nextTableNumber || "");
    setOrderType(nextOrderType || null);
    if (nextOrderType) setIsOrderTypeMissing(false);
  }

  function handleTakeawayCustomerConfirm({ name, phone, email }) {
    const pending = pendingTakeawayRef.current;
    if (pending && pending.tableNumber != null && pending.tableNumber !== "") {
      setTableNumber(pending.tableNumber);
    }
    setCustomerName(String(name || "").trim());
    setCustomerPhone(String(phone || "").trim());
    setCustomerEmail(String(email || "").trim());
    setOrderType("takeaway");
    setIsOrderTypeMissing(false);
    setIsTakeawayCustomerDrawerOpen(false);
    pendingTakeawayRef.current = null;
  }

  function handleTakeawayCustomerClose() {
    setIsTakeawayCustomerDrawerOpen(false);
    pendingTakeawayRef.current = null;
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
    setTaxInvoiceNo("");
    setIsCheckPaid(false);
    setIsResumedCheck(false);
    setIsOrderTypeMissing(false);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setIsTakeawayCustomerDrawerOpen(false);
    pendingTakeawayRef.current = null;
    setCheckDiscount(null);
    setIsDiscountDrawerOpen(false);
    resumeLoadedRef.current = null;
    closeCustomization();
    setOptionsLineId(null);
    setNoteLineId(null);
  }

  function handleOpenDiscountDrawer() {
    if (isViewOnly) return;
    if (cartLines.length === 0) {
      showDismissibleToast("Add items before applying a discount");
      return;
    }
    setIsDiscountDrawerOpen(true);
  }

  function resolveCheckOrderIds() {
    return checkOrderIds.length > 0
      ? checkOrderIds
      : activeOrderId
        ? [activeOrderId]
        : [];
  }

  async function syncCheckDiscountToServer(discount) {
    const orderIds = resolveCheckOrderIds();
    if (orderIds.length === 0) return { success: true };

    return applyPosCheckDiscount({
      orderIds,
      discountAmount: discount?.discountAmount ?? 0,
      discountPercent: discount?.discountPercent ?? null,
      discountType: discount?.discountType ?? null,
    });
  }

  async function handleDiscountConfirm({
    discountAmount,
    discountPercent,
    discountType,
  }) {
    const previousDiscount = checkDiscount;
    const nextDiscount =
      discountAmount == null || Number(discountAmount) <= 0
        ? null
        : { discountAmount, discountPercent, discountType };

    setCheckDiscount(nextDiscount);
    setIsDiscountDrawerOpen(false);

    const orderIds = resolveCheckOrderIds();
    if (orderIds.length === 0) return;

    const result = await syncCheckDiscountToServer(nextDiscount);
    if (!result?.success) {
      setCheckDiscount(previousDiscount);
      showDismissibleToast(result?.error || "Failed to save discount");
    }
  }

  function handleGoToHeldOrders() {
    navigate("/pos/held");
  }

  function handleTrainingHold() {
    handleClearOrder();
    setTableNumber("");
    setOrderType(null);
    setIsPaymentDrawerOpen(false);
    toast.success("Training check cleared");
  }

  function handleFooterHold() {
    if (isTrainingMode) {
      handleTrainingHold();
      return;
    }
    if (restaurantMode) {
      handleClearOrder();
      setTableNumber("");
      setOrderType(null);
      setIsTablePrefilled(false);
      tablePrefilledRef.current = null;
      setKeypadDrawer(null);
      setIsPaymentDrawerOpen(false);
      navigate(getPosHomePath(menuConfig));
      return;
    }
    handleGoToHeldOrders();
  }

  function handleTrainingPaymentDone() {
    setIsPaymentDrawerOpen(false);
    toast.success("Training payment complete");
  }

  function markCartLinesSentLocally(sentLineIds) {
    setCartLines((prev) =>
      prev.map((line) =>
        sentLineIds.has(line.lineId)
          ? { ...line, kitchenStatus: "sent", isTrainingSent: true }
          : line,
      ),
    );
  }

  function handleLogoHome() {
    handleClearOrder();
    setTableNumber("");
    setOrderType(null);
    setIsTablePrefilled(false);
    tablePrefilledRef.current = null;
    setKeypadDrawer(null);
    setIsPaymentDrawerOpen(false);
    router.replace(getPosHomePath(menuConfig), { scroll: false });
  }

  async function sendUnsentLinesToKitchen({ showSuccessToast = true } = {}) {
    if (isViewOnly) {
      return { success: false, error: "Order is view only" };
    }
    if (isSending) {
      return { success: false, error: "Send already in progress" };
    }

    const unsentLines = cartLines.filter(isOpenCartLine);
    if (unsentLines.length === 0) {
      const existingOrderIds =
        checkOrderIds.length > 0
          ? checkOrderIds
          : activeOrderId
            ? [activeOrderId]
            : [];
      return { success: true, orderIds: existingOrderIds, skipped: true };
    }

    const mappedOrderType = mapPosOrderType(resolvedOrderType);
    if (!mappedOrderType) {
      nudgeTableFieldForMissingOrderType();
      return {
        success: false,
        validationBlocked: true,
        error: "Choose dine in or take away before sending",
      };
    }

    if (resolvedOrderType === "takeaway") {
      const hasTableReference = hasTakeawayTableReference(resolvedTableNumber);
      if (
        !hasTableReference &&
        (!customerName.trim() || !customerPhone.trim())
      ) {
        pendingTakeawayRef.current = {
          tableNumber: resolvedTableNumber || "",
        };
        setIsTakeawayCustomerDrawerOpen(true);
        showDismissibleToast("Enter customer name and phone for takeaway");
        return {
          success: false,
          validationBlocked: true,
          error: "Enter customer name and phone for takeaway",
        };
      }
    }

    setIsSending(true);
    try {
      const sentLineIds = new Set(unsentLines.map((line) => line.lineId));

      if (isTrainingMode) {
        const mockOrder = buildTrainingKitchenOrder({
          lines: unsentLines,
          orderType: resolvedOrderType,
          tableNumber: resolvedTableNumber,
        });

        try {
          await printKitchenOrder(mockOrder, {
            storeProfile,
            itemGroups,
            menuConfig,
            source: "pos_training",
            notify: true,
            notifySuccess: false,
          });
        } catch (printError) {
          console.error("POS training print error:", printError);
          return {
            success: false,
            error: printError?.message || "Failed to print training docket",
          };
        }

        markCartLinesSentLocally(sentLineIds);
        if (customizingLineId && sentLineIds.has(customizingLineId)) {
          closeCustomization();
        }
        if (showSuccessToast) {
          toast.success("Training docket sent to kitchen printers");
        }
        return { success: true, orderIds: [], training: true };
      }

      const payload = {
        orderType: mappedOrderType,
        items: buildPosSendItems(unsentLines),
      };
      if (resolvedPrimaryTable) payload.table = resolvedPrimaryTable;
      if (resolvedTableNames.length >= 2) payload.tables = resolvedTableNames;
      if (posCheckId) payload.posCheckId = posCheckId;
      if (customerName.trim()) payload.customerName = customerName.trim();
      if (customerPhone.trim()) payload.customerPhone = customerPhone.trim();
      if (customerEmail.trim()) payload.customerEmail = customerEmail.trim();

      if (isOfflineSendEnabled(menuConfig)) {
        const result = await queueOfflinePosSend(payload);
        if (!result?.success) {
          const error = result?.error || "Failed to save order on this device";
          showDismissibleToast(error);
          return { success: false, error };
        }

        if (result.posCheckId) setPosCheckId(result.posCheckId);
        setCartLines((prev) =>
          prev.map((line) =>
            sentLineIds.has(line.lineId)
              ? {
                  ...line,
                  kitchenStatus: "sent",
                  sourceOrderId: result.localId,
                }
              : line,
          ),
        );
        if (customizingLineId && sentLineIds.has(customizingLineId)) {
          closeCustomization();
        }
        if (showSuccessToast) {
          toast.success("Order sent to kitchen");
        }

        void printKitchenOrder(result.order, {
          storeProfile,
          itemGroups,
          menuConfig,
          source: "pos_send",
          notify: true,
          notifySuccess: false,
        }).catch((printError) => {
          console.error("POS offline send print error:", printError);
        });

        return {
          success: true,
          pendingSync: true,
          localId: result.localId,
          posCheckId: result.posCheckId,
          orderIds: [],
          order: result.order,
        };
      }

      const result = await sendPosOrder(payload);
      if (!result?.success || !result.order?._id) {
        const error = result?.error || "Failed to send order";
        showDismissibleToast(error);
        return { success: false, error };
      }

      const newOrderId = String(result.order._id);
      const nextCheckId =
        String(result.order?.posCheckId || "").trim() || posCheckId;

      setActiveOrderId(newOrderId);
      if (nextCheckId) setPosCheckId(nextCheckId);
      const nextTaxInvoiceNo = String(result.order?.taxInvoiceNo || "").trim();
      if (nextTaxInvoiceNo) setTaxInvoiceNo(nextTaxInvoiceNo);
      const nextCheckOrderIds = appendCheckOrderId(checkOrderIds, newOrderId);
      setCheckOrderIds(nextCheckOrderIds);
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
      if (showSuccessToast) {
        toast.success("Order sent to kitchen");
      }

      if (checkDiscount) {
        const discountResult = await applyPosCheckDiscount({
          orderIds: nextCheckOrderIds,
          discountAmount: checkDiscount.discountAmount ?? 0,
          discountPercent: checkDiscount.discountPercent ?? null,
          discountType: checkDiscount.discountType ?? null,
        });
        if (!discountResult?.success) {
          showDismissibleToast(
            discountResult?.error || "Discount could not be saved to the check",
          );
        }
      }

      // Print in background so payment/send UI is not blocked by TCP retries.
      void printKitchenOrder(result.order, {
        storeProfile,
        itemGroups,
        menuConfig,
        source: "pos_send",
        notify: true,
        notifySuccess: false,
      }).catch((printError) => {
        console.error("POS send print error:", printError);
      });

      return {
        success: true,
        orderIds: nextCheckOrderIds,
        order: result.order,
      };
    } catch (error) {
      const message = error?.message || "Failed to send order";
      showDismissibleToast(message);
      return { success: false, error: message };
    } finally {
      setIsSending(false);
    }
  }

  async function handleSendOrder() {
    if (isViewOnly || cartLines.length === 0 || isSending) return;

    const unsentLines = cartLines.filter(isOpenCartLine);
    if (unsentLines.length === 0) {
      showDismissibleToast("Nothing new to send");
      return;
    }

    await sendUnsentLinesToKitchen({ showSuccessToast: true });
  }

  async function handlePrintReceipt(paymentSummary) {
    if (isPrintingReceipt || isTrainingMode) return;

    const printableLines = cartLines.filter(
      (line) => !isCancelledCartLine(line),
    );
    if (printableLines.length === 0) {
      showDismissibleToast("Nothing on the check to print");
      return;
    }

    setIsPrintingReceipt(true);
    try {
      let invoiceForPrint = taxInvoiceNo;
      let linesForPrint = printableLines;

      // secondTest: local outbox has no taxInvoiceNo until this check is uploaded.
      if (isStoreSecondTest(menuConfig) && !invoiceForPrint) {
        if (printableLines.some(isOpenCartLine)) {
          const sendResult = await sendUnsentLinesToKitchen({
            showSuccessToast: false,
          });
          if (!sendResult?.success) {
            showDismissibleToast(
              sendResult?.error || "Failed to print receipt",
            );
            return;
          }
          if (sendResult.localId) {
            linesForPrint = printableLines.map((line) =>
              isOpenCartLine(line)
                ? { ...line, sourceOrderId: sendResult.localId }
                : line,
            );
          }
        }

        const localIds = [
          ...new Set(
            [
              ...checkOrderIds.map((id) => String(id || "").trim()),
              ...linesForPrint.map((line) =>
                String(line.sourceOrderId || "").trim(),
              ),
              activeOrderId ? String(activeOrderId).trim() : "",
            ].filter((id) => id && !isMongoObjectId(id)),
          ),
        ];

        if (localIds.length > 0) {
          // Quiet: keep localIds on the cart so Complete Sale can still queue pay.
          const syncResult = await syncLocalTicketsForInvoice(localIds, {
            notify: false,
          });
          if (!syncResult?.success) {
            showDismissibleToast(
              syncResult?.error || "Failed to print receipt",
            );
            return;
          }
          invoiceForPrint = String(syncResult.taxInvoiceNo || "").trim();
          if (invoiceForPrint) {
            setTaxInvoiceNo((prev) => prev || invoiceForPrint);
          }
          if (!invoiceForPrint) {
            showDismissibleToast("Failed to print receipt");
            return;
          }
        }
      }

      const payload = buildTaxInvoiceReceiptFromPosCheck({
        storeProfile,
        cartLines: linesForPrint,
        orderType: resolvedOrderType,
        tableNumber: resolvedTableNumber,
        paymentSummary,
        taxInvoiceNo: invoiceForPrint,
        discount: footerDiscount,
      });

      const result = await printTaxInvoiceReceipt(payload);

      if (result.success) {
        toast.success(result.message);
      } else {
        showDismissibleToast(result.message || "Failed to print receipt");
      }
    } catch (error) {
      showDismissibleToast(error?.message || "Failed to print receipt");
    } finally {
      setIsPrintingReceipt(false);
    }
  }

  async function persistOfflineSale(paymentSummary, { orderIdsToComplete, hasUnsentToSend }) {
    const mongoId = (id) => /^[a-f0-9]{24}$/i.test(String(id || "").trim());
    const localIds = new Set();
    const serverIds = new Set(orderIdsToComplete.filter(mongoId));

    for (const line of cartLines) {
      if (isCancelledCartLine(line)) continue;
      const sourceId = String(line.sourceOrderId || "").trim();
      if (!sourceId) continue;
      if (mongoId(sourceId)) serverIds.add(sourceId);
      else localIds.add(sourceId);
    }
    if (activeOrderId) {
      if (mongoId(activeOrderId)) serverIds.add(activeOrderId);
      else localIds.add(activeOrderId);
    }

    if (hasUnsentToSend) {
      const sendResult = await sendUnsentLinesToKitchen({
        showSuccessToast: false,
      });
      if (!sendResult?.success) {
        return {
          success: false,
          error: sendResult?.error || "Failed to save order before payment",
        };
      }
      if (sendResult.training) {
        return {
          success: false,
          error: "Training mode does not save payments",
        };
      }
      if (sendResult.localId) localIds.add(sendResult.localId);
      for (const id of sendResult.orderIds || []) {
        if (mongoId(id)) serverIds.add(id);
      }
    }

    // Print-before-complete may have remapped cart lines to Mongo ids — recover
    // the original localIds so the pay outbox still ties to local_orders.
    if (localIds.size === 0 && serverIds.size > 0) {
      const recovered = await lookupLocalIdsByServerOrderIds([...serverIds]);
      for (const id of recovered) localIds.add(id);
    }

    const queued = await queueOfflinePosPayment({
      localIds: [...localIds],
      orderIds: [...serverIds],
      method: paymentSummary.method,
      amountTendered: Number(paymentSummary.amountTendered || 0),
      changeDue: Number(paymentSummary.change || 0),
      processingFee: Number(paymentSummary.processingFee || 0),
      ...(checkDiscount?.discountAmount > 0 && checkDiscount?.discountType
        ? {
            discountAmount: checkDiscount.discountAmount,
            discountPercent: checkDiscount.discountPercent ?? null,
            discountType: checkDiscount.discountType,
          }
        : {}),
    });
    if (!queued?.success) {
      return {
        success: false,
        error: queued?.error || "Failed to save payment on this device",
      };
    }

    // Print already uploaded the send (unpaid). Push this tender now so the
    // check is not left unpaid on the server — only when tickets are already synced.
    // Card: always sync on Complete Sale so Tax Invoice exists without printing.
    const isCard = paymentSummary.method === "credit-card";
    const shouldSyncNow =
      isStoreSecondTest(menuConfig) &&
      localIds.size > 0 &&
      (isCard || (await localTicketsAlreadySynced([...localIds])));

    if (shouldSyncNow) {
      const paySync = await syncLocalTicketsForInvoice([...localIds], {
        notify: false,
      });
      if (!paySync?.success) {
        return {
          success: false,
          error: paySync?.error || "Failed to sync payment",
        };
      }
      const invoice = String(paySync.taxInvoiceNo || "").trim();
      if (invoice) setTaxInvoiceNo((prev) => prev || invoice);
      return {
        success: true,
        pendingSync: false,
        taxInvoiceNo: invoice || undefined,
      };
    }

    return { success: true, pendingSync: true };
  }

  async function persistPosSale(paymentSummary) {
    if (!paymentSummary?.method) {
      return { success: false, error: "Payment method is required" };
    }

    let orderIdsToComplete =
      checkOrderIds.length > 0
        ? checkOrderIds
        : activeOrderId
          ? [activeOrderId]
          : [];

    const hasUnsentToSend = cartLines.some(isOpenCartLine);
    if (isOfflineSendEnabled(menuConfig)) {
      return persistOfflineSale(paymentSummary, {
        orderIdsToComplete,
        hasUnsentToSend,
      });
    }

    if (hasUnsentToSend || orderIdsToComplete.length === 0) {
      const sendResult = await sendUnsentLinesToKitchen({
        showSuccessToast: false,
      });
      if (!sendResult?.success) {
        return {
          success: false,
          error: sendResult?.error || "Failed to send order before payment",
        };
      }
      if (sendResult.training) {
        return {
          success: false,
          error: "Training mode does not save payments",
        };
      }
      if (Array.isArray(sendResult.orderIds) && sendResult.orderIds.length > 0) {
        orderIdsToComplete = sendResult.orderIds;
      }
    }

    if (orderIdsToComplete.length === 0) {
      return {
        success: false,
        error: "Send the order before completing payment",
      };
    }

    const payload = {
      orderIds: orderIdsToComplete,
      method: paymentSummary.method,
      amountTendered: Number(paymentSummary.amountTendered || 0),
      changeDue: Number(paymentSummary.change || 0),
      processingFee: Number(paymentSummary.processingFee || 0),
    };

    if (checkDiscount?.discountAmount > 0 && checkDiscount?.discountType) {
      payload.discountAmount = checkDiscount.discountAmount;
      payload.discountPercent = checkDiscount.discountPercent ?? null;
      payload.discountType = checkDiscount.discountType;
    }

    return completePosSaleBatch(payload);
  }

  function clearTableMergeAfterPayment() {
    const seatNames = parsePosTableNames(resolvedTableNumber);
    if (seatNames.length === 0) return;
    clearPosTableMergeGroupsForTables(
      storeProfile?.menuLink || "default",
      seatNames,
    );
  }

  function resetAfterSale() {
    clearTableMergeAfterPayment();
    setCartLines([]);
    setActiveOrderId(null);
    setCheckOrderIds([]);
    setPosCheckId(null);
    setTaxInvoiceNo("");
    setIsCheckPaid(false);
    setIsResumedCheck(false);
    setTableNumber("");
    setOrderType(null);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setIsTakeawayCustomerDrawerOpen(false);
    pendingTakeawayRef.current = null;
    setIsTablePrefilled(false);
    tablePrefilledRef.current = null;
    setKeypadDrawer(null);
    setCheckDiscount(null);
    setIsDiscountDrawerOpen(false);
    resumeLoadedRef.current = null;
    closeCustomization();
    setOptionsLineId(null);
    setNoteLineId(null);
    setIsPaymentDrawerOpen(false);
    if (restaurantMode) {
      router.replace(getPosHomePath(menuConfig));
    }
  }

  async function handlePersistSale(paymentSummary) {
    if (isTrainingMode) return { success: false };

    setIsCompletingSale(true);
    try {
      const result = await persistPosSale(paymentSummary);
      if (!result?.success) {
        showDismissibleToast(result?.error || "Failed to complete sale");
        return { success: false };
      }
      toast.success("Sale completed");
      return { success: true };
    } catch (error) {
      showDismissibleToast(error?.message || "Failed to complete sale");
      return { success: false };
    } finally {
      setIsCompletingSale(false);
    }
  }

  function handleFinishPaidSale() {
    resetAfterSale();
  }

  async function handleCompleteSale(paymentSummary) {
    if (isTrainingMode) return;

    if (isCompletingSale) return;

    setIsCompletingSale(true);
    try {
      const result = await persistPosSale(paymentSummary);
      if (!result?.success) {
        showDismissibleToast(result?.error || "Failed to complete sale");
        return;
      }

      resetAfterSale();
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
    if (isExternalContextCartLine(line)) {
      showDismissibleToast("QR order items cannot be voided from POS");
      return;
    }
    setCancelSentLineDrawer({ show: true, line });
  }

  async function handleConfirmCancelSentLine(reason) {
    const line = cancelSentLineDrawer.line;
    if (!line || isVoidingLine) return;

    if (isTrainingMode) {
      if (isExternalContextCartLine(line)) {
        showDismissibleToast("Void is not available for QR order items");
        return;
      }
      showDismissibleToast("Void is not available in training mode");
      return;
    }

    if (isExternalContextCartLine(line)) {
      showDismissibleToast("QR order items cannot be voided from POS");
      return;
    }

    const orderId = String(line.sourceOrderId || "").trim();
    if (!orderId) {
      showDismissibleToast("Cannot void item — missing order reference");
      return;
    }

    setIsVoidingLine(true);
    try {
      const result = await cancelPosOrderItem({
        orderId,
        lineId: line.sourceLineId || line.lineId,
        reason,
      });
      if (!result?.success) {
        showDismissibleToast(result?.error || "Failed to void item");
        return;
      }

      const cancelledAt = result.item?.cancelledAt || new Date().toISOString();
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

    const hasPayableLines = cartLines.some(
      (line) => !isCancelledCartLine(line),
    );

    // Pay-first: allow opening payment before Send; complete sale sends then pays.
    if (isPayFirstMode) {
      if (!hasPayableLines) {
        showDismissibleToast("Add items before payment");
        return;
      }
      setIsPaymentDrawerOpen(true);
      return;
    }

    if (isTrainingMode) {
      if (!cartLines.some(isSentCartLine)) {
        showDismissibleToast("Send to kitchen before payment");
        return;
      }
      setIsPaymentDrawerOpen(true);
      return;
    }

    if (checkOrderIds.length === 0) {
      showDismissibleToast("Send the order before payment");
      return;
    }
    setIsPaymentDrawerOpen(true);
  }

  const keypadInitialNumber =
    keypadDrawer?.mode === "quantity"
      ? keypadDrawer.initialNumber
      : resolvedTableNumber;

  const activeCartLine = customizingLineId
    ? cartLines.find((line) => line.lineId === customizingLineId)
    : null;
  const panelSelections = activeCartLine
    ? selectionMapsFromLine(activeCartLine, customizingItem)
    : { selectedVariants, selectedModifiers };

  const cartSubtotal = cartLines.reduce((sum, line) => {
    if (!isPayableCartLine(line)) return sum;
    return sum + Number(line.price || 0) * (line.quantity || 1);
  }, 0);
  const discountAmount =
    checkDiscount?.discountAmount != null &&
    Number(checkDiscount.discountAmount) > 0
      ? Number(checkDiscount.discountAmount)
      : null;
  const footerDiscount =
    discountAmount != null
      ? {
          amount: discountAmount,
          type: checkDiscount?.discountType || null,
          percent:
            checkDiscount?.discountType === "percent"
              ? checkDiscount?.discountPercent
              : null,
        }
      : null;
  const cartTotalAfterDiscount = Math.max(
    0,
    cartSubtotal - (discountAmount || 0),
  );
  const discountInitialDigits =
    checkDiscount?.discountType === "percent" &&
    checkDiscount?.discountPercent != null
      ? String(checkDiscount.discountPercent)
      : checkDiscount?.discountType === "dollar" &&
          checkDiscount?.discountAmount != null
        ? String(checkDiscount.discountAmount)
        : "";
  const hasUnsentLines = cartLines.some(isOpenCartLine);
  const hasSentLines = cartLines.some(isSentCartLine);
  const hasPayableLines = cartLines.some(isPayableCartLine);

  useEffect(() => {
    const snapshot = buildCustomerDisplayCartSnapshot({
      cartLines,
      isPayableLine: isPayableCartLine,
      subtotal: cartSubtotal,
      discountAmount: discountAmount || 0,
      total: cartTotalAfterDiscount,
    });
    updateCustomerDisplayCart(snapshot).catch(() => {});
  }, [cartLines, cartSubtotal, discountAmount, cartTotalAfterDiscount]);

  useEffect(() => {
    return () => {
      updateCustomerDisplayCart({ mode: "idle", lines: [] }).catch(() => {});
    };
  }, []);

  const canOpenPayment = isPayFirstMode
    ? hasPayableLines
    : isTrainingMode
      ? hasSentLines
      : checkOrderIds.length > 0;

  return (
    <>
      <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#e8e8e8] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <PosChromeHeader
          onLogoClick={handleLogoHome}
          onOpenCashDrawer={handleOpenCashDrawer}
        />

        {isTrainingMode ? (
          <div className="shrink-0 bg-amber-400 px-4 py-2 text-center text-sm font-semibold uppercase tracking-wide text-amber-950">
            Training mode
          </div>
        ) : null}

        {linklyCardEnabled ? (
          <LinklyFailedSaleBanner
            outcome={linklyFailedOutcome}
            onDismiss={async () => {
              await clearLinklyLastTxnOutcome();
              setLinklyFailedOutcome(null);
            }}
            isReprintPending={isLinklyReprintPending}
            onReprint={async () => {
              if (!linklyFailedOutcome || isLinklyReprintPending) return;
              setIsLinklyReprintPending(true);
              try {
                const result = await printLinklyTxnReceipt(
                  {
                    txnRef: linklyFailedOutcome.txnRef,
                    sessionId: linklyFailedOutcome.sessionId,
                    outcome: linklyFailedOutcome.outcome,
                    success: false,
                    responseCode: linklyFailedOutcome.responseCode,
                    responseText: linklyFailedOutcome.responseText,
                    amtPurchase: linklyFailedOutcome.amountCents,
                  },
                  storeProfile || {},
                  { documentTitle: "CARD RESULT (FAILED)" },
                );
                if (result?.success) {
                  showDismissibleToast(
                    `Reprinted · TxnRef ${linklyFailedOutcome.txnRef || "—"}`,
                  );
                } else {
                  showDismissibleToast(
                    result?.message || "Reprint failed",
                  );
                }
              } catch (error) {
                showDismissibleToast(
                  error?.message || "Reprint failed",
                );
              } finally {
                setIsLinklyReprintPending(false);
              }
            }}
          />
        ) : null}

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Left: current order */}
          <section className="flex w-[34%] min-w-[280px] max-w-[440px] shrink-0 flex-col bg-white pb-[env(safe-area-inset-bottom)]">
            <div className="relative z-20 flex shrink-0 items-stretch border-neutral-200 bg-[#f2f2f2] p-2">
              <motion.button
                key={tableFieldShakeKey}
                type="button"
                onClick={() => {
                  if (isTableFieldLocked) return;
                  setKeypadDrawer({
                    mode: "table",
                    disableNumberInput: disableTableNumberInput,
                    initialNumber: resolvedTableNumber,
                  });
                }}
                disabled={isTableFieldLocked}
                initial={{ x: 0 }}
                animate={
                  tableFieldShakeKey > 0
                    ? { x: [0, -6, 6, -4, 4, 0] }
                    : { x: 0 }
                }
                transition={{ duration: 0.35, ease: "easeInOut" }}
                className={cn(
                  "flex min-h-[52px] w-full items-center justify-center rounded-md bg-white px-4 text-base font-semibold transition-shadow hover:bg-neutral-50 active:bg-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-800",
                  awaitingOrderType
                    ? isOrderTypeMissing
                      ? "bg-red-50 text-red-700 shadow-[0_4px_14px_rgba(239,68,68,0.35)]"
                      : "font-bold text-[#301C0F] shadow-[0_4px_14px_rgba(48,28,15,0.28)]"
                    : "text-neutral-700 shadow-[0_0_0_1px_#d4d4d4]",
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
              disableNumberInput={Boolean(keypadDrawer?.disableNumberInput)}
              onConfirm={handleKeypadConfirm}
            />

            <PosTakeawayCustomerDrawer
              isOpen={isTakeawayCustomerDrawerOpen}
              onClose={handleTakeawayCustomerClose}
              onConfirm={handleTakeawayCustomerConfirm}
              initialName={customerName}
              initialPhone={customerPhone}
              initialEmail={customerEmail}
            />

            <PosDiscountDrawer
              isOpen={isDiscountDrawerOpen}
              onClose={() => setIsDiscountDrawerOpen(false)}
              subtotal={cartSubtotal}
              initialDigits={discountInitialDigits}
              onConfirm={handleDiscountConfirm}
            />

            <PosItemNoteDrawer
              isOpen={Boolean(noteLineId)}
              onClose={handleCloseItemNoteDrawer}
              onSave={handleSaveItemNote}
              itemTitle={
                noteLineId
                  ? cartLines.find((line) => line.lineId === noteLineId)
                      ?.title || ""
                  : ""
              }
              initialNote={
                noteLineId
                  ? cartLines.find((line) => line.lineId === noteLineId)
                      ?.notes || ""
                  : ""
              }
              initialIsTakeaway={
                noteLineId
                  ? Boolean(
                      cartLines.find((line) => line.lineId === noteLineId)
                        ?.isTakeaway,
                    )
                  : false
              }
            />

            <PosPaymentDrawer
              isOpen={isPaymentDrawerOpen}
              onClose={() => setIsPaymentDrawerOpen(false)}
              amountDue={cartTotalAfterDiscount}
              onCompleteSale={handleCompleteSale}
              onPersistSale={handlePersistSale}
              onFinishPaidSale={handleFinishPaidSale}
              onPrintReceipt={handlePrintReceipt}
              isPrintingReceipt={isPrintingReceipt}
              isCompletingSale={isCompletingSale}
              trainingMode={isTrainingMode}
              onTrainingDone={handleTrainingPaymentDone}
              tyroCardEnabled={tyroCardEnabled}
              tyroConfig={tyroPayments}
              linklyCardEnabled={linklyCardEnabled}
              linklyConfig={linklyPayments}
              onOpenCashDrawer={handleOpenCashDrawer}
            />

            <div
              className={cn(
                "min-h-0 flex-1 overflow-y-auto bg-[#f2f2f2] transition-opacity duration-300",
                awaitingOrderType && "pointer-events-none opacity-35",
              )}
            >
              {isResumingOrder ? (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-neutral-400">
                  Loading held order…
                </div>
              ) : cartLines.length === 0 ? (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-neutral-400">
                  {awaitingOrderType
                    ? "Choose dine in or take away to start"
                    : "Tap products to add them to this order"}
                </div>
              ) : (
                <LayoutGroup id="pos-cart-lines">
                  <ul>
                    <AnimatePresence initial={false} mode="popLayout">
                      {cartLines.map((line, index) => (
                        <PosCartLine
                          key={posCartLineReactKey(line, index)}
                          line={line}
                          enterAnimation={enteringLineIds.has(line.lineId)}
                          onEnterAnimationComplete={() =>
                            clearEnteringLine(line.lineId)
                          }
                          isActive={line.lineId === customizingLineId}
                          readOnly={isViewOnly}
                          allowVoidSentLine={
                            !isViewOnly &&
                            !isTrainingMode &&
                            !isExternalContextCartLine(line)
                          }
                          useKitchenPrintAliases={useKitchenPrintAliases}
                          isOptionsOpen={optionsLineId === line.lineId}
                          onOptionsOpenChange={(open) =>
                            handleCartLineOptionsOpenChange(line.lineId, open)
                          }
                          onOptionsClick={handleCartLineOptionsClick}
                          onSelect={handleSelectCartLine}
                          onQtyClick={handleQtyClick}
                          onRemoveLine={handleRemoveLine}
                          onVoidSentLine={handleVoidSentLine}
                          onRemoveVariant={handleRemoveVariant}
                          onRemoveModifier={handleRemoveModifier}
                        />
                      ))}
                    </AnimatePresence>
                  </ul>
                </LayoutGroup>
              )}
            </div>

            <PosOrderPanelFooter
              subtotal={cartSubtotal}
              discount={footerDiscount}
              taxPercentage={storeProfile.taxPercentage}
              hasUnsentItems={hasUnsentLines}
              viewOnly={isViewOnly}
              onClear={handleClearOrder}
              onHold={handleFooterHold}
              onSend={handleSendOrder}
              onDiscount={handleOpenDiscountDrawer}
              className={cn(
                "transition-opacity duration-300",
                awaitingOrderType && "pointer-events-none opacity-35",
              )}
            />
          </section>

          {/* Right: POS menu layout (tabs + products) */}
          <section
            className={cn(
              "flex min-w-0 flex-1 transition-opacity duration-300",
              awaitingOrderType && "pointer-events-none opacity-35",
            )}
          >
            {/* Tabs column — z-30 + overhang so selected indicator sits on top of products */}
            <aside className="relative z-30 flex w-[120px] shrink-0 flex-col bg-[#f0f0f0] pb-[env(safe-area-inset-bottom)] sm:w-[150px]">
              <div className="-mr-3 min-h-0 flex-1 overflow-y-auto pr-3">
                {tabs.length === 0 ? (
                  <div className="p-3 text-center text-xs text-neutral-500">
                    No POS tabs yet. Configure Menu layout in admin.
                  </div>
                ) : (
                  <div className="flex min-h-full flex-col">
                    {tabs.map((tab, index) => {
                      const isSelected = tab.id === selectedTabId;
                      const isAboveSelected =
                        selectedTabIndex >= 0 && index === selectedTabIndex - 1;
                      const isBelowSelected =
                        selectedTabIndex >= 0 && index === selectedTabIndex + 1;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => handleTabClick(tab.id)}
                          className={cn(
                            "relative flex min-h-[72px] w-full shrink-0 items-center justify-start overflow-hidden border-l-[7px] px-3 py-6 text-left text-base font-semibold text-neutral-900 xl:text-lg",
                            isSelected
                              ? "bg-[#f0f0f0]"
                              : "bg-white hover:bg-neutral-50",
                            isAboveSelected && "rounded-br-2xl",
                            isBelowSelected && "rounded-tr-2xl",
                            isSelected || customizingItem ? "z-20" : undefined,
                          )}
                          style={{
                            borderLeftColor: tab.backgroundColor || "#d9d9d9",
                          }}
                        >
                          <span className="line-clamp-2 pr-5 leading-tight">
                            {tab.name}
                          </span>
                          {isSelected ? (
                            <motion.span
                              layoutId="pos-tab-check"
                              initial={{ scale: 0.6, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={POS_TAB_CHECK_TRANSITION}
                              className="pointer-events-none absolute right-0 top-1/2 z-20 flex size-6 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full bg-red-500 text-white shadow-md ring-2 ring-white"
                            >
                              <Check size={14} strokeWidth={3} />
                            </motion.span>
                          ) : null}
                        </button>
                      );
                    })}
                    <div
                      aria-hidden="true"
                      className={cn(
                        "min-h-0 flex-1 border-l-[7px] border-l-gray-200 bg-white",
                        selectedTabIndex === tabs.length - 1 &&
                          "rounded-tr-2xl",
                      )}
                    />
                  </div>
                )}
              </div>

              <div className="shrink-0">
                <button
                  type="button"
                  aria-label="Pay"
                  onClick={handleOpenPayment}
                  disabled={
                    isViewOnly ||
                    !canOpenPayment ||
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
              <PosMenuSearch
                query={menuSearchQuery}
                onQueryChange={setMenuSearchQuery}
                disabled={isViewOnly || awaitingOrderType}
              />
              <AnimatePresence mode="wait" initial={false}>
                {customizingItem && isOpenCartLine(activeCartLine) ? (
                  <motion.div
                    key={`customize-${customizingLineId}`}
                    {...getPosPanelMotionProps(panelTransitionDirection)}
                    className="h-full min-h-0"
                  >
                    <PosItemCustomizePanel
                      item={customizingItem}
                      globalModifiers={globalModifiers || {}}
                      globalVariants={globalVariants || {}}
                      selectedVariants={panelSelections.selectedVariants}
                      selectedModifiers={panelSelections.selectedModifiers}
                      useKitchenPrintAliases={useKitchenPrintAliases}
                      onSelectVariant={handleSelectVariant}
                      onToggleModifier={handleToggleModifier}
                    />
                  </motion.div>
                ) : isMenuSearchActive ? (
                  <motion.div
                    key={`search-${trimmedMenuSearchQuery}`}
                    {...getPosPanelMotionProps(panelTransitionDirection)}
                    className="h-full overflow-y-auto pt-16"
                  >
                    <div className="border-b border-neutral-200/80 px-4 pb-3 pt-1">
                      <h2 className="text-lg font-semibold text-neutral-900 xl:text-xl">
                        Results for &ldquo;{trimmedMenuSearchQuery}&rdquo;
                      </h2>
                      {menuSearchResults.length > 0 ? (
                        <p className="mt-0.5 text-sm text-neutral-500">
                          {menuSearchResults.length} product
                          {menuSearchResults.length === 1 ? "" : "s"}
                        </p>
                      ) : null}
                    </div>
                    {menuSearchResults.length === 0 ? (
                      <div className="flex h-[calc(100%-4.5rem)] items-center justify-center px-6 text-center text-sm text-neutral-500">
                        No products match your search
                      </div>
                    ) : (
                      <div className="p-4">
                        <div className="grid grid-cols-4 gap-1 xl:grid-cols-5">
                          {menuSearchResults.map((item) => (
                            <PosProductCard
                              key={item.id}
                              item={item}
                              onAdd={handleAddItem}
                              disabled={isViewOnly}
                              useKitchenPrintAliases={useKitchenPrintAliases}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ) : !selectedTab ? (
                  <motion.div
                    key="pos-tab-empty"
                    {...getPosPanelMotionProps(panelTransitionDirection)}
                    className="flex h-full items-center justify-center text-sm text-neutral-500"
                  >
                    Select a tab
                  </motion.div>
                ) : selectedRows.length === 0 ? (
                  <motion.div
                    key={`${selectedTabId}-empty`}
                    {...getPosPanelMotionProps(panelTransitionDirection)}
                    className="flex h-full items-center justify-center text-sm text-neutral-500"
                  >
                    This tab has no products yet
                  </motion.div>
                ) : (
                  <motion.div
                    key={selectedTabId}
                    {...getPosPanelMotionProps(panelTransitionDirection)}
                    className="h-full overflow-y-auto"
                  >
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
                                useKitchenPrintAliases={useKitchenPrintAliases}
                              />
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>
        </div>
      </div>
      <DismissibleToast
        toast={dismissibleToast}
        onDismiss={hideDismissibleToast}
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
        useKitchenPrintAliases={useKitchenPrintAliases}
      />
    </>
  );
}
