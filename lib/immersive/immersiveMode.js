/**
 * Thin wrappers around the ImmersiveMode Capacitor plugin (Android POS kiosk).
 */

import { ImmersiveMode } from "immersive-mode";
import { isAndroid, isNativeApp } from "@/lib/helper/platformDetection";

export function canUseImmersiveMode() {
  return isNativeApp() && isAndroid();
}

export async function activateImmersiveMode() {
  if (!canUseImmersiveMode()) return;
  await ImmersiveMode.activate();
}

export async function deactivateImmersiveMode() {
  if (!canUseImmersiveMode()) return;
  await ImmersiveMode.deactivate();
}
