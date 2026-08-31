import { getAllTicketIds } from "@/lib/pos/posHeldOrder";

function formatOrderIdShort(orderId) {
  return String(orderId || "").slice(-6).toUpperCase();
}

/**
 * DeleteOrderDrawer target for cancelling a single live / self-order ticket.
 */
export function buildCancelOrderTarget(order) {
  const orderId = String(order?._id || order?.id || order?.orderId || "").trim();
  const orderIdShort = formatOrderIdShort(orderId);
  const isPaid = String(order?.paymentStatus || "").trim() === "paid";
  const customerName = String(order?.customerName || "").trim();
  const table = String(order?.table || "").trim();

  const subtitleParts = [];
  if (customerName) subtitleParts.push(customerName);
  if (table && table !== "takeaway") subtitleParts.push(`Table ${table}`);
  if (isPaid) subtitleParts.push("Paid — refund manually if needed");

  return {
    id: orderId,
    orderId,
    title: `Cancel order #${orderIdShort || "—"}`,
    subtitle: subtitleParts.join(" · ") || undefined,
    ticketCount: 1,
    keepLabel: "Keep order",
    confirmLabel: "Confirm cancel",
    processingLabel: "Cancelling…",
    otherPlaceholder: "Describe why this order is being cancelled",
    warningMessage: isPaid
      ? "This order is already paid. You'll need to process a refund manually. This will cancel the order and cannot be undone."
      : "This will cancel this order. This action cannot be undone.",
  };
}

/**
 * DeleteOrderDrawer target for cancelling a held check (one or more tickets).
 */
export function buildHeldCheckCancelTarget(heldOrder) {
  const ticketIds = getAllTicketIds(heldOrder);
  const allPaid = Boolean(heldOrder?.allPaid);
  const table = String(heldOrder?.table || "").trim();
  const taxInvoiceNo = String(heldOrder?.taxInvoiceNo || "").trim();
  const customerName = String(heldOrder?.customerName || "").trim();
  const primaryOrderId = ticketIds[0] || String(heldOrder?.id || "").trim();
  const orderIdShort = formatOrderIdShort(primaryOrderId);

  const title = table
    ? `Cancel Table ${table}`
    : taxInvoiceNo
      ? `Cancel invoice ${taxInvoiceNo}`
      : customerName
        ? `Cancel order for ${customerName}`
        : `Cancel order #${orderIdShort || "—"}`;

  const subtitleParts = [];
  if (customerName && !table) subtitleParts.push(customerName);
  if (ticketIds.length > 1) {
    subtitleParts.push(`${ticketIds.length} tickets`);
  }
  if (heldOrder?.total != null) {
    subtitleParts.push(
      allPaid
        ? `$${Number(heldOrder.total).toFixed(2)} paid`
        : `$${Number(heldOrder.total).toFixed(2)} unpaid`,
    );
  }
  if (allPaid) subtitleParts.push("Refund manually if needed");

  return {
    id: heldOrder.id,
    orderIds: ticketIds,
    ticketCount: ticketIds.length,
    title,
    subtitle: subtitleParts.join(" · ") || undefined,
    keepLabel: "Keep order",
    confirmLabel: "Confirm cancel",
    processingLabel: "Cancelling…",
    otherPlaceholder: "Describe why this order is being cancelled",
    warningMessage: allPaid
      ? "This order is already paid. You'll need to process a refund manually. This will cancel the order and cannot be undone."
      : `This will cancel ${
          ticketIds.length === 1
            ? "this order"
            : `these ${ticketIds.length} tickets`
        }. This action cannot be undone.`,
  };
}
