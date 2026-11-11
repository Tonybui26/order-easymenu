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
 * Validates credentials without creating a session. Used to show the device
 * picker before NextAuth sign-in when the store is at its device limit.
 */
export async function preflightOrderManagerLoginAction({
  menuLink,
  username,
  password,
}) {
  try {
    const response = await fetch(
      `${MAIN_APP_URL_API}/api/auth/order-manager-login`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menuLink,
          username,
          password,
          preflight: true,
        }),
        cache: "no-store",
      },
    );

    const data = await response.json().catch(() => ({}));

    if (response.status === 409 && data?.code === "DEVICE_LIMIT_REACHED") {
      return {
        ok: false,
        conflict: true,
        maxDevices: data.maxDevices,
        activeDeviceCount: data.activeDeviceCount,
        devicesToRevoke: data.devicesToRevoke,
        devices: data.devices || [],
        message: data.message,
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        conflict: false,
        message: data?.message || "Invalid username or password",
      };
    }

    return {
      ok: true,
      conflict: false,
      maxDevices: data.maxDevices,
      activeDeviceCount: data.activeDeviceCount,
      devices: data.devices || [],
    };
  } catch (error) {
    console.error("preflightOrderManagerLoginAction error:", error);
    return { ok: false, conflict: false, message: "Unable to sign in" };
  }
}

/** Best-effort release of this device's OM session before local sign-out. */
export async function releaseOrderManagerSessionAction() {
  const session = await getServerSession(NextAuthOptions);
  if (!session?.user?.sessionId) {
    return { ok: true };
  }

  try {
    const jwtToken = createTokenFromSession(session);
    const response = await fetch(
      `${MAIN_APP_URL_API}/api/auth/order-manager-logout`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwtToken}`,
        },
        cache: "no-store",
      },
    );
    return { ok: response.ok };
  } catch (error) {
    console.error("releaseOrderManagerSessionAction error:", error);
    return { ok: false };
  }
}

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
