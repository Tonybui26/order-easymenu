/**
 * Store setting: open the cash drawer from the terminal RJ12 port instead of
 * the receipt printer. Default off when unset.
 */
export function isCashDrawerDevicePortEnabled(menuConfig) {
  return menuConfig?.cashDrawerUseDevicePort === true;
}
