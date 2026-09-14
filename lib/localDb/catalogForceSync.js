/**
 * One-shot flag: next app bootstrap must take network catalog (menu + printers)
 * and overwrite SQLite — not hydrate from cache.
 *
 * Set before:
 *   - Primary account sign-in (NextAuth)
 *   - Manual Sync / Reload app
 *
 * Consumed (read + clear) once in MenuContext bootstrap.
 * PIN unlock must NOT set this — catalog stays local during a shift.
 */
import {
  getLocalPreference,
  setLocalPreference,
  removeLocalPreference,
} from "@/lib/localDb/preferences";

export const CATALOG_FORCE_SYNC_PREF_KEY = "localCatalog.forceSync";

/** Mark the next cold bootstrap as a forced catalog sync from the server. */
export async function requestCatalogForceSync() {
  await setLocalPreference(CATALOG_FORCE_SYNC_PREF_KEY, "1");
}

/**
 * Read and clear the force-sync flag.
 * @returns {Promise<boolean>}
 */
export async function consumeCatalogForceSync() {
  const value = await getLocalPreference(CATALOG_FORCE_SYNC_PREF_KEY);
  if (value) await removeLocalPreference(CATALOG_FORCE_SYNC_PREF_KEY);
  return value === "1" || value === "true";
}

/**
 * Manual Sync UX: force next bootstrap to network, then full reload.
 * SSR will fetch a fresh menu; MenuContext persists menu + printers to SQLite.
 */
export async function reloadAppWithCatalogSync() {
  try {
    await requestCatalogForceSync();
  } catch (error) {
    console.error("reloadAppWithCatalogSync flag:", error);
  }
  window.location.reload();
}
