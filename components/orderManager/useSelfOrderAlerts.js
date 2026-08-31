"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { App } from "@capacitor/app";
import toast from "react-hot-toast";
import { fetchOrders } from "@/lib/api/fetchApi";
import { filterOrdersForActiveList } from "@/lib/helper/payLater";
import { isSelfOrderNotificationCandidate } from "@/lib/helper/liveOrderNotifications";
import { prepareOrderForKitchen } from "@/lib/helper/prepareLiveOrder";
import { isNativeApp } from "@/lib/helper/platformDetection";
import {
  formatSelfOrderBatchDescription,
  formatSelfOrderBatchTitle,
} from "@/lib/pos/selfOrderAlertDisplay";
import { useMenuContext } from "@/components/context/MenuContext";
import { useGlobalAppContext } from "@/components/context/GlobalAppContext";

const POLLING_INTERVALS = {
  ACTIVE: 10000,
  IDLE: 30000,
  ERROR_BASE: 20000,
  ERROR_MAX: 60000,
};

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

export function useSelfOrderAlerts() {
  const { menuConfig, storeProfile, itemGroups } = useMenuContext();
  const { userData } = useGlobalAppContext();
  const [alerts, setAlerts] = useState([]);
  const [processingAlertIds, setProcessingAlertIds] = useState(() => new Set());
  const processingAlertIdsRef = useRef(new Set());
  const [isPollingActive, setIsPollingActive] = useState(true);

  const isReturnSyncDoneRef = useRef(false);
  const returnSyncCandidateIdsRef = useRef(new Set());
  const consecutiveErrorsRef = useRef(0);
  const pollingTimeoutRef = useRef(null);
  const isPollingInProgressRef = useRef(false);
  const isNative = isNativeApp();

  const dismissSelfOrderAlert = useCallback((alertId) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
  }, []);

  const prepareSelfOrderAlert = useCallback(
    async (alertId) => {
      if (!menuConfig || processingAlertIdsRef.current.has(alertId)) return;

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

        if (result.printFailed) {
          toast.error(result.message || "Order prepared but print failed");
        } else {
          toast.success("Order sent to kitchen");
        }
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
      alerts.map((alert) => ({
        ...alert,
        isSending: processingAlertIds.has(alert.id),
      })),
    [alerts, processingAlertIds],
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

  const pollingOrders = useCallback(async () => {
    if (!isPollingActive || !menuConfig) return;
    if (isPollingInProgressRef.current) return;

    isPollingInProgressRef.current = true;

    try {
      const data = await fetchOrders();
      const activeOrders = filterOrdersForActiveList(data, menuConfig);

      consecutiveErrorsRef.current = 0;
      syncAlertsFromOrders(activeOrders);

      const hasActiveOrders = activeOrders.length > 0;
      const nextInterval = hasActiveOrders
        ? POLLING_INTERVALS.ACTIVE
        : POLLING_INTERVALS.IDLE;

      if (isPollingActive) {
        if (pollingTimeoutRef.current) {
          clearTimeout(pollingTimeoutRef.current);
        }
        pollingTimeoutRef.current = setTimeout(() => {
          pollingOrders();
        }, nextInterval);
      }
    } catch (error) {
      console.error("Self-order alert polling error:", error);

      consecutiveErrorsRef.current += 1;

      const backoffInterval = Math.min(
        POLLING_INTERVALS.ERROR_BASE *
          Math.pow(2, Math.min(consecutiveErrorsRef.current - 1, 4)),
        POLLING_INTERVALS.ERROR_MAX,
      );

      if (isPollingActive) {
        if (pollingTimeoutRef.current) {
          clearTimeout(pollingTimeoutRef.current);
        }
        pollingTimeoutRef.current = setTimeout(() => {
          pollingOrders();
        }, backoffInterval);
      }
    } finally {
      isPollingInProgressRef.current = false;
    }
  }, [isPollingActive, menuConfig, syncAlertsFromOrders]);

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
  }, [menuConfig, startPolling, stopPolling]);

  useEffect(() => {
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
  }, [isNative, startPolling, stopPolling]);

  return {
    alerts: alertsWithProcessing,
    dismissSelfOrderAlert,
    prepareSelfOrderAlert,
  };
}
