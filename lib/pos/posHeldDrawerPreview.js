import { buildCartLinesFromResumeOrders } from "@/lib/pos/posResumeOrder";

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
      const last = sections[sections.length - 1];
      // Keep paid and unpaid POS fires in separate sections so Total due
      // and Paid/Unpaid badges stay accurate on mixed checks.
      if (last?.type === "pos" && Boolean(last.allPaid) === isPaid) {
        last.lines.push(...lines);
        last.total = sectionLinesTotal(last.lines);
        last.allPaid = Boolean(last.allPaid) && isPaid;
      } else {
        sections.push({
          type: "pos",
          id: `pos-${String(order._id)}`,
          lines: [...lines],
          total: sectionLinesTotal(lines),
          allPaid: isPaid,
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
