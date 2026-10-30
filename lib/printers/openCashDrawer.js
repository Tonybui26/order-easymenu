import { fetchPrinters } from "@/lib/api/fetchApi";
import { filterReceiptPrinters } from "@/lib/printers/printTaxInvoiceReceipt";
import { openCashDrawerOnDevicePort } from "@/lib/printers/cash-drawer/openCashDrawerOnDevicePort";
import { sendCashDrawerKickToPrinter } from "@/lib/printers/cash-drawer/sendCashDrawerKickToPrinter";

/**
 * Open the cash drawer via all printers marked forReceipt.
 * Uses ESC/POS or StarPRNT kick bytes based on each printer's commandLanguage.
 *
 * @param {Object} [options]
 * @param {Array} [options.printers] - optional pre-loaded receipt printers
 * @param {boolean} [options.useDevicePort] - open the terminal RJ12 jack
 */
export async function openCashDrawer(options = {}) {
  if (options.useDevicePort) {
    return openCashDrawerOnDevicePort();
  }

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
  let attemptedKicks = 0;

  for (const printer of printers) {
    const result = await sendCashDrawerKickToPrinter(printer, options);
    if (result.skipped) continue;
    attemptedKicks += 1;
    if (result.success) {
      successfulKicks += 1;
    } else {
      failedNames.push(printer.name || printer.localIp);
    }
  }

  if (attemptedKicks === 0) {
    return {
      success: true,
      message: "Cash drawer skipped",
      successfulKicks: 0,
      totalPrinters: 0,
    };
  }

  if (successfulKicks === attemptedKicks) {
    return {
      success: true,
      message: "Cash drawer opened",
      successfulKicks,
      totalPrinters: attemptedKicks,
    };
  }

  if (successfulKicks > 0) {
    return {
      success: true,
      message: `Cash drawer opened (${successfulKicks}/${attemptedKicks}). Failed: ${failedNames.join(", ")}`,
      successfulKicks,
      totalPrinters: attemptedKicks,
      failedPrinterNames: failedNames.join(", "),
    };
  }

  return {
    success: false,
    message: `Cash drawer kick failed${failedNames.length ? `: ${failedNames.join(", ")}` : ""}`,
    successfulKicks: 0,
    totalPrinters: attemptedKicks,
    failedPrinterNames: failedNames.join(", "),
  };
}
