/**
 * Power-admin store gate for local-database-only testing.
 * When true, Order Manager keeps Send/Pay on device and skips auto-sync.
 *
 * @param {object} [menuConfig]
 * @returns {boolean}
 */
export function isStoreLocalDatabase(menuConfig) {
  return menuConfig?.localDatabase === true;
}
