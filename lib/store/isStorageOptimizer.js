/**
 * Power-admin store gate for Storage optimiser.
 * When true, free on-device SQLite after a successful register
 * Close → Print sales report.
 *
 * @param {object} [menuConfig]
 * @returns {boolean}
 */
export function isStoreStorageOptimizer(menuConfig) {
  return menuConfig?.storageOptimizer === true;
}
