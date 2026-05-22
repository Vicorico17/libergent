import { getDefaultSiteKeys, getSite } from "./sites.js";
import { runSearch } from "./search.js";
import { aggregateMarketplaceResults } from "./aggregate.js";
import { buildMockSearchResult } from "./mock.js";

const MAX_CREDITS_PER_SITE = 3;
const DEFAULT_SITE_TIMEOUT_MS = 20000;
const SERVERLESS_MAX_RESULTS_PER_SITE = 500;
const SERVERLESS_SITE_TIMEOUT_MS = 30000;
const SITE_SEARCH_ATTEMPTS = 2;
const SITE_RETRY_DELAY_MS = 300;
const SITE_SEARCH_CONCURRENCY = 3;

function isServerlessRuntime() {
  return Boolean(
    process.env.VERCEL ||
    process.env.CF_PAGES ||
    process.env.LIBERGENT_RUNTIME === "cloudflare-worker"
  );
}

function isMockSearchEnabled() {
  return process.env.LIBERGENT_MOCK_SEARCH === "1";
}

function normalizeProvider(provider) {
  return provider === "auto" ? "auto" : "direct";
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(operation, timeoutMs, message) {
  const controller = new AbortController();
  let timeoutId;

  timeoutId = setTimeout(() => {
    controller.abort(new Error(message));
  }, timeoutMs);

  return operation(controller.signal).catch((error) => {
    if (controller.signal.aborted) {
      throw new Error(message);
    }
    throw error;
  }).finally(() => {
    clearTimeout(timeoutId);
  });
}

function buildSiteFailureResult({ siteKey, query, condition, provider, error, attempts = 1 }) {
  const requestedProvider = provider || "direct";
  let resolvedProvider = requestedProvider === "auto" ? "auto" : requestedProvider;
  try {
    const site = getSite(siteKey);
    resolvedProvider = requestedProvider === "auto" ? site.provider : resolvedProvider;
  } catch {
    // Keep the normalized request provider for invalid site keys.
  }

  return {
    ok: false,
    site: siteKey,
    query,
    condition,
    provider: resolvedProvider,
    attempts,
    error: error instanceof Error ? error.message : String(error)
  };
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
  if (isServerlessRuntime()) {
    return Math.min(configuredTimeout * Math.max(1, pages), SERVERLESS_SITE_TIMEOUT_MS);
  }

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

async function searchSiteOnce({ siteKey, query, condition, provider, limit, maxPages, attempt }) {
  let site;
  let searchProvider = normalizeProvider(provider);
  let resolvedProvider = searchProvider;

  try {
    site = getSite(siteKey);
    resolvedProvider = searchProvider === "auto" ? site.provider : searchProvider;
    const affordablePages = getMaxAffordablePages(site, searchProvider);
    const desiredPages = Math.min(maxPages ?? affordablePages, affordablePages);
    const runtimeMaxResults = isServerlessRuntime()
      ? Math.min((site.pageSize || SERVERLESS_MAX_RESULTS_PER_SITE) * desiredPages, SERVERLESS_MAX_RESULTS_PER_SITE)
      : Number.POSITIVE_INFINITY;
    const desiredLimit = Math.min(limit ?? getDefaultLimit(site, desiredPages, searchProvider), runtimeMaxResults);
    const affordableLimit = Math.min(desiredLimit, (site.pageSize || desiredLimit) * desiredPages);
    const result = await withTimeout(
      (signal) => runSearch({
        provider: searchProvider,
        site,
        query,
        limit: affordableLimit,
        maxPages: desiredPages,
        signal
      }),
      getSiteTimeoutMs(site, desiredPages),
      `${site.label} a depășit timpul maxim de răspuns.`
    );
    return { ok: true, attempts: attempt, ...result };
  } catch (error) {
    return buildSiteFailureResult({
      siteKey,
      query,
      condition,
      provider: resolvedProvider,
      attempts: attempt,
      error
    });
  }
}

function isRetryableResult(result) {
  if (!result.ok) {
    return !/Missing environment variables|Unsupported site/i.test(result.error || "");
  }

  return result.itemCount === 0 && (result.rawItemCount || 0) === 0 && result.totalResults !== 0;
}

async function searchSite({ siteKey, query, condition, provider, limit, maxPages }) {
  const errors = [];

  for (let attempt = 1; attempt <= SITE_SEARCH_ATTEMPTS; attempt += 1) {
    const result = await searchSiteOnce({ siteKey, query, condition, provider, limit, maxPages, attempt });

    if (!isRetryableResult(result) || attempt === SITE_SEARCH_ATTEMPTS) {
      return errors.length ? { ...result, previousErrors: errors } : result;
    }

    if (!result.ok) {
      errors.push(result.error);
    } else {
      errors.push("empty response");
    }

    await delay(SITE_RETRY_DELAY_MS * attempt);
  }

  return buildSiteFailureResult({
    siteKey,
    query,
    condition,
    provider,
    attempts: SITE_SEARCH_ATTEMPTS,
    error: "Marketplace search did not complete."
  });
}

async function settleWithConcurrency(items, concurrency, mapper) {
  const settled = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;

      try {
        settled[index] = { status: "fulfilled", value: await mapper(items[index], index) };
      } catch (reason) {
        settled[index] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return settled;
}

async function searchAllRequestedSites({ orderedSiteKeys, query, condition, provider, limit, maxPages }) {
  const settled = await settleWithConcurrency(
    orderedSiteKeys,
    SITE_SEARCH_CONCURRENCY,
    (siteKey) => searchSite({ siteKey, query, condition, provider, limit, maxPages })
  );

  return settled.map((entry, index) => {
    if (entry.status === "fulfilled") {
      return entry.value;
    }

    return buildSiteFailureResult({
      siteKey: orderedSiteKeys[index],
      query,
      condition,
      provider,
      attempts: SITE_SEARCH_ATTEMPTS,
      error: entry.reason
    });
  });
}

export async function searchAcrossSites({
  query,
  condition = "any",
  provider = "auto",
  limit,
  maxPages,
  siteKeys = getDefaultSiteKeys()
}) {
  const orderedSiteKeys = [...new Set(siteKeys)].sort((a, b) => getSite(a).priority - getSite(b).priority);
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

  const rawResults = await searchAllRequestedSites({
    orderedSiteKeys,
    query,
    condition,
    provider,
    limit,
    maxPages
  });

  return aggregateMarketplaceResults(rawResults, {
    condition,
    creditBudget,
    creditsUsed: rawResults.reduce((sum, result) => sum + (result.ok ? result.creditsUsed || 0 : 0), 0)
  });
}
