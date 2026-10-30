import { createDeveloperStore, developerConfigured, DeveloperError } from "./developer-store.js";
import { getSearchQueryError, isAdultProductQuery } from "./search-policy.js";
import { getSite } from "./sites.js";
import { runSearch } from "./search.js";
import { buildMockSearchResult } from "./mock.js";
import { aggregateMarketplaceResults } from "./aggregate.js";
import { buildConnectorSearchResult } from "./mcp-results.js";
import { buildAbortSignal } from "./abort.js";

export const DEVELOPER_SOURCES = ["olx.ro", "publi24.ro", "okazii.ro"];
const aliases = { olx: "olx.ro", publi24: "publi24.ro", okazii: "okazii.ro" };
const reply = (body, status = 200, headers = {}) => Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
const fail = (code, status = 400) => { throw new DeveloperError(code, status); };

export function parseDeveloperSearch(url) {
  const allowed = new Set(["q", "sites", "limit", "condition", "maxPriceRon"]);
  for (const key of url.searchParams.keys()) {
    if (!allowed.has(key) || url.searchParams.getAll(key).length !== 1) fail("invalid_parameter");
  }
  const query = (url.searchParams.get("q") || "").trim();
  if (!query || getSearchQueryError(query)) fail("invalid_query");
  if (isAdultProductQuery(query)) fail("adult_confirmation_required", 403);
  const siteKeys = [...new Set((url.searchParams.get("sites") || "olx,publi24,okazii").split(",").map(value => {
    const key = value.trim().toLowerCase();
    return aliases[key] || key;
  }))].sort();
  if (!siteKeys.length || siteKeys.some(key => !DEVELOPER_SOURCES.includes(key))) fail("unsupported_source");
  const limitText = url.searchParams.get("limit") ?? "10";
  if (!/^\d+$/.test(limitText) || Number(limitText) < 1 || Number(limitText) > 20) fail("invalid_limit");
  const condition = url.searchParams.get("condition") || "any";
  if (!["any", "new", "used"].includes(condition)) fail("invalid_condition");
  const maxText = url.searchParams.get("maxPriceRon");
  const maxPriceRon = maxText === null ? undefined : Number(maxText);
  if (maxText !== null && (!maxText.trim() || !Number.isFinite(maxPriceRon) || maxPriceRon <= 0 || maxPriceRon > 100_000_000)) fail("invalid_budget");
  return { query, siteKeys, limit: Number(limitText), condition, maxPriceRon };
}

async function boundedJson(request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) fail("expected_json", 415);
  const reader = request.body?.getReader();
  if (!reader) fail("invalid_json");
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); fail("request_too_large", 413); }
      chunks.push(value);
    }
    const data = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
    const value = JSON.parse(new TextDecoder().decode(data));
    if (!value || typeof value !== "object" || Array.isArray(value)) fail("invalid_json");
    return value;
  } catch (error) {
    if (error instanceof DeveloperError) throw error;
    fail("invalid_json");
  } finally { reader.releaseLock(); }
}

// One direct page per source, no paid providers or browser fallback. Separate
// test fixtures avoid process-global mock flags leaking between concurrent calls.
export async function executeDeveloperSearch(input, mode, requestSignal, search = runSearch) {
  if (requestSignal?.aborted) fail("request_cancelled", 499);
  const controller = new AbortController();
  const signal = buildAbortSignal({ signal: requestSignal ? AbortSignal.any([requestSignal, controller.signal]) : controller.signal });
  let timeout;
  const deadline = new Promise((_, reject) => {
    timeout = setTimeout(() => { controller.abort(); reject(new DeveloperError("search_timeout", 504)); }, 25000);
  });
  try {
    const results = await Promise.race([Promise.all(input.siteKeys.map(async siteKey => {
      if (mode === "test") return buildMockSearchResult({ siteKey, query: input.query, condition: input.condition });
      try {
        const result = await search({ site: getSite(siteKey), query: input.query, provider: "direct", limit: 20, maxPages: 1, signal });
        return { ...result, ok: true };
      } catch {
        return { ok: false, site: siteKey, query: input.query, provider: "direct", error: "Source unavailable" };
      }
    })), deadline]);
    if (requestSignal?.aborted) fail("request_cancelled", 499);
    if (!results.some(result => result.ok)) fail("sources_unavailable", 502);
    const payload = aggregateMarketplaceResults(results, { condition: input.condition, maxPriceRon: input.maxPriceRon });
    const decisions = buildConnectorSearchResult(payload, { query: input.query, limit: input.limit });
    const searchedAt = new Date().toISOString();
    return {
      apiVersion: "1", mode, simulated: mode === "test", query: input.query,
      partial: results.some(result => !result.ok), cacheHit: false, searchedAt,
      sources: results.map(result => ({ domain: result.site, status: result.ok ? "ok" : "unavailable" })),
      items: (payload.summary.rankedOffers || []).slice(0, input.limit).map(item => ({
        title: item.title, url: item.url, priceRon: Number.isFinite(item.priceRon) ? item.priceRon : null,
        source: item.site, condition: item.offerKind || item.condition || "unknown",
        imageUrl: item.imageUrl || null, availability: "unknown",
        lastVerifiedAt: mode === "live" ? searchedAt : null
      })),
      decisions
    };
  } finally { clearTimeout(timeout); controller.abort(); }
}

function openapi() {
  const error = { description: "Structured error with error.code and requestId" };
  return {
    openapi: "3.1.0", info: { title: "Libergent Developer API", version: "1.0.0" },
    servers: [{ url: "/" }],
    components: { securitySchemes: { ApiKey: { type: "http", scheme: "bearer", description: "Test or live Libergent API key; use server-side only." } } },
    paths: {
      "/api/v1/demo": { get: { security: [], summary: "Fixed simulated response; no marketplace requests", responses: { 200: { description: "Simulated search" }, 503: error } } },
      "/api/v1/sources": { get: { security: [{ ApiKey: [] }], summary: "Allowed sources; counts against account quota", responses: { 200: { description: "Sources and key mode" }, 401: error, 403: error, 429: error, 503: error } } },
      "/api/v1/search": { get: {
        security: [{ ApiKey: [] }], summary: "Read-only search; cached and failed searches count against account quota",
        parameters: [
          { name: "q", in: "query", required: true, schema: { type: "string", minLength: 1, maxLength: 120 } },
          { name: "sites", in: "query", description: "Comma-separated olx, publi24, okazii or canonical domains", schema: { type: "string", default: "olx,publi24,okazii" } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 20, default: 10 } },
          { name: "condition", in: "query", schema: { type: "string", enum: ["any", "used", "new"], default: "any" } },
          { name: "maxPriceRon", in: "query", schema: { type: "number", exclusiveMinimum: 0, maximum: 100000000 } }
        ],
        responses: { 200: { description: "Ranked items, Libergent decisions, source coverage, searchedAt and cacheHit; availability is unknown." }, 400: error, 401: error, 403: error, 429: error, 502: error, 503: error, 504: error }
      } }
    }
  };
}

export async function handleDeveloperApi(request, env, authenticate, dependencies = {}) {
  const requestId = crypto.randomUUID();
  try {
    const url = new URL(request.url); const path = url.pathname.replace(/\/+$/, "");
    if (path === "/api/developer/config" && request.method === "GET") return reply({ available: developerConfigured(env) });
    if (!developerConfigured(env)) fail("developer_api_unavailable", 503);
    const store = dependencies.store || createDeveloperStore(env);
    if (path.startsWith("/api/developer/")) {
      const origin = request.headers.get("origin");
      const publicOrigin = String(env.LIBERGENT_PUBLIC_URL || "").replace(/\/+$/, "");
      if (origin && origin !== url.origin && origin !== publicOrigin) fail("origin_not_allowed", 403);
      const auth = await authenticate(request, env);
      if (!auth.user) fail(auth.status === 401 ? "authentication_required" : "authentication_unavailable", auth.status || 503);
      const userId = auth.user.id;
      if (path === "/api/developer/keys" && request.method === "GET") return reply({ keys: await store.list(userId) });
      if (path === "/api/developer/usage" && request.method === "GET") return reply({ usage: await store.usage(userId) });
      if (path === "/api/developer/keys" && request.method === "POST") {
        if (!auth.user.email_confirmed_at) fail("verified_email_required", 403);
        const data = await boundedJson(request);
        if (Object.keys(data).some(key => !["name", "mode", "scopes"].includes(key))) fail("invalid_parameter");
        if (typeof data.name !== "string" || !data.name.trim() || data.name.trim().length > 60) fail("invalid_key_name");
        if (!["test", "live"].includes(data.mode)) fail("invalid_key_mode");
        if (data.scopes !== undefined && (!Array.isArray(data.scopes) || data.scopes.length !== 1 || data.scopes[0] !== "search:read")) fail("invalid_scope");
        return reply(await store.create(userId, { name: data.name.trim(), mode: data.mode }), 201);
      }
      const id = path.match(/^\/api\/developer\/keys\/([a-f0-9-]{36})$/i)?.[1];
      if (id && request.method === "DELETE") return reply({ key: await store.revoke(userId, id) });
      fail("not_found", 404);
    }
    if (request.method !== "GET") fail("method_not_allowed", 405);
    if (path === "/api/v1/openapi.json") return reply(openapi());
    if (path === "/api/v1/demo") return reply(await executeDeveloperSearch({ query: "iphone 15", siteKeys: ["olx.ro"], limit: 3, condition: "any" }, "test", request.signal));
    if (!["/api/v1/search", "/api/v1/sources"].includes(path)) fail("not_found", 404);
    const input = path === "/api/v1/search" ? parseDeveloperSearch(url) : null;
    const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1] || "";
    const access = await store.consume(token);
    if (!["test", "live"].includes(access.mode)) fail("developer_storage_unavailable", 503);
    if (path === "/api/v1/sources") return reply({ apiVersion: "1", mode: access.mode, sources: DEVELOPER_SOURCES });
    // Credentials and account IDs never enter the shared cache. Each cache hit
    // still passes revocation, account disablement and atomic quota checks above.
    const cache = dependencies.cache === undefined ? globalThis.caches?.default : dependencies.cache;
    const cacheUrl = new URL("/internal/developer-search-v1", request.url);
    cacheUrl.searchParams.set("input", JSON.stringify(input));
    const cacheKey = new Request(cacheUrl);
    if (access.mode === "live" && cache) {
      try {
        const cached = await cache.match(cacheKey);
        if (cached) return reply({ ...await cached.json(), cacheHit: true });
      } catch { /* Cache is optional; storage authentication is not. */ }
    }
    const result = await (dependencies.search || executeDeveloperSearch)(input, access.mode, request.signal);
    if (access.mode === "live" && cache && !result.partial) {
      try { await cache.put(cacheKey, Response.json(result, { headers: { "cache-control": "public, max-age=900" } })); }
      catch { /* A cache outage must not discard a successful search. */ }
    }
    return reply(result);
  } catch (error) {
    const known = error instanceof DeveloperError;
    const code = known ? error.code : "developer_service_unavailable";
    const status = known ? error.status : 503;
    return reply({ error: { code }, requestId }, status, error.retryAfter ? { "retry-after": String(error.retryAfter) } : {});
  }
}
