/**
 * Print a font & style reference sheet for receipt/docket printers.
 */

import { registerPlugin } from "@capacitor/core";
import { isTsplPrinter } from "@/lib/constants/printerLanguages";
import { formatFontTestForPrinter } from "./fontTest/formatFontTestForPrinter";

const PrinterTcpSocket = registerPlugin("PrinterTcpSocket");

const DEFAULT_PORT = 9100;

export async function printPrinterFontTest(printer, options = {}) {
  const startTime = Date.now();
  const printerIp = printer?.localIp;
  const printerPort = printer?.port ?? DEFAULT_PORT;

  if (isTsplPrinter(printer)) {
    return {
      success: false,
      message: "Font test is for receipt/docket printers only (not TSPL labels).",
      duration: Date.now() - startTime,
    };
  }

  if (!printerIp) {
    return {
      success: false,
      message: "Font test failed: printer IP is required",
      duration: Date.now() - startTime,
    };
  }

  let connectionId = null;

  try {
    const printData = formatFontTestForPrinter(printer);

    const connectResult = await PrinterTcpSocket.connect({
      ipAddress: printerIp,
      port: Number(printerPort),
      timeoutMs: options.timeoutMs ?? 5000,
    });

    connectionId = connectResult.connectionId;

    await PrinterTcpSocket.send({
      connectionId,
      data: printData,
      encoding: "base64",
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    await PrinterTcpSocket.disconnect({ connectionId });
    connectionId = null;

    const delayAfter = options.delayAfterDisconnect ?? 200;
    if (delayAfter > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayAfter));
    }

    const duration = Date.now() - startTime;
    return {
      success: true,
      message: `Font test sheet printed in ${duration}ms`,
      duration,
    };
  } catch (error) {
    console.error("[FontTest] Print error:", error);

    if (connectionId) {
      try {
        await PrinterTcpSocket.disconnect({ connectionId });
      } catch (cleanupError) {
        console.error("[FontTest] Cleanup error:", cleanupError);
      }
    }

    return {
      success: false,
      message: error.message || "Font test print failed",
      duration: Date.now() - startTime,
    };
  }
}
