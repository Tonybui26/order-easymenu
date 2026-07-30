import { removeVietnameseDiacritics } from "@/lib/helper/printerUtils";

function normalizeQuery(query) {
  return removeVietnameseDiacritics((query || "").trim().toLowerCase());
}

function normalizeText(text) {
  return removeVietnameseDiacritics((text || "").toLowerCase());
}

/** Words in reading order; parenthetical words are marked skippable for initials search. */
function getWordsForInitials(text) {
  const words = [];
  let depth = 0;
  let buffer = "";

  function pushBuffer(skippable) {
    for (const word of buffer.split(/[\s\-_/]+/).filter(Boolean)) {
      const initial = normalizeText(word)[0];
      if (initial) words.push({ initial, skippable });
    }
    buffer = "";
  }

  for (const char of text || "") {
    if (char === "(") {
      if (buffer.trim()) pushBuffer(depth > 0);
      depth += 1;
      continue;
    }
    if (char === ")") {
      if (depth > 0) {
        if (buffer.trim()) pushBuffer(true);
        depth -= 1;
      }
      continue;
    }
    buffer += char;
  }

  if (buffer.trim()) pushBuffer(depth > 0);

  return words;
}

/**
 * Match initials in word order. Main-title words must match consecutively;
 * parenthetical words may be skipped (e.g. "gx" → Green + Xao in "Wok-Fired Green((Rau Xao))").
 * e.g. "Combo Phở Bò Đặc Biệt and Drink" → pbdb yes, pdb no.
 */
function matchesInitials(text, query) {
  if (!query || /\s/.test(query)) return false;

  const words = getWordsForInitials(text);
  if (words.length === 0 || query.length === 0) return false;

  function search(wordIndex, queryIndex) {
    if (queryIndex === query.length) return true;
    if (wordIndex >= words.length) return false;

    if (words[wordIndex].skippable && search(wordIndex + 1, queryIndex)) {
      return true;
    }

    if (
      words[wordIndex].initial === query[queryIndex] &&
      search(wordIndex + 1, queryIndex + 1)
    ) {
      return true;
    }

    return false;
  }

  for (let start = 0; start < words.length; start++) {
    if (search(start, 0)) return true;
  }

  return false;
}

/**
 * Match search text by substring or by word initials
 * (e.g. "pbdb" → "Combo Phở Bò Đặc Biệt and Drink", "gx" → "Wok-Fired Green((Rau Xao))").
 */
export function textMatchesAvailabilityQuery(text, query) {
  const needle = normalizeQuery(query);
  if (!needle) return false;

  const haystack = normalizeText(text);
  if (haystack.includes(needle)) return true;

  if (/\s/.test(needle)) return false;

  return matchesInitials(text, needle);
}
