import { getDefaultSiteKeys, getSite } from "./sites.js";
import { runSearch } from "./search.js";
import { aggregateMarketplaceResults } from "./aggregate.js";
import { buildMockSearchResult } from "./mock.js";

const MAX_CREDITS_PER_SITE = 3;
const DEFAULT_SITE_TIMEOUT_MS = 20000;

function isMockSearchEnabled() {
  return process.env.LIBERGENT_MOCK_SEARCH === "1";
}

function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timeoutId);
  });
}

function getCreditsPerPage(site, provider) {
  const resolvedProvider = provider === "auto" ? site.provider : provider;
  if (resolvedProvider !== "firecrawl") {
    return 0;
  }

  return Math.max(1, site.estimatedCreditsPerPage || 0);
}

function getMaxAffordablePages(site, provider) {
  const creditsPerPage = getCreditsPerPage(site, provider);
  const siteMaxPages = site.maxPages ?? site.defaultMaxPages ?? 1;

  if (creditsPerPage <= 0) {
    return siteMaxPages;
  }

  return Math.max(1, Math.min(siteMaxPages, Math.floor(MAX_CREDITS_PER_SITE / creditsPerPage)));
}

function getCreditBudget(siteKeys, provider) {
  return siteKeys.reduce((sum, siteKey) => {
    const site = getSite(siteKey);
    const creditsPerPage = getCreditsPerPage(site, provider);
    if (creditsPerPage <= 0) {
      return sum;
    }

    return sum + (getMaxAffordablePages(site, provider) * creditsPerPage);
  }, 0);
}

function getSiteTimeoutMs(site, pages) {
  const configuredTimeout = site.timeoutMs ?? DEFAULT_SITE_TIMEOUT_MS;
  return Math.max(
    DEFAULT_SITE_TIMEOUT_MS,
    Math.min(configuredTimeout * Math.max(1, pages), DEFAULT_SITE_TIMEOUT_MS * Math.max(1, pages))
  );
}

function getDefaultLimit(site, pages, provider) {
  if (getCreditsPerPage(site, provider) <= 0) {
    return (site.pageSize || site.defaultLimit || 20) * Math.max(1, pages);
  }

  return site.defaultLimit ?? site.pageSize ?? 20;
}

export async function searchAcrossSites({
  query,
  condition = "any",
  provider = "auto",
  limit,
  maxPages,
  siteKeys = getDefaultSiteKeys()
}) {
  const orderedSiteKeys = [...siteKeys].sort((a, b) => getSite(a).priority - getSite(b).priority);
  const rawResults = [];
  const creditBudget = getCreditBudget(orderedSiteKeys, provider);

  if (isMockSearchEnabled()) {
    return aggregateMarketplaceResults(
      orderedSiteKeys.map((siteKey) =>
        buildMockSearchResult({ siteKey, query, condition, provider: "mock" })
      ),
      {
        condition,
        creditBudget,
        creditsUsed: 0
      }
    );
  }

  for (const siteKey of orderedSiteKeys) {
    const site = getSite(siteKey);
    const resolvedProvider = provider === "auto" ? site.provider : provider;
    const affordablePages = getMaxAffordablePages(site, provider);
    const desiredPages = Math.min(maxPages ?? affordablePages, affordablePages);
    const desiredLimit = limit ?? getDefaultLimit(site, desiredPages, provider);
    const affordableLimit = Math.min(desiredLimit, (site.pageSize || desiredLimit) * desiredPages);

    try {
      const result = await withTimeout(
        runSearch({
          provider,
          site,
          query,
          limit: affordableLimit,
          maxPages: desiredPages
        }),
        getSiteTimeoutMs(site, desiredPages),
        `${site.label} a depășit timpul maxim de răspuns.`
      );
      rawResults.push({ ok: true, ...result });
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
    creditBudget,
    creditsUsed: rawResults.reduce((sum, result) => sum + (result.ok ? result.creditsUsed || 0 : 0), 0)
  });
}
