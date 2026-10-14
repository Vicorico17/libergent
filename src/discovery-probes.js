import { understandMarketplaceQuery } from "./query-understanding.js";
import { getSearchQueryError } from "./search-policy.js";

export const DISCOVERY_PROBE_GROUPS = [
  { niche: "Casă și mobilier", sites: ["mobexpert.ro", "thehome.ro"], queries: ["canapea extensibila", "masa dining", "scaun birou"] },
  { niche: "Copii", sites: ["nichiduta.ro", "noriel.ro"], queries: ["carucior sport", "scaun auto copii", "jucarii bebelusi"] },
  { niche: "Modă", sites: ["vinted.ro", "epantofi.ro"], queries: ["adidas samba", "nike air force", "sandale dama"] },
  { niche: "Bricolaj", sites: ["dedeman.ro", "scule.ro"], queries: ["bormasina bosch", "surubelnita electrica", "polizor unghiular"] },
  { niche: "Animale", sites: ["zooplus.ro", "petmart.ro"], queries: ["royal canin", "purina pro plan", "hrana pisici"] },
  { niche: "Cărți", sites: ["libris.ro", "nemira.ro"], queries: ["dune", "harry potter", "carti copii"] },
  { niche: "Muzică", sites: ["soundcreation.ro", "mcmusic.ro"], queries: ["chitara electrica", "pian digital", "microfon shure"] },
  { niche: "Ciclism", sites: ["playbike.ro"], queries: ["bicicleta mtb", "casca bicicleta", "bicicleta copii"] },
  { niche: "Sport", sites: ["sportvision.ro"], queries: ["adidas running", "nike running", "minge fotbal"] },
  { niche: "Foto", sites: ["photosetup.ro", "f64.ro"], queries: ["sony a7", "canon eos", "trepied foto"] },
  { niche: "Jocuri și hobby", sites: ["redgoblin.ro", "regatuljocurilor.ro"], queries: ["lego", "catan", "joc de societate"] },
  { niche: "Îngrijire", sites: ["makeup.ro", "springfarma.com"], queries: ["crema cerave", "sampon vichy", "crema la roche posay"] },
  { niche: "Piese auto", sites: ["epiesa.ro"], queries: ["filtru ulei", "placute frana", "stergatoare bosch"] },
  { niche: "Auto", sites: ["autovit.ro", "bestauto.ro"], queries: ["dacia duster", "bmw x5", "volkswagen golf"] },
  { niche: "Tehnologie", sites: ["altex.ro", "emag.ro", "olx.ro"], queries: ["iphone 16", "laptop lenovo", "samsung galaxy s24"] }
];
export const DISCOVERY_PROBE_SITES = DISCOVERY_PROBE_GROUPS.flatMap((group) => group.sites);
const CURATED_QUERIES = new Set(DISCOVERY_PROBE_GROUPS.flatMap((group) => group.queries));

export function discoveryProbeSeeds() {
  return [...CURATED_QUERIES].map((query) => ({ query, origin: "manual", searchCount: 0, priority: 20 }));
}

export function probeQueryNiche(query) {
  return DISCOVERY_PROBE_GROUPS.find((group) => group.queries.includes(normalizeProbeQuery(query)))?.niche || "";
}

// Use the least recently checked query for this source, so popularity cannot
// monopolize the scheduled coverage. Each source stays within its product niche.
export function chooseScheduledProbeTerm(terms, site, runs = []) {
  const group = DISCOVERY_PROBE_GROUPS.find((entry) => entry.sites.includes(site));
  if (!group) return null;
  const lastRun = (query) => Math.max(0, ...runs.filter((run) => run.source_site === site && run.query === query)
    .map((run) => Date.parse(run.searched_at) || 0));
  return terms.filter((term) => isEligibleProbeTerm(term) && group.queries.includes(normalizeProbeQuery(term.query)))
    .sort((a, b) => lastRun(a.query) - lastRun(b.query)
      || group.queries.indexOf(normalizeProbeQuery(a.query)) - group.queries.indexOf(normalizeProbeQuery(b.query)))[0] || null;
}

export function discoveryProbeFailure(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  const missingSchema = /discovery_probe|record_discovery_probe_feedback/i.test(message)
    && /PGRST20[25]|42P01|does not exist|could not find (?:the )?(?:table|function)/i.test(message);
  return {
    code: missingSchema ? "discovery_schema_not_ready" : "discovery_unavailable",
    error: "Radarul de căutări este temporar indisponibil. Încearcă din nou mai târziu."
  };
}
// Only expand with recognizable attributes, never arbitrary seller or metadata words.
const PROBE_ATTRIBUTE = /^(?:\d{1,4}(?:gb|tb)|black|white|blue|green|red|pink|purple|gold|silver|titanium|negru|alb|albastru|verde|rosu|roz|mov|auriu|argintiu)$/;

export function isEligibleProbeTerm(term) {
  if (!term || term.status !== "queued" || !isEligibleProbeQuery(term.query)) return false;
  if (term.origin !== "result_expansion") return true;
  const parent = normalizeProbeQuery(term.parentQuery);
  const query = normalizeProbeQuery(term.query);
  if (!parent || !query.startsWith(`${parent} `)) return false;
  const additions = query.slice(parent.length + 1).split(" ");
  return additions.length > 0 && additions.every((token) => PROBE_ATTRIBUTE.test(token));
}

export function describeProbeError(error = "") {
  const message = String(error);
  if (/\b429\b/.test(message)) return { code: "rate_limited", cooldownMs: 15 * 60_000,
    message: "Sursa limitează cererile (HTTP 429). Verificările automate fac o pauză de cel puțin 15 minute." };
  if (/\b(?:401|403|407|511)\b|captcha|access denied/i.test(message)) return { code: "blocked", cooldownMs: 30 * 60_000,
    message: "Sursa a refuzat accesul automat. Verificările fac o pauză de cel puțin 30 de minute; accesul nu este încă restabilit." };
  return { code: "error", cooldownMs: 5 * 60_000,
    message: "Verificarea sursei a eșuat. Următoarea încercare automată va fi după o pauză de cel puțin 5 minute." };
}

export function discoverySourceStates(runs = [], now = Date.now()) {
  return DISCOVERY_PROBE_SITES.map((site) => {
    const latest = runs.filter((run) => run.source_site === site)
      .sort((a, b) => Date.parse(b.searched_at) - Date.parse(a.searched_at))[0];
    const failure = latest?.outcome === "error" ? describeProbeError(latest.error) : null;
    const lastAt = Date.parse(latest?.searched_at);
    const retryAt = Number.isFinite(lastAt) ? lastAt + (failure?.cooldownMs || 3 * 60_000) : 0;
    return { site, niche: DISCOVERY_PROBE_GROUPS.find((group) => group.sites.includes(site))?.niche, status: failure?.code || latest?.outcome || "unknown",
      coolingDown: retryAt > now, retryAt: retryAt ? new Date(retryAt).toISOString() : null,
      message: failure?.message || "" };
  });
}

export function chooseProbeSource(runs = [], cursor = 0, now = Date.now()) {
  const states = discoverySourceStates(runs, now);
  for (let offset = 0; offset < states.length; offset += 1) {
    const index = (cursor + offset) % states.length;
    if (!states[index].coolingDown) return { site: states[index].site, nextCursor: (index + 1) % states.length };
  }
  return null;
}

export function normalizeProbeQuery(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function isEligibleProbeQuery(value = "") {
  const query = String(value || "").trim();
  return query.length >= 3 && query.length <= 80 && !getSearchQueryError(query)
    && (CURATED_QUERIES.has(normalizeProbeQuery(query)) || Boolean(understandMarketplaceQuery(query).category));
}

export function chooseProbeTerm(terms = [], random = Math.random) {
  const eligible = terms.filter(isEligibleProbeTerm);
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
    const additions = normalizeProbeQuery(String(item.title || "").split(/,\s*(?:brand|model|stare)\s*:/i)[0])
      .replace(/\b(\d{1,4})\s+(gb|tb)\b/g, "$1$2").split(" ")
      .filter((token) => PROBE_ATTRIBUTE.test(token) && !baseTokens.has(token));
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
