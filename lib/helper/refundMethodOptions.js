export const REFUND_METHODS = {
  CASH: "cash",
  CARD: "card",
};

const CARD_PAYMENT_METHODS = new Set([
  "credit_card",
  "apple_pay",
  "google_pay",
  "stripe",
  "counter-card",
]);

export const REFUND_METHOD_LABELS = {
  cash: "Cash",
  card: "Card",
};

export function isPosOrder(order) {
  return order?.source === "pos";
}

export function isCardPaymentMethod(paymentMethod) {
  return CARD_PAYMENT_METHODS.has(String(paymentMethod || "").trim());
}

/**
 * Which integrated EFTPOS partner can run a POS counter-card refund.
 * Prefer Linkly when both are somehow ready (same as PosPaymentDrawer).
 */
export function getPosCardRefundPartner({
  tyroCardReady,
  linklyCardReady,
} = {}) {
  if (linklyCardReady) return "linkly";
  if (tyroCardReady) return "tyro";
  return null;
}

export function canRefundPosOrderOnCard(
  order,
  { tyroCardReady, linklyCardReady } = {},
) {
  return (
    isPosOrder(order) &&
    String(order?.paymentMethod || "").trim() === "counter-card" &&
    Boolean(getPosCardRefundPartner({ tyroCardReady, linklyCardReady }))
  );
}

export function getAllowedRefundMethods(order, options = {}) {
  if (isPosOrder(order)) {
    if (canRefundPosOrderOnCard(order, options)) {
      return [REFUND_METHODS.CASH, REFUND_METHODS.CARD];
    }
    return [REFUND_METHODS.CASH];
  }

  if (isCardPaymentMethod(order?.paymentMethod)) {
    return [REFUND_METHODS.CASH, REFUND_METHODS.CARD];
  }

  return [REFUND_METHODS.CASH];
}

export function resolveDefaultRefundMethod(order, options = {}) {
  const allowed = getAllowedRefundMethods(order, options);
  if (
    allowed.includes(REFUND_METHODS.CARD) &&
    isCardPaymentMethod(order?.paymentMethod)
  ) {
    return REFUND_METHODS.CARD;
  }
  return REFUND_METHODS.CASH;
}

export function getRefundMethodHelpText(order, options = {}) {
  if (isPosOrder(order)) {
    if (String(order?.paymentMethod || "").trim() === "counter-card") {
      const partner = getPosCardRefundPartner(options);
      if (partner === "linkly") {
        return "Choose card to refund through the Linkly terminal, or cash for a manual counter refund.";
      }
      if (partner === "tyro") {
        return "Choose card to refund through the Tyro terminal, or cash for a manual counter refund.";
      }
      return "Pair Linkly or authorise Tyro in Settings to refund this card sale on the terminal. Cash refund is still available.";
    }
    return "This order was paid in cash.";
  }

  if (isCardPaymentMethod(order?.paymentMethod)) {
    return "Choose card to refund through the original online payment, or cash for a manual counter refund.";
  }

  return "This order was paid in cash.";
}

export function buildRefundMethodOptions(order, options = {}) {
  return getAllowedRefundMethods(order, options).map((id) => ({
    id,
    label: REFUND_METHOD_LABELS[id] || id,
  }));
}
