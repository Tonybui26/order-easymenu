/** Client-side defaults for menu.config.pos (mirrors easymenu lib/pos/posConfig.js). */
export const DEFAULT_POS_CONFIG = {
  markAllTicketsDeliveredOnPayment: false,
  trainingModeEnabled: false,
  showKitchenPrintAliasesOnPos: false,
  restaurantModeEnabled: false,
  /**
   * Always on — table map keeps paid undelivered checks visible until served.
   * Pay-at-counter stores that want tables free on payment should enable
   * markAllTicketsDeliveredOnPayment instead.
   */
  trackFoodServedOnTableMap: true,
  /** Pay before kitchen/service — behaviour gated in Order Manager later. */
  payFirstModeEnabled: false,
  /**
   * Takeaway without a table or buzzer number asks for customer details
   * before the order can start. Name is required by default; phone is optional.
   */
  takeawayRequireCustomerDetails: true,
  takeawayRequireName: true,
  takeawayRequirePhone: false,
  /** When true, takeaway bills and tax invoices include the customer name. */
  takeawayPrintCustomerNameOnReceipt: false,
  /**
   * When true, staff can mark a table Occupied on the table map before sending
   * an order. Default false — tapping an empty table still starts an order.
   */
  manualOpenTableEnabled: false,
  /**
   * When true, a paid and fully served table stays Occupied until staff
   * close it. Default false — those tables clear on their own.
   */
  manualCloseTableEnabled: false,
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
    // Always on — ignore stored false from older menus.
    trackFoodServedOnTableMap: true,
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
