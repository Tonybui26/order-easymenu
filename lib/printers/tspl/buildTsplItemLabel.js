/**
 * Shared TSPL single-label builder for GP-2120T (40×30 mm).
 * Line endings must be CRLF (\r\n).
 *
 * Layout:
 *   Line 1 — optional header (table / pick-up / delivery)
 *   Line 2+ — item line (name + compact options), word-wrapped
 */

import {
  removeVietnameseDiacritics,
  wrapText,
} from "../../helper/printerUtils.js";

const CRLF = "\r\n";

export const LABEL_WIDTH_MM = 40;
export const LABEL_HEIGHT_MM = 30;
const DOTS_PER_MM = 8; // 203 DPI
// GP-2120T applies its own printable inset; keep TSPL origin at 0,0.
const TEXT_X = 0;
const TEXT_Y = 0;
const FONT = "2";
const FONT_WIDTH_DOTS = 16;
const FONT_HEIGHT_DOTS = 26;
const RIGHT_MARGIN_DOTS = 3;

/** Escape double quotes inside TSPL quoted string fields. */
export function escapeTsplText(text) {
  return String(text).replace(/"/g, '""');
}

export function normalizeLabelText(text) {
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
 * Build one TSPL label block.
 * @param {{ headerLine?: string|null, itemText: string }} options
 * @returns {string} Raw TSPL commands for a single label (UTF-8)
 */
export function buildTsplItemLabel({ headerLine = null, itemText }) {
  const header = headerLine ? normalizeLabelText(headerLine) : "";
  const itemLines = wrapText(normalizeLabelText(itemText), getMaxCharsPerLine());

  const setupLines = [
    `SIZE ${LABEL_WIDTH_MM} mm,${LABEL_HEIGHT_MM} mm`,
    "GAP 2 mm,0 mm",
    "CLS",
  ];

  const labelLines = [header, ...itemLines].filter(Boolean);
  const textCommands = labelLines.map((line, index) =>
    buildTextCommand(line, index),
  );

  return [...setupLines, ...textCommands, "PRINT 1"].join(CRLF) + CRLF;
}
