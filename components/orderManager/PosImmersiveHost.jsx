"use client";

import { useEffect } from "react";
import { App } from "@capacitor/app";
import { useMenuContext } from "@/components/context/MenuContext";
import {
  activateImmersiveMode,
  canUseImmersiveMode,
  deactivateImmersiveMode,
} from "@/lib/immersive/immersiveMode";

/**
 * When POS is enabled on native Android: enter immersive (hide system bars)
 * and re-apply on resume. No-op on web / iOS / when POS is off.
 */
export default function PosImmersiveHost() {
  const { menuConfig } = useMenuContext();
  const posEnabled = Boolean(menuConfig?.posEnabled);
  const enabled = posEnabled && canUseImmersiveMode();

  useEffect(() => {
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
  }, [enabled]);

  return null;
}
