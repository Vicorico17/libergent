import { fetchScrape } from "./scrape-transport.js";
import { isCollectionCandidate } from "./aggregate.js";
import { uniqueListings } from "./listing-identity.js";
import { isChallengeHtml, extractionOutcome, scrapeError } from "./scrape-outcome.js";
import { buildListingSchema } from "./schema.js";
import { crawlWithCloudflare, scrapeWithCloudflare } from "./providers/cloudflare.js";
import { scrapeMarkdownWithFirecrawl, scrapeWithFirecrawl } from "./providers/firecrawl.js";
import { parseOlxMarkdown } from "./parsers/olx.js";
import { parseVintedMarkdown } from "./parsers/vinted.js";
import { extractNichidutaCards, parseNichidutaPrices } from "./parsers/nichiduta.js";
import { parseAltexSearchJson } from "./parsers/retail.js";
import { parseSiteHtml } from "./site-html-parser.js";
import { getQueryBrandTerms } from "./relevance.js";
import { buildAbortSignal } from "./abort.js";
import { normalizeCapacityTerms, normalizeMarketplaceQuery, normalizeModelTerms } from "./query-normalization.js";
import { normalizeSearchProvider } from "./provider-options.js";

const DESKTOP_BROWSER_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const MOBILE_BROWSER_USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const VINTED_DIRECT_HTML_CACHE_SECONDS = 300;

function tokenize(value = "") {
  return normalizeCapacityTerms(normalizeModelTerms(value))
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

export function filterRelevantItems(items, query) {
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
  return [408, 425, 500, 502, 503, 504, 520, 521, 522, 523, 524].includes(status);
}

function isCloudflareChallengeResponse(response) {
  return response.headers.get("cf-mitigated")?.toLowerCase() === "challenge";
}

function buildDirectFetchError(response, url) {
  const error = new Error(isCloudflareChallengeResponse(response)
    ? `Direct fetch blocked by Cloudflare challenge (${response.status}) for ${url}`
    : `Direct fetch failed (${response.status}) for ${url}`);
  error.upstreamStatus = response.status;
  return error;
}

export function detectSearchResponseFailure(requestedUrl, finalUrl, html) {
  if (isChallengeHtml(html)) return "Search blocked by Cloudflare challenge or access denied page";
  const requested = new URL(requestedUrl);
  const final = new URL(finalUrl || requestedUrl);
  const title = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    .replace(/\s+/g, " ").trim() || "";
  const requestedHost = requested.hostname.replace(/^www\./, "");
  const finalHost = final.hostname.replace(/^www\./, "");
  if (finalHost !== requestedHost && !finalHost.endsWith(`.${requestedHost}`)) {
    return `Search redirected to another site: ${final.href}`;
  }
  if (/\/(?:page-not-found|maintenance)(?:\/|$)/i.test(final.pathname)
    || final.searchParams.get("action") === "sorry"
    || /^404\s*[-:]/i.test(title)
    || /\beste de vânzare\b/i.test(title)) {
    return `Search returned an error page: ${title || final.pathname}`;
  }
  if (requested.pathname !== "/" && final.pathname === "/" && !final.search) {
    return `Search redirected to the home page: ${final.href}`;
  }
  return "";
}

function buildDirectHtmlCacheRequest(url) {
  const targetUrl = new URL(url);
  if (targetUrl.hostname !== "vinted.ro" && targetUrl.hostname !== "www.vinted.ro") return null;
  const cacheUrl = new URL("/api/internal-cache/direct-html/v1", "https://libergent.com");
  cacheUrl.searchParams.set("url", targetUrl.toString());
  return new Request(cacheUrl, { method: "GET" });
}

async function readDirectHtmlCache(cacheRequest) {
  const cache = globalThis.caches?.default;
  if (!cache || !cacheRequest) return null;
  const response = await cache.match(cacheRequest);
  return response ? response.text() : null;
}

async function writeDirectHtmlCache(cacheRequest, html) {
  const cache = globalThis.caches?.default;
  if (!cache || !cacheRequest || !html) return;
  await cache.put(cacheRequest, new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": `public, max-age=${VINTED_DIRECT_HTML_CACHE_SECONDS}`
    }
  })).catch(() => {});
}

async function fetchHtmlDirect({ url, timeoutMs = 15000, signal, metrics }) {
  const cacheRequest = buildDirectHtmlCacheRequest(url);
  const cachedHtml = await readDirectHtmlCache(cacheRequest);
  if (cachedHtml) return cachedHtml;

  const headerProfiles = getDirectFetchHeaderProfiles(url);
  let lastError = null;

  for (const [index, headers] of headerProfiles.entries()) {
    let response;
    try {
      response = await fetchScrape(url, {
        signal: buildAbortSignal({ timeoutMs, signal }),
        metrics,
        headers,
        redirect: "follow"
      });
    } catch (error) {
      lastError = error;
      if (signal?.aborted || error?.outcome || index === headerProfiles.length - 1) {
        throw error;
      }
      continue;
    }

    if (response.ok) {
      const html = await response.text();
      const softFailure = detectSearchResponseFailure(url, response.url, html);
      if (softFailure) throw scrapeError(softFailure, isChallengeHtml(html) ? "blocked" : "invalid_response");
      return html;
    }

    lastError = buildDirectFetchError(response, url);
    if (isCloudflareChallengeResponse(response)) {
      throw lastError;
    }
    if (!shouldRetryDirectFetchStatus(response.status) || index === headerProfiles.length - 1) {
      throw lastError;
    }
  }

  throw lastError || new Error(`Direct fetch failed for ${url}`);
}

async function fetchJsonDirect({ url, refererUrl, timeoutMs = 15000, signal, metrics, body, allowLegacyJson = false }) {
  const referer = refererUrl || url;
  const origin = new URL(referer).origin;
  const response = await fetchScrape(url, {
    signal: buildAbortSignal({ timeoutMs, signal }),
        metrics,
    redirect: "follow",
    method: body ? "POST" : "GET",
    body,
    headers: {
      ...(body ? { "content-type": "application/x-www-form-urlencoded; charset=UTF-8", "x-requested-with": "XMLHttpRequest" } : {}),
      accept: "application/json, text/plain, */*",
      "accept-language": "ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7",
      "user-agent": DESKTOP_BROWSER_USER_AGENT,
      origin,
      referer,
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": new URL(url).origin === origin ? "same-origin" : "same-site"
    }
  });

  if (!response.ok) {
    const error = new Error(`Direct JSON fetch failed (${response.status}) for ${url}`);
    error.upstreamStatus = response.status;
    throw error;
  }
  if (!allowLegacyJson && !/application\/json/i.test(response.headers.get("content-type") || "")) {
    throw new Error(`Direct JSON fetch returned a non-JSON response for ${url}`);
  }
  return response.json();
}

async function fetchAndParseHtml({ site, url, limit, query, signal, metrics }) {
  const html = await fetchHtmlDirect({ url, timeoutMs: site.timeoutMs, signal, metrics });
  const parsed = parseSiteHtml({ site, html, url, limit, query });
  if (extractionOutcome(parsed) !== "parser_failure") {
    await writeDirectHtmlCache(buildDirectHtmlCacheRequest(url), html);
  }
  return parsed;
}

async function fetchNichidutaSearch({ url, limit, timeoutMs, signal, metrics }) {
  const html = await fetchHtmlDirect({ url, timeoutMs, signal, metrics });
  const cards = extractNichidutaCards(html).slice(0, 60);
  if (!cards.length) return { items: [], rawItemCount: 0, totalResults: null, hasNextPage: false };
  const body = new URLSearchParams(cards.map((card) => ["pid[]", card.id])).toString();
  const prices = await fetchJsonDirect({ url: "https://www.nichiduta.ro/ajax/load_prices",
    refererUrl: url, body, timeoutMs, signal, metrics, allowLegacyJson: true });
  return parseNichidutaPrices(cards, prices, limit);
}

const dedupeItems = uniqueListings;

function getRawItemCount(parsed, items) {
  return Number.isFinite(parsed.rawItemCount) ? parsed.rawItemCount : items.length;
}

function applySiteMetadata(items, site) {
  return items.map((item) => ({
    ...item,
    sourceType: item.sourceType || site.sourceType || "classifieds",
    condition: item.condition || site.defaultCondition || "",
    sellerType: item.sellerType || site.defaultSellerType || ""
  }));
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

async function runSinglePageSearch({ provider, site, query, limit, page, signal, metrics }) {
  const resolvedProvider = resolveProvider(provider, site);
  const url = resolvedProvider !== "direct" && typeof site.searchPageUrl === "function"
    ? site.searchPageUrl(query, page)
    : typeof site.pagedSearchUrl === "function" ? site.pagedSearchUrl(query, page) : site.searchUrl(query);
  const schema = buildListingSchema(limit);
  const prompt = site.prompt(query, limit);

  let raw;
  let items;
  let totalResults = null;
  let rawItemCount = 0;
  let hasNextPage = null;
  let outcome = "results";

  if (resolvedProvider === "direct") {
    if (!["direct-html-local", "direct-html-retail", "direct-json-retail"].includes(site.strategy)) {
      throw new Error(`Direct provider is not configured for ${site.key}`);
    }

    const parsed = site.key === "nichiduta.ro"
      ? await fetchNichidutaSearch({ url, limit, timeoutMs: site.timeoutMs, signal, metrics })
      : site.strategy === "direct-json-retail"
      ? parseAltexSearchJson(await fetchJsonDirect({
        url,
        refererUrl: typeof site.searchPageUrl === "function" ? site.searchPageUrl(query, page) : undefined,
        timeoutMs: site.timeoutMs,
        signal, metrics
      }), limit, {
        origin: new URL(typeof site.searchPageUrl === "function" ? site.searchPageUrl(query, page) : url).origin,
        sellerName: site.label,
        query
      })
      : await fetchAndParseHtml({ site, url, limit, query, signal, metrics });
    outcome = extractionOutcome(parsed);
    if (outcome === "parser_failure") throw scrapeError(`No recognizable listings or confirmed empty state for ${site.key}`, outcome);
    items = parsed.items;
    totalResults = parsed.totalResults;
    rawItemCount = getRawItemCount(parsed, items);
    hasNextPage = parsed.hasNextPage;
  } else if (resolvedProvider === "cloudflare" && site.strategy === "crawl-seed") {
    raw = await crawlWithCloudflare({
      crawlConfig: site.crawlConfig(query),
      schema,
      timeoutMs: site.timeoutMs,
      signal
    });
    items = extractCloudflareCrawlItems(raw);
  } else if (resolvedProvider === "cloudflare") {
    raw = await scrapeWithCloudflare({ url, prompt, schema, timeoutMs: site.timeoutMs, signal, metrics });
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

  items = applySiteMetadata(items, site);
  const unfilteredItems = items;
  items = site.disableQueryFilter ? items : filterRelevantItems(items, query);
  if (site.key === "autovit.ro" && items.length === 0 && unfilteredItems.length > 0) {
    items = unfilteredItems.slice(0, limit);
  }
  rawItemCount = rawItemCount || unfilteredItems.length || items.length;

  return {
    outcome,
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

export async function runSearch({ provider, site, query, limit, maxPages, signal, condition = "any", allowAdult = false }) {
  const startedAt = Date.now();
  const metrics = { originRequests: 0, coalescedRequests: 0 };
  const marketplaceQuery = normalizeMarketplaceQuery(query);
  const requestedProvider = normalizeSearchProvider(provider);

  if (site.strategy === "crawl-seed") {
    const result = await runSinglePageSearch({ provider: requestedProvider, site, query: marketplaceQuery, limit, page: 1, signal, metrics });
    return {
      ...result,
      pagesUsed: 1,
      creditsUsed: site.estimatedCreditsPerPage || 0
    };
  }

  const effectiveLimit = limit ?? site.defaultLimit ?? 120;
  const pageSize = site.pageSize || Math.max(10, Math.min(effectiveLimit, 50));
  const cappedMaxPages = Math.min(maxPages ?? site.defaultMaxPages ?? site.maxPages ?? 1, site.maxPages ?? 1);

  const candidateLimit = Math.min(250, Math.max(pageSize, effectiveLimit, 100));
  const eligibility = new WeakMap();
  const qualifies = item => {
    if (!eligibility.has(item)) eligibility.set(item, isCollectionCandidate(item, marketplaceQuery, condition, allowAdult));
    return eligibility.get(item);
  };
  const qualifiedCount = items => items.filter(qualifies).length;
  const firstPage = await runSinglePageSearch({
    provider: requestedProvider,
    site,
    query: marketplaceQuery,
    limit: candidateLimit,
    page: 1,
    metrics,
    signal
  });

  const results = [firstPage];
  let items = dedupeItems(firstPage.items);
  let exhaustedReason = firstPage.rawItemCount === 0 ? "empty-first-page" : "limit";
  let pageError = null;
  // A result limit counts unique matches, not raw marketplace cards. A full
  // first page (or an estimated source total) cannot tell us how many pages
  // will be needed after filtering and deduplication. Keep the page budget
  // available while the source reports more results.
  const hasMorePages = firstPage.hasNextPage !== false && firstPage.rawItemCount > 0;
  const targetPages = hasMorePages ? Math.max(1, cappedMaxPages) : 1;

  if (firstPage.hasNextPage === false) exhaustedReason = "no-next-page";

  for (let page = 2; page <= targetPages; page += 1) {
    if (qualifiedCount(items) >= effectiveLimit) {
      exhaustedReason = "limit";
      break;
    }

    let pageResult;
    try {
      pageResult = await runSinglePageSearch({
        provider: requestedProvider,
        site,
        query: marketplaceQuery,
        limit: candidateLimit,
        page,
        metrics,
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

  // Prefer final eligible products before spending the response limit on
  // secondary matches; retain the latter when space remains.
  const qualified = items.filter(qualifies);
  const secondary = items.filter(item => !qualifies(item));
  items = [...qualified, ...secondary].slice(0, effectiveLimit);
  if (qualifiedCount(items) >= effectiveLimit) {
    exhaustedReason = "limit";
  } else if (results.length >= targetPages && exhaustedReason === "limit") {
    exhaustedReason = "page-window";
  }

  return {
    provider: results[0]?.provider ?? resolveProvider(requestedProvider, site),
    strategy: `${site.strategy}:${results.length}-pages`,
    site: site.key,
    url: site.searchUrl(marketplaceQuery),
    query: marketplaceQuery,
    itemCount: items.length,
    eligibleItemCount: qualifiedCount(items),
    durationMs: Date.now() - startedAt,
    fetchMetrics: requestedProvider === "direct" || firstPage.provider === "direct" ? metrics : null,
    outcome: items.length ? "results" : firstPage.outcome,
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
  filterRelevantItems,
  shouldRetryDirectFetchStatus
};
