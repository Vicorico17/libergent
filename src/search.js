import { buildListingSchema } from "./schema.js";
import { crawlWithCloudflare, scrapeWithCloudflare } from "./providers/cloudflare.js";
import { scrapeMarkdownWithFirecrawl, scrapeWithFirecrawl } from "./providers/firecrawl.js";
import { parseOlxMarkdown } from "./parsers/olx.js";

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
  } else if (resolvedProvider === "cloudflare") {
    raw = await scrapeWithCloudflare({ url, prompt, schema, timeoutMs: site.timeoutMs });
    items = Array.isArray(raw?.items) ? raw.items : [];
  } else if (site.strategy === "firecrawl-markdown-local") {
    raw = await scrapeMarkdownWithFirecrawl({
      url,
      waitForMs: site.waitForMs,
      timeoutMs: site.timeoutMs
    });
    const parsed = parseOlxMarkdown(raw?.markdown || "", limit);
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
