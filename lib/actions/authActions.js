"use server";

import { getServerSession } from "next-auth";
import { NextAuthOptions } from "@/lib/auth/nextAuthOptions";
import { createTokenFromSession } from "@/lib/auth/tokenUtils";
import { getMainAppUrl, readMainAppApiError } from "@/lib/api/mainAppServer";

const MAIN_APP_URL_API =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : getMainAppUrl();

export async function verifyStaffPinAction(pinCode) {
  const session = await getServerSession(NextAuthOptions);

  if (!session?.user?.menuLink) {
    return { ok: false, message: "Not authenticated" };
  }

  try {
    const jwtToken = createTokenFromSession(session);
    const response = await fetch(
      `${MAIN_APP_URL_API}/api/auth/staff-pin-verify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwtToken}`,
        },
        body: JSON.stringify({
          menuLink: session.user.menuLink,
          pinCode,
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const message = await readMainAppApiError(response);
      return {
        ok: false,
        status: response.status,
        message: message || "Invalid pin",
      };
    }

    const data = await response.json();
    const operator = data?.operator;
    if (!operator?.username) {
      return { ok: false, message: "Invalid pin" };
    }

    return {
      ok: true,
      operator: {
        username: operator.username,
        name: operator.name || operator.username,
        role: operator.role || "",
      },
    };
  } catch (error) {
    console.error("verifyStaffPinAction error:", error);
    return { ok: false, message: "Unable to verify pin" };
  }
}
