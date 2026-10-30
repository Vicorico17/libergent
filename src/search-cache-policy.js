// Failed sources and interrupted pagination must recover sooner than complete
// snapshots. Empty or malformed responses should never become cached results.
export function searchCacheLifetimeSeconds(payload) {
  const results = payload?.results;
  if (!Array.isArray(results) || !results.length) return 0;
  if (results.some(result => !result || typeof result.ok !== 'boolean'
    || (result.ok && !Array.isArray(result.items)))) return 0;
  if (!results.some(result => result.ok && result.items.length)) return 0;
  return results.some(result => !result.ok || result.pageError || result.exhaustedReason === 'page-error') ? 60 : 300;
}

export function isSearchCacheFresh(payload, storedAt, now = Date.now()) {
  if (!storedAt) return false;
  const timestamp = Number(storedAt);
  const lifetime = searchCacheLifetimeSeconds(payload);
  return lifetime > 0 && Number.isFinite(timestamp) && timestamp > 0
    && now >= timestamp && now - timestamp < lifetime * 1000;
}
