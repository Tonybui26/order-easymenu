"use client";

import { useEffect, useRef } from "react";
import { App } from "@capacitor/app";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  canUseCustomerDisplay,
  closeCustomerDisplay,
  openCustomerDisplay,
} from "@/lib/customerDisplay/customerDisplay";

const CUSTOMER_DISPLAY_PATH = "/customer-display";

/**
 * Default-on customer rear display for dual-screen Android POS (e.g. iMin Swan 2).
 * Opens /customer-display in a Presentation WebView when a secondary display exists.
 * Skips when this page is already the rear WebView (avoid recursion).
 * After main-app login, force-reloads so the rear page is not left on a stuck first load.
 */
export default function CustomerDisplayHost() {
  const pathname = usePathname();
  const { status } = useSession();
  const isRearPage = pathname === CUSTOMER_DISPLAY_PATH;
  const enabled = canUseCustomerDisplay() && !isRearPage;
  const prevStatusRef = useRef(status);

  useEffect(() => {
    if (!enabled) return undefined;

    openCustomerDisplay().catch(() => {});

    let listener;
    App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        openCustomerDisplay().catch(() => {});
      }
    }).then((handle) => {
      listener = handle;
    });

    return () => {
      listener?.remove?.();
      closeCustomerDisplay().catch(() => {});
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      prevStatusRef.current = status;
      return;
    }

    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    if (prev !== "authenticated" && status === "authenticated") {
      openCustomerDisplay({ forceReload: true }).catch(() => {});
    }
  }, [enabled, status]);

  return null;
}
