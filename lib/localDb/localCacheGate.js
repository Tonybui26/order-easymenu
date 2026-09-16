/**
 * Runtime gate for Local Mode catalog cache (menu + printers).
 *
 * Why a module (not React context)?
 * `lib/api/fetchApi.js` cannot call `useMenuContext()`. MenuContext sets this
 * gate whenever menu config is known so printer helpers can check
 * `isLocalCatalogCacheEnabled()` without prop-drilling.
 *
 * Enabled when: (enableAutoOfflineBackup OR isTesting OR secondTest) AND native Capacitor.
 * That writes live-first snapshots / unlocks SQLite for local Send. Offline outbox
 * still needs Offline / Local database / Second test as appropriate.
 */
import { isNativeApp } from "@/lib/helper/platformDetection";

let gate = {
  enabled: false,
  cacheFirst: false,
  ownerEmail: null,
};

/**
 * @param {{ enabled: boolean, cacheFirst?: boolean, ownerEmail?: string | null }} next
 * `enabled` — Auto Offline backup, testing, or second test + native: write snapshots, held/resume paint-then-refresh.
 * `cacheFirst` — also isOffline: menu and printers may be served from SQLite
 * without a network fetch. Normal mode leaves this false.
 */
export function setLocalCatalogCacheGate(next) {
  const enabled = Boolean(next?.enabled) && isNativeApp();
  gate = {
    enabled,
    cacheFirst: enabled && Boolean(next?.cacheFirst),
    ownerEmail:
      typeof next?.ownerEmail === "string" && next.ownerEmail.trim()
        ? next.ownerEmail.trim()
        : null,
  };
}

/** @returns {boolean} */
export function isLocalCatalogCacheEnabled() {
  return gate.enabled === true && isNativeApp();
}

/** Menu and printers skip the network only in offline backup mode. */
export function isLocalCatalogCacheFirst() {
  return isLocalCatalogCacheEnabled() && gate.cacheFirst === true;
}

/** @returns {string | null} */
export function getLocalCatalogCacheOwnerEmail() {
  return gate.ownerEmail;
}
