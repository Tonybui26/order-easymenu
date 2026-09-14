/**
 * Power-admin store gate for the later offline backup mode.
 * Does not change live behavior by itself.
 *
 * @param {object} [menuConfig]
 * @returns {boolean}
 */
export function isStoreOffline(menuConfig) {
  return menuConfig?.isOffline === true;
}
