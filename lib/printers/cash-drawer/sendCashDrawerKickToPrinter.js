import { registerPlugin } from "@capacitor/core";
import { formatCashDrawerKickForPrinter } from "./formatCashDrawerKickForPrinter";
import { isUsbPrinter } from "@/lib/printers/transport/isUsbPrinter";
import { sendRawViaUsb } from "@/lib/printers/transport/sendRawViaUsb";

const PrinterTcpSocket = registerPlugin("PrinterTcpSocket");

const DEFAULT_PORT = 9100;

/**
 * Send a cash drawer kick to one receipt printer over raw TCP.
 *
 * @param {Object} printer
 * @param {Object} [options]
 */
export async function sendCashDrawerKickToPrinter(printer, options = {}) {
  let connectionId = null;
  const startTime = Date.now();

  const printerIp = printer?.localIp;
  const printerPort = printer?.port ?? DEFAULT_PORT;

  try {
    const kickData = formatCashDrawerKickForPrinter(printer);

    // USB early branch — existing TCP block below stays unchanged for network printers
    if (isUsbPrinter(printer)) {
      const usbResult = await sendRawViaUsb(printer, kickData, options);
      return {
        ...usbResult,
        message: usbResult.success
          ? `Cash drawer opened via ${printer.name || "USB printer"}`
          : usbResult.message,
      };
    }

    if (!printerIp) {
      return {
        success: false,
        message: "Cash drawer kick failed: printer IP is required",
        duration: Date.now() - startTime,
      };
    }

    const connectResult = await PrinterTcpSocket.connect({
      ipAddress: printerIp,
      port: Number(printerPort),
      timeoutMs: options.timeoutMs ?? 5000,
    });

    connectionId = connectResult.connectionId;

    await PrinterTcpSocket.send({
      connectionId,
      data: kickData,
      encoding: "base64",
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    await PrinterTcpSocket.disconnect({ connectionId });
    connectionId = null;

    const delayAfter = options.delayAfterDisconnect ?? 200;
    if (delayAfter > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayAfter));
    }

    return {
      success: true,
      message: `Cash drawer opened via ${printer.name || printerIp}`,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    console.error("[CashDrawer] Kick error:", error);

    if (connectionId) {
      try {
        await PrinterTcpSocket.disconnect({ connectionId });
      } catch (cleanupError) {
        console.error("[CashDrawer] Cleanup error:", cleanupError);
      }
    }

    return {
      success: false,
      message: error.message || "Cash drawer kick failed",
      duration: Date.now() - startTime,
    };
  }
}

export { DEFAULT_PORT };
