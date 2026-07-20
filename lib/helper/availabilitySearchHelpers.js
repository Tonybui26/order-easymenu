function normalizeQuery(query) {
  return (query || "").trim().toLowerCase();
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

function getWordInitials(text) {
  return stripParentheticals(text)
    .toLowerCase()
    .split(/[\s\-_/]+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("");
}

function isSubsequence(needle, haystack) {
  if (!needle) return false;
  let index = 0;
  for (let i = 0; i < haystack.length && index < needle.length; i++) {
    if (haystack[i] === needle[index]) index++;
  }
  return index === needle.length;
}

function matchesInitials(text, query) {
  if (!query || /\s/.test(query)) return false;
  const initials = getWordInitials(text);
  return initials.length > 0 && isSubsequence(query, initials);
}

/**
 * Match search text by substring or by initials of each word
 * (e.g. "mcr" → "Mini Chicken Ramen", "wg" → "Wok-Fried Greens((Rau Xao))").
 */
export function textMatchesAvailabilityQuery(text, query) {
  const needle = normalizeQuery(query);
  if (!needle) return false;

  const haystack = (text || "").toLowerCase();
  if (haystack.includes(needle)) return true;

  return matchesInitials(text, needle);
}
