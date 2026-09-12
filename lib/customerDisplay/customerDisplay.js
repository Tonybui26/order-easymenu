/**
 * Thin wrappers around the CustomerDisplay Capacitor plugin (Android dual-screen POS).
 * Opens a WebView Presentation on the secondary display; cart updates are pushed from POS.
 */

import { CustomerDisplay } from "customer-display";
import { isAndroid, isNativeApp } from "@/lib/helper/platformDetection";
import { getCustomerDisplayName } from "@/lib/helper/printNameAlias";

export function canUseCustomerDisplay() {
  return isNativeApp() && isAndroid();
}

/**
 * After Capacitor shell → remote URL navigation, the bridge can appear a moment late.
 * Poll briefly so customer display still opens.
 */
export function waitForCustomerDisplayBridge(timeoutMs = 8000) {
  if (canUseCustomerDisplay()) return Promise.resolve(true);

  return new Promise((resolve) => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (canUseCustomerDisplay()) {
        window.clearInterval(timer);
        resolve(true);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        window.clearInterval(timer);
        resolve(false);
      }
    }, 200);
  });
}

export async function isCustomerDisplayAvailable() {
  if (!canUseCustomerDisplay()) return false;
  try {
    const result = await CustomerDisplay.isAvailable();
    return Boolean(result?.available);
  } catch {
    return false;
  }
}

function getCustomerDisplayPageUrl() {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/customer-display`;
}

/**
 * @param {{ forceReload?: boolean }} [options]
 */
export async function openCustomerDisplay(options = {}) {
  const bridgeReady = await waitForCustomerDisplayBridge();
  if (!bridgeReady) return;

  // Retry a few times — secondary display / plugin can lag after shell redirect.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const available = await isCustomerDisplayAvailable();
      if (!available) {
        await new Promise((r) => window.setTimeout(r, 300));
        continue;
      }
      const url = getCustomerDisplayPageUrl();
      if (!url) return;
      await CustomerDisplay.open({
        url,
        forceReload: Boolean(options.forceReload) || attempt > 0,
      });
      return;
    } catch {
      await new Promise((r) => window.setTimeout(r, 300));
    }
  }
}

export async function closeCustomerDisplay() {
  if (!canUseCustomerDisplay()) return;
  try {
    await CustomerDisplay.close();
  } catch {
    // ignore
  }
}

/**
 * Push a cart snapshot to the rear display. No-op when unavailable / web.
 * @param {import('customer-display/src/definitions').CustomerDisplayCartPayload} payload
 */
export async function updateCustomerDisplayCart(payload) {
  if (!canUseCustomerDisplay()) return;
  try {
    await CustomerDisplay.updateCart(payload || { mode: "idle", lines: [] });
  } catch {
    // ignore
  }
}

function formatOptionLabel(entry) {
  if (!entry) return "";
  if (typeof entry === "string") return getCustomerDisplayName(entry);
  const optionName =
    entry.optionName || entry.name || entry.title || entry.label || "";
  return getCustomerDisplayName(optionName);
}

/**
 * Build a rear-display snapshot from POS cart state.
 * @param {object} params
 * @param {Array} params.cartLines
 * @param {(line: object) => boolean} params.isPayableLine
 * @param {number} params.subtotal
 * @param {number} [params.discountAmount]
 * @param {number} params.total
 */
export function buildCustomerDisplayCartSnapshot({
  cartLines = [],
  isPayableLine = () => true,
  subtotal = 0,
  discountAmount = 0,
  total = 0,
}) {
  const lines = (cartLines || [])
    .filter((line) => isPayableLine(line))
    .map((line) => {
      const quantity = Number(line.quantity || 1);
      const unitPrice = Number(line.price || 0);
      const variants = (line.selectedVariants || [])
        .map(formatOptionLabel)
        .filter(Boolean);
      const modifiers = (line.selectedModifiers || [])
        .map(formatOptionLabel)
        .filter(Boolean);
      return {
        id: String(line.lineId || line.id || ""),
        name: getCustomerDisplayName(line.title || line.name || "Item"),
        quantity,
        unitPrice,
        lineTotal: unitPrice * quantity,
        options: [...variants, ...modifiers],
      };
    });

  if (lines.length === 0) {
    return { mode: "idle", lines: [] };
  }

  return {
    mode: "cart",
    lines,
    subtotal: Number(subtotal || 0),
    discountAmount: Number(discountAmount || 0),
    total: Number(total || 0),
  };
}
