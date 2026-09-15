import { SITES, FREE_CAR_SITE_KEYS, FREE_TECH_SITE_KEYS, PREMIUM_SITE_KEYS } from "./sites.js";
import { SOURCE_VALIDATION_SNAPSHOT } from "./source-validation-snapshot.js";

// Customer-facing coverage comes from the same registry as search routing.
// Registration is not evidence that a source is healthy or returns inventory.
export function buildSourceCatalog() {
  return Object.entries(SITES).map(([domain, site]) => ({
    domain,
    tier: PREMIUM_SITE_KEYS.includes(domain) ? "premium" : "free",
    status: site.integrationStatus,
    productionValidation: SOURCE_VALIDATION_SNAPSHOT[domain]?.productionChecks?.map((check) => ({
      checkedAt: check.checkedAt, query: check.query, accepted: check.accepted, cacheHit: check.cacheHit
    })) || [],
    directValidation: SOURCE_VALIDATION_SNAPSHOT[domain] ? {
      checkedAt: SOURCE_VALIDATION_SNAPSHOT[domain].checkedAt,
      environment: SOURCE_VALIDATION_SNAPSHOT[domain].environment,
      queriesChecked: SOURCE_VALIDATION_SNAPSHOT[domain].queries.length,
      queriesWithAcceptedOffers: SOURCE_VALIDATION_SNAPSHOT[domain].queries.filter((query) => query.accepted > 0).length
    } : null,
    categories: site.niches || [],
    selection: FREE_CAR_SITE_KEYS.includes(domain) ? "vehicles"
      : FREE_TECH_SITE_KEYS.includes(domain) ? "refurbished-tech"
      : "query-dependent",
  })).sort((a, b) => a.domain.localeCompare(b.domain, "en"));
}
