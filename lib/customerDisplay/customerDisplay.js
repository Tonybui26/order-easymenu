/**
 * Thin wrappers around the CustomerDisplay Capacitor plugin (Android dual-screen POS).
 * Default-on: open idle Welcome when a secondary display exists; no-op otherwise.
 */

import { CustomerDisplay } from "customer-display";
import { isAndroid, isNativeApp } from "@/lib/helper/platformDetection";

export function canUseCustomerDisplay() {
  return isNativeApp() && isAndroid();
}

export async function isCustomerDisplayAvailable() {
  if (!canUseCustomerDisplay()) return false;
  const result = await CustomerDisplay.isAvailable();
  return Boolean(result?.available);
}

export async function openCustomerDisplay() {
  if (!canUseCustomerDisplay()) return;
  const available = await isCustomerDisplayAvailable();
  if (!available) return;
  await CustomerDisplay.open();
}

export async function closeCustomerDisplay() {
  if (!canUseCustomerDisplay()) return;
  await CustomerDisplay.close();
}
