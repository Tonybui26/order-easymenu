function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

/**
 * Apply a manual discount off the line total onto the charged unit price.
 * @param {{ unitPrice: number, quantity: number, discountAmount: number }} args
 * @returns {number} next charged unit price
 */
export function applyManualLineDiscount({
  unitPrice,
  quantity,
  discountAmount,
}) {
  const qty = Math.max(Number(quantity) || 0, 0);
  const unit = Math.max(0, Number(unitPrice) || 0);
  if (qty <= 0) return roundMoney(unit);

  const lineTotal = roundMoney(unit * qty);
  const off = Math.max(0, Math.min(lineTotal, Number(discountAmount) || 0));
  const nextLineTotal = roundMoney(lineTotal - off);
  return roundMoney(nextLineTotal / qty);
}

/**
 * Restore pre-manual unit price and drop cart-only discount metadata.
 * @param {object} line
 * @returns {object}
 */
export function clearManualLineDiscount(line) {
  if (!line) return line;
  const restoredUnit =
    line.preManualUnitPrice != null
      ? Number(line.preManualUnitPrice)
      : Number(line.price || 0);
  const { preManualUnitPrice: _pre, manualDiscount: _md, ...rest } = line;
  return {
    ...rest,
    price: roundMoney(Math.max(0, restoredUnit)),
  };
}
