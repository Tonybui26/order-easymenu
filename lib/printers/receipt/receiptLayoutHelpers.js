/** Shared layout helpers for TAX INVOICE receipt printing (80mm ~48 chars). */

import { getCustomerDisplayName } from "@/lib/helper/printNameAlias";
import { removeVietnameseDiacritics } from "@/lib/helper/printerUtils";

export const RECEIPT_WIDTH = 48;
export const RECEIPT_SEP = "=".repeat(RECEIPT_WIDTH);

export function formatReceiptMoney(amount) {
  const value = Math.round(Number(amount || 0) * 100) / 100;
  const prefix = value < 0 ? "-" : "";
  return `${prefix}$${Math.abs(value).toFixed(2)}`;
}

export function formatReceiptDate(dateInput) {
  const date = dateInput ? new Date(dateInput) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
}

export function getReceiptOrderTypeLabel(order = {}) {
  const orderType = order.orderType || "";
  if (orderType === "dine-in") {
    const table = String(order.table || "").trim() || "—";
    return `Table : ${table}`;
  }
  if (orderType === "delivery") return "DELIVERY";
  return "TAKEAWAY";
}

/**
 * Customer-facing receipt label: strip `((docket alias))` / `[[group]]` markers,
 * then remove Vietnamese diacritics for thermal printing.
 */
export function formatReceiptDisplayName(name) {
  const displayName = getCustomerDisplayName(name);
  if (!displayName) return "";
  return removeVietnameseDiacritics(displayName);
}

/** Modifier/variant line — omit `@ $0.00` when the option has no extra charge. */
export function formatReceiptOptionLine(optionName, optionPrice) {
  const label = formatReceiptDisplayName(optionName);
  if (!label) return "";
  const price = Number(optionPrice || 0);
  if (price > 0) {
    return `>${label} @ ${formatReceiptMoney(price)}`;
  }
  return `>${label}`;
}

export function padLineRight(text, width = RECEIPT_WIDTH) {
  const value = String(text || "");
  if (value.length >= width) return value.slice(0, width);
  return " ".repeat(width - value.length) + value;
}

export function formatTwoColumnRow(left, right, width = RECEIPT_WIDTH) {
  const leftText = String(left || "");
  const rightText = String(right || "");
  const gap = width - leftText.length - rightText.length;
  if (gap >= 1) {
    return leftText + " ".repeat(gap) + rightText;
  }
  return `${leftText} ${rightText}`.slice(0, width);
}

export function formatQtyLine(quantity, unitPrice, lineTotal) {
  const qty = Number(quantity || 1);
  const unit = formatReceiptMoney(unitPrice);
  const total = formatReceiptMoney(lineTotal);
  return padLineRight(`${qty} x ${unit} = ${total}`);
}

export function formatTotalsLine(label, amount, width = RECEIPT_WIDTH) {
  const amountText =
    typeof amount === "string" ? amount : formatReceiptMoney(amount);
  return padLineRight(`${label} ${amountText}`, width);
}

export function getOptionPrice(option = {}) {
  return Number(
    option.priceModifier ?? option.price ?? option.extraPrice ?? 0,
  );
}

function roundReceiptMoney(amount) {
  return Math.round(Number(amount || 0) * 100) / 100;
}

function getItemOptionExtras(item = {}) {
  const options = [
    ...(item.selectedVariants || []),
    ...(item.selectedModifiers || []),
  ];
  return roundReceiptMoney(
    options.reduce((sum, option) => sum + getOptionPrice(option), 0),
  );
}

/** Full per-unit price (base + modifiers/variants) — matches stored order `item.price`. */
export function getReceiptFullUnitPrice(item = {}) {
  if (item.price != null && item.price !== "") {
    return roundReceiptMoney(item.price);
  }
  const base = item.unitPrice != null ? Number(item.unitPrice) : 0;
  return roundReceiptMoney(base + getItemOptionExtras(item));
}

/** Base unit for `Name @ $X` row — full unit minus option extras (same as POS resume). */
export function getReceiptBaseUnitPrice(item = {}) {
  const fullUnit = getReceiptFullUnitPrice(item);
  const extras = getItemOptionExtras(item);
  return Math.max(0, roundReceiptMoney(fullUnit - extras));
}

/** Line total for qty row: quantity × full unit price. */
export function getReceiptLineTotal(item = {}) {
  const qty = Number(item.quantity || 1);
  return roundReceiptMoney(qty * getReceiptFullUnitPrice(item));
}
