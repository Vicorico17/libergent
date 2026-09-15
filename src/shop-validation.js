import { runSearch } from "./search.js";
import { SITES, FREE_CAR_SITE_KEYS, PREMIUM_CORE_SITE_KEYS } from "./sites.js";
import { aggregateMarketplaceResults } from "./aggregate.js";

export const VALIDATION_QUERIES = {
  fashion: "adidas samba",
  home: "canapea extensibila",
  diy: "bormasina bosch",
  sport: "bicicleta mtb",
  tech: "iphone 15 pro",
  auto: "bmw x5",
  automotive: "anvelope 205 55 r16",
  beauty: "parfum dama",
  pet: "hrana caine",
  books: "harry potter",
  music: "chitara electrica",
  photo: "camera foto sony",
  baby: "carucior copii",
  hobby: "joc de societate",
  marketplaces: "iphone 15 pro"
};

const NICHE_ORDER = Object.keys(VALIDATION_QUERIES);
const SECOND_VALIDATION_QUERIES = {
  fashion: "nike air force", home: "masa dining", diy: "surubelnita bosch",
  sport: "adidas running", tech: "samsung galaxy s24", auto: "dacia duster",
  automotive: "anvelope 195 65 r15", beauty: "parfum barbati", pet: "hrana pisici",
  books: "dune", music: "pian digital", photo: "canon eos", baby: "scaun auto copii",
  hobby: "lego", marketplaces: "samsung galaxy s24"
};
const VALIDATION_TIMEOUT_MS = 8_000;
const VALIDATION_CONCURRENCY = 4;

function validationNiche(site, siteKey) {
  if (FREE_CAR_SITE_KEYS.includes(siteKey)) return "auto";
  if ((site.niches || []).includes("auto")) return "automotive";
  if (PREMIUM_CORE_SITE_KEYS.includes(siteKey)) return "tech";
  return NICHE_ORDER.find((niche) => (site.niches || []).includes(niche)) || "marketplaces";
}

function sourceVerdict(result) {
  if (!result.ok) return "fix_or_demote";
  if ((result.itemCount || 0) > 0) return "candidate_keep";
  return "needs_query_or_parser";
}

async function validateSource({ siteKey, niche, query, provider, limit, maxPages, search }) {
  const site = SITES[siteKey];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const result = await search({
      site,
      query,
      provider,
      limit,
      maxPages,
      signal: controller.signal
    });
    const payload = aggregateMarketplaceResults([{ ...result, ok: true, site: siteKey, query }]);
    const includedItemCount = payload.summary.totalListings;
    return {
      site: siteKey,
      niche,
      query,
      durationMs: Date.now() - startedAt,
      integrationStatus: site.integrationStatus || "experimental",
      verdict: sourceVerdict({ ok: true, itemCount: includedItemCount }),
      ok: true,
      rawItemCount: result.rawItemCount || 0,
      includedItemCount,
      error: ""
    };
  } catch (error) {
    const message = controller.signal.aborted
      ? `Validation timed out after ${VALIDATION_TIMEOUT_MS / 1000}s.`
      : error instanceof Error ? error.message : String(error);
    return {
      site: siteKey,
      niche,
      query,
      durationMs: Date.now() - startedAt,
      integrationStatus: site.integrationStatus || "experimental",
      verdict: "fix_or_demote",
      ok: false,
      rawItemCount: 0,
      includedItemCount: 0,
      error: message
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function mapWithConcurrency(items, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(VALIDATION_CONCURRENCY, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Runs a low-cost, representative live search for every configured store.
 * A candidate_keep result still needs manual relevance/price review before promotion.
 */
export async function runShopValidation({ provider = "direct", limit = 20, maxPages = 1, niches, siteKeys, search = runSearch } = {}) {
  const requestedNiches = new Set(
    (Array.isArray(niches) ? niches : String(niches || "").split(","))
      .map((niche) => niche.trim())
      .filter(Boolean)
  );
  const groups = new Map();
  for (const [siteKey, site] of Object.entries(SITES)) {
    if (siteKeys && !siteKeys.includes(siteKey)) continue;
    const niche = validationNiche(site, siteKey);
    if (requestedNiches.size && !requestedNiches.has(niche)) continue;
    groups.set(niche, [...(groups.get(niche) || []), siteKey]);
  }

  const sources = [];
  for (const [niche, siteKeys] of groups) {
    sources.push(...await mapWithConcurrency(siteKeys, async (siteKey) => {
      const checks = [];
      const queries = siteKey === "avstore.ro" ? ["casti sony", "boxe jbl"]
        : siteKey === "a2t.ro" ? ["camera hikvision", "camera dahua"]
        : [VALIDATION_QUERIES[niche], SECOND_VALIDATION_QUERIES[niche]];
      for (const query of queries) {
        checks.push(await validateSource({ siteKey, niche, query, provider, limit, maxPages, search }));
      }
      return {
        site: siteKey, niche, integrationStatus: SITES[siteKey].integrationStatus,
        verdict: checks.some((check) => check.includedItemCount > 0) ? "candidate_keep"
          : checks.every((check) => !check.ok) ? "fix_or_demote" : "needs_query_or_parser",
        repeatedNoUsefulResults: checks.every((check) => check.includedItemCount === 0),
        checks
      };
    }));
  }

  const counts = (verdict) => sources.filter((source) => source.verdict === verdict).length;
  return {
    checkedAt: new Date().toISOString(),
    provider,
    summary: {
      total: sources.length,
      candidateKeep: counts("candidate_keep"),
      needsQueryOrParser: counts("needs_query_or_parser"),
      fixOrDemote: counts("fix_or_demote")
    },
    niches: Object.fromEntries([...groups.keys()].map((niche) => [
      niche,
      sources.filter((source) => source.niche === niche)
    ])),
    sources
  };
}
