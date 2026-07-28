import { registerPlugin } from "@capacitor/core";
import { formatTaxInvoiceReceiptForPrinter } from "./formatTaxInvoiceReceiptForPrinter";

const PrinterTcpSocketNew = registerPlugin("PrinterTcpSocket");

const DEFAULT_PORT = 9100;

/**
 * Send one TAX INVOICE receipt payload to a single printer.
 *
 * @param {Object} printer
 * @param {{ store: Object, order: Object, invoiceNo: string }} payload
 * @param {Object} [options]
 */
export async function sendTaxInvoiceReceiptToPrinter(
  printer,
  payload,
  options = {},
) {
  let connectionId = null;
  const startTime = Date.now();

  const printerIp = printer?.localIp;
  const printerPort = printer?.port ?? DEFAULT_PORT;

  if (!printerIp) {
    return {
      success: false,
      message: "Receipt print failed: printer IP is required",
      duration: Date.now() - startTime,
    };
  }

  try {
    const printData = formatTaxInvoiceReceiptForPrinter(payload, printer);

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

    const delayAfter = options.delayAfterDisconnect ?? 200;
    if (delayAfter > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayAfter));
    }

    return {
      success: true,
      message: `Receipt printed to ${printer.name || printerIp}`,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    console.error("[Receipt] Print error:", error);

    if (connectionId) {
      try {
        await PrinterTcpSocketNew.disconnect({ connectionId });
      } catch (cleanupError) {
        console.error("[Receipt] Cleanup error:", cleanupError);
      }
    }

    return {
      success: false,
      message: error.message || "Receipt print failed",
      duration: Date.now() - startTime,
    };
  }
}

export { DEFAULT_PORT };
