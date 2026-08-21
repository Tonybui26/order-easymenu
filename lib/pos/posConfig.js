/** Client-side defaults for menu.config.pos (mirrors easymenu lib/pos/posConfig.js). */
export const DEFAULT_POS_CONFIG = {
  markAllTicketsDeliveredOnPayment: false,
  trainingModeEnabled: false,
  showKitchenPrintAliasesOnPos: false,
  restaurantModeEnabled: false,
  trackFoodServedOnTableMap: false,
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

export function isRestaurantModeEnabled(menuConfig) {
  return (
    Boolean(menuConfig?.posEnabled) &&
    Boolean(resolvePosConfig(menuConfig).restaurantModeEnabled)
  );
}

export function getPosHomePath(menuConfig) {
  return isRestaurantModeEnabled(menuConfig) ? "/pos/table-map" : "/pos";
}
