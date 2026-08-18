"use server";

import { getServerSession } from "next-auth";
import { NextAuthOptions } from "@/lib/auth/nextAuthOptions";
import { createTokenFromSession } from "@/lib/auth/tokenUtils";
import { getMainAppUrl, readMainAppApiError } from "@/lib/api/mainAppServer";
import { updateOrderStatusAction } from "@/lib/actions/orderActions";

const MAIN_APP_URL_API =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : getMainAppUrl();

async function getStaffAuthContext() {
  const session = await getServerSession(NextAuthOptions);
  if (!session) {
    throw new Error("Not authenticated");
  }
  return {
    session,
    jwtToken: createTokenFromSession(session),
  };
}

/**
 * Create a new POS kitchen fire (one order per Send).
 * Optional posCheckId groups fires into one payable takeaway/delivery check.
 * @param {object} payload
 * @returns {Promise<{ success: boolean, order?: object, error?: string }>}
 */
export async function sendPosOrderAction(payload) {
  try {
    const { jwtToken } = await getStaffAuthContext();

    const response = await fetch(`${MAIN_APP_URL_API}/api/pos/orders/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwtToken}`,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!response.ok) {
      const error = await readMainAppApiError(response);
      return { success: false, error };
    }

    const data = await response.json();
    return { success: true, order: data.order ?? null };
  } catch (error) {
    console.error("sendPosOrderAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to send POS order",
    };
  }
}

/**
 * Fetch open POS tickets (unpaid or paid, not delivered; dine-in by table, takeaway by posCheckId).
 * @returns {Promise<{ success: boolean, heldOrders?: Array, error?: string }>}
 */
export async function fetchPosHeldOrdersAction() {
  try {
    const { jwtToken } = await getStaffAuthContext();

    const response = await fetch(`${MAIN_APP_URL_API}/api/pos/orders/held`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwtToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const error = await readMainAppApiError(response);
      return { success: false, error };
    }

    const data = await response.json();
    return { success: true, heldOrders: data.heldOrders ?? [] };
  } catch (error) {
    console.error("fetchPosHeldOrdersAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch held orders",
    };
  }
}

/**
 * Load unpaid POS tickets into the POS terminal cart.
 * @param {string[]} orderIds
 * @returns {Promise<{ success: boolean, orders?: Array, error?: string }>}
 */
export async function fetchPosResumeOrdersAction(orderIds) {
  try {
    const ids = (orderIds || []).map((id) => String(id).trim()).filter(Boolean);
    if (ids.length === 0) {
      return { success: false, error: "Order id is required" };
    }

    const { jwtToken } = await getStaffAuthContext();
    const query = new URLSearchParams({ orderIds: ids.join(",") });

    const response = await fetch(
      `${MAIN_APP_URL_API}/api/pos/orders/resume?${query.toString()}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwtToken}`,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const error = await readMainAppApiError(response);
      return { success: false, error };
    }

    const data = await response.json();
    return { success: true, orders: data.orders ?? [] };
  } catch (error) {
    console.error("fetchPosResumeOrdersAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to load held order",
    };
  }
}

/**
 * Pay all POS tickets in a table check (tender recorded on one order).
 * @param {{ orderIds: string[], method: string, amountTendered: number, changeDue: number, processingFee?: number }} payload
 * @returns {Promise<{ success: boolean, orders?: Array, error?: string }>}
 */
export async function completePosSaleBatchAction(payload) {
  try {
    const orderIds = (payload?.orderIds || [])
      .map((id) => String(id).trim())
      .filter(Boolean);
    if (orderIds.length === 0) {
      return { success: false, error: "orderIds is required" };
    }

    const { jwtToken } = await getStaffAuthContext();

    const response = await fetch(
      `${MAIN_APP_URL_API}/api/pos/orders/complete`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwtToken}`,
        },
        body: JSON.stringify({
          orderIds,
          method: payload.method,
          amountTendered: payload.amountTendered,
          changeDue: payload.changeDue,
          processingFee: payload.processingFee,
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const error = await readMainAppApiError(response);
      return { success: false, error };
    }

    const data = await response.json();
    return { success: true, orders: data.orders ?? [] };
  } catch (error) {
    console.error("completePosSaleBatchAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to complete POS check",
    };
  }
}

/**
 * Finalise a POS sale with cash/card tender.
 * @param {string} orderId
 * @param {{ method: string, amountTendered: number, changeDue: number }} payload
 * @returns {Promise<{ success: boolean, order?: object, error?: string }>}
 */
export async function completePosSaleAction(orderId, payload) {
  try {
    if (!orderId) {
      return { success: false, error: "Order id is required" };
    }

    const { jwtToken } = await getStaffAuthContext();

    const response = await fetch(
      `${MAIN_APP_URL_API}/api/pos/orders/${orderId}/complete`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwtToken}`,
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const error = await readMainAppApiError(response);
      return { success: false, error };
    }

    const data = await response.json();
    return { success: true, order: data.order ?? null };
  } catch (error) {
    console.error("completePosSaleAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to complete POS sale",
    };
  }
}

/**
 * Batch-update kitchen status for all tickets in a Held check.
 * @param {{ orderIds: string[], status: string, cancelReason?: string, requireCancelReason?: boolean }} payload
 */
export async function updatePosHeldCheckStatusAction(payload) {
  try {
    const orderIds = (payload?.orderIds || [])
      .map((id) => String(id).trim())
      .filter(Boolean);
    const status = String(payload?.status || "").trim();
    const cancelReason = String(payload?.cancelReason || "").trim();
    const requireCancelReason = Boolean(payload?.requireCancelReason);

    if (orderIds.length === 0) {
      return { success: false, error: "orderIds is required" };
    }
    if (!status) {
      return { success: false, error: "status is required" };
    }

    await Promise.all(
      orderIds.map((orderId) =>
        updateOrderStatusAction(orderId, status, {
          cancelReason: cancelReason || undefined,
          requireCancelReason,
        }),
      ),
    );

    return { success: true };
  } catch (error) {
    console.error("updatePosHeldCheckStatusAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to update held check status",
    };
  }
}

/**
 * Void a sent POS line on an unpaid ticket.
 * @param {{ orderId: string, lineId: string, reason: string }} payload
 */
export async function cancelPosOrderItemAction(payload) {
  try {
    const { jwtToken } = await getStaffAuthContext();

    const response = await fetch(
      `${MAIN_APP_URL_API}/api/pos/orders/items/cancel`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwtToken}`,
        },
        body: JSON.stringify(payload ?? {}),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const error = await readMainAppApiError(response);
      return { success: false, error };
    }

    const data = await response.json();
    return {
      success: true,
      order: data.order ?? null,
      item: data.item ?? null,
    };
  } catch (error) {
    console.error("cancelPosOrderItemAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to void line",
    };
  }
}
