import { printKitchenOrder } from "@/lib/helper/printKitchenOrder";
import { buildTaxInvoiceReceiptFromPosCheck } from "@/lib/printers/receipt/buildTaxInvoiceReceiptFromPosCheck";
import { printTaxInvoiceReceipt } from "@/lib/printers/printTaxInvoiceReceipt";
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

/**
 * BILL receipt payload for a held check (no tender lines).
 */
export function buildBillReceiptPayloadFromResumeOrders(
  orders,
  { storeProfile, heldEntry } = {},
) {
  const sorted = sortOrdersOldestFirst(orders);
  const cartLines = buildCartLinesFromResumeOrders(sorted);
  const resumeState = buildPosResumeState(sorted);
  const earliest = sorted[0];

  const base = buildTaxInvoiceReceiptFromPosCheck({
    storeProfile,
    cartLines,
    orderType: resumeState.orderType,
    tableNumber: resumeState.tableNumber,
    taxInvoiceNo: resolvePosTaxInvoiceNoFromOrders(sorted),
  });

  const order = { ...base.order };
  delete order.paymentMethod;
  delete order.amountTendered;
  delete order.changeDue;
  if (earliest?.createdAt) {
    order.createdAt = earliest.createdAt;
  }

  return {
    ...base,
    documentTitle: "BILL",
    includeTender: false,
    order,
  };
}

/** Kitchen docket order — all non-cancelled items, regardless of prior send state. */
export function prepareKitchenReprintOrder(order) {
  return {
    ...order,
    items: (order.items || []).filter(
      (item) => String(item.kitchenStatus || "").trim() !== "cancelled",
    ),
  };
}

export async function printBillForHeldCheck(orders, { storeProfile, heldEntry } = {}) {
  const payload = buildBillReceiptPayloadFromResumeOrders(orders, {
    storeProfile,
    heldEntry,
  });

  if (!payload.order?.items?.length) {
    return {
      success: false,
      message: "Nothing on this check to print",
    };
  }

  const result = await printTaxInvoiceReceipt(payload, {
    logoUrl: storeProfile?.storeLogo || null,
  });

  if (result.success) {
    return {
      ...result,
      message: result.message.replace(/^Receipt/i, "Bill") || "Bill printed",
    };
  }

  return result;
}

/**
 * Reprint every kitchen ticket on a held check (one docket per POS fire).
 */
export async function reprintHeldCheckKitchen(
  orders,
  {
    storeProfile,
    itemGroups = [],
    showCustomToast = null,
    silentNoPrinters = true,
  } = {},
) {
  const sorted = sortOrdersOldestFirst(orders);
  const printableOrders = sorted
    .map(prepareKitchenReprintOrder)
    .filter((order) => (order.items || []).length > 0);

  if (printableOrders.length === 0) {
    return {
      success: false,
      message: "Nothing on this check to reprint",
    };
  }

  let successCount = 0;
  let lastFailure = null;

  for (const order of printableOrders) {
    const result = await printKitchenOrder(order, {
      storeProfile,
      itemGroups,
      source: "held_reprint",
      notify: true,
      notifySuccess: false,
      silentNoPrinters,
      showCustomToast,
    });

    if (result?.success && (result.failedPrints ?? 0) === 0) {
      successCount += 1;
    } else {
      lastFailure = result;
    }
  }

  if (successCount === printableOrders.length) {
    const ticketWord = printableOrders.length === 1 ? "ticket" : "tickets";
    return {
      success: true,
      message: `Reprinted ${successCount} kitchen ${ticketWord}`,
    };
  }

  if (successCount > 0) {
    return {
      success: true,
      message: `Reprinted ${successCount}/${printableOrders.length} kitchen tickets`,
      partial: true,
    };
  }

  return {
    success: false,
    message: lastFailure?.message || "Kitchen reprint failed",
  };
}
