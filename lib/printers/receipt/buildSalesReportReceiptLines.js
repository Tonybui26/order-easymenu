import { formatTwoColumnRow } from "./receiptLayoutHelpers";

const SUMMARY_RECEIPT_ROWS = [
  { key: "salesCount", label: "Number of sales", money: false },
  { key: "discountsTotal", label: "Discounts total" },
  { key: "cashPayments", label: "Cash payments" },
  { key: "creditCardPayments", label: "Card Payment" },
  { key: "otherPayments", label: "Other payments" },
  { key: "totalSales", label: "Total sales amount", bold: true },
  { key: "weekendSurcharge", label: "Weekend surcharge", section: "Surcharges" },
  { key: "serviceSurcharge", label: "Service surcharge" },
  { key: "totalSurcharge", label: "Total surcharge", bold: true },
  { key: "cashRefunds", label: "Cash refunds", section: "Refunds" },
  { key: "creditCardRefunds", label: "Credit card refunds" },
  { key: "otherRefunds", label: "Other refunds" },
  { key: "totalRefunds", label: "Total refund", bold: true },
];

function formatSummaryMoney(amount) {
  return `$${Number(amount || 0).toFixed(2)}`;
}

/**
 * Full sales summary for the report page.
 * Register close still uses the short cash/card lines below.
 * @param {{ storeName?: string, dateLabel?: string, dateFromLabel?: string, dateToLabel?: string, summary: object }} input
 */
function buildSalesSummaryReceiptLines(input) {
  const storeName = String(input?.storeName || "").trim();
  const summary = input?.summary || {};
  const lines = [];

  if (storeName) {
    lines.push({ text: storeName, align: "center", bold: true });
  }
  lines.push({ text: "SALES SUMMARY", align: "center", bold: true });
  if (input?.dateFromLabel || input?.dateToLabel) {
    if (input.dateFromLabel) {
      lines.push({ text: `From ${input.dateFromLabel}`, align: "center" });
    }
    if (input.dateToLabel) {
      lines.push({ text: `To ${input.dateToLabel}`, align: "center" });
    }
  } else {
    lines.push({
      text: String(input?.dateLabel || "").trim() || "—",
      align: "center",
    });
  }
  lines.push({ text: "--------------------------------", align: "center" });

  for (const row of SUMMARY_RECEIPT_ROWS) {
    if (row.section) {
      lines.push({ text: "", align: "left" });
      lines.push({ text: row.section.toUpperCase(), align: "left", bold: true });
    }
    const value =
      row.money === false
        ? String(summary[row.key] ?? 0)
        : formatSummaryMoney(summary[row.key]);
    lines.push({
      text: formatTwoColumnRow(row.label, value),
      align: "left",
      bold: Boolean(row.bold),
    });
  }

  lines.push({ text: "", align: "left" });
  return lines;
}

/**
 * Super-simple register sales report lines for receipt printers.
 * @param {{ storeName?: string, dateLabel: string, cashTotal: number, cardTotal: number, summary?: object }} input
 * @returns {Array<{ text: string, align?: string, bold?: boolean }>}
 */
export function buildSalesReportReceiptLines(input) {
  if (input?.summary) return buildSalesSummaryReceiptLines(input);

  const storeName = String(input?.storeName || "").trim();
  const dateLabel = String(input?.dateLabel || "").trim();
  const cashTotal = Number(input?.cashTotal) || 0;
  const cardTotal = Number(input?.cardTotal) || 0;
  const money = (amount) => `$${Number(amount || 0).toFixed(2)}`;

  const lines = [];
  if (storeName) {
    lines.push({ text: storeName, align: "center", bold: true });
  }
  lines.push({ text: "SALES REPORT", align: "center", bold: true });
  lines.push({ text: dateLabel || "—", align: "center" });
  lines.push({ text: "--------------------------------", align: "center" });
  lines.push({
    text: `Cash${" ".repeat(Math.max(1, 20 - money(cashTotal).length))}${money(cashTotal)}`,
    align: "left",
  });
  lines.push({
    text: `Card${" ".repeat(Math.max(1, 20 - money(cardTotal).length))}${money(cardTotal)}`,
    align: "left",
  });
  lines.push({ text: "--------------------------------", align: "center" });
  lines.push({
    text: `Total${" ".repeat(Math.max(1, 19 - money(cashTotal + cardTotal).length))}${money(cashTotal + cardTotal)}`,
    align: "left",
    bold: true,
  });
  lines.push({ text: "", align: "left" });
  return lines;
}
