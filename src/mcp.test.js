import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import worker from "./worker.js";
import { handleMcp } from "./mcp.js";
import { compactOffer, buildConnectorSearchResult } from "./mcp-results.js";

async function connect(t, env = {}, fetcher) {
  const original = { ...process.env };
  t.after(() => {
    for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
    Object.assign(process.env, original);
  });
  const client = new Client({ name: "libergent-test", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL("https://libergent.test/mcp"), {
    fetch: fetcher || ((url, init) => {
      const request = new Request(url, init);
      Object.defineProperty(request, "cf", { value: { city: "București", country: "RO" } });
      return worker.fetch(request, { LIBERGENT_MCP_ENABLED: "1", LIBERGENT_MOCK_SEARCH: "1", ...env });
    })
  }));
  t.after(() => client.close());
  return client;
}

test("MCP initializes, advertises three tools, and lists only Free sources", async (t) => {
  const client = await connect(t);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((tool) => tool.name), ["search_products", "get_listing_details", "list_sources"]);
  assert.ok(tools.every((tool) => tool.annotations.readOnlyHint && tool.annotations.openWorldHint));
  const result = await client.callTool({ name: "list_sources", arguments: {} });
  assert.equal(result.structuredContent.data.tier, "free");
  assert.ok(result.structuredContent.data.sources.some((source) => source.domain === "olx.ro"));
  assert.ok(!result.structuredContent.data.sources.some((source) => source.domain === "emag.ro"));
});

test("MCP search honors budgets, explicit city, and ignores client edge geolocation", async (t) => {
  const client = await connect(t);
  const search = async (args) => (await client.callTool({ name: "search_products", arguments: { query: "iphone", ...args } })).structuredContent.data;
  const result = await search({ maxPriceRon: 3000, limit: 2 });
  assert.ok(result.offers.length > 0 && result.offers.length <= 2);
  assert.ok(result.offers.every((offer) => offer.priceRon <= 3000));
  assert.ok(result.recommendedOffer.priceRon <= 3000);
  assert.equal(result.locationResolved, null);
  assert.equal((await search({ city: "Brașov" })).locationResolved.city, "Brașov");
  const unknown = await search({ city: "Unknown city" });
  assert.equal(unknown.locationResolved, null);
  assert.ok(unknown.notes.some((note) => note.includes("could not be resolved")));
  const empty = await search({ maxPriceRon: 1 });
  assert.deepEqual(empty.offers, []);
  assert.equal(empty.recommendedOffer, null);
});

test("connector preserves Libergent selections and evidence instead of selecting its own winner", () => {
  const ranked = { url: "ranked-first", rank: 1, priceRon: 100 };
  const chosen = { url: "libergent-choice", rank: 4, priceRon: 200,
    recommendation: { reasons: ["Libergent evidence"], strong: true },
    jevDecision: { provider: "jev", confidence: 0.9, candidateCount: 4 } };
  const summary = {
    rankedOffers: [ranked, chosen], bestOffer: chosen, bestUsedOffer: chosen,
    closestUsedOffer: ranked, bestNewBenchmark: { url: "retail", priceRon: 3000 },
    recommendedOffers: [chosen], maxPriceRon: 500, condition: "used",
    priceIntelligence: { savingsVsNewPct: 93 }, jevDecision: { status: "selected" },
    successfulMarketplaces: 1, marketplaces: 2, failedMarketplaces: [{ site: "vinted.ro" }]
  };
  const result = buildConnectorSearchResult({ summary }, { query: "phone", limit: 1 });
  assert.equal(result.status, "partial");
  assert.deepEqual(result.recommendedOffer, compactOffer(chosen));
  assert.equal(result.offers[0].url, ranked.url);
  assert.deepEqual(result.bestUsedOffer.jevDecision, chosen.jevDecision);
  assert.deepEqual(result.priceIntelligence, summary.priceIntelligence);
  assert.equal(result.newPriceBenchmark.priceRon, 3000);
  const noDecision = buildConnectorSearchResult({ summary: { ...summary, bestOffer: null, bestUsedOffer: null } }, { query: "phone" });
  assert.equal(noDecision.recommendedOffer, null);
  assert.equal(noDecision.bestUsedOffer, null);
});

test("MCP rejects invalid inputs and unsupported listing URLs before any external fetch", async (t) => {
  const client = await connect(t);
  const original = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("Unexpected network request"); };
  t.after(() => { globalThis.fetch = original; });
  for (const args of [{ limit: 21 }, { maxPriceRon: -1 }, { query: "" }, { condition: "broken" }]) {
    assert.equal((await client.callTool({ name: "search_products", arguments: { query: "iphone", ...args } })).isError, true);
  }
  const result = await client.callTool({ name: "get_listing_details", arguments: { url: "https://127.0.0.1/private" } });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /not supported/i);
});

test("MCP listing details reuse extraction without returning seller contact data", async (t) => {
  const client = await connect(t);
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('<script type="application/ld+json">{"@type":"Product","name":"Phone","description":"Used phone","offers":{"@type":"Offer","price":100,"priceCurrency":"RON","seller":{"name":"Seller","telephone":"private-number"}}}</script>');
  t.after(() => { globalThis.fetch = original; });
  const result = await client.callTool({ name: "get_listing_details", arguments: { url: "https://www.olx.ro/d/oferta/phone-ID123.html" } });
  assert.equal(result.structuredContent.data.title, "Phone");
  assert.equal(result.structuredContent.data.pricing.itemPrice, 100);
  assert.ok(!JSON.stringify(result).includes("private-number"));
});

test("MCP reuses search cache with separate city entries", async (t) => {
  const original = globalThis.caches;
  const entries = new Map();
  globalThis.caches = { default: {
    match: async (request) => entries.get(request.url)?.clone(),
    put: async (request, response) => { entries.set(request.url, response.clone()); }
  } };
  t.after(() => { globalThis.caches = original; });
  const client = await connect(t);
  const search = async (args) => (await client.callTool({ name: "search_products", arguments: { query: "iphone", ...args } })).structuredContent.data;
  assert.equal((await search({})).cacheHit, false);
  assert.equal((await search({ maxPriceRon: 3000 })).cacheHit, false);
  assert.equal((await search({ maxPriceRon: 3000 })).cacheHit, true);
  assert.equal((await search({ city: "Brașov" })).cacheHit, false);
});

test("MCP is disabled by default, validates Origin, bounds bodies, and applies configured quota", async () => {
  assert.equal((await worker.fetch(new Request("https://libergent.test/mcp"), {})).status, 404);
  assert.equal((await worker.fetch(new Request("https://libergent.test/mcp", { headers: { origin: "https://evil.test" } }), { LIBERGENT_MCP_ENABLED: "1" })).status, 403);
  assert.equal((await worker.fetch(new Request("https://libergent.test/mcp", {
    method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: "x".repeat(65537)
  }), { LIBERGENT_MCP_ENABLED: "1" })).status, 413);
  const response = await handleMcp(new Request("https://libergent.test/mcp"), {
    LIBERGENT_MCP_ENABLED: "1", MCP_RATE_LIMITER: { limit: async () => ({ success: false }) }
  }, () => { throw new Error("Quota must reject before calling API"); });
  assert.equal(response.status, 429);
});

test("MCP search returns the same Libergent decisions as the website API", async (t) => {
  const client = await connect(t);
  const params = new URLSearchParams({ q: "iphone", condition: "used", maxPriceRon: "3000", near: "Brașov", provider: "direct", site: "all", limit: "80", pages: "1" });
  const direct = await (await worker.fetch(new Request(`https://libergent.test/api/search/free?${params}`), { LIBERGENT_MOCK_SEARCH: "1" })).json();
  const connector = (await client.callTool({ name: "search_products", arguments: { query: "iphone", condition: "used", maxPriceRon: 3000, city: "Brașov" } })).structuredContent.data;
  for (const [output, field] of [["recommendedOffer", "bestOffer"], ["bestUsedOffer", "bestUsedOffer"], ["closestUsedOffer", "closestUsedOffer"], ["newPriceBenchmark", "bestNewBenchmark"]]) {
    assert.deepEqual(connector[output], compactOffer(direct.summary[field]));
  }
  assert.deepEqual(connector.priceIntelligence, direct.summary.priceIntelligence);
  assert.deepEqual(connector.queryUnderstanding, direct.summary.queryUnderstanding);
  assert.deepEqual(connector.offers, direct.summary.rankedOffers.slice(0, 10).map(compactOffer));
  for (const value of ["-1", "NaN", "Infinity", "100ron", "100000001"]) {
    params.set("maxPriceRon", value);
    assert.equal((await worker.fetch(new Request(`https://libergent.test/api/search/free?${params}`), {})).status, 400);
  }
});

test("Premium connector uses the existing user and entitlement checks", async (t) => {
  const original = globalThis.fetch;
  let entitled = false;
  globalThis.fetch = async (url, options) => {
    if (String(url) === "https://api.typesafe.ai/v1/systemone") {
      return Response.json({ answers: { best_used: { type: "choice", choice: "u02", confidence: 0.9 } } });
    }
    if (String(url).endsWith("/auth/v1/user")) {
      assert.equal(options.headers.authorization, "Bearer connected-user");
      return Response.json({ id: "connector-user", email: "connector@example.test" });
    }
    if (String(url).includes("user_entitlements")) return Response.json(entitled ? [{ status: "active", plan: "premium", expires_at: null }] : []);
    return Response.json([]);
  };
  t.after(() => { globalThis.fetch = original; });
  const env = { LIBERGENT_MCP_ENABLED: "1", LIBERGENT_MOCK_SEARCH: "1", SUPABASE_URL: "https://supabase.example", SUPABASE_SECRET_KEY: "test", BROWSER: {}, PREMIUM_JEV_ENABLED: "1", JEV_API_KEY: "test" };
  const anonymous = await connect(t, env);
  assert.equal((await anonymous.callTool({ name: "search_products", arguments: { query: "iphone", tier: "premium" } })).isError, true);
  const connected = await connect(t, {}, (url, init) => {
    const request = new Request(url, init);
    request.headers.set("authorization", "Bearer connected-user");
    return worker.fetch(request, env);
  });
  const args = { query: "iphone", tier: "premium", maxPriceRon: 3000 };
  assert.equal((await connected.callTool({ name: "search_products", arguments: args })).isError, true);
  entitled = true;
  const result = await connected.callTool({ name: "search_products", arguments: args });
  assert.notEqual(result.isError, true);
  assert.equal(result.structuredContent.data.searchTier, "premium");
  assert.equal(result.structuredContent.data.jevDecision.status, "selected");
  assert.equal(result.structuredContent.data.bestUsedOffer.jevDecision.confidence, 0.9);
  assert.ok(result.structuredContent.data.offers.every((offer) => offer.priceRon <= 3000));
  const params = new URLSearchParams({ q: "iphone", condition: "any", maxPriceRon: "3000", provider: "direct", site: "all", limit: "80", pages: "1" });
  const direct = await (await worker.fetch(new Request(`https://libergent.test/api/search/premium?${params}`, { headers: { authorization: "Bearer connected-user" } }), env)).json();
  assert.deepEqual(result.structuredContent.data.bestUsedOffer, compactOffer(direct.summary.bestUsedOffer));
  assert.deepEqual(result.structuredContent.data.priceIntelligence, direct.summary.priceIntelligence);
  entitled = false;
  assert.equal((await connected.callTool({ name: "search_products", arguments: args })).isError, true);
});
