import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { NextAuthOptions } from "@/lib/auth/nextAuthOptions";
import { createTokenFromSession } from "@/lib/auth/tokenUtils";
import { getMainAppUrl, readMainAppApiError } from "@/lib/api/mainAppServer";

/**
 * POST /api/linkly/refund
 *
 * Same pattern as purchase: Route Handler proxy so long VPP waits do not
 * block order-polling server actions.
 *
 * Body: { amountCents: number, rfn: string, txnRef?: string }
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

    const body = await request.json();
    const amountCents = Math.round(Number(body?.amountCents));
    const rfn = String(body?.rfn ?? "").trim();

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return NextResponse.json(
        { error: "amountCents must be a positive integer (cents)" },
        { status: 400 },
      );
    }

    if (!rfn) {
      return NextResponse.json(
        {
          error:
            "RFN from the original purchase is required for a matched refund",
        },
        { status: 400 },
      );
    }

    const jwtToken = createTokenFromSession(session);
    const payload = { amountCents, rfn };
    if (body?.txnRef) {
      payload.txnRef = String(body.txnRef).trim().slice(0, 16);
    }

    const response = await fetch(
      `${MAIN_APP_URL_API}/api/order-app/linkly/refund`,
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
        { error: error || "Linkly refund failed" },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json({
      success: true,
      transaction: data.transaction ?? null,
      message: data.message,
      debug: data.debug ?? null,
    });
  } catch (error) {
    console.error("POST /api/linkly/refund error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to run Linkly refund" },
      { status: 500 },
    );
  }
}
