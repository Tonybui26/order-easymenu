import { STAR_PRNT, commandsToBase64 } from "../starprnt/starPrntBytes.js";
import { buildTaxInvoiceReceiptLines } from "./buildTaxInvoiceReceiptLines";

const STAR_ALIGN_RIGHT = [0x1b, 0x1d, 0x61, 0x02];

function alignmentBytes(align) {
  if (align === "center") return STAR_PRNT.ALIGN_CENTER;
  if (align === "right") return STAR_ALIGN_RIGHT;
  return STAR_PRNT.ALIGN_LEFT;
}

/**
 * Format TAX INVOICE receipt as StarPRNT base64 payload.
 * @param {{ store: Object, order: Object, invoiceNo: string }} payload
 */
export function formatTaxInvoiceReceiptStarPrnt(payload) {
  const commands = [];
  const lines = buildTaxInvoiceReceiptLines(payload);

  const addBytes = (bytes) => {
    commands.push(...bytes);
  };

  const addText = (text) => {
    commands.push(...new TextEncoder().encode(text));
  };

  addBytes(STAR_PRNT.INIT);

  for (const line of lines) {
    addBytes(alignmentBytes(line.align));
    if (line.bold) addBytes(STAR_PRNT.BOLD_ON);
    if (line.double) addBytes(STAR_PRNT.DOUBLE_ON);
    addText(`${line.text}\n`);
    if (line.double) addBytes(STAR_PRNT.DOUBLE_OFF);
    if (line.bold) addBytes(STAR_PRNT.BOLD_OFF);
  }

  addBytes(STAR_PRNT.ALIGN_LEFT);
  addText("\n\n");
  addBytes(STAR_PRNT.CUT_FULL);

  return commandsToBase64(commands);
}
