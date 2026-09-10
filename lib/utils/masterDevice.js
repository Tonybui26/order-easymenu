/** Device-local preference: this Order Manager is the store’s master alert station. */

export const MASTER_DEVICE_ENABLED_STORAGE_KEY =
  "orderManagerMasterDeviceEnabled";

export const MASTER_DEVICE_ENABLED_CHANGED_EVENT =
  "order-manager-master-device-enabled-changed";

/**
 * Default true: missing key means master (existing single-device setups keep alerts).
 * Only an explicit "false" turns master off.
 */
export function getMasterDeviceEnabled() {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(MASTER_DEVICE_ENABLED_STORAGE_KEY) !== "false";
}

export function setMasterDeviceEnabled(enabled) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    MASTER_DEVICE_ENABLED_STORAGE_KEY,
    enabled ? "true" : "false",
  );
  window.dispatchEvent(
    new CustomEvent(MASTER_DEVICE_ENABLED_CHANGED_EVENT, {
      detail: { enabled: Boolean(enabled) },
    }),
  );
}
