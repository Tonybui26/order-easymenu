/**
 * Classify Linkly Cloud txn outcomes (mirrors easymenu/lib/linkly/txnOutcome.js).
 */

/**
 * @param {{ responseCode?: string, responseText?: string, success?: boolean }} txn
 * @returns {"approved" | "approved_signature" | "operator_timeout" | "declined"}
 */
export function classifyLinklyTxnOutcome(txn) {
  const code = String(txn?.responseCode ?? "")
    .trim()
    .toUpperCase();
  const text = String(txn?.responseText ?? "")
    .trim()
    .toUpperCase();

  if (
    code === "TO" ||
    code === "T/O" ||
    text.includes("OPERATOR TIMEOUT") ||
    text.includes("OPERATOR TIME-OUT") ||
    text.includes("OPERATOR TIME OUT") ||
    text.includes("OPERATOR TIMED OUT") ||
    text === "TO - OPERATOR TIMEOUT" ||
    text.startsWith("TO ") ||
    (text.includes("TIME OUT") && !text.includes("CONNECTION")) ||
    (text.includes("TIMEOUT") &&
      (text.includes("OPERATOR") ||
        text.includes("PINPAD") ||
        text.includes("PIN PAD")))
  ) {
    return "operator_timeout";
  }

  // 08 = Honour with identification / APPROVED WITH SIGNATURE
  if (code === "08" || text.includes("SIGNATURE")) {
    return "approved_signature";
  }

  if (
    txn?.success ||
    code === "00" ||
    code === "11" ||
    code === "Y1" ||
    code === "Y3"
  ) {
    return "approved";
  }

  return "declined";
}

/**
 * @param {"approved" | "approved_signature" | "operator_timeout" | "declined"} outcome
 * @param {{ responseCode?: string, responseText?: string }} [txn]
 */
export function linklyOutcomeMessage(outcome, txn) {
  const text = String(txn?.responseText ?? "").trim();
  const code = String(txn?.responseCode ?? "").trim();

  if (outcome === "approved") return text || "Approved";
  if (outcome === "approved_signature") {
    return text || `Approved with signature (${code || "08"})`;
  }
  if (outcome === "operator_timeout") {
    return text || "TO — Operator TimeOut (sale incomplete)";
  }
  return text || (code ? `Declined (${code})` : "Declined");
}

/**
 * @param {"approved" | "approved_signature" | "operator_timeout" | "declined"} outcome
 */
export function isLinklyOutcomePayable(outcome) {
  return outcome === "approved" || outcome === "approved_signature";
}
