import {
  addPrinterAction,
  checkPrinterAvailabilityAction,
  createPrintJobsForOrderAction,
  deletePrinterAction,
  fetchCompletedOrdersAction,
  fetchGetMenuByOwnerEmailAction,
  fetchOrdersAction,
  fetchPrintersAction,
  updateMenuConfigAction,
  updateMenuItemSoldOutAction,
  updateModifierOptionAvailabilityAction,
  sendOrderReceiptEmailAction,
  refundOrderAction,
  sendRefundConfirmationEmailAction,
  updateOrderPaymentStatusAction,
  markOrderPayLaterAction,
  updateOrderStatusAction,
  updatePrinterAction,
  logPrintErrorAction,
} from "@/lib/actions/orderActions";
import {
  applyPosCheckDiscountAction,
  completePosSaleAction,
  completePosSaleBatchAction,
  fetchPosHeldOrdersAction,
  fetchPosResumeOrdersAction,
  sendPosOrderAction,
  updatePosHeldCheckStatusAction,
  cancelPosOrderItemAction,
  markPosBillPrintedAction,
  mergePosTablesAction,
  unmergePosTablesAction,
} from "@/lib/actions/posOrderActions";
import {
  addPosRegisterMovementAction,
  closePosRegisterSessionAction,
  closePosRegisterSessionSecondTestAction,
  fetchPosRegisterClosingPreviewAction,
  fetchPosRegisterSessionAction,
  finalisePosRegisterSessionAction,
  openPosRegisterSessionAction,
} from "@/lib/actions/registerActions";
import {
  isLocalCatalogCacheEnabled,
  isLocalCatalogCacheFirst,
} from "@/lib/localDb/localCacheGate";

/**
 * Gets the base URL for API requests, works in both client and server environments
 * @returns {string} The base URL
 */
export function getBaseUrl() {
  // Check if we're in a browser environment
  if (typeof window !== "undefined") {
    // Client-side: use the current origin
    return window.location.origin;
  }

  // Then try NEXT_PUBLIC_BASE_URL which you can set in your .env file
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }

  // Fallback to localhost for development
  return "http://localhost:3000";
}

const MAIN_APP_URL_API =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : process.env.NEXT_PUBLIC_MAIN_APP_URL || "http://localhost:3000";

/**
 * Fetches all orders from the API
 * @returns {Promise<Array>} Array of order objects
 */
export async function fetchOrders() {
  return await fetchOrdersAction();
}

export async function fetchCompletedOrders(
  startDate = null,
  endDate = null,
  limit = null,
) {
  return await fetchCompletedOrdersAction(startDate, endDate, limit);
}

/**
 * Updates an order's status
 * @param {string} orderId - The order ID
 * @param {string} status - The new status
 * @returns {Promise<Object>} The updated order
 */
export async function updateOrderStatus(orderId, status, options = {}) {
  return await updateOrderStatusAction(orderId, status, options);
}

// Update Menu Config
export async function updateMenuConfig(menuConfig) {
  return await updateMenuConfigAction(menuConfig);
}

export async function updateMenuItemSoldOut(
  menuItemId,
  soldOut,
  restockTomorrow,
) {
  return await updateMenuItemSoldOutAction(
    menuItemId,
    soldOut,
    restockTomorrow,
  );
}

export async function updateModifierOptionAvailability(
  sourceType,
  groupKey,
  optionId,
  available,
  restockTomorrow,
) {
  return await updateModifierOptionAvailabilityAction(
    sourceType,
    groupKey,
    optionId,
    available,
    restockTomorrow,
  );
}

/** Staff: send order receipt to a customer email (same template as Stripe confirmation). */
export async function sendOrderReceiptEmail(orderId, customerEmail) {
  return await sendOrderReceiptEmailAction(orderId, customerEmail);
}

/** Staff: issue a full or partial refund for a paid order. */
export async function refundOrder(refundData) {
  return await refundOrderAction(refundData);
}

/** Staff: send refund confirmation email to a customer. */
export async function sendRefundConfirmationEmail(orderId, customerEmail) {
  return await sendRefundConfirmationEmailAction(orderId, customerEmail);
}

/**
 * Updates an order's payment status
 * @param {string} orderId - The order ID
 * @param {string} paymentStatus - The new payment status
 * @returns {Promise<Object>} The updated order
 */
export async function updateOrderPaymentStatus(
  orderId,
  paymentStatus,
  paymentMethod = null,
) {
  return await updateOrderPaymentStatusAction(
    orderId,
    paymentStatus,
    paymentMethod,
  );
}

/**
 * Mark dine-in counter order as pay-later (pilot stores only).
 * @param {string} orderId
 * @param {boolean} payLaterAtCounterEnabled — from menuConfig.allowPayLaterAtCounter
 */
export async function markOrderPayLater(orderId, payLaterAtCounterEnabled) {
  return await markOrderPayLaterAction(orderId, payLaterAtCounterEnabled);
}

export async function fetchGetMenuByOwnerEmail(ownerEmail) {
  return await fetchGetMenuByOwnerEmailAction(ownerEmail);
}

/**
 * Creates print jobs for an order when prepare button is clicked
 * @param {Object} order - The order object
 * @param {string} menuLink - The menu link
 * @param {string} ownerEmail - The owner email
 * @param {string} storeId - The store ID (menu ID)
 * @param {Array} printers - Optional array of printers (to avoid duplicate API calls)
 * @returns {Promise<Object>} Result of print job creation
 */
export async function createPrintJobsForOrder(
  order,
  menuLink,
  ownerEmail,
  storeId,
  printers = null,
) {
  return await createPrintJobsForOrderAction(
    order,
    menuLink,
    ownerEmail,
    storeId,
    printers,
  );
}

export async function deletePrinter(printerId) {
  return await deletePrinterAction(printerId);
}

export async function addPrinter(printerData) {
  return await addPrinterAction(printerData);
}

export async function updatePrinter(printerId, printerData) {
  return await updatePrinterAction(printerId, printerData);
}

/**
 * Local Mode printers cache (isTesting + native only).
 *
 * Testing + native always writes SQLite after a network fetch.
 * Memory → SQLite without a fetch only when isOffline (cache-first).
 * Normal mode always hits the server, then saves the snapshot for later.
 * Pass force:true after catalog sync or printer CRUD.
 *
 * printersSnapshot is dynamic-imported so SSR (layout → fetchApi) never loads
 * the Capacitor SQLite plugin on the server.
 */
async function getPrintersWithLocalCache({ force = false } = {}) {
  if (!isLocalCatalogCacheEnabled()) {
    return await fetchPrintersAction();
  }

  const {
    getMemoryPrinters,
    setMemoryPrinters,
    savePrintersSnapshot,
    readPrintersSnapshot,
  } = await import("@/lib/localDb/printersSnapshot");

  if (!force && isLocalCatalogCacheFirst()) {
    const memory = getMemoryPrinters();
    if (memory) return memory;

    const disk = await readPrintersSnapshot();
    if (disk?.payload) {
      setMemoryPrinters(disk.payload);
      return disk.payload;
    }
  }

  const data = await fetchPrintersAction();
  const normalized = {
    printers: Array.isArray(data?.printers) ? data.printers : [],
  };
  setMemoryPrinters(normalized);
  await savePrintersSnapshot(normalized);
  return normalized;
}

/**
 * Force network printers fetch and rewrite memory + SQLite.
 * Use after add/update/delete on Printer Management, and catalog sync.
 */
export async function refreshPrintersCache() {
  return await getPrintersWithLocalCache({ force: true });
}

/**
 * Checks if printers are available for a specific order type.
 * Uses the same local printers cache as fetchPrinters when isTesting.
 * Filtering stays client-side so we do not bypass the cache via the server action.
 *
 * @param {string} orderType - "takeaway" or "dinein"
 * @returns {Promise<Object>} availability status and matching printers
 */
export async function checkPrinterAvailability(orderType) {
  // Gate off: keep the original server action path.
  if (!isLocalCatalogCacheEnabled()) {
    return await checkPrinterAvailabilityAction(orderType);
  }

  try {
    const printersData = await getPrintersWithLocalCache({
      force: !isLocalCatalogCacheFirst(),
    });
    const printers = printersData.printers || [];

    if (printers.length === 0) {
      return {
        available: false,
        count: 0,
        message: "No printers configured for this store",
      };
    }

    const applicablePrinters = printers.filter((printer) => {
      if (orderType === "takeaway") return printer.forTakeaway === true;
      if (orderType === "dinein") return printer.forDineIn === true;
      return false;
    });

    if (applicablePrinters.length === 0) {
      return {
        available: false,
        count: 0,
        message: `No printers configured for ${orderType} orders`,
      };
    }

    return {
      available: true,
      count: applicablePrinters.length,
      message: `${applicablePrinters.length} printer(s) available for ${orderType} orders`,
      printers: applicablePrinters,
    };
  } catch (error) {
    console.error("checkPrinterAvailability (local cache):", error);
    return {
      available: false,
      count: 0,
      message: "Error checking printer availability",
    };
  }
}

export async function logPrintError(payload) {
  return await logPrintErrorAction(payload);
}

export async function fetchPrinters() {
  return await getPrintersWithLocalCache({ force: false });
}

/** POS: load unpaid tickets for resume. */
export async function fetchPosResumeOrders(orderIds) {
  return await fetchPosResumeOrdersAction(orderIds);
}

/** POS: unpaid tickets (dine-in merged by table). */
export async function fetchPosHeldOrders() {
  return await fetchPosHeldOrdersAction();
}

/** POS: record that a BILL was printed for table map status. */
export async function markPosBillPrinted(orderIds) {
  return await markPosBillPrintedAction(orderIds);
}

/** POS: create a new kitchen fire (one order per Send). */
export async function sendPosOrder(payload) {
  return await sendPosOrderAction(payload);
}

/** POS: union seat names onto an open unpaid check. */
export async function mergePosTables(payload) {
  return await mergePosTablesAction(payload);
}

/** POS: dissolve multi-seat association; keep check on keepTable. */
export async function unmergePosTables(payload) {
  return await unmergePosTablesAction(payload);
}

/** POS: pay all tickets in a table check. */
export async function completePosSaleBatch(payload) {
  return await completePosSaleBatchAction(payload);
}

/** POS: apply or clear a check-level discount. */
export async function applyPosCheckDiscount(payload) {
  return await applyPosCheckDiscountAction(payload);
}

/** POS: finalise a single POS sale with cash/card tender. */
export async function completePosSale(orderId, payload) {
  return await completePosSaleAction(orderId, payload);
}

/** POS: batch kitchen status for tickets on a Held check. */
export async function updatePosHeldCheckStatus(payload) {
  return await updatePosHeldCheckStatusAction(payload);
}

/** POS: void a sent line on an unpaid ticket. */
export async function cancelPosOrderItem(payload) {
  return await cancelPosOrderItemAction(payload);
}

/** POS register: current open session or null. */
export async function fetchPosRegisterSession() {
  return await fetchPosRegisterSessionAction();
}

/** POS register: open with opening float. */
export async function openPosRegisterSession(payload) {
  return await openPosRegisterSessionAction(payload);
}

/** POS register: cash pay-in / pay-out. */
export async function addPosRegisterMovement(payload) {
  return await addPosRegisterMovementAction(payload);
}

/** POS register: finalise denomination counts. */
export async function finalisePosRegisterSession(payload) {
  return await finalisePosRegisterSessionAction(payload);
}

/** POS register: close after finalise. */
export async function closePosRegisterSession(payload) {
  return await closePosRegisterSessionAction(payload);
}

/** POS register: live expected cash preview (no mutate). */
export async function fetchPosRegisterClosingPreview() {
  return await fetchPosRegisterClosingPreviewAction();
}

/** POS register: secondTest auto-finalise + close. */
export async function closePosRegisterSessionSecondTest(payload) {
  return await closePosRegisterSessionSecondTestAction(payload);
}
