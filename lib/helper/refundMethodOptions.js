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

export function getAllowedRefundMethods(order) {
  if (isPosOrder(order)) {
    return [REFUND_METHODS.CASH];
  }

  if (isCardPaymentMethod(order?.paymentMethod)) {
    return [REFUND_METHODS.CASH, REFUND_METHODS.CARD];
  }

  return [REFUND_METHODS.CASH];
}

export function resolveDefaultRefundMethod(order) {
  const allowed = getAllowedRefundMethods(order);
  if (
    allowed.includes(REFUND_METHODS.CARD) &&
    isCardPaymentMethod(order?.paymentMethod)
  ) {
    return REFUND_METHODS.CARD;
  }
  return REFUND_METHODS.CASH;
}

export function getRefundMethodHelpText(order) {
  if (isPosOrder(order)) {
    return "POS orders are refunded in cash only (card terminal is not integrated).";
  }

  if (isCardPaymentMethod(order?.paymentMethod)) {
    return "Choose card to refund through the original online payment, or cash for a manual counter refund.";
  }

  return "This order was paid in cash.";
}

export function buildRefundMethodOptions(order) {
  return getAllowedRefundMethods(order).map((id) => ({
    id,
    label: REFUND_METHOD_LABELS[id] || id,
  }));
}
