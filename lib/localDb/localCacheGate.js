/**
 * Runtime gate for Local Mode catalog cache (menu + printers).
 *
 * Why a module (not React context)?
 * `lib/api/fetchApi.js` cannot call `useMenuContext()`. MenuContext sets this
 * gate whenever menu config is known so printer helpers can check
 * `isLocalCatalogCacheEnabled()` without prop-drilling.
 *
 * Enabled only when: menu.config.isTesting === true AND native Capacitor.
 */
import { isNativeApp } from "@/lib/helper/platformDetection";

let gate = {
  enabled: false,
  ownerEmail: null,
};

/**
 * @param {{ enabled: boolean, ownerEmail?: string | null }} next
 */
export function setLocalCatalogCacheGate(next) {
  gate = {
    enabled: Boolean(next?.enabled) && isNativeApp(),
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

/** @returns {string | null} */
export function getLocalCatalogCacheOwnerEmail() {
  return gate.ownerEmail;
}
