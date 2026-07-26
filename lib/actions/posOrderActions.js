"use server";

import { getServerSession } from "next-auth";
import { NextAuthOptions } from "@/lib/auth/nextAuthOptions";
import { createTokenFromSession } from "@/lib/auth/tokenUtils";
import { getMainAppUrl, readMainAppApiError } from "@/lib/api/mainAppServer";

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
 * Create a POS ticket or append newly fired lines.
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
