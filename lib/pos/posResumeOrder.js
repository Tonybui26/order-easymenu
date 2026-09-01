import { cartConfigKey } from "@/lib/pos/itemCustomization";

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

/**
 * Rebuild a POS cart line from a saved order item.
 * Trust stored unit `price` (already includes variants + modifiers), same as QR.
 */
function orderItemToCartLine(item, orderId) {
  const selectedVariants = item.selectedVariants || [];
  const selectedModifiers = item.selectedModifiers || [];
  const price = Math.round(Number(item.price || 0) * 100) / 100;
  const basePrice = Math.max(
    0,
    Math.round((price - modifiersExtraTotal(selectedModifiers)) * 100) / 100,
  );

  return {
    lineId: item.lineId || `${item.menuItemId}-${Date.now()}`,
    itemId: item.menuItemId,
    title: item.name || "Untitled",
    basePrice,
    price,
    quantity: Number(item.quantity || 1),
    selectedVariants,
    selectedModifiers,
    configKey: cartConfigKey(selectedVariants, selectedModifiers),
    kitchenStatus: item.kitchenStatus || "sent",
    sourceOrderId: String(orderId),
    cancelReason: item.cancelReason || "",
    cancelledAt: item.cancelledAt || null,
    notes: typeof item.notes === "string" ? item.notes : undefined,
    isTakeaway: item.isTakeaway === true ? true : undefined,
  };
}

/**
 * Build POS cart lines from resumed orders (orders oldest-first, items in ticket order).
 */
export function buildCartLinesFromResumeOrders(orders) {
  const sortedOrders = [...(orders || [])].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  );

  const lines = [];
  for (const order of sortedOrders) {
    for (const item of order.items || []) {
      lines.push(orderItemToCartLine(item, order._id));
    }
  }
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
