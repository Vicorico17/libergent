import { understandMarketplaceQuery } from "./query-understanding.js";
import { getSearchQueryError } from "./search-policy.js";

export const DISCOVERY_PROBE_GROUPS = [
  { niche: "Casă și mobilier", sites: ["mobexpert.ro", "thehome.ro"], queries: ["canapea extensibila", "masa dining", "scaun birou"] },
  { niche: "Copii", sites: ["nichiduta.ro", "noriel.ro"], queries: ["carucior sport", "scaun auto copii", "jucarii bebelusi"] },
  { niche: "Modă", sites: ["vinted.ro", "epantofi.ro"], queries: ["adidas samba", "nike air force", "sandale dama"] },
  { niche: "Bricolaj", sites: ["dedeman.ro", "scule.ro"], queries: ["bormasina bosch", "surubelnita electrica", "polizor unghiular"] },
  { niche: "Animale", sites: ["zooplus.ro", "petmart.ro"], queries: ["royal canin", "purina pro plan", "hrana pisici"] },
  { niche: "Cărți", sites: ["libris.ro", "nemira.ro"], queries: ["dune", "jocurile foamei", "carti copii"] },
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
  const eligible = terms.filter((term) => isEligibleProbeTerm(term) && group.queries.includes(normalizeProbeQuery(term.query)));
  const recent = runs.filter((run) => run.source_site === site)
    .sort((a, b) => Date.parse(b.searched_at) - Date.parse(a.searched_at));
  const latest = recent[0];
  // One targeted retry after the source cooldown, then resume varied coverage.
  if (latest?.outcome === "error" && diagnoseProbeRun(latest).automatic
    && !(recent[1]?.outcome === "error" && recent[1]?.query === latest.query)) {
    const retry = eligible.find((term) => term.query === latest.query);
    if (retry) return retry;
  }
  return eligible.sort((a, b) => lastRun(a.query) - lastRun(b.query)
      || group.queries.indexOf(normalizeProbeQuery(a.query)) - group.queries.indexOf(normalizeProbeQuery(b.query)))[0] || null;
}

export function probeRecoveryAttempt(run) {
  return (run?.failed_sources || []).find((failure) => failure?.recovery)?.recovery || null;
}

export function shouldTryProbeBrowser(run, recentRuns = [], now = Date.now()) {
  if (run.outcome === "results") return false;
  const error = String(run.error || "");
  // Respect explicit rate limits; a browser is not a second immediate request.
  if (/\b(?:429|401|407|404)\b/.test(error)) return false;
  const refused = /\b(?:403|406|511)\b|challenge|access denied/i.test(error);
  const unrendered = run.outcome === "empty" && Number(run.parsed_count) === 0;
  if (!refused && !unrendered) return false;
  const attempts = recentRuns.map((previous) => ({ site: previous.source_site, attempt: probeRecoveryAttempt(previous) }))
    .filter(({ attempt }) => attempt && Number.isFinite(Date.parse(attempt.attemptedAt)));
  // At most one browser fallback per 15 minutes, and one per source per hour.
  return !attempts.some(({ site, attempt }) => now - Date.parse(attempt.attemptedAt)
    < (site === run.source_site ? 60 : 15) * 60_000);
}

export function mergeProbeRecovery(directRun, browserRun, attemptedAt) {
  const recovered = browserRun.outcome === "results" && browserRun.results_count > 0;
  const chosen = recovered ? browserRun : directRun;
  const directFailure = directRun.failed_sources?.[0] || {
    site: directRun.source_site, provider: "direct", error: "Direct page contained no extractable products."
  };
  return { ...chosen,
    failed_sources: [{ ...directFailure, recovery: {
      attemptedAt, provider: "cloudflare-browser", outcome: browserRun.outcome,
      resultsCount: browserRun.results_count
    } }, ...(browserRun.failed_sources || [])]
  };
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

export function diagnoseProbeRun(run) {
  if (run.outcome === "results") return { code: "offers_found", automatic: false, priority: 9,
    reason: "Au fost găsite oferte pentru această căutare.", action: "Continuăm verificările periodice." };
  if (run.outcome === "empty") return Number(run.parsed_count) > 0
    ? { code: "filtered_results", automatic: true, priority: 2,
      reason: `${run.parsed_count} produse au fost extrase, dar niciunul nu a trecut filtrele pentru această căutare.`,
      action: "Încercăm alt termen din aceeași nișă. Dacă situația se repetă, trebuie analizate potrivirea produselor și filtrele." }
    : { code: "no_extracted_products", automatic: true, priority: 1,
      reason: "Pagina a răspuns, dar nu am extras produse. Poate lipsi stocul sau conținutul poate necesita altă metodă de citire.",
      action: "Încercăm alt termen din aceeași nișă. Repetarea problemei necesită analiza paginii și a extracției." };
  const message = String(run.error || "");
  if (/\b404\b|redirected to the home page/i.test(message)) return { code: "search_route", automatic: false, priority: 0,
    reason: "Adresa de căutare nu a fost găsită sau a redirecționat către pagina principală.",
    action: "Trebuie verificată și corectată adresa de căutare a magazinului." };
  const failure = describeProbeError(message);
  if (failure.code === "blocked") return { code: "access_blocked", automatic: false, priority: 4,
    reason: "Magazinul refuză accesul automat.", action: "Pauză de 30 de minute. Dacă refuzul continuă, este necesară o altă integrare; reluarea nu garantează accesul." };
  if (failure.code === "rate_limited") return { code: "rate_limited", automatic: true, priority: 3,
    reason: "Magazinul limitează numărul de cereri.", action: "Pauză de 15 minute, apoi o nouă încercare când sursa ajunge la rând." };
  if (/non-JSON|Unexpected token|prices are unavailable|without usable prices/i.test(message)) return { code: "response_format", automatic: false, priority: 1,
    reason: "Răspunsul primit nu conține datele sau prețurile în formatul așteptat.", action: "Trebuie analizat răspunsul și actualizată extracția înainte de a declara sursa reparată." };
  return { code: "request_failed", automatic: true, priority: 3,
    reason: "Cererea a eșuat; cauza exactă nu poate fi stabilită doar din acest răspuns.", action: "Pauză de 5 minute, apoi o nouă încercare. Dacă se repetă, investigăm conexiunea și răspunsul sursei." };
}

// Keep failures per source AND query: success on a different term does not close them.
export function discoveryRepairQueue(runs = []) {
  const groups = new Map();
  for (const run of [...runs].sort((a, b) => Date.parse(b.searched_at) - Date.parse(a.searched_at))) {
    const key = JSON.stringify([run.source_site, run.query]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(run);
  }
  return [...groups.values()].flatMap((history) => {
    const latest = history[0];
    const failures = history.filter((run) => run.outcome !== "results");
    if (!failures.length) return [];
    const diagnostic = diagnoseProbeRun(latest);
    return [{ site: latest.source_site, query: latest.query,
      state: latest.outcome === "results" ? "recovered" : "open",
      observedFailures: failures.length, lastCheckedAt: latest.searched_at,
      ...diagnostic }];
  }).sort((a, b) => Number(a.state === "recovered") - Number(b.state === "recovered")
    || a.priority - b.priority || b.observedFailures - a.observedFailures);
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
