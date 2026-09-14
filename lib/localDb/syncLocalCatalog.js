/**
 * Shared catalog sync for Local Mode pilots (menu + printers → SQLite).
 *
 * Sync moments (network → overwrite snapshots):
 *   1) Primary account sign-in / sign-up (force-sync flag)
 *   2) Manual Sync / Reload (force-sync flag + full reload)
 *   3) Explicit soft sync (refreshMenuData / syncCatalogFromServer)
 *   4) Empty SQLite on first install (bootstrap falls through to network)
 *
 * NOT a sync moment: PIN unlock — catalog stays local during a shift.
 *
 * Soft-fails: never blocks POS if SQLite/printers fetch fails.
 */
import { isLocalCatalogCacheEnabled } from "@/lib/localDb/localCacheGate";
import { saveMenuSnapshot } from "@/lib/localDb/menuSnapshot";

/**
 * After a successful network menu document is in hand: persist menu snapshot and
 * force-refresh printers from the server into memory + SQLite.
 *
 * @param {object} menuDocument
 * @param {{ refreshPrintersCache: () => Promise<object> }} deps
 *   Injected to avoid a circular import with fetchApi ↔ this module at load time
 *   if fetchApi ever imported sync helpers. MenuContext passes refreshPrintersCache.
 * @returns {Promise<{ menuSaved: boolean, printersOk: boolean }>}
 */
export async function persistCatalogAfterNetworkMenu(menuDocument, deps) {
  if (!isLocalCatalogCacheEnabled()) {
    return { menuSaved: false, printersOk: false };
  }

  const menuSaved = await saveMenuSnapshot(menuDocument);

  let printersOk = false;
  try {
    if (typeof deps?.refreshPrintersCache === "function") {
      await deps.refreshPrintersCache();
      printersOk = true;
    }
  } catch (error) {
    console.error("persistCatalogAfterNetworkMenu printers:", error);
  }

  return { menuSaved, printersOk };
}
