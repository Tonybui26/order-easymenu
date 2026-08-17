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

async function posRegisterFetch(path, { method = "GET", body } = {}) {
  const { jwtToken } = await getStaffAuthContext();
  const response = await fetch(`${MAIN_APP_URL_API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwtToken}`,
    },
    body: body != null ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await readMainAppApiError(response);
    return { success: false, error, status: response.status };
  }

  const data = await response.json();
  return { success: true, session: data.session ?? null, ...data };
}

/**
 * Current open register session, or null.
 * @returns {Promise<{ success: boolean, session?: object|null, error?: string }>}
 */
export async function fetchPosRegisterSessionAction() {
  try {
    return await posRegisterFetch("/api/pos/register/session");
  } catch (error) {
    console.error("fetchPosRegisterSessionAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch register session",
    };
  }
}

/**
 * Open the store register with an opening float.
 * @param {{ openingFloat: number, operator?: object }} payload
 */
export async function openPosRegisterSessionAction(payload) {
  try {
    return await posRegisterFetch("/api/pos/register/session/open", {
      method: "POST",
      body: payload,
    });
  } catch (error) {
    console.error("openPosRegisterSessionAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to open register",
    };
  }
}

/**
 * Record a cash pay-in or pay-out.
 * @param {{ type: "pay-in"|"pay-out", amount: number, comment?: string, operator?: object }} payload
 */
export async function addPosRegisterMovementAction(payload) {
  try {
    return await posRegisterFetch("/api/pos/register/session/movements", {
      method: "POST",
      body: payload,
    });
  } catch (error) {
    console.error("addPosRegisterMovementAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to record cash movement",
    };
  }
}

/**
 * Finalise closing denomination counts and lock expected/variance.
 * @param {{ counts: object[], operator?: object }} payload
 */
export async function finalisePosRegisterSessionAction(payload) {
  try {
    return await posRegisterFetch("/api/pos/register/session/finalise", {
      method: "POST",
      body: payload,
    });
  } catch (error) {
    console.error("finalisePosRegisterSessionAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to finalise register",
    };
  }
}

/**
 * Close the register after counts are finalised.
 * @param {{ operator?: object }} payload
 */
export async function closePosRegisterSessionAction(payload = {}) {
  try {
    return await posRegisterFetch("/api/pos/register/session/close", {
      method: "POST",
      body: payload,
    });
  } catch (error) {
    console.error("closePosRegisterSessionAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to close register",
    };
  }
}
