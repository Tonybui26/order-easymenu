/**
 * Print-group markers for variant/modifier group names: `[[Drink]]`, `[[food]]`, etc.
 *
 * Used in admin menu config on modifier/variant group titles. The marker is stripped
 * for customer/staff display and drives per-printer routing in order-easymenu.
 */

import { DEFAULT_ITEM_GROUPS } from "@/lib/constants/itemGroups";

const PRINT_GROUP_MARKER_PATTERN = /\[\[([^\]]+)\]\]/;

function normalizeNameInput(name) {
  if (name == null) return "";
  return String(name);
}

/**
 * @param {string|null|undefined} name
 * @returns {{ marker: string, displayName: string } | null}
 */
export function parsePrintGroupMarker(name) {
  const text = normalizeNameInput(name);
  const match = text.match(PRINT_GROUP_MARKER_PATTERN);
  if (!match) return null;

  const marker = match[1]?.trim();
  if (!marker) return null;

  return {
    marker,
    displayName: text
      .replace(PRINT_GROUP_MARKER_PATTERN, "")
      .replace(/\s+/g, " ")
      .trim(),
  };
}

/**
 * Resolve `[[Drink]]` / `[[food]]` to canonical menu group id (food, drink, misc).
 * @param {string} marker
 * @param {Array<{ id?: string, name?: string }>|null|undefined} [itemGroups]
 * @returns {string|null}
 */
export function resolvePrintGroupId(marker, itemGroups) {
  const normalized = String(marker ?? "").trim().toLowerCase();
  if (!normalized) return null;

  for (const group of DEFAULT_ITEM_GROUPS) {
    if (
      group.id.toLowerCase() === normalized ||
      group.name.toLowerCase() === normalized
    ) {
      return group.id;
    }
  }

  if (Array.isArray(itemGroups)) {
    for (const group of itemGroups) {
      if (!group?.id) continue;
      if (
        group.id.toLowerCase() === normalized ||
        String(group.name ?? "")
          .trim()
          .toLowerCase() === normalized
      ) {
        return group.id;
      }
    }
  }

  return normalized;
}

/**
 * Remove `[[...]]` markers from names shown to customers/staff.
 * @param {string|null|undefined} name
 * @returns {string}
 */
export function stripPrintGroupMarker(name) {
  const text = normalizeNameInput(name);
  if (!text) return text;
  return text.replace(/\[\[[^\]]+\]\]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * @param {string|null|undefined} name
 * @returns {boolean}
 */
export function hasPrintGroupMarker(name) {
  return Boolean(parsePrintGroupMarker(name));
}
