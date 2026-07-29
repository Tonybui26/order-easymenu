/** Kitchen docket order-type header: table line + inverted "Take Away" for pick-up. */

export const DOCKET_TAKE_AWAY_LABEL = "Take Away";

/** Horizontal padding inside the inverted Take Away band. */
const TAKE_AWAY_BAND_LABEL = ` ${DOCKET_TAKE_AWAY_LABEL} `;

/** ESC/POS GS B — white text on black background (reverse video). */
export const ESC_POS_REVERSE_ON = [0x1d, 0x42, 0x01];
export const ESC_POS_REVERSE_OFF = [0x1d, 0x42, 0x00];

/**
 * Slim top pad as a raster black bar (GS v 0).
 * Text spacers cannot go thinner than one font row on most kitchen printers,
 * and Font B is often ignored — a bit-image bar gives a true thin strip.
 * Width matches Font A double-width label (12 × 2 dots per char).
 */
const TAKE_AWAY_PAD_DOT_HEIGHT = 8;
const FONT_A_DOUBLE_WIDTH_DOTS = 24;

function appendMatchedBlackBar({ addBytes, labelLine, heightDots = TAKE_AWAY_PAD_DOT_HEIGHT }) {
  const widthDots = labelLine.length * FONT_A_DOUBLE_WIDTH_DOTS;
  const bytesPerRow = Math.ceil(widthDots / 8);
  const rem = widthDots % 8;
  const row = new Array(bytesPerRow).fill(0xff);
  if (rem !== 0) {
    row[bytesPerRow - 1] = (0xff << (8 - rem)) & 0xff;
  }

  // GS v 0 m xL xH yL yH d1…dk — normal density raster
  addBytes([
    0x1d,
    0x76,
    0x30,
    0x00,
    bytesPerRow & 0xff,
    (bytesPerRow >> 8) & 0xff,
    heightDots & 0xff,
    (heightDots >> 8) & 0xff,
  ]);
  for (let y = 0; y < heightDots; y++) {
    addBytes(row);
  }
}

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

function appendInvertedTakeAwayLabel({ addBytes, addText, reverseOn, reverseOff, setLabelSize }) {
  const labelLine = TAKE_AWAY_BAND_LABEL;

  appendMatchedBlackBar({ addBytes, labelLine });

  if (setLabelSize) setLabelSize();
  addBytes(reverseOn);
  addText(`${labelLine}\n`);
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
  setLabelSize,
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
    setLabelSize,
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
