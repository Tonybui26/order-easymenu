/** Device-local preference: auto-print paid QR/online orders on this Order Manager. */

export const AUTO_PRINTING_ENABLED_STORAGE_KEY =
  "orderManagerAutoPrintingEnabled";

export const AUTO_PRINTING_ENABLED_CHANGED_EVENT =
  "order-manager-auto-printing-enabled-changed";

export function getAutoPrintingEnabled() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(AUTO_PRINTING_ENABLED_STORAGE_KEY) === "true";
}

export function setAutoPrintingEnabled(enabled) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    AUTO_PRINTING_ENABLED_STORAGE_KEY,
    enabled ? "true" : "false",
  );
  window.dispatchEvent(
    new CustomEvent(AUTO_PRINTING_ENABLED_CHANGED_EVENT, {
      detail: { enabled: Boolean(enabled) },
    }),
  );
}
