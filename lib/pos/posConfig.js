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
  /** Dine-in can use an optional ticket buzzer number. */
  dineInUseBuzzer: false,
  /** Dine-in must have a buzzer (requires dineInUseBuzzer). */
  dineInRequireBuzzer: false,
  /** Takeaway shows an optional buzzer button and can use a buzzer number. */
  takeawayUseBuzzer: false,
  /**
   * With customer details required: choose customer info or buzzer.
   * Without: buzzer only. Requires takeawayUseBuzzer.
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
   * Table-map Takeaway button can also start dine-in.
   * Legacy stores may still unlock this via the buzzer + details combo.
   */
  tableMapTakeawayAllowsDineIn: false,
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
  const storedPos =
    menuConfig?.pos && typeof menuConfig.pos === "object" ? menuConfig.pos : {};
  const resolved = {
    ...DEFAULT_POS_CONFIG,
    ...storedPos,
    // Always on — ignore stored false from older menus.
    trackFoodServedOnTableMap: true,
  };
  resolved.menuStyle = normalizePosMenuStyle(resolved.menuStyle);

  // Legacy: takeawayRequireBuzzer implied buzzer was allowed before takeawayUseBuzzer existed.
  if (
    resolved.takeawayRequireBuzzer &&
    !("takeawayUseBuzzer" in storedPos)
  ) {
    resolved.takeawayUseBuzzer = true;
  }
  if (!resolved.dineInUseBuzzer) resolved.dineInRequireBuzzer = false;
  if (!resolved.takeawayUseBuzzer) resolved.takeawayRequireBuzzer = false;

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

/**
 * Table-map Takeaway button may also start dine-in.
 * Explicit flag, or legacy combo: dine-in Use buzzer + takeaway Use/Required
 * buzzer + required customer details (name or phone).
 */
export function isTableMapTakeawayDineInChoiceEnabled(posConfig) {
  const pos =
    posConfig && typeof posConfig === "object" ? posConfig : DEFAULT_POS_CONFIG;
  if (pos.tableMapTakeawayAllowsDineIn) return true;
  const detailsRequired =
    Boolean(pos.takeawayRequireCustomerDetails) &&
    (Boolean(pos.takeawayRequireName) || Boolean(pos.takeawayRequirePhone));
  return (
    Boolean(pos.dineInUseBuzzer) &&
    Boolean(pos.takeawayUseBuzzer) &&
    Boolean(pos.takeawayRequireBuzzer) &&
    detailsRequired
  );
}
