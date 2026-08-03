/**
 * Pick taxInvoiceNo from resumed/held orders (oldest-first scan).
 */
export function resolvePosTaxInvoiceNoFromOrders(orders) {
  const sorted = [...(orders || [])].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  );

  for (const order of sorted) {
    const no = String(order?.taxInvoiceNo || "").trim();
    if (no) return no;
  }
  return "";
}
