import { fetchPrinters } from "@/lib/api/fetchApi";
import { filterReceiptPrinters } from "@/lib/printers/printTaxInvoiceReceipt";
import { sendLinklyTxnReceiptToPrinter } from "@/lib/printers/receipt/sendLinklyTxnReceiptToPrinter";
import {
  classifyLinklyTxnOutcome,
} from "@/lib/linkly/txnOutcome";

/**
 * Print Linkly txn result to receipt printers.
 * Accreditation 4.1.3 — slip must include TxnRef of the interrupted sale.
 *
 * @param {object} transaction
 * @param {object} [storeProfile]
 * @param {object} [options]
 */
export async function printLinklyTxnReceipt(
  transaction,
  storeProfile = {},
  options = {},
) {
  if (!transaction) {
    return { success: false, message: "No Linkly transaction to print" };
  }

  const txn = {
    ...transaction,
    outcome:
      transaction.outcome || classifyLinklyTxnOutcome(transaction),
  };

  const payload = {
    transaction: txn,
    storeName:
      storeProfile.storeName ||
      storeProfile.name ||
      "",
    documentTitle: options.documentTitle,
  };

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
    const result = await sendLinklyTxnReceiptToPrinter(
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
      message: `Card result printed to ${successfulPrints} printer(s)`,
      successfulPrints,
      totalPrinters: printers.length,
      txnRef: txn.txnRef || null,
    };
  }

  if (successfulPrints > 0) {
    return {
      success: true,
      message: `Card result printed to ${successfulPrints}/${printers.length} printer(s). Failed: ${failedNames.join(", ")}`,
      successfulPrints,
      totalPrinters: printers.length,
      failedPrinterNames: failedNames.join(", "),
      txnRef: txn.txnRef || null,
    };
  }

  return {
    success: false,
    message: `Card result print failed${failedNames.length ? `: ${failedNames.join(", ")}` : ""}`,
    successfulPrints: 0,
    totalPrinters: printers.length,
    failedPrinterNames: failedNames.join(", "),
  };
}
