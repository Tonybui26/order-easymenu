/**
 * Dedicated EFTPOS result slip lines for Linkly power-fail recovery (4.1.3).
 * TxnRef is printed prominently so accreditation can match test 4.1.1.
 */

import {
  classifyLinklyTxnOutcome,
  linklyOutcomeMessage,
} from "@/lib/linkly/txnOutcome";

/**
 * @param {{
 *   transaction: object,
 *   storeName?: string,
 *   documentTitle?: string,
 * }} input
 * @returns {Array<{ text: string, align?: string, bold?: boolean }>}
 */
export function buildLinklyTxnReceiptLines(input) {
  const txn = input?.transaction || {};
  const outcome = txn.outcome || classifyLinklyTxnOutcome(txn);
  const resultLabel = linklyOutcomeMessage(outcome, txn);
  const cents =
    Number(txn.amtPurchase) > 0
      ? Number(txn.amtPurchase)
      : Number(txn.requestedAmountCents) || 0;
  const money = `$${(cents / 100).toFixed(2)}`;
  const txnRef = String(txn.txnRef || "").trim() || "—";
  const title =
    String(input?.documentTitle || "").trim() ||
    (outcome === "approved" || outcome === "approved_signature"
      ? "CARD RECEIPT"
      : "CARD RESULT");
  const storeName = String(input?.storeName || "").trim();
  const failed =
    outcome === "declined" || outcome === "operator_timeout";

  const lines = [];
  if (storeName) {
    lines.push({ text: storeName, align: "center", bold: true });
  }
  lines.push({ text: title, align: "center", bold: true });
  lines.push({
    text: failed ? "*** FAILED / NOT PAID ***" : "*** RESULT ***",
    align: "center",
    bold: true,
  });
  lines.push({ text: "--------------------------------", align: "center" });
  lines.push({ text: `Result: ${resultLabel}`, align: "left", bold: true });
  lines.push({ text: `TxnRef: ${txnRef}`, align: "left", bold: true });
  if (txn.responseCode) {
    lines.push({
      text: `Code: ${String(txn.responseCode).trim()}`,
      align: "left",
    });
  }
  lines.push({ text: `Amount: ${money}`, align: "left" });
  if (txn.rrn) {
    lines.push({ text: `RRN: ${String(txn.rrn).trim()}`, align: "left" });
  }
  if (txn.cardName || txn.cardType) {
    lines.push({
      text: `Card: ${String(txn.cardName || txn.cardType).trim()}`,
      align: "left",
    });
  }
  if (txn.sessionId) {
    lines.push({
      text: `Session: ${String(txn.sessionId).trim()}`,
      align: "left",
    });
  }
  lines.push({ text: "--------------------------------", align: "center" });
  lines.push({
    text: new Date(txn.date || Date.now()).toLocaleString(),
    align: "center",
  });
  lines.push({ text: "", align: "left" });
  return lines;
}
