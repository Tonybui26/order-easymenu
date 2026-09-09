/**
 * Store-level kitchen docket printing. Default on when unset so existing
 * stores keep printing until they turn it off in Settings.
 */
export function isKitchenPrintingEnabled(menuConfig) {
  return menuConfig?.kitchenPrintingEnabled !== false;
}
