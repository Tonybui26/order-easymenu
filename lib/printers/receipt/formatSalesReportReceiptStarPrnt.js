import { STAR_PRNT, commandsToBase64 } from "../starprnt/starPrntBytes.js";
import { buildSalesReportReceiptLines } from "./buildSalesReportReceiptLines";

function alignmentBytes(align) {
  if (align === "center") return STAR_PRNT.ALIGN_CENTER;
  return STAR_PRNT.ALIGN_LEFT;
}

/**
 * @param {{ storeName?: string, dateLabel: string, cashTotal: number, cardTotal: number }} payload
 */
export function formatSalesReportReceiptStarPrnt(payload) {
  const commands = [];
  const lines = buildSalesReportReceiptLines(payload);

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
