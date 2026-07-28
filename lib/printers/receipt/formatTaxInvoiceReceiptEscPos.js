import { buildTaxInvoiceReceiptLines } from "./buildTaxInvoiceReceiptLines";

const ESC_ALIGN_LEFT = [0x1b, 0x61, 0x00];
const ESC_ALIGN_CENTER = [0x1b, 0x61, 0x01];
const ESC_ALIGN_RIGHT = [0x1b, 0x61, 0x02];
const ESC_BOLD_ON = [0x1b, 0x45, 0x01];
const ESC_BOLD_OFF = [0x1b, 0x45, 0x00];
const ESC_DOUBLE_ON = [0x1b, 0x21, 0x30];
const ESC_DOUBLE_OFF = [0x1b, 0x21, 0x00];
const ESC_INIT = [0x1b, 0x40];
const ESC_FEED_CUT = [0x1b, 0x64, 0x03];
const GS_CUT = [0x1d, 0x56, 0x41, 0x03];

function alignmentBytes(align) {
  if (align === "center") return ESC_ALIGN_CENTER;
  if (align === "right") return ESC_ALIGN_RIGHT;
  return ESC_ALIGN_LEFT;
}

/**
 * Format TAX INVOICE receipt as ESC/POS base64 payload.
 * @param {{ store: Object, order: Object, invoiceNo: string }} payload
 */
export function formatTaxInvoiceReceiptEscPos(payload) {
  const commands = [];
  const lines = buildTaxInvoiceReceiptLines(payload);

  const addBytes = (bytes) => {
    if (Array.isArray(bytes)) commands.push(...bytes);
    else commands.push(bytes);
  };

  const addText = (text) => {
    commands.push(...new TextEncoder().encode(text));
  };

  addBytes(ESC_INIT);

  for (const line of lines) {
    addBytes(alignmentBytes(line.align));
    if (line.bold) addBytes(ESC_BOLD_ON);
    if (line.double) addBytes(ESC_DOUBLE_ON);
    addText(`${line.text}\n`);
    if (line.double) addBytes(ESC_DOUBLE_OFF);
    if (line.bold) addBytes(ESC_BOLD_OFF);
  }

  addBytes(ESC_ALIGN_LEFT);
  addBytes(ESC_FEED_CUT);
  addBytes(GS_CUT);

  const uint8Array = new Uint8Array(commands);
  const binaryString = String.fromCharCode.apply(null, uint8Array);
  return btoa(binaryString);
}
