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
 * Apply or clear a check-level discount on unpaid POS tickets.
 * @param {{ orderIds: string[], discountAmount: number, discountPercent?: number|null, discountType?: string|null }} payload
 */
export async function applyPosCheckDiscountAction(payload) {
  try {
    const orderIds = (payload?.orderIds || [])
      .map((id) => String(id).trim())
      .filter(Boolean);
    if (orderIds.length === 0) {
      return { success: false, error: "orderIds is required" };
    }

    const { jwtToken } = await getStaffAuthContext();

    const response = await fetch(
      `${MAIN_APP_URL_API}/api/pos/orders/discount`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwtToken}`,
        },
        body: JSON.stringify({
          orderIds,
          discountAmount: payload?.discountAmount ?? 0,
          discountPercent: payload?.discountPercent ?? null,
          discountType: payload?.discountType ?? null,
        }),
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
      discount: data.discount ?? null,
      orders: data.orders ?? [],
    };
  } catch (error) {
    console.error("applyPosCheckDiscountAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to apply POS discount",
    };
  }
}

/**
 * Pay all POS tickets in a table check (tender recorded on one order).
 * @param {{ orderIds: string[], method: string, amountTendered: number, changeDue: number, processingFee?: number, discountAmount?: number, discountPercent?: number|null, discountType?: string|null }} payload
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

    const requestBody = {
      orderIds,
      method: payload.method,
      amountTendered: payload.amountTendered,
      changeDue: payload.changeDue,
      processingFee: payload.processingFee,
    };

    if (payload.discountAmount != null || payload.discountType != null) {
      requestBody.discountAmount = payload.discountAmount ?? 0;
      requestBody.discountPercent = payload.discountPercent ?? null;
      requestBody.discountType = payload.discountType ?? null;
    }

    const response = await fetch(
      `${MAIN_APP_URL_API}/api/pos/orders/complete`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwtToken}`,
        },
        body: JSON.stringify(requestBody),
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

/**
 * Record that a BILL receipt was printed for POS tickets (table map status).
 * @param {string[]} orderIds
 */
export async function markPosBillPrintedAction(orderIds) {
  try {
    const { jwtToken } = await getStaffAuthContext();
    const ids = Array.isArray(orderIds)
      ? [...new Set(orderIds.map((id) => String(id).trim()).filter(Boolean))]
      : [];

    if (ids.length === 0) {
      return { success: false, error: "orderIds must be a non-empty array" };
    }

    const response = await fetch(
      `${MAIN_APP_URL_API}/api/pos/orders/bill-printed`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwtToken}`,
        },
        body: JSON.stringify({ orderIds: ids }),
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
      matchedCount: data.matchedCount ?? 0,
      modifiedCount: data.modifiedCount ?? 0,
      billPrintedAt: data.billPrintedAt ?? null,
    };
  } catch (error) {
    console.error("markPosBillPrintedAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to record bill print",
    };
  }
}

/**
 * Union seat names onto an open unpaid POS check (table map merge).
 * @param {{ tables: string[], orderIds?: string[], posCheckId?: string }} payload
 */
export async function mergePosTablesAction(payload) {
  try {
    const { jwtToken } = await getStaffAuthContext();

    const response = await fetch(
      `${MAIN_APP_URL_API}/api/pos/orders/merge-tables`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwtToken}`,
        },
        body: JSON.stringify(payload || {}),
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
      posCheckId: data.posCheckId ?? null,
      table: data.table ?? null,
      tables: data.tables ?? [],
      matchedCount: data.matchedCount ?? 0,
    };
  } catch (error) {
    console.error("mergePosTablesAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to merge tables",
    };
  }
}

/**
 * Dissolve multi-seat association; keep check on keepTable.
 * @param {{ keepTable: string, orderIds?: string[], posCheckId?: string }} payload
 */
export async function unmergePosTablesAction(payload) {
  try {
    const { jwtToken } = await getStaffAuthContext();

    const response = await fetch(
      `${MAIN_APP_URL_API}/api/pos/orders/unmerge-tables`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwtToken}`,
        },
        body: JSON.stringify(payload || {}),
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
      posCheckId: data.posCheckId ?? null,
      table: data.table ?? null,
      matchedCount: data.matchedCount ?? 0,
    };
  } catch (error) {
    console.error("unmergePosTablesAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to unmerge tables",
    };
  }
}
