/**
 * TSPL test label for GP-2120T — uses shared buildTsplItemLabel.
 */

import { removeVietnameseDiacritics } from "../../helper/printerUtils.js";
import { buildTsplItemLabel, normalizeLabelText } from "./buildTsplItemLabel.js";

export const DEFAULT_TSPL_TEST_TABLE = "Table 2";

const RAW_TSPL_TEST_ITEM =
  "Fresh Milk Coffee with Grass Jelly (Sữa Tươi Cà Phê Sương Sáo)";

export const DEFAULT_TSPL_TEST_ITEM =
  removeVietnameseDiacritics(RAW_TSPL_TEST_ITEM);

/** @deprecated Use DEFAULT_TSPL_TEST_ITEM */
export const DEFAULT_TSPL_TEST_TEXT = DEFAULT_TSPL_TEST_ITEM;

export { escapeTsplText } from "./buildTsplItemLabel.js";

/**
 * Build a GP-2120T test label: table on line 1, item on line 2+.
 * @param {{ table?: string, item?: string }} options
 * @returns {string} Raw TSPL command block (UTF-8)
 */
export function createTsplTestLabel({
  table = DEFAULT_TSPL_TEST_TABLE,
  item = DEFAULT_TSPL_TEST_ITEM,
} = {}) {
  return buildTsplItemLabel({
    headerLine: normalizeLabelText(table),
    itemText: item,
  });
}
