import { understandMarketplaceQuery } from "./query-understanding.js";
import { getSearchQueryError } from "./search-policy.js";

export const DISCOVERY_PROBE_SITES = ["olx.ro", "vinted.ro", "emag.ro"];

export function discoveryProbeFailure(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  const missingSchema = /discovery_probe|record_discovery_probe_feedback/i.test(message)
    && /PGRST20[25]|42P01|does not exist|could not find (?:the )?(?:table|function)/i.test(message);
  return {
    code: missingSchema ? "discovery_schema_not_ready" : "discovery_unavailable",
    error: "Radarul de căutări este temporar indisponibil. Încearcă din nou mai târziu."
  };
}
const QUERY_STOP_WORDS = new Set([
  "vand", "vanzare", "cumpar", "cumparare", "nou", "noua", "noi", "folosit", "folosita",
  "stare", "superba", "superb", "oferta", "reducere", "pret", "lei", "ron", "livrare",
  "produs", "original", "originala", "pentru", "cu", "din", "the", "and", "for", "with",
  "apple", "samsung", "galaxy", "iphone", "smartphone", "telefon", "telefoane", "mobile"
]);

export function normalizeProbeQuery(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function isEligibleProbeQuery(value = "") {
  const query = String(value || "").trim();
  return query.length >= 3 && query.length <= 80 && !getSearchQueryError(query)
    && Boolean(understandMarketplaceQuery(query).category);
}

export function chooseProbeTerm(terms = [], random = Math.random) {
  const eligible = terms.filter((term) => term?.status === "queued" && isEligibleProbeQuery(term.query));
  if (!eligible.length) return null;
  const sample = eligible.slice(0, 10);
  const randomValue = Math.max(0, Math.min(0.999999, Number(random()) || 0));
  return sample[Math.floor(randomValue * sample.length)];
}

export function buildProbeSuggestions(query, results = [], limit = 3) {
  const base = String(query || "").trim();
  const baseUnderstanding = understandMarketplaceQuery(base);
  if (!baseUnderstanding.category) return [];
  const baseTokens = new Set(normalizeProbeQuery(base).split(" ").filter(Boolean));
  const suggestions = new Set();
  const rankedItems = results.flatMap((result) => result?.ok ? result.items || [] : [])
    .filter((item) => item?.isRecommendedCandidate === true && Number(item.relevanceScore) >= 70)
    .sort((a, b) => (Number(b.relevanceScore) || 0) - (Number(a.relevanceScore) || 0));

  for (const item of rankedItems) {
    const additions = normalizeProbeQuery(item.title).split(" ")
      .filter((token) => token.length >= 3 && !QUERY_STOP_WORDS.has(token) && !baseTokens.has(token));
    for (const addition of additions) {
      const suggestion = `${base} ${addition}`.slice(0, 80).trim();
      const normalized = normalizeProbeQuery(suggestion);
      if (!normalized || normalized === normalizeProbeQuery(base) || getSearchQueryError(suggestion)) continue;
      const understanding = understandMarketplaceQuery(suggestion);
      if (understanding.category !== baseUnderstanding.category) continue;
      suggestions.add(suggestion);
      if (suggestions.size >= limit) return [...suggestions];
    }
  }

  return [...suggestions];
}

export function serializeProbeRun({ query, site, payload, elapsedMs, parentQuery = "" }) {
  const items = (payload?.results || []).flatMap((result) => result?.ok ? result.items || [] : [])
    .filter((item) => item?.url)
    .slice(0, 5)
    .map((item) => ({
      title: String(item.title || "").slice(0, 180),
      url: String(item.url || "").slice(0, 1000),
      site: String(item.site || site || "").slice(0, 100),
      priceRon: Number.isFinite(item.priceRon) ? item.priceRon : null,
      relevanceScore: Number.isFinite(item.relevanceScore) ? item.relevanceScore : null
    }));
  const summary = payload?.summary || {};
  const failedSources = Array.isArray(summary.failedMarketplaces) ? summary.failedMarketplaces
    : (payload?.results || []).filter((result) => result?.ok === false)
      .map((result) => ({ site: result.site, error: result.error || "Source request failed." }));
  const failed = !items.length && failedSources.length > 0 && !(payload?.results || []).some((result) => result?.ok);
  return {
    query,
    source_site: site,
    parent_query: parentQuery || null,
    outcome: items.length ? "results" : failed ? "error" : "empty",
    results_count: Number(summary.includedListings ?? items.length) || 0,
    parsed_count: Number(summary.parsedListings) || 0,
    failed_sources: failedSources,
    error: failed ? String(failedSources[0]?.error || "Source request failed.").slice(0, 500) : "",
    offers: items,
    elapsed_ms: Math.max(0, Math.round(Number(elapsedMs) || 0)),
    searched_at: summary.searchedAt || new Date().toISOString()
  };
}
