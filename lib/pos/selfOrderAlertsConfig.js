/**
 * Whether Order Manager should poll and show self-order (QR) alert popups.
 * Reads menu.config.selfOrderAlertsEnabled (default on when unset).
 * @param {object} [menuConfig]
 */
export function isSelfOrderAlertsEnabled(menuConfig) {
  if (menuConfig?.selfOrderAlertsEnabled === false) return false;
  return true;
}
