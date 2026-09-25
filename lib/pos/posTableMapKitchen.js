import { getDrawerPayableOrderIds, getDrawerPosOrderIds, getDrawerQrOrderIds } from "@/lib/pos/posTableMapHeld";
import { resolvePosConfig } from "@/lib/pos/posConfig";

const KITCHEN_CANDIDATE_STATUSES = new Set([
  "pending",
  "confirmed",
  "accepted",
]);

/** Already fired to kitchen — All Served / Complete apply. */
const KITCHEN_IN_PROGRESS_STATUSES = new Set(["preparing", "ready"]);

export function getDrawerKitchenCandidateTickets(heldEntry) {
  return (heldEntry?.tickets || []).filter((ticket) =>
    KITCHEN_CANDIDATE_STATUSES.has(String(ticket?.status || "").trim()),
  );
}

export function getDrawerKitchenCandidateOrderIds(heldEntry) {
  return getDrawerKitchenCandidateTickets(heldEntry)
    .map((ticket) => String(ticket.orderId))
    .filter(Boolean);
}

export function hasTableMapKitchenInProgress(heldEntry) {
  return (heldEntry?.tickets || []).some((ticket) =>
    KITCHEN_IN_PROGRESS_STATUSES.has(String(ticket?.status || "").trim()),
  );
}

function ticketIsUnpaid(ticket) {
  return String(ticket?.paymentStatus || "").trim() !== "paid";
}

/** Unpaid QR dine-in tickets on this drawer entry (pay-at-counter). */
export function getDrawerUnpaidQrTickets(heldEntry) {
  if (!heldEntry) return [];
  const qrIds = new Set(getDrawerQrOrderIds(heldEntry));
  const tickets = heldEntry.tickets || [];

  if (qrIds.size > 0) {
    return tickets.filter(
      (ticket) => qrIds.has(String(ticket.orderId)) && ticketIsUnpaid(ticket),
    );
  }

  // Pure QR held entry (no composite qrOrderIds)
  if (getDrawerPosOrderIds(heldEntry).length > 0) return [];
  return tickets.filter(ticketIsUnpaid);
}

export function drawerHasUnpaidQrCounter(heldEntry) {
  return getDrawerUnpaidQrTickets(heldEntry).length > 0;
}

export function drawerHasUnpaidPos(heldEntry) {
  const posIds = new Set(getDrawerPosOrderIds(heldEntry));
  if (posIds.size === 0) return false;
  return (heldEntry?.tickets || []).some(
    (ticket) => posIds.has(String(ticket.orderId)) && ticketIsUnpaid(ticket),
  );
}

/**
 * Table-map "Send to kitchen".
 * Pay-first: only for tickets already paid but not yet preparing (recovery).
 * Not pay-first: send unpaid QR (pay later at table) or any waiting ticket.
 * Unpaid QR send-while-pay-first is POS menu only (PosTerminal), not this drawer.
 */
export function canSendTableMapToKitchen(heldEntry, menuConfig) {
  const candidates = getDrawerKitchenCandidateTickets(heldEntry);
  if (candidates.length === 0) return false;

  const isPayFirst = Boolean(resolvePosConfig(menuConfig).payFirstModeEnabled);
  if (isPayFirst) {
    return candidates.every(
      (ticket) => String(ticket?.paymentStatus || "").trim() === "paid",
    );
  }

  return true;
}

/**
 * Drawer Pay vs Send for QR pay-at-counter (mutually exclusive by pay-first config).
 * POS unpaid checks still show Pay regardless.
 * Pay-first + unpaid QR: Pay only here — both Pay and Send live on POS menu after Open.
 */
export function resolveTableMapDrawerPaymentActions(heldEntry, menuConfig) {
  const payableIds = getDrawerPayableOrderIds(heldEntry);
  const hasPayable = payableIds.length > 0;
  const isPayFirst = Boolean(resolvePosConfig(menuConfig).payFirstModeEnabled);
  const hasUnpaidQr = drawerHasUnpaidQrCounter(heldEntry);
  const hasUnpaidPos = drawerHasUnpaidPos(heldEntry);
  const canSend = canSendTableMapToKitchen(heldEntry, menuConfig);

  // QR-only unpaid pay-at-counter: one primary action from config
  if (hasUnpaidQr && !hasUnpaidPos) {
    return {
      showPay: isPayFirst && hasPayable,
      showSendToKitchen: !isPayFirst && canSend,
    };
  }

  // POS unpaid (alone or mixed): always allow Pay when due
  return {
    showPay: hasPayable,
    showSendToKitchen: !isPayFirst && canSend && hasUnpaidQr,
  };
}
