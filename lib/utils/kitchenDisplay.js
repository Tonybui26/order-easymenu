/** Device-local preference: Kitchen Display screen on this Order Manager. */

export const KITCHEN_DISPLAY_ENABLED_STORAGE_KEY =
  "orderManagerKitchenDisplayEnabled";

export const KITCHEN_DISPLAY_ENABLED_CHANGED_EVENT =
  "order-manager-kitchen-display-enabled-changed";

/** Status tabs hidden while Kitchen Display is on. */
export const KITCHEN_DISPLAY_HIDDEN_VIEW_MODES = [
  "new",
  "scheduled",
  "ready",
  "unpaid",
  "all",
];

export function getKitchenDisplayEnabled() {
  if (typeof window === "undefined") return false;
  return (
    localStorage.getItem(KITCHEN_DISPLAY_ENABLED_STORAGE_KEY) === "true"
  );
}

export function setKitchenDisplayEnabled(enabled) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    KITCHEN_DISPLAY_ENABLED_STORAGE_KEY,
    enabled ? "true" : "false",
  );
  window.dispatchEvent(
    new CustomEvent(KITCHEN_DISPLAY_ENABLED_CHANGED_EVENT, {
      detail: { enabled: Boolean(enabled) },
    }),
  );
}
