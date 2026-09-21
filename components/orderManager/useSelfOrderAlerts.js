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
import { isSelfOrderAlertsEnabled } from "@/lib/pos/selfOrderAlertsConfig";
import { useMenuContext } from "@/components/context/MenuContext";
import { useGlobalAppContext } from "@/components/context/GlobalAppContext";

/** Fixed interval — next tick is independent of the last fetch finishing. */
const SELF_ORDER_ALERT_POLL_MS = 10000;

/** Ignore a single poll blip (local HMR / emulator). Show the card on the 2nd miss. */
const CONNECTION_LOST_AFTER_FAILURES = 1;

/** Keep auto-print alerts visible briefly so they don't flash off. */
const AUTO_PRINT_ALERT_MIN_VISIBLE_MS = 3500;

export const SELF_ORDER_BATCH_ALERT_ID = "__self_order_batch__";
export const CONNECTION_LOST_ALERT_ID = "__connection_lost__";

function buildConnectionLostAlert() {
  return {
    kind: "connection",
    id: CONNECTION_LOST_ALERT_ID,
    title: "Connection lost",
    description: "Orders may not update. Check the network, then dismiss.",
    createdAt: Date.now(),
  };
}

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
    orderIds: sorted
      .map((order) => normalizeOrderId(order._id))
      .filter(Boolean),
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
  const [connectionLostAlert, setConnectionLostAlert] = useState(null);
  const [processingAlertIds, setProcessingAlertIds] = useState(() => new Set());
  const processingAlertIdsRef = useRef(new Set());
  const printedOrderIdsRef = useRef(new Set());
  const autoPrintingOrderIdsRef = useRef(new Set());
  const [autoPrintingOrderIds, setAutoPrintingOrderIds] = useState(
    () => new Set(),
  );

  const isReturnSyncDoneRef = useRef(false);
  const returnSyncCandidateIdsRef = useRef(new Set());
  const consecutiveErrorsRef = useRef(0);
  /** After staff dismisses during an outage, don't re-show until connection recovers. */
  const connectionLostDismissedForOutageRef = useRef(false);
  const isPollingInProgressRef = useRef(false);
  const pollSelfOrderAlertsRef = useRef(null);
  /** Order ids kept on screen until min-visible setTimeout fires (UX only). */
  const minVisibleAlertIdsRef = useRef(new Set());
  const autoPrintDismissTimeoutsRef = useRef(new Map());
  const isNative = isNativeApp();
  const hasMenuConfig = Boolean(menuConfig);
  const selfOrderAlertsEnabled = isSelfOrderAlertsEnabled(menuConfig);

  const setOrderAutoPrinting = useCallback((orderId, isPrinting) => {
    const id = normalizeOrderId(orderId);
    if (!id) return;
    if (isPrinting) autoPrintingOrderIdsRef.current.add(id);
    else autoPrintingOrderIdsRef.current.delete(id);
    setAutoPrintingOrderIds(new Set(autoPrintingOrderIdsRef.current));
  }, []);

  const dismissSelfOrderAlert = useCallback((alertId) => {
    if (alertId === CONNECTION_LOST_ALERT_ID) {
      setConnectionLostAlert(null);
      if (consecutiveErrorsRef.current > 0) {
        connectionLostDismissedForOutageRef.current = true;
      }
      return;
    }
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

  const alertsWithProcessing = useMemo(() => {
    const orderAlerts = alerts.map((alert) => {
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
        sendLabel: isAutoSending ? "Auto sending…" : alert.sendLabel || "Send",
      };
    });

    return connectionLostAlert
      ? [connectionLostAlert, ...orderAlerts]
      : orderAlerts;
  }, [alerts, autoPrintingOrderIds, connectionLostAlert, processingAlertIds]);

  const mergePinnedMinVisibleAlerts = useCallback((built, prev) => {
    const builtIdSet = new Set(built.map((alert) => alert.id));
    const pinned = prev.filter((alert) => {
      if (builtIdSet.has(alert.id)) return false;
      if (alert.kind === "order") {
        return minVisibleAlertIdsRef.current.has(normalizeOrderId(alert.id));
      }
      if (alert.kind === "batch" && alert.orderIds?.length) {
        return alert.orderIds.some((id) =>
          minVisibleAlertIdsRef.current.has(normalizeOrderId(id)),
        );
      }
      return false;
    });
    return pinned.length > 0 ? [...built, ...pinned] : built;
  }, []);

  const syncAlertsFromOrders = useCallback(
    (activeOrders) => {
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

      setAlerts((prev) =>
        mergePinnedMinVisibleAlerts(
          buildAlertsFromCandidates(
            candidates,
            returnSyncCandidateIdsRef.current,
          ),
          prev,
        ),
      );
    },
    [mergePinnedMinVisibleAlerts],
  );

  const dismissAutoPrintAlertForOrder = useCallback(
    (orderId) => {
      const id = normalizeOrderId(orderId);
      if (!id) return;

      autoPrintDismissTimeoutsRef.current.delete(id);
      minVisibleAlertIdsRef.current.delete(id);
      setOrderAutoPrinting(id, false);

      setAlerts((prev) =>
        prev.filter((alert) => {
          if (alert.kind === "order") {
            return normalizeOrderId(alert.id) !== id;
          }
          if (alert.kind === "batch" && alert.orderIds?.length) {
            return !alert.orderIds.every(
              (entryId) => normalizeOrderId(entryId) === id,
            );
          }
          return true;
        }),
      );
    },
    [setOrderAutoPrinting],
  );

  const scheduleAutoPrintAlertDismiss = useCallback(
    (autoPreparedIds, delayMs) => {
      const waitMs = Math.max(0, delayMs);
      const orderIds = [...autoPreparedIds]
        .map(normalizeOrderId)
        .filter(Boolean);
      if (orderIds.length === 0) return;

      for (const orderId of orderIds) {
        minVisibleAlertIdsRef.current.add(orderId);

        const existing = autoPrintDismissTimeoutsRef.current.get(orderId);
        if (existing) clearTimeout(existing);

        autoPrintDismissTimeoutsRef.current.set(
          orderId,
          setTimeout(() => {
            dismissAutoPrintAlertForOrder(orderId);
          }, waitMs),
        );
      }
    },
    [dismissAutoPrintAlertForOrder],
  );

  const clearAutoPrintDismissTimeouts = useCallback(() => {
    for (const timeoutId of autoPrintDismissTimeoutsRef.current.values()) {
      clearTimeout(timeoutId);
    }
    autoPrintDismissTimeoutsRef.current.clear();
    minVisibleAlertIdsRef.current.clear();
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
          // Keep Auto sending… until min-visible setTimeout dismisses successes.
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

      const failedPolls = consecutiveErrorsRef.current;
      consecutiveErrorsRef.current = 0;
      if (failedPolls >= CONNECTION_LOST_AFTER_FAILURES) {
        connectionLostDismissedForOutageRef.current = false;
        // setConnectionLostAlert(null);
        toast.success("Connection restored!", { duration: 2000 });
      }

      // Show alerts immediately; dismiss after min-visible delay via setTimeout
      // (does not block the poll).
      const alertShownAt = Date.now();
      syncAlertsFromOrders(activeOrders);

      const autoPrintResult = await autoPrintEligibleSelfOrders(activeOrders);
      activeOrders = autoPrintResult.orders;

      if (autoPrintResult.autoPreparedIds.size > 0) {
        const remainingMs =
          AUTO_PRINT_ALERT_MIN_VISIBLE_MS - (Date.now() - alertShownAt);
        scheduleAutoPrintAlertDismiss(
          autoPrintResult.autoPreparedIds,
          remainingMs,
        );
      }

      syncAlertsFromOrders(activeOrders);
      return { success: true };
    } catch (error) {
      console.error("Self-order alert polling error:", error);
      consecutiveErrorsRef.current += 1;

      if (
        consecutiveErrorsRef.current === CONNECTION_LOST_AFTER_FAILURES &&
        !connectionLostDismissedForOutageRef.current
      ) {
        setConnectionLostAlert(buildConnectionLostAlert());
      }

      return { success: false, error };
    } finally {
      isPollingInProgressRef.current = false;
    }
  }, [
    autoPrintEligibleSelfOrders,
    menuConfig,
    scheduleAutoPrintAlertDismiss,
    syncAlertsFromOrders,
  ]);

  pollSelfOrderAlertsRef.current = pollSelfOrderAlerts;

  // Fixed setInterval clock (Held / table map style). Skip a tick when a poll
  // is still in progress; always restart the interval on foreground resume.
  useEffect(() => {
    if (externalPolling) {
      return () => {
        clearAutoPrintDismissTimeouts();
        isReturnSyncDoneRef.current = false;
        returnSyncCandidateIdsRef.current = new Set();
      };
    }

    if (!hasMenuConfig || !selfOrderAlertsEnabled) return undefined;

    let intervalId = null;
    let cancelled = false;

    const clearPollInterval = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const tickPoll = () => {
      if (cancelled) return;
      void pollSelfOrderAlertsRef.current?.();
    };

    const startPollInterval = () => {
      clearPollInterval();
      intervalId = setInterval(tickPoll, SELF_ORDER_ALERT_POLL_MS);
    };

    const resumePolling = () => {
      if (cancelled) return;
      tickPoll();
      startPollInterval();
    };

    const pausePolling = () => {
      clearPollInterval();
    };

    resumePolling();

    let appStateListener = null;

    if (isNative) {
      App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) resumePolling();
        else pausePolling();
      }).then((handle) => {
        if (cancelled) {
          handle.remove();
          return;
        }
        appStateListener = handle;
      });
    } else {
      const handleVisibilityChange = () => {
        if (document.hidden) pausePolling();
        else resumePolling();
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);

      return () => {
        cancelled = true;
        clearPollInterval();
        clearAutoPrintDismissTimeouts();
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
        isReturnSyncDoneRef.current = false;
        returnSyncCandidateIdsRef.current = new Set();
      };
    }

    return () => {
      cancelled = true;
      clearPollInterval();
      clearAutoPrintDismissTimeouts();
      if (appStateListener) {
        appStateListener.remove();
      }
      isReturnSyncDoneRef.current = false;
      returnSyncCandidateIdsRef.current = new Set();
    };
  }, [
    clearAutoPrintDismissTimeouts,
    externalPolling,
    hasMenuConfig,
    isNative,
    selfOrderAlertsEnabled,
  ]);

  useEffect(() => {
    if (externalPolling || !hasMenuConfig || !selfOrderAlertsEnabled) {
      return undefined;
    }

    const handleOnline = () => {
      void pollSelfOrderAlertsRef.current?.();
    };

    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [externalPolling, hasMenuConfig, selfOrderAlertsEnabled]);

  return {
    alerts: alertsWithProcessing,
    dismissSelfOrderAlert,
    prepareSelfOrderAlert,
    pollSelfOrderAlerts,
  };
}
