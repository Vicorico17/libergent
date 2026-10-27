const STORAGE_KEY = "libergent-recent-searches-v1";
const CHANGE_EVENT = "libergent-recent-searches-changed";
let memorySnapshot = "[]";
let memoryOnly = false;

export function parseRecentSearches(snapshot: string): string[] {
  try {
    const parsed: unknown = JSON.parse(snapshot);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed.filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim().replace(/\s+/g, " ").slice(0, 120))
      .filter((entry) => {
        const key = entry.toLocaleLowerCase("ro");
        if (!entry || seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 5);
  } catch {
    return [];
  }
}

export function getRecentSearchesSnapshot(): string {
  if (typeof window === "undefined") return "[]";
  if (memoryOnly) return memorySnapshot;
  try {
    return window.localStorage.getItem(STORAGE_KEY) || "[]";
  } catch {
    return memorySnapshot;
  }
}

export function getRecentSearchesServerSnapshot(): string {
  return "[]";
}

function saveRecentSearches(searches: string[]) {
  if (typeof window === "undefined") return;
  memorySnapshot = JSON.stringify(searches);
  try {
    window.localStorage.setItem(STORAGE_KEY, memorySnapshot);
    memoryOnly = false;
  } catch {
    // Searches still work when browser storage is unavailable.
    memoryOnly = true;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function rememberRecentSearch(query: string) {
  const searches = parseRecentSearches(JSON.stringify([query, ...parseRecentSearches(getRecentSearchesSnapshot())]));
  if (!query.trim()) return;
  saveRecentSearches(searches);
}

export function clearRecentSearches() {
  saveRecentSearches([]);
}

export function subscribeToRecentSearches(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}
