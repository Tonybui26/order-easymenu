/**
 * Takeaway / pick-up tickets. Delivery and dine-in are excluded.
 * Older orders without `orderType` fall back to the legacy `table` field.
 */
export function isTakeawayOrder(order) {
  const canonicalOrderType = String(order?.orderType ?? "").trim();
  if (canonicalOrderType === "pick-up") return true;
  if (
    canonicalOrderType === "delivery" ||
    canonicalOrderType === "dine-in"
  ) {
    return false;
  }

  const table = String(order?.table ?? "")
    .trim()
    .toLowerCase();
  if (
    !table ||
    table === "takeaway" ||
    table === "pickup" ||
    table === "pick-up"
  ) {
    return true;
  }
  return false;
}
