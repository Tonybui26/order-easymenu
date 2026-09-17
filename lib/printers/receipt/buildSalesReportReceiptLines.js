/**
 * Super-simple register sales report lines for receipt printers.
 * @param {{ storeName?: string, dateLabel: string, cashTotal: number, cardTotal: number }} input
 * @returns {Array<{ text: string, align?: string, bold?: boolean }>}
 */
export function buildSalesReportReceiptLines(input) {
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
