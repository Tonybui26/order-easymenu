/**
 * Isolated TAX INVOICE receipt test print — does not use kitchen docket formatters.
 */

import { createSampleTaxInvoiceReceipt } from "./receipt/createSampleTaxInvoiceReceipt";
import { sendTaxInvoiceReceiptToPrinter } from "./receipt/sendTaxInvoiceReceiptToPrinter";

/**
 * Send a sample TAX INVOICE test receipt over raw TCP.
 *
 * @param {Object} printer - { localIp, port, name?, commandLanguage? }
 * @param {Object} options
 * @param {{ storeName?: string, storeABN?: string, phone?: string, storeLogo?: string }} [options.storeProfile]
 * @param {number} [options.timeoutMs=5000]
 * @param {number} [options.delayAfterDisconnect=200]
 * @param {(status: Object) => void} [options.onLogoStatus]
 */
export async function printTaxInvoiceReceiptTest(printer, options = {}) {
  const startTime = Date.now();
  const storeProfile = options.storeProfile || {};
  const payload = createSampleTaxInvoiceReceipt(storeProfile);

  const result = await sendTaxInvoiceReceiptToPrinter(printer, payload, {
    ...options,
    logoUrl: options.logoUrl || storeProfile.storeLogo || payload?.store?.storeLogo || null,
  });

  return {
    ...result,
    duration: result.duration ?? Date.now() - startTime,
    message: result.success
      ? `TAX INVOICE test receipt printed in ${result.duration ?? Date.now() - startTime}ms`
      : `Receipt test failed: ${result.message}`,
  };
}
