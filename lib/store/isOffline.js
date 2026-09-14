/**
 * Power-admin store gate for offline backup mode.
 * When true (and isTesting + native), catalog reads may skip the network.
 *
 * @param {object} [menuConfig]
 * @returns {boolean}
 */
export function isStoreOffline(menuConfig) {
  return menuConfig?.isOffline === true;
}
