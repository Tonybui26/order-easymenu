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

export async function isCustomerDisplayAvailable() {
  if (!canUseCustomerDisplay()) return false;
  const result = await CustomerDisplay.isAvailable();
  return Boolean(result?.available);
}

function getCustomerDisplayPageUrl() {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/customer-display`;
}

export async function openCustomerDisplay() {
  if (!canUseCustomerDisplay()) return;
  const available = await isCustomerDisplayAvailable();
  if (!available) return;
  const url = getCustomerDisplayPageUrl();
  if (!url) return;
  await CustomerDisplay.open({ url });
}

export async function closeCustomerDisplay() {
  if (!canUseCustomerDisplay()) return;
  await CustomerDisplay.close();
}

/**
 * Push a cart snapshot to the rear display. No-op when unavailable / web.
 * @param {import('customer-display/src/definitions').CustomerDisplayCartPayload} payload
 */
export async function updateCustomerDisplayCart(payload) {
  if (!canUseCustomerDisplay()) return;
  await CustomerDisplay.updateCart(payload || { mode: "idle", lines: [] });
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
