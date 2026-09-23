import { isStarPrntPrinter } from "@/lib/constants/printerLanguages";
import { formatLinklyTxnReceiptEscPos } from "./formatLinklyTxnReceiptEscPos";
import { formatLinklyTxnReceiptStarPrnt } from "./formatLinklyTxnReceiptStarPrnt";

/**
 * @param {{ transaction: object, storeName?: string, documentTitle?: string }} payload
 * @param {Object} printer
 */
export function formatLinklyTxnReceiptForPrinter(payload, printer) {
  if (isStarPrntPrinter(printer)) {
    return formatLinklyTxnReceiptStarPrnt(payload);
  }
  return formatLinklyTxnReceiptEscPos(payload);
}
