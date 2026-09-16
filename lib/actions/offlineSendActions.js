"use server";

import { getServerSession } from "next-auth";
import { NextAuthOptions } from "@/lib/auth/nextAuthOptions";
import { createTokenFromSession } from "@/lib/auth/tokenUtils";
import { getMainAppUrl, readMainAppApiError } from "@/lib/api/mainAppServer";

const MAIN_APP_URL_API =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : getMainAppUrl();

/**
 * Sync one locally saved POS fire. Isolated from sendPosOrderAction.
 * The server treats localId as an idempotency key.
 *
 * @param {object} payload
 * @returns {Promise<{ success: boolean, order?: object, replayed?: boolean, error?: string }>}
 */
export async function syncOfflinePosSendAction(payload) {
  try {
    const session = await getServerSession(NextAuthOptions);
    if (!session) {
      return { success: false, error: "Not authenticated" };
    }

    const response = await fetch(
      `${MAIN_APP_URL_API}/api/pos/orders/send-offline`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${createTokenFromSession(session)}`,
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
    return {
      success: true,
      order: data.order ?? null,
      replayed: data.replayed === true,
    };
  } catch (error) {
    console.error("syncOfflinePosSendAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to sync offline POS order",
    };
  }
}

/**
 * Sync one locally saved tender. Isolated from completePosSaleBatchAction.
 * localPaymentId is the idempotency key. localIds must already exist on the server.
 *
 * @param {object} payload
 * @returns {Promise<{ success: boolean, waiting?: boolean, orders?: object[], error?: string }>}
 */
export async function syncOfflinePosPaymentAction(payload) {
  try {
    const session = await getServerSession(NextAuthOptions);
    if (!session) {
      return { success: false, error: "Not authenticated" };
    }

    const response = await fetch(
      `${MAIN_APP_URL_API}/api/pos/orders/complete-offline`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${createTokenFromSession(session)}`,
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      },
    );

    if (response.status === 409) {
      return { success: false, waiting: true };
    }

    if (!response.ok) {
      const error = await readMainAppApiError(response);
      return { success: false, error };
    }

    const data = await response.json();
    return {
      success: true,
      orders: data.orders ?? [],
      replayed: data.replayed === true,
    };
  } catch (error) {
    console.error("syncOfflinePosPaymentAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to sync offline POS tender",
    };
  }
}
