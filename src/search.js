import { buildListingSchema } from "./schema.js";
import { crawlWithCloudflare, scrapeWithCloudflare } from "./providers/cloudflare.js";
import { scrapeWithFirecrawl } from "./providers/firecrawl.js";

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
    items
  };
}

export async function runSearch({ provider, site, query, limit, maxPages }) {
  if (site.strategy === "crawl-seed") {
    return runSinglePageSearch({ provider, site, query, limit, page: 1 });
  }

  const pageSize = site.pageSize || Math.max(10, Math.min(limit, 50));
  const cappedMaxPages = Math.min(maxPages ?? site.maxPages ?? 1, site.maxPages ?? 1);
  const targetPages = Math.max(1, Math.min(cappedMaxPages, Math.ceil(limit / pageSize)));
  const pageNumbers = Array.from({ length: targetPages }, (_, index) => index + 1);

  const pageResults = await Promise.all(
    pageNumbers.map((page) =>
      runSinglePageSearch({
        provider,
        site,
        query,
        limit: Math.min(pageSize, limit),
        page
      })
    )
  );

  const items = dedupeItems(pageResults.flatMap((result) => result.items)).slice(0, limit);

  return {
    provider: pageResults[0]?.provider ?? (provider === "auto" ? site.provider : provider),
    strategy: `${site.strategy}:${targetPages}-pages`,
    site: site.key,
    url: site.searchUrl(query),
    query,
    itemCount: items.length,
    items
  };
}
