/**
 * TSPL test label for GP-2120T (and compatible TSC label printers in LABEL mode).
 * Line endings must be CRLF (\r\n).
 *
 * Layout:
 *   Line 1 — table / location (e.g. "Table 2")
 *   Line 2+ — item name (word-wrapped)
 */

import {
  removeVietnameseDiacritics,
  wrapText,
} from "../../helper/printerUtils.js";

const CRLF = "\r\n";

const LABEL_WIDTH_MM = 40;
const LABEL_HEIGHT_MM = 30;
const DOTS_PER_MM = 8; // 203 DPI
// GP-2120T applies its own printable inset; keep TSPL origin at 0,0.
const TEXT_X = 0;
const TEXT_Y = 0;
const FONT = "2";
const FONT_WIDTH_DOTS = 16;
const FONT_HEIGHT_DOTS = 26;
const RIGHT_MARGIN_DOTS = 3;

export const DEFAULT_TSPL_TEST_TABLE = "Table 2";

const RAW_TSPL_TEST_ITEM =
  "Fresh Milk Coffee with Grass Jelly (Sữa Tươi Cà Phê Sương Sáo)";

export const DEFAULT_TSPL_TEST_ITEM =
  removeVietnameseDiacritics(RAW_TSPL_TEST_ITEM);

/** @deprecated Use DEFAULT_TSPL_TEST_ITEM */
export const DEFAULT_TSPL_TEST_TEXT = DEFAULT_TSPL_TEST_ITEM;

/** Escape double quotes inside TSPL quoted string fields. */
export function escapeTsplText(text) {
  return String(text).replace(/"/g, '""');
}

function normalizeLabelText(text) {
  return removeVietnameseDiacritics(String(text || "").trim());
}

function getMaxCharsPerLine() {
  const labelWidthDots = LABEL_WIDTH_MM * DOTS_PER_MM;
  const usableWidth = labelWidthDots - TEXT_X - RIGHT_MARGIN_DOTS;
  return Math.max(1, Math.floor(usableWidth / FONT_WIDTH_DOTS));
}

function buildTextCommand(line, lineIndex) {
  const y = TEXT_Y + lineIndex * FONT_HEIGHT_DOTS;
  const safeLine = escapeTsplText(line);
  return `TEXT ${TEXT_X},${y},"${FONT}",0,1,1,"${safeLine}"`;
}

/**
 * Build a GP-2120T test label: table on line 1, item on line 2+.
 * @param {{ table?: string, item?: string }} options
 * @returns {string} Raw TSPL command block (UTF-8)
 */
export function createTsplTestLabel({
  table = DEFAULT_TSPL_TEST_TABLE,
  item = DEFAULT_TSPL_TEST_ITEM,
} = {}) {
  const tableLine = normalizeLabelText(table);
  const itemLines = wrapText(normalizeLabelText(item), getMaxCharsPerLine());

  const headerLines = [
    `SIZE ${LABEL_WIDTH_MM} mm,${LABEL_HEIGHT_MM} mm`,
    "GAP 2 mm,0 mm",
    "CLS",
  ];

  const labelLines = [tableLine, ...itemLines].filter(Boolean);
  const textCommands = labelLines.map((line, index) =>
    buildTextCommand(line, index),
  );

  return [...headerLines, ...textCommands, "PRINT 1"].join(CRLF) + CRLF;
}
