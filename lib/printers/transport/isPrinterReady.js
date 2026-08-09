import { isUsbPrinter } from "./isUsbPrinter";

/**
 * Whether a printer has enough connection fields to attempt a print job.
 * Network (default): localIp + port — same rule as before.
 * USB: connectionType === "usb" (device is auto-detected on Android at print time).
 */
export function isPrinterReady(printer) {
  if (!printer) return false;

  if (isUsbPrinter(printer)) {
    return true;
  }

  return Boolean(printer.localIp && printer.port);
}

/**
 * Human-readable endpoint for logs / UI (IP:port or USB).
 */
export function getPrinterEndpointLabel(printer) {
  if (isUsbPrinter(printer)) {
    return "USB (auto)";
  }
  return `${printer?.localIp || "?"}:${printer?.port ?? 9100}`;
}
