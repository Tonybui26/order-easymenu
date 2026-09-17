import { registerPlugin } from "@capacitor/core";
import { formatSalesReportReceiptForPrinter } from "./formatSalesReportReceiptForPrinter";
import { isUsbPrinter } from "@/lib/printers/transport/isUsbPrinter";
import { sendRawViaUsb } from "@/lib/printers/transport/sendRawViaUsb";

const PrinterTcpSocketNew = registerPlugin("PrinterTcpSocket");
const DEFAULT_PORT = 9100;

/**
 * Send one sales report receipt to a single printer.
 * @param {Object} printer
 * @param {{ storeName?: string, dateLabel: string, cashTotal: number, cardTotal: number }} payload
 * @param {Object} [options]
 */
export async function sendSalesReportReceiptToPrinter(
  printer,
  payload,
  options = {},
) {
  let connectionId = null;
  const startTime = Date.now();
  const printerIp = printer?.localIp;
  const printerPort = printer?.port ?? DEFAULT_PORT;

  try {
    const printData = formatSalesReportReceiptForPrinter(payload, printer);

    if (isUsbPrinter(printer)) {
      const usbResult = await sendRawViaUsb(printer, printData, options);
      return {
        ...usbResult,
        message: usbResult.success
          ? `Sales report printed to ${printer.name || "USB printer"}`
          : usbResult.message,
      };
    }

    if (!printerIp) {
      return {
        success: false,
        message: "Sales report print failed: printer IP is required",
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
      message: `Sales report printed to ${printer.name || printerIp}`,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    console.error("[SalesReport] Print error:", error);
    if (connectionId) {
      try {
        await PrinterTcpSocketNew.disconnect({ connectionId });
      } catch (cleanupError) {
        console.error("[SalesReport] Cleanup error:", cleanupError);
      }
    }
    return {
      success: false,
      message: error.message || "Sales report print failed",
      duration: Date.now() - startTime,
    };
  }
}
