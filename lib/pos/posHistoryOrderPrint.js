import { buildTaxInvoiceReceiptFromPosCheck } from "@/lib/printers/receipt/buildTaxInvoiceReceiptFromPosCheck";
import { printTaxInvoiceReceipt } from "@/lib/printers/printTaxInvoiceReceipt";
import { printBillForHeldCheck } from "@/lib/pos/posHeldOrderPrint";
import {
  buildCartLinesFromResumeOrders,
  buildPosResumeState,
} from "@/lib/pos/posResumeOrder";
import { resolvePosTaxInvoiceNoFromOrders } from "@/lib/pos/resolvePosTaxInvoiceNo";

function sortOrdersOldestFirst(orders = []) {
  return [...orders].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  );
}

function mapStoredPaymentToSummary(order) {
  const method = String(order?.paymentMethod || "").trim();
  if (method === "counter-cash" || method === "cash") {
    return {
      method: "cash",
      amountTendered: order.amountTendered,
      change: order.changeDue,
    };
  }
  if (method === "counter-card") {
    return {
      method: "credit-card",
      processingFee: Number(order.processingFee || 0),
      amountTendered: order.amountTendered,
    };
  }
  if (method === "stripe" || method === "card") {
    return { method: "credit-card" };
  }
  return null;
}

function pickPaymentOrder(orders) {
  const sorted = sortOrdersOldestFirst(orders);
  return (
    sorted.find((order) => order.amountTendered != null) ||
    sorted.find((order) => String(order.paymentMethod || "").trim()) ||
    sorted[sorted.length - 1]
  );
}

export async function printBillForHistoryCheck(orders, { storeProfile } = {}) {
  return printBillForHeldCheck(orders, { storeProfile });
}

export async function printReceiptForHistoryCheck(orders, { storeProfile } = {}) {
  const sorted = sortOrdersOldestFirst(orders);
  const cartLines = buildCartLinesFromResumeOrders(sorted);
  const resumeState = buildPosResumeState(sorted);
  const paymentOrder = pickPaymentOrder(sorted);
  const earliest = sorted[0];

  const payload = buildTaxInvoiceReceiptFromPosCheck({
    storeProfile,
    cartLines,
    orderType: resumeState.orderType,
    tableNumber: resumeState.tableNumber,
    taxInvoiceNo: resolvePosTaxInvoiceNoFromOrders(sorted),
    paymentSummary: mapStoredPaymentToSummary(paymentOrder),
  });

  if (earliest?.createdAt) {
    payload.order = {
      ...payload.order,
      createdAt: earliest.createdAt,
    };
  }

  if (!payload.order?.items?.length) {
    return {
      success: false,
      message: "Nothing on this check to print",
    };
  }

  return printTaxInvoiceReceipt(payload, {
    logoUrl: storeProfile?.storeLogo || null,
  });
}

export function buildHistoryRefundOrder(row) {
  const orders = row?.orders || [];
  if (orders.length === 0) return null;

  const tenderOrder = pickPaymentOrder(orders);
  const combinedTotal =
    Math.round(
      orders.reduce((sum, order) => sum + Number(order.total || 0), 0) * 100,
    ) / 100;

  return {
    ...tenderOrder,
    total: combinedTotal,
  };
}
