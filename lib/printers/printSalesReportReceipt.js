import { fetchPrinters } from "@/lib/api/fetchApi";
import { filterReceiptPrinters } from "@/lib/printers/printTaxInvoiceReceipt";
import { sendSalesReportReceiptToPrinter } from "@/lib/printers/receipt/sendSalesReportReceiptToPrinter";

/**
 * Print a simple sales report (date + cash + card) to receipt printers.
 *
 * @param {{ storeName?: string, dateLabel: string, cashTotal: number, cardTotal: number }} payload
 * @param {Object} [options]
 */
export async function printSalesReportReceipt(payload, options = {}) {
  let printers = options.printers;
  if (!printers) {
    const data = await fetchPrinters();
    printers = filterReceiptPrinters(data?.printers || []);
  }

  if (printers.length === 0) {
    return {
      success: false,
      message:
        "No receipt printer configured. Mark a printer as Receipt in Printer Management.",
      successfulPrints: 0,
      totalPrinters: 0,
    };
  }

  const failedNames = [];
  let successfulPrints = 0;

  for (const printer of printers) {
    const result = await sendSalesReportReceiptToPrinter(
      printer,
      payload,
      options,
    );
    if (result.success) successfulPrints += 1;
    else failedNames.push(printer.name || printer.localIp);
  }

  if (successfulPrints === printers.length) {
    return {
      success: true,
      message: `Sales report printed to ${successfulPrints} printer(s)`,
      successfulPrints,
      totalPrinters: printers.length,
    };
  }

  if (successfulPrints > 0) {
    return {
      success: true,
      message: `Sales report printed to ${successfulPrints}/${printers.length} printer(s). Failed: ${failedNames.join(", ")}`,
      successfulPrints,
      totalPrinters: printers.length,
      failedPrinterNames: failedNames.join(", "),
    };
  }

  return {
    success: false,
    message: `Sales report print failed${failedNames.length ? `: ${failedNames.join(", ")}` : ""}`,
    successfulPrints: 0,
    totalPrinters: printers.length,
    failedPrinterNames: failedNames.join(", "),
  };
}
