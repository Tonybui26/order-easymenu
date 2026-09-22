/**
 * Persist last Linkly recovery / card outcome for accreditation 3.1.2
 * (mark failed within the POS) and Settings display.
 */

import {
  getLocalPreference,
  removeLocalPreference,
  setLocalPreference,
} from "@/lib/localDb/preferences";

const LAST_OUTCOME_KEY = "linkly.lastTxnOutcome";

/**
 * @returns {Promise<{
 *   sessionId: string|null,
 *   txnRef: string|null,
 *   outcome: string,
 *   success: boolean,
 *   responseCode: string|null,
 *   responseText: string|null,
 *   amountCents: number|null,
 *   markedFailed: boolean,
 *   source: string,
 *   recordedAt: string,
 * } | null>}
 */
export async function getLinklyLastTxnOutcome() {
  const raw = await getLocalPreference(LAST_OUTCOME_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.outcome) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * @param {object} outcome
 */
export async function setLinklyLastTxnOutcome(outcome) {
  if (!outcome?.outcome) return;
  await setLocalPreference(
    LAST_OUTCOME_KEY,
    JSON.stringify({
      sessionId: outcome.sessionId || null,
      txnRef: outcome.txnRef || null,
      outcome: String(outcome.outcome),
      success: Boolean(outcome.success),
      responseCode: outcome.responseCode || null,
      responseText: outcome.responseText || null,
      amountCents:
        Number.isFinite(Number(outcome.amountCents)) &&
        Number(outcome.amountCents) > 0
          ? Math.round(Number(outcome.amountCents))
          : null,
      markedFailed: Boolean(outcome.markedFailed),
      source: String(outcome.source || "pos").slice(0, 32),
      recordedAt: new Date().toISOString(),
    }),
  );
}

export async function clearLinklyLastTxnOutcome() {
  await removeLocalPreference(LAST_OUTCOME_KEY);
}
