import { runSearch } from "./search.js";
import { SITES } from "./sites.js";

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
const VALIDATION_TIMEOUT_MS = 8_000;
const VALIDATION_CONCURRENCY = 4;

function validationNiche(site) {
  return NICHE_ORDER.find((niche) => (site.niches || []).includes(niche)) || "marketplaces";
}

function sourceVerdict(result) {
  if (!result.ok) return "fix_or_demote";
  if ((result.itemCount || 0) > 0) return "candidate_keep";
  return "needs_query_or_parser";
}

async function validateSource({ siteKey, niche, provider, limit, maxPages }) {
  const site = SITES[siteKey];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS);
  try {
    const result = await runSearch({
      site,
      query: VALIDATION_QUERIES[niche],
      provider,
      limit,
      maxPages,
      signal: controller.signal
    });
    return {
      site: siteKey,
      niche,
      query: VALIDATION_QUERIES[niche],
      integrationStatus: site.integrationStatus || "experimental",
      verdict: sourceVerdict({ ok: true, ...result }),
      ok: true,
      rawItemCount: result.rawItemCount || 0,
      includedItemCount: result.includedItemCount ?? result.itemCount ?? 0,
      error: ""
    };
  } catch (error) {
    const message = controller.signal.aborted
      ? `Validation timed out after ${VALIDATION_TIMEOUT_MS / 1000}s.`
      : error instanceof Error ? error.message : String(error);
    return {
      site: siteKey,
      niche,
      query: VALIDATION_QUERIES[niche],
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
export async function runShopValidation({ provider = "direct", limit = 3, maxPages = 1, niches } = {}) {
  const requestedNiches = new Set(
    (Array.isArray(niches) ? niches : String(niches || "").split(","))
      .map((niche) => niche.trim())
      .filter(Boolean)
  );
  const groups = new Map();
  for (const [siteKey, site] of Object.entries(SITES)) {
    const niche = validationNiche(site);
    if (requestedNiches.size && !requestedNiches.has(niche)) continue;
    groups.set(niche, [...(groups.get(niche) || []), siteKey]);
  }

  const sources = [];
  for (const [niche, siteKeys] of groups) {
    sources.push(...await mapWithConcurrency(siteKeys, (siteKey) =>
      validateSource({ siteKey, niche, provider, limit, maxPages })
    ));
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
