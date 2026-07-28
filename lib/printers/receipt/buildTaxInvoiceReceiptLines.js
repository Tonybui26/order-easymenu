import {
  RECEIPT_SEP,
  formatQtyLine,
  formatReceiptDate,
  formatReceiptDisplayName,
  formatReceiptMoney,
  formatReceiptOptionLine,
  formatTotalsLine,
  formatTwoColumnRow,
  getOptionPrice,
  getReceiptBaseUnitPrice,
  getReceiptFullUnitPrice,
  getReceiptLineTotal,
  getReceiptOrderTypeLabel,
} from "./receiptLayoutHelpers";

/**
 * Build logical receipt lines for TAX INVOICE layout.
 * Each line: { text, align?: 'left'|'center'|'right', bold?: boolean, double?: boolean }
 *
 * @param {{ store: Object, order: Object, invoiceNo: string }} payload
 */
export function buildTaxInvoiceReceiptLines(payload) {
  const store = payload?.store || {};
  const order = payload?.order || {};
  const invoiceNo = payload?.invoiceNo || "";
  const lines = [];

  function pushLine(text, options = {}) {
    lines.push({ text, align: "left", ...options });
  }

  if (store.storeName) {
    pushLine(formatReceiptDisplayName(store.storeName), { align: "center" });
  }
  pushLine("");
  if (store.phone) {
    pushLine(`Phone: ${store.phone}`, { align: "center" });
  }
  if (store.storeABN) {
    pushLine(`ABN: ${store.storeABN}`, { align: "center" });
  }
  pushLine(RECEIPT_SEP, { align: "center" });
  pushLine("TAX INVOICE", {
    align: "center",
    bold: true,
    double: true,
  });
  pushLine(RECEIPT_SEP, { align: "center" });
  pushLine(getReceiptOrderTypeLabel(order), {
    align: "center",
    bold: true,
    double: true,
  });
  pushLine(RECEIPT_SEP, { align: "center" });

  pushLine(formatTwoColumnRow("DESCRIPTION", "AMOUNT"));
  pushLine(RECEIPT_SEP, { align: "center" });

  const items = order.items || [];
  items.forEach((item, index) => {
    const sequence = index + 1;
    const baseUnitPrice = getReceiptBaseUnitPrice(item);
    const fullUnitPrice = getReceiptFullUnitPrice(item);
    const qty = Number(item.quantity || 1);
    const lineTotal = getReceiptLineTotal(item);
    const itemName = formatReceiptDisplayName(item.name || item.title || "Item");

    pushLine(
      `${sequence}. ${itemName} @ ${formatReceiptMoney(baseUnitPrice)}`,
    );

    const options = [
      ...(item.selectedVariants || []),
      ...(item.selectedModifiers || []),
    ];
    options.forEach((option) => {
      const optionName = option.optionName || option.name || "";
      if (!optionName) return;
      const optionLine = formatReceiptOptionLine(
        optionName,
        getOptionPrice(option),
      );
      if (optionLine) pushLine(optionLine);
    });

    pushLine(formatQtyLine(qty, fullUnitPrice, lineTotal), { align: "right" });
  });

  pushLine(RECEIPT_SEP, { align: "center" });

  if (order.subtotal != null) {
    pushLine(formatTotalsLine("Subtotal:", order.subtotal), { align: "right" });
  }

  if (order.discountAmount) {
    const pct =
      order.discountPercent != null
        ? ` (${Number(order.discountPercent).toFixed(2)}%)`
        : "";
    pushLine(
      formatTotalsLine(
        `Discount:${pct}`,
        formatReceiptMoney(-Math.abs(order.discountAmount)),
      ),
      { align: "right" },
    );
  }

  if (order.total != null) {
    pushLine(formatTotalsLine("Total:", order.total), {
      align: "right",
      bold: true,
      double: true,
    });
  }

  if (order.gstIncluded != null) {
    pushLine(
      formatTotalsLine("GST Included In Total:", order.gstIncluded),
      { align: "right" },
    );
  }

  const isCashPayment =
    order.paymentMethod === "counter-cash" ||
    order.paymentMethod === "cash";

  if (isCashPayment && order.amountTendered != null) {
    pushLine(formatTotalsLine("Cash:", order.amountTendered), {
      align: "right",
    });
  }
  if (isCashPayment && order.changeDue != null) {
    pushLine(formatTotalsLine("Change:", order.changeDue), { align: "right" });
  }

  if (order.hasGstFreeItems) {
    pushLine("* GST free items");
  }

  pushLine(RECEIPT_SEP, { align: "center" });

  const dateLabel = formatReceiptDate(order.createdAt);
  pushLine(`${dateLabel} No:`);
  if (invoiceNo) {
    pushLine(invoiceNo);
  }

  pushLine("");
  pushLine("PLEASE COME AGAIN", { align: "center" });
  pushLine("Powered by", { align: "center" });
  pushLine("EASYMENU", { align: "center" });
  pushLine("");

  return lines;
}
