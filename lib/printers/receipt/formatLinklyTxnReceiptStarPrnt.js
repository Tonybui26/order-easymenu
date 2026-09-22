import { STAR_PRNT, commandsToBase64 } from "../starprnt/starPrntBytes.js";
import { buildLinklyTxnReceiptLines } from "./buildLinklyTxnReceiptLines";

function alignmentBytes(align) {
  if (align === "center") return STAR_PRNT.ALIGN_CENTER;
  return STAR_PRNT.ALIGN_LEFT;
}

/**
 * @param {{ transaction: object, storeName?: string, documentTitle?: string }} payload
 */
export function formatLinklyTxnReceiptStarPrnt(payload) {
  const commands = [];
  const lines = buildLinklyTxnReceiptLines(payload);

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
    addText(`${line.text}\n`);
    if (line.bold) addBytes(STAR_PRNT.BOLD_OFF);
  }
  addBytes(STAR_PRNT.ALIGN_LEFT);
  addText("\n\n");
  addBytes(STAR_PRNT.CUT_FULL);

  return commandsToBase64(commands);
}
