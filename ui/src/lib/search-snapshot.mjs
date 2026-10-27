// Tab-local snapshots contain public search data, never credentials.
export const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const PREFIX = "libergent:search-snapshot:v1:";
const MAX_SNAPSHOTS = 5;

export function searchSnapshotKey({ userId = "", tier = "free", query = "", near = "", limit = 0, pages = 0 }) {
  return PREFIX + JSON.stringify([userId, tier, query.trim().toLocaleLowerCase("ro-RO"), near.trim().toLocaleLowerCase("ro-RO"), limit, pages]);
}

export function readSearchSnapshot(storage, key, now = Date.now()) {
  try {
    const snapshot = JSON.parse(storage.getItem(key) || "null");
    if (!snapshot || !Number.isFinite(snapshot.savedAt) || now - snapshot.savedAt >= SNAPSHOT_MAX_AGE_MS || snapshot.savedAt > now ||
        !snapshot.payload || !Array.isArray(snapshot.payload.results) || !Array.isArray(snapshot.mapped) || !Array.isArray(snapshot.exclusions)) {
      storage.removeItem(key);
      return null;
    }
    return snapshot;
  } catch { return null; }
}

export function writeSearchSnapshot(storage, key, snapshot) {
  try {
    const entries = [];
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i));
    for (const candidate of keys) {
      if (candidate?.startsWith(PREFIX) && candidate !== key) {
        const value = readSearchSnapshot(storage, candidate);
        if (value) entries.push({ key: candidate, savedAt: value.savedAt });
      }
    }
    entries.sort((a, b) => b.savedAt - a.savedAt);
    for (const entry of entries.slice(MAX_SNAPSHOTS - 1)) storage.removeItem(entry.key);
    storage.setItem(key, JSON.stringify(snapshot));
    return true;
  } catch { return false; }
}

export function describeSnapshotChange(previous, next) {
  if (!previous) return "";
  const before = new Map(previous.mapped.map(item => [item.url || item.id, item]));
  const after = new Map(next.mapped.map(item => [item.url || item.id, item]));
  const added = [...after.keys()].filter(key => !before.has(key)).length;
  const removed = [...before.keys()].filter(key => !after.has(key)).length;
  const repriced = [...after].filter(([key, item]) => before.has(key) && before.get(key).price !== item.price).length;
  const oldBest = previous.payload.summary?.bestUsedOffer?.url || "";
  const newBest = next.payload.summary?.bestUsedOffer?.url || "";
  const coverage = next.payload.results.filter(result => !result.ok).map(result => result.site);
  return `${added} oferte noi, ${removed} oferte lipsă din această verificare, ${repriced} prețuri schimbate. ${oldBest === newBest ? "Recomandarea principală s-a păstrat." : "Recomandarea s-a schimbat în urma recalculării pe ofertele și prețurile disponibile."}${coverage.length ? ` Surse fără răspuns: ${coverage.join(", ")}. Ofertele lipsă nu sunt neapărat vândute.` : ""}`;
}
