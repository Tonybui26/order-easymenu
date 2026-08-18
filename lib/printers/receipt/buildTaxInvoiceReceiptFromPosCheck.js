import { computeIncludedTaxFromInclusiveTotal } from "@/lib/helper/includedTax";

function roundMoney(amount) {
  return Math.round(Number(amount || 0) * 100) / 100;
}

function mapPosPaymentMethod(method) {
  if (method === "cash") return "counter-cash";
  if (method === "credit-card") return "counter-card";
  return method || "";
}

function mapPosUiOrderTypeForReceipt(orderType, tableNumber) {
  if (orderType === "dine-in") {
    return { orderType: "dine-in", table: tableNumber || "" };
  }
  if (orderType === "delivery") {
    return { orderType: "delivery" };
  }
  return { orderType: "takeaway" };
}

function cartLineToReceiptItem(line) {
  return {
    name: line.title || line.name || "Item",
    quantity: Number(line.quantity || 1),
    price: roundMoney(line.price),
    selectedVariants: line.selectedVariants || [],
    selectedModifiers: line.selectedModifiers || [],
  };
}

/**
 * Build TAX INVOICE payload from an open POS check before/during payment.
 *
 * @param {{
 *   storeProfile?: { storeName?: string, storeABN?: string, phone?: string, storeLogo?: string, taxPercentage?: number },
 *   cartLines?: Array,
 *   orderType?: string|null,
 *   tableNumber?: string,
 *   taxPercentage?: number,
 *   paymentSummary?: { method?: string, amountTendered?: number, change?: number, amountDue?: number, processingFee?: number }|null,
 *   invoiceNo?: string,
 *   taxInvoiceNo?: string,
 * }} input
 */
export function buildTaxInvoiceReceiptFromPosCheck(input = {}) {
  const storeProfile = input.storeProfile || {};
  const activeLines = (input.cartLines || []).filter(
    (line) => line?.kitchenStatus !== "cancelled",
  );

  const items = activeLines.map(cartLineToReceiptItem);
  const subtotal = roundMoney(
    activeLines.reduce(
      (sum, line) =>
        sum + Number(line.price || 0) * Number(line.quantity || 1),
      0,
    ),
  );

  const paymentMethod = mapPosPaymentMethod(input.paymentSummary?.method);
  const isCash = paymentMethod === "counter-cash";
  const taxPercentage =
    input.taxPercentage ?? storeProfile.taxPercentage ?? 10;
  const processingFee = roundMoney(
    Number(input.paymentSummary?.processingFee || 0),
  );
  const total = roundMoney(subtotal + processingFee);

  const order = {
    ...mapPosUiOrderTypeForReceipt(
      input.orderType,
      input.tableNumber,
    ),
    createdAt: new Date().toISOString(),
    items,
    subtotal,
    processingFee,
    total,
    gstIncluded: computeIncludedTaxFromInclusiveTotal(total, taxPercentage),
    paymentMethod,
  };

  if (isCash && input.paymentSummary?.amountTendered != null) {
    order.amountTendered = roundMoney(input.paymentSummary.amountTendered);
  }
  if (isCash && input.paymentSummary?.change != null) {
    order.changeDue = roundMoney(input.paymentSummary.change);
  }

  const invoiceNo =
    String(input.invoiceNo || "").trim() ||
    String(input.taxInvoiceNo || "").trim() ||
    "";

  return {
    store: {
      storeName: storeProfile.storeName || "",
      storeABN: storeProfile.storeABN || "",
      phone: storeProfile.phone || "",
      storeLogo: storeProfile.storeLogo || "",
    },
    order,
    invoiceNo,
  };
}
