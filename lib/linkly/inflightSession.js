/**
 * Device-local in-flight Linkly Cloud session (power-fail recovery).
 *
 * OM generates sessionId before the long purchase/refund wait, persists it here,
 * and clears it when a definitive result arrives (or after successful recovery).
 */

import {
  getLocalPreference,
  removeLocalPreference,
  setLocalPreference,
} from "@/lib/localDb/preferences";

const INFLIGHT_KEY = "linkly.inflightSession";

/** Match easymenu createLinklySessionId — UUID v4 without hyphens. */
export function createLinklyClientSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx".replace(/[x]/g, () =>
    ((Math.random() * 16) | 0).toString(16),
  );
}

/**
 * @returns {Promise<{
 *   sessionId: string,
 *   kind: string,
 *   amountCents: number|null,
 *   startedAt: string,
 * } | null>}
 */
export async function getLinklyInflightSession() {
  const raw = await getLocalPreference(INFLIGHT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const sessionId = String(parsed?.sessionId ?? "").trim();
    if (!sessionId) return null;
    return {
      sessionId,
      kind: String(parsed?.kind ?? "").trim() || "purchase",
      amountCents:
        Number.isFinite(Number(parsed?.amountCents)) &&
        Number(parsed.amountCents) > 0
          ? Math.round(Number(parsed.amountCents))
          : null,
      startedAt: String(parsed?.startedAt ?? "") || null,
    };
  } catch {
    return null;
  }
}

/**
 * @param {{ sessionId: string, kind?: string, amountCents?: number }} opts
 */
export async function beginLinklyInflightSession({
  sessionId,
  kind = "purchase",
  amountCents,
}) {
  const sid = String(sessionId || "").trim();
  if (!sid) return;

  await setLocalPreference(
    INFLIGHT_KEY,
    JSON.stringify({
      sessionId: sid,
      kind: String(kind || "purchase").slice(0, 16),
      amountCents:
        Number.isFinite(Number(amountCents)) && Number(amountCents) > 0
          ? Math.round(Number(amountCents))
          : null,
      startedAt: new Date().toISOString(),
    }),
  );
}

export async function clearLinklyInflightSession() {
  await removeLocalPreference(INFLIGHT_KEY);
}
