import { fetchPrinters } from "@/lib/api/fetchApi";
import {
  filterReceiptPrinters,
  printTaxInvoiceReceipt,
} from "@/lib/printers/printTaxInvoiceReceipt";
import {
  classifyLinklyTxnOutcome,
  linklyOutcomeMessage,
} from "@/lib/linkly/txnOutcome";

/**
 * Build a minimal TAX INVOICE-shaped payload for a Linkly card result slip
 * (accreditation 4.1.3 power-fail recovery printing).
 *
 * @param {{ transaction: object, storeProfile?: object, documentTitle?: string }} input
 */
export function buildLinklyTxnReceiptPayload({
  transaction,
  storeProfile = {},
  documentTitle,
} = {}) {
  const txn = transaction || {};
  const outcome =
    txn.outcome || classifyLinklyTxnOutcome(txn);
  const cents =
    Number(txn.amtPurchase) > 0
      ? Number(txn.amtPurchase)
      : Number(txn.requestedAmountCents) || 0;
  const dollars = cents / 100;
  const resultLabel = linklyOutcomeMessage(outcome, txn);
  const title =
    documentTitle ||
    (outcome === "approved" || outcome === "approved_signature"
      ? "CARD RECEIPT"
      : "CARD RESULT");

  return {
    store: {
      storeName: storeProfile.storeName || storeProfile.name || "Store",
      phone: storeProfile.phone || "",
      storeABN: storeProfile.storeABN || storeProfile.abn || "",
      storeLogo: storeProfile.storeLogo || storeProfile.storeProfileImage || "",
    },
    invoiceNo: String(txn.txnRef || txn.sessionId || "LINKLY").slice(0, 24),
    documentTitle: title,
    order: {
      orderType: "pos",
      createdAt: txn.date || new Date().toISOString(),
      items: [
        {
          name: `Card · ${resultLabel}`,
          quantity: 1,
          price: dollars,
          unitPrice: dollars,
          notes: [
            txn.responseCode ? `Code ${txn.responseCode}` : null,
            txn.rrn ? `RRN ${txn.rrn}` : null,
            txn.cardName || txn.cardType
              ? `${txn.cardName || txn.cardType}`
              : null,
            txn.sessionId ? `Sid ${String(txn.sessionId).slice(0, 12)}…` : null,
          ]
            .filter(Boolean)
            .join(" · "),
        },
      ],
      subtotal: dollars,
      total: dollars,
      paymentMethod: "credit-card",
      amountTendered: dollars,
      change: 0,
    },
  };
}

/**
 * Print Linkly txn result to receipt printers (power-fail recovery / signature).
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

  const payload = buildLinklyTxnReceiptPayload({
    transaction,
    storeProfile,
    documentTitle: options.documentTitle,
  });

  let printers = options.printers;
  if (!printers) {
    const data = await fetchPrinters();
    printers = filterReceiptPrinters(data?.printers || []);
  }

  return printTaxInvoiceReceipt(payload, { ...options, printers });
}
