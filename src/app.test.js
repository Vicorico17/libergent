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

test("auto provider falls back to a configured remote provider when direct search fails", async () => {
  const envKeys = [
    "LIBERGENT_MOCK_SEARCH",
    "LIBERGENT_MOCK_PROVIDER",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_API_TOKEN"
  ];
  const previousEnv = new Map(envKeys.map((key) => [key, process.env[key]]));
  const previousFetch = globalThis.fetch;
  let directCalls = 0;
  let cloudflareCalls = 0;

  try {
    process.env.LIBERGENT_MOCK_SEARCH = "0";
    process.env.LIBERGENT_MOCK_PROVIDER = "0";
    process.env.CLOUDFLARE_ACCOUNT_ID = "account";
    process.env.CLOUDFLARE_API_TOKEN = "token";

    globalThis.fetch = async (url) => {
      const requestUrl = String(url);

      if (requestUrl.startsWith("https://api.cloudflare.com/")) {
        cloudflareCalls += 1;
        return new Response(JSON.stringify({
          success: true,
          result: {
            items: [
              {
                title: "iPhone 14 128GB",
                price: "1 900 lei",
                currency: "lei",
                location: "Bucuresti",
                postedAt: "azi",
                condition: "Utilizat",
                sellerType: "Persoana fizica",
                url: "https://www.olx.ro/d/oferta/iphone-14-IDtest.html",
                imageUrl: ""
              }
            ]
          }
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      directCalls += 1;
      return new Response("blocked", { status: 503 });
    };

    const payload = await searchAcrossSites({
      query: "iphone 14",
      provider: "auto",
      siteKeys: ["olx.ro"],
      limit: 1,
      maxPages: 1
    });

    const [result] = payload.results;
    assert.equal(result.ok, true);
    assert.equal(result.provider, "cloudflare");
    assert.equal(result.itemCount, 1);
    assert.equal(result.providerFallbacks.length, 1);
    assert.equal(result.providerFallbacks[0].provider, "direct");
    assert.match(result.providerFallbacks[0].reason, /Direct fetch failed \(503\)/);
    assert.equal(payload.summary.successfulMarketplaces, 1);
    assert.equal(directCalls, 4);
    assert.equal(cloudflareCalls, 1);
  } finally {
    globalThis.fetch = previousFetch;
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

test("direct search retries with an alternate browser profile before remote fallback", async () => {
  const envKeys = [
    "LIBERGENT_MOCK_SEARCH",
    "LIBERGENT_MOCK_PROVIDER",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_API_TOKEN"
  ];
  const previousEnv = new Map(envKeys.map((key) => [key, process.env[key]]));
  const previousFetch = globalThis.fetch;
  let directCalls = 0;
  let cloudflareCalls = 0;

  try {
    process.env.LIBERGENT_MOCK_SEARCH = "0";
    process.env.LIBERGENT_MOCK_PROVIDER = "0";
    process.env.CLOUDFLARE_ACCOUNT_ID = "account";
    process.env.CLOUDFLARE_API_TOKEN = "token";

    globalThis.fetch = async (url) => {
      const requestUrl = String(url);

      if (requestUrl.startsWith("https://api.cloudflare.com/")) {
        cloudflareCalls += 1;
        return new Response(JSON.stringify({ success: true, result: { items: [] } }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      directCalls += 1;
      if (directCalls === 1) {
        return new Response("blocked", { status: 403 });
      }

      return new Response(`
        <html>
          <body>
            <div data-cy="l-card" data-testid="l-card">
              <a href="/d/oferta/iphone-14-IDtest.html"><h4>iPhone 14 128GB</h4></a>
              <p data-testid="ad-price">1900 lei</p>
              <p data-testid="location-date">Bucuresti - Azi la 12:00</p>
            </div>
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
      limit: 1,
      maxPages: 1
    });

    const [result] = payload.results;
    assert.equal(result.ok, true);
    assert.equal(result.provider, "direct");
    assert.equal(result.itemCount, 1);
    assert.equal(result.providerFallbacks, undefined);
    assert.equal(directCalls, 2);
    assert.equal(cloudflareCalls, 0);
  } finally {
    globalThis.fetch = previousFetch;
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

test("Cloudflare challenge direct failures are reported without retrying the same blocked page", async () => {
  const envKeys = [
    "LIBERGENT_MOCK_SEARCH",
    "LIBERGENT_MOCK_PROVIDER",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_API_TOKEN",
    "FIRECRAWL_API_KEY"
  ];
  const previousEnv = new Map(envKeys.map((key) => [key, process.env[key]]));
  const previousFetch = globalThis.fetch;
  let directCalls = 0;

  try {
    process.env.LIBERGENT_MOCK_SEARCH = "0";
    process.env.LIBERGENT_MOCK_PROVIDER = "0";
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.FIRECRAWL_API_KEY;

    globalThis.fetch = async () => {
      directCalls += 1;
      return new Response("<html>challenge</html>", {
        status: 403,
        headers: {
          "content-type": "text/html",
          "cf-mitigated": "challenge"
        }
      });
    };

    const payload = await searchAcrossSites({
      query: "iphone",
      provider: "auto",
      siteKeys: ["lajumate.ro"],
      limit: 1,
      maxPages: 1
    });

    const [result] = payload.results;
    assert.equal(result.ok, false);
    assert.equal(result.attempts, 1);
    assert.match(result.error, /Cloudflare challenge/);
    assert.deepEqual(payload.summary.blockedMarketplaces, ["lajumate.ro"]);
    assert.equal(directCalls, 1);
  } finally {
    globalThis.fetch = previousFetch;
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
