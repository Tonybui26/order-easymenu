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
 * Pair a Linkly Cloud PIN pad / Virtual Pinpad via easymenu.
 *
 * REVIEW: Credentials (username/password/pairCode) are forwarded once to
 * easymenu → Linkly. The pairing secret is stored on the menu in easymenu and
 * is not returned to this app.
 *
 * @param {{ username: string, password: string, pairCode: string }} payload
 */
export async function pairLinklyTerminalAction(payload) {
  try {
    const session = await getServerSession(NextAuthOptions);
    if (!session) {
      return { success: false, error: "Not authenticated" };
    }

    const username = String(payload?.username ?? "").trim();
    const password = String(payload?.password ?? "");
    const pairCode = String(payload?.pairCode ?? "").trim();

    if (!username || !password || !pairCode) {
      return {
        success: false,
        error: "Username, password, and pair code are required",
      };
    }

    const jwtToken = createTokenFromSession(session);
    const response = await fetch(
      `${MAIN_APP_URL_API}/api/order-app/linkly/pair`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwtToken}`,
        },
        body: JSON.stringify({ username, password, pairCode }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const error = await readMainAppApiError(response);
      return {
        success: false,
        error: error || "Linkly pairing failed",
        status: response.status,
      };
    }

    const data = await response.json();
    return {
      success: true,
      linkly: data.linkly ?? null,
      message: data.message,
    };
  } catch (error) {
    console.error("pairLinklyTerminalAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to pair Linkly terminal",
    };
  }
}

/**
 * Run a Linkly Cloud purchase (token + sync txn on easymenu).
 * Prefer `purchaseLinkly()` in fetchApi.js which hits `/api/linkly/purchase`
 * (avoids server-action queue blocking order polls during card wait).
 *
 * @deprecated Use client fetch via purchaseLinkly() instead.
 * @param {{ amountCents: number, txnRef?: string }} payload
 */
export async function purchaseLinklyAction(payload) {
  try {
    const session = await getServerSession(NextAuthOptions);
    if (!session) {
      return { success: false, error: "Not authenticated" };
    }

    const amountCents = Math.round(Number(payload?.amountCents));
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return {
        success: false,
        error: "Enter a purchase amount greater than zero",
      };
    }

    const jwtToken = createTokenFromSession(session);
    const body = { amountCents };
    if (payload?.txnRef) {
      body.txnRef = String(payload.txnRef).trim().slice(0, 16);
    }

    const response = await fetch(
      `${MAIN_APP_URL_API}/api/order-app/linkly/purchase`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwtToken}`,
        },
        body: JSON.stringify(body),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const error = await readMainAppApiError(response);
      return {
        success: false,
        error: error || "Linkly purchase failed",
        status: response.status,
      };
    }

    const data = await response.json();
    return {
      success: true,
      transaction: data.transaction ?? null,
      message: data.message,
      debug: data.debug ?? null,
    };
  } catch (error) {
    console.error("purchaseLinklyAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to run Linkly purchase",
    };
  }
}
