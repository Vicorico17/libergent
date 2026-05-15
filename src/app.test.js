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
