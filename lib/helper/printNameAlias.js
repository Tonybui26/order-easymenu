/**
 * Print-name alias helpers for `((printing name))` markers embedded in menu titles.
 *
 * - Customer/staff display: strip the marker and show the normal name.
 * - Printing: prefer the alias when present, otherwise use the original name.
 */

const PRINT_ALIAS_PATTERN = /\(\(([^)]*)\)\)/;

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
 * Removes the first valid `((...))` marker for customer/staff display.
 * @param {string|null|undefined} name
 * @returns {string}
 */
export function getCustomerDisplayName(name) {
  const text = normalizeNameInput(name);
  if (!text) return text;

  const match = text.match(PRINT_ALIAS_PATTERN);
  if (!match || !match[1]?.trim()) return text;

  return text.replace(PRINT_ALIAS_PATTERN, "").replace(/\s+/g, " ").trim();
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
