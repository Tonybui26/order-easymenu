/** Device-local preference: mute new-order banner + sound on Order Manager. */

export const NEW_ORDER_ALERTS_MUTED_STORAGE_KEY =
  "orderManagerNewOrderAlertsMuted";

export const NEW_ORDER_ALERTS_MUTED_CHANGED_EVENT =
  "order-manager-new-order-alerts-muted-changed";

export function getNewOrderAlertsMuted() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(NEW_ORDER_ALERTS_MUTED_STORAGE_KEY) === "true";
}

export function setNewOrderAlertsMuted(muted) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    NEW_ORDER_ALERTS_MUTED_STORAGE_KEY,
    muted ? "true" : "false",
  );
  window.dispatchEvent(
    new CustomEvent(NEW_ORDER_ALERTS_MUTED_CHANGED_EVENT, {
      detail: { muted: Boolean(muted) },
    }),
  );
}
