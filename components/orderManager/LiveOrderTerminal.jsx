"use client";
import { useState, useEffect, useRef } from "react";
import OrderCard from "./OrderCard";
import Logo from "../../public/images/logo.svg";
import {
  fetchOrders,
  fetchCompletedOrders,
  updateOrderStatus,
  updateOrderPaymentStatus,
  createPrintJobsForOrder,
  checkPrinterAvailability,
} from "@/lib/api/fetchApi";
import {
  Banknote,
  Bell,
  CreditCard,
  DollarSign,
  ChefHat,
  Check,
  Radio,
  Clock,
  Package,
  RefreshCw,
  ShoppingCart,
  Users,
  X,
} from "lucide-react";
import { useGlobalAppContext } from "@/components/context/GlobalAppContext";
import OnlineOrderControlButton from "./OnlineOrderControlButton";
import PrepTimeControlButton from "./PrepTimeControlButton";
import ViewModeTab from "./ViewModeTab";
import MoreMenuButton from "./MoreMenuButton";
import { useMenuContext } from "../context/MenuContext";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { printOrder } from "@/lib/helper/printerUtils";
import { isNativeApp } from "@/lib/helper/platformDetection";
import toast from "react-hot-toast";
import {
  printOrderNew,
  getPrintQueueStatus,
  printOrderQueued,
} from "@/lib/helper/printerUtilsNew";
import { useSkipInitialEffect } from "@/lib/hooks/useSkipInitialEffect";
import { App } from "@capacitor/app";
import { createTokenFromSession } from "@/lib/auth/tokenUtils";
import { getJWTTokenAction } from "@/lib/actions/orderActions";

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
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState("new"); // "new", "preparing", "ready", "unpaid", "all", or "completed"
  const [completedOrders, setCompletedOrders] = useState([]);
  const [completedOrdersLoading, setCompletedOrdersLoading] = useState(false);
  const audioRef = useRef(null);
  const [isPolling, setIsPolling] = useState(false);
  const soundIntervalRef = useRef(null);
  const appStateChangeCountRef = useRef(0);
  const cleanupRef = useRef(null);
  const [showNotification, setShowNotification] = useState(false);
  const showNotificationRef = useRef(false);
  const [notificationOrderCount, setNotificationOrderCount] = useState(0);
  const [lastDismissedIds, setLastDismissedIds] = useState(new Set());
  const lastDismissedIdsRef = useRef(new Set());
  const printedOrderIdsRef = useRef(new Set());
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [pollingInitialized, setPollingInitialized] = useState(false);
  const [showAudioPrompt, setShowAudioPrompt] = useState(false);
  const { soundEnabled } = useGlobalAppContext();
  // App foreground/background detection state (native mobile only)
  const lastPollTimeRef = useRef(null);
  const pollingTimeoutRef = useRef(null);
  const pollingScheduleTimeoutRef = useRef(null);

  const { storeProfile, menuId, menuConfig, refreshMenuDataWithToast } =
    useMenuContext();
  const { data: session } = useSession();
  const { userData } = useGlobalAppContext();

  // Platform detection
  const isNative = isNativeApp();

  // Function to check if polling is actually working
  const isPollingHealthy = () => {
    // toast.success(`Time since last poll:${lastPollTimeRef.current}`);
    if (!lastPollTimeRef.current) return false;

    // If last poll was more than 30 seconds ago, consider it unhealthy
    const timeSinceLastPoll = Date.now() - lastPollTimeRef.current;
    // toast.success(`Time since last poll:${timeSinceLastPoll}`);
    return timeSinceLastPoll < 30000; // 30 seconds
  };

  // Function to set up polling health timeout
  const setupPollingHealthTimeout = () => {
    // Clear existing timeout
    // toast.success("Clearing polling timeout ref", pollingTimeoutRef.current);
    if (pollingTimeoutRef.current) {
      // toast.error("Clearing polling timeout ref", pollingTimeoutRef.current);
      clearTimeout(pollingTimeoutRef.current);
    }
    // toast.success("Setting up polling timeout ref", pollingTimeoutRef.current);

    // Set timeout to mark polling as unhealthy if no poll occurs within 35 seconds
    pollingTimeoutRef.current = setTimeout(async () => {
      try {
        const appState = await App.getState();
        if (!appState.isActive) {
          // Polling heath timeout fired while app is in background
          return;
        } else {
          // Polling heath timeout fired while app is in foreground
          // Don't automatically restart here, let the app state change handler do it
          showCustomToast(
            "Order receiving might not be working properly, check the internet connection or restart the app",
            "error",
          );
        }
      } catch (error) {
        toast.error(`Error checking app state: ${error}`);
      }
    }, 35000); // 35 seconds (5 seconds buffer after 30 second threshold)
    // toast.success("Setting up polling timeout ref", pollingTimeoutRef.current);
  };

  // Comprehensive refresh function for mobile app
  const handleFullRefresh = async () => {
    try {
      if (isNative) {
        // For Capacitor webview - comprehensive refresh
        toast.loading("Refreshing app data...", { duration: 2000 });

        // 1. Refresh menu data
        await refreshMenuDataWithToast();

        // 2. Stop any ongoing notification sounds
        stopSoundCycle();

        // 3. Reset all local state to force re-initialization
        setOrders([]);
        setCompletedOrders([]);
        setShowNotification(false);
        setNotificationOrderCount(0);
        setLastDismissedIds(new Set());
        printedOrderIdsRef.current.clear();
        setAudioInitialized(false);
        setShowAudioPrompt(false);

        // 3. Force re-fetch initial orders
        try {
          setLoading(true);
          const data = await fetchOrders();
          const activeOrders = data.filter((order) => {
            // Include orders that are still in progress - confirmed, preparing, ready
            if (["confirmed", "preparing", "ready"].includes(order.status)) {
              return true;
            } else {
              // For the rest of the orders(pending, delivered, cancelled)

              // 1. if the order is cancelled or delivered, then exclude the order
              if (["cancelled", "delivered"].includes(order.status)) {
                return false;
              }
              // 2. Now only Pending orders are left, so we need to check if the order is cash payment method and still need payment
              if (
                order.paymentMethod === "cash" &&
                order.paymentStatus === "pending"
              ) {
                return true;
              }
              // 3. If the order is not cash payment method or not pending, then exclude the order
              return false;
            }
          });
          setOrders(activeOrders);
          setLastDismissedIds(new Set(activeOrders.map((order) => order._id)));
          setLoading(false);
          toast.success("App refreshed successfully!");
        } catch (error) {
          setLoading(false);
          console.error("Failed to reload orders:", error);
          toast.error("Failed to refresh orders");
        }
      } else {
        // For web browser - use regular page refresh
        window.location.reload();
      }
    } catch (error) {
      console.error("Error during refresh:", error);
      toast.error("Failed to refresh app");
    }
  };

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef(null);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState({
    orderId: null,
    tableOrders: null,
    isBulk: false,
    show: false,
  });

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

  // Payment method selection modal
  const PaymentMethodModal = () => {
    const handlePaymentMethodSelect = (method) => {
      const paymentMethod = method === "cash" ? "counter-cash" : "counter-card";

      if (showPaymentMethodModal.isBulk && showPaymentMethodModal.tableOrders) {
        // Bulk operation: mark all orders as paid
        showPaymentMethodModal.tableOrders.forEach((order) => {
          if (
            order.paymentStatus === "pending" &&
            isCounterPayment(order.paymentMethod)
          ) {
            handleMarkAsPaid(order._id, paymentMethod);
          }
        });
      } else {
        // Individual operation: mark single order as paid
        handleMarkAsPaid(showPaymentMethodModal.orderId, paymentMethod);
      }

      // Close the modal
      setShowPaymentMethodModal({
        orderId: null,
        tableOrders: null,
        isBulk: false,
        show: false,
      });
    };

    const handleClose = () => {
      setShowPaymentMethodModal({
        orderId: null,
        tableOrders: null,
        isBulk: false,
        show: false,
      });
    };

    return (
      <div
        className={`modal ${showPaymentMethodModal.show ? "modal-open" : ""}`}
      >
        <div className="modal-box w-80 max-w-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {showPaymentMethodModal.isBulk
                ? "Bulk Payment Method"
                : "Select Payment Method"}
            </h3>
            <button
              onClick={handleClose}
              className="btn btn-circle btn-ghost btn-sm"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mb-6 text-sm text-gray-600">
            {showPaymentMethodModal.isBulk
              ? `How did the customer pay for all orders at Table ${showPaymentMethodModal.tableOrders?.[0]?.table}?`
              : "How did the customer pay at the counter?"}
          </p>

          {/* Total Amount Display */}
          <div className="mb-6 rounded-lg bg-gray-50 p-4 text-center">
            <p className="mb-1 text-sm font-medium text-gray-600">
              {showPaymentMethodModal.isBulk
                ? "Total Amount to Collect:"
                : "Amount to Collect:"}
            </p>
            <div className="text-3xl font-bold text-gray-900">
              $
              {(() => {
                if (
                  showPaymentMethodModal.isBulk &&
                  showPaymentMethodModal.tableOrders
                ) {
                  // Calculate total for bulk orders
                  return showPaymentMethodModal.tableOrders
                    .filter(
                      (order) =>
                        order.paymentStatus === "pending" &&
                        isCounterPayment(order.paymentMethod),
                    )
                    .reduce((sum, order) => sum + order.total, 0)
                    .toFixed(2);
                } else {
                  // Get amount for individual order
                  const order = orders.find(
                    (o) => o._id === showPaymentMethodModal.orderId,
                  );
                  return order ? order.total.toFixed(2) : "0.00";
                }
              })()}
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => handlePaymentMethodSelect("cash")}
              className="btn btn-outline h-auto w-full justify-start gap-3 p-4"
            >
              <div className="text-2xl">💵</div>
              <div className="text-left">
                <div className="font-medium">Cash</div>
                <div className="text-sm text-gray-500">
                  Physical cash payment
                </div>
              </div>
            </button>

            <button
              onClick={() => handlePaymentMethodSelect("card")}
              className="btn btn-outline h-auto w-full justify-start gap-3 p-4"
            >
              <div className="text-2xl">💳</div>
              <div className="text-left">
                <div className="font-medium">Card</div>
                <div className="text-sm text-gray-500">
                  Credit/debit card payment
                </div>
              </div>
            </button>
          </div>
        </div>
        <div className="modal-backdrop" onClick={handleClose}></div>
      </div>
    );
  };

  // Date picker modal
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
        const activeOrders = data.filter((order) => {
          // Include orders that are still in progress - confirmed, preparing, ready
          if (["confirmed", "preparing", "ready"].includes(order.status)) {
            return true;
          } else {
            // For the rest of the orders(pending, delivered, cancelled)

            // 1. if the order is cancelled or delivered, then exclude the order
            if (["cancelled", "delivered"].includes(order.status)) {
              return false;
            }
            // 2. Now only Pending orders are left, so we need to check if the order is cash payment method and still need payment
            if (
              order.paymentMethod === "cash" &&
              order.paymentStatus === "pending"
            ) {
              return true;
            }
            // 3. If the order is not cash payment method or not pending, then exclude the order
            return false;
          }
        });

        setOrders(activeOrders);
        console.log("activeOrders initial", activeOrders);
        setLastDismissedIds(new Set(activeOrders.map((order) => order._id)));
        setLoading(false);
      } catch (error) {
        setLoading(false);
        console.error("Failed to load initial orders:", error);
      }
    }

    loadInitialOrders();
  }, []);

  useEffect(() => {
    if (!session) return;
    let eventSource = null;
    const connectToSSE = async () => {
      try {
        const jwtToken = await getJWTTokenAction();

        eventSource = new EventSource(
          `${process.env.NEXT_PUBLIC_MAIN_APP_URL}/api/order-app/stream?token=${jwtToken}`,
        );

        eventSource.addEventListener("connection-established", (event) => {
          const updateData = JSON.parse(event.data);
          console.log("connection established from SSE:", updateData);
          console.log("polling orders after connection established");
          pollingOrders();
          toast.success("Live order is now connected!");
        });

        eventSource.addEventListener("heartbeat", (event) => {
          const updateData = JSON.parse(event.data);
          console.log("heartbeat from SSE:", updateData);
        });

        // Listen for order status updates
        eventSource.addEventListener("new-card-order-paid", (event) => {
          const data = JSON.parse(event.data);
          console.log("new card order paid from SSE:", data);
          pollingOrders();
        });

        eventSource.onerror = (error) => {
          console.error("SSE connection error here:", error);

          // Check if connection failed immediately
          if (eventSource.readyState === EventSource.CLOSED) {
            // Make a quick request to check the actual error
            fetch(
              `${process.env.NEXT_PUBLIC_MAIN_APP_URL}/api/order-app/stream?token=${jwtToken}`,
            )
              .then((response) => {
                if (response.status === 409) {
                  return response.json();
                }
                return null;
              })
              .then((errorData) => {
                if (errorData) {
                  showCustomToast(errorData.message, "error");
                } else {
                  showCustomToast(
                    "Connection failed. Please refresh the page.",
                    "error",
                  );
                }
              })
              .catch(() => {
                showCustomToast(
                  "Connection failed. Please refresh the page.",
                  "error",
                );
              });
          }
        };

        eventSource.onopen = () => {
          console.log("SSE connection opened");
        };
      } catch (error) {
        console.error("Failed to connect to SSE:", error);
      }
    };

    connectToSSE();

    // Cleanup function to close the connection
    return () => {
      if (eventSource) {
        console.log("Closing SSE connection");
        eventSource.close();
      }
    };
  }, [session]);

  const pollingOrders = async () => {
    setIsPolling(true);
    const data = await fetchOrders();
    const activeOrders = data.filter((order) => {
      // Include orders that are still in progress - confirmed, preparing, ready
      if (["confirmed", "preparing", "ready"].includes(order.status)) {
        return true;
      } else {
        // For the rest of the orders(pending, delivered, cancelled)

        // 1. if the order is cancelled or delivered, then exclude the order
        if (["cancelled", "delivered"].includes(order.status)) {
          return false;
        }
        // 2. Now only Pending orders are left, so we need to check if the order is cash payment method and still need payment
        if (
          order.paymentMethod === "cash" &&
          order.paymentStatus === "pending"
        ) {
          return true;
        }
        // 3. If the order is not cash payment method or not pending, then exclude the order
        return false;
      }
    });
    const currentOrderIdsAsSet = new Set(
      activeOrders.map((order) => order._id),
    );
    setOrders(activeOrders);
    // Check for new orders since last dismissal (not just last poll)
    const newOrdersSinceLastDismissal = activeOrders.filter(
      (order) => !lastDismissedIdsRef.current.has(order._id),
    );
    // Filter orders that should trigger notifications:
    // 1. Paid orders (takeaway/dine-in, but not counter paid)
    // 2. Pending counter orders for dine-in only
    const notificationWorthyOrders = newOrdersSinceLastDismissal.filter(
      (order) => {
        // Case 1: Paid orders (but not counter paid - these don't need immediate attention)
        if (
          order.paymentStatus === "paid" &&
          !isCounterPayment(order.paymentMethod)
        ) {
          return true;
        }

        // Case 2: Pending counter orders for dine-in only (these need payment collection)
        if (
          order.paymentStatus === "pending" &&
          isCounterPayment(order.paymentMethod) &&
          order.table !== "takeaway"
        ) {
          return true;
        }

        return false;
      },
    );

    // Update count to reflect notification-worthy orders since last dismissal
    if (notificationWorthyOrders.length > 0) {
      setNotificationOrderCount(notificationWorthyOrders.length);

      // Auto-print orders if auto-printing is enabled
      const autoPrintingEnabled = menuConfig?.autoPrinting?.enabled;
      if (autoPrintingEnabled && storeProfile && userData?.ownerEmail) {
        // Filter out orders that have already been printed
        const unprintedOrders = notificationWorthyOrders.filter(
          (order) => !printedOrderIdsRef.current.has(order._id),
        );
        console.log(
          "printedOrderIds right before filtering:",
          printedOrderIdsRef.current,
        );
        console.log("unprintedOrders", unprintedOrders);
        // Print only unprinted orders and collect printed IDs
        const newlyPrintedIds = [];
        for (const order of unprintedOrders) {
          try {
            const printResult = await handlePrintingOrder(order);
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
              showCustomToast(
                "Failed to auto-print order - Double check the printer settings",
                "error",
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

      // Only trigger notification if it's not already showing
      if (!showNotificationRef.current) {
        console.log("Showing notification");
        setShowNotification(true);
        playSoundCycle();
      }
    }

    setIsPolling(false);
  };

  // Function to handle notification dismissal
  const handleNotificationDismiss = () => {
    setShowNotification(false);
    setNotificationOrderCount(0);
    // Update lastDismissedIds to current order IDs so future counts are calculated correctly
    setLastDismissedIds(new Set(orders.map((order) => order._id)));
    // Clear printed orders tracking when notification is dismissed
    printedOrderIdsRef.current.clear();
    stopSoundCycle();
    // Switch to new orders tab when notification is dismissed
    setViewMode("new");
  };

  // Effect for polling orders
  useSkipInitialEffect(() => {
    if (true) return;
    if (pollinginitialized) return;
    setPollingInitialized(true);

    let isActive = true;
    let timeoutId;
    let retryCount = 0;
    const maxRetries = 2;
    const baseInterval = 10000; // 10 seconds

    console.log("polling initialized in useSkipInitialEffect");

    const pollOrders = async () => {
      if (!isActive) return;

      try {
        console.log("polling orders time:", new Date().toISOString());

        // Update last poll time to track polling health
        lastPollTimeRef.current = Date.now();

        // Set up initial polling health timeout
        setupPollingHealthTimeout();

        const data = await fetchOrders();

        if (!isActive) return; // Check again after async operation

        // Your existing order processing logic (unchanged)
        const activeOrders = data.filter((order) => {
          // Include orders that are still in progress - confirmed, preparing, ready
          if (["confirmed", "preparing", "ready"].includes(order.status)) {
            return true;
          } else {
            // For the rest of the orders(pending, delivered, cancelled)

            // 1. if the order is cancelled or delivered, then exclude the order
            if (["cancelled", "delivered"].includes(order.status)) {
              return false;
            }
            // 2. Now only Pending orders are left, so we need to check if the order is cash payment method and still need payment
            if (
              order.paymentMethod === "cash" &&
              order.paymentStatus === "pending"
            ) {
              return true;
            }
            // 3. If the order is not cash payment method or not pending, then exclude the order
            return false;
          }
        });

        const currentOrderIdsAsSet = new Set(
          activeOrders.map((order) => order._id),
        );

        setOrders(activeOrders);
        console.log("activeOrders", activeOrders);

        // Check for new orders since last dismissal (not just last poll)
        // Now this is safe - lastDismissedIds is already set from initial loading
        const newOrdersSinceLastDismissal = activeOrders.filter(
          (order) => !lastDismissedIdsRef.current.has(order._id),
        );
        console.log("lastDismissedIds", lastDismissedIdsRef.current);
        console.log("newOrdersSinceLastDismissal", newOrdersSinceLastDismissal);

        // Filter orders that should trigger notifications:
        // 1. Paid orders (takeaway/dine-in, but not counter paid)
        // 2. Pending counter orders for dine-in only
        const notificationWorthyOrders = newOrdersSinceLastDismissal.filter(
          (order) => {
            // Case 1: Paid orders (but not counter paid - these don't need immediate attention)
            if (
              order.paymentStatus === "paid" &&
              !isCounterPayment(order.paymentMethod)
            ) {
              return true;
            }

            // Case 2: Pending counter orders for dine-in only (these need payment collection)
            if (
              order.paymentStatus === "pending" &&
              isCounterPayment(order.paymentMethod) &&
              order.table !== "takeaway"
            ) {
              return true;
            }

            return false;
          },
        );

        // Update count to reflect notification-worthy orders since last dismissal
        if (notificationWorthyOrders.length > 0) {
          setNotificationOrderCount(notificationWorthyOrders.length);

          // Auto-print orders if auto-printing is enabled
          const autoPrintingEnabled = menuConfig?.autoPrinting?.enabled;
          if (autoPrintingEnabled && storeProfile && userData?.ownerEmail) {
            // Filter out orders that have already been printed
            const unprintedOrders = notificationWorthyOrders.filter(
              (order) => !printedOrderIdsRef.current.has(order._id),
            );
            console.log(
              "printedOrderIds right before filtering:",
              printedOrderIdsRef.current,
            );
            console.log("unprintedOrders", unprintedOrders);
            // Print only unprinted orders and collect printed IDs
            const newlyPrintedIds = [];
            for (const order of unprintedOrders) {
              try {
                const printResult = await handlePrintingOrder(order);
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
                  showCustomToast(
                    "Failed to auto-print order - Double check the printer settings",
                    "error",
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
              newlyPrintedIds.forEach((id) =>
                printedOrderIdsRef.current.add(id),
              );
              console.log(
                "Updated printed order ids ref:",
                printedOrderIdsRef.current,
              );
            }
          }

          // Only trigger notification if it's not already showing
          if (!showNotificationRef.current) {
            console.log("Showing notification");
            setShowNotification(true);
            playSoundCycle();
          }
        }

        retryCount = 0; // Reset retry count on success

        // Schedule next poll
        timeoutId = setTimeout(pollOrders, baseInterval);
        pollingScheduleTimeoutRef.current = timeoutId;
        console.log("Scheduling next poll", timeoutId);
      } catch (error) {
        console.error("Failed to poll orders:", error);

        if (!isActive) return;

        // Simple retry with exponential backoff
        retryCount++;
        const backoffDelay = Math.min(
          baseInterval * Math.pow(2, retryCount),
          60000,
        ); // Max 1 minute

        if (retryCount <= maxRetries) {
          console.log(
            `Retrying in ${backoffDelay}ms (attempt ${retryCount}/${maxRetries})`,
          );
          timeoutId = setTimeout(pollOrders, backoffDelay);
        } else {
          console.error(
            "Max polling retries reached. Will retry in 5 minutes.",
          );
          // Don't give up completely - retry after 5 minutes
          timeoutId = setTimeout(pollOrders, 300000);
        }
      }
    };

    // Start polling immediately (no delay needed)
    pollOrders();
    // Store cleanup function in ref instead of returning it
    cleanupRef.current = () => {
      isActive = false;
      console.log("Cleaning up polling");
      if (timeoutId) {
        clearTimeout(timeoutId);
        console.log("Clearing timeout id", timeoutId);
      }
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        console.log("Clearing polling timeout ref", pollingTimeoutRef.current);
      }
    };
  }, [lastDismissedIds, pollingInitialized]);

  // Separate useEffect for unmount cleanup
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []); // Only runs on unmount

  // Effect to detect app foreground/background state using Capacitor App plugin
  // Temporary disable app state detection
  // useEffect(() => {
  //   if (!isNative) {
  //     console.log("Not native app, skipping app state detection");
  //     return;
  //   }

  //   const handleAppStateChange = async ({ isActive }) => {
  //     if (isActive) {
  //       appStateChangeCountRef.current += 1;
  //       const currentCount = appStateChangeCountRef.current;
  //       toast.success("App in active!");
  //       // Check if polling is healthy
  //       // Wait for 22 seconds to check if polling is healthy
  //       await toast.promise(
  //         new Promise((resolve) => setTimeout(resolve, 22000)),
  //         {
  //           loading: "Checking polling health...",
  //         },
  //       );
  //       const pollingHealthy = isPollingHealthy();

  //       // toast.success("App in active!");
  //       if (!pollingHealthy) {
  //         showCustomToast(
  //           `App idle in background for too long, please restart the app`,
  //           "error",
  //         );
  //       } else {
  //         // Use toast instead of alert for better visibility
  //         toast.success(`Polling Healthy: ${currentCount}`);
  //         // set the polling timeout when app go to foreground
  //         // setupPollingHealthTimeout();
  //       }
  //     }
  //   };

  //   try {
  //     // Set up native app state listener
  //     const appStateListener = App.addListener(
  //       "appStateChange",
  //       handleAppStateChange,
  //     );

  //     // Cleanup function
  //     return () => {
  //       console.log("Cleaning up app state listener");
  //       appStateListener.remove();
  //     };
  //   } catch (error) {
  //     console.error("Error setting up app state listener:", error);
  //     toast.error("Error setting up app state listener");
  //     // Fallback to visibility API if Capacitor fails
  //     const handleVisibilityChange = () => {
  //       const isVisible = !document.hidden;
  //       setIsAppInForeground(isVisible);

  //       if (isVisible) {
  //         setAppStateChangeCount((prev) => prev + 1);

  //         // Check if polling is actually working, not just initialized
  //         const pollingHealthy = isPollingHealthy();

  //         if (!pollingHealthy) {
  //           console.log(
  //             "Polling not healthy (fallback), restarting polling...",
  //           );
  //           toast.success(`App VISIBLE (fallback)!\nRestarting polling...`);
  //           // Reset polling state to allow re-initialization
  //           setPollingInitialized(false);
  //         } else {
  //           toast.success(`App VISIBLE (fallback)!\nPolling: Healthy`);
  //         }
  //       } else {
  //         toast.error(`App HIDDEN (fallback)!\nPolling: ${pollingInitialized}`);
  //       }
  //     };
  //     // Temporary disable visibility change listener
  //     // document.addEventListener("visibilitychange", handleVisibilityChange);

  //     // return () => {
  //     //   document.removeEventListener(
  //     //     "visibilitychange",
  //     //     handleVisibilityChange,
  //     //   );
  //     // };
  //   }
  // }, [isNative]);

  // Separate useEffect to log when state actually changes
  useEffect(() => {
    if (pollingInitialized) {
      console.log("Polling initialized", pollingInitialized);
    }
  }, [pollingInitialized]);

  // Update refs when state changes
  useEffect(() => {
    showNotificationRef.current = showNotification;
  }, [showNotification]);
  useEffect(() => {
    lastDismissedIdsRef.current = lastDismissedIds;
  }, [lastDismissedIds]);

  // Effect to fetch completed orders when view mode changes
  useEffect(() => {
    console.log("useEffect viewMode run");
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
    if (!soundEnabled || !audioRef.current) return;

    const playSound = async () => {
      try {
        // Create a new audio element for each play to allow overlapping
        const audioClone = new Audio("/sounds/notification.mp3");
        await audioClone.play();

        // Schedule next play after a very short delay (e.g., 900ms)
        soundIntervalRef.current = setTimeout(playSound, 900);
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
    if (soundIntervalRef.current) {
      clearTimeout(soundIntervalRef.current);
      soundIntervalRef.current = null;
    }
  };

  // Show audio prompt on first visit if sound is enabled (web only)
  useEffect(() => {
    if (soundEnabled && !audioInitialized && !loading && !isNative) {
      // Small delay to let the page load first
      setTimeout(() => {
        setShowAudioPrompt(true);
      }, 1000);
    }
  }, [soundEnabled, audioInitialized, loading, isNative]);

  // Auto-initialize audio for native apps
  useEffect(() => {
    if (isNative && soundEnabled && !audioInitialized && !loading) {
      // For native apps, we can initialize audio automatically
      setAudioInitialized(true);
      console.log("Audio auto-initialized for native app");
    }
  }, [isNative, soundEnabled, audioInitialized, loading]);

  // Cleanup sound intervals on component unmount
  useEffect(() => {
    return () => {
      stopSoundCycle();
    };
  }, []);

  // Add this function inside the LiveOrderTerminal component
  const handlePrintingOrder = async (order) => {
    try {
      // Determine order type
      const isTakeaway = order.table === "takeaway";
      const orderType = isTakeaway ? "takeaway" : "dinein";

      // Check printer availability for the order type
      const printersAvailability = await checkPrinterAvailability(orderType);
      console.log("printersAvailability", printersAvailability);

      if (printersAvailability.available) {
        // Create print data object for the order
        const printData = {
          order: order,
          orderId: order._id.slice(-6).toUpperCase(),
          printers: printersAvailability.printers,
        };

        console.log("printData", printData);

        // Use queued printing instead of direct printing
        const printResult = await printOrderQueued(printData, {
          delayAfterDisconnect: 300, // Longer delay for production
        });

        if (printResult.success) {
          toast.success(printResult.message);
          if (printResult.failedPrints > 0) {
            showCustomToast(
              printResult.failedPrinterNames + " failed to print",
              "error",
            );
          }
        } else {
          // toast.error(printResult.message);
          // create for me a similar toast but not use the plugin, just use the state to show the message with the same style and add the dismiss button
          showCustomToast(printResult.message, "error");
        }

        return printResult;
      } else {
        // toast.error(`No printers available for ${orderType} orders`);
        return { success: false, message: "No printers available" };
      }
    } catch (error) {
      console.error("Error printing order:", error);
      return { success: false, error: error.message };
    }
  };

  // Handle order status updates and control printing
  // only printing docket when order status is changed to "preparing" and auto-printing is disabled
  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      const updatedOrder = await updateOrderStatus(orderId, newStatus);

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
              const isTakeaway = order.table === "takeaway";
              const orderType = isTakeaway ? "takeaway" : "dinein";

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

      // Print order when order status is changed to "preparing" ONLY if auto-printing is disabled without creating print jobs
      const autoPrintingEnabled = menuConfig?.autoPrinting?.enabled;
      if (
        newStatus === "preparing" &&
        storeProfile &&
        userData?.ownerEmail &&
        !autoPrintingEnabled
      ) {
        try {
          const order = orders.find((o) => o._id === orderId);
          if (order) {
            const printResult = await handlePrintingOrder(order);
          }
        } catch (error) {
          console.error("Error printing order:", error);
        }
      }

      // If order is delivered or cancelled, remove it after a delay
      if (["delivered", "cancelled"].includes(newStatus)) {
        setTimeout(() => {
          setOrders((prevOrders) =>
            prevOrders.filter((order) => order._id !== orderId),
          );
        }, 5000);
      }
    } catch (error) {
      console.error(
        `Failed to update order ${orderId} to ${newStatus}:`,
        error,
      );
    }
  };

  // Handle order cancellation with confirmation
  const handleCancelOrder = (order) => {
    const isPaid = order.paymentStatus === "paid";

    let confirmMessage;
    if (isPaid) {
      confirmMessage =
        "This order is already paid. You'll need to process a refund manually. Are you sure you want to cancel?";
    } else {
      confirmMessage = "Are you sure you want to cancel this order?";
    }

    if (window.confirm(confirmMessage)) {
      handleStatusUpdate(order._id, "cancelled");
    }
  };
  // Handle marking counter order as paid with payment method selection
  const handleMarkAsPaid = async (orderId, paymentMethod = null) => {
    // If no payment method specified, show selection modal
    if (!paymentMethod) {
      setShowPaymentMethodModal({ orderId, show: true });
      return;
    }

    try {
      // Find the current order to check if it's dine-in and pending
      const currentOrder = orders.find((order) => order._id === orderId);
      const isDineIn =
        currentOrder && currentOrder.table && currentOrder.table !== "takeaway";
      const isPending = currentOrder && currentOrder.status === "pending";

      // Update payment status first
      const updatedOrder = await updateOrderPaymentStatus(
        orderId,
        "paid",
        paymentMethod,
      );

      // If it's a dine-in order that was pending, also update status to confirmed
      if (isDineIn && isPending) {
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
      setShowPaymentMethodModal({ orderId: null, show: false });
    } catch (error) {
      console.error(`Failed to mark order ${orderId} as paid:`, error);
    }
  };

  // Helper function to check if payment method is a counter payment
  const isCounterPayment = (paymentMethod) => {
    return (
      paymentMethod === "cash" ||
      paymentMethod === "counter-cash" ||
      paymentMethod === "counter-card"
    );
  };

  // Filter orders based on view mode
  const getFilteredOrders = () => {
    if (viewMode === "all") {
      return orders.filter((order) => {
        // For pending orders, only show counter payments
        if (order.status === "pending") {
          return isCounterPayment(order.paymentMethod);
        }
        // For other statuses, show all orders including delivered with pending payment
        return (
          ["confirmed", "preparing", "ready"].includes(order.status) ||
          (order.status === "delivered" && order.paymentStatus === "pending")
        );
      });
    } else if (viewMode === "unpaid") {
      // Show all unpaid counter orders (including delivered orders that still need payment)
      return orders.filter(
        (order) =>
          order.paymentStatus === "pending" &&
          isCounterPayment(order.paymentMethod) &&
          order.table !== "takeaway" &&
          ["pending", "confirmed", "preparing", "ready", "delivered"].includes(
            order.status,
          ),
      );
    } else if (viewMode === "new") {
      // New incoming orders:
      // - confirmed + paid for non-counter (card) orders
      // - pending + unpaid for counter orders
      // - confirmed + paid for counter orders (so staff can prepare them)
      return orders.filter(
        (order) =>
          (order.status === "confirmed" &&
            order.paymentStatus === "paid" &&
            !isCounterPayment(order.paymentMethod)) ||
          (order.status === "pending" &&
            order.paymentStatus === "pending" &&
            isCounterPayment(order.paymentMethod)) ||
          (order.status === "confirmed" &&
            order.paymentStatus === "paid" &&
            isCounterPayment(order.paymentMethod)),
      );
    } else if (viewMode === "preparing") {
      return orders.filter((order) => order.status === "preparing");
    } else if (viewMode === "ready") {
      return orders.filter((order) => order.status === "ready");
    } else if (viewMode === "completed") {
      return orders.filter((order) => order.status === "delivered");
    }
    return orders;
  };

  // Group unpaid orders by table (uses current filtered orders; actual unpaid view uses unpaid filter)
  const getUnpaidOrdersByTable = () => {
    const unpaidOrders = getFilteredOrders();

    const grouped = {};
    unpaidOrders.forEach((order) => {
      const table = order.table || "Unknown";
      if (!grouped[table]) grouped[table] = [];
      grouped[table].push(order);
    });

    return grouped;
  };

  const filteredOrders = getFilteredOrders();
  const unpaidOrdersByTable = getUnpaidOrdersByTable();
  const newOrdersCount = orders.filter(
    (order) =>
      (order.status === "confirmed" &&
        order.paymentStatus === "paid" &&
        !isCounterPayment(order.paymentMethod)) ||
      (order.status === "pending" &&
        order.paymentStatus === "pending" &&
        isCounterPayment(order.paymentMethod)) ||
      (order.status === "confirmed" &&
        order.paymentStatus === "paid" &&
        isCounterPayment(order.paymentMethod)),
  ).length;
  const allActiveCount = orders.filter((order) => {
    if (order.status === "pending")
      return isCounterPayment(order.paymentMethod);
    return (
      ["confirmed", "preparing", "ready"].includes(order.status) ||
      (order.status === "delivered" && order.paymentStatus === "pending")
    );
  }).length;
  const preparingCount = orders.filter(
    (order) => order.status === "preparing",
  ).length;
  const readyCount = orders.filter((order) => order.status === "ready").length;
  const completedCount = completedOrders.length;
  const unpaidTablesBadgeCount = (() => {
    // Count unique tables with unpaid counter orders (including delivered orders that still need payment)
    const uniqueTables = new Set(
      orders
        .filter(
          (order) =>
            order.paymentStatus === "pending" &&
            isCounterPayment(order.paymentMethod) &&
            order.table !== "takeaway" &&
            [
              "pending",
              "confirmed",
              "preparing",
              "ready",
              "delivered",
            ].includes(order.status),
        )
        .map((order) => order.table || "Unknown"),
    );
    return uniqueTables.size;
  })();

  const [customToast, setCustomToast] = useState({
    show: false,
    type: "error", // 'error', 'success', 'warning'
    message: "",
    id: null,
  });

  const showCustomToast = (message, type = "error") => {
    const id = Date.now() + Math.random();
    setCustomToast({
      show: true,
      type,
      message,
      id,
    });
  };

  const hideCustomToast = () => {
    setCustomToast({
      show: false,
      type: "error",
      message: "",
      id: null,
    });
  };

  return (
    <>
      <div className="p-3">
        {/* Audio element for notifications */}
        <audio ref={audioRef} src="/sounds/notification.mp3" />

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
                    Click &quot;Enable Sound&quot; to hear audio alerts for new
                    orders.
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

        {/* Notification Overlay */}
        {showNotification && (
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

        {/* header */}
        <div className="flex items-start justify-between">
          {/* quick settings */}
          <div className="mb-3 flex gap-3">
            {/* logo */}
            <div className="hidden h-auto flex-col items-center justify-center gap-0 rounded-lg bg-gray-100 px-4 py-1 text-left transition-colors hover:bg-gray-200 md:flex">
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
            <div className="hidden flex-wrap gap-3 md:flex">
              <ViewModeTab
                icon={Bell}
                label="New"
                count={newOrdersCount}
                isActive={viewMode === "new"}
                onClick={() => setViewMode("new")}
              />
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
              preparingCount={preparingCount}
              readyCount={readyCount}
              allActiveCount={allActiveCount}
              unpaidTablesBadgeCount={unpaidTablesBadgeCount}
              storeProfile={storeProfile}
            />
          </div>
        </div>
        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <div className="text-center">
              <span className="loading loading-spinner loading-lg text-brand_accent"></span>
              <h3 className="mt-2 text-lg font-medium">Loading orders...</h3>
            </div>
          </div>
        ) : viewMode === "unpaid" ? (
          // Unpaid Counter Orders View
          <div className="space-y-6">
            {Object.keys(unpaidOrdersByTable).length === 0 ? (
              <div className="rounded-lg bg-gray-50 p-12 text-center">
                <DollarSign size={48} className="mx-auto mb-4 text-gray-400" />
                <h3 className="mb-2 text-xl font-semibold">
                  No Unpaid Counter Orders
                </h3>
                <p className="text-gray-500">
                  All counter orders have been paid
                </p>
              </div>
            ) : (
              Object.entries(unpaidOrdersByTable).map(
                ([table, tableOrders]) => {
                  const totalAmount = tableOrders.reduce(
                    (sum, order) => sum + order.total,
                    0,
                  );

                  // Combine all items from all orders for this table
                  const combinedItems = {};
                  tableOrders.forEach((order) => {
                    order.items.forEach((item) => {
                      const key = `${item.menuItemId}-${item.name}-${JSON.stringify(item.selectedVariants)}-${JSON.stringify(item.selectedModifiers)}`;
                      if (combinedItems[key]) {
                        combinedItems[key].quantity += item.quantity;
                      } else {
                        combinedItems[key] = { ...item };
                      }
                    });
                  });

                  const combinedItemsArray = Object.values(combinedItems);

                  return (
                    <div
                      key={table}
                      className="overflow-hidden rounded-lg border border-gray-200 bg-white"
                    >
                      {/* Table Header */}
                      <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                              Table {table}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {tableOrders.length} order
                              {tableOrders.length > 1 ? "s" : ""} • Total: $
                              {totalAmount.toFixed(2)}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              // Show unified payment method modal for bulk operations
                              setShowPaymentMethodModal({
                                orderId: null,
                                tableOrders: tableOrders,
                                isBulk: true,
                                show: true,
                              });
                            }}
                            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
                          >
                            Mark All Paid
                          </button>
                        </div>
                      </div>

                      {/* Items Table */}
                      <div className="px-6 py-4">
                        <div className="space-y-3">
                          {combinedItemsArray.map((item, index) => (
                            <div
                              key={index}
                              className="flex items-start justify-between border-b border-gray-100 py-2 last:border-b-0"
                            >
                              <div className="flex flex-1 items-start space-x-3">
                                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-900">
                                  <span className="text-xs font-semibold text-white">
                                    {item.quantity}
                                  </span>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-gray-900">
                                    {item.name}
                                  </p>
                                  {item.selectedVariants &&
                                    item.selectedVariants.length > 0 && (
                                      <p className="text-sm text-gray-600">
                                        {item.selectedVariants
                                          .map(
                                            (variant) =>
                                              `${variant.groupName} (${variant.optionName})`,
                                          )
                                          .join(" - ")}
                                      </p>
                                    )}
                                  {item.selectedModifiers &&
                                    item.selectedModifiers.length > 0 && (
                                      <p className="text-sm text-blue-600">
                                        +{" "}
                                        {item.selectedModifiers
                                          .map(
                                            (modifier) =>
                                              `${modifier.groupName} (${modifier.optionName})`,
                                          )
                                          .join(", ")}
                                      </p>
                                    )}
                                </div>
                              </div>
                              <p className="ml-4 font-semibold text-gray-900">
                                ${(item.price * item.quantity).toFixed(2)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Order Details Summary */}
                      <div className="border-t border-gray-200 bg-gray-50 px-6 py-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Orders:</span>
                          <span className="font-medium text-gray-900">
                            {tableOrders
                              .map(
                                (order) =>
                                  `${order.customerName || "Anonymous"} ($${order.total.toFixed(2)})`,
                              )
                              .join(", ")}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                },
              )
            )}
          </div>
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
                          completedOrders.reduce((sum, o) => sum + o.total, 0) /
                          completedCount
                        ).toFixed(2)
                      : "0.00"}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase text-gray-500">
                    Refunds
                  </div>
                  <div className="mt-1 text-lg font-bold text-gray-900">0</div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase text-gray-500">
                    Total Refunded
                  </div>
                  <div className="mt-1 text-lg font-bold text-gray-900">
                    $0.00
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
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {completedOrders.map((order) => (
                  <OrderCard
                    key={order._id}
                    order={order}
                    viewMode={viewMode}
                    onPrepare={() => {}} // No action needed for completed orders
                    onReady={() => {}} // No action needed for completed orders
                    onDeliver={() => {}} // No action needed for completed orders
                    onCancel={() => {}} // No action needed for completed orders
                  />
                ))}
              </div>
            )}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-lg bg-gray-50 p-12 text-center">
            <Bell size={48} className="mx-auto mb-4 text-gray-400" />
            <h3 className="mb-2 text-xl font-semibold">
              {(() => {
                switch (viewMode) {
                  case "all":
                    return "No Active Orders";
                  case "new":
                    return "No New Orders";
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
            <p className="text-gray-500">
              {(() => {
                switch (viewMode) {
                  case "all":
                    return "All active orders will show here.";
                  case "new":
                    return "You'll see new incoming orders here automatically.";
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
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredOrders.map((order) => (
              <OrderCard
                key={order._id}
                order={order}
                viewMode={viewMode}
                onPrepare={() => {
                  // Change: counter pending orders should go straight to preparing
                  const newStatus =
                    isCounterPayment(order.paymentMethod) &&
                    order.status === "pending"
                      ? "preparing"
                      : "preparing";
                  handleStatusUpdate(order._id, newStatus);
                }}
                onReady={() => handleStatusUpdate(order._id, "ready")}
                onDeliver={() => handleStatusUpdate(order._id, "delivered")}
                onCancel={() => handleCancelOrder(order)}
                onMarkAsPaid={(orderId) => handleMarkAsPaid(orderId)}
                showMarkAsPaid={true}
              />
            ))}
          </div>
        )}
        <PaymentMethodModal />
        <DatePickerModal />
      </div>
      {/* Custom Toast Component */}
      {customToast.show && (
        <div className="fixed right-4 top-4 z-50 animate-in slide-in-from-right-5">
          <div
            className={`flex w-full max-w-md items-center justify-between rounded-lg border p-4 shadow-lg ${
              customToast.type === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : customToast.type === "success"
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-yellow-200 bg-yellow-50 text-yellow-800"
            } `}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">
                {customToast.type === "error"
                  ? "❌"
                  : customToast.type === "success"
                    ? "✅"
                    : "⚠️"}
              </span>
              <span className="font-medium">{customToast.message}</span>
            </div>
            <button
              onClick={hideCustomToast}
              className="ml-4 rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-700"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </>
  );
}
