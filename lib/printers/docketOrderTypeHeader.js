/** Kitchen docket order-type header: table line + inverted "Take Away" for pick-up. */

export const DOCKET_TAKE_AWAY_LABEL = "Take Away";

/** Horizontal padding inside the inverted Take Away band. */
const TAKE_AWAY_BAND_LABEL = ` ${DOCKET_TAKE_AWAY_LABEL} `;

/** ESC/POS GS B — white text on black background (reverse video). */
export const ESC_POS_REVERSE_ON = [0x1d, 0x42, 0x01];
export const ESC_POS_REVERSE_OFF = [0x1d, 0x42, 0x00];
/** Slim spacer rows inside the band (ESC 3 n dots). Default line feed is ~32. */
const ESC_SPACER_LINE_SPACING = [0x1b, 0x33, 0x10];
const ESC_DEFAULT_LINE_SPACING = [0x1b, 0x32];

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

function appendInvertedTakeAwayLabel({
  addBytes,
  addText,
  reverseOn,
  reverseOff,
  setNormalSize,
  setEmphasisSize,
}) {
  addBytes(reverseOn);

  if (setNormalSize && setEmphasisSize) {
    const padLine = " ".repeat(TAKE_AWAY_BAND_LABEL.length);

    setNormalSize();
    addBytes(ESC_SPACER_LINE_SPACING);
    addText(`${padLine}\n`);

    addBytes(ESC_DEFAULT_LINE_SPACING);
    setEmphasisSize();
    addText(`${TAKE_AWAY_BAND_LABEL}\n`);

    setNormalSize();
    addBytes(ESC_SPACER_LINE_SPACING);
    addText(`${padLine}\n`);
    addBytes(ESC_DEFAULT_LINE_SPACING);
  } else {
    addText(`${TAKE_AWAY_BAND_LABEL}\n`);
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
  setNormalSize,
  setEmphasisSize,
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

  appendInvertedTakeAwayLabel({
    addBytes,
    addText,
    reverseOn,
    reverseOff,
    setNormalSize,
    setEmphasisSize,
  });
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
