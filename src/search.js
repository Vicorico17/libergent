import { buildListingSchema } from "./schema.js";
import { crawlWithCloudflare, scrapeWithCloudflare } from "./providers/cloudflare.js";
import { scrapeMarkdownWithFirecrawl, scrapeWithFirecrawl } from "./providers/firecrawl.js";
import { parseOlxHtml, parseOlxMarkdown } from "./parsers/olx.js";
import { parseLajumateHtml } from "./parsers/lajumate.js";
import { parseOkaziiHtml } from "./parsers/okazii.js";
import { parsePubli24Html } from "./parsers/publi24.js";
import { parseVintedHtml, parseVintedMarkdown } from "./parsers/vinted.js";
import { parseAutovitHtml } from "./parsers/autovit.js";
import { getQueryBrandTerms } from "./relevance.js";
import { buildAbortSignal } from "./abort.js";
import { normalizeMarketplaceQuery } from "./query-normalization.js";
import { normalizeSearchProvider } from "./provider-options.js";

const DESKTOP_BROWSER_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const MOBILE_BROWSER_USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

function tokenize(value = "") {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function tokenDistanceAtMostOne(a, b) {
  if (!a || !b) {
    return false;
  }

  if (a === b) {
    return true;
  }

  if (Math.abs(a.length - b.length) > 1) {
    return false;
  }

  let i = 0;
  let j = 0;
  let edits = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }

    edits += 1;
    if (edits > 1) {
      return false;
    }

    if (a.length > b.length) {
      i += 1;
    } else if (a.length < b.length) {
      j += 1;
    } else {
      i += 1;
      j += 1;
    }
  }

  if (i < a.length || j < b.length) {
    edits += 1;
  }

  return edits <= 1;
}

function tokenMatchesQueryToken(titleTokens, queryToken) {
  if (!queryToken) {
    return false;
  }

  for (const titleToken of titleTokens) {
    if (titleToken === queryToken) {
      return true;
    }

    if (queryToken.length >= 4 && titleToken.startsWith(queryToken)) {
      return true;
    }

    if (queryToken.length >= 5 && titleToken.length >= 5 && tokenDistanceAtMostOne(titleToken, queryToken)) {
      return true;
    }
  }

  return false;
}

function filterRelevantItems(items, query) {
  const queryTokens = tokenize(query).filter((token) => token.length > 1 || /^\d+$/.test(token));
  const brandTokens = getQueryBrandTerms(query);
  if (!queryTokens.length) {
    return items;
  }

  if (queryTokens.length === 1) {
    const [singleToken] = queryTokens;
    return items.filter((item) => {
      const titleTokens = tokenize(item.title || "");
      return tokenMatchesQueryToken(titleTokens, singleToken);
    });
  }

  const requiredNumberTokens = queryTokens.filter((token) => /^\d+$/.test(token));
  return items.filter((item) => {
    const titleTokens = tokenize(item.title || "");
    if (requiredNumberTokens.some((token) => !titleTokens.includes(token))) {
      return false;
    }

    const matchedTokens = queryTokens.filter((token) => tokenMatchesQueryToken(titleTokens, token)).length;
    const matchedBrands = brandTokens.filter((token) => tokenMatchesQueryToken(titleTokens, token)).length;
    const weightedMatches = matchedTokens + (matchedBrands ? 1.5 : 0);
    const weightedRequired = queryTokens.length + (brandTokens.length ? 1.5 : 0);
    return weightedMatches / weightedRequired >= 0.5;
  });
}

function getDirectFetchHeaderProfiles(url) {
  const origin = new URL(url).origin;
  const commonHeaders = {
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "accept-language": "ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7",
    "cache-control": "no-cache",
    pragma: "no-cache",
    "upgrade-insecure-requests": "1"
  };

  return [
    {
      ...commonHeaders,
      "user-agent": DESKTOP_BROWSER_USER_AGENT,
      referer: `${origin}/`,
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "same-origin",
      "sec-fetch-user": "?1"
    },
    {
      ...commonHeaders,
      "user-agent": MOBILE_BROWSER_USER_AGENT,
      referer: "https://www.google.com/",
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "cross-site",
      "sec-fetch-user": "?1"
    }
  ];
}

function shouldRetryDirectFetchStatus(status) {
  return [403, 406, 408, 425, 429, 500, 502, 503, 504].includes(status);
}

async function fetchHtmlDirect({ url, timeoutMs = 15000, signal }) {
  const headerProfiles = getDirectFetchHeaderProfiles(url);
  let lastError = null;

  for (const [index, headers] of headerProfiles.entries()) {
    let response;
    try {
      response = await fetch(url, {
        signal: buildAbortSignal({ timeoutMs, signal }),
        headers,
        redirect: "follow"
      });
    } catch (error) {
      lastError = error;
      if (signal?.aborted || index === headerProfiles.length - 1) {
        throw error;
      }
      continue;
    }

    if (response.ok) {
      return response.text();
    }

    lastError = new Error(`Direct fetch failed (${response.status}) for ${url}`);
    if (!shouldRetryDirectFetchStatus(response.status) || index === headerProfiles.length - 1) {
      throw lastError;
    }
  }

  throw lastError || new Error(`Direct fetch failed for ${url}`);
}

function dedupeItems(items) {
  const seen = new Set();
  const output = [];

  for (const item of items) {
    const key = item.url || `${item.title}::${item.price}::${item.location}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(item);
  }

  return output;
}

function getRawItemCount(parsed, items) {
  return Number.isFinite(parsed.rawItemCount) ? parsed.rawItemCount : items.length;
}

function resolveProvider(provider, site) {
  const normalizedProvider = normalizeSearchProvider(provider);
  return normalizedProvider === "auto"
    ? normalizeSearchProvider(site.provider || "direct")
    : normalizedProvider;
}

function extractCloudflareCrawlItems(raw) {
  if (Array.isArray(raw?.items)) {
    return raw.items;
  }

  const pages = Array.isArray(raw?.pages) ? raw.pages : Array.isArray(raw?.data) ? raw.data : [];
  return pages.flatMap((page) => {
    if (Array.isArray(page?.json?.items)) {
      return page.json.items;
    }
    if (Array.isArray(page?.result?.items)) {
      return page.result.items;
    }
    return [];
  });
}

async function runSinglePageSearch({ provider, site, query, limit, page, signal }) {
  const url = typeof site.pagedSearchUrl === "function" ? site.pagedSearchUrl(query, page) : site.searchUrl(query);
  const schema = buildListingSchema(limit);
  const prompt = site.prompt(query, limit);
  const resolvedProvider = resolveProvider(provider, site);

  let raw;
  let items;
  let totalResults = null;
  let rawItemCount = 0;
  let hasNextPage = null;

  if (resolvedProvider === "direct") {
    if (site.strategy !== "direct-html-local") {
      throw new Error(`Direct provider is not configured for ${site.key}`);
    }

    raw = await fetchHtmlDirect({ url, timeoutMs: site.timeoutMs, signal });

    if (site.key === "lajumate.ro") {
      const parsed = parseLajumateHtml(raw, limit);
      items = parsed.items;
      totalResults = parsed.totalResults;
      rawItemCount = getRawItemCount(parsed, items);
      hasNextPage = parsed.hasNextPage ?? null;
    } else if (site.key === "okazii.ro") {
      const parsed = parseOkaziiHtml(raw, limit);
      items = parsed.items;
      totalResults = parsed.totalResults;
      rawItemCount = getRawItemCount(parsed, items);
      hasNextPage = parsed.hasNextPage ?? null;
    } else if (site.key === "olx.ro") {
      const parsed = parseOlxHtml(raw, limit);
      items = parsed.items;
      totalResults = parsed.totalResults;
      rawItemCount = getRawItemCount(parsed, items);
      hasNextPage = parsed.hasNextPage ?? null;
    } else if (site.key === "vinted.ro") {
      const parsed = parseVintedHtml(raw, limit);
      items = parsed.items;
      totalResults = parsed.totalResults;
      rawItemCount = getRawItemCount(parsed, items);
      hasNextPage = parsed.hasNextPage ?? null;
    } else if (site.key === "publi24.ro") {
      const parsed = parsePubli24Html(raw, limit);
      items = parsed.items;
      totalResults = parsed.totalResults;
      rawItemCount = getRawItemCount(parsed, items);
      hasNextPage = parsed.hasNextPage ?? null;
    } else if (site.key === "autovit.ro") {
      const parsed = parseAutovitHtml(raw, limit);
      items = parsed.items;
      totalResults = parsed.totalResults;
      rawItemCount = getRawItemCount(parsed, items);
      hasNextPage = parsed.hasNextPage ?? null;
    } else {
      throw new Error(`No direct HTML parser configured for ${site.key}`);
    }
  } else if (resolvedProvider === "cloudflare" && site.strategy === "crawl-seed") {
    raw = await crawlWithCloudflare({
      crawlConfig: site.crawlConfig(query),
      schema,
      timeoutMs: site.timeoutMs,
      signal
    });
    items = extractCloudflareCrawlItems(raw);
  } else if (resolvedProvider === "cloudflare") {
    raw = await scrapeWithCloudflare({ url, prompt, schema, timeoutMs: site.timeoutMs, signal });
    items = Array.isArray(raw?.items) ? raw.items : [];
  } else if (resolvedProvider === "firecrawl" && site.strategy === "firecrawl-markdown-local") {
    raw = await scrapeMarkdownWithFirecrawl({
      url,
      waitForMs: site.waitForMs,
      timeoutMs: site.timeoutMs,
      signal
    });
    const parser = site.key === "vinted.ro" ? parseVintedMarkdown : parseOlxMarkdown;
    const parsed = parser(raw?.markdown || "", limit);
    items = parsed.items;
    totalResults = parsed.totalResults;
    rawItemCount = getRawItemCount(parsed, items);
    hasNextPage = parsed.hasNextPage ?? null;
  } else if (resolvedProvider === "firecrawl") {
    raw = await scrapeWithFirecrawl({
      url,
      prompt,
      schema,
      waitForMs: site.waitForMs,
      timeoutMs: site.timeoutMs,
      signal
    });
    items = Array.isArray(raw?.items) ? raw.items : [];
  } else {
    throw new Error(`Unsupported provider "${resolvedProvider}"`);
  }

  const unfilteredItems = items;
  items = site.disableQueryFilter ? items : filterRelevantItems(items, query);
  if (site.key === "autovit.ro" && items.length === 0 && unfilteredItems.length > 0) {
    items = unfilteredItems.slice(0, limit);
  }
  rawItemCount = rawItemCount || unfilteredItems.length || items.length;

  return {
    provider: resolvedProvider,
    strategy: site.strategy,
    site: site.key,
    url,
    query,
    itemCount: items.length,
    rawItemCount,
    items,
    totalResults,
    hasNextPage
  };
}

function estimateTotalPages(firstPage, pageSize, effectiveLimit) {
  if (firstPage.totalResults) {
    return Math.ceil(firstPage.totalResults / Math.max(pageSize, firstPage.rawItemCount || firstPage.itemCount || 1, 1));
  }

  return Math.ceil(effectiveLimit / pageSize);
}

function shouldStopAfterPage(pageResult, nextItems, currentItems, pageSize) {
  if (pageResult.hasNextPage === false) {
    return true;
  }

  if ((pageResult.rawItemCount || 0) === 0) {
    return true;
  }

  if (nextItems.length === currentItems.length && pageResult.hasNextPage !== true) {
    return true;
  }

  if (pageResult.hasNextPage === true) {
    return false;
  }

  return (pageResult.rawItemCount || pageResult.itemCount) < Math.max(5, Math.floor(pageSize / 3));
}

export async function runSearch({ provider, site, query, limit, maxPages, signal }) {
  const marketplaceQuery = normalizeMarketplaceQuery(query);
  const requestedProvider = normalizeSearchProvider(provider);

  if (site.strategy === "crawl-seed") {
    const result = await runSinglePageSearch({ provider: requestedProvider, site, query: marketplaceQuery, limit, page: 1, signal });
    return {
      ...result,
      pagesUsed: 1,
      creditsUsed: site.estimatedCreditsPerPage || 0
    };
  }

  const effectiveLimit = limit ?? site.defaultLimit ?? 120;
  const pageSize = site.pageSize || Math.max(10, Math.min(effectiveLimit, 50));
  const cappedMaxPages = Math.min(maxPages ?? site.defaultMaxPages ?? site.maxPages ?? 1, site.maxPages ?? 1);

  const firstPage = await runSinglePageSearch({
    provider: requestedProvider,
    site,
    query: marketplaceQuery,
    limit: Math.min(pageSize, effectiveLimit),
    page: 1,
    signal
  });

  const results = [firstPage];
  let items = dedupeItems(firstPage.items);
  let exhaustedReason = firstPage.rawItemCount === 0 ? "empty-first-page" : "limit";
  let pageError = null;
  const estimatedTotalPages = estimateTotalPages(firstPage, pageSize, effectiveLimit);
  const targetPages = Math.max(1, Math.min(cappedMaxPages, estimatedTotalPages));

  for (let page = 2; page <= targetPages; page += 1) {
    if (items.length >= effectiveLimit) {
      exhaustedReason = "limit";
      break;
    }

    let pageResult;
    try {
      pageResult = await runSinglePageSearch({
        provider: requestedProvider,
        site,
        query: marketplaceQuery,
        limit: Math.min(pageSize, effectiveLimit),
        page,
        signal
      });
    } catch (error) {
      pageError = error instanceof Error ? error.message : String(error);
      exhaustedReason = "page-error";
      break;
    }

    results.push(pageResult);
    const nextItems = dedupeItems([...items, ...pageResult.items]);
    if (shouldStopAfterPage(pageResult, nextItems, items, pageSize)) {
      exhaustedReason =
        pageResult.hasNextPage === false ? "no-next-page" :
        (pageResult.rawItemCount || 0) === 0 ? "empty-page" :
        nextItems.length === items.length ? "no-new-listings" :
        "short-page";
      items = nextItems;
      break;
    }

    items = nextItems;
    exhaustedReason = page >= targetPages ? "page-window" : exhaustedReason;
  }

  items = items.slice(0, effectiveLimit);
  if (items.length >= effectiveLimit) {
    exhaustedReason = "limit";
  } else if (results.length >= targetPages && exhaustedReason === "limit") {
    exhaustedReason = targetPages >= estimatedTotalPages ? "estimated-total" : "page-window";
  }

  return {
    provider: results[0]?.provider ?? resolveProvider(requestedProvider, site),
    strategy: `${site.strategy}:${results.length}-pages`,
    site: site.key,
    url: site.searchUrl(marketplaceQuery),
    query: marketplaceQuery,
    itemCount: items.length,
    rawItemCount: results.reduce((sum, result) => sum + (
      Number.isFinite(result.rawItemCount) ? result.rawItemCount : result.itemCount || 0
    ), 0),
    items,
    totalResults: results[0]?.totalResults ?? null,
    pagesUsed: results.length,
    pagesTargeted: targetPages,
    exhaustedReason,
    pageError,
    creditsUsed: results.length * (site.estimatedCreditsPerPage || 0)
  };
}

export const __testables = {
  tokenize,
  filterRelevantItems
};
