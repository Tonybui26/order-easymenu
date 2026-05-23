import { normalizeLabelText } from "./buildTsplItemLabel.js";

/**
 * Compact item line for cup labels: name plus variant/modifier options inline.
 * Example: "Latte (Large, Less ice, No sugar)"
 *
 * @param {Object} item - Order line item
 * @returns {string}
 */
export function formatTsplItemText(item) {
  const name = normalizeLabelText(item?.name);
  if (!name) return "";

  const options = [];

  for (const variant of item?.selectedVariants || []) {
    const option = normalizeLabelText(variant?.optionName);
    if (option) options.push(option);
  }

  for (const modifier of item?.selectedModifiers || []) {
    const option = normalizeLabelText(modifier?.optionName);
    if (option) options.push(option);
  }

  if (options.length === 0) return name;

  return `${name} (${options.join(", ")})`;
}
