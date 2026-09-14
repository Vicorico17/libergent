import { SITES, FREE_CAR_SITE_KEYS, FREE_TECH_SITE_KEYS, PREMIUM_SITE_KEYS } from "./sites.js";

// Customer-facing coverage comes from the same registry as search routing.
// Registration is not evidence that a source is healthy or returns inventory.
export function buildSourceCatalog() {
  return Object.entries(SITES).map(([domain, site]) => ({
    domain,
    tier: PREMIUM_SITE_KEYS.includes(domain) ? "premium" : "free",
    status: site.integrationStatus,
    categories: site.niches || [],
    selection: FREE_CAR_SITE_KEYS.includes(domain) ? "vehicles"
      : FREE_TECH_SITE_KEYS.includes(domain) ? "refurbished-tech"
      : "query-dependent",
  })).sort((a, b) => a.domain.localeCompare(b.domain, "en"));
}
