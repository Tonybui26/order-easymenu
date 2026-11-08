import { isOffTableMapHeldOrder } from "@/lib/pos/posHeldOrder";

let hasOffTableHeld = false;
const listeners = new Set();

/** Latest held list from any POS screen; header reads the result. */
export function publishHeldOrders(heldOrders) {
  const next = (heldOrders || []).some(isOffTableMapHeldOrder);
  if (next === hasOffTableHeld) return;
  hasOffTableHeld = next;
  listeners.forEach((listener) => listener());
}

export function subscribeHeldOffTableAlert(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getHeldOffTableAlert() {
  return hasOffTableHeld;
}

export function getHeldOffTableAlertServer() {
  return false;
}
