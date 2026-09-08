"use client";

import { useEffect } from "react";
import { App } from "@capacitor/app";
import { usePathname } from "next/navigation";
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
 */
export default function CustomerDisplayHost() {
  const pathname = usePathname();
  const isRearPage = pathname === CUSTOMER_DISPLAY_PATH;
  const enabled = canUseCustomerDisplay() && !isRearPage;

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

  return null;
}
