/** Client-side defaults for menu.config.pos (mirrors easymenu lib/pos/posConfig.js). */
export const DEFAULT_POS_CONFIG = {
  /** style1 is the current product cards. style2 is the image-overlay card. */
  menuStyle: "style1",
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
  /** Saved only. Dine-in buzzer behaviour is wired separately. */
  dineInUseBuzzer: false,
  /**
   * With takeawayRequireCustomerDetails, takeaway starts by choosing
   * customer info or a buzzer number.
   */
  takeawayRequireBuzzer: false,
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

export function normalizePosMenuStyle(value) {
  return value === "style2" ? "style2" : "style1";
}

/**
 * @param {object} [menuConfig]
 */
export function resolvePosConfig(menuConfig) {
  const resolved = {
    ...DEFAULT_POS_CONFIG,
    ...(menuConfig?.pos && typeof menuConfig.pos === "object"
      ? menuConfig.pos
      : {}),
    // Always on — ignore stored false from older menus.
    trackFoodServedOnTableMap: true,
  };
  resolved.menuStyle = normalizePosMenuStyle(resolved.menuStyle);
  return resolved;
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
