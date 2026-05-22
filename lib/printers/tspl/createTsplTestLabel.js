/**
 * TSPL test label for GP-2120T (and compatible TSC label printers in LABEL mode).
 * Line endings must be CRLF (\r\n).
 */

const CRLF = "\r\n";

/** Escape double quotes inside TSPL quoted string fields. */
export function escapeTsplText(text) {
  return String(text).replace(/"/g, '""');
}

/**
 * Build a minimal GP-2120T test label.
 * @param {{ text?: string }} options
 * @returns {string} Raw TSPL command block (UTF-8)
 */
export function createTsplTestLabel({ text = "HELLO" } = {}) {
  const safeText = escapeTsplText(text);
  const lines = [
    "SIZE 40 mm,30 mm",
    "GAP 2 mm,0 mm",
    "CLS",
    `TEXT 20,20,"3",0,1,1,"${safeText}"`,
    "PRINT 1",
  ];
  return lines.join(CRLF) + CRLF;
}
