/** Store manager roles (including legacy order_manager) may fully log out of the app. */
export function isStoreManagerRole(role) {
  return role === "store_manager" || role === "order_manager";
}

export const STAFF_PIN_CODE_MIN_LENGTH = 4;
export const STAFF_PIN_CODE_MAX_LENGTH = 6;

export function isValidStaffPinCode(pinCode) {
  const trimmed = String(pinCode || "").trim();
  return new RegExp(
    `^\\d{${STAFF_PIN_CODE_MIN_LENGTH},${STAFF_PIN_CODE_MAX_LENGTH}}$`,
  ).test(trimmed);
}
