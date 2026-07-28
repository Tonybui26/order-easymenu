import { fetchPrinters } from "@/lib/api/fetchApi";
import { filterReceiptPrinters } from "@/lib/printers/printTaxInvoiceReceipt";
import { sendCashDrawerKickToPrinter } from "@/lib/printers/cash-drawer/sendCashDrawerKickToPrinter";

/**
 * Open the cash drawer via all printers marked forReceipt.
 * Uses ESC/POS or StarPRNT kick bytes based on each printer's commandLanguage.
 *
 * @param {Object} [options]
 * @param {Array} [options.printers] - optional pre-loaded receipt printers
 */
export async function openCashDrawer(options = {}) {
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
      successfulKicks: 0,
      totalPrinters: 0,
    };
  }

  const failedNames = [];
  let successfulKicks = 0;

  for (const printer of printers) {
    const result = await sendCashDrawerKickToPrinter(printer, options);
    if (result.success) {
      successfulKicks += 1;
    } else {
      failedNames.push(printer.name || printer.localIp);
    }
  }

  if (successfulKicks === printers.length) {
    return {
      success: true,
      message: "Cash drawer opened",
      successfulKicks,
      totalPrinters: printers.length,
    };
  }

  if (successfulKicks > 0) {
    return {
      success: true,
      message: `Cash drawer opened (${successfulKicks}/${printers.length}). Failed: ${failedNames.join(", ")}`,
      successfulKicks,
      totalPrinters: printers.length,
      failedPrinterNames: failedNames.join(", "),
    };
  }

  return {
    success: false,
    message: `Cash drawer kick failed${failedNames.length ? `: ${failedNames.join(", ")}` : ""}`,
    successfulKicks: 0,
    totalPrinters: printers.length,
    failedPrinterNames: failedNames.join(", "),
  };
}
