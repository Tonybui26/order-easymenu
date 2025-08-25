import {
  checkPrinterAvailabilityAction,
  createPrintJobsForOrderAction,
  fetchOrdersAction,
  updateMenuConfigAction,
  updateOrderPaymentStatusAction,
  updateOrderStatusAction,
} from "@/lib/actions/orderActions";

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
  limit = 50,
) {
  const baseUrl = MAIN_APP_URL_API;
  const params = new URLSearchParams();

  // Send start date (UTC ISO string) for precise range filtering
  if (startDate) {
    params.append("startDate", startDate);
  }

  // Send end date (UTC ISO string) for precise range filtering
  if (endDate) {
    params.append("endDate", endDate);
  }

  if (limit) {
    params.append("limit", limit.toString());
  }

  const res = await fetch(
    `${baseUrl}/api/orders/completed?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  if (!res.ok) {
    const errorDetails = await res.json();
    throw new Error(`${errorDetails.message || res.statusText}`);
  }
  return await res.json();
}

/**
 * Updates an order's status
 * @param {string} orderId - The order ID
 * @param {string} status - The new status
 * @returns {Promise<Object>} The updated order
 */
export async function updateOrderStatus(orderId, status) {
  return await updateOrderStatusAction(orderId, status);
}

// Update Menu Config
export async function updateMenuConfig(menuConfig) {
  return await updateMenuConfigAction(menuConfig);
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

export async function fetchGetMenuByOwnerEmail(ownerEmail) {
  const baseUrl = MAIN_APP_URL_API;
  const queryParams = new URLSearchParams({ ownerEmail }).toString();
  const res = await fetch(`${baseUrl}/api/menu/get-menu?${queryParams}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  console.log("fetchGetMenuByOwnerEmail", res);

  if (!res.ok) {
    const errorDetails = await res.json();
    if (res.status === 404) {
      return null;
    }
    throw new Error(`${errorDetails.message || res.statusText}`);
  }
  const { menu } = await res.json();
  return menu;
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

/**
 * Checks if printers are available for a specific order type
 * @param {string} ownerEmail - The owner email
 * @param {string} orderType - The order type ("takeaway" or "dinein")
 * @returns {Promise<Object>} Object containing availability status and printer count
 */
export async function checkPrinterAvailability(ownerEmail, orderType) {
  return await checkPrinterAvailabilityAction(ownerEmail, orderType);
}
