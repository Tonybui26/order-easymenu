import { isCounterPayment } from "@/lib/helper/payLater";

/** Same criteria as the live new-order alert (paid online, or pending counter dine-in). */
export function isNotificationWorthyOrder(order) {
  if (
    order.paymentStatus === "paid" &&
    !isCounterPayment(order.paymentMethod)
  ) {
    return true;
  }

  if (
    order.paymentStatus === "pending" &&
    isCounterPayment(order.paymentMethod) &&
    order.table !== "takeaway"
  ) {
    return true;
  }

  return false;
}

/** Still waiting for Prepare (kitchen not started). */
export function isUnpreparedNewOrder(order) {
  return ["pending", "confirmed", "accepted"].includes(order.status);
}

/** QR / online self-ordering (not POS-held). */
export function isSelfOrderingOrder(order) {
  return String(order?.source || "").trim() !== "pos";
}

export function isSelfOrderNotificationCandidate(order) {
  return (
    isSelfOrderingOrder(order) &&
    isNotificationWorthyOrder(order) &&
    isUnpreparedNewOrder(order)
  );
}

/** Unpaid counter dine-in (pay-at-counter QR) — not takeaway. */
export function isUnpaidCounterDineInSelfOrder(order) {
  return (
    isSelfOrderingOrder(order) &&
    order?.paymentStatus === "pending" &&
    isCounterPayment(order?.paymentMethod) &&
    order?.table !== "takeaway"
  );
}

/**
 * Self-order alert host only (not Live Order Terminal).
 * Pay-first: unpaid counter QR alerts only while `pending`. After staff taps
 * "Ok, wait for payment" → confirmed, so it stops re-notifying until paid.
 */
export function isSelfOrderAlertCandidate(order, { payFirstMode = false } = {}) {
  if (!isSelfOrderNotificationCandidate(order)) return false;
  if (!payFirstMode) return true;
  if (!isUnpaidCounterDineInSelfOrder(order)) return true;
  return String(order?.status || "").trim() === "pending";
}

/** Primary alert action is acknowledge-and-wait (not Send to kitchen). */
export function isPayFirstWaitForPaymentAlert(
  order,
  { payFirstMode = false } = {},
) {
  if (!payFirstMode) return false;
  if (!isUnpaidCounterDineInSelfOrder(order)) return false;
  return String(order?.status || "").trim() === "pending";
}
