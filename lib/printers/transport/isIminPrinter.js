/**
 * iMin built-in printer (Swan 2 and other SDK 2.0 terminals).
 * Missing / other connectionType → false.
 */
export function isIminPrinter(printer) {
  return printer?.connectionType === "imin";
}
