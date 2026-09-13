/**
 * Power-admin store gate for experimental Order Manager pilots
 * (Local Mode / on-device SQLite, etc.).
 *
 * @param {object} [menuConfig]
 * @returns {boolean}
 */
export function isStoreTesting(menuConfig) {
  return menuConfig?.isTesting === true;
}
