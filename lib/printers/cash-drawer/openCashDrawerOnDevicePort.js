/**
 * Open the cash drawer on the terminal RJ12 jack.
 * Uses the iMin device service, not the printer SDK.
 * Call this only when cashDrawerUseDevicePort is on.
 */

import { registerPlugin } from "@capacitor/core";
import { isAndroid, isNativeApp } from "@/lib/helper/platformDetection";

const IminCashbox = registerPlugin("IminCashbox");

export async function openCashDrawerOnDevicePort() {
  const startTime = Date.now();

  if (!isNativeApp() || !isAndroid()) {
    return {
      success: false,
      message:
        "The terminal cash drawer is only available in the Android Order Manager app",
      duration: Date.now() - startTime,
    };
  }

  try {
    await IminCashbox.open();
    return {
      success: true,
      message: "Cash drawer opened",
      duration: Date.now() - startTime,
      transport: "imin-cashbox",
    };
  } catch (error) {
    console.error("[CashDrawer] Terminal port error:", error);
    return {
      success: false,
      message: error?.message || "Could not open the terminal cash drawer",
      duration: Date.now() - startTime,
    };
  }
}
