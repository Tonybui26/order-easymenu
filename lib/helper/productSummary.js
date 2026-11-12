import { formatPosItemDisplayName } from "@/lib/helper/printNameAlias";

const PAID_STATUSES = new Set(["paid", "partially_refunded", "refunded"]);

/** Prefer `((kitchen alias))` when present — same as kitchen dockets. */
function kitchenLabel(name) {
  return formatPosItemDisplayName(name, { useKitchenPrintAliases: true }).trim();
}

function roundMoney(amount) {
  return Math.round(Number(amount || 0) * 100) / 100;
}

function salesCheckKey(order) {
  const checkId = String(order?.posCheckId || "").trim();
  if (checkId) return `check:${checkId}`;
  return `order:${String(order?._id || "")}`;
}

function isCancelledLine(item) {
  return String(item?.kitchenStatus || "").trim() === "cancelled";
}

function categoryLookupFromMenu(menuContent) {
  const map = new Map();
  for (const category of menuContent || []) {
    const categoryName = String(category?.name || "").trim() || "General";
    for (const item of category?.items || []) {
      const id = String(item?._id || item?.id || "").trim();
      if (id) map.set(id, categoryName);
      const name = String(item?.name || "").trim();
      if (name && !map.has(`name:${name}`)) map.set(`name:${name}`, categoryName);
    }
  }
  return map;
}

function resolveCategory(item, categoryByKey) {
  const menuItemId = String(item?.menuItemId || "").trim();
  if (menuItemId && categoryByKey.has(menuItemId)) {
    return categoryByKey.get(menuItemId);
  }
  const name = String(item?.name || "").trim();
  if (name && categoryByKey.has(`name:${name}`)) {
    return categoryByKey.get(`name:${name}`);
  }
  return "General";
}

function topEntry(map, quantitySold) {
  if (!map || map.size === 0 || !(quantitySold > 0)) return "-";
  const sorted = Array.from(map.entries()).sort(([, a], [, b]) => b - a);
  const [label, count] = sorted[0];
  const percentage = ((count / quantitySold) * 100).toFixed(0);
  return `${label} (${percentage}%)`;
}

function breakdownText(map) {
  if (!map || map.size === 0) return "-";
  return Array.from(map.entries())
    .map(([label, count]) => `${label} (${count})`)
    .join(", ");
}

/**
 * Product summary for paid orders — same shape as admin daily-sale product summary.
 * @param {Array<object>} orders
 * @param {Array<object>} [menuContent]
 */
export function summarizeProducts(orders, menuContent = []) {
  const categoryByKey = categoryLookupFromMenu(menuContent);
  const productSummaryMap = new Map();

  for (const order of orders || []) {
    if (!PAID_STATUSES.has(String(order?.paymentStatus || "").trim())) continue;

    for (const item of order?.items || []) {
      if (isCancelledLine(item)) continue;

      const rawName = String(item?.name || "").trim();
      const productName = kitchenLabel(rawName) || rawName;
      if (!productName) continue;

      const quantity = Math.max(0, Number(item?.quantity) || 0);
      if (quantity <= 0) continue;

      const unitPrice = Number(item?.price) || 0;
      const productKey = productName;

      if (!productSummaryMap.has(productKey)) {
        productSummaryMap.set(productKey, {
          productName,
          category: resolveCategory(item, categoryByKey),
          ordersCount: new Set(),
          quantitySold: 0,
          revenue: 0,
          variants: new Map(),
          modifiers: new Map(),
        });
      }

      const productData = productSummaryMap.get(productKey);
      productData.ordersCount.add(salesCheckKey(order));
      productData.quantitySold += quantity;
      productData.revenue = roundMoney(productData.revenue + unitPrice * quantity);

      for (const variant of item?.selectedVariants || []) {
        const optionName =
          kitchenLabel(variant?.optionName) ||
          String(variant?.optionName || "").trim();
        if (!optionName) continue;
        productData.variants.set(
          optionName,
          (productData.variants.get(optionName) || 0) + quantity,
        );
      }

      for (const modifier of item?.selectedModifiers || []) {
        const optionName =
          kitchenLabel(modifier?.optionName) ||
          String(modifier?.optionName || "").trim();
        if (!optionName) continue;
        productData.modifiers.set(
          optionName,
          (productData.modifiers.get(optionName) || 0) + quantity,
        );
      }
    }
  }

  return Array.from(productSummaryMap.values())
    .map((product) => ({
      productName: product.productName,
      category: product.category,
      ordersCount: product.ordersCount.size,
      quantitySold: product.quantitySold,
      revenue: roundMoney(product.revenue),
      topVariant: topEntry(product.variants, product.quantitySold),
      variantBreakdown: breakdownText(product.variants),
      modifierBreakdown: breakdownText(product.modifiers),
    }))
    .sort((a, b) => b.quantitySold - a.quantitySold)
    .map((product, index) => ({
      ...product,
      popularityRank: index + 1,
    }));
}

/**
 * Totals row helpers for the product summary table.
 * @param {Array<object>} rows
 */
export function productSummaryTotals(rows) {
  return {
    ordersCount: (rows || []).reduce((sum, row) => sum + (row.ordersCount || 0), 0),
    quantitySold: (rows || []).reduce(
      (sum, row) => sum + (row.quantitySold || 0),
      0,
    ),
    revenue: roundMoney(
      (rows || []).reduce((sum, row) => sum + (Number(row.revenue) || 0), 0),
    ),
  };
}
