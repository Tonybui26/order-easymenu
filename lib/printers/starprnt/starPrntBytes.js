/** StarPRNT command bytes for mC-Print3 and compatible Star receipt printers. */

export const STAR_PRNT = {
  INIT: [0x1b, 0x40],
  ALIGN_LEFT: [0x1b, 0x1d, 0x61, 0x00],
  ALIGN_CENTER: [0x1b, 0x1d, 0x61, 0x01],
  BOLD_ON: [0x1b, 0x45, 0x01],
  BOLD_OFF: [0x1b, 0x45, 0x00],
  DOUBLE_ON: [0x1b, 0x69, 0x01, 0x01],
  DOUBLE_OFF: [0x1b, 0x69, 0x00, 0x00],
  CUT_FULL: [0x1b, 0x64, 0x00],
  CUT_PARTIAL: [0x1b, 0x64, 0x01],
};

export function commandsToBase64(commands) {
  const uint8Array = new Uint8Array(commands);
  const binaryString = String.fromCharCode.apply(null, uint8Array);
  return btoa(binaryString);
}
