"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { App } from "@capacitor/app";
import toast from "react-hot-toast";
import { fetchOrders } from "@/lib/api/fetchApi";
import { filterOrdersForActiveList } from "@/lib/helper/payLater";
import { isSelfOrderNotificationCandidate } from "@/lib/helper/liveOrderNotifications";
import {
  autoPrintAndPrepareOrder,
  isAutoPrintExcludedPayLaterOrder,
  prepareOrderForKitchen,
} from "@/lib/helper/prepareLiveOrder";
import { isNativeApp } from "@/lib/helper/platformDetection";
import {
  formatSelfOrderBatchDescription,
  formatSelfOrderBatchTitle,
} from "@/lib/pos/selfOrderAlertDisplay";
import { getAutoPrintingEnabled } from "@/lib/utils/autoPrinting";
import { useMenuContext } from "@/components/context/MenuContext";
import { useGlobalAppContext } from "@/components/context/GlobalAppContext";

const POLLING_INTERVALS = {
  ACTIVE: 10000,
  IDLE: 30000,
  ERROR_BASE: 20000,
  ERROR_MAX: 60000,
};

/** Keep auto-print alerts visible briefly so they don't flash off. */
const AUTO_PRINT_ALERT_MIN_VISIBLE_MS = 3500;

export const SELF_ORDER_BATCH_ALERT_ID = "__self_order_batch__";

function normalizeOrderId(orderId) {
  return String(orderId ?? "").trim();
}

function sortCandidatesNewestFirst(orders) {
  return [...orders].sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
  );
}

function orderToAlert(order) {
  return {
    kind: "order",
    id: order._id,
    orderId: order._id,
    table: order.table,
    customerName: order.customerName,
    createdAt: order.createdAt,
    paymentStatus: order.paymentStatus,
  };
}

function batchToAlert(orders) {
  const sorted = sortCandidatesNewestFirst(orders);

  return {
    kind: "batch",
    id: SELF_ORDER_BATCH_ALERT_ID,
    count: sorted.length,
    orderIds: sorted.map((order) => normalizeOrderId(order._id)).filter(Boolean),
    createdAt: sorted[0]?.createdAt,
    title: formatSelfOrderBatchTitle(sorted.length),
    description: formatSelfOrderBatchDescription(sorted),
    sendLabel: "View orders",
  };
}

export function buildAlertsFromCandidates(candidates, returnSyncIds) {
  const sorted = sortCandidatesNewestFirst(candidates);
  const backlog = sorted.filter((order) =>
    returnSyncIds.has(normalizeOrderId(order._id)),
  );
  const liveArrivals = sorted.filter(
    (order) => !returnSyncIds.has(normalizeOrderId(order._id)),
  );

  const alerts = liveArrivals.map(orderToAlert);

  if (backlog.length > 1) {
    alerts.push(batchToAlert(backlog));
  } else if (backlog.length === 1) {
    alerts.push(orderToAlert(backlog[0]));
  }

  return alerts;
}

/**
 * @param {{ externalPolling?: boolean }} [options]
 * When `externalPolling` is true, the caller owns the poll clock
 * (e.g. table map shared with held-orders refresh). Use `pollSelfOrderAlerts`.
 */
export function useSelfOrderAlerts({ externalPolling = false } = {}) {
  const { menuConfig, storeProfile, itemGroups } = useMenuContext();
  const { userData } = useGlobalAppContext();
  const [alerts, setAlerts] = useState([]);
  const [processingAlertIds, setProcessingAlertIds] = useState(() => new Set());
  const processingAlertIdsRef = useRef(new Set());
  const printedOrderIdsRef = useRef(new Set());
  const autoPrintingOrderIdsRef = useRef(new Set());
  const [autoPrintingOrderIds, setAutoPrintingOrderIds] = useState(
    () => new Set(),
  );
  const [isPollingActive, setIsPollingActive] = useState(!externalPolling);

  const isReturnSyncDoneRef = useRef(false);
  const returnSyncCandidateIdsRef = useRef(new Set());
  const consecutiveErrorsRef = useRef(0);
  const pollingTimeoutRef = useRef(null);
  const isPollingInProgressRef = useRef(false);
  const isNative = isNativeApp();

  const setOrderAutoPrinting = useCallback((orderId, isPrinting) => {
    const id = normalizeOrderId(orderId);
    if (!id) return;
    if (isPrinting) autoPrintingOrderIdsRef.current.add(id);
    else autoPrintingOrderIdsRef.current.delete(id);
    setAutoPrintingOrderIds(new Set(autoPrintingOrderIdsRef.current));
  }, []);

  const dismissSelfOrderAlert = useCallback((alertId) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
  }, []);

  const prepareSelfOrderAlert = useCallback(
    async (alertId) => {
      if (!menuConfig || processingAlertIdsRef.current.has(alertId)) return;
      if (autoPrintingOrderIdsRef.current.has(normalizeOrderId(alertId))) {
        return;
      }

      processingAlertIdsRef.current.add(alertId);
      setProcessingAlertIds(new Set(processingAlertIdsRef.current));

      try {
        const data = await fetchOrders();
        const activeOrders = filterOrdersForActiveList(data, menuConfig);
        const order = activeOrders.find((entry) => entry._id === alertId);

        if (!order) {
          toast.error("Order not found");
          dismissSelfOrderAlert(alertId);
          return;
        }

        const result = await prepareOrderForKitchen(order, {
          storeProfile,
          menuConfig,
          itemGroups,
          ownerEmail: userData?.ownerEmail,
        });

        if (!result.success) {
          toast.error(result.message || "Failed to prepare order");
          return;
        }

        dismissSelfOrderAlert(alertId);
        toast.success("Order sent to kitchen");
      } catch (error) {
        console.error("Failed to prepare self-order alert:", error);
        toast.error(error?.message || "Failed to prepare order");
      } finally {
        processingAlertIdsRef.current.delete(alertId);
        setProcessingAlertIds(new Set(processingAlertIdsRef.current));
      }
    },
    [
      dismissSelfOrderAlert,
      itemGroups,
      menuConfig,
      storeProfile,
      userData?.ownerEmail,
    ],
  );

  const alertsWithProcessing = useMemo(
    () =>
      alerts.map((alert) => {
        const isManualSending = processingAlertIds.has(alert.id);
        const isAutoSending =
          alert.kind === "batch"
            ? (alert.orderIds || []).some((id) =>
                autoPrintingOrderIds.has(normalizeOrderId(id)),
              )
            : autoPrintingOrderIds.has(normalizeOrderId(alert.id));

        return {
          ...alert,
          isSending: isManualSending || isAutoSending,
          isAutoSending,
          sendLabel: isAutoSending
            ? "Auto sending…"
            : alert.sendLabel || "Send",
        };
      }),
    [alerts, autoPrintingOrderIds, processingAlertIds],
  );

  const syncAlertsFromOrders = useCallback((activeOrders) => {
    const candidates = sortCandidatesNewestFirst(
      activeOrders.filter(isSelfOrderNotificationCandidate),
    );
    const candidateIds = new Set(
      candidates.map((order) => normalizeOrderId(order._id)).filter(Boolean),
    );

    if (!isReturnSyncDoneRef.current) {
      isReturnSyncDoneRef.current = true;
      returnSyncCandidateIdsRef.current = new Set(candidateIds);
      setAlerts(
        buildAlertsFromCandidates(
          candidates,
          returnSyncCandidateIdsRef.current,
        ),
      );
      return;
    }

    setAlerts(
      buildAlertsFromCandidates(candidates, returnSyncCandidateIdsRef.current),
    );
  }, []);

  /**
   * Same path as Live Order Terminal: when device auto-print is on, move paid
   * QR/online to preparing immediately and kitchen-print in the background.
   * Pay-later still surfaces as alerts for manual Prepare.
   */
  const autoPrintEligibleSelfOrders = useCallback(
    async (activeOrders) => {
      const autoPrintingEnabled = getAutoPrintingEnabled();
      const canAutoPrint =
        autoPrintingEnabled && storeProfile && userData?.ownerEmail;
      if (!canAutoPrint) {
        return { orders: activeOrders, autoPreparedIds: new Set() };
      }

      const autoPrintCandidates = activeOrders.filter((order) => {
        if (!isSelfOrderNotificationCandidate(order)) return false;
        if (isAutoPrintExcludedPayLaterOrder(order)) return false;
        const orderId = normalizeOrderId(order._id);
        if (printedOrderIdsRef.current.has(orderId)) return false;
        if (autoPrintingOrderIdsRef.current.has(orderId)) return false;
        return true;
      });

      if (autoPrintCandidates.length === 0) {
        return { orders: activeOrders, autoPreparedIds: new Set() };
      }

      let nextOrders = activeOrders;
      const autoPreparedIds = new Set();

      for (const order of autoPrintCandidates) {
        const orderId = normalizeOrderId(order._id);
        setOrderAutoPrinting(orderId, true);
        try {
          const result = await autoPrintAndPrepareOrder(order, {
            storeProfile,
            menuConfig,
            itemGroups,
          });

          // Only skip future retries once prepare succeeded.
          if (result.prepared && result.updatedOrder) {
            printedOrderIdsRef.current.add(orderId);
            autoPreparedIds.add(orderId);
            nextOrders = nextOrders.map((entry) =>
              entry._id === result.updatedOrder._id
                ? result.updatedOrder
                : entry,
            );
            toast.success(result.message, { duration: 3000 });
          } else if (!result.prepared) {
            toast.error(result.message, { duration: 4000 });
          }
        } catch (error) {
          console.error(
            `[table-map auto-print] Error auto-printing order ${order._id}:`,
            error,
          );
        } finally {
          // Keep Auto sending… until the min-visible hold finishes for successes.
          if (!autoPreparedIds.has(orderId)) {
            setOrderAutoPrinting(orderId, false);
          }
        }
      }

      return { orders: nextOrders, autoPreparedIds };
    },
    [
      itemGroups,
      menuConfig,
      setOrderAutoPrinting,
      storeProfile,
      userData?.ownerEmail,
    ],
  );

  const pollSelfOrderAlerts = useCallback(async () => {
    if (!menuConfig) return { skipped: true };
    if (isPollingInProgressRef.current) return { skipped: true };

    isPollingInProgressRef.current = true;

    try {
      const data = await fetchOrders();
      let activeOrders = filterOrdersForActiveList(data, menuConfig);
      consecutiveErrorsRef.current = 0;

      // Show alerts immediately; auto-print prepare is fast, so hold dismiss
      // briefly so the popup doesn't flash.
      const alertShownAt = Date.now();
      syncAlertsFromOrders(activeOrders);

      const autoPrintResult = await autoPrintEligibleSelfOrders(activeOrders);
      activeOrders = autoPrintResult.orders;

      if (autoPrintResult.autoPreparedIds.size > 0) {
        const remainingMs =
          AUTO_PRINT_ALERT_MIN_VISIBLE_MS - (Date.now() - alertShownAt);
        if (remainingMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, remainingMs));
        }
        for (const orderId of autoPrintResult.autoPreparedIds) {
          setOrderAutoPrinting(orderId, false);
        }
      }

      syncAlertsFromOrders(activeOrders);
      return { success: true, hasActiveOrders: activeOrders.length > 0 };
    } catch (error) {
      console.error("Self-order alert polling error:", error);
      consecutiveErrorsRef.current += 1;
      return { success: false, error };
    } finally {
      isPollingInProgressRef.current = false;
    }
  }, [
    autoPrintEligibleSelfOrders,
    menuConfig,
    setOrderAutoPrinting,
    syncAlertsFromOrders,
  ]);

  const pollingOrders = useCallback(async () => {
    if (!isPollingActive || !menuConfig) return;

    const result = await pollSelfOrderAlerts();

    if (!isPollingActive) return;

    let nextInterval = POLLING_INTERVALS.ACTIVE;
    if (result?.success === false) {
      nextInterval = Math.min(
        POLLING_INTERVALS.ERROR_BASE *
          Math.pow(2, Math.min(consecutiveErrorsRef.current - 1, 4)),
        POLLING_INTERVALS.ERROR_MAX,
      );
    } else if (result?.success && !result.hasActiveOrders) {
      nextInterval = POLLING_INTERVALS.IDLE;
    }

    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
    }
    pollingTimeoutRef.current = setTimeout(() => {
      pollingOrders();
    }, nextInterval);
  }, [isPollingActive, menuConfig, pollSelfOrderAlerts]);

  const startPolling = useCallback(() => {
    if (isPollingInProgressRef.current) return;

    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }

    setIsPollingActive(true);

    if (!isPollingInProgressRef.current) {
      pollingOrders();
    }
  }, [pollingOrders]);

  const stopPolling = useCallback(() => {
    setIsPollingActive(false);

    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (externalPolling) {
      return () => {
        isReturnSyncDoneRef.current = false;
        returnSyncCandidateIdsRef.current = new Set();
      };
    }

    if (!menuConfig) return;

    startPolling();

    return () => {
      stopPolling();
      isReturnSyncDoneRef.current = false;
      returnSyncCandidateIdsRef.current = new Set();
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
    };
  }, [externalPolling, menuConfig, startPolling, stopPolling]);

  useEffect(() => {
    if (externalPolling) return undefined;

    let appStateListener = null;

    if (isNative) {
      const handleAppStateChange = ({ isActive }) => {
        if (isActive) {
          startPolling();
        } else {
          stopPolling();
        }
      };

      appStateListener = App.addListener(
        "appStateChange",
        handleAppStateChange,
      );
    } else {
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          startPolling();
        } else {
          stopPolling();
        }
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);

      return () => {
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
      };
    }

    return () => {
      if (appStateListener) {
        appStateListener.remove();
      }
    };
  }, [externalPolling, isNative, startPolling, stopPolling]);

  return {
    alerts: alertsWithProcessing,
    dismissSelfOrderAlert,
    prepareSelfOrderAlert,
    pollSelfOrderAlerts,
  };
}
