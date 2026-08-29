import { normalizeLabelText } from "./buildTsplItemLabel.js";
import { getPreferredPrintName } from "../../helper/printNameAlias.js";
import { getItemPrintNote } from "../itemPrintNote.js";

/**
 * Compact item line for cup labels: name plus variant/modifier options inline.
 * Example: "Latte (Large, Less ice, No sugar)"
 *
 * @param {Object} item - Order line item
 * @returns {string}
 */
export function formatTsplItemText(item) {
  const name = normalizeLabelText(getPreferredPrintName(item?.name));
  if (!name) return "";

  const options = [];

  for (const variant of item?.selectedVariants || []) {
    const option = normalizeLabelText(getPreferredPrintName(variant?.optionName));
    if (option) options.push(option);
  }

  for (const modifier of item?.selectedModifiers || []) {
    const option = normalizeLabelText(
      getPreferredPrintName(modifier?.optionName),
    );
    if (option) options.push(option);
  }

  if (options.length === 0) {
    const note = getItemPrintNote(item);
    if (!note) return name;
    return `${name} (${normalizeLabelText(note)})`;
  }

  const note = getItemPrintNote(item);
  if (note) {
    options.push(normalizeLabelText(note));
  }

  return `${name} (${options.join(", ")})`;
}
