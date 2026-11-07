"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays, format, startOfDay } from "date-fns";
import { App } from "@capacitor/app";
import { usePosNavigate } from "@/components/context/PosNavigateContext";
import { Combine, Map as MapIcon, ShoppingBag, X } from "lucide-react";
import toast from "react-hot-toast";
import { useMenuContext } from "@/components/context/MenuContext";
import {
  fetchBookings,
  completePosSaleBatch,
  fetchPosHeldOrders,
  fetchPosResumeOrders,
  fetchManualOpenTables,
  openManualTable,
  closeManualTable,
  mergePosTables,
  unmergePosTables,
  markOrderPayLater,
  updateOrderStatus,
} from "@/lib/api/fetchApi";
import {
  markPosBillPrintedMixed,
  updateHeldCheckStatusMixed,
} from "@/lib/localDb/localHeldActions";
import { isNativeApp } from "@/lib/helper/platformDetection";
import { isCounterPayment, isPayLaterAtCounterEnabled } from "@/lib/helper/payLater";
import {
  drawerEntryHasQrContext,
  findHeldOrderForTableMap,
  findPosHeldOrderForTable,
  getDrawerPayableOrderIds,
  getDrawerPosOrderIds,
} from "@/lib/pos/posTableMapHeld";
import {
  canSendTableMapToKitchen,
  getDrawerKitchenCandidateOrderIds,
  getDrawerUnpaidCounterQrOrderIds,
  hasTableMapKitchenInProgress,
  resolveTableMapDrawerPaymentActions,
} from "@/lib/pos/posTableMapKitchen";
import {
  buildSelfOrderTableIndicatorKeys,
  buildUnpaidQrPaymentTableIndicatorKeys,
} from "@/lib/pos/posTableMapSelfOrder";
import {
  getAllTicketIds,
  getTicketIdsNotDelivered,
  isPosSourceHeldOrder,
} from "@/lib/pos/posHeldOrder";
import {
  printBillForHeldCheck,
  printHeldCheckKitchenOnPrepare,
  reprintHeldCheckKitchen,
} from "@/lib/pos/posHeldOrderPrint";
import {
  groupOrdersByPaidSale,
  printReceiptForHistoryCheck,
} from "@/lib/pos/posHistoryOrderPrint";
import {
  buildHeldDrawerPreviewSections,
  buildHeldDrawerSurchargeLines,
} from "@/lib/pos/posHeldDrawerPreview";
import {
  getPosTableMapLegendStatuses,
  getPosTableMapStatusFill,
  POS_TABLE_MAP_STATUS_LABEL,
} from "@/lib/pos/posTableMapStatus";
import {
  confirmPosTableMerge,
  findMergeGroupForTable,
  getHeldMergeStrokeColor,
  getMergeGroupColorMap,
  heldEntryTableNames,
  loadPosTableMergeGroups,
  removeGroupsOverlappingTables,
  removeMergeGroupContainingTable,
  savePosTableMergeGroups,
} from "@/lib/pos/posTableMapMerge";
import {
  TABLE_MAP_FLOOR_COLOR,
  getTableMapTableName,
  normalizeTableMapTableName,
} from "@/lib/pos/posTableMaps";
import { resolvePosConfig } from "@/lib/pos/posConfig";
import { startedAtForTableNames } from "@/lib/pos/tableOpenDuration";
import {
  isLinklyPosCardReady,
  isTyroPosCardReady,
  resolvePosPaymentsConfig,
} from "@/lib/pos/posPaymentsConfig";
import PosChromeHeader from "./PosChromeHeader";
import PosPaymentDrawer from "./PosPaymentDrawer";
import PosTableMapFloor from "./PosTableMapFloor";
import PosTableMapTableDrawer from "./PosTableMapTableDrawer";
import PosTableMapUndoMergeModal from "./PosTableMapUndoMergeModal";
import DeleteOrderDrawer from "./DeleteOrderDrawer";
import DismissibleToast, {
  useDismissibleToast,
} from "@/components/orderManager/DismissibleToast";
import { usePosOpenCashDrawer } from "./usePosOpenCashDrawer";
import { hydrateHeldOrders, hydrateResumeOrders } from "@/lib/localDb/posLiveSnapshot";

const TABLE_MAP_POLL_MS = 10000;
const BOOKING_INDICATOR_WINDOW_MS = 60 * 60 * 1000;
const TABLE_MAP_MERGE_FLOOR_COLOR = "#1e293b";

function isBookingIndicatorCurrent(startsAt, now) {
  const start = new Date(startsAt).getTime();
  if (Number.isNaN(start)) return false;
  return now <= start + BOOKING_INDICATOR_WINDOW_MS;
}

function orderIdsCacheKey(orderIds) {
  return (orderIds || []).map(String).join(",");
}

function ticketsStatusKey(heldOrder) {
  return (heldOrder?.tickets || [])
    .map((ticket) => `${ticket.orderId}:${String(ticket.status || "").trim()}`)
    .join(",");
}

function shouldPrepareOrderAfterPosPay(order) {
  if (!order) return false;
  if (String(order?.source || "").trim() === "pos") return false;
  if (!isCounterPayment(order?.paymentMethod)) return false;
  const status = String(order?.status || "").trim();
  return ["pending", "confirmed", "accepted"].includes(status);
}

export default function PosTableMap() {
  const { navigate, isPending } = usePosNavigate();
  const { handleOpenCashDrawer } = usePosOpenCashDrawer();
  const { posTableMaps, storeProfile, menuConfig, itemGroups, menuContent } =
    useMenuContext();
  const legendStatuses = useMemo(() => getPosTableMapLegendStatuses(), []);
  const mergeStoreKey = storeProfile?.menuLink || "default";
  const {
    toast: dismissibleToast,
    showToast: showDismissibleToast,
    hideToast: hideDismissibleToast,
  } = useDismissibleToast();
  const tableMaps = useMemo(() => {
    return [...(posTableMaps || [])].sort((a, b) => {
      return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    });
  }, [posTableMaps]);
  const [selectedMapId, setSelectedMapId] = useState(null);
  const [heldOrders, setHeldOrders] = useState([]);
  const [openTableRounds, setOpenTableRounds] = useState([]);
  const [isManualDrawer, setIsManualDrawer] = useState(false);
  const [isManualTableSaving, setIsManualTableSaving] = useState(false);
  const [todayBookings, setTodayBookings] = useState([]);
  const [now, setNow] = useState(() => Date.now());
  const [drawerTableName, setDrawerTableName] = useState(null);
  const [drawerHeldOrder, setDrawerHeldOrder] = useState(null);
  const [tenderTarget, setTenderTarget] = useState(null);
  const [isCompletingSale, setIsCompletingSale] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewSections, setPreviewSections] = useState([]);
  const [previewSurchargeLines, setPreviewSurchargeLines] = useState([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [deleteDrawerOpen, setDeleteDrawerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMergeMode, setIsMergeMode] = useState(false);
  const [mergeSelectedNames, setMergeSelectedNames] = useState([]);
  const [mergeGroups, setMergeGroups] = useState([]);
  const [undoMergeTarget, setUndoMergeTarget] = useState(null);
  const [isUndoingMerge, setIsUndoingMerge] = useState(false);
  const [navigatingTableNames, setNavigatingTableNames] = useState([]);
  /** @type {React.MutableRefObject<Map<string, object[]>>} */
  const resumeOrdersCacheRef = useRef(new Map());

  const selectedMap =
    tableMaps.find((map) => map.id === selectedMapId) || tableMaps[0] || null;

  const selfOrderTableKeys = useMemo(
    () => buildSelfOrderTableIndicatorKeys(heldOrders),
    [heldOrders],
  );
  const isPayFirstMode = Boolean(
    resolvePosConfig(menuConfig).payFirstModeEnabled,
  );
  const takeawayButtonLabel =
    resolvePosConfig(menuConfig).dineInUseBuzzer &&
    resolvePosConfig(menuConfig).takeawayRequireBuzzer
      ? "Takeaway / Dine-in"
      : "Takeaway";
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
  const unpaidQrPaymentTableKeys = useMemo(
    () =>
      buildUnpaidQrPaymentTableIndicatorKeys(heldOrders, {
        payFirstMode: isPayFirstMode,
      }),
    [heldOrders, isPayFirstMode],
  );
  const bookingsByTableKey = useMemo(() => {
    const map = new Map();
    const sorted = todayBookings
      .filter((booking) => isBookingIndicatorCurrent(booking.startsAt, now))
      .sort(
        (left, right) =>
          new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
      );
    for (const booking of sorted) {
      const startsAt = new Date(booking.startsAt);
      const timeLabel = format(startsAt, "h:mm a");
      for (const label of booking.assignedTables || []) {
        const key = normalizeTableMapTableName(label);
        if (!key) continue;
        const list = map.get(key) || [];
        if (list.some((item) => item.id === booking.id)) continue;
        list.push({ id: booking.id, timeLabel });
        map.set(key, list);
      }
    }
    return map;
  }, [todayBookings, now]);
  const drawerBookings = useMemo(() => {
    const key = normalizeTableMapTableName(drawerTableName);
    if (!key) return [];
    return todayBookings
      .filter(
        (booking) =>
          isBookingIndicatorCurrent(booking.startsAt, now) &&
          (booking.assignedTables || []).some(
            (label) => normalizeTableMapTableName(label) === key,
          ),
      )
      .sort(
        (left, right) =>
          new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
      );
  }, [todayBookings, drawerTableName, now]);

  const mergeColorByTableName = useMemo(() => {
    const map = getMergeGroupColorMap(mergeGroups);
    for (const entry of heldOrders || []) {
      const heldColor = getHeldMergeStrokeColor(entry);
      if (!heldColor) continue;
      for (const name of heldEntryTableNames(entry)) {
        const key = normalizeTableMapTableName(name);
        if (key) map.set(key, heldColor);
      }
    }
    return map;
  }, [mergeGroups, heldOrders]);

  useEffect(() => {
    setMergeGroups(loadPosTableMergeGroups(mergeStoreKey, selectedMap));
  }, [mergeStoreKey, selectedMap]);

  // Paid multi-seat checks dissolve local merge borders.
  useEffect(() => {
    const paidSeats = [];
    for (const entry of heldOrders || []) {
      if (!entry?.allPaid) continue;
      paidSeats.push(...heldEntryTableNames(entry));
    }
    if (paidSeats.length === 0) return;

    setMergeGroups((prev) => {
      const next = removeGroupsOverlappingTables(prev, paidSeats);
      if (next.length === prev.length) return prev;
      savePosTableMergeGroups(mergeStoreKey, next);
      return next;
    });
  }, [heldOrders, mergeStoreKey]);

  useEffect(() => {
    if (!tableMaps.length) {
      setSelectedMapId(null);
      return;
    }
    if (!tableMaps.some((map) => map.id === selectedMapId)) {
      setSelectedMapId(tableMaps[0].id);
    }
  }, [tableMaps, selectedMapId]);

  const loadHeldOrders = useCallback(async ({ paintLocalFirst = false } = {}) => {
    try {
      await hydrateHeldOrders(() => fetchPosHeldOrders(), {
        paintLocalFirst,
        onHeld: (next) => setHeldOrders(next),
      });
    } catch {
      // Silent refresh; table map still works for new orders.
    }
  }, []);

  useEffect(() => {
    const timerId = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timerId);
  }, []);

  const bookingEnabled = Boolean(menuConfig?.bookingEnabled);
  const posTableConfig = resolvePosConfig(menuConfig);
  const manualOpenTableEnabled = posTableConfig.manualOpenTableEnabled === true;
  const manualCloseTableEnabled =
    posTableConfig.manualCloseTableEnabled === true;
  const tableTimerEnabled = manualOpenTableEnabled || manualCloseTableEnabled;
  const openRoundTableKeys = useMemo(() => {
    if (!tableTimerEnabled) return new Set();
    const keys = new Set();
    for (const round of openTableRounds) {
      for (const name of round?.tables || []) {
        const key = normalizeTableMapTableName(name);
        if (key) keys.add(key);
      }
    }
    return keys;
  }, [tableTimerEnabled, openTableRounds]);

  const loadOpenTableRounds = useCallback(async () => {
    if (!tableTimerEnabled) {
      setOpenTableRounds([]);
      return;
    }
    try {
      const result = await fetchManualOpenTables();
      if (result?.success) setOpenTableRounds(result.rounds || []);
    } catch {
      // Floor still shows checks if this list cannot be loaded.
    }
  }, [tableTimerEnabled]);

  const drawerOpenedAt = useMemo(() => {
    if (!tableTimerEnabled || !drawerTableName) return null;
    const names = drawerHeldOrder
      ? heldEntryTableNames(drawerHeldOrder)
      : [drawerTableName];
    const fromRound = startedAtForTableNames(
      openTableRounds,
      names.length ? names : [drawerTableName],
    );
    if (fromRound) return fromRound;
    return drawerHeldOrder?.heldAt || drawerHeldOrder?.createdAt || null;
  }, [tableTimerEnabled, drawerTableName, drawerHeldOrder, openTableRounds]);

  const loadTodayBookings = useCallback(async () => {
    if (!bookingEnabled) {
      setTodayBookings([]);
      return;
    }
    try {
      const start = startOfDay(new Date());
      const result = await fetchBookings({
        status: "confirmed",
        from: start.toISOString(),
        to: addDays(start, 1).toISOString(),
      });
      setTodayBookings(result?.bookings || []);
    } catch {
      // Floor status still works if bookings cannot be loaded.
    }
  }, [bookingEnabled]);

  // Held-order dots only — self-order alerts/auto-print come from SelfOrderAlertsHost.
  useEffect(() => {
    let intervalId = null;
    let cancelled = false;

    const clearPollInterval = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const startPollInterval = () => {
      clearPollInterval();
      intervalId = setInterval(() => {
        if (!cancelled) {
          void loadHeldOrders();
          void loadTodayBookings();
          void loadOpenTableRounds();
        }
      }, TABLE_MAP_POLL_MS);
    };

    const resumePolling = () => {
      if (cancelled) return;
      void loadHeldOrders({ paintLocalFirst: true });
      void loadTodayBookings();
      void loadOpenTableRounds();
      startPollInterval();
    };

    const pausePolling = () => {
      clearPollInterval();
    };

    resumePolling();

    if (isNativeApp()) {
      let listenerHandle = null;
      App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) resumePolling();
        else pausePolling();
      }).then((handle) => {
        if (cancelled) {
          handle.remove();
          return;
        }
        listenerHandle = handle;
      });

      return () => {
        cancelled = true;
        clearPollInterval();
        if (listenerHandle) listenerHandle.remove();
      };
    }

    const handleVisibilityChange = () => {
      if (document.hidden) pausePolling();
      else resumePolling();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      cancelled = true;
      clearPollInterval();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadHeldOrders, loadTodayBookings, loadOpenTableRounds]);

  useEffect(() => {
    if (!isPending) {
      setNavigatingTableNames([]);
    }
  }, [isPending]);

  // Drop resume caches for checks that are no longer held (or whose ticket set changed).
  useEffect(() => {
    const validKeys = new Set(
      (heldOrders || [])
        .map((entry) => orderIdsCacheKey(entry?.orderIds))
        .filter(Boolean),
    );
    for (const key of [...resumeOrdersCacheRef.current.keys()]) {
      if (!validKeys.has(key)) resumeOrdersCacheRef.current.delete(key);
    }
  }, [heldOrders]);

  // Keep open drawer entry in sync when held poll refreshes this table.
  useEffect(() => {
    if (!drawerTableName) return;
    const latest = findHeldOrderForTableMap(heldOrders, drawerTableName);
    if (!latest) {
      if (isManualDrawer) return;
      if (isProcessing) return;
      const key = normalizeTableMapTableName(drawerTableName);
      if (manualCloseTableEnabled && openRoundTableKeys.has(key)) {
        setIsManualDrawer(true);
        setDrawerHeldOrder(null);
        setPreviewSections([]);
        setPreviewSurchargeLines([]);
        setPreviewError(null);
        setIsPreviewLoading(false);
        return;
      }
      setDrawerTableName(null);
      setDrawerHeldOrder(null);
      setIsManualDrawer(false);
      return;
    }
    if (isManualDrawer) setIsManualDrawer(false);
    setDrawerHeldOrder((prev) => {
      if (
        prev &&
        orderIdsCacheKey(prev.orderIds) === orderIdsCacheKey(latest.orderIds) &&
        orderIdsCacheKey(prev.posOrderIds) ===
          orderIdsCacheKey(latest.posOrderIds) &&
        orderIdsCacheKey(prev.qrOrderIds) ===
          orderIdsCacheKey(latest.qrOrderIds) &&
        Number(prev.total) === Number(latest.total) &&
        Number(prev.amountDue) === Number(latest.amountDue) &&
        Boolean(prev.allPaid) === Boolean(latest.allPaid) &&
        Boolean(prev.posAllPaid) === Boolean(latest.posAllPaid) &&
        ticketsStatusKey(prev) === ticketsStatusKey(latest)
      ) {
        return prev;
      }
      return latest;
    });
  }, [
    heldOrders,
    drawerTableName,
    isProcessing,
    isManualDrawer,
    manualCloseTableEnabled,
    openRoundTableKeys,
  ]);

  const drawerOrderIdsKey = orderIdsCacheKey(drawerHeldOrder?.orderIds);

  useEffect(() => {
    if (!drawerTableName || !drawerOrderIdsKey) {
      setPreviewSections([]);
      setPreviewSurchargeLines([]);
      setPreviewError(null);
      setIsPreviewLoading(false);
      return;
    }

    const orderIds = drawerOrderIdsKey.split(",");
    const cached = resumeOrdersCacheRef.current.get(drawerOrderIdsKey);
    const applyPreview = (orders) => {
      resumeOrdersCacheRef.current.set(drawerOrderIdsKey, orders);
      setPreviewSections(buildHeldDrawerPreviewSections(orders));
      setPreviewSurchargeLines(buildHeldDrawerSurchargeLines(orders));
      setPreviewError(null);
      setIsPreviewLoading(false);
    };

    if (cached) applyPreview(cached);

    let cancelled = false;
    if (!cached) {
      setIsPreviewLoading(true);
      setPreviewError(null);
    }

    (async () => {
      try {
        const result = await hydrateResumeOrders(
          orderIds,
          (ids) => fetchPosResumeOrders(ids),
          {
            onOrders: (orders) => {
              if (!cancelled) applyPreview(orders);
            },
          },
        );
        if (cancelled) return;
        if (!cached && (!result?.success || !result.orders?.length) && !result?.fromCache) {
          setPreviewSections([]);
          setPreviewSurchargeLines([]);
          setPreviewError(result?.error || "Could not load items");
          setIsPreviewLoading(false);
        }
      } catch (error) {
        if (cancelled || cached) return;
        setPreviewSections([]);
        setPreviewSurchargeLines([]);
        setPreviewError(error?.message || "Could not load items");
        setIsPreviewLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [drawerTableName, drawerOrderIdsKey]);

  function handleCloseDrawer() {
    if (isProcessing || isManualTableSaving) return;
    setDrawerTableName(null);
    setDrawerHeldOrder(null);
    setIsManualDrawer(false);
    setPreviewSections([]);
    setPreviewSurchargeLines([]);
    setPreviewError(null);
    setIsPreviewLoading(false);
  }

  function handleTakeaway() {
    navigate("/pos?orderType=takeaway");
  }

  function handleEnterMergeMode() {
    handleCloseDrawer();
    setMergeSelectedNames([]);
    setUndoMergeTarget(null);
    setIsMergeMode(true);
  }

  async function handleExitMergeMode() {
    if (undoMergeTarget || isUndoingMerge) return;
    if (mergeSelectedNames.length >= 2) {
      const openChecks = [];
      const seenCheckKeys = new Set();
      for (const name of mergeSelectedNames) {
        const held = findPosHeldOrderForTable(heldOrders, name);
        if (!held?.orderIds?.length) continue;
        const key =
          String(held.posCheckId || "").trim() ||
          orderIdsCacheKey(held.orderIds);
        if (seenCheckKeys.has(key)) continue;
        seenCheckKeys.add(key);
        openChecks.push(held);
      }

      if (openChecks.length > 1) {
        showDismissibleToast(
          "Cannot merge tables that already have different open checks",
        );
        return;
      }

      const result = confirmPosTableMerge(mergeGroups, mergeSelectedNames);
      if (result.merged) {
        const mergedGroup = result.groups[result.groups.length - 1];
        if (openChecks.length === 1) {
          const check = openChecks[0];
          const apiResult = await mergePosTables({
            tables: mergedGroup.tableNames,
            orderIds: check.orderIds,
            posCheckId: check.posCheckId || undefined,
          });
          if (!apiResult?.success) {
            showDismissibleToast(apiResult?.error || "Failed to merge tables");
            return;
          }
          await loadHeldOrders();
          await loadOpenTableRounds();
        }
        setMergeGroups(result.groups);
        savePosTableMergeGroups(mergeStoreKey, result.groups);
        toast.success("Tables merged");
      }
    } else if (mergeSelectedNames.length === 1) {
      showDismissibleToast("Select at least two tables to merge");
      return;
    }
    setMergeSelectedNames([]);
    setUndoMergeTarget(null);
    setIsMergeMode(false);
  }

  function handleToggleMergeMode() {
    if (isMergeMode) handleExitMergeMode();
    else handleEnterMergeMode();
  }

  function openUndoMergeForTable(tableName) {
    const localGroup = findMergeGroupForTable(mergeGroups, tableName);
    const heldOrder = findPosHeldOrderForTable(heldOrders, tableName);
    const heldTables = heldEntryTableNames(heldOrder);
    const isHeldMultiSeat = heldTables.length >= 2;

    if (!localGroup && !isHeldMultiSeat) return false;

    const tableNames =
      localGroup?.tableNames?.length >= 2
        ? localGroup.tableNames
        : isHeldMultiSeat
          ? heldTables
          : [];
    if (tableNames.length < 2) return false;

    const keepTable = String(heldOrder?.table || tableNames[0] || "").trim();
    setUndoMergeTarget({
      tableNames,
      keepTable: isHeldMultiSeat ? keepTable : "",
      heldOrder: isHeldMultiSeat ? heldOrder : null,
    });
    return true;
  }

  async function handleConfirmUndoMerge() {
    if (!undoMergeTarget || isUndoingMerge) return;

    const { tableNames, keepTable, heldOrder } = undoMergeTarget;
    setIsUndoingMerge(true);
    try {
      if (heldOrder?.orderIds?.length) {
        const keep = String(
          keepTable || heldOrder.table || tableNames[0] || "",
        ).trim();
        if (!keep) {
          showDismissibleToast(
            "Could not determine which table keeps the check",
          );
          return;
        }
        const apiResult = await unmergePosTables({
          keepTable: keep,
          orderIds: heldOrder.orderIds,
          posCheckId: heldOrder.posCheckId || undefined,
        });
        if (!apiResult?.success) {
          showDismissibleToast(apiResult?.error || "Failed to undo merge");
          return;
        }
        await loadHeldOrders();
      }

      setMergeGroups((prev) => {
        const next = removeMergeGroupContainingTable(prev, tableNames[0]);
        savePosTableMergeGroups(mergeStoreKey, next);
        return next;
      });
      setMergeSelectedNames((prev) =>
        prev.filter(
          (name) =>
            !tableNames.some(
              (seat) =>
                normalizeTableMapTableName(seat) ===
                normalizeTableMapTableName(name),
            ),
        ),
      );
      setUndoMergeTarget(null);
      toast.success("Merge undone");
    } catch (error) {
      showDismissibleToast(error?.message || "Failed to undo merge");
    } finally {
      setIsUndoingMerge(false);
    }
  }

  function handleTableSelect(object) {
    const tableName = getTableMapTableName(object);
    if (!tableName) {
      showDismissibleToast("This table has no name configured");
      return;
    }

    if (isMergeMode) {
      if (openUndoMergeForTable(tableName)) return;

      setMergeSelectedNames((prev) => {
        const key = normalizeTableMapTableName(tableName);
        const exists = prev.some(
          (name) => normalizeTableMapTableName(name) === key,
        );
        if (exists) {
          return prev.filter(
            (name) => normalizeTableMapTableName(name) !== key,
          );
        }
        return [...prev, tableName];
      });
      return;
    }

    const heldOrder = findHeldOrderForTableMap(heldOrders, tableName);
    if (!heldOrder) {
      const hasOpenRound = openRoundTableKeys.has(
        normalizeTableMapTableName(tableName),
      );
      if (manualOpenTableEnabled || hasOpenRound) {
        setIsManualDrawer(true);
        setDrawerTableName(tableName);
        setDrawerHeldOrder(null);
        setPreviewSections([]);
        setPreviewSurchargeLines([]);
        setPreviewError(null);
        setIsPreviewLoading(false);
        return;
      }
      const localGroup = findMergeGroupForTable(mergeGroups, tableName);
      const seatNames = localGroup?.tableNames?.length
        ? localGroup.tableNames
        : [tableName];
      const params = new URLSearchParams({ orderType: "dine-in" });
      if (seatNames.length >= 2) {
        params.set("tables", seatNames.join(","));
      } else {
        params.set("table", seatNames[0]);
      }
      setNavigatingTableNames(seatNames);
      navigate(`/pos?${params.toString()}`);
      return;
    }

    setIsManualDrawer(false);
    setDrawerTableName(tableName);
    setDrawerHeldOrder(heldOrder);
    const cacheKey = orderIdsCacheKey(heldOrder.orderIds);
    const cached = resumeOrdersCacheRef.current.get(cacheKey);
    if (cached) {
      setPreviewSections(buildHeldDrawerPreviewSections(cached));
      setPreviewSurchargeLines(buildHeldDrawerSurchargeLines(cached));
      setPreviewError(null);
      setIsPreviewLoading(false);
    } else {
      setPreviewSections([]);
      setPreviewSurchargeLines([]);
      setPreviewError(null);
      setIsPreviewLoading(true);
    }
  }

  function navigateDineInTables(seatNames) {
    const names = (seatNames || [])
      .map((name) => String(name || "").trim())
      .filter(Boolean);
    if (names.length === 0) return;
    const params = new URLSearchParams({ orderType: "dine-in" });
    if (names.length >= 2) {
      params.set("tables", names.join(","));
    } else {
      params.set("table", names[0]);
    }
    setNavigatingTableNames(names);
    navigate(`/pos?${params.toString()}`);
  }

  function openNewOrderForTable(tableName) {
    const localGroup = findMergeGroupForTable(mergeGroups, tableName);
    const seatNames = localGroup?.tableNames?.length
      ? localGroup.tableNames
      : [tableName];
    navigateDineInTables(seatNames);
  }

  async function handleOpenTableManually() {
    const tableName = String(drawerTableName || "").trim();
    if (!tableName || isManualTableSaving) return;
    setIsManualTableSaving(true);
    try {
      const result = await openManualTable(tableName);
      if (!result?.success) {
        showDismissibleToast(result?.error || "Could not open table");
        return;
      }
      const openedName = result.table || tableName;
      const openedKey = normalizeTableMapTableName(openedName);
      setOpenTableRounds((prev) => {
        const exists = prev.some((round) =>
          (round.tables || []).some(
            (name) => normalizeTableMapTableName(name) === openedKey,
          ),
        );
        if (exists) return prev;
        return [
          ...prev,
          {
            tables: [openedName],
            startedAt: result.startedAt || new Date().toISOString(),
          },
        ];
      });
    } finally {
      setIsManualTableSaving(false);
    }
  }

  async function handleCloseTableManually() {
    const tableName = String(drawerTableName || "").trim();
    if (!tableName || isManualTableSaving) return;
    setIsManualTableSaving(true);
    try {
      const result = await closeManualTable(tableName);
      if (!result?.success) {
        showDismissibleToast(result?.error || "Could not close table");
        return;
      }
      const key = normalizeTableMapTableName(tableName);
      setOpenTableRounds((prev) =>
        prev.filter(
          (round) =>
            !(round.tables || []).some(
              (name) => normalizeTableMapTableName(name) === key,
            ),
        ),
      );
      setDrawerTableName(null);
      setDrawerHeldOrder(null);
      setIsManualDrawer(false);
    } finally {
      setIsManualTableSaving(false);
    }
  }

  function openNewTableTicket() {
    const seatNames = heldEntryTableNames(drawerHeldOrder);
    navigateDineInTables(
      seatNames.length > 0
        ? seatNames
        : drawerTableName
          ? [drawerTableName]
          : [],
    );
  }

  function handleLoadOrder() {
    if (!drawerHeldOrder?.orderIds?.length) return;

    // Unpaid QR counter tickets stay as their own check. Open starts a new
    // POS ticket, or resumes an existing POS check without the QR order.
    const counterQrIds = new Set(
      getDrawerUnpaidCounterQrOrderIds(drawerHeldOrder),
    );
    const payableOrderIds = getDrawerPayableOrderIds(drawerHeldOrder).filter(
      (id) => !counterQrIds.has(id),
    );
    if (payableOrderIds.length === 0) {
      openNewTableTicket();
      return;
    }

    navigate(
      `/pos?resume=${encodeURIComponent(payableOrderIds.join(","))}`,
    );
  }

  function handlePay() {
    const payableOrderIds = getDrawerPayableOrderIds(drawerHeldOrder);
    if (payableOrderIds.length === 0) {
      showDismissibleToast("This check is already paid");
      return;
    }

    const counterQrIds = getDrawerUnpaidCounterQrOrderIds(drawerHeldOrder);
    const qrIdSet = new Set(counterQrIds);
    const posPayableIds = payableOrderIds.filter((id) => !qrIdSet.has(id));

    // QR counter cash/card: tender on the table map. Do not open the POS menu.
    if (counterQrIds.length > 0 && posPayableIds.length === 0) {
      setTenderTarget({
        orderIds: counterQrIds,
        amountDue: Number(
          drawerHeldOrder?.amountDue ?? drawerHeldOrder?.total ?? 0,
        ),
      });
      handleCloseDrawer();
      return;
    }

    const resumeIds = posPayableIds.length > 0 ? posPayableIds : payableOrderIds;
    navigate(
      `/pos?resume=${encodeURIComponent(resumeIds.join(","))}&pay=1`,
    );
  }

  async function prepareQrCounterOrdersAfterPay(orders) {
    if (!isPayFirstMode) return;

    const toPrepare = (orders || []).filter(shouldPrepareOrderAfterPosPay);
    if (toPrepare.length === 0) return;

    const preparedIds = [];
    for (const order of toPrepare) {
      try {
        const updated = await updateOrderStatus(order._id, "preparing");
        preparedIds.push(String(updated?._id || order._id));
      } catch (error) {
        console.error(
          `[table-map pay] Failed to prepare QR order ${order._id}:`,
          error,
        );
      }
    }

    if (preparedIds.length === 0 || !storeProfile) return;

    try {
      await printHeldCheckKitchenOnPrepare(orders, preparedIds, {
        storeProfile,
        itemGroups,
        menuConfig,
        menuContent,
      });
    } catch (error) {
      console.error("[table-map pay] Kitchen print after QR pay failed:", error);
    }
  }

  async function persistTableQrSale(paymentSummary) {
    const target = tenderTarget;
    if (!target?.orderIds?.length) {
      return { success: false, error: "No order to pay" };
    }
    if (!paymentSummary?.method) {
      return { success: false, error: "Payment method is required" };
    }

    setIsCompletingSale(true);
    try {
      const result = await completePosSaleBatch({
        orderIds: target.orderIds,
        method: paymentSummary.method,
        amountTendered: Number(paymentSummary.amountTendered || 0),
        changeDue: Number(paymentSummary.change || 0),
        processingFee: Number(paymentSummary.processingFee || 0),
      });
      if (!result?.success) {
        showDismissibleToast(result?.error || "Failed to complete sale");
        return { success: false };
      }

      await prepareQrCounterOrdersAfterPay(result.orders);
      toast.success("Sale completed");
      await loadHeldOrders();
      await loadOpenTableRounds();
      return { success: true };
    } catch (error) {
      showDismissibleToast(error?.message || "Failed to complete sale");
      return { success: false };
    } finally {
      setIsCompletingSale(false);
    }
  }

  async function handleTableQrCompleteSale(paymentSummary) {
    const result = await persistTableQrSale(paymentSummary);
    if (!result?.success) return;
    setTenderTarget(null);
  }

  function handleTableQrFinishPaidSale() {
    setTenderTarget(null);
  }

  async function handleSendToKitchen() {
    if (!drawerHeldOrder?.orderIds?.length || isProcessing) return;
    if (!canSendTableMapToKitchen(drawerHeldOrder, menuConfig)) {
      showDismissibleToast("Cannot send this order to kitchen yet");
      return;
    }

    const candidateIds = getDrawerKitchenCandidateOrderIds(drawerHeldOrder);
    if (candidateIds.length === 0) {
      showDismissibleToast("No tickets to send to kitchen");
      return;
    }

    setIsProcessing(true);
    try {
      const orders = await loadDrawerCheckOrders();
      if (!orders) return;

      const byId = new Map(
        orders.map((order) => [String(order._id), order]),
      );
      const payLaterEnabled = isPayLaterAtCounterEnabled(menuConfig);

      for (const orderId of candidateIds) {
        const order = byId.get(String(orderId));
        if (!order) continue;

        const isPaid =
          String(order.paymentStatus || "").trim() === "paid";
        const status = String(order.status || "").trim();
        const isPending = status === "pending";

        // Serve-first / !payFirst: mark pay-later when the store supports it.
        if (!isPaid && payLaterEnabled && !order.isPayLater) {
          await markOrderPayLater(orderId, payLaterEnabled);
        }

        // Confirm pending before prepare (paid, or unpaid send-first from table map).
        if (isPending) {
          try {
            const confirmed = await updateOrderStatus(orderId, "confirmed");
            byId.set(String(orderId), confirmed);
          } catch (statusError) {
            console.error(
              `Failed to confirm order ${orderId} before kitchen:`,
              statusError,
            );
          }
        }
      }

      const prepareIds = candidateIds.filter((orderId) => {
        const order = byId.get(String(orderId));
        if (!order) return false;
        const status = String(order.status || "").trim();
        return ["confirmed", "accepted", "pending"].includes(status);
      });

      if (prepareIds.length === 0) {
        showDismissibleToast("No tickets to send to kitchen");
        return;
      }

      const result = await updateHeldCheckStatusMixed({
        orderIds: prepareIds,
        status: "preparing",
      });
      if (!result?.success) {
        showDismissibleToast(result?.error || "Failed to send to kitchen");
        return;
      }

      toast.success("Sent to kitchen");
      await loadHeldOrders();
      handleCloseDrawer();

      void (async () => {
        try {
          await printHeldCheckKitchenOnPrepare(
            [...byId.values()],
            prepareIds,
            {
              storeProfile,
              itemGroups,
              menuConfig,
              menuContent,
            },
          );
        } catch (error) {
          console.error("[table-map] Kitchen print failed:", error);
        }
      })();
    } catch (error) {
      showDismissibleToast(error?.message || "Failed to send to kitchen");
    } finally {
      setIsProcessing(false);
    }
  }

  async function loadDrawerCheckOrders() {
    if (!drawerHeldOrder?.orderIds?.length) return null;

    const cacheKey = orderIdsCacheKey(drawerHeldOrder.orderIds);
    let orders = resumeOrdersCacheRef.current.get(cacheKey);
    if (!orders?.length) {
      const result = await hydrateResumeOrders(
        drawerHeldOrder.orderIds,
        (ids) => fetchPosResumeOrders(ids),
        {
          onOrders: (next) => {
            orders = next;
            resumeOrdersCacheRef.current.set(cacheKey, next);
          },
        },
      );
      if (!orders?.length) {
        showDismissibleToast(result?.error || "Could not load check");
        return null;
      }
    }
    setPreviewSections(buildHeldDrawerPreviewSections(orders));
    setPreviewSurchargeLines(buildHeldDrawerSurchargeLines(orders));
    setPreviewError(null);
    return orders;
  }

  async function handlePrintBill() {
    if (!drawerHeldOrder?.orderIds?.length || isProcessing) return;

    const printInvoice = Boolean(drawerHeldOrder.allPaid);
    const posOrderIds = getDrawerPosOrderIds(drawerHeldOrder);
    if (!printInvoice && posOrderIds.length === 0) {
      showDismissibleToast("Print bill is only available for POS checks");
      return;
    }

    setIsProcessing(true);
    try {
      const orders = await loadDrawerCheckOrders();
      if (!orders) return;

      if (printInvoice) {
        const groups = groupOrdersByPaidSale(orders);
        for (const group of groups) {
          const result = await printReceiptForHistoryCheck(group, {
            storeProfile,
            menuConfig,
          });
          if (!result.success) {
            showDismissibleToast(result.message || "Failed to print invoice");
            return;
          }
        }
        toast.success(groups.length > 1 ? "Invoices printed" : "Invoice printed");
        return;
      }

      const posOrders = orders.filter(
        (order) => String(order?.source || "").trim() === "pos",
      );
      if (posOrders.length === 0) {
        showDismissibleToast("Print bill is only available for POS checks");
        return;
      }

      const printResult = await printBillForHeldCheck(posOrders, {
        storeProfile,
        menuConfig,
      });

      if (printResult.success) {
        toast.success(printResult.message || "Bill printed");
        const markResult = await markPosBillPrintedMixed(posOrderIds);
        if (!markResult?.success) {
          showDismissibleToast(
            markResult?.error || "Bill printed, but status was not updated",
          );
        } else {
          await loadHeldOrders();
        }
        handleCloseDrawer();
      } else {
        showDismissibleToast(printResult.message || "Failed to print bill");
      }
    } catch (error) {
      showDismissibleToast(error?.message || "Failed to print bill");
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleReprintOrder() {
    // Don't hold isProcessing — kitchen print monitors success/failure itself
    // and should not block drawer close or other status actions.
    if (!drawerHeldOrder?.orderIds?.length || isProcessing) return;

    const toastId = toast.loading("Reprinting order…");
    try {
      const orders = await loadDrawerCheckOrders();
      if (!orders) {
        toast.dismiss(toastId);
        return;
      }

      const result = await reprintHeldCheckKitchen(orders, {
        storeProfile,
        itemGroups,
        menuConfig,
        menuContent,
      });

      if (result.success) {
        toast.success(result.message || "Kitchen ticket reprinted", {
          id: toastId,
        });
      } else {
        toast.dismiss(toastId);
        showDismissibleToast(result.message || "Failed to reprint order");
      }
    } catch (error) {
      toast.dismiss(toastId);
      showDismissibleToast(error?.message || "Failed to reprint order");
    }
  }

  function buildTableDeleteTarget(order) {
    const posOrderIds = getDrawerPosOrderIds(order);
    const ticketIds =
      posOrderIds.length > 0 ? posOrderIds : getAllTicketIds(order);
    const tableNames = heldEntryTableNames(order);
    const table =
      tableNames.length > 1
        ? tableNames.join(", ")
        : String(order?.table || drawerTableName || "").trim();
    const taxInvoiceNo = String(order?.taxInvoiceNo || "").trim();
    const isPaid =
      order?.posAllPaid === true ||
      (isPosSourceHeldOrder(order) && order.allPaid) ||
      (posOrderIds.length === 0 && Boolean(order?.allPaid));
    const title = table
      ? `Cancel Table ${table}`
      : taxInvoiceNo
        ? `Cancel invoice ${taxInvoiceNo}`
        : "Cancel held check";

    const subtitleParts = [];
    if (ticketIds.length > 1) {
      subtitleParts.push(`${ticketIds.length} tickets`);
    }
    if (order?.total != null) {
      subtitleParts.push(
        `$${Number(order.total).toFixed(2)} ${isPaid ? "paid" : "unpaid"}`,
      );
    }
    if (drawerEntryHasQrContext(order) && posOrderIds.length > 0) {
      subtitleParts.push("POS tickets only");
    }
    if (isPaid) subtitleParts.push("Refund manually if needed");

    return {
      id: order.id,
      title,
      subtitle: subtitleParts.join(" · ") || "This will cancel the open check.",
      orderIds: ticketIds,
      ticketCount: ticketIds.length,
      keepLabel: "Keep order",
      confirmLabel: "Confirm cancel",
      processingLabel: "Cancelling…",
      otherPlaceholder: "Describe why this order is being cancelled",
      warningMessage: isPaid
        ? "This order is already paid. You'll need to process a refund manually. This will cancel the order and cannot be undone."
        : `This will cancel ${
            ticketIds.length === 1
              ? "this order"
              : `these ${ticketIds.length} tickets`
          }. This action cannot be undone.`,
    };
  }

  function handleDeleteOrder() {
    if (!drawerHeldOrder || isProcessing || isDeleting) return;

    const ticketIds = buildTableDeleteTarget(drawerHeldOrder).orderIds;
    if (ticketIds.length === 0) {
      showDismissibleToast("No tickets on this check");
      return;
    }

    setDeleteTarget(buildTableDeleteTarget(drawerHeldOrder));
    setDeleteDrawerOpen(true);
  }

  async function handleConfirmDeleteOrder(cancelReason) {
    if (!deleteTarget?.orderIds?.length || isDeleting) return;

    setIsDeleting(true);
    setIsProcessing(true);
    try {
      const result = await updateHeldCheckStatusMixed({
        orderIds: deleteTarget.orderIds,
        status: "cancelled",
        cancelReason,
        requireCancelReason: true,
      });
      if (!result?.success) {
        showDismissibleToast(result?.error || "Failed to cancel order");
        return;
      }

      toast.success(
        deleteTarget.orderIds.length === 1
          ? "Order cancelled"
          : "Check cancelled",
      );
      setDeleteDrawerOpen(false);
      setDeleteTarget(null);
      handleCloseDrawer();
      await loadHeldOrders();
      await loadOpenTableRounds();
    } catch (error) {
      showDismissibleToast(error?.message || "Failed to cancel order");
    } finally {
      setIsDeleting(false);
      setIsProcessing(false);
    }
  }

  async function markUndeliveredTicketsServed(successMessage) {
    if (!drawerHeldOrder || isProcessing) return;

    const ticketIds = getTicketIdsNotDelivered(drawerHeldOrder);
    if (ticketIds.length === 0) {
      showDismissibleToast("No tickets to update");
      return;
    }

    setIsProcessing(true);
    try {
      const result = await updateHeldCheckStatusMixed({
        orderIds: ticketIds,
        status: "delivered",
      });
      if (!result?.success) {
        showDismissibleToast(result?.error || "Failed to update tickets");
        return;
      }
      toast.success(successMessage);
      await loadHeldOrders();
      await loadOpenTableRounds();
    } catch (error) {
      showDismissibleToast(error?.message || "Failed to update tickets");
    } finally {
      setIsProcessing(false);
    }
  }

  function handleAllServed() {
    return markUndeliveredTicketsServed("All Served");
  }

  function handleComplete() {
    return markUndeliveredTicketsServed("Order completed");
  }

  const kitchenInProgress = hasTableMapKitchenInProgress(drawerHeldOrder);
  // Pending/confirmed QR has not been sent to kitchen — All Served N/A.
  const showAllServed =
    kitchenInProgress && !Boolean(drawerHeldOrder?.allPaid);
  const showComplete =
    kitchenInProgress && Boolean(drawerHeldOrder?.allPaid);
  // Always allow Open so staff can add more on a paid-but-not-complete table.
  const showLoadOrder = Boolean(drawerHeldOrder?.orderIds?.length);
  const { showPay, showSendToKitchen } = resolveTableMapDrawerPaymentActions(
    drawerHeldOrder,
    menuConfig,
  );
  const mapFloorColor = isMergeMode
    ? TABLE_MAP_MERGE_FLOOR_COLOR
    : TABLE_MAP_FLOOR_COLOR;

  return (
    <>
      <DismissibleToast
        toast={dismissibleToast}
        onDismiss={hideDismissibleToast}
      />

      <div
        className="flex h-[100dvh] w-full flex-col overflow-hidden pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
        style={{ backgroundColor: mapFloorColor }}
      >
        <PosChromeHeader onOpenCashDrawer={handleOpenCashDrawer} />

        {selectedMap ? (
          <div className="relative min-h-0 flex-1 overflow-hidden pb-[env(safe-area-inset-bottom)]">
            {tableMaps.length > 1 ? (
              <div className="pointer-events-none absolute bottom-3 left-4 z-20">
                <div className="pointer-events-auto flex shrink-0 space-x-1 rounded-xl bg-[#402e22] p-1 shadow-sm ring-1 ring-white/10">
                  {tableMaps.map((map) => {
                    const isActive = map.id === selectedMap.id;
                    return (
                      <button
                        key={map.id}
                        type="button"
                        onClick={() => setSelectedMapId(map.id)}
                        className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 xl:text-base ${
                          isActive
                            ? "bg-brand_accent text-white shadow-sm"
                            : "text-white hover:bg-gray-50 hover:text-gray-800"
                        }`}
                      >
                        {map.name?.trim() || "Untitled map"}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className="pointer-events-none absolute bottom-3 right-4 z-20">
              <div className="pointer-events-auto flex shrink-0 space-x-1 rounded-xl bg-[#402e22]/95 p-1 shadow-sm ring-1 ring-white/10">
                <button
                  type="button"
                  onClick={handleTakeaway}
                  className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 xl:text-base"
                >
                  <ShoppingBag className="size-4 shrink-0" aria-hidden />
                  {takeawayButtonLabel}
                </button>
                <button
                  type="button"
                  onClick={handleToggleMergeMode}
                  className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 xl:text-base"
                >
                  {isMergeMode ? (
                    <>
                      <X className="size-4 shrink-0" aria-hidden />
                      Close
                    </>
                  ) : (
                    <>
                      <Combine className="size-4 shrink-0" aria-hidden />
                      Merge
                    </>
                  )}
                </button>
              </div>
            </div>
            <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2">
              <div className="pointer-events-auto flex items-center gap-3 rounded-xl bg-[#402e22]/95 px-3 py-2 shadow-sm ring-1 ring-white/10">
                {legendStatuses.map((status) => {
                  const fill = getPosTableMapStatusFill(status);
                  return (
                    <div
                      key={status}
                      className="flex items-center gap-1.5 text-xs font-medium text-white/90"
                    >
                      <span
                        className="size-3 shrink-0 rounded-sm ring-1 ring-black/20"
                        style={{ backgroundColor: fill }}
                        aria-hidden
                      />
                      <span>{POS_TABLE_MAP_STATUS_LABEL[status]}</span>
                    </div>
                  );
                })}
                <div className="flex items-center gap-1.5 text-xs font-medium text-white/90">
                  <span
                    className="size-2.5 shrink-0 rounded-full bg-violet-600 ring-2 ring-white/80"
                    aria-hidden
                  />
                  <span>QR order</span>
                </div>
                {isPayFirstMode && storeProfile?.paymentMethods?.cash?.enabled ? (
                  <div className="flex items-center gap-1.5 text-xs font-medium text-white/90">
                    <span
                      className="size-2.5 shrink-0 rounded-full bg-red-600 ring-2 ring-white/80"
                      aria-hidden
                    />
                    <span>Payment due</span>
                  </div>
                ) : null}
              </div>
            </div>
            <PosTableMapFloor
              tableMap={selectedMap}
              heldOrders={heldOrders}
              selfOrderTableKeys={selfOrderTableKeys}
              unpaidQrPaymentTableKeys={unpaidQrPaymentTableKeys}
              bookingsByTableKey={bookingsByTableKey}
              floorColor={mapFloorColor}
              solidFloor={isMergeMode}
              selectedTableNames={isMergeMode ? mergeSelectedNames : []}
              navigatingTableNames={navigatingTableNames}
              disableInteraction={navigatingTableNames.length > 0}
              mergeColorByTableName={mergeColorByTableName}
              manualOpenTableKeys={openRoundTableKeys}
              onTableSelect={handleTableSelect}
            />
          </div>
        ) : (
          <div
            className="flex min-h-0 flex-1 items-center justify-center px-6 pb-[env(safe-area-inset-bottom)]"
            style={{ backgroundColor: TABLE_MAP_FLOOR_COLOR }}
          >
            <div className="flex max-w-md flex-col items-center text-center">
              <div className="mb-4 flex size-12 items-center justify-center rounded-lg border border-gray-200 bg-white">
                <MapIcon className="size-5 text-gray-400" aria-hidden />
              </div>
              <h1 className="text-xl font-bold text-neutral-900">Table Map</h1>
              <p className="mt-2 text-sm text-neutral-500">
                No floor plan yet. Create one in admin under POS → Table map.
              </p>
            </div>
          </div>
        )}
      </div>

      <PosTableMapTableDrawer
        isOpen={Boolean(drawerTableName)}
        onClose={handleCloseDrawer}
        tableName={drawerTableName}
        bookings={drawerBookings}
        heldOrder={drawerHeldOrder}
        onLoadOrder={handleLoadOrder}
        onPay={handlePay}
        onSendToKitchen={handleSendToKitchen}
        onPrintBill={handlePrintBill}
        onReprintOrder={handleReprintOrder}
        onDelete={handleDeleteOrder}
        onAllServed={handleAllServed}
        onComplete={handleComplete}
        previewSections={previewSections}
        surchargeLines={previewSurchargeLines}
        isPreviewLoading={isPreviewLoading}
        previewError={previewError}
        showAllServed={showAllServed}
        showComplete={showComplete}
        showLoadOrder={showLoadOrder}
        showPay={showPay}
        showSendToKitchen={showSendToKitchen}
        manualMode={
          isManualDrawer
            ? openRoundTableKeys.has(
                normalizeTableMapTableName(drawerTableName),
              )
              ? "occupied"
              : "available"
            : null
        }
        emptySubtitle={
          isManualDrawer
            ? openRoundTableKeys.has(
                normalizeTableMapTableName(drawerTableName),
              )
              ? "Occupied"
              : "No order yet"
            : undefined
        }
        openedAt={drawerOpenedAt}
        onOpenTable={handleOpenTableManually}
        onCloseTable={handleCloseTableManually}
        onNewOrder={() => openNewOrderForTable(drawerTableName)}
        isProcessing={isProcessing || isDeleting || isManualTableSaving}
      />

      <PosPaymentDrawer
        isOpen={Boolean(tenderTarget)}
        onClose={() => {
          if (isCompletingSale) return;
          setTenderTarget(null);
        }}
        amountDue={Number(tenderTarget?.amountDue || 0)}
        onCompleteSale={handleTableQrCompleteSale}
        onPersistSale={persistTableQrSale}
        onFinishPaidSale={handleTableQrFinishPaidSale}
        isCompletingSale={isCompletingSale}
        hideReceiptActions
        tyroCardEnabled={tyroCardEnabled}
        tyroConfig={tyroPayments}
        linklyCardEnabled={linklyCardEnabled}
        linklyConfig={linklyPayments}
        onOpenCashDrawer={handleOpenCashDrawer}
      />

      <DeleteOrderDrawer
        isOpen={deleteDrawerOpen}
        onClose={() => {
          if (isDeleting) return;
          setDeleteDrawerOpen(false);
          setDeleteTarget(null);
        }}
        target={deleteTarget}
        onConfirm={handleConfirmDeleteOrder}
        isProcessing={isDeleting}
      />

      <PosTableMapUndoMergeModal
        isOpen={Boolean(undoMergeTarget)}
        tableNames={undoMergeTarget?.tableNames || []}
        keepTable={undoMergeTarget?.keepTable || ""}
        isProcessing={isUndoingMerge}
        onClose={() => {
          if (isUndoingMerge) return;
          setUndoMergeTarget(null);
        }}
        onConfirm={handleConfirmUndoMerge}
      />
    </>
  );
}
