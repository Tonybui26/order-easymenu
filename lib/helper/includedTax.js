const DEFAULT_TAX_PERCENTAGE = 10;

/**
 * Tax/GST dollar amount embedded in tax-inclusive prices.
 * inclusiveTotal × (rate / (100 + rate))
 */
export function computeIncludedTaxFromInclusiveTotal(
  inclusiveTotal,
  taxPercentage = DEFAULT_TAX_PERCENTAGE,
) {
  const total = Number(inclusiveTotal);
  const rate = Number(taxPercentage);
  if (!Number.isFinite(total) || total <= 0) return 0;
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return Math.round(((total * rate) / (100 + rate)) * 100) / 100;
}

export { DEFAULT_TAX_PERCENTAGE };
