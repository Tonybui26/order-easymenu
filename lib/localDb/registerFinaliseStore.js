import {
  getLocalPreference,
  removeLocalPreference,
  setLocalPreference,
} from "@/lib/localDb/preferences";

const PREF_KEY = "pos.register.localFinalise";

/**
 * On-device snapshot of secondTest register finalise (staff counts for reports).
 * Never synced to the server.
 *
 * @typedef {object} LocalRegisterFinalise
 * @property {string} sessionId
 * @property {boolean} countsFinalised
 * @property {object[]} closingCounts
 * @property {number} closingActual
 * @property {number} closingExpected
 * @property {number} closingVariance
 * @property {number|null} cashSalesTotal
 * @property {string|null} closingVarianceReason
 * @property {string} finalisedAt
 */

/**
 * @returns {Promise<LocalRegisterFinalise|null>}
 */
export async function loadLocalRegisterFinalise() {
  const raw = await getLocalPreference(PREF_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.sessionId || !parsed?.countsFinalised) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * @param {LocalRegisterFinalise} snapshot
 */
export async function saveLocalRegisterFinalise(snapshot) {
  if (!snapshot?.sessionId) return;
  await setLocalPreference(PREF_KEY, JSON.stringify(snapshot));
}

/**
 * @param {Partial<LocalRegisterFinalise>} patch
 */
export async function patchLocalRegisterFinalise(patch) {
  const current = await loadLocalRegisterFinalise();
  if (!current) return null;
  const next = { ...current, ...patch };
  await saveLocalRegisterFinalise(next);
  return next;
}

export async function clearLocalRegisterFinalise() {
  await removeLocalPreference(PREF_KEY);
}

/**
 * Overlay local secondTest finalise onto a server session for UI locks / display.
 * @param {object|null} session
 * @param {LocalRegisterFinalise|null} [local]
 */
export function mergeLocalRegisterFinalise(session, local) {
  if (!session || !local) return session;
  if (String(local.sessionId) !== String(session.id)) return session;
  if (session.countsFinalised) return session;

  return {
    ...session,
    countsFinalised: true,
    locallyFinalised: true,
    closingCounts: local.closingCounts || [],
    closingActual: local.closingActual,
    closingExpected: local.closingExpected,
    closingVariance: local.closingVariance,
    cashSalesTotal: local.cashSalesTotal,
    closingVarianceReason: local.closingVarianceReason ?? null,
  };
}
