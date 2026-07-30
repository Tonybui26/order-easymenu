/**
 * Isolated BILL receipt test print — same layout as TAX INVOICE without tender lines.
 */

import { createSampleBillReceipt } from "./receipt/createSampleBillReceipt";
import { sendTaxInvoiceReceiptToPrinter } from "./receipt/sendTaxInvoiceReceiptToPrinter";

/**
 * Send a sample BILL test receipt over raw TCP.
 *
 * @param {Object} printer - { localIp, port, name?, commandLanguage? }
 * @param {Object} options
 * @param {{ storeName?: string, storeABN?: string, phone?: string, storeLogo?: string }} [options.storeProfile]
 */
export async function printBillReceiptTest(printer, options = {}) {
  const startTime = Date.now();
  const storeProfile = options.storeProfile || {};
  const payload = createSampleBillReceipt(storeProfile);

  const result = await sendTaxInvoiceReceiptToPrinter(printer, payload, {
    ...options,
    logoUrl:
      options.logoUrl ||
      storeProfile.storeLogo ||
      payload?.store?.storeLogo ||
      null,
  });

  return {
    ...result,
    duration: result.duration ?? Date.now() - startTime,
    message: result.success
      ? `BILL test receipt printed in ${result.duration ?? Date.now() - startTime}ms`
      : `Bill test failed: ${result.message}`,
  };
}
