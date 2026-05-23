import { buildTsplItemLabel } from "./buildTsplItemLabel.js";
import { formatTsplItemText } from "./formatTsplItemText.js";
import { getTsplLabelHeader } from "./getTsplLabelHeader.js";

function expandItemsByQuantity(items) {
  const units = [];
  if (!Array.isArray(items)) return units;

  for (const item of items) {
    const qty = Math.max(1, Number(item.quantity) || 1);
    for (let i = 0; i < qty; i++) {
      units.push(item);
    }
  }

  return units;
}

/**
 * Build TSPL payload strings for each label in an order print job.
 * Returns one payload per physical label (quantity expanded).
 *
 * @param {{ order: Object, items: Array }} options
 * @returns {string[]} Raw TSPL blocks (UTF-8), one per label
 */
export function getTsplOrderLabelPayloads({ order, items }) {
  const headerLine = getTsplLabelHeader(order);
  const units = expandItemsByQuantity(items);

  return units.map((item) =>
    buildTsplItemLabel({
      headerLine,
      itemText: formatTsplItemText(item),
    }),
  );
}

/**
 * @deprecated Prefer getTsplOrderLabelPayloads — concatenated multi-label TSPL
 * is unreliable on GP-2120T (often prints only the first label).
 */
export function createTsplOrderLabels({ order, items }) {
  return getTsplOrderLabelPayloads({ order, items }).join("");
}

export function countTsplOrderLabels(items) {
  return expandItemsByQuantity(items).length;
}
