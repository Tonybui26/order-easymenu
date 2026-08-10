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
 * Human-readable endpoint for logs / UI (IP, IP:port, or USB).
 * Port is omitted when it matches the default printer port (9100).
 */
export function getPrinterEndpointLabel(printer) {
  if (isUsbPrinter(printer)) {
    return "USB (auto)";
  }

  const ip = printer?.localIp || "?";
  const port = Number(printer?.port);
  const DEFAULT_PORT = 9100;

  if (!Number.isFinite(port) || port === DEFAULT_PORT) {
    return ip;
  }

  return `${ip}:${port}`;
}
