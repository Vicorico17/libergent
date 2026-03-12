import { getSite, SITES } from "./sites.js";
import { runSearch } from "./search.js";
import { aggregateMarketplaceResults } from "./aggregate.js";

export async function searchAcrossSites({
  query,
  provider = "auto",
  limit = 20,
  maxPages = 1,
  siteKeys = Object.keys(SITES)
}) {
  const rawResults = await Promise.all(
    siteKeys.map(async (siteKey) => {
      const site = getSite(siteKey);
      try {
        const result = await runSearch({ provider, site, query, limit, maxPages });
        return { ok: true, ...result };
      } catch (error) {
        return {
          ok: false,
          site: siteKey,
          query,
          provider,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    })
  );

  return aggregateMarketplaceResults(rawResults);
}
