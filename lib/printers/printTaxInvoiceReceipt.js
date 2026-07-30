import { fetchPrinters } from "@/lib/api/fetchApi";
import { isTsplPrinter } from "@/lib/constants/printerLanguages";
import { sendTaxInvoiceReceiptToPrinter } from "@/lib/printers/receipt/sendTaxInvoiceReceiptToPrinter";

function filterReceiptPrinters(printers = []) {
  return printers.filter(
    (printer) => printer?.forReceipt && !isTsplPrinter(printer),
  );
}

/**
 * Print TAX INVOICE receipt to all printers marked forReceipt.
 *
 * @param {{ store: Object, order: Object, invoiceNo: string }} payload
 * @param {Object} [options]
 * @param {Array} [options.printers] - optional pre-loaded receipt printers
 * @param {string} [options.logoUrl] - override store logo URL (defaults to payload.store.storeLogo)
 */
export async function printTaxInvoiceReceipt(payload, options = {}) {
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

  const logoUrl = options.logoUrl || payload?.store?.storeLogo || null;
  const printOptions = { ...options, logoUrl };

  const failedNames = [];
  let successfulPrints = 0;

  for (const printer of printers) {
    const result = await sendTaxInvoiceReceiptToPrinter(
      printer,
      payload,
      printOptions,
    );
    if (result.success) {
      successfulPrints += 1;
    } else {
      failedNames.push(printer.name || printer.localIp);
    }
  }

  if (successfulPrints === printers.length) {
    return {
      success: true,
      message: `Receipt printed to ${successfulPrints} printer(s)`,
      successfulPrints,
      totalPrinters: printers.length,
    };
  }

  if (successfulPrints > 0) {
    return {
      success: true,
      message: `Receipt printed to ${successfulPrints}/${printers.length} printer(s). Failed: ${failedNames.join(", ")}`,
      successfulPrints,
      totalPrinters: printers.length,
      failedPrinterNames: failedNames.join(", "),
    };
  }

  return {
    success: false,
    message: `Receipt print failed${failedNames.length ? `: ${failedNames.join(", ")}` : ""}`,
    successfulPrints: 0,
    totalPrinters: printers.length,
    failedPrinterNames: failedNames.join(", "),
  };
}

export { filterReceiptPrinters };
