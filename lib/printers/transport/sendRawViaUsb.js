/**
 * USB-only raw print path (Android Order Manager + PrinterUsb plugin).
 *
 * Existing PrinterTcpSocket code paths stay untouched — call this only when
 * isUsbPrinter(printer) is true.
 *
 * Device selection: native plugin auto-picks the plugged-in USB printer
 * (prefers USB printer class). First use may show Android's USB permission dialog.
 */

import { registerPlugin } from "@capacitor/core";
import { isAndroid, isNativeApp } from "@/lib/helper/platformDetection";
import { isEscPosPrinter } from "@/lib/constants/printerLanguages";
import { getPrinterEndpointLabel } from "./isPrinterReady";

const PrinterUsb = registerPlugin("PrinterUsb");

/**
 * @param {Object} printer
 * @param {string|null} base64Data - ESC/POS payload; null/empty skips send (connection test)
 * @param {Object} [options]
 * @param {number} [options.timeoutMs] - unused for USB permission (waits until Allow/Deny)
 * @param {number} [options.delayAfterDisconnect=200]
 * @param {boolean} [options.onlyConnectionTest=false]
 */
export async function sendRawViaUsb(printer, base64Data, options = {}) {
  const startTime = Date.now();
  const endpoint = getPrinterEndpointLabel(printer);
  let connectionId = null;

  if (!isNativeApp() || !isAndroid()) {
    return {
      success: false,
      message: "USB printing requires Android Order Manager",
      duration: Date.now() - startTime,
    };
  }

  if (!isEscPosPrinter(printer)) {
    return {
      success: false,
      message: "USB printing supports ESC/POS printers only",
      duration: Date.now() - startTime,
    };
  }

  try {
    // Auto-pick attached printer; permission dialog waits until Allow or Deny (no short timeout)
    const connectResult = await PrinterUsb.connect({});

    connectionId = connectResult.connectionId;

    if (!options.onlyConnectionTest && base64Data) {
      await PrinterUsb.send({
        connectionId,
        data: base64Data,
        encoding: "base64",
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 100));

    await PrinterUsb.disconnect({ connectionId });
    connectionId = null;

    const delayAfter = options.delayAfterDisconnect ?? 200;
    if (delayAfter > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayAfter));
    }

    const deviceHint =
      connectResult.productName ||
      (connectResult.vendorId != null && connectResult.productId != null
        ? `VID ${connectResult.vendorId} / PID ${connectResult.productId}`
        : endpoint);

    return {
      success: true,
      message: options.onlyConnectionTest
        ? `USB connection OK: ${deviceHint}`
        : `Printed via USB to ${printer.name || deviceHint}`,
      duration: Date.now() - startTime,
      transport: "usb",
    };
  } catch (error) {
    console.error("[USB] Print error:", error);

    if (connectionId) {
      try {
        await PrinterUsb.disconnect({ connectionId });
      } catch (cleanupError) {
        console.error("[USB] Cleanup error:", cleanupError);
      }
    }

    return {
      success: false,
      message: error?.message || "USB print failed",
      duration: Date.now() - startTime,
      transport: "usb",
    };
  }
}
