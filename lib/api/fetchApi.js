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
  completePosSaleAction,
  completePosSaleBatchAction,
  fetchPosHeldOrdersAction,
  fetchPosResumeOrdersAction,
  sendPosOrderAction,
  updatePosHeldCheckStatusAction,
  cancelPosOrderItemAction,
} from "@/lib/actions/posOrderActions";
import {
  addPosRegisterMovementAction,
  closePosRegisterSessionAction,
  fetchPosRegisterSessionAction,
  finalisePosRegisterSessionAction,
  openPosRegisterSessionAction,
} from "@/lib/actions/registerActions";

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

export async function updateMenuItemSoldOut(menuItemId, soldOut) {
  return await updateMenuItemSoldOutAction(menuItemId, soldOut);
}

export async function updateModifierOptionAvailability(
  sourceType,
  groupKey,
  optionId,
  available,
) {
  return await updateModifierOptionAvailabilityAction(
    sourceType,
    groupKey,
    optionId,
    available,
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
 * Checks if printers are available for a specific order type
 * @param {string} ownerEmail - The owner email
 * @param {string} orderType - The order type ("takeaway" or "dinein")
 * @returns {Promise<Object>} Object containing availability status and printer count
 */
export async function checkPrinterAvailability(orderType) {
  return await checkPrinterAvailabilityAction(orderType);
}

export async function logPrintError(payload) {
  return await logPrintErrorAction(payload);
}

export async function fetchPrinters() {
  return await fetchPrintersAction();
}

/** POS: load unpaid tickets for resume. */
export async function fetchPosResumeOrders(orderIds) {
  return await fetchPosResumeOrdersAction(orderIds);
}

/** POS: unpaid tickets (dine-in merged by table). */
export async function fetchPosHeldOrders() {
  return await fetchPosHeldOrdersAction();
}

/** POS: create a new kitchen fire (one order per Send). */
export async function sendPosOrder(payload) {
  return await sendPosOrderAction(payload);
}

/** POS: pay all tickets in a table check. */
export async function completePosSaleBatch(payload) {
  return await completePosSaleBatchAction(payload);
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
