"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { App } from "@capacitor/app";
import { usePosNavigate } from "@/components/context/PosNavigateContext";
import { Combine, Map as MapIcon, ShoppingBag, X } from "lucide-react";
import toast from "react-hot-toast";
import { useMenuContext } from "@/components/context/MenuContext";
import {
  fetchPosHeldOrders,
  fetchPosResumeOrders,
  markPosBillPrinted,
  mergePosTables,
  unmergePosTables,
  updatePosHeldCheckStatus,
} from "@/lib/api/fetchApi";
import { isNativeApp } from "@/lib/helper/platformDetection";
import {
  drawerEntryHasPosCheck,
  drawerEntryHasQrContext,
  findHeldOrderForTableMap,
  findPosHeldOrderForTable,
  getDrawerPosOrderIds,
} from "@/lib/pos/posTableMapHeld";
import { buildSelfOrderTableIndicatorKeys } from "@/lib/pos/posTableMapSelfOrder";
import {
  getAllTicketIds,
  getTicketIdsNotDelivered,
  isPosSourceHeldOrder,
} from "@/lib/pos/posHeldOrder";
import {
  printBillForHeldCheck,
  reprintHeldCheckKitchen,
} from "@/lib/pos/posHeldOrderPrint";
import { buildHeldDrawerPreviewSections } from "@/lib/pos/posHeldDrawerPreview";
import {
  getPosTableMapLegendStatuses,
  getPosTableMapStatusFill,
  POS_TABLE_MAP_STATUS,
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
  TABLE_MAP_DEFAULT_TABLE_BACKGROUND,
  TABLE_MAP_FLOOR_COLOR,
  getTableMapTableName,
  normalizeTableMapTableName,
} from "@/lib/pos/posTableMaps";
import PosChromeHeader from "./PosChromeHeader";
import PosTableMapFloor from "./PosTableMapFloor";
import PosTableMapTableDrawer from "./PosTableMapTableDrawer";
import PosTableMapUndoMergeModal from "./PosTableMapUndoMergeModal";
import DeleteOrderDrawer from "./DeleteOrderDrawer";
import SelfOrderAlertStack from "./SelfOrderAlertStack";
import {
  SELF_ORDER_BATCH_ALERT_ID,
  useSelfOrderAlerts,
} from "./useSelfOrderAlerts";
import { POS_HELD_ORDERS_TAB_SELF_ORDERING } from "./PosHeldOrders";
import DismissibleToast, {
  useDismissibleToast,
} from "@/components/orderManager/DismissibleToast";
import { usePosOpenCashDrawer } from "./usePosOpenCashDrawer";

const TABLE_MAP_POLL_MS = 10000;
const TABLE_MAP_MERGE_FLOOR_COLOR = "#1e293b";

function orderIdsCacheKey(orderIds) {
  return (orderIds || []).map(String).join(",");
}

function ticketsStatusKey(heldOrder) {
  return (heldOrder?.tickets || [])
    .map((ticket) => `${ticket.orderId}:${String(ticket.status || "").trim()}`)
    .join(",");
}

export default function PosTableMap() {
  const { navigate, isPending } = usePosNavigate();
  const {
    alerts: selfOrderAlerts,
    dismissSelfOrderAlert,
    prepareSelfOrderAlert,
    pollSelfOrderAlerts,
  } = useSelfOrderAlerts({ externalPolling: true });
  const { handleOpenCashDrawer } = usePosOpenCashDrawer();
  const { posTableMaps, storeProfile, menuConfig, itemGroups } =
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
  const [drawerTableName, setDrawerTableName] = useState(null);
  const [drawerHeldOrder, setDrawerHeldOrder] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewSections, setPreviewSections] = useState([]);
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

  const loadHeldOrders = useCallback(async () => {
    try {
      const result = await fetchPosHeldOrders();
      if (!result?.success) return;
      setHeldOrders(result.heldOrders || []);
    } catch {
      // Silent refresh; table map still works for new orders.
    }
  }, []);

  const pollTableMap = useCallback(async () => {
    await Promise.all([loadHeldOrders(), pollSelfOrderAlerts()]);
  }, [loadHeldOrders, pollSelfOrderAlerts]);

  // Shared poll clock: held-order dots + self-order alert popups refresh together.
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
        if (!cancelled) void pollTableMap();
      }, TABLE_MAP_POLL_MS);
    };

    const resumePolling = () => {
      if (cancelled) return;
      void pollTableMap();
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
  }, [pollTableMap]);

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
      if (!isProcessing) {
        setDrawerTableName(null);
        setDrawerHeldOrder(null);
      }
      return;
    }
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
  }, [heldOrders, drawerTableName, isProcessing]);

  const drawerOrderIdsKey = orderIdsCacheKey(drawerHeldOrder?.orderIds);

  useEffect(() => {
    if (!drawerTableName || !drawerOrderIdsKey) {
      setPreviewSections([]);
      setPreviewError(null);
      setIsPreviewLoading(false);
      return;
    }

    const orderIds = drawerOrderIdsKey.split(",");
    const cached = resumeOrdersCacheRef.current.get(drawerOrderIdsKey);
    if (cached) {
      setPreviewSections(buildHeldDrawerPreviewSections(cached));
      setPreviewError(null);
      setIsPreviewLoading(false);
      return;
    }

    let cancelled = false;
    setIsPreviewLoading(true);
    setPreviewError(null);

    (async () => {
      const result = await fetchPosResumeOrders(orderIds);
      if (cancelled) return;
      if (!result?.success || !result.orders?.length) {
        setPreviewSections([]);
        setPreviewError(result?.error || "Could not load items");
        setIsPreviewLoading(false);
        return;
      }
      resumeOrdersCacheRef.current.set(drawerOrderIdsKey, result.orders);
      setPreviewSections(buildHeldDrawerPreviewSections(result.orders));
      setIsPreviewLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [drawerTableName, drawerOrderIdsKey]);

  function handleCloseDrawer() {
    if (isProcessing) return;
    setDrawerTableName(null);
    setDrawerHeldOrder(null);
    setPreviewSections([]);
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

    setDrawerTableName(tableName);
    setDrawerHeldOrder(heldOrder);
    const cacheKey = orderIdsCacheKey(heldOrder.orderIds);
    const cached = resumeOrdersCacheRef.current.get(cacheKey);
    if (cached) {
      setPreviewSections(buildHeldDrawerPreviewSections(cached));
      setPreviewError(null);
      setIsPreviewLoading(false);
    } else {
      setPreviewSections([]);
      setPreviewError(null);
      setIsPreviewLoading(true);
    }
  }

  function handleLoadOrder() {
    if (!drawerHeldOrder?.orderIds?.length) return;
    navigate(
      `/pos?resume=${encodeURIComponent(drawerHeldOrder.orderIds.join(","))}`,
    );
  }

  function handlePay() {
    const posOrderIds = getDrawerPosOrderIds(drawerHeldOrder);
    if (posOrderIds.length === 0) {
      showDismissibleToast(
        "Pay for this QR order from Self Ordering or Live Orders",
      );
      return;
    }
    if (
      drawerHeldOrder?.posAllPaid === true ||
      (isPosSourceHeldOrder(drawerHeldOrder) && drawerHeldOrder.allPaid)
    ) {
      showDismissibleToast("This check is already paid");
      return;
    }
    navigate(
      `/pos?resume=${encodeURIComponent(posOrderIds.join(","))}&pay=1`,
    );
  }

  async function loadDrawerCheckOrders() {
    if (!drawerHeldOrder?.orderIds?.length) return null;

    const cacheKey = orderIdsCacheKey(drawerHeldOrder.orderIds);
    let orders = resumeOrdersCacheRef.current.get(cacheKey);
    if (orders?.length) return orders;

    const result = await fetchPosResumeOrders(drawerHeldOrder.orderIds);
    if (!result?.success || !result.orders?.length) {
      showDismissibleToast(result?.error || "Could not load check");
      return null;
    }
    orders = result.orders;
    resumeOrdersCacheRef.current.set(cacheKey, orders);
    setPreviewSections(buildHeldDrawerPreviewSections(orders));
    setPreviewError(null);
    return orders;
  }

  async function handlePrintBill() {
    if (!drawerHeldOrder?.orderIds?.length || isProcessing) return;

    const posOrderIds = getDrawerPosOrderIds(drawerHeldOrder);
    if (posOrderIds.length === 0) {
      showDismissibleToast("Print bill is only available for POS checks");
      return;
    }

    setIsProcessing(true);
    try {
      const orders = await loadDrawerCheckOrders();
      if (!orders) return;

      const posOrders = orders.filter(
        (order) => String(order?.source || "").trim() === "pos",
      );
      if (posOrders.length === 0) {
        showDismissibleToast("Print bill is only available for POS checks");
        return;
      }

      const printResult = await printBillForHeldCheck(posOrders, {
        storeProfile,
        heldEntry: drawerHeldOrder,
      });

      if (printResult.success) {
        toast.success(printResult.message || "Bill printed");
        const markResult = await markPosBillPrinted(posOrderIds);
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
    if (!drawerHeldOrder?.orderIds?.length || isProcessing) return;

    setIsProcessing(true);
    try {
      const orders = await loadDrawerCheckOrders();
      if (!orders) return;

      const result = await reprintHeldCheckKitchen(orders, {
        storeProfile,
        itemGroups,
        menuConfig,
      });

      if (result.success) {
        toast.success(result.message || "Kitchen ticket reprinted");
      } else {
        showDismissibleToast(result.message || "Failed to reprint order");
      }
    } catch (error) {
      showDismissibleToast(error?.message || "Failed to reprint order");
    } finally {
      setIsProcessing(false);
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
    const title = table
      ? `Delete Table ${table}`
      : taxInvoiceNo
        ? `Delete invoice ${taxInvoiceNo}`
        : "Delete held check";

    const subtitleParts = [];
    if (ticketIds.length > 1) {
      subtitleParts.push(`${ticketIds.length} tickets`);
    }
    if (order?.total != null) {
      subtitleParts.push(`$${Number(order.total).toFixed(2)} unpaid`);
    }
    if (drawerEntryHasQrContext(order)) {
      subtitleParts.push("POS tickets only");
    }

    return {
      id: order.id,
      title,
      subtitle: subtitleParts.join(" · ") || "This will cancel the open check.",
      orderIds: ticketIds,
      ticketCount: ticketIds.length,
    };
  }

  function handleDeleteOrder() {
    if (!drawerHeldOrder || isProcessing || isDeleting) return;

    const posOrderIds = getDrawerPosOrderIds(drawerHeldOrder);
    const posAllPaid =
      drawerHeldOrder?.posAllPaid === true ||
      (isPosSourceHeldOrder(drawerHeldOrder) && drawerHeldOrder.allPaid);

    if (posOrderIds.length === 0 || posAllPaid) {
      showDismissibleToast("Paid checks cannot be deleted");
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
      const result = await updatePosHeldCheckStatus({
        orderIds: deleteTarget.orderIds,
        status: "cancelled",
        cancelReason,
        requireCancelReason: true,
      });
      if (!result?.success) {
        showDismissibleToast(result?.error || "Failed to delete check");
        return;
      }

      toast.success(
        deleteTarget.orderIds.length === 1
          ? "Held order deleted"
          : "Held check deleted",
      );
      setDeleteDrawerOpen(false);
      setDeleteTarget(null);
      handleCloseDrawer();
      await loadHeldOrders();
    } catch (error) {
      showDismissibleToast(error?.message || "Failed to delete check");
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
      const result = await updatePosHeldCheckStatus({
        orderIds: ticketIds,
        status: "delivered",
      });
      if (!result?.success) {
        showDismissibleToast(result?.error || "Failed to update tickets");
        return;
      }
      toast.success(successMessage);
      await loadHeldOrders();
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

  const undeliveredTicketCount =
    getTicketIdsNotDelivered(drawerHeldOrder).length;
  const needsServe =
    Boolean(drawerHeldOrder) && undeliveredTicketCount > 0;
  const showAllServed =
    needsServe &&
    drawerEntryHasPosCheck(drawerHeldOrder) &&
    !Boolean(drawerHeldOrder?.posAllPaid ?? drawerHeldOrder?.allPaid);
  const showComplete =
    needsServe &&
    Boolean(drawerHeldOrder?.posAllPaid ?? drawerHeldOrder?.allPaid);
  // Always allow Open so staff can add more on a paid-but-not-complete table.
  const showLoadOrder = Boolean(drawerHeldOrder?.orderIds?.length);
  const showPay =
    Boolean(drawerHeldOrder) &&
    drawerEntryHasPosCheck(drawerHeldOrder) &&
    !Boolean(drawerHeldOrder?.posAllPaid ?? false) &&
    !(isPosSourceHeldOrder(drawerHeldOrder) && drawerHeldOrder.allPaid);
  const mapFloorColor = isMergeMode
    ? TABLE_MAP_MERGE_FLOOR_COLOR
    : TABLE_MAP_FLOOR_COLOR;

  const handleSelfOrderAlertSend = useCallback(
    (alertId) => {
      if (alertId === SELF_ORDER_BATCH_ALERT_ID) {
        navigate(`/pos/held?tab=${POS_HELD_ORDERS_TAB_SELF_ORDERING}`);
        return;
      }

      void prepareSelfOrderAlert(alertId);
    },
    [prepareSelfOrderAlert, navigate],
  );

  return (
    <>
      <SelfOrderAlertStack
        alerts={selfOrderAlerts}
        onDismiss={dismissSelfOrderAlert}
        onSend={handleSelfOrderAlertSend}
      />

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
                  Takeaway
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
                  const fill =
                    status === POS_TABLE_MAP_STATUS.available
                      ? TABLE_MAP_DEFAULT_TABLE_BACKGROUND
                      : getPosTableMapStatusFill(status);
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
              </div>
            </div>
            <PosTableMapFloor
              tableMap={selectedMap}
              heldOrders={heldOrders}
              selfOrderTableKeys={selfOrderTableKeys}
              floorColor={mapFloorColor}
              solidFloor={isMergeMode}
              selectedTableNames={isMergeMode ? mergeSelectedNames : []}
              navigatingTableNames={navigatingTableNames}
              disableInteraction={navigatingTableNames.length > 0}
              mergeColorByTableName={mergeColorByTableName}
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
        heldOrder={drawerHeldOrder}
        onLoadOrder={handleLoadOrder}
        onPay={handlePay}
        onPrintBill={handlePrintBill}
        onReprintOrder={handleReprintOrder}
        onDelete={handleDeleteOrder}
        onAllServed={handleAllServed}
        onComplete={handleComplete}
        isProcessing={isProcessing || isDeleting}
        previewSections={previewSections}
        isPreviewLoading={isPreviewLoading}
        previewError={previewError}
        showAllServed={showAllServed}
        showComplete={showComplete}
        showLoadOrder={showLoadOrder}
        showPay={showPay}
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
