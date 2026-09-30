// Match whole words so product names containing the same letters remain searchable.
const OFFENSIVE_WORDS = new Set([
  "muie", "pula", "pizda", "cacat", "curva",
  "fuck", "fucking", "fucker", "shit", "bitch", "cunt",
  "nigger", "nigga", "faggot", "jidan"
]);

export const SEARCH_QUERY_REJECTION_MESSAGE = "Caută un produs fără limbaj ofensator sau date personale.";
export const SEARCH_QUERY_LENGTH_MESSAGE = "Căutarea poate avea cel mult 120 de caractere.";

function normalizedWords(query) {
  const words = String(query || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .match(/[a-z0-9]+/g) || [];
  const joined = [];
  for (let index = 0; index < words.length;) {
    if (words[index].length !== 1) {
      index += 1;
      continue;
    }
    let end = index;
    while (end < words.length && words[end].length === 1) end += 1;
    if (end - index >= 3) joined.push(words.slice(index, end).join(""));
    index = end;
  }
  return [...words, ...joined];
}

function containsPersonalData(query) {
  const value = String(query || "");
  if (/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(value)) return true;
  if (/https?:\/\/|www\./i.test(value)) return true;
  const compact = value.replace(/[\s().-]/g, "");
  return /(?:^|\D)(?:\+40|0040|0)7\d{8}(?:\D|$)/.test(compact);
}

export function getSearchQueryError(query) {
  const value = String(query || "").trim();
  if (!value) return null;
  if (value.length > 120) return SEARCH_QUERY_LENGTH_MESSAGE;
  if (containsPersonalData(value) || normalizedWords(value).some((word) => OFFENSIVE_WORDS.has(word))) {
    return SEARCH_QUERY_REJECTION_MESSAGE;
  }
  return null;
}

export function isPublicSearchQuery(query) {
  return Boolean(String(query || "").trim()) && !getSearchQueryError(query);
}
