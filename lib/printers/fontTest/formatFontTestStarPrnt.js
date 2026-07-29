import { STAR_PRNT, commandsToBase64 } from "../starprnt/starPrntBytes.js";

const STAR_ALIGN_RIGHT = [0x1b, 0x1d, 0x61, 0x02];
const SAMPLE =
  "The quick brown fox 0123456789 ABCDEFG";

/**
 * StarPRNT font & style reference sheet (mC-Print3 / compatible).
 */
export function formatFontTestStarPrnt(printerName = "") {
  const commands = [];

  const addBytes = (bytes) => {
    commands.push(...bytes);
  };

  const addText = (text) => {
    commands.push(...new TextEncoder().encode(text));
  };

  const resetStyle = () => {
    addBytes(STAR_PRNT.DOUBLE_OFF);
    addBytes(STAR_PRNT.BOLD_OFF);
    addBytes(STAR_PRNT.REVERSE_OFF);
    addBytes(STAR_PRNT.ALIGN_LEFT);
  };

  const addSection = (title) => {
    resetStyle();
    addBytes(STAR_PRNT.ALIGN_CENTER);
    addBytes(STAR_PRNT.BOLD_ON);
    addText(`\n${title}\n`);
    addBytes(STAR_PRNT.BOLD_OFF);
    addBytes(STAR_PRNT.ALIGN_LEFT);
    addText(`${"=".repeat(42)}\n`);
  };

  const addLabel = (label) => {
    resetStyle();
    addBytes(STAR_PRNT.BOLD_ON);
    addText(`${label}\n`);
    addBytes(STAR_PRNT.BOLD_OFF);
  };

  addBytes(STAR_PRNT.INIT);
  resetStyle();

  addBytes(STAR_PRNT.ALIGN_CENTER);
  addBytes(STAR_PRNT.BOLD_ON);
  addText("\nFONT TEST SHEET\n");
  addBytes(STAR_PRNT.BOLD_OFF);
  addText("StarPRNT built-in fonts\n");
  if (printerName) addText(`${printerName}\n`);
  addText(`${new Date().toLocaleString()}\n`);
  addText("\nNote: TAX INVOICE uses Star double\nsize + bold on Font A.\n");

  addSection("Font select (ESC M emulation)");
  const fontCommands = [
    { label: "Font A (default)", cmd: [0x1b, 0x4d, 0x00] },
    { label: "Font B (compact)", cmd: [0x1b, 0x4d, 0x01] },
    { label: "Font C (if supported)", cmd: [0x1b, 0x4d, 0x02] },
  ];
  for (const { label, cmd } of fontCommands) {
    addLabel(label);
    addBytes(cmd);
    addText(`${SAMPLE}\n\n`);
  }
  resetStyle();

  addSection("Star double size (ESC i)");
  addLabel("Normal");
  addText(`${SAMPLE.slice(0, 32)}\n\n`);
  addLabel("Double ON");
  addBytes(STAR_PRNT.DOUBLE_ON);
  addText(`${SAMPLE.slice(0, 28)}\n\n`);
  addBytes(STAR_PRNT.DOUBLE_OFF);

  addSection("Text styles");
  addLabel("Bold");
  addBytes(STAR_PRNT.BOLD_ON);
  addText(`${SAMPLE.slice(0, 32)}\n\n`);
  addBytes(STAR_PRNT.BOLD_OFF);

  addLabel("Bold + Double (receipt header style)");
  addBytes(STAR_PRNT.BOLD_ON);
  addBytes(STAR_PRNT.DOUBLE_ON);
  addText(`${SAMPLE.slice(0, 24)}\n\n`);
  addBytes(STAR_PRNT.DOUBLE_OFF);
  addBytes(STAR_PRNT.BOLD_OFF);

  addLabel("Reverse / inverted (GS B)");
  addBytes(STAR_PRNT.REVERSE_ON);
  addText(` ${SAMPLE.slice(0, 24)} \n\n`);
  addBytes(STAR_PRNT.REVERSE_OFF);

  addSection("Alignment");
  addLabel("Left");
  addBytes(STAR_PRNT.ALIGN_LEFT);
  addText(`${SAMPLE.slice(0, 32)}\n\n`);
  addLabel("Center");
  addBytes(STAR_PRNT.ALIGN_CENTER);
  addText(`${SAMPLE.slice(0, 32)}\n\n`);
  addLabel("Right");
  addBytes(STAR_ALIGN_RIGHT);
  addText(`${SAMPLE.slice(0, 32)}\n\n`);
  resetStyle();

  addSection("Receipt-style preview");
  addBytes(STAR_PRNT.ALIGN_CENTER);
  addBytes(STAR_PRNT.BOLD_ON);
  addBytes(STAR_PRNT.DOUBLE_ON);
  addText("TAX INVOICE\n");
  addBytes(STAR_PRNT.DOUBLE_OFF);
  addBytes(STAR_PRNT.BOLD_OFF);
  addText(`${"=".repeat(42)}\n`);
  addBytes(STAR_PRNT.BOLD_ON);
  addBytes(STAR_PRNT.DOUBLE_ON);
  addText("Table : 24\n");
  addBytes(STAR_PRNT.DOUBLE_OFF);
  addBytes(STAR_PRNT.BOLD_OFF);
  addText(`${"=".repeat(42)}\n\n`);

  resetStyle();
  addText("\n\n");
  addBytes(STAR_PRNT.CUT_FULL);

  return commandsToBase64(commands);
}
