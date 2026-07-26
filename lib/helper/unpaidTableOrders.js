import { isCounterPayment } from "@/lib/helper/payLater";

const UNPAID_COUNTER_DINE_IN_STATUSES = [
  "pending",
  "confirmed",
  "accepted",
  "preparing",
  "ready",
  "delivered",
];

export function isUnpaidCounterDineInOrder(order) {
  return (
    order?.paymentStatus === "pending" &&
    isCounterPayment(order?.paymentMethod) &&
    order?.table !== "takeaway" &&
    UNPAID_COUNTER_DINE_IN_STATUSES.includes(order?.status)
  );
}

export function getUnpaidOrdersByTable(orders) {
  const grouped = {};

  (orders ?? []).filter(isUnpaidCounterDineInOrder).forEach((order) => {
    const table = order.table || "Unknown";
    if (!grouped[table]) grouped[table] = [];
    grouped[table].push(order);
  });

  return grouped;
}

export function getOrdersForTables(unpaidByTable, tableNames) {
  const result = [];

  for (const table of tableNames) {
    const tableOrders = unpaidByTable[table];
    if (tableOrders?.length) {
      result.push(...tableOrders);
    }
  }

  return result;
}

export function getDistinctTablesFromOrders(orders) {
  return [
    ...new Set((orders ?? []).map((order) => order.table || "Unknown")),
  ];
}

/** Merge line items across orders on the same table for unpaid card display. */
export function combineOrderItemsForTable(tableOrders) {
  const combinedItems = {};

  (tableOrders ?? []).forEach((order) => {
    (order.items ?? []).forEach((item) => {
      const key = `${item.menuItemId}-${item.name}-${JSON.stringify(item.selectedVariants)}-${JSON.stringify(item.selectedModifiers)}`;
      if (combinedItems[key]) {
        combinedItems[key].quantity += item.quantity;
      } else {
        combinedItems[key] = { ...item };
      }
    });
  });

  return Object.values(combinedItems);
}

export function formatUnpaidTablesLabel(tableNames) {
  const sorted = [...tableNames].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );

  if (sorted.length === 0) return "";
  if (sorted.length === 1) return `Table ${sorted[0]}`;
  return `Tables ${sorted.join(", ")}`;
}
