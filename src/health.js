import { searchAcrossSites } from "./app.js";
import { getSite, getSiteKeysForAllSearch } from "./sites.js";

const DEFAULT_HEALTH_QUERY = "iphone 15 pro";

function getSourceMetadata(siteKey) {
  try {
    const site = getSite(siteKey);
    return {
      niches: site.niches || [],
      integrationStatus: site.integrationStatus || "experimental"
    };
  } catch {
    return { niches: [], integrationStatus: "experimental" };
  }
}

export async function runMarketplaceHealthChecks({
  query = DEFAULT_HEALTH_QUERY,
  provider = "auto",
  siteKeys = getSiteKeysForAllSearch(query),
  limit = 20,
  maxPages = 1
} = {}) {
  const startedAt = Date.now();
  const payload = await searchAcrossSites({ query, provider, limit, maxPages, siteKeys });

  return {
    checkedAt: new Date().toISOString(),
    query,
    durationMs: Date.now() - startedAt,
    summary: {
      marketplaces: payload.summary?.marketplaces ?? payload.results?.length ?? 0,
      successfulMarketplaces: payload.summary?.successfulMarketplaces ?? 0,
      blockedMarketplaces: payload.summary?.blockedMarketplaces || [],
      failedMarketplaces: payload.summary?.failedMarketplaces || [],
      parsedListings: payload.summary?.parsedListings ?? 0,
      includedListings: payload.summary?.includedListings ?? payload.summary?.totalListings ?? 0,
      excludedListings: payload.summary?.excludedListings ?? 0
    },
    sources: (payload.results || []).map((result) => ({
      site: result.site,
      ...getSourceMetadata(result.site),
      ok: Boolean(result.ok),
      provider: result.provider,
      parsedItemCount: result.parsedItemCount ?? result.rawItemCount ?? 0,
      includedItemCount: result.includedItemCount ?? result.itemCount ?? 0,
      excludedItemCount: result.excludedItemCount ?? 0,
      blocked: !result.ok && /cloudflare challenge|anti-bot|blocked/i.test(result.error || ""),
      error: result.ok ? "" : result.error || "Marketplace search failed."
    }))
  };
}
