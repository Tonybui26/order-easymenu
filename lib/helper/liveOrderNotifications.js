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
