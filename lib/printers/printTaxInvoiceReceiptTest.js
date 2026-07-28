/**
 * Isolated TAX INVOICE receipt test print — does not use kitchen docket formatters.
 */

import { registerPlugin } from "@capacitor/core";
import { createSampleTaxInvoiceReceipt } from "./receipt/createSampleTaxInvoiceReceipt";
import { formatTaxInvoiceReceiptForPrinter } from "./receipt/formatTaxInvoiceReceiptForPrinter";

const PrinterTcpSocketNew = registerPlugin("PrinterTcpSocket");

const DEFAULT_PORT = 9100;

/**
 * Send a TAX INVOICE test receipt over raw TCP.
 *
 * @param {Object} printer - { localIp, port, name?, commandLanguage? }
 * @param {Object} options
 * @param {{ storeName?: string, storeABN?: string, phone?: string }} [options.storeProfile]
 * @param {number} [options.timeoutMs=5000]
 * @param {number} [options.delayAfterDisconnect=200]
 */
export async function printTaxInvoiceReceiptTest(printer, options = {}) {
  let connectionId = null;
  const startTime = Date.now();

  const printerIp = printer?.localIp;
  const printerPort = printer?.port ?? DEFAULT_PORT;

  if (!printerIp) {
    return {
      success: false,
      message: "Receipt test failed: printer IP is required",
      duration: Date.now() - startTime,
    };
  }

  try {
    const payload = createSampleTaxInvoiceReceipt(options.storeProfile || {});
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

    const duration = Date.now() - startTime;
    return {
      success: true,
      message: `TAX INVOICE test receipt printed in ${duration}ms`,
      duration,
    };
  } catch (error) {
    console.error("[Receipt] Test print error:", error);

    if (connectionId) {
      try {
        await PrinterTcpSocketNew.disconnect({ connectionId });
      } catch (cleanupError) {
        console.error("[Receipt] Cleanup error:", cleanupError);
      }
    }

    return {
      success: false,
      message: `Receipt test failed: ${error.message || "Unknown error"}`,
      duration: Date.now() - startTime,
    };
  }
}
