"use client";

import { useEffect } from "react";
import { App } from "@capacitor/app";
import { usePathname } from "next/navigation";
import { useMenuContext } from "@/components/context/MenuContext";
import {
  activateImmersiveMode,
  canUseImmersiveMode,
  deactivateImmersiveMode,
} from "@/lib/immersive/immersiveMode";

/**
 * When POS is enabled on native Android: enter immersive (hide system bars)
 * and re-apply on resume. No-op on web / iOS / when POS is off.
 * Skips the customer-display rear WebView so it does not toggle the main activity.
 */
export default function PosImmersiveHost() {
  const pathname = usePathname();
  const { menuConfig } = useMenuContext();
  const posEnabled = Boolean(menuConfig?.posEnabled);
  const enabled =
    pathname !== "/customer-display" &&
    posEnabled &&
    canUseImmersiveMode();

  useEffect(() => {
    if (pathname === "/customer-display") return undefined;

    if (!enabled) {
      deactivateImmersiveMode().catch(() => {});
      return undefined;
    }

    activateImmersiveMode().catch(() => {});

    let listener;
    App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        activateImmersiveMode().catch(() => {});
      }
    }).then((handle) => {
      listener = handle;
    });

    return () => {
      listener?.remove?.();
      deactivateImmersiveMode().catch(() => {});
    };
  }, [enabled, pathname]);

  return null;
}
