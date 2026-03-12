import { getSite, SITES } from "./sites.js";
import { runSearch } from "./search.js";
import { aggregateMarketplaceResults } from "./aggregate.js";

const MAX_CREDITS_PER_CALL = 10;

function getMinimumReservedCredits(siteKeys, provider) {
  return siteKeys.reduce((sum, siteKey) => {
    const site = getSite(siteKey);
    const resolvedProvider = provider === "auto" ? site.provider : provider;
    if (resolvedProvider !== "firecrawl") {
      return sum;
    }
    return sum + (site.estimatedCreditsPerPage || 0);
  }, 0);
}

export async function searchAcrossSites({
  query,
  condition = "any",
  provider = "auto",
  limit,
  maxPages,
  siteKeys = Object.keys(SITES)
}) {
  const orderedSiteKeys = [...siteKeys].sort((a, b) => getSite(a).priority - getSite(b).priority);
  const rawResults = [];
  let creditsRemaining = MAX_CREDITS_PER_CALL;

  for (let index = 0; index < orderedSiteKeys.length; index += 1) {
    const siteKey = orderedSiteKeys[index];
    const site = getSite(siteKey);
    const resolvedProvider = provider === "auto" ? site.provider : provider;
    const desiredPages = Math.min(maxPages ?? site.defaultMaxPages ?? 1, site.maxPages ?? 1);
    const desiredLimit = limit ?? site.defaultLimit ?? site.pageSize ?? 20;
    const creditsPerPage = resolvedProvider === "firecrawl" ? (site.estimatedCreditsPerPage || 0) : 0;
    const remainingSiteKeys = orderedSiteKeys.slice(index + 1);
    const reservedCredits = getMinimumReservedCredits(remainingSiteKeys, provider);

    if (creditsPerPage > 0 && creditsRemaining < creditsPerPage) {
      rawResults.push({
        ok: false,
        site: siteKey,
        query,
        condition,
        provider: resolvedProvider,
        error: `Omis pentru a respecta bugetul maxim de ${MAX_CREDITS_PER_CALL} credite per căutare.`
      });
      continue;
    }

    const pagesBudgetCredits = creditsPerPage > 0
      ? Math.max(creditsPerPage, creditsRemaining - reservedCredits)
      : 0;
    const affordablePages = creditsPerPage > 0
      ? Math.max(1, Math.min(desiredPages, Math.floor(pagesBudgetCredits / creditsPerPage)))
      : desiredPages;
    const affordableLimit = Math.min(desiredLimit, (site.pageSize || desiredLimit) * affordablePages);

    try {
      const result = await runSearch({
        provider,
        site,
        query,
        limit: affordableLimit,
        maxPages: affordablePages
      });
      rawResults.push({ ok: true, ...result });
      creditsRemaining -= result.creditsUsed || 0;
    } catch (error) {
      rawResults.push({
        ok: false,
        site: siteKey,
        query,
        condition,
        provider: resolvedProvider,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return aggregateMarketplaceResults(rawResults, {
    condition,
    creditBudget: MAX_CREDITS_PER_CALL,
    creditsUsed: MAX_CREDITS_PER_CALL - creditsRemaining
  });
}
