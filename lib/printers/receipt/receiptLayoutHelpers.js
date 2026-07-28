/** Shared layout helpers for TAX INVOICE receipt printing (80mm ~48 chars). */

export const RECEIPT_WIDTH = 48;
export const RECEIPT_SEP = "================================";

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

export function getItemLineTotal(item = {}) {
  const qty = Number(item.quantity || 1);
  const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
  return Math.round(qty * unitPrice * 100) / 100;
}

export function getItemUnitPrice(item = {}) {
  if (item.unitPrice != null) return Number(item.unitPrice);
  return Number(item.price || 0);
}
