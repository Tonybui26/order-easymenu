/**
 * iMin-only raw print path (Android Order Manager + PrinterImin plugin).
 *
 * Existing PrinterTcpSocket and PrinterUsb paths stay untouched — call this
 * only when isIminPrinter(printer) is true.
 *
 * Swan 2's cutter expects GS V 0 / GS V 1. Shared formatters still end with
 * the Epson feed-and-cut (1D 56 41 03). That suffix is rewritten here only.
 */

import { registerPlugin } from "@capacitor/core";
import { isAndroid, isNativeApp } from "@/lib/helper/platformDetection";
import { isEscPosPrinter } from "@/lib/constants/printerLanguages";
import { getPrinterEndpointLabel } from "./isPrinterReady";

const PrinterImin = registerPlugin("PrinterImin");

/** Epson GS V 65 3 — feed then partial cut. */
const EPSON_CUT_SUFFIX = [0x1d, 0x56, 0x41, 0x03];
/** iMin Swan 2 partial cut. */
const IMIN_PARTIAL_CUT = [0x1d, 0x56, 0x01];

function adaptEscPosCutForImin(base64Data) {
  if (!base64Data || typeof base64Data !== "string") return base64Data;

  let binary;
  try {
    binary = atob(base64Data.replace(/\s/g, ""));
  } catch {
    return base64Data;
  }

  const suffixLength = EPSON_CUT_SUFFIX.length;
  if (binary.length < suffixLength) return base64Data;

  const start = binary.length - suffixLength;
  for (let i = 0; i < suffixLength; i += 1) {
    if (binary.charCodeAt(start + i) !== EPSON_CUT_SUFFIX[i]) {
      return base64Data;
    }
  }

  let next = binary.slice(0, start);
  for (let i = 0; i < IMIN_PARTIAL_CUT.length; i += 1) {
    next += String.fromCharCode(IMIN_PARTIAL_CUT[i]);
  }
  return btoa(next);
}

/**
 * @param {Object} printer
 * @param {string|null} base64Data - ESC/POS payload; null/empty skips send (connection test)
 * @param {Object} [options]
 * @param {number} [options.delayAfterDisconnect=200]
 * @param {boolean} [options.onlyConnectionTest=false]
 */
export async function sendRawViaImin(printer, base64Data, options = {}) {
  const startTime = Date.now();
  const endpoint = getPrinterEndpointLabel(printer);
  let connectionId = null;

  if (!isNativeApp() || !isAndroid()) {
    return {
      success: false,
      message: "Built-in iMin printing requires Android Order Manager",
      duration: Date.now() - startTime,
    };
  }

  if (!isEscPosPrinter(printer)) {
    return {
      success: false,
      message: "Built-in iMin printing supports ESC/POS printers only",
      duration: Date.now() - startTime,
    };
  }

  try {
    const connectResult = await PrinterImin.connect();
    connectionId = connectResult.connectionId;

    if (!options.onlyConnectionTest && base64Data) {
      await PrinterImin.send({
        connectionId,
        data: adaptEscPosCutForImin(base64Data),
        encoding: "base64",
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 100));

    await PrinterImin.disconnect({ connectionId });
    connectionId = null;

    const delayAfter = options.delayAfterDisconnect ?? 200;
    if (delayAfter > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayAfter));
    }

    const deviceHint = connectResult.productName || endpoint;

    return {
      success: true,
      message: options.onlyConnectionTest
        ? `Built-in printer connection OK: ${deviceHint}`
        : `Printed via built-in printer to ${printer.name || deviceHint}`,
      duration: Date.now() - startTime,
      transport: "imin",
    };
  } catch (error) {
    console.error("[iMin] Print error:", error);

    if (connectionId) {
      try {
        await PrinterImin.disconnect({ connectionId });
      } catch (cleanupError) {
        console.error("[iMin] Cleanup error:", cleanupError);
      }
    }

    return {
      success: false,
      message: error?.message || "Built-in iMin print failed",
      duration: Date.now() - startTime,
      transport: "imin",
    };
  }
}
