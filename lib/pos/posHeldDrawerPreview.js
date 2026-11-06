import { buildCartLinesFromResumeOrders } from "@/lib/pos/posResumeOrder";
import { mergeReceiptSurchargeLines } from "@/lib/pos/posSurcharges";

function sectionLinesTotal(lines = []) {
  return (
    Math.round(
      lines.reduce((sum, line) => {
        const qty = Number(line.quantity || 1);
        const unitPrice = Number(line.price || 0);
        return sum + unitPrice * qty;
      }, 0) * 100,
    ) / 100
  );
}

/**
 * Group resumed tickets into POS / QR preview sections for check drawers
 * (table map + held orders).
 */
export function buildHeldDrawerPreviewSections(orders) {
  const sorted = [...(orders || [])].sort(
    (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0),
  );
  const sections = [];

  for (const order of sorted) {
    const lines = buildCartLinesFromResumeOrders([order]).filter(
      (line) => String(line.kitchenStatus || "").trim() !== "cancelled",
    );
    if (lines.length === 0) continue;

    const source = String(order?.source || "").trim();
    const isPaid = String(order?.paymentStatus || "").trim() === "paid";
    if (source === "pos") {
      const taxInvoiceNo = String(order?.taxInvoiceNo || "").trim();
      // One sale shares a tax invoice number. Unpaid fires stay one list.
      const existing = sections.find((section) => {
        if (section?.type !== "pos") return false;
        if (!isPaid) return !section.allPaid;
        return (
          section.allPaid &&
          taxInvoiceNo &&
          section.taxInvoiceNo === taxInvoiceNo
        );
      });
      if (existing) {
        existing.lines.push(...lines);
        existing.total = sectionLinesTotal(existing.lines);
      } else {
        sections.push({
          type: "pos",
          id:
            isPaid && taxInvoiceNo
              ? `pos-paid-${taxInvoiceNo}`
              : `pos-${String(order._id)}`,
          lines: [...lines],
          total: sectionLinesTotal(lines),
          allPaid: isPaid,
          taxInvoiceNo: taxInvoiceNo || null,
        });
      }
      continue;
    }

    const customerName = String(order?.customerName || "").trim();
    sections.push({
      type: "qr",
      id: String(order._id),
      customerName,
      label: customerName ? `QR · ${customerName}` : "QR",
      lines,
      total: sectionLinesTotal(lines),
      allPaid: isPaid,
    });
  }

  return sections;
}

/** Named POS surcharge rows for the check drawer (not folded into item prices). */
export function buildHeldDrawerSurchargeLines(orders) {
  const posOrders = (orders || []).filter(
    (order) => String(order?.source || "").trim() === "pos",
  );
  return mergeReceiptSurchargeLines(posOrders);
}
