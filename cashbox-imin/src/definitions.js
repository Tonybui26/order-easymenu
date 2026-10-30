/**
 * IminCashbox Capacitor plugin — iMin terminal RJ12 cash drawer.
 * Android only. This is the device service, not the printer SDK.
 */

export const IminCashboxPlugin = {
  /**
   * Pulse the terminal cash-drawer jack.
   * @returns {Promise<{ success: boolean }>}
   */
  open: () => Promise.resolve(),
};
