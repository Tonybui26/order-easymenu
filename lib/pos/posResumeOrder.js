import { cartConfigKey } from "@/lib/pos/itemCustomization";
import { isCounterPayment } from "@/lib/helper/payLater";

function mapPosUiOrderType(orderType) {
  if (orderType === "dine-in") return "dine-in";
  if (orderType === "pick-up") return "takeaway";
  return null;
}

function modifiersExtraTotal(selectedModifiers = []) {
  return (
    Math.round(
      selectedModifiers.reduce(
        (sum, modifier) => sum + Number(modifier.priceModifier || 0),
        0,
      ) * 100,
    ) / 100
  );
}

function storedItemLineId(item) {
  return typeof item?.lineId === "string" ? item.lineId.trim() : "";
}

/**
 * QR/storefront lines omit `lineId`. `${menuItemId}-${Date.now()}` collides when
 * two tickets share a product (same ms in the resume loop) and React then
 * clones the first cart row when a new line is prepended.
 */
function fallbackResumeLineId(item, orderId, itemIndex) {
  const orderKey = String(orderId || "order");
  const itemKey = String(item?.menuItemId || "item");
  return `${orderKey}:${itemIndex}:${itemKey}`;
}

function uniquifyResumeLineId(lineId, orderId, itemIndex, seen) {
  if (!seen.has(lineId)) {
    seen.add(lineId);
    return lineId;
  }

  let next = `${lineId}:${orderId}:${itemIndex}`;
  let suffix = 2;
  while (seen.has(next)) {
    next = `${lineId}:${orderId}:${itemIndex}:${suffix}`;
    suffix += 1;
  }
  seen.add(next);
  return next;
}

/**
 * Rebuild a POS cart line from a saved order item.
 * Trust stored unit `price` (already includes variants + modifiers), same as QR.
 */
function orderItemToCartLine(
  item,
  orderId,
  {
    isExternalContext = false,
    isUnpaidExternalPayable = false,
    isQrCounterEditable = false,
    source = undefined,
    itemIndex = 0,
    seenLineIds,
  } = {},
) {
  const selectedVariants = item.selectedVariants || [];
  const selectedModifiers = item.selectedModifiers || [];
  const price = Math.round(Number(item.price || 0) * 100) / 100;
  const basePrice = Math.max(
    0,
    Math.round((price - modifiersExtraTotal(selectedModifiers)) * 100) / 100,
  );
  const sourceLineId =
    storedItemLineId(item) || fallbackResumeLineId(item, orderId, itemIndex);
  const lineId = seenLineIds
    ? uniquifyResumeLineId(sourceLineId, orderId, itemIndex, seenLineIds)
    : sourceLineId;

  const storedKitchenStatus = String(item.kitchenStatus || "").trim();
  const kitchenStatus = isQrCounterEditable
    ? storedKitchenStatus === "cancelled"
      ? "cancelled"
      : undefined
    : storedKitchenStatus || "sent";

  return {
    lineId,
    sourceLineId,
    sourceItemIndex: itemIndex,
    itemId: item.menuItemId,
    title: item.name || "Untitled",
    basePrice,
    price,
    quantity: Number(item.quantity || 1),
    selectedVariants,
    selectedModifiers,
    configKey: cartConfigKey(selectedVariants, selectedModifiers),
    kitchenStatus,
    sourceOrderId: String(orderId),
    source: source || undefined,
    cancelReason: item.cancelReason || "",
    cancelledAt: item.cancelledAt || null,
    notes: typeof item.notes === "string" ? item.notes : undefined,
    isTakeaway: item.isTakeaway === true ? true : undefined,
    ...(isExternalContext ? { isExternalContext: true } : {}),
    ...(isUnpaidExternalPayable ? { isUnpaidExternalPayable: true } : {}),
    ...(isQrCounterEditable ? { isQrCounterEditable: true } : {}),
  };
}

/** Stable list key so two tickets with the same dish don't share a React identity. */
export function posCartLineReactKey(line, index) {
  const orderId = String(line?.sourceOrderId || "open");
  const lineId = String(line?.lineId || "");
  if (orderId && lineId) return `${orderId}:${lineId}`;
  return lineId || `line:${index}`;
}

export function isExternalContextCartLine(line) {
  return Boolean(line?.isExternalContext);
}

/** Locked QR/context lines that still contribute to POS tender (unpaid counter). */
export function isUnpaidExternalPayableCartLine(line) {
  return Boolean(line?.isUnpaidExternalPayable);
}

/** Unpaid pay-at-counter QR not yet in kitchen — editable on POS. */
export function isQrCounterEditableCartLine(line) {
  return Boolean(line?.isQrCounterEditable);
}

const EDITABLE_COUNTER_QR_STATUSES = new Set([
  "pending",
  "confirmed",
  "accepted",
]);

function isUnpaidCounterNonPosOrder(order) {
  if (String(order?.source || "").trim() === "pos") return false;
  if (String(order?.paymentStatus || "").trim() === "paid") return false;
  if (isCounterPayment(order?.paymentMethod)) return true;

  // Resume payloads used to omit paymentMethod; if method is missing, treat
  // unpaid dine-in with a table as pay-at-counter (not Stripe/online).
  const method = String(order?.paymentMethod || "").trim();
  if (method) return false;
  const table = String(order?.table || "").trim();
  const orderType = String(order?.orderType || "").trim();
  const isDineIn =
    orderType === "dine-in" ||
    Boolean(table && table !== "takeaway" && table !== "pickup");
  return isDineIn && Boolean(table);
}

export function isEditableCounterQrOrder(order) {
  if (!isUnpaidCounterNonPosOrder(order)) return false;
  return EDITABLE_COUNTER_QR_STATUSES.has(String(order?.status || "").trim());
}

function resolveUnpaidExternalPayable(order, isExternalContext) {
  if (!isExternalContext) return false;
  return isUnpaidCounterNonPosOrder(order);
}

function pushResumeCartLines(
  orders,
  { resolveExternalContext, seenLineIds, lines },
) {
  for (const order of orders || []) {
    const source = String(order?.source || "").trim();
    const items = order.items || [];
    const isQrCounterEditable = isEditableCounterQrOrder(order);
    const isExternalContext = isQrCounterEditable
      ? false
      : Boolean(resolveExternalContext(order));
    const isUnpaidExternalPayable = resolveUnpaidExternalPayable(
      order,
      isExternalContext,
    );
    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      const item = items[itemIndex];
      if (String(item?.kitchenStatus || "").trim() === "cancelled") continue;
      lines.push(
        orderItemToCartLine(item, order._id, {
          isExternalContext,
          isUnpaidExternalPayable,
          isQrCounterEditable,
          source,
          itemIndex,
          seenLineIds,
        }),
      );
    }
  }
}

/**
 * Build POS cart lines from resumed orders (orders oldest-first, items in ticket order).
 * @param {object[]} orders
 * @param {{ asExternalContext?: boolean }} [options]
 */
export function buildCartLinesFromResumeOrders(orders, options = {}) {
  const sortedOrders = [...(orders || [])].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  );
  const asExternalContext = Boolean(options.asExternalContext);
  const lines = [];
  pushResumeCartLines(sortedOrders, {
    resolveExternalContext: () => asExternalContext,
    seenLineIds: new Set(),
    lines,
  });
  return lines;
}

/**
 * Mixed table resume: paid QR / preparing QR / paid POS as external;
 * unpaid editable counter QR and unpaid POS stay active.
 */
export function buildMixedTableResumeCartLines(orders) {
  const sortedOrders = [...(orders || [])].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  );
  const lines = [];
  pushResumeCartLines(sortedOrders, {
    resolveExternalContext: (order) => {
      if (isEditableCounterQrOrder(order)) return false;
      const isPos = String(order?.source || "").trim() === "pos";
      const isPaid = String(order?.paymentStatus || "").trim() === "paid";
      return !isPos || isPaid;
    },
    seenLineIds: new Set(),
    lines,
  });
  return lines;
}

export function isPosResumeCheckPaid(orders) {
  const list = orders || [];
  return (
    list.length > 0 &&
    list.every((order) => String(order.paymentStatus || "").trim() === "paid")
  );
}

export function pickCheckDiscountFromOrders(orders) {
  for (const order of orders || []) {
    const type = String(order?.discountType || "").trim();
    const amount = Number(order?.discountAmount || 0);
    if ((type === "percent" || type === "dollar") && amount > 0) {
      return {
        discountAmount: amount,
        discountPercent:
          type === "percent" && order.discountPercent != null
            ? Number(order.discountPercent)
            : undefined,
        discountType: type,
      };
    }
  }
  return null;
}

/** Map stored check discount to tax-invoice receipt builder input. */
export function buildReceiptDiscountInput(checkDiscount) {
  if (
    !checkDiscount?.discountAmount ||
    Number(checkDiscount.discountAmount) <= 0 ||
    !checkDiscount?.discountType
  ) {
    return null;
  }

  return {
    amount: Number(checkDiscount.discountAmount),
    type: checkDiscount.discountType,
    percent:
      checkDiscount.discountType === "percent" &&
      checkDiscount.discountPercent != null
        ? Number(checkDiscount.discountPercent)
        : null,
  };
}

/**
 * Shared POS resume decision for local cache and live fetch.
 * `ok: false` means the check cannot open on the terminal yet.
 */
export function planPosResumeApply(orders, { restaurantMode = false } = {}) {
  const list = Array.isArray(orders) ? orders : [];
  const posOrders = list.filter(
    (order) => String(order?.source || "").trim() === "pos",
  );
  const nonPosOrders = list.filter(
    (order) => String(order?.source || "").trim() !== "pos",
  );
  const unpaidNonPos = nonPosOrders.filter(
    (order) => String(order?.paymentStatus || "").trim() !== "paid",
  );
  const unpaidCounterQr = unpaidNonPos.filter(isUnpaidCounterNonPosOrder);
  const unpaidNonCounter = unpaidNonPos.filter(
    (order) => !isUnpaidCounterNonPosOrder(order),
  );

  if (unpaidNonCounter.length > 0) {
    return {
      ok: false,
      error:
        "This unpaid online order cannot be opened on POS — use Live Orders",
    };
  }

  if (posOrders.length === 0) {
    const resumeState = buildPosResumeState(
      unpaidCounterQr.length > 0 ? unpaidCounterQr : nonPosOrders,
    );
    const hasUnpaidCounterQr = unpaidCounterQr.length > 0;

    return {
      ok: true,
      kind: hasUnpaidCounterQr ? "qr-counter" : "external",
      hasActiveUnpaidPos: hasUnpaidCounterQr,
      lines: buildCartLinesFromResumeOrders(nonPosOrders, {
        // Paid / kitchen-started QR stay external; unpaid pre-kitchen become editable
        // via isEditableCounterQrOrder inside pushResumeCartLines.
        asExternalContext: true,
      }),
      checkOrderIds: hasUnpaidCounterQr ? resumeState.orderIds : [],
      activeOrderId: hasUnpaidCounterQr ? resumeState.activeOrderId : null,
      posCheckId: null,
      taxInvoiceNo: hasUnpaidCounterQr ? resumeState.taxInvoiceNo || "" : "",
      tableNumber: resumeState.tableNumber,
      customerName: resumeState.customerName || "",
      customerPhone: resumeState.customerPhone || "",
      customerEmail: resumeState.customerEmail || "",
      orderType:
        restaurantMode && resumeState.tableNumber
          ? "dine-in"
          : resumeState.orderType,
      isTablePrefilled: Boolean(restaurantMode && resumeState.tableNumber),
      checkDiscount: hasUnpaidCounterQr
        ? resumeState.checkDiscount || null
        : null,
    };
  }

  const unpaidPosOrders = posOrders.filter(
    (order) => String(order?.paymentStatus || "").trim() !== "paid",
  );
  const payableOrders = [...unpaidPosOrders, ...unpaidCounterQr];
  const hasActiveUnpaidPos = payableOrders.length > 0;
  const resumeState = buildPosResumeState(
    hasActiveUnpaidPos ? payableOrders : posOrders,
  );
  const lines = hasActiveUnpaidPos
    ? buildMixedTableResumeCartLines(list)
    : buildCartLinesFromResumeOrders(list, { asExternalContext: true });

  return {
    ok: true,
    kind: "pos",
    hasActiveUnpaidPos,
    lines,
    checkOrderIds: hasActiveUnpaidPos ? resumeState.orderIds : [],
    activeOrderId: hasActiveUnpaidPos ? resumeState.activeOrderId : null,
    posCheckId: hasActiveUnpaidPos ? resumeState.posCheckId : null,
    taxInvoiceNo: hasActiveUnpaidPos ? resumeState.taxInvoiceNo || "" : "",
    tableNumber: resumeState.tableNumber,
    customerName: resumeState.customerName || "",
    customerPhone: resumeState.customerPhone || "",
    customerEmail: resumeState.customerEmail || "",
    orderType:
      restaurantMode && resumeState.tableNumber
        ? "dine-in"
        : resumeState.orderType,
    isTablePrefilled: Boolean(restaurantMode && resumeState.tableNumber),
    checkDiscount: hasActiveUnpaidPos ? resumeState.checkDiscount || null : null,
  };
}

export function buildPosResumeState(orders) {
  const sortedOrders = [...(orders || [])].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  );
  if (sortedOrders.length === 0) {
    return {
      orderIds: [],
      activeOrderId: null,
      posCheckId: null,
      taxInvoiceNo: "",
      tableNumber: "",
      tableNumbers: [],
      orderType: null,
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      isCheckPaid: false,
    };
  }

  const orderIds = sortedOrders.map((order) => String(order._id));
  const primary = sortedOrders[sortedOrders.length - 1];
  const orderType = mapPosUiOrderType(primary.orderType);
  const posCheckId =
    String(primary.posCheckId || "").trim() ||
    String(sortedOrders.find((order) => order.posCheckId)?.posCheckId || "").trim() ||
    null;
  const taxInvoiceNo =
    sortedOrders
      .map((order) => String(order?.taxInvoiceNo || "").trim())
      .find(Boolean) || "";
  const checkDiscount = pickCheckDiscountFromOrders(sortedOrders);
  const tableNumbers = resolveResumeTableNumbers(sortedOrders);
  const tableNumber =
    tableNumbers.length > 1
      ? tableNumbers.join(", ")
      : tableNumbers[0] || String(primary.table || "").trim();
  const customer = resolveResumeCustomer(sortedOrders);

  return {
    orderIds,
    activeOrderId: String(primary._id),
    posCheckId,
    taxInvoiceNo,
    tableNumber,
    tableNumbers,
    orderType,
    customerName: customer.name,
    customerPhone: customer.phone,
    customerEmail: customer.email,
    isCheckPaid: isPosResumeCheckPaid(sortedOrders),
    checkDiscount,
  };
}

function resolveResumeCustomer(orders) {
  let name = "";
  let phone = "";
  let email = "";
  for (const order of orders || []) {
    if (!name) name = String(order?.customerName || "").trim();
    if (!phone) phone = String(order?.customerPhone || "").trim();
    if (!email) email = String(order?.customerEmail || "").trim();
    if (name && phone && email) break;
  }
  return { name, phone, email };
}

function resolveResumeTableNumbers(orders) {
  const names = [];
  const seen = new Set();

  function push(value) {
    const name = String(value || "").trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    names.push(name);
  }

  for (const order of orders || []) {
    if (Array.isArray(order?.tables)) {
      order.tables.forEach(push);
    }
    push(order?.table);
  }

  names.sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  );
  return names;
}
