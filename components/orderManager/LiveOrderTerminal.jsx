"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import OrderCard from "./OrderCard";
import Logo from "../../public/images/logo.svg";
import {
  fetchOrders,
  fetchCompletedOrders,
  updateOrderStatus,
  updateOrderPaymentStatus,
  markOrderPayLater,
  createPrintJobsForOrder,
  checkPrinterAvailability,
} from "@/lib/api/fetchApi";
import {
  isCounterPayment,
  isDineInOrder,
  isPayLaterAtCounterEnabled,
  isPayLaterOrderInNewTab,
  shouldKeepDeliveredInActive,
  filterOrdersForActiveList,
} from "@/lib/helper/payLater";
import { isPendingCounterOrderForCollection } from "@/lib/helper/orderCollectAmount";
import { isOrderPaidForFulfillment } from "@/lib/helper/orderPaymentStatus";
import { summarizeCompletedOrderRefunds } from "@/lib/helper/completedOrderRefunds";
import {
  getUnpaidOrdersByTable,
  isUnpaidCounterDineInOrder,
} from "@/lib/helper/unpaidTableOrders";
import {
  Banknote,
  Bell,
  ChefHat,
  Check,
  Radio,
  Clock,
  X,
  CalendarClock,
  RefreshCw,
} from "lucide-react";
import { useGlobalAppContext } from "@/components/context/GlobalAppContext";
import OnlineOrderControlButton from "./OnlineOrderControlButton";
import PrepTimeControlButton from "./PrepTimeControlButton";
import ViewModeTab from "./ViewModeTab";
import MoreMenuButton from "./MoreMenuButton";
import PaymentMethodModal, {
  PAYMENT_METHOD_MODAL_CLOSED,
} from "./PaymentMethodModal";
import PayMultipleTablesModal, {
  PAY_MULTIPLE_TABLES_MODAL_CLOSED,
} from "./PayMultipleTablesModal";
import UnpaidTablesView from "./UnpaidTablesView";
import PrinterSelectionModal, {
  PRINTER_SELECTION_MODAL_CLOSED,
} from "./PrinterSelectionModal";
import DeleteOrderDrawer from "./DeleteOrderDrawer";
import PanelProductAvailability from "./PanelProductAvailability";
import { useMenuContext } from "../context/MenuContext";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { isNativeApp } from "@/lib/helper/platformDetection";
import toast from "react-hot-toast";
import { printKitchenOrder } from "@/lib/helper/printKitchenOrder";
import { compareOrdersByFulfillment } from "@/lib/helper/pickupTimeDisplay";
import { App } from "@capacitor/app";
import {
  getNotificationSoundUrl,
  NOTIFICATION_SOUND_REPLAY_INTERVAL_MS,
} from "@/lib/utils/notificationSound";
import {
  getNewOrderAlertsMuted,
  NEW_ORDER_ALERTS_MUTED_CHANGED_EVENT,
} from "@/lib/utils/newOrderAlerts";

/** Same criteria as the live new-order alert (paid online, or pending counter dine-in). */
function isNotificationWorthyOrder(order) {
  if (
    order.paymentStatus === "paid" &&
    !isCounterPayment(order.paymentMethod)
  ) {
    return true;
  }

  if (
    order.paymentStatus === "pending" &&
    isCounterPayment(order.paymentMethod) &&
    order.table !== "takeaway"
  ) {
    return true;
  }

  return false;
}

/** Still waiting for Prepare (kitchen not started). */
function isUnpreparedNewOrder(order) {
  return ["pending", "confirmed", "accepted"].includes(order.status);
}

/** Re-fire the new-order alert if dismissed but still unprepared after this long. */
const NEW_ORDER_REALERT_AFTER_MS = 3 * 60 * 1000;

/**
 * LiveOrderTerminal Component - Order Management Interface
 *
 * TIMEZONE HANDLING STRATEGY:
 *
 * 1. DATABASE STORAGE: All orders are stored with UTC timestamps (MongoDB default)
 * 2. USER INTERFACE: Users see and select dates in their local timezone
 * 3. DATE FILTERING: Local dates are converted to UTC ranges for accurate database queries
 *
 * HOW IT WORKS:
 * - User picks "Today" (e.g., 2024-01-15 in their local timezone)
 * - System creates local day boundaries: 00:00:00 to 23:59:59.999
 * - These local boundaries are converted to UTC for database comparison
 * - Database query finds all orders within the UTC range
 * - Result: User sees all orders from their "day" regardless of timezone
 *
 * EXAMPLE:
 * - User in UTC+8 (Singapore) picks "2024-01-15"
 * - Local day: 2024-01-15 00:00:00 to 2024-01-15 23:59:59.999
 * - UTC range: 2024-01-14 16:00:00 to 2024-01-15 15:59:59.999
 * - Database finds orders created within this UTC range
 * - User sees orders from their local "January 15th"
 */
export default function LiveOrderTerminal() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("new"); // "new", "scheduled", "preparing", "ready", "unpaid", "all", "completed", or "productAvailability"
  const viewModeRef = useRef(viewMode);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [completedOrdersLoading, setCompletedOrdersLoading] = useState(false);
  const audioRef = useRef(null);
  const soundIntervalRef = useRef(null);
  const playingAudioInstances = useRef(new Set());
  const appStateChangeCountRef = useRef(0);
  const [showNotification, setShowNotification] = useState(false);
  const showNotificationRef = useRef(false);
  const [notificationOrderCount, setNotificationOrderCount] = useState(0);
  // orderId -> dismissedAt (ms). Timestamps let us re-alert after 3 minutes.
  const [lastDismissedIds, setLastDismissedIds] = useState(() => new Set());
  const lastDismissedIdsRef = useRef(new Map());
  const ordersRef = useRef(orders);
  const printedOrderIdsRef = useRef(new Set());

  const replaceDismissedOrderIds = useCallback((orderIds) => {
    const ids = orderIds instanceof Set ? [...orderIds] : [...orderIds];
    const dismissedAt = Date.now();
    const next = new Map();
    for (const id of ids) next.set(id, dismissedAt);
    lastDismissedIdsRef.current = next;
    setLastDismissedIds(new Set(next.keys()));
  }, []);

  const addDismissedOrderIds = useCallback((orderIds) => {
    const next = new Map(lastDismissedIdsRef.current);
    const dismissedAt = Date.now();
    for (const id of orderIds) next.set(id, dismissedAt);
    lastDismissedIdsRef.current = next;
    setLastDismissedIds(new Set(next.keys()));
  }, []);
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [showAudioPrompt, setShowAudioPrompt] = useState(false);
  const { soundEnabled, notificationSoundId, newOrderAlertsMuted } =
    useGlobalAppContext();
  // Polling configuration
  const POLLING_INTERVALS = {
    ACTIVE: 10000, // 10 seconds when app is active
    IDLE: 30000, // 30 seconds when no active orders
    ERROR_BASE: 20000, // Base interval for errors (20 seconds)
    ERROR_MAX: 60000, // Max interval for errors (60 seconds)
  };

  // Polling state tracking
  const [isPollingActive, setIsPollingActive] = useState(true);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const consecutiveErrorsRef = useRef(0); // Ref for use in callbacks
  const pollingTimeoutRef = useRef(null);
  const lastPollTimeRef = useRef(null);
  const hasShownConnectedToastRef = useRef(false); // Track if we've shown the connected toast
  const isPollingInProgressRef = useRef(false); // Prevent concurrent polling instances

  const {
    storeProfile,
    menuId,
    menuConfig,
    refreshMenuDataWithToast,
    // itemGroups powers per-printer routing in handlePrintingOrder. Read-only
    // here — edits live in the admin app at /admin/menu/groups.
    itemGroups,
  } = useMenuContext();
  const { data: session } = useSession();
  const { userData } = useGlobalAppContext();

  // Platform detection
  const isNative = isNativeApp();

  const hasPreorderEnabled =
    Boolean(menuConfig?.preOrderingSettings?.pickUpEnabled) ||
    Boolean(menuConfig?.preOrderingSettings?.deliveryEnabled);

  // Pilot-store flag — all pay-later UI/API paths gate on this (default stores unchanged)
  const payLaterAtCounterEnabled = isPayLaterAtCounterEnabled(menuConfig);

  useEffect(() => {
    if (!hasPreorderEnabled && viewMode === "scheduled") {
      setViewMode("new");
    }
  }, [hasPreorderEnabled, viewMode]);

  // Polling function (defined before startPolling to avoid initialization error)
  const pollingOrders = useCallback(async () => {
    // Don't poll if app is in background
    if (!isPollingActive) {
      return;
    }

    // Prevent concurrent polling instances
    if (isPollingInProgressRef.current) {
      console.log("Polling already in progress, skipping...");
      return;
    }

    // Mark as in progress
    isPollingInProgressRef.current = true;
    lastPollTimeRef.current = Date.now();

    try {
      const data = await fetchOrders();
      const activeOrders = filterOrdersForActiveList(data, menuConfig);

      setOrders(activeOrders);

      // Successful fetch is the source of truth for connection status.
      const hadErrors = consecutiveErrorsRef.current > 0;
      consecutiveErrorsRef.current = 0;
      setConsecutiveErrors(0);

      if (hadErrors) {
        toast.success("Connection restored!", { duration: 2000 });
      }

      // Show connected toast on first successful poll after starting
      if (!hasShownConnectedToastRef.current) {
        hasShownConnectedToastRef.current = true;
        toast.success("Live orders connected!", { duration: 2000 });
      }

      // Check for new orders since last dismissal (not just last poll).
      // Also release dismissed-but-still-unprepared orders after 3 minutes
      // so the same full-screen alert can re-fire (mute respected below).
      const now = Date.now();
      const isMutedForRealert = getNewOrderAlertsMuted();
      const activeOrdersById = new Map(
        activeOrders.map((order) => [order._id, order]),
      );
      const dismissedMap = lastDismissedIdsRef.current;
      for (const [orderId, dismissedAt] of [...dismissedMap.entries()]) {
        const order = activeOrdersById.get(orderId);
        if (!order) {
          dismissedMap.delete(orderId);
          continue;
        }
        if (!isNotificationWorthyOrder(order) || !isUnpreparedNewOrder(order)) {
          dismissedMap.delete(orderId);
          continue;
        }
        if (
          !isMutedForRealert &&
          !showNotificationRef.current &&
          now - dismissedAt >= NEW_ORDER_REALERT_AFTER_MS
        ) {
          dismissedMap.delete(orderId);
        }
      }
      setLastDismissedIds(new Set(dismissedMap.keys()));

      const newOrdersSinceLastDismissal = activeOrders.filter(
        (order) => !lastDismissedIdsRef.current.has(order._id),
      );
      const notificationWorthyOrders = newOrdersSinceLastDismissal.filter(
        (order) =>
          isNotificationWorthyOrder(order) && isUnpreparedNewOrder(order),
      );

      if (notificationWorthyOrders.length > 0) {
        const isMuted = isMutedForRealert;

        if (!isMuted) {
          setNotificationOrderCount(notificationWorthyOrders.length);
        }
        // Auto-print orders if auto-printing is enabled
        const autoPrintingEnabled = menuConfig?.autoPrinting?.enabled;
        if (autoPrintingEnabled && storeProfile && userData?.ownerEmail) {
          // Filter out orders that have already been printed
          // Also exclude pending counter orders - they should only print when status changes to "preparing"
          const unprintedOrders = notificationWorthyOrders.filter((order) => {
            // Don't auto-print pending counter orders
            if (
              order.paymentStatus === "pending" &&
              isCounterPayment(order.paymentMethod)
            ) {
              return false;
            }
            return !printedOrderIdsRef.current.has(order._id);
          });
          console.log(
            "printedOrderIds right before filtering:",
            printedOrderIdsRef.current,
          );
          console.log("unprintedOrders", unprintedOrders);
          // Print only unprinted orders and collect printed IDs
          const newlyPrintedIds = [];
          for (const order of unprintedOrders) {
            try {
              const printResult = await handlePrintingOrder(order, null, 0, {
                source: "auto_print",
              });
              if (printResult.success) {
                console.log(
                  `Auto-printed successfully order ${order._id.slice(-6)}:`,
                  printResult,
                );
                newlyPrintedIds.push(order._id);
              } else {
                console.error(
                  `Error auto-printing order ${order._id}:`,
                  printResult.message,
                );
              }
            } catch (error) {
              console.error(`Error auto-printing order ${order._id}:`, error);
              // Don't block other orders if one fails
            }
          }

          // Update both the ref and state with all newly printed order IDs at once
          if (newlyPrintedIds.length > 0) {
            // Update ref immediately (synchronous)
            newlyPrintedIds.forEach((id) => printedOrderIdsRef.current.add(id));
            console.log(
              "Updated printed order ids ref:",
              printedOrderIdsRef.current,
            );
          }
        }

        if (isMuted) {
          addDismissedOrderIds(
            notificationWorthyOrders.map((order) => order._id),
          );
        } else if (!showNotificationRef.current) {
          setShowNotification(true);
          showNotificationRef.current = true;
          playSoundCycle();
        }
      }

      // Calculate next interval based on order activity
      const hasActiveOrders = activeOrders.length > 0;
      const nextInterval = hasActiveOrders
        ? POLLING_INTERVALS.ACTIVE
        : POLLING_INTERVALS.IDLE;

      // Schedule next poll only if app is still active
      if (isPollingActive) {
        // Clear any existing timeout before scheduling new one
        if (pollingTimeoutRef.current) {
          clearTimeout(pollingTimeoutRef.current);
        }
        pollingTimeoutRef.current = setTimeout(() => {
          pollingOrders();
        }, nextInterval);
      }
    } catch (error) {
      console.error("Polling error:", error);

      consecutiveErrorsRef.current += 1;
      setConsecutiveErrors(consecutiveErrorsRef.current);

      // Exponential backoff: min(ERROR_BASE * 2^(n-1), ERROR_MAX)
      const backoffInterval = Math.min(
        POLLING_INTERVALS.ERROR_BASE *
          Math.pow(2, Math.min(consecutiveErrorsRef.current - 1, 4)),
        POLLING_INTERVALS.ERROR_MAX,
      );

      // Retry after calculated interval (will keep retrying until success)
      if (isPollingActive) {
        console.log(
          `Polling failed (attempt ${consecutiveErrorsRef.current}). Retrying in ${backoffInterval / 1000}s...`,
        );

        // Clear any existing timeout before scheduling new one
        if (pollingTimeoutRef.current) {
          clearTimeout(pollingTimeoutRef.current);
        }
        pollingTimeoutRef.current = setTimeout(() => {
          pollingOrders(); // This will retry, and if it fails again, it will retry again
        }, backoffInterval);

        if (consecutiveErrorsRef.current === 1) {
          toast.error("Connection lost. Retrying...", { duration: 3000 });
        } else if (consecutiveErrorsRef.current % 3 === 0) {
          toast.error(
            `Still retrying... (attempt ${consecutiveErrorsRef.current})`,
            { duration: 2000 },
          );
        }
      }
    } finally {
      // Clear the in-progress flag
      isPollingInProgressRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPollingActive]);

  // Start polling (clears any existing timeout to prevent duplicates)
  const startPolling = useCallback(() => {
    // Don't start if already polling
    if (isPollingInProgressRef.current) {
      console.log("Polling already in progress, not starting new instance");
      return;
    }

    // Clear any existing polling timeout to prevent overlap
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }

    setIsPollingActive(true);

    // Reset the connected toast flag so it shows after successful poll
    hasShownConnectedToastRef.current = false;

    // Poll immediately when resuming (only if not already polling)
    if (!isPollingInProgressRef.current) {
      pollingOrders();
    }
  }, [pollingOrders]);

  // Stop polling when app goes to background
  const stopPolling = useCallback(() => {
    setIsPollingActive(false);

    // Clear any scheduled polls
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }

    // Note: Don't clear isPollingInProgressRef here because the current poll
    // should be allowed to finish. It will check isPollingActive and return early.
  }, []);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef(null);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(
    PAYMENT_METHOD_MODAL_CLOSED,
  );
  const [payMultipleTablesModal, setPayMultipleTablesModal] = useState(
    PAY_MULTIPLE_TABLES_MODAL_CLOSED,
  );
  const [showPrinterSelectionModal, setShowPrinterSelectionModal] = useState(
    PRINTER_SELECTION_MODAL_CLOSED,
  );
  const [availablePrinters, setAvailablePrinters] = useState([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelDrawerOpen, setCancelDrawerOpen] = useState(false);

  // Helper function to format date for display in user's local timezone
  const formatDateForDisplay = (date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Helper function to get timezone info for debugging
  const getTimezoneInfo = () => {
    const now = new Date();
    const timezoneOffset = now.getTimezoneOffset();
    const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;

    return {
      timezone: timezoneName,
      offset: timezoneOffset,
      offsetHours: Math.abs(timezoneOffset / 60),
      isAheadOfUTC: timezoneOffset < 0,
    };
  };

  // Function to fetch completed orders
  const fetchCompletedOrdersData = async () => {
    if (viewMode === "completed") {
      setCompletedOrdersLoading(true);
      try {
        // Convert local date to UTC date range for accurate database querying
        // This ensures we get all orders for the user's "day" regardless of timezone
        const localDate = selectedDate;

        // Create start of day in user's local timezone (e.g., 00:00:00)
        const startOfLocalDay = new Date(localDate);
        startOfLocalDay.setHours(0, 0, 0, 0);

        // Create end of day in user's local timezone (e.g., 23:59:59.999)
        const endOfLocalDay = new Date(localDate);
        endOfLocalDay.setHours(23, 59, 59, 999);

        // Convert local timezone boundaries to UTC for database comparison
        // This handles cases where user is ahead/behind UTC
        const startDateUTC = startOfLocalDay.toISOString();
        const endDateUTC = endOfLocalDay.toISOString();

        // Log timezone information for debugging
        const tzInfo = getTimezoneInfo();
        console.log(
          `🌍 User timezone: ${tzInfo.timezone} (${tzInfo.isAheadOfUTC ? "+" : "-"}${tzInfo.offsetHours}h from UTC)`,
        );
        console.log(`📅 Local date: ${formatDateForDisplay(localDate)}`);
        console.log(
          `🕐 Local day range: ${startOfLocalDay.toLocaleTimeString()} - ${endOfLocalDay.toLocaleTimeString()}`,
        );
        console.log(`🌐 UTC day range: ${startDateUTC} - ${endDateUTC}`);

        // Send both start and end dates to API for precise range filtering
        const data = await fetchCompletedOrders(startDateUTC, endDateUTC);
        setCompletedOrders(data.orders || []);
      } catch (error) {
        console.error("Error fetching completed orders:", error);
        setCompletedOrders([]);
      } finally {
        setCompletedOrdersLoading(false);
      }
    }
  };

  // Date picker modal
  // UI Components: Date picker modal
  const DatePickerModal = () => {
    if (!showDatePicker) return null;

    const handleDateSelect = (date) => {
      setSelectedDate(date);
      setShowDatePicker(false);
    };

    const handleClose = () => {
      setShowDatePicker(false);
    };

    // Get current timezone info for display
    const tzInfo = getTimezoneInfo();

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div
          ref={datePickerRef}
          className="w-80 max-w-sm rounded-lg bg-white p-6"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Select Trading Date
            </h3>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Timezone information for user clarity - temp hide */}
          <div className="mb-4 hidden rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
            <div className="font-medium">🌍 Your Timezone</div>
            <div>
              {tzInfo.timezone} ({tzInfo.isAheadOfUTC ? "+" : "-"}
              {tzInfo.offsetHours}h from UTC)
            </div>
            <div className="mt-1 text-xs text-blue-600">
              Orders will be filtered based on your local day boundaries
            </div>
          </div>

          <div className="space-y-3">
            {[
              { label: "Today", date: new Date() },
              {
                label: "Yesterday",
                date: new Date(Date.now() - 24 * 60 * 60 * 1000),
              },
              {
                label: "2 days ago",
                date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
              },
              {
                label: "3 days ago",
                date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
              },
              {
                label: "4 days ago",
                date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
              },
              {
                label: "5 days ago",
                date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
              },
              {
                label: "6 days ago",
                date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
              },
              {
                label: "7 days ago",
                date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              },
            ].map((option) => (
              <button
                key={option.label}
                onClick={() => handleDateSelect(option.date)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  selectedDate.toDateString() === option.date.toDateString()
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <div className="font-medium">{option.label}</div>
                <div className="text-sm text-gray-500">
                  {formatDateForDisplay(option.date)}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Effect for initial order loading
  useEffect(() => {
    async function loadInitialOrders() {
      setLoading(true);
      try {
        const data = await fetchOrders();
        const activeOrders = filterOrdersForActiveList(data, menuConfig);
        setOrders(activeOrders);
        console.log("activeOrders initial", activeOrders);
        replaceDismissedOrderIds(activeOrders.map((order) => order._id));
        setLoading(false);
      } catch (error) {
        setLoading(false);
        console.error("Failed to load initial orders:", error);
      }
    }

    loadInitialOrders();
  }, []);

  // Initialize polling on mount (replace SSE connection effect)
  // Wait for initial orders to load before starting polling to prevent duplicate notifications
  useEffect(() => {
    if (!session?.user?.id) return;
    if (loading) return; // Wait for initial orders to load first

    // Start polling after initial orders are loaded
    startPolling();

    // Cleanup on unmount
    return () => {
      stopPolling();
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
    };
  }, [session?.user?.id, loading, startPolling, stopPolling]);

  // Function to handle notification dismissal
  const handleNotificationDismiss = () => {
    setShowNotification(false);
    showNotificationRef.current = false; // Update ref immediately
    setNotificationOrderCount(0);
    replaceDismissedOrderIds(orders.map((order) => order._id));
    // Clear printed orders tracking when notification is dismissed
    printedOrderIdsRef.current.clear();
    stopSoundCycle();
    // Switch to new orders tab when notification is dismissed
    setViewMode("new");
  };

  // Handle app foreground/background (replace existing SSE handler)
  useEffect(() => {
    let appStateListener = null;

    if (isNative) {
      // Native app: Use Capacitor App plugin
      const handleAppStateChange = async ({ isActive }) => {
        console.log(
          "App state changed:",
          isActive ? "foreground" : "background",
        );

        if (isActive) {
          // App came to foreground - resume polling
          console.log("App returned to foreground, resuming polling...");
          startPolling();
        } else {
          // App went to background - stop polling
          console.log("App went to background, pausing polling...");
          stopPolling();
        }
      };

      appStateListener = App.addListener(
        "appStateChange",
        handleAppStateChange,
      );
    } else {
      // Web: Use Page Visibility API
      const handleVisibilityChange = () => {
        const isVisible = !document.hidden;
        console.log(
          "Page visibility changed:",
          isVisible ? "visible" : "hidden",
        );

        if (isVisible) {
          // Page became visible - resume polling
          console.log("Page became visible, resuming polling...");
          startPolling();
        } else {
          // Page became hidden - stop polling
          console.log("Page became hidden, pausing polling...");
          stopPolling();
        }
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);

      // Cleanup for web
      return () => {
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
      };
    }

    // Cleanup for native
    return () => {
      if (appStateListener) {
        appStateListener.remove();
      }
    };
  }, [isNative, startPolling, stopPolling]);

  // Browser online/offline are hints only — status comes from poll success/failure.
  useEffect(() => {
    const handleOnline = () => {
      console.log("Browser reported online — polling to verify connection");
      if (isPollingActive && !isPollingInProgressRef.current) {
        if (pollingTimeoutRef.current) {
          clearTimeout(pollingTimeoutRef.current);
          pollingTimeoutRef.current = null;
        }
        pollingOrders();
      }
    };

    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [isPollingActive, pollingOrders]);

  // Separate useEffect to log when state actually changes
  // useEffect(() => {
  //   if (pollingInitialized) {
  //     console.log("Polling initialized", pollingInitialized);
  //   }
  // }, [pollingInitialized]);

  // Update refs when state changes
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);
  useEffect(() => {
    showNotificationRef.current = showNotification;
  }, [showNotification]);
  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  // Effect to fetch completed orders when view mode changes
  useEffect(() => {
    console.log("useEffect viewMode run");
    console.log("viewMode", viewMode);

    if (viewMode === "completed") {
      fetchCompletedOrdersData();
    }
  }, [viewMode, selectedDate]);

  // Effect to handle view mode changes when Pay at Counter is disabled
  useEffect(() => {
    // If user is on "unpaid" view but Pay at Counter is disabled, switch to "new" view
    if (viewMode === "unpaid" && !storeProfile?.paymentMethods?.cash?.enabled) {
      setViewMode("new");
    }
  }, [storeProfile?.paymentMethods?.cash?.enabled, viewMode]);

  // Handle click outside date picker
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        datePickerRef.current &&
        !datePickerRef.current.contains(event.target)
      ) {
        setShowDatePicker(false);
      }
    };

    if (showDatePicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDatePicker]);

  // Function to initialize audio with user interaction (web only)
  const initializeAudio = async () => {
    if (!audioRef.current || isNative) return;

    try {
      // Play and immediately pause to initialize audio context
      await audioRef.current.play();
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setAudioInitialized(true);
      setShowAudioPrompt(false);
      console.log("Audio initialized successfully");
    } catch (error) {
      console.error("Failed to initialize audio:", error);
      setShowAudioPrompt(true);
    }
  };

  // Function to play sound continuously with intervals
  const playSoundCycle = () => {
    if (!soundEnabled || newOrderAlertsMuted || !audioRef.current) return;

    const playSound = async () => {
      try {
        // Check if we should still be playing (prevent race condition)
        if (!showNotificationRef.current) return;

        // Create a new audio element for each play to allow overlapping
        const audioClone = new Audio(
          getNotificationSoundUrl(notificationSoundId),
        );

        // Track this audio instance
        playingAudioInstances.current.add(audioClone);

        // Remove from tracking when audio ends
        audioClone.addEventListener("ended", () => {
          playingAudioInstances.current.delete(audioClone);
        });

        // Remove from tracking if audio fails
        audioClone.addEventListener("error", () => {
          playingAudioInstances.current.delete(audioClone);
        });

        try {
          await audioClone.play();
        } catch (playError) {
          // If play fails, remove from tracking immediately
          playingAudioInstances.current.delete(audioClone);
          throw playError; // Re-throw to be caught by outer try-catch
        }

        // Double-check before scheduling next play (prevent race condition)
        if (showNotificationRef.current) {
          soundIntervalRef.current = setTimeout(
            playSound,
            NOTIFICATION_SOUND_REPLAY_INTERVAL_MS,
          );
        }
      } catch (error) {
        console.error("Error playing sound:", error);
        // If audio fails to play, show the audio prompt (web only)
        if (!audioInitialized && !isNative) {
          setShowAudioPrompt(true);
        }
      }
    };

    playSound();
  };

  // Function to stop all sound intervals
  const stopSoundCycle = () => {
    // Clear the timeout to prevent new sounds from being scheduled
    if (soundIntervalRef.current) {
      clearTimeout(soundIntervalRef.current);
      soundIntervalRef.current = null;
    }

    // Stop all currently playing audio instances
    playingAudioInstances.current.forEach((audio) => {
      try {
        // Additional safety check for audio object
        if (audio && typeof audio.pause === "function") {
          audio.pause();
          audio.currentTime = 0;
        }
      } catch (error) {
        console.error("Error stopping audio:", error);
      }
    });

    // Clear the tracking set
    playingAudioInstances.current.clear();
  };

  // Mute on: stop alert and mark current queue as seen (no backlog on unmute)
  useEffect(() => {
    function handleNewOrderAlertsMutedChanged(event) {
      const muted =
        typeof event?.detail?.muted === "boolean"
          ? event.detail.muted
          : getNewOrderAlertsMuted();
      if (!muted) return;

      setShowNotification(false);
      showNotificationRef.current = false;
      setNotificationOrderCount(0);
      stopSoundCycle();
      replaceDismissedOrderIds(ordersRef.current.map((order) => order._id));
    }

    window.addEventListener(
      NEW_ORDER_ALERTS_MUTED_CHANGED_EVENT,
      handleNewOrderAlertsMutedChanged,
    );
    return () => {
      window.removeEventListener(
        NEW_ORDER_ALERTS_MUTED_CHANGED_EVENT,
        handleNewOrderAlertsMutedChanged,
      );
    };
  }, [replaceDismissedOrderIds]);

  // Show audio prompt on first visit if sound is enabled (web only)
  useEffect(() => {
    if (
      soundEnabled &&
      !newOrderAlertsMuted &&
      !audioInitialized &&
      !loading &&
      !isNative
    ) {
      // Small delay to let the page load first
      setTimeout(() => {
        setShowAudioPrompt(true);
      }, 1000);
    }
  }, [soundEnabled, newOrderAlertsMuted, audioInitialized, loading, isNative]);

  // Auto-initialize audio for native apps
  useEffect(() => {
    if (
      isNative &&
      soundEnabled &&
      !newOrderAlertsMuted &&
      !audioInitialized &&
      !loading
    ) {
      // For native apps, we can initialize audio automatically
      setAudioInitialized(true);
      console.log("Audio auto-initialized for native app");
    }
  }, [isNative, soundEnabled, newOrderAlertsMuted, audioInitialized, loading]);

  // Keep hidden <audio> src in sync when user changes notification sound in More menu
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.src = getNotificationSoundUrl(notificationSoundId);
    audioRef.current.load();
  }, [notificationSoundId]);

  // Cleanup sound intervals on component unmount
  useEffect(() => {
    return () => {
      stopSoundCycle();
    };
  }, []);

  const handlePrintingOrder = async (
    order,
    selectedPrinters = null,
    retryCount = 0,
    options = {},
  ) =>
    printKitchenOrder(order, {
      storeProfile,
      itemGroups,
      menuConfig,
      selectedPrinters,
      retryCount,
      showCustomToast,
      ...options,
    });

  // Handle opening printer selection modal
  const handleOpenPrinterSelection = async (order) => {
    try {
      setLoadingPrinters(true);

      // Determine order type
      const canonical = String(order?.orderType ?? "").trim();
      const isDineIn =
        canonical === "dine-in" || (order.table && order.table !== "takeaway");
      const orderType = isDineIn ? "dinein" : "takeaway";

      // Fetch available printers for this order type
      const printersAvailability = await checkPrinterAvailability(orderType);

      if (printersAvailability.available && printersAvailability.printers) {
        setAvailablePrinters(printersAvailability.printers);
        setShowPrinterSelectionModal({
          order: order,
          show: true,
        });
      } else {
        showCustomToast(
          `No printers available for ${orderType} orders`,
          "error",
        );
      }
    } catch (error) {
      console.error("Error fetching printers:", error);
      showCustomToast("Failed to load printers", "error");
    } finally {
      setLoadingPrinters(false);
    }
  };

  // Handle printer selection and print
  const handlePrinterSelectAndPrint = async (selectedPrinter) => {
    if (!showPrinterSelectionModal.order) return;

    const order = showPrinterSelectionModal.order;

    closePrinterSelectionModal();

    // Print to selected printer
    const printResult = await handlePrintingOrder(order, [selectedPrinter], 0, {
      source: "manual",
    });

    if (printResult.success) {
      toast.success(`Order printed to ${selectedPrinter.name}`);
    }
  };

  // Same path as auto-print: all applicable printers + group routing warnings
  const handlePrintToAllPrinters = async () => {
    if (!showPrinterSelectionModal.order) return;

    const order = showPrinterSelectionModal.order;
    closePrinterSelectionModal();
    await handlePrintingOrder(order);
  };

  // Handle order status updates and control printing
  // only printing docket when order status is changed to "preparing" and auto-printing is disabled
  const handleStatusUpdate = async (orderId, newStatus, options = {}) => {
    // Prevent double-clicks by checking if order is already being processed
    if (processingOrders.has(orderId)) {
      return false;
    }

    // Mark order as processing
    setProcessingOrders((prev) => new Set(prev).add(orderId));

    try {
      const updatedOrder = await updateOrderStatus(orderId, newStatus, options);

      // Update local state
      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order._id === orderId ? updatedOrder : order,
        ),
      );

      // Hardcoded for creating print jobs when order status is changed to "preparing" - Now I want to temporary disable this feature
      const createPrintJobs = false;
      // Currently I want to disable this feature so the following if statement never runs
      // Create print jobs when order status is changed to "preparing" ONLY if auto-printing is disabled
      if (
        newStatus === "preparing" &&
        storeProfile &&
        userData?.ownerEmail &&
        createPrintJobs
      ) {
        try {
          const order = orders.find((o) => o._id === orderId);
          if (order) {
            // Check if auto-printing is enabled
            const autoPrintingEnabled = menuConfig?.autoPrinting?.enabled;

            // Only create print jobs if auto-printing is DISABLED
            if (!autoPrintingEnabled) {
              // Determine order type
              const canonical = String(order?.orderType ?? "").trim();
              const isDineIn =
                canonical === "dine-in" ||
                (order.table && order.table !== "takeaway");
              const orderType = isDineIn ? "dinein" : "takeaway";

              // Check printer availability first
              const availability = await checkPrinterAvailability(
                userData.ownerEmail,
                orderType,
                false, // isBackend = false for frontend manual printing
              );

              if (availability.available) {
                // Create print jobs if printers are available
                const printResult = await createPrintJobsForOrder(
                  order,
                  storeProfile.menuLink,
                  userData.ownerEmail,
                  menuId, // Pass menuId as storeId
                  availability.printers, // Pass printer data to avoid duplicate API calls
                  false, // isBackend = false for frontend manual printing
                );

                if (printResult.success) {
                  console.log(
                    "Print jobs created successfully (manual printing):",
                    printResult.message,
                  );
                } else {
                  console.log(
                    "Print job creation failed:",
                    printResult.message,
                  );
                }
              } else {
                // Log that no printers are available for this order type
                console.log(
                  `No printers available for ${orderType} orders:`,
                  availability.message,
                );
              }
            } else {
              console.log(
                "Auto-printing is enabled - skipping manual print job creation",
              );
            }
          }
        } catch (error) {
          console.error("Error creating print jobs:", error);
          // Don't block the order status update if printing fails
        }
      }

      // Print order when order status is changed to "preparing"
      // Counter orders should always print when status changes to "preparing"
      // Non-counter orders only print if auto-printing is disabled
      const autoPrintingEnabled = menuConfig?.autoPrinting?.enabled;
      if (newStatus === "preparing" && storeProfile && userData?.ownerEmail) {
        try {
          const order = orders.find((o) => o._id === orderId);
          if (order) {
            // Always print counter orders when status changes to "preparing"
            // For non-counter orders, only print if auto-printing is disabled
            const isCounterOrder = isCounterPayment(order.paymentMethod);
            if (isCounterOrder || !autoPrintingEnabled) {
              const printResult = await handlePrintingOrder(order, null, 0, {
                source: "prepare",
              });
              if (!printResult?.success) {
                console.warn(
                  `[prepare print] Order ${order._id.slice(-6)} failed:`,
                  printResult?.message,
                );
              }
            }
          }
        } catch (error) {
          console.error("Error printing order:", error);
        }
      }

      // If order is delivered or cancelled, remove it after a delay
      // Pay-later dine-in orders stay active until payment is collected
      if (["delivered", "cancelled"].includes(newStatus)) {
        const keepDeliveredPayLater =
          newStatus === "delivered" &&
          shouldKeepDeliveredInActive(updatedOrder, menuConfig);
        if (!keepDeliveredPayLater) {
          setTimeout(() => {
            setOrders((prevOrders) =>
              prevOrders.filter((order) => order._id !== orderId),
            );
          }, 5000);
        }
      }

      return true;
    } catch (error) {
      console.error(
        `Failed to update order ${orderId} to ${newStatus}:`,
        error,
      );
      return false;
    } finally {
      // Remove order from processing set when operation completes
      setProcessingOrders((prev) => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };

  function buildLiveCancelTarget(order) {
    const orderIdShort = order._id?.slice(-6).toUpperCase();
    const isPaid = order.paymentStatus === "paid";
    const customerName = String(order.customerName || "").trim();
    const table = String(order.table || "").trim();

    const subtitleParts = [];
    if (customerName) subtitleParts.push(customerName);
    if (table && table !== "takeaway") subtitleParts.push(`Table ${table}`);
    if (isPaid) subtitleParts.push("Paid — refund manually if needed");

    return {
      id: order._id,
      orderId: order._id,
      title: `Cancel order #${orderIdShort}`,
      subtitle: subtitleParts.join(" · ") || undefined,
      ticketCount: 1,
      confirmLabel: "Confirm cancel",
      processingLabel: "Cancelling…",
      otherPlaceholder: "Describe why this order is being cancelled",
      warningMessage: isPaid
        ? "This order is already paid. You'll need to process a refund manually. This will cancel the order and cannot be undone."
        : "This will cancel this order. This action cannot be undone.",
    };
  }

  function handleCancelOrder(order) {
    if (!order?._id || processingOrders.has(order._id)) return;
    setCancelTarget(buildLiveCancelTarget(order));
    setCancelDrawerOpen(true);
  }

  async function handleConfirmCancel(cancelReason) {
    if (!cancelTarget?.orderId || processingOrders.has(cancelTarget.orderId)) {
      return;
    }

    const success = await handleStatusUpdate(
      cancelTarget.orderId,
      "cancelled",
      {
        cancelReason,
        requireCancelReason: true,
      },
    );

    if (success) {
      setCancelDrawerOpen(false);
      setCancelTarget(null);
      return;
    }

    toast.error("Failed to cancel order");
  }
  // Handle marking counter order as paid with payment method selection
  const handleMarkAsPaid = async (orderId, paymentMethod = null) => {
    // If no payment method specified, show selection modal
    if (!paymentMethod) {
      setShowPaymentMethodModal({
        orderId,
        tableOrders: null,
        isBulk: false,
        show: true,
      });
      return;
    }

    // Prevent double-clicks by checking if order is already being processed
    if (processingOrders.has(orderId)) {
      return;
    }

    // Mark order as processing
    setProcessingOrders((prev) => new Set(prev).add(orderId));

    try {
      // Find the current order to check if it's dine-in and pending
      const currentOrder = orders.find((order) => order._id === orderId);
      const isDineIn =
        currentOrder && currentOrder.table && currentOrder.table !== "takeaway";
      const isPending = currentOrder && currentOrder.status === "pending";
      const isPreorderCounterPending =
        currentOrder &&
        currentOrder.isPreorder &&
        isPending &&
        isCounterPayment(currentOrder.paymentMethod);

      // Update payment status first
      const updatedOrder = await updateOrderPaymentStatus(
        orderId,
        "paid",
        paymentMethod,
      );

      // If it's a dine-in order that was pending, also update status to confirmed
      // Counter pre-order pending should also move to confirmed after payment.
      if ((isDineIn && isPending) || isPreorderCounterPending) {
        try {
          const orderWithUpdatedStatus = await updateOrderStatus(
            orderId,
            "confirmed",
          );
          // Update local state with the order that has both payment and status updated
          setOrders((prevOrders) =>
            prevOrders.map((order) =>
              order._id === orderId ? orderWithUpdatedStatus : order,
            ),
          );
          console.log(
            `Marked dine-in order ${orderId} as paid with ${paymentMethod} and updated status to confirmed`,
          );
        } catch (statusError) {
          console.error(
            `Failed to update order status to confirmed:`,
            statusError,
          );
          // Even if status update fails, still update with payment status
          setOrders((prevOrders) =>
            prevOrders.map((order) =>
              order._id === orderId ? updatedOrder : order,
            ),
          );
        }
      } else {
        // For non-dine-in or non-pending orders, just update with payment status
        setOrders((prevOrders) =>
          prevOrders.map((order) =>
            order._id === orderId ? updatedOrder : order,
          ),
        );
      }

      console.log(`Marked order ${orderId} as paid with ${paymentMethod}`);
      setShowPaymentMethodModal(PAYMENT_METHOD_MODAL_CLOSED);
    } catch (error) {
      console.error(`Failed to mark order ${orderId} as paid:`, error);
    } finally {
      // Remove order from processing set when operation completes
      setProcessingOrders((prev) => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };

  const handleRefundSuccess = (orderId, result) => {
    setOrders((prevOrders) =>
      prevOrders.map((order) =>
        order._id === orderId
          ? {
              ...order,
              paymentStatus: result.order?.paymentStatus ?? order.paymentStatus,
              refund: result.refund ?? order.refund,
            }
          : order,
      ),
    );
    setCompletedOrders((prevOrders) =>
      prevOrders.map((order) =>
        order._id === orderId
          ? {
              ...order,
              paymentStatus: result.order?.paymentStatus ?? order.paymentStatus,
              refund: result.refund ?? order.refund,
            }
          : order,
      ),
    );
  };

  const handlePayLater = async (orderId) => {
    if (!payLaterAtCounterEnabled) {
      return;
    }

    if (processingOrders.has(orderId)) {
      return;
    }

    setProcessingOrders((prev) => new Set(prev).add(orderId));

    try {
      const currentOrder = orders.find((order) => order._id === orderId);
      const isPending = currentOrder && currentOrder.status === "pending";
      const isDineIn = currentOrder && isDineInOrder(currentOrder);

      const updatedOrder = await markOrderPayLater(
        orderId,
        payLaterAtCounterEnabled,
      );

      if (isDineIn && isPending) {
        try {
          const orderWithUpdatedStatus = await updateOrderStatus(
            orderId,
            "confirmed",
          );
          setOrders((prevOrders) =>
            prevOrders.map((order) =>
              order._id === orderId ? orderWithUpdatedStatus : order,
            ),
          );
        } catch (statusError) {
          console.error(
            `Failed to update order status to confirmed:`,
            statusError,
          );
          setOrders((prevOrders) =>
            prevOrders.map((order) =>
              order._id === orderId ? updatedOrder : order,
            ),
          );
        }
      } else {
        setOrders((prevOrders) =>
          prevOrders.map((order) =>
            order._id === orderId ? updatedOrder : order,
          ),
        );
      }

      setShowPaymentMethodModal(PAYMENT_METHOD_MODAL_CLOSED);
    } catch (error) {
      console.error(`Failed to mark order ${orderId} as pay later:`, error);
    } finally {
      setProcessingOrders((prev) => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };

  const closePaymentMethodModal = () => {
    setShowPaymentMethodModal(PAYMENT_METHOD_MODAL_CLOSED);
  };

  const closePayMultipleTablesModal = () => {
    setPayMultipleTablesModal(PAY_MULTIPLE_TABLES_MODAL_CLOSED);
  };

  const handlePayMultipleTablesCollect = (tableOrders) => {
    closePayMultipleTablesModal();
    setShowPaymentMethodModal({
      orderId: null,
      tableOrders,
      isBulk: true,
      show: true,
    });
  };

  const handlePaymentMethodModalSelect = (method) => {
    const paymentMethod = method === "cash" ? "counter-cash" : "counter-card";

    if (showPaymentMethodModal.isBulk && showPaymentMethodModal.tableOrders) {
      showPaymentMethodModal.tableOrders.forEach((order) => {
        if (isPendingCounterOrderForCollection(order)) {
          handleMarkAsPaid(order._id, paymentMethod);
        }
      });
    } else if (showPaymentMethodModal.orderId) {
      handleMarkAsPaid(showPaymentMethodModal.orderId, paymentMethod);
    }

    setShowPaymentMethodModal(PAYMENT_METHOD_MODAL_CLOSED);
  };

  const handlePaymentMethodModalPayLater = () => {
    if (showPaymentMethodModal.orderId) {
      handlePayLater(showPaymentMethodModal.orderId);
    }
    setShowPaymentMethodModal(PAYMENT_METHOD_MODAL_CLOSED);
  };

  const closePrinterSelectionModal = () => {
    setShowPrinterSelectionModal(PRINTER_SELECTION_MODAL_CLOSED);
    setAvailablePrinters([]);
  };

  // Filter orders based on view mode
  const getFilteredOrders = () => {
    function sortOldestFirst(list) {
      return [...list].sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      );
    }

    if (viewMode === "all") {
      return sortOldestFirst(
        orders.filter((order) => {
          // For pending orders, only show counter payments
          if (order.status === "pending") {
            return isCounterPayment(order.paymentMethod);
          }
          // For other statuses, show all orders including delivered with pending payment
          return (
            ["confirmed", "accepted", "preparing", "ready"].includes(
              order.status,
            ) ||
            (order.status === "delivered" && order.paymentStatus === "pending")
          );
        }),
      );
    } else if (viewMode === "unpaid") {
      return orders.filter(isUnpaidCounterDineInOrder);
    } else if (viewMode === "scheduled") {
      return orders
        .filter(
          (order) =>
            order.isPreorder &&
            order.status === "accepted" &&
            isOrderPaidForFulfillment(order.paymentStatus),
        )
        .sort((a, b) => compareOrdersByFulfillment(a, b));
    } else if (viewMode === "new") {
      // New incoming orders:
      // - confirmed + paid for non-counter (card) orders
      // - pending + unpaid for counter orders
      // - confirmed + paid for counter orders (so staff can prepare them)
      return sortOldestFirst(
        orders.filter(
          (order) =>
            (order.status === "confirmed" &&
              isOrderPaidForFulfillment(order.paymentStatus) &&
              !isCounterPayment(order.paymentMethod)) ||
            (order.status === "pending" &&
              order.paymentStatus === "pending" &&
              isCounterPayment(order.paymentMethod)) ||
            (order.status === "confirmed" &&
              isOrderPaidForFulfillment(order.paymentStatus) &&
              isCounterPayment(order.paymentMethod)) ||
            isPayLaterOrderInNewTab(order, menuConfig),
        ),
      );
    } else if (viewMode === "preparing") {
      return sortOldestFirst(
        orders.filter((order) => order.status === "preparing"),
      );
    } else if (viewMode === "ready") {
      return sortOldestFirst(
        orders.filter((order) => order.status === "ready"),
      );
    } else if (viewMode === "completed") {
      return orders.filter((order) => order.status === "delivered");
    } else if (viewMode === "productAvailability") {
      return [];
    }
    return orders;
  };

  const filteredOrders = getFilteredOrders();
  const unpaidOrdersByTable = getUnpaidOrdersByTable(orders);
  const unpaidTableCount = Object.keys(unpaidOrdersByTable).length;
  const scheduledCount = orders.filter(
    (order) =>
      order.isPreorder &&
      order.status === "accepted" &&
      isOrderPaidForFulfillment(order.paymentStatus),
  ).length;
  const newOrdersCount = orders.filter(
    (order) =>
      (order.status === "confirmed" &&
        isOrderPaidForFulfillment(order.paymentStatus) &&
        !isCounterPayment(order.paymentMethod)) ||
      (order.status === "pending" &&
        order.paymentStatus === "pending" &&
        isCounterPayment(order.paymentMethod)) ||
      (order.status === "confirmed" &&
        isOrderPaidForFulfillment(order.paymentStatus) &&
        isCounterPayment(order.paymentMethod)) ||
      isPayLaterOrderInNewTab(order, menuConfig),
  ).length;
  const allActiveCount = orders.filter((order) => {
    if (order.status === "pending")
      return isCounterPayment(order.paymentMethod);
    return (
      ["confirmed", "accepted", "preparing", "ready"].includes(order.status) ||
      (order.status === "delivered" && order.paymentStatus === "pending")
    );
  }).length;

  const preparingCount = orders.filter(
    (order) => order.status === "preparing",
  ).length;
  const readyCount = orders.filter((order) => order.status === "ready").length;
  const completedCount = completedOrders.length;
  const completedRefundSummary = useMemo(
    () => summarizeCompletedOrderRefunds(completedOrders),
    [completedOrders],
  );
  const unpaidTablesBadgeCount = unpaidTableCount;

  const [customToast, setCustomToast] = useState({
    show: false,
    type: "error", // 'error', 'success', 'warning'
    message: "",
    id: null,
    retry: null,
  });
  const [isPrintToastRetrying, setIsPrintToastRetrying] = useState(false);

  // Item tracking state - persists across view mode changes
  const [orderItemTracking, setOrderItemTracking] = useState({});

  // Track orders that are currently being processed to prevent double-clicks
  const [processingOrders, setProcessingOrders] = useState(new Set());

  // Item tracking management functions
  const toggleItemCompletion = (orderId, itemIndex) => {
    setOrderItemTracking((prev) => {
      const orderTracking = prev[orderId] || [];
      const newCompleted = orderTracking.includes(itemIndex)
        ? orderTracking.filter((i) => i !== itemIndex)
        : [...orderTracking, itemIndex];

      return {
        ...prev,
        [orderId]: newCompleted,
      };
    });
  };

  const getCompletedItems = (orderId) => {
    return orderItemTracking[orderId] || [];
  };

  const isItemCompleted = (orderId, itemIndex) => {
    return getCompletedItems(orderId).includes(itemIndex);
  };

  const showCustomToast = (message, type = "error", retry = null) => {
    const id = Date.now() + Math.random();
    setCustomToast({
      show: true,
      type,
      message,
      id,
      retry,
    });
  };

  const hideCustomToast = () => {
    setCustomToast({
      show: false,
      type: "error",
      message: "",
      id: null,
      retry: null,
    });
    setIsPrintToastRetrying(false);
  };

  const handlePrintToastRetry = async () => {
    const retry = customToast.retry;
    if (!retry?.order || isPrintToastRetrying) return;

    setIsPrintToastRetrying(true);

    try {
      const freshOrder =
        orders.find((entry) => entry._id === retry.order._id) || retry.order;

      const result = await printKitchenOrder(freshOrder, {
        storeProfile,
        itemGroups,
        menuConfig,
        selectedPrinters: retry.failedPrinters?.length
          ? retry.failedPrinters
          : null,
        source: "retry",
        showCustomToast,
      });

      if (result?.success && (result.failedPrints ?? 0) === 0) {
        hideCustomToast();
      }
    } catch (error) {
      console.error("Print toast retry failed:", error);
    } finally {
      setIsPrintToastRetrying(false);
    }
  };

  return (
    <>
      <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#1a1a1a] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        {/* Audio element for notifications */}
        <audio
          ref={audioRef}
          src={getNotificationSoundUrl(notificationSoundId)}
        />

        {/* Top chrome: audio prompt + header (single safe-area top inset) */}
        <div className="shrink-0 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          {/* Audio Permission Prompt - Web Only */}
          {showAudioPrompt && !isNative && (
            <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Bell className="mr-2 h-5 w-5 text-yellow-600" />
                  <div>
                    <h3 className="text-sm font-medium text-yellow-800">
                      Enable Sound Notifications
                    </h3>
                    <p className="text-sm text-yellow-700">
                      Click &quot;Enable Sound&quot; to hear audio alerts for
                      new orders.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={initializeAudio}
                    className="rounded-md bg-yellow-600 px-3 py-2 text-sm font-medium text-white hover:bg-yellow-700"
                  >
                    Enable Sound
                  </button>
                  <button
                    onClick={() => setShowAudioPrompt(false)}
                    className="rounded-md bg-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-400"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-start justify-between">
            {/* quick settings */}
            <div className="mb-3 flex gap-4 rounded-3xl bg-[#0000003d] p-3 ring-2 ring-[#222222]">
              {/* logo */}
              <div className="hidden h-auto flex-col items-center justify-center gap-0 rounded-lg bg-gray-100 px-4 py-1 text-left transition-colors hover:bg-gray-200">
                <Image
                  src={Logo}
                  alt="GoEasyMenu"
                  auto="true"
                  className="mx-auto w-[24px]"
                  priority
                />
                {/* <h1 className="font-bold">
                {storeProfile?.storeName || "Store Name"}
              </h1> */}
              </div>
              {/* Polling Status Indicator — driven by poll success/failure, not navigator.onLine */}
              <div
                className={`hidden h-auto items-center gap-2 rounded-lg px-3 py-1 text-sm font-medium transition-colors lg:flex ${
                  isPollingActive && consecutiveErrors === 0
                    ? "bg-neutral-700 text-green-500"
                    : consecutiveErrors > 0
                      ? "bg-red-100 text-red-800"
                      : "bg-yellow-100 text-yellow-800"
                }`}
              >
                <div
                  className={`h-3 w-3 rounded-full ${
                    isPollingActive && consecutiveErrors === 0
                      ? "animate-pulse bg-green-500"
                      : consecutiveErrors > 0
                        ? "bg-red-500"
                        : "bg-yellow-500"
                  }`}
                ></div>
                <span>
                  {!isPollingActive
                    ? "OFFLINE"
                    : consecutiveErrors > 0
                      ? "CONNECTING"
                      : "LIVE"}
                </span>
              </div>
              {/* Button for controlling online orders */}
              <OnlineOrderControlButton />
              {/* Button for controlling prep time */}
              <PrepTimeControlButton />
              {/* Button for refreshing app data - temporary disabled as not working properly */}
              {/* <button
              onClick={handleFullRefresh}
              className="btn flex h-auto flex-col items-center gap-0 rounded-xl px-4 py-1 text-center transition-colors hover:bg-gray-200"
              title={isNative ? "Refresh app data" : "Refresh page"}
            >
              <RefreshCw className="size-5 text-gray-600" />
            </button> */}
            </div>

            {/* View Mode Tabs */}
            <div className="mb-6 flex flex-wrap gap-3">
              <div className="hidden flex-wrap gap-1 rounded-3xl bg-[#0000003d] p-3 ring-2 ring-[#222222] md:flex lg:gap-3">
                <ViewModeTab
                  icon={Bell}
                  label="New"
                  count={newOrdersCount}
                  isActive={viewMode === "new"}
                  onClick={() => setViewMode("new")}
                />
                {hasPreorderEnabled ? (
                  <ViewModeTab
                    icon={CalendarClock}
                    label="Scheduled"
                    count={scheduledCount}
                    isActive={viewMode === "scheduled"}
                    onClick={() => setViewMode("scheduled")}
                  />
                ) : null}
                <ViewModeTab
                  icon={ChefHat}
                  label="Preparing"
                  count={preparingCount}
                  isActive={viewMode === "preparing"}
                  onClick={() => setViewMode("preparing")}
                />
                <ViewModeTab
                  icon={Check}
                  label="Ready"
                  count={readyCount}
                  isActive={viewMode === "ready"}
                  onClick={() => setViewMode("ready")}
                />
                {/* Only show Unpaid tab if Pay at Counter payment method is enabled */}
                {storeProfile?.paymentMethods?.cash?.enabled && (
                  <ViewModeTab
                    icon={Banknote}
                    label="Unpaid"
                    count={unpaidTablesBadgeCount}
                    isActive={viewMode === "unpaid"}
                    onClick={() => setViewMode("unpaid")}
                  />
                )}
                <ViewModeTab
                  icon={Radio}
                  label="Active"
                  count={allActiveCount}
                  isActive={viewMode === "all"}
                  onClick={() => setViewMode("all")}
                />
              </div>
              {/* Add new tab here as a more menu button */}
              <MoreMenuButton
                setViewMode={setViewMode}
                viewMode={viewMode}
                newOrdersCount={newOrdersCount}
                scheduledCount={scheduledCount}
                hasPreorderEnabled={hasPreorderEnabled}
                preparingCount={preparingCount}
                readyCount={readyCount}
                allActiveCount={allActiveCount}
                unpaidTablesBadgeCount={unpaidTablesBadgeCount}
                storeProfile={storeProfile}
              />
            </div>
          </div>
        </div>

        {/* Notification Overlay */}
        {showNotification && !newOrderAlertsMuted && (
          <div
            className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-brand_accent"
            onClick={handleNotificationDismiss}
          >
            <div className="text-center text-white">
              {/* Circular number container */}
              <div className="relative mx-auto mb-8 flex h-32 w-32 items-center justify-center">
                {/* Ping effect */}
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-30"
                  style={{ animationDuration: "2s" }}
                ></span>
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-20"
                  style={{ animationDelay: "1s", animationDuration: "2s" }}
                ></span>
                {/* Main circle */}
                <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-black bg-opacity-20 shadow-lg">
                  <span className="text-6xl font-bold">
                    {notificationOrderCount}
                  </span>
                </div>
              </div>

              {/* New order text */}
              <div className="mb-4 text-3xl font-medium">New order</div>

              {/* Tap anywhere to accept */}
              <div className="text-lg opacity-80">Tap anywhere to view</div>
            </div>
          </div>
        )}

        {/* Polling Status Modal — shown while polls are failing */}
        {consecutiveErrors > 0 && isPollingActive && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm">
            <div className="mx-4 max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
              {/* Status Icon */}
              <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center">
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-500 opacity-30"
                  style={{ animationDuration: "1.5s" }}
                ></span>
                <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-yellow-100">
                  <div className="flex flex-col items-center">
                    <div
                      className="mb-1 animate-spin text-4xl"
                      style={{ animationDuration: "2s" }}
                    >
                      🔄
                    </div>
                    <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                  </div>
                </div>
              </div>

              {/* Status Title */}
              <h2 className="mb-3 text-2xl font-bold text-yellow-600">
                Connection Error
              </h2>

              {/* Status Message */}
              <div className="mb-4 rounded-lg bg-yellow-50 p-4">
                <p className="text-sm text-yellow-700">
                  Unable to fetch orders. Attempting to reconnect...
                </p>
              </div>

              {/* Connection Status Indicator */}
              <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-600">
                <div className="h-2 w-2 animate-pulse rounded-full bg-yellow-500"></div>
                <span>Reconnecting</span>
              </div>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-yellow-600"
              >
                <RefreshCw size={16} strokeWidth={2} aria-hidden />
                Reload app
              </button>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {loading ? (
            <div className="hidden min-h-[200px] items-center justify-center">
              <div className="text-center">
                <span className="loading loading-spinner loading-lg text-brand_accent"></span>
                <h3 className="mt-2 text-lg font-medium">Loading orders...</h3>
              </div>
            </div>
          ) : viewMode === "unpaid" ? (
            <UnpaidTablesView
              unpaidOrdersByTable={unpaidOrdersByTable}
              showPayMultipleTables={unpaidTableCount > 1}
              payLaterAtCounterEnabled={payLaterAtCounterEnabled}
              onPayMultipleTables={(sourceTable) =>
                setPayMultipleTablesModal({ show: true, sourceTable })
              }
              onMarkOrderPaid={(orderId) =>
                setShowPaymentMethodModal({
                  orderId,
                  tableOrders: null,
                  isBulk: false,
                  show: true,
                })
              }
              onMarkAllPaid={(tableOrders) =>
                setShowPaymentMethodModal({
                  orderId: null,
                  tableOrders,
                  isBulk: true,
                  show: true,
                })
              }
            />
          ) : viewMode === "completed" ? (
            // Completed Orders View
            <div className="space-y-6">
              {/* Trading Metrics Header */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 shadow-sm">
                <div className="grid grid-cols-7 gap-4 text-center">
                  <div>
                    <button
                      onClick={() => setShowDatePicker(true)}
                      className="group rounded-lg text-left transition-colors hover:bg-gray-50"
                    >
                      <div className="text-xs font-medium uppercase text-gray-500 group-hover:text-gray-600">
                        Trading Date
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-lg font-bold text-gray-900 group-hover:text-blue-600">
                        {formatDateForDisplay(selectedDate)}
                        <Clock className="h-4 w-4 text-gray-400 group-hover:text-blue-500" />
                      </div>
                    </button>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-gray-500">
                      Total Orders
                    </div>
                    <div className="mt-1 text-lg font-bold text-gray-900">
                      {completedCount}
                    </div>
                  </div>
                  {/* temp hide */}
                  <div className="hidden">
                    <div className="text-xs font-medium uppercase text-gray-500">
                      Avg Wait
                    </div>
                    <div className="mt-1 text-lg font-bold text-gray-900">
                      {completedCount > 0
                        ? Math.round(
                            completedOrders.reduce(
                              (sum, o) => sum + (o.completedAt - o.createdAt),
                              0,
                            ) /
                              completedCount /
                              60000,
                          )
                        : 0}
                      mins
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-gray-500">
                      Total Payments
                    </div>
                    <div className="mt-1 text-lg font-bold text-gray-900">
                      $
                      {completedOrders
                        .reduce((sum, o) => sum + o.total, 0)
                        .toFixed(2)}
                    </div>
                  </div>
                  {/* temp hide */}
                  <div className="hidden">
                    <div className="text-xs font-medium uppercase text-gray-500">
                      Avg Payment
                    </div>
                    <div className="mt-1 text-lg font-bold text-gray-900">
                      $
                      {completedCount > 0
                        ? (
                            completedOrders.reduce(
                              (sum, o) => sum + o.total,
                              0,
                            ) / completedCount
                          ).toFixed(2)
                        : "0.00"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-gray-500">
                      Refunds
                    </div>
                    <div className="mt-1 text-lg font-bold text-gray-900">
                      {completedRefundSummary.refundCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-gray-500">
                      Total Refunded
                    </div>
                    <div className="mt-1 text-lg font-bold text-gray-900">
                      ${completedRefundSummary.totalRefunded.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Completed Orders List */}
              {completedOrdersLoading ? (
                <div className="flex min-h-[200px] items-center justify-center">
                  <div className="text-center">
                    <span className="loading loading-spinner loading-lg text-brand_accent"></span>
                    <h3 className="mt-2 text-lg font-medium">
                      Loading completed orders...
                    </h3>
                  </div>
                </div>
              ) : completedOrders.length === 0 ? (
                <div className="rounded-lg bg-gray-50 p-12 text-center">
                  <Check size={48} className="mx-auto mb-4 text-gray-400" />
                  <h3 className="mb-2 text-xl font-semibold">
                    No Completed Orders
                  </h3>
                  <p className="text-gray-500">
                    Completed orders will appear here
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3 xl:gap-6">
                  {completedOrders.map((order) => (
                    <OrderCard
                      key={order._id}
                      order={order}
                      viewMode={viewMode}
                      completedItems={getCompletedItems(order._id)}
                      onToggleItemCompletion={toggleItemCompletion}
                      onPrepare={() => {}} // No action needed for completed orders
                      onAccept={() => {}}
                      onReady={() => {}} // No action needed for completed orders
                      onDeliver={() => {}} // No action needed for completed orders
                      onCancel={() => {}} // No action needed for completed orders
                    />
                  ))}
                </div>
              )}
            </div>
          ) : viewMode === "productAvailability" ? (
            <PanelProductAvailability />
          ) : filteredOrders.length === 0 ? (
            <div className="rounded-lg bg-transparent p-12 text-center">
              <Bell size={48} className="mx-auto mb-4 text-brand_accent" />
              <h3 className="mb-2 text-xl font-semibold text-white">
                {(() => {
                  switch (viewMode) {
                    case "all":
                      return "No Active Orders";
                    case "new":
                      return "No New Orders";
                    case "scheduled":
                      return "No Scheduled Pre-orders";
                    case "preparing":
                      return "No Orders Preparing";
                    case "ready":
                      return "No Orders Ready";
                    case "unpaid":
                      return "No Unpaid Counter Orders";
                    case "completed":
                      return "No Completed Orders";
                    default:
                      return "No Orders Found";
                  }
                })()}
              </h3>
              <p className="text-gray-400">
                {(() => {
                  switch (viewMode) {
                    case "all":
                      return "All active orders will show here.";
                    case "new":
                      return "You'll see new incoming orders here automatically.";
                    case "scheduled":
                      return "Paid pre-orders awaiting acceptance appear here, sorted by fulfilment time.";
                    case "preparing":
                      return "Orders being prepared will appear here.";
                    case "ready":
                      return "Orders ready for pickup or delivery will show here.";
                    case "unpaid":
                      return "Unpaid counter orders will be listed here.";
                    case "completed":
                      return "Completed orders will be listed here.";
                    default:
                      return "New orders will appear here automatically.";
                  }
                })()}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3 xl:gap-6">
              {filteredOrders.map((order) => (
                <OrderCard
                  key={order._id}
                  order={order}
                  viewMode={viewMode}
                  completedItems={getCompletedItems(order._id)}
                  onToggleItemCompletion={toggleItemCompletion}
                  onPrepare={() => {
                    // Change: counter pending orders should go straight to preparing
                    const newStatus =
                      isCounterPayment(order.paymentMethod) &&
                      order.status === "pending" &&
                      !order.isPreorder
                        ? "preparing"
                        : "preparing";
                    handleStatusUpdate(order._id, newStatus);
                  }}
                  onAccept={() => handleStatusUpdate(order._id, "accepted")}
                  onReady={() => handleStatusUpdate(order._id, "ready")}
                  onDeliver={() => handleStatusUpdate(order._id, "delivered")}
                  onCancel={() => handleCancelOrder(order)}
                  onMarkAsPaid={(orderId) => handleMarkAsPaid(orderId)}
                  onRefundSuccess={handleRefundSuccess}
                  onPrint={handleOpenPrinterSelection}
                  showMarkAsPaid={true}
                  payLaterEnabled={payLaterAtCounterEnabled}
                  isProcessing={processingOrders.has(order._id)}
                />
              ))}
            </div>
          )}
        </div>

        <PaymentMethodModal
          isOpen={showPaymentMethodModal.show}
          isBulk={showPaymentMethodModal.isBulk}
          orderId={showPaymentMethodModal.orderId}
          tableOrders={showPaymentMethodModal.tableOrders}
          orders={orders}
          menuConfig={menuConfig}
          onClose={closePaymentMethodModal}
          onSelectPaymentMethod={handlePaymentMethodModalSelect}
          onPayLater={handlePaymentMethodModalPayLater}
        />
        <PayMultipleTablesModal
          isOpen={payMultipleTablesModal.show}
          sourceTable={payMultipleTablesModal.sourceTable}
          unpaidByTable={unpaidOrdersByTable}
          onClose={closePayMultipleTablesModal}
          onCollectPayment={handlePayMultipleTablesCollect}
        />
        <DatePickerModal />
        <PrinterSelectionModal
          isOpen={
            showPrinterSelectionModal.show &&
            Boolean(showPrinterSelectionModal.order)
          }
          order={showPrinterSelectionModal.order}
          availablePrinters={availablePrinters}
          isLoadingPrinters={loadingPrinters}
          onClose={closePrinterSelectionModal}
          onSelectPrinter={handlePrinterSelectAndPrint}
          onSelectAllPrinters={handlePrintToAllPrinters}
        />

        <DeleteOrderDrawer
          isOpen={cancelDrawerOpen}
          onClose={() => {
            if (
              cancelTarget?.orderId &&
              processingOrders.has(cancelTarget.orderId)
            ) {
              return;
            }
            setCancelDrawerOpen(false);
            setCancelTarget(null);
          }}
          target={cancelTarget}
          onConfirm={handleConfirmCancel}
          isProcessing={Boolean(
            cancelTarget?.orderId && processingOrders.has(cancelTarget.orderId),
          )}
        />
      </div>
      {/* Custom Toast Component */}
      {customToast.show && (
        <div className="fixed right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] z-50 animate-in slide-in-from-right-5">
          <div
            className={`flex w-full max-w-md flex-col items-start justify-between gap-3 rounded-lg border p-3 shadow-lg ${
              customToast.type === "error"
                ? "bg-red-50 text-red-800"
                : customToast.type === "success"
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-yellow-200 bg-yellow-50 text-yellow-800"
            } `}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="text-sm">
                {customToast.type === "error"
                  ? "❌"
                  : customToast.type === "success"
                    ? "✅"
                    : "⚠️"}
              </span>
              <span className="font-medium">{customToast.message}</span>
            </div>
            <div className="flex w-full shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={hideCustomToast}
                disabled={isPrintToastRetrying}
                className="w-28 rounded bg-[#947474] px-3 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#947474] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Dismiss
              </button>
              {customToast.retry?.order && (
                <button
                  type="button"
                  onClick={handlePrintToastRetry}
                  disabled={isPrintToastRetrying}
                  className="w-full rounded bg-[#2d9453] px-3 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isPrintToastRetrying ? "Retrying..." : "Print again"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
