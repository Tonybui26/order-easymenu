"use client";

import { useEffect } from "react";
import { App } from "@capacitor/app";
import {
  canUseCustomerDisplay,
  closeCustomerDisplay,
  openCustomerDisplay,
} from "@/lib/customerDisplay/customerDisplay";

/**
 * Default-on customer rear display for dual-screen Android POS (e.g. iMin Swan 2).
 * Opens idle Welcome UI when a secondary display exists; no-op otherwise.
 * Re-opens on app resume (Presentation is tied to the activity).
 */
export default function CustomerDisplayHost() {
  const enabled = canUseCustomerDisplay();

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
