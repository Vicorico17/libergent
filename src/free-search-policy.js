import { normalizeSearchProvider } from './provider-options.js';
import { FREE_DEFAULT_SITE_KEYS, FREE_CAR_SITE_KEYS, FREE_TECH_SITE_KEYS, getDefaultSiteKeys, getSite, getSiteKeysForAllSearch } from './sites.js';

const FREE_SITES = new Set([...FREE_DEFAULT_SITE_KEYS, ...FREE_CAR_SITE_KEYS, ...FREE_TECH_SITE_KEYS]);

// Public HTTP routes cannot select metered providers. CLI/admin diagnostics keep
// their separate provider controls; Premium uses its authenticated pipeline.
export function getFreeSearchProvider(provider = 'auto') {
  const normalized = normalizeSearchProvider(provider);
  if (normalized !== 'auto' && normalized !== 'direct') {
    throw new Error('Unsupported provider for Free search. Use auto or direct.');
  }
  return 'direct';
}

export function getFreeSearchSiteKeys(site = 'default', query = '') {
  if (site === 'all') return getSiteKeysForAllSearch(query).filter(key => FREE_SITES.has(key));
  if (site === 'default') return getDefaultSiteKeys().filter(key => FREE_SITES.has(key));
  const key = getSite(site).key;
  if (!FREE_SITES.has(key)) throw new Error('Unsupported site for Free search. Premium sources require Premium access.');
  return [key];
}
