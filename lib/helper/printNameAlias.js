/**
 * Print-name alias helpers for `((printing name))` markers embedded in menu titles.
 *
 * - Customer/staff display: strip the marker and show the normal name.
 * - Printing: prefer the alias when present, otherwise use the original name.
 *
 * Also strips `[[Group]]` print-routing markers from customer/staff display names.
 */

import { stripPrintGroupMarker } from "@/lib/helper/printGroupMarker";

const PRINT_ALIAS_PATTERN = /\(\(([^)]*)\)\)/;

/** Docket-only: `Group ((__))` skips the `>Group:` header and prints options only. */
const SKIP_PRINT_GROUP_ALIAS = "__";

function normalizeNameInput(name) {
  if (name == null) return "";
  return String(name);
}

/**
 * Returns true when the name contains a non-empty `((...))` alias marker.
 * @param {string|null|undefined} name
 * @returns {boolean}
 */
export function hasPrintNameAlias(name) {
  const text = normalizeNameInput(name);
  const match = text.match(PRINT_ALIAS_PATTERN);
  return Boolean(match && match[1]?.trim());
}

/**
 * Removes the first valid `((...))` marker and `[[...]]` routing markers for display.
 * @param {string|null|undefined} name
 * @returns {string}
 */
export function getCustomerDisplayName(name) {
  const text = normalizeNameInput(name);
  if (!text) return text;

  const match = text.match(PRINT_ALIAS_PATTERN);
  if (!match || !match[1]?.trim()) return stripPrintGroupMarker(text);

  return stripPrintGroupMarker(
    text.replace(PRINT_ALIAS_PATTERN, "").replace(/\s+/g, " ").trim(),
  );
}

/**
 * Returns the alias inside `((...))` when present, otherwise the original name.
 * @param {string|null|undefined} name
 * @returns {string}
 */
export function getPreferredPrintName(name) {
  const text = normalizeNameInput(name);
  if (!text) return text;

  const match = text.match(PRINT_ALIAS_PATTERN);
  if (!match || !match[1]?.trim()) return text;

  return match[1].trim();
}

/**
 * True when a group label uses `((__))` to omit the group header on kitchen dockets.
 * Customer/staff display still shows the normal group name (e.g. "Size").
 * @param {string|null|undefined} name
 * @returns {boolean}
 */
export function shouldSkipPrintGroupHeader(name) {
  const text = normalizeNameInput(name);
  const match = text.match(PRINT_ALIAS_PATTERN);
  if (!match) return false;
  return match[1]?.trim() === SKIP_PRINT_GROUP_ALIAS;
}
