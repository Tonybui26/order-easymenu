import { isStarPrntPrinter } from "@/lib/constants/printerLanguages";
import { formatSalesReportReceiptEscPos } from "./formatSalesReportReceiptEscPos";
import { formatSalesReportReceiptStarPrnt } from "./formatSalesReportReceiptStarPrnt";

/**
 * @param {{ storeName?: string, dateLabel: string, cashTotal: number, cardTotal: number }} payload
 * @param {Object} printer
 */
export function formatSalesReportReceiptForPrinter(payload, printer) {
  if (isStarPrntPrinter(printer)) {
    return formatSalesReportReceiptStarPrnt(payload);
  }
  return formatSalesReportReceiptEscPos(payload);
}
