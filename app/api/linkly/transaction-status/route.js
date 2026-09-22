import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { NextAuthOptions } from "@/lib/auth/nextAuthOptions";
import { createTokenFromSession } from "@/lib/auth/tokenUtils";
import { getMainAppUrl, readMainAppApiError } from "@/lib/api/mainAppServer";

/**
 * POST /api/linkly/transaction-status
 *
 * Proxies error-recovery status / recover-last to easymenu.
 * Use wait:true for backoff polling (can run up to ~3 minutes).
 */
export const maxDuration = 300;

const MAIN_APP_URL_API =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : getMainAppUrl();

export async function POST(request) {
  try {
    const session = await getServerSession(NextAuthOptions);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const payload = {
      wait: Boolean(body?.wait),
      recoverLast: Boolean(body?.recoverLast),
    };
    if (body?.sessionId) {
      payload.sessionId = String(body.sessionId).trim();
    }

    const jwtToken = createTokenFromSession(session);
    const response = await fetch(
      `${MAIN_APP_URL_API}/api/order-app/linkly/transaction-status`,
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
      return NextResponse.json(
        { error: error || "Linkly transaction status failed" },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error) {
    console.error("POST /api/linkly/transaction-status error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to query Linkly transaction status" },
      { status: 500 },
    );
  }
}
