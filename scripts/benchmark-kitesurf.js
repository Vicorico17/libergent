import { SITES } from "../src/sites.js";

const REPRESENTATIVE_QUERIES = {
  marketplaces: "iphone 15",
  tech: "iphone 15",
  automotive: "bmw 320d",
  fashion: "nike air max",
  home: "canapea",
  diy: "bormasina",
  sport: "bicicleta",
  photo: "sony a7",
  music: "chitara",
  books: "dune",
  baby: "carucior copii",
  beauty: "parfum",
  pet: "hrana pisici",
  hobby: "lego"
};

function argumentValue(name, fallback = "") {
  const prefix = `--${name}=`;
  const inline = process.argv.slice(2).find((entry) => entry.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function boundedInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(parsed, max)) : fallback;
}

function representativeQuery(site, override) {
  if (override) return override;
  const niche = (site.niches || []).find((entry) => REPRESENTATIVE_QUERIES[entry]);
  return REPRESENTATIVE_QUERIES[niche] || "iphone 15";
}

const baseUrl = argumentValue("base-url", process.env.LIBERGENT_BENCHMARK_URL || "https://libergent.com").replace(/\/+$/, "");
const adminToken = argumentValue("token", process.env.LIBERGENT_ADMIN_TOKEN || "");
const engine = argumentValue("engine", "kitesurf").trim().toLowerCase();
const queryOverride = argumentValue("query").trim();
const state = argumentValue("state", "all").trim().toLowerCase();
const concurrency = boundedInteger(argumentValue("concurrency", "2"), 2, 1, 4);
const selectedKeys = argumentValue("sites")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

if (!adminToken) {
  throw new Error("Set LIBERGENT_ADMIN_TOKEN or pass --token. The token is sent only in the x-libergent-admin-token header.");
}
if (!new Set(["kitesurf", "chromium"]).has(engine)) {
  throw new Error("--engine must be kitesurf or chromium.");
}
if (!new Set(["all", "active", "experimental"]).has(state)) {
  throw new Error("--state must be all, active, or experimental.");
}

const unknownKeys = selectedKeys.filter((siteKey) => !SITES[siteKey]);
if (unknownKeys.length) throw new Error(`Unknown sites: ${unknownKeys.join(", ")}`);

const sites = (selectedKeys.length ? selectedKeys : Object.keys(SITES))
  .map((siteKey) => SITES[siteKey])
  .filter((site) => state === "all" || site.integrationStatus === state);
const results = new Array(sites.length);
let nextIndex = 0;

async function benchmarkWorker() {
  while (nextIndex < sites.length) {
    const index = nextIndex;
    nextIndex += 1;
    const site = sites[index];
    const query = representativeQuery(site, queryOverride);
    const url = new URL("/api/admin/browser-benchmark", baseUrl);
    url.searchParams.set("site", site.key);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "20");
    url.searchParams.set("engine", engine);

    try {
      const response = await fetch(url, {
        headers: { "x-libergent-admin-token": adminToken }
      });
      const payload = await response.json().catch(() => null);
      const result = payload?.result || {};
      results[index] = {
        site: site.key,
        state: site.integrationStatus || "experimental",
        niches: site.niches || [],
        query,
        engine,
        ok: response.ok && Boolean(payload?.ok),
        status: response.status,
        itemCount: result.itemCount ?? 0,
        rawItemCount: result.rawItemCount ?? 0,
        queryMismatchItemCount: result.queryMismatchItemCount ?? 0,
        durationMs: result.durationMs ?? null,
        challengeDetected: Boolean(result.challengeDetected),
        sample: Array.isArray(result.sample) ? result.sample : [],
        error: response.ok && payload?.ok ? "" : payload?.error || `HTTP ${response.status}`
      };
    } catch (error) {
      results[index] = {
        site: site.key,
        state: site.integrationStatus || "experimental",
        niches: site.niches || [],
        query,
        engine,
        ok: false,
        status: null,
        itemCount: 0,
        rawItemCount: 0,
        queryMismatchItemCount: 0,
        durationMs: null,
        challengeDetected: false,
        sample: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, sites.length) }, () => benchmarkWorker()));

function hasUsableProductSample(result) {
  return result.ok && !result.challengeDetected && result.itemCount > 0 &&
    result.sample.some((item) => item?.title && item?.url && item?.price);
}

const usable = results.filter(hasUsableProductSample);
const challenged = results.filter((result) => result.ok && result.challengeDetected);
const renderedEmpty = results.filter((result) => result.ok && !result.challengeDetected && !hasUsableProductSample(result));
const failed = results.filter((result) => !result.ok);

console.log(JSON.stringify({
  testedAt: new Date().toISOString(),
  baseUrl,
  engine,
  summary: {
    tested: results.length,
    usable: usable.length,
    challenged: challenged.length,
    renderedEmpty: renderedEmpty.length,
    failed: failed.length,
    usableSites: usable.map((result) => result.site),
    challengedSites: challenged.map((result) => result.site),
    failedSites: failed.map((result) => result.site)
  },
  results
}, null, 2));
