import { removeVietnameseDiacritics } from "@/lib/helper/printerUtils";

function normalizeQuery(query) {
  return removeVietnameseDiacritics((query || "").trim().toLowerCase());
}

function normalizeText(text) {
  return removeVietnameseDiacritics((text || "").toLowerCase());
}

function stripParentheticals(text) {
  let result = text || "";
  let prev;
  do {
    prev = result;
    result = result.replace(/\([^()]*\)/g, " ");
  } while (result !== prev);
  return result.replace(/\s+/g, " ").trim();
}

/** First letter of each word (after stripping parentheticals). */
function getWordInitialsArray(text) {
  return stripParentheticals(text)
    .split(/[\s\-_/]+/)
    .filter(Boolean)
    .map((word) => normalizeText(word)[0])
    .filter(Boolean);
}

/**
 * Query must match a consecutive run of word initials (no skipping words).
 * e.g. "Combo Phở Bò Đặc Biệt and Drink" → initials cpbdbad; "pbdb" matches Phở→Biệt, "pdb" does not.
 */
function matchesConsecutiveInitials(text, query) {
  if (!query || /\s/.test(query)) return false;

  const initials = getWordInitialsArray(text);
  if (initials.length === 0 || query.length === 0) return false;
  if (query.length > initials.length) return false;

  for (let start = 0; start <= initials.length - query.length; start++) {
    let matched = true;
    for (let i = 0; i < query.length; i++) {
      if (initials[start + i] !== query[i]) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }
  return false;
}

/**
 * Match search text by substring or by consecutive initials of each word
 * (e.g. "pbdb" → "Combo Phở Bò Đặc Biệt and Drink", "mcr" → "Mini Chicken Ramen").
 */
export function textMatchesAvailabilityQuery(text, query) {
  const needle = normalizeQuery(query);
  if (!needle) return false;

  const haystack = normalizeText(text);
  if (haystack.includes(needle)) return true;

  if (/\s/.test(needle)) return false;

  return matchesConsecutiveInitials(text, needle);
}
