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

function tokenize(value = "") {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function filterRelevantItems(items, query) {
  const queryTokens = tokenize(query);
  const brandTokens = getQueryBrandTerms(query);
  if (!queryTokens.length) {
    return items;
  }

  if (queryTokens.length === 1) {
    return items.filter((item) => String(item.title || "").trim());
  }

  const requiredNumberTokens = queryTokens.filter((token) => /^\d+$/.test(token));
  return items.filter((item) => {
    const titleTokens = new Set(tokenize(item.title || ""));
    if (requiredNumberTokens.some((token) => !titleTokens.has(token))) {
      return false;
    }

    const matchedTokens = queryTokens.filter((token) => titleTokens.has(token)).length;
    const matchedBrands = brandTokens.filter((token) => titleTokens.has(token)).length;
    const weightedMatches = matchedTokens + (matchedBrands ? 1.5 : 0);
    const weightedRequired = queryTokens.length + (brandTokens.length ? 1.5 : 0);
    return weightedMatches / weightedRequired >= 0.5;
  });
}

async function fetchHtmlDirect({ url, timeoutMs = 15000 }) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; libergent/0.1; +https://localhost)",
      accept: "text/html,application/xhtml+xml"
    },
    redirect: "follow"
  });

  if (!response.ok) {
    throw new Error(`Direct fetch failed (${response.status}) for ${url}`);
  }

  return response.text();
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

async function runSinglePageSearch({ provider, site, query, limit, page }) {
  const url = typeof site.pagedSearchUrl === "function" ? site.pagedSearchUrl(query, page) : site.searchUrl(query);
  const schema = buildListingSchema(limit);
  const prompt = site.prompt(query, limit);
  const resolvedProvider = provider === "auto" ? site.provider : provider;

  let raw;
  let items;
  let totalResults = null;
  let rawItemCount = 0;
  let hasNextPage = null;

  if (resolvedProvider === "cloudflare" && site.strategy === "crawl-seed") {
    raw = await crawlWithCloudflare({
      crawlConfig: site.crawlConfig(query),
      schema,
      timeoutMs: site.timeoutMs
    });
    items = extractCloudflareCrawlItems(raw);
  } else if (site.strategy === "direct-html-local") {
    raw = await fetchHtmlDirect({ url, timeoutMs: site.timeoutMs });

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
  } else if (resolvedProvider === "cloudflare") {
    raw = await scrapeWithCloudflare({ url, prompt, schema, timeoutMs: site.timeoutMs });
    items = Array.isArray(raw?.items) ? raw.items : [];
  } else if (site.strategy === "firecrawl-markdown-local") {
    raw = await scrapeMarkdownWithFirecrawl({
      url,
      waitForMs: site.waitForMs,
      timeoutMs: site.timeoutMs
    });
    const parser = site.key === "vinted.ro" ? parseVintedMarkdown : parseOlxMarkdown;
    const parsed = parser(raw?.markdown || "", limit);
    items = parsed.items;
    totalResults = parsed.totalResults;
    rawItemCount = getRawItemCount(parsed, items);
    hasNextPage = parsed.hasNextPage ?? null;
  } else {
    raw = await scrapeWithFirecrawl({
      url,
      prompt,
      schema,
      waitForMs: site.waitForMs,
      timeoutMs: site.timeoutMs
    });
    items = Array.isArray(raw?.items) ? raw.items : [];
  }

  items = site.disableQueryFilter ? items : filterRelevantItems(items, query);
  rawItemCount = rawItemCount || items.length;

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

export async function runSearch({ provider, site, query, limit, maxPages }) {
  if (site.strategy === "crawl-seed") {
    const result = await runSinglePageSearch({ provider, site, query, limit, page: 1 });
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
    provider,
    site,
    query,
    limit: Math.min(pageSize, effectiveLimit),
    page: 1
  });

  const results = [firstPage];
  let items = dedupeItems(firstPage.items);
  let exhaustedReason = firstPage.rawItemCount === 0 ? "empty-first-page" : "limit";
  const estimatedTotalPages = estimateTotalPages(firstPage, pageSize, effectiveLimit);
  const targetPages = Math.max(1, Math.min(cappedMaxPages, estimatedTotalPages));

  for (let page = 2; page <= targetPages; page += 1) {
    if (items.length >= effectiveLimit) {
      exhaustedReason = "limit";
      break;
    }

    const pageResult = await runSinglePageSearch({
      provider,
      site,
      query,
      limit: Math.min(pageSize, effectiveLimit),
      page
    });

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
    provider: results[0]?.provider ?? (provider === "auto" ? site.provider : provider),
    strategy: `${site.strategy}:${results.length}-pages`,
    site: site.key,
    url: site.searchUrl(query),
    query,
    itemCount: items.length,
    items,
    totalResults: results[0]?.totalResults ?? null,
    pagesUsed: results.length,
    pagesTargeted: targetPages,
    exhaustedReason,
    creditsUsed: results.length * (site.estimatedCreditsPerPage || 0)
  };
}
