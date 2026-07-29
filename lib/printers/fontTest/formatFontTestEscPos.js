const ESC_INIT = [0x1b, 0x40];
const ESC_FONT_A = [0x1b, 0x4d, 0x00];
const ESC_FONT_B = [0x1b, 0x4d, 0x01];
const ESC_FONT_C = [0x1b, 0x4d, 0x02];
const ESC_BOLD_ON = [0x1b, 0x45, 0x01];
const ESC_BOLD_OFF = [0x1b, 0x45, 0x00];
const ESC_UNDERLINE_ON = [0x1b, 0x2d, 0x01];
const ESC_UNDERLINE_OFF = [0x1b, 0x2d, 0x00];
const ESC_ALIGN_LEFT = [0x1b, 0x61, 0x00];
const ESC_ALIGN_CENTER = [0x1b, 0x61, 0x01];
const ESC_ALIGN_RIGHT = [0x1b, 0x61, 0x02];
const ESC_SIZE_NORMAL = [0x1b, 0x21, 0x00];
const ESC_FEED_CUT = [0x1b, 0x64, 0x03];
const GS_CUT = [0x1d, 0x56, 0x41, 0x03];
const GS_REVERSE_ON = [0x1d, 0x42, 0x01];
const GS_REVERSE_OFF = [0x1d, 0x42, 0x00];

const SAMPLE =
  "The quick brown fox 0123456789 ABCDEFG";

function commandsToBase64(commands) {
  const uint8Array = new Uint8Array(commands);
  const binaryString = String.fromCharCode.apply(null, uint8Array);
  return btoa(binaryString);
}

/**
 * ESC/POS font & style reference sheet for 80mm receipt/docket printers.
 * Fonts are built into the printer firmware (Font A/B/C), not web typefaces.
 */
export function formatFontTestEscPos(printerName = "") {
  const commands = [];

  const addBytes = (bytes) => {
    commands.push(...bytes);
  };

  const addText = (text) => {
    commands.push(...new TextEncoder().encode(text));
  };

  const resetStyle = () => {
    addBytes(ESC_SIZE_NORMAL);
    addBytes(ESC_BOLD_OFF);
    addBytes(ESC_UNDERLINE_OFF);
    addBytes(GS_REVERSE_OFF);
    addBytes(ESC_FONT_A);
    addBytes(ESC_ALIGN_LEFT);
  };

  const addSection = (title) => {
    resetStyle();
    addBytes(ESC_ALIGN_CENTER);
    addBytes(ESC_BOLD_ON);
    addText(`\n${title}\n`);
    addBytes(ESC_BOLD_OFF);
    addBytes(ESC_ALIGN_LEFT);
    addText(`${"=".repeat(42)}\n`);
  };

  const addLabel = (label) => {
    resetStyle();
    addBytes(ESC_BOLD_ON);
    addText(`${label}\n`);
    addBytes(ESC_BOLD_OFF);
  };

  addBytes(ESC_INIT);
  resetStyle();

  addBytes(ESC_ALIGN_CENTER);
  addBytes(ESC_BOLD_ON);
  addText("\nFONT TEST SHEET\n");
  addBytes(ESC_BOLD_OFF);
  addText("ESC/POS built-in fonts\n");
  if (printerName) addText(`${printerName}\n`);
  addText(`${new Date().toLocaleString()}\n`);
  addText("\nNote: TAX INVOICE header uses\nFont A + 2x2 + Bold (ESC ! 0x30)\n");
  addText("Table line uses same style.\n");

  addSection("Font select (ESC M)");
  const fontCommands = [
    { label: "Font A (default, 12x24)", cmd: ESC_FONT_A },
    { label: "Font B (compact, 9x17)", cmd: ESC_FONT_B },
    { label: "Font C (if supported)", cmd: ESC_FONT_C },
  ];
  for (const { label, cmd } of fontCommands) {
    addLabel(label);
    addBytes(cmd);
    addText(`${SAMPLE}\n\n`);
  }
  resetStyle();

  addSection("Character size (ESC !)");
  const escSizes = [
    { label: "Normal 0x00", value: 0x00 },
    { label: "Double height 0x10", value: 0x10 },
    { label: "Double width 0x20", value: 0x20 },
    { label: "Double W+H 0x30 (receipt header)", value: 0x30 },
    { label: "Bold 0x08", value: 0x08 },
    { label: "Bold + 2x2 0x38 (kitchen items)", value: 0x38 },
  ];
  for (const { label, value } of escSizes) {
    addLabel(label);
    addBytes([0x1b, 0x21, value]);
    addText(`${SAMPLE.slice(0, 28)}\n\n`);
  }
  resetStyle();

  addSection("GS ! magnification (1-8)");
  for (let n = 0; n <= 7; n++) {
    addLabel(`GS ! ${n} (WxH scale)`);
    addBytes([0x1d, 0x21, n]);
    addText(`Scale ${n}: ${SAMPLE.slice(0, 22)}\n\n`);
  }
  resetStyle();

  addSection("Text styles");
  addLabel("Bold (ESC E)");
  addBytes(ESC_BOLD_ON);
  addText(`${SAMPLE.slice(0, 32)}\n\n`);
  addBytes(ESC_BOLD_OFF);

  addLabel("Underline (ESC -)");
  addBytes(ESC_UNDERLINE_ON);
  addText(`${SAMPLE.slice(0, 32)}\n\n`);
  addBytes(ESC_UNDERLINE_OFF);

  addLabel("Reverse / inverted (GS B)");
  addBytes(GS_REVERSE_ON);
  addText(` ${SAMPLE.slice(0, 24)} \n\n`);
  addBytes(GS_REVERSE_OFF);

  addSection("Alignment");
  addLabel("Left");
  addBytes(ESC_ALIGN_LEFT);
  addText(`${SAMPLE.slice(0, 32)}\n\n`);
  addLabel("Center");
  addBytes(ESC_ALIGN_CENTER);
  addText(`${SAMPLE.slice(0, 32)}\n\n`);
  addLabel("Right");
  addBytes(ESC_ALIGN_RIGHT);
  addText(`${SAMPLE.slice(0, 32)}\n\n`);
  resetStyle();

  addSection("Receipt-style preview");
  addBytes(ESC_ALIGN_CENTER);
  addBytes(ESC_BOLD_ON);
  addBytes([0x1b, 0x21, 0x30]);
  addText("TAX INVOICE\n");
  addBytes([0x1b, 0x21, 0x00]);
  addBytes(ESC_BOLD_OFF);
  addText(`${"=".repeat(42)}\n`);
  addBytes(ESC_BOLD_ON);
  addBytes([0x1b, 0x21, 0x30]);
  addText("Table : 24\n");
  addBytes([0x1b, 0x21, 0x00]);
  addBytes(ESC_BOLD_OFF);
  addText(`${"=".repeat(42)}\n\n`);

  resetStyle();
  addBytes(ESC_FEED_CUT);
  addBytes(GS_CUT);

  return commandsToBase64(commands);
}
