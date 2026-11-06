import { buildTaxInvoiceReceiptFromPosCheck } from "@/lib/printers/receipt/buildTaxInvoiceReceiptFromPosCheck";
import { printTaxInvoiceReceipt } from "@/lib/printers/printTaxInvoiceReceipt";
import { printBillForHeldCheck } from "@/lib/pos/posHeldOrderPrint";
import {
  buildCartLinesFromResumeOrders,
  buildPosResumeState,
  buildReceiptDiscountInput,
} from "@/lib/pos/posResumeOrder";
import { resolvePosTaxInvoiceNoFromOrders } from "@/lib/pos/resolvePosTaxInvoiceNo";
import {
  formatOrderHistoryPaymentIdReference,
  isOnlinePaymentMethod,
} from "@/lib/helper/orderHistoryDisplay";
import { resolvePosConfig } from "@/lib/pos/posConfig";
import { mergeReceiptSurchargeLines } from "@/lib/pos/posSurcharges";

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

/** Stripe-paid online orders use the payment id. POS checks keep taxInvoiceNo. */
function resolveHistoryReceiptInvoiceNo(orders) {
  const sorted = sortOrdersOldestFirst(orders);
  const online = sorted.find(
    (order) =>
      isOnlinePaymentMethod(order?.paymentMethod) &&
      String(order?.paymentIntentId || "").trim(),
  );
  if (online) {
    return (
      formatOrderHistoryPaymentIdReference(online.paymentIntentId) ||
      String(online.paymentIntentId).trim()
    );
  }
  return resolvePosTaxInvoiceNoFromOrders(sorted);
}

function pickPaymentOrder(orders) {
  const sorted = sortOrdersOldestFirst(orders);
  return (
    sorted.find(
      (order) => String(order?.paymentStatus || "").trim() === "paid",
    ) ||
    sorted.find((order) => order.amountTendered != null) ||
    sorted.find((order) => String(order.paymentMethod || "").trim()) ||
    sorted[sorted.length - 1]
  );
}

export async function printBillForHistoryCheck(
  orders,
  { storeProfile, menuConfig } = {},
) {
  return printBillForHeldCheck(orders, { storeProfile, menuConfig });
}

export async function printReceiptForHistoryCheck(
  orders,
  { storeProfile, menuConfig } = {},
) {
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
    taxInvoiceNo: resolveHistoryReceiptInvoiceNo(sorted),
    paymentSummary: mapStoredPaymentToSummary(paymentOrder),
    discount: buildReceiptDiscountInput(resumeState.checkDiscount),
    surcharges: mergeReceiptSurchargeLines(sorted),
    customerName: resumeState.customerName,
    printCustomerName: Boolean(
      resolvePosConfig(menuConfig).takeawayPrintCustomerNameOnReceipt,
    ),
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
