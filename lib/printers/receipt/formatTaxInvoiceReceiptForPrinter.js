import { isStarPrntPrinter } from "@/lib/constants/printerLanguages";
import { formatTaxInvoiceReceiptEscPos } from "./formatTaxInvoiceReceiptEscPos";
import { formatTaxInvoiceReceiptStarPrnt } from "./formatTaxInvoiceReceiptStarPrnt";

/**
 * Pick TAX INVOICE receipt formatter for a printer profile.
 * @param {{ store: Object, order: Object, invoiceNo: string }} payload
 * @param {Object} printer
 */
export function formatTaxInvoiceReceiptForPrinter(payload, printer) {
  if (isStarPrntPrinter(printer)) {
    return formatTaxInvoiceReceiptStarPrnt(payload);
  }
  return formatTaxInvoiceReceiptEscPos(payload);
}
