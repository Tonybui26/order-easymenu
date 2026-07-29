/** Kitchen docket order-type header: table line + inverted "Take Away" for pick-up. */

export const DOCKET_TAKE_AWAY_LABEL = "Take Away";

/** Space-filled band while reverse video is on (creates vertical padding in the black block). */
const REVERSE_BLOCK_PAD_LINE = "                        ";
const REVERSE_BLOCK_VERTICAL_PAD_LINES = 2;

/** ESC/POS GS B — white text on black background (reverse video). */
export const ESC_POS_REVERSE_ON = [0x1d, 0x42, 0x01];
export const ESC_POS_REVERSE_OFF = [0x1d, 0x42, 0x00];

export function hasDocketTableNumber(order) {
  const table = String(order?.table ?? "").trim();
  if (!table) return false;
  const normalized = table.toLowerCase();
  return normalized !== "takeaway" && normalized !== "pickup";
}

/** Table line for pick-up orders scanned from a table QR, e.g. "Table 12". */
export function getDocketTableLabel(order) {
  if (!hasDocketTableNumber(order)) return null;
  return `Table ${String(order.table).trim()}`;
}

function appendInvertedTakeAwayLabel({ addBytes, addText, reverseOn, reverseOff }) {
  addBytes(reverseOn);
  for (let i = 0; i < REVERSE_BLOCK_VERTICAL_PAD_LINES; i++) {
    addText(`${REVERSE_BLOCK_PAD_LINE}\n`);
  }
  addText(` ${DOCKET_TAKE_AWAY_LABEL} \n`);
  for (let i = 0; i < REVERSE_BLOCK_VERTICAL_PAD_LINES; i++) {
    addText(`${REVERSE_BLOCK_PAD_LINE}\n`);
  }
  addBytes(reverseOff);
}

/**
 * Append centred order-type header lines (caller sets alignment, size, bold).
 * Pick-up: optional table line, then inverted "Take Away".
 */
export function appendDocketOrderTypeHeader({
  addBytes,
  addText,
  order,
  reverseOn = ESC_POS_REVERSE_ON,
  reverseOff = ESC_POS_REVERSE_OFF,
}) {
  const orderType = order?.orderType || "";

  if (orderType === "dine-in") {
    addText(`* Table: ${order.table || "—"} *\n\n`);
    return;
  }

  if (orderType === "delivery") {
    addText("Delivery\n\n");
    return;
  }

  const tableLabel = getDocketTableLabel(order);
  if (tableLabel) {
    addText(`${tableLabel}\n`);
  }

  appendInvertedTakeAwayLabel({ addBytes, addText, reverseOn, reverseOff });
  addText("\n");
}

/** @deprecated Plain-text preview only — use appendDocketOrderTypeHeader for printing. */
export function getDocketOrderTypeHeader(order) {
  const orderType = order?.orderType || "";
  if (orderType === "dine-in") {
    return `* Table: ${order.table || "—"} *\n\n`;
  }
  if (orderType === "delivery") {
    return "Delivery\n\n";
  }
  const tableLabel = getDocketTableLabel(order);
  if (tableLabel) {
    return `${tableLabel}\n${DOCKET_TAKE_AWAY_LABEL}\n\n`;
  }
  return `${DOCKET_TAKE_AWAY_LABEL}\n\n`;
}
