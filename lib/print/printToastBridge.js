let handler = null;
let enabled = false;

export function registerPrintToastHandler(showFn, { enabled: isEnabled } = {}) {
  handler = typeof showFn === "function" ? showFn : null;
  enabled = Boolean(isEnabled) && Boolean(handler);
}

export function isPrintToastBridgeEnabled() {
  return enabled && typeof handler === "function";
}

export function showPrintToast(message, type = "error", retry = null) {
  if (!isPrintToastBridgeEnabled()) return;
  handler(message, type, retry);
}
