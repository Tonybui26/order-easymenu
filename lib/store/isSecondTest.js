/**
 * Power-admin store gate for a second testing lane.
 * When true, Order Manager keeps Send/Pay on device and skips auto-sync
 * (same as localDatabase) without requiring Testing store.
 *
 * @param {object} [menuConfig]
 * @returns {boolean}
 */
export function isStoreSecondTest(menuConfig) {
  return menuConfig?.secondTest === true;
}
