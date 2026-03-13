import { buildListingSchema } from "./schema.js";
import { crawlWithCloudflare, scrapeWithCloudflare } from "./providers/cloudflare.js";
import { scrapeMarkdownWithFirecrawl, scrapeWithFirecrawl } from "./providers/firecrawl.js";
import { parseOlxMarkdown } from "./parsers/olx.js";
import { parseLajumateHtml } from "./parsers/lajumate.js";
import { parseOkaziiHtml } from "./parsers/okazii.js";
import { parseVintedMarkdown } from "./parsers/vinted.js";

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
  if (!queryTokens.length) {
    return items;
  }

  return items.filter((item) => {
    const titleTokens = new Set(tokenize(item.title || ""));
    return queryTokens.some((token) => titleTokens.has(token));
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
    } else if (site.key === "okazii.ro") {
      const parsed = parseOkaziiHtml(raw, limit);
      items = parsed.items;
      totalResults = parsed.totalResults;
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

  return {
    provider: resolvedProvider,
    strategy: site.strategy,
    site: site.key,
    url,
    query,
    itemCount: items.length,
    items,
    totalResults
  };
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
  const estimatedTotalPages = firstPage.totalResults
    ? Math.ceil(firstPage.totalResults / Math.max(firstPage.itemCount || 1, 1))
    : Math.ceil(effectiveLimit / pageSize);
  const targetPages = Math.max(1, Math.min(cappedMaxPages, estimatedTotalPages));

  for (let page = 2; page <= targetPages; page += 1) {
    if (items.length >= effectiveLimit) {
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
    if (nextItems.length === items.length) {
      break;
    }
    items = nextItems;

    if (pageResult.itemCount < Math.max(5, Math.floor(pageSize / 3))) {
      break;
    }
  }

  items = items.slice(0, effectiveLimit);

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
    creditsUsed: results.length * (site.estimatedCreditsPerPage || 0)
  };
}
