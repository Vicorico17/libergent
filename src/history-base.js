export const MAX_HISTORY_ENTRIES = 500;
export const HISTORY_RECENT_LIMIT = 100;
export const HISTORY_TOP_QUERY_LIMIT = 30;
export const HISTORY_TOP_KEYWORD_LIMIT = 40;
export const HISTORY_DAILY_LIMIT = 30;

export function tokenizeQuery(query = "") {
  return query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((token) => token && token.length >= 3);
}

export function buildCountList(values, limit) {
  return [...values.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

export function buildHistoryEntry({ query, condition, provider, siteKeys, payload }) {
  return {
    query,
    condition,
    provider,
    siteKeys,
    searchedAt: payload?.summary?.searchedAt || new Date().toISOString(),
    successfulMarketplaces: payload?.summary?.successfulMarketplaces ?? 0,
    marketplaces: payload?.summary?.marketplaces ?? 0,
    totalListings: payload?.summary?.totalListings ?? 0,
    creditsUsed: payload?.summary?.creditsUsed ?? 0,
    bestOffer: payload?.summary?.bestOffer
      ? {
          title: payload.summary.bestOffer.title || "",
          site: payload.summary.bestOffer.site || "",
          priceRon: payload.summary.bestOffer.priceRon ?? null,
          url: payload.summary.bestOffer.url || ""
        }
      : null
  };
}

export function buildHistoryPayloadFromEntries(entries) {
  const queryCounts = new Map();
  const keywordCounts = new Map();
  const dailyCounts = new Map();

  for (const entry of entries) {
    const normalizedQuery = entry.query?.trim();
    if (normalizedQuery) {
      queryCounts.set(normalizedQuery, (queryCounts.get(normalizedQuery) || 0) + 1);
    }

    for (const token of tokenizeQuery(normalizedQuery)) {
      keywordCounts.set(token, (keywordCounts.get(token) || 0) + 1);
    }

    const day = String(entry.searchedAt || "").slice(0, 10);
    if (day) {
      dailyCounts.set(day, (dailyCounts.get(day) || 0) + 1);
    }
  }

  return {
    updatedAt: new Date().toISOString(),
    totals: {
      searches: entries.length,
      uniqueQueries: queryCounts.size,
      uniqueKeywords: keywordCounts.size
    },
    topQueries: buildCountList(queryCounts, HISTORY_TOP_QUERY_LIMIT),
    topKeywords: buildCountList(keywordCounts, HISTORY_TOP_KEYWORD_LIMIT),
    dailyTrend: [...dailyCounts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-HISTORY_DAILY_LIMIT)
      .map(([date, count]) => ({ date, count })),
    recentSearches: entries.slice(0, HISTORY_RECENT_LIMIT)
  };
}
