import { formatTwoColumnRow } from "./receiptLayoutHelpers";

function formatMoney(amount) {
  return `$${Number(amount || 0).toFixed(2)}`;
}

/**
 * Compact product-mix receipt for POS printers.
 * @param {{
 *   storeName?: string,
 *   dateFromLabel?: string,
 *   dateToLabel?: string,
 *   dateLabel?: string,
 *   productSummary?: Array<object>,
 * }} input
 */
export function buildProductSummaryReceiptLines(input) {
  const storeName = String(input?.storeName || "").trim();
  const rows = Array.isArray(input?.productSummary) ? input.productSummary : [];
  const lines = [];

  if (storeName) {
    lines.push({ text: storeName, align: "center", bold: true });
  }
  lines.push({ text: "PRODUCT SUMMARY", align: "center", bold: true });
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

  if (rows.length === 0) {
    lines.push({ text: "No product sales in range", align: "left" });
    lines.push({ text: "", align: "left" });
    return lines;
  }

  let totalQty = 0;
  let totalRevenue = 0;

  for (const row of rows) {
    const rank = row.popularityRank != null ? `#${row.popularityRank}` : "";
    const name = String(row.productName || "").trim() || "Item";
    const qty = Number(row.quantitySold) || 0;
    const revenue = Number(row.revenue) || 0;
    totalQty += qty;
    totalRevenue += revenue;

    lines.push({
      text: rank ? `${rank} ${name}` : name,
      align: "left",
      bold: true,
    });
    if (row.category && row.category !== "General") {
      lines.push({ text: `  ${row.category}`, align: "left" });
    }
    if (row.topVariant && row.topVariant !== "-") {
      lines.push({ text: `  Top: ${row.topVariant}`, align: "left" });
    }
    lines.push({
      text: formatTwoColumnRow(`  Qty ${qty}`, formatMoney(revenue)),
      align: "left",
    });
  }

  lines.push({ text: "--------------------------------", align: "center" });
  lines.push({
    text: formatTwoColumnRow("Total qty", String(totalQty)),
    align: "left",
    bold: true,
  });
  lines.push({
    text: formatTwoColumnRow("Total revenue", formatMoney(totalRevenue)),
    align: "left",
    bold: true,
  });
  lines.push({ text: "", align: "left" });
  return lines;
}
