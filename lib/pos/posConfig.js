/** Client-side defaults for menu.config.pos (mirrors easymenu lib/pos/posConfig.js). */
export const DEFAULT_POS_CONFIG = {
  markAllTicketsDeliveredOnPayment: false,
  trainingModeEnabled: false,
};

/**
 * @param {object} [menuConfig]
 */
export function resolvePosConfig(menuConfig) {
  return {
    ...DEFAULT_POS_CONFIG,
    ...(menuConfig?.pos && typeof menuConfig.pos === "object"
      ? menuConfig.pos
      : {}),
  };
}
