import test from "node:test";
import assert from "node:assert/strict";
import { searchAcrossSites } from "./app.js";
import { SITES } from "./sites.js";

function makeFailingRemoteSite(key, priority) {
  return {
    key,
    label: key,
    priority,
    defaultEnabled: false,
    provider: "cloudflare",
    strategy: "remote-json",
    estimatedCreditsPerPage: 0,
    timeoutMs: 50,
    pageSize: 1,
    maxPages: 1,
    defaultLimit: 1,
    defaultMaxPages: 1,
    searchUrl() {
      return `https://${key}/search`;
    },
    prompt() {
      return `Extract listings from ${key}.`;
    }
  };
}

test("all requested marketplaces are represented even when individual providers fail", async () => {
  const envKeys = [
    "LIBERGENT_MOCK_SEARCH",
    "LIBERGENT_MOCK_PROVIDER",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_API_TOKEN"
  ];
  const previousEnv = new Map(envKeys.map((key) => [key, process.env[key]]));
  const siteKeys = ["fail-a.test", "fail-b.test"];

  try {
    process.env.LIBERGENT_MOCK_SEARCH = "0";
    process.env.LIBERGENT_MOCK_PROVIDER = "0";
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;

    SITES["fail-a.test"] = makeFailingRemoteSite("fail-a.test", 900);
    SITES["fail-b.test"] = makeFailingRemoteSite("fail-b.test", 901);

    const payload = await searchAcrossSites({
      query: "iphone",
      provider: "auto",
      siteKeys,
      limit: 1,
      maxPages: 1
    });

    assert.equal(payload.results.length, 2);
    assert.deepEqual(payload.results.map((result) => result.site), siteKeys);
    assert.equal(payload.summary.marketplaces, 2);
    assert.equal(payload.summary.successfulMarketplaces, 0);
    assert.equal(payload.results.every((result) => result.ok === false), true);
  } finally {
    for (const siteKey of siteKeys) {
      delete SITES[siteKey];
    }

    for (const key of envKeys) {
      const previous = previousEnv.get(key);
      if (previous === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous;
      }
    }
  }
});

test("Cloudflare Worker runtime caps marketplace searches to one page", async () => {
  const previousRuntime = process.env.LIBERGENT_RUNTIME;
  const previousMockSearch = process.env.LIBERGENT_MOCK_SEARCH;
  const previousFetch = globalThis.fetch;
  const fetchedUrls = [];

  try {
    process.env.LIBERGENT_RUNTIME = "cloudflare-worker";
    process.env.LIBERGENT_MOCK_SEARCH = "0";
    globalThis.fetch = async (url) => {
      fetchedUrls.push(String(url));
      return new Response(`
        <html>
          <body>
            <div data-cy="l-card" data-testid="l-card">
              <a href="/d/oferta/iphone-14-IDtest.html"><h4>Iphone 14 128GB</h4></a>
              <p data-testid="ad-price">1200 lei</p>
              <p data-testid="location-date">Bucuresti - Azi la 12:00</p>
            </div>
            <a href="?page=2">next</a>
          </body>
        </html>
      `, {
        status: 200,
        headers: { "content-type": "text/html" }
      });
    };

    const payload = await searchAcrossSites({
      query: "iphone 14",
      provider: "auto",
      siteKeys: ["olx.ro"],
      limit: 50,
      maxPages: 3
    });

    assert.equal(payload.results[0].ok, true);
    assert.equal(payload.results[0].pagesUsed, 1);
    assert.equal(fetchedUrls.length, 1);
    assert.equal(fetchedUrls[0].includes("page=2"), false);
  } finally {
    if (previousRuntime === undefined) {
      delete process.env.LIBERGENT_RUNTIME;
    } else {
      process.env.LIBERGENT_RUNTIME = previousRuntime;
    }
    if (previousMockSearch === undefined) {
      delete process.env.LIBERGENT_MOCK_SEARCH;
    } else {
      process.env.LIBERGENT_MOCK_SEARCH = previousMockSearch;
    }
    globalThis.fetch = previousFetch;
  }
});
