/**
 * True when this printer is configured for Android USB transport.
 * Missing / "network" connectionType → false (existing TCP path).
 */
export function isUsbPrinter(printer) {
  return printer?.connectionType === "usb";
}
