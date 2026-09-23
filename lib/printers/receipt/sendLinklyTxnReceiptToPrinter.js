import { registerPlugin } from "@capacitor/core";
import { formatLinklyTxnReceiptForPrinter } from "./formatLinklyTxnReceiptForPrinter";
import { isUsbPrinter } from "@/lib/printers/transport/isUsbPrinter";
import { sendRawViaUsb } from "@/lib/printers/transport/sendRawViaUsb";

const PrinterTcpSocketNew = registerPlugin("PrinterTcpSocket");
const DEFAULT_PORT = 9100;

/**
 * Send one Linkly card-result slip to a single printer (4.1.3).
 */
export async function sendLinklyTxnReceiptToPrinter(
  printer,
  payload,
  options = {},
) {
  let connectionId = null;
  const startTime = Date.now();
  const printerIp = printer?.localIp;
  const printerPort = printer?.port ?? DEFAULT_PORT;

  try {
    const printData = formatLinklyTxnReceiptForPrinter(payload, printer);

    if (isUsbPrinter(printer)) {
      const usbResult = await sendRawViaUsb(printer, printData, options);
      return {
        ...usbResult,
        message: usbResult.success
          ? `Linkly result printed to ${printer.name || "USB printer"}`
          : usbResult.message,
      };
    }

    if (!printerIp) {
      return {
        success: false,
        message: "Linkly result print failed: printer IP is required",
        duration: Date.now() - startTime,
      };
    }

    const connectResult = await PrinterTcpSocketNew.connect({
      ipAddress: printerIp,
      port: Number(printerPort),
      timeoutMs: options.timeoutMs ?? 5000,
    });
    connectionId = connectResult.connectionId;

    await PrinterTcpSocketNew.send({
      connectionId,
      data: printData,
      encoding: "base64",
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    await PrinterTcpSocketNew.disconnect({ connectionId });
    connectionId = null;

    return {
      success: true,
      message: `Linkly result printed to ${printer.name || printerIp}`,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    console.error("[LinklyTxnReceipt] Print error:", error);
    if (connectionId) {
      try {
        await PrinterTcpSocketNew.disconnect({ connectionId });
      } catch (cleanupError) {
        console.error("[LinklyTxnReceipt] Cleanup error:", cleanupError);
      }
    }
    return {
      success: false,
      message: error.message || "Linkly result print failed",
      duration: Date.now() - startTime,
    };
  }
}
