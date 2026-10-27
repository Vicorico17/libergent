import { lookupDeveloperKey, API_SOURCES } from './developer-store.js';
import { runSearch } from './search.js';
import { getSite } from './sites.js';
import { isPublicSearchQuery, isAdultProductQuery } from './search-policy.js';
import { parseListingDetailsHtml } from './listing-details.js';
import { normalizeIntegrationListing } from './integration-listings.js';

export const INTEGRATION_SOURCES = API_SOURCES;
const TTL = 900000;
const json = (body, status = 200, headers = {}) => Response.json(body, { status, headers: { 'cache-control': 'no-store', ...headers } });
const failure = (code, status, headers) => json({ apiVersion: '1', error: { code } }, status, headers);
export async function keyHash(token) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))].map(n => n.toString(16).padStart(2, '0')).join('');
}
export async function authenticateIntegration(request, env) {
  const token = request.headers.get('authorization')?.match(/^Bearer (lg_[A-Za-z0-9_-]{8,64}\.[A-Za-z0-9_-]{32,128})$/)?.[1];
  if (!token) return { response: failure('invalid_credentials', 401) };
  let keys;
  try { keys = JSON.parse(env.LIBERGENT_INTEGRATION_KEYS || '[]'); } catch { return { response: failure('configuration_error', 503) }; }
  if (!Array.isArray(keys)) return { response: failure('configuration_error', 503) };
  const hash = await keyHash(token);
  let config = keys.find(k => k && typeof k === 'object' && k.keyHash === hash);
  if (!config) {
    try { config = await lookupDeveloperKey(hash, env); }
    catch { return { response: failure('authentication_unavailable', 503) }; }
  }
  if (!config || config.revoked || !Number.isFinite(Date.parse(config.expiresAt)) || Date.parse(config.expiresAt) <= Date.now()) return { response: failure('invalid_credentials', 401) };
  if (!Array.isArray(config.scopes) || !config.scopes.includes('search:read')) return { response: failure('insufficient_scope', 403) };
  if (typeof config.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(config.id) || ![config.perMinute, config.perDay].every(n => Number.isInteger(n) && n > 0)
    || !Array.isArray(config.sites) || !config.sites.length || config.sites.some(s => !INTEGRATION_SOURCES.includes(s))) return { response: failure('configuration_error', 503) };
  return { config };
}
export function parseIntegrationQuery(url, config) {
  const p = url.searchParams;
  const allowed = ['q', 'sites', 'limit', 'category', 'material', 'details'];
  if ([...p.keys()].some(k => !allowed.includes(k) || p.getAll(k).length > 1)) throw Error('invalid_parameters');
  const query = (p.get('q') || '').trim();
  const sites = [...new Set((p.get('sites') || 'olx.ro').split(','))].sort();
  const limit = p.get('limit') || '20';
  const category = p.get('category') || 'any';
  const material = p.get('material') || 'any';
  const details = p.get('details') || (url.pathname.startsWith('/api/v1/') ? 'false' : 'true');
  if (!isPublicSearchQuery(query) || !/^\d+$/.test(limit) || +limit < 1 || +limit > 20
    || !['any', 'full_fur_coat'].includes(category) || !['any', 'natural', 'synthetic', 'unknown'].includes(material)
    || !['true', 'false'].includes(details) || !sites.length || sites.some(s => !config.sites.includes(s))) throw Error('invalid_parameters');
  if (details === 'true' && !config.scopes.includes('listings:details')) throw Error('insufficient_scope');
  return { query, sites, limit: +limit, category, material, details: details === 'true' };
}
export async function handleIntegration(request, env) {
  if (!['/api/v1/search', '/api/integrations/v1/search'].includes(new URL(request.url).pathname)) return failure('not_found', 404);
  if (env.LIBERGENT_INTEGRATIONS_ENABLED !== '1') return failure('not_found', 404);
  if (request.method !== 'GET') return failure('method_not_allowed', 405, { allow: 'GET' });
  const auth = await authenticateIntegration(request, env);
  if (auth.response) return auth.response;
  try { parseIntegrationQuery(new URL(request.url), auth.config); }
  catch (e) { return failure(e.message, e.message === 'insufficient_scope' ? 403 : 400); }
  if (!env.INTEGRATION_GATEWAY) return failure('storage_unavailable', 503);
  try {
    return await env.INTEGRATION_GATEWAY.get(env.INTEGRATION_GATEWAY.idFromName(auth.config.id)).fetch(request);
  } catch { return failure('integration_unavailable', 503); }
}

async function bounded(operation, milliseconds) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([operation(controller.signal), new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(Error('timeout')); }, milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}
export async function fetchIntegrationDetail(url, signal, fetcher = fetch) {
  const u = new URL(url);
  if (u.protocol !== 'https:' || u.username || u.password || u.port || !INTEGRATION_SOURCES.some(s => u.hostname === s || u.hostname === `www.${s}`)) throw Error('unsupported_url');
  const response = await fetcher(u, { signal, redirect: 'manual', headers: { accept: 'text/html' } });
  if ([404, 410].includes(response.status)) return { availability: 'removed', status: 'verified' };
  if (!response.ok || response.headers.get('cf-mitigated') === 'challenge') throw Error('detail_unavailable');
  const reader = response.body.getReader();
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length; if (size > 2 * 1024 * 1024) throw Error('detail_too_large');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const detail = parseListingDetailsHtml(new TextDecoder().decode(bytes), { url });
  // A generic/challenge page is not a successful listing verification.
  if (!detail.extraction.structuredData || !detail.title) throw Error('detail_unverified');
  return { ...detail, status: 'verified' };
}
export async function searchIntegration(params, deps = {}) {
  const search = deps.search || runSearch;
  const details = deps.details || fetchIntegrationDetail;
  const searchedAt = new Date().toISOString();
  const sources = await Promise.all(params.sites.map(async site => {
    try {
      const result = await bounded(signal => search({ provider: 'direct', site: getSite(site), query: params.query, limit: 20, maxPages: 1, signal }), deps.searchTimeoutMs || 8000);
      return { source: site, status: 'ok', items: result.items || [] };
    } catch (e) { return { source: site, status: 'failed', error: e.message === 'timeout' ? 'timeout' : 'source_unavailable', items: [] }; }
  }));
  // Bounded candidates and concurrency; filtering after enrichment avoids inventing missing facts.
  const candidates = sources.flatMap(s => s.items.filter(item => !isAdultProductQuery(item.title)).map(item => ({ item, source: s.source }))).slice(0, 20);
  const listings = new Array(candidates.length); let cursor = 0;
  const deadline = Date.now() + 12000;
  await Promise.all(Array.from({ length: Math.min(3, candidates.length) }, async () => {
    while (cursor < candidates.length) {
      const index = cursor++; const { item, source } = candidates[index];
      let detail = {}, verifiedAt = null;
      if (params.details && item.url) {
        try {
          const remaining = deadline - Date.now(); if (remaining <= 0) throw Error('timeout');
          detail = await bounded(signal => details(item.url, signal), Math.min(3000, remaining));
          verifiedAt = new Date().toISOString();
        } catch { detail = { status: 'unavailable' }; }
      }
      listings[index] = normalizeIntegrationListing(item, source, detail, verifiedAt);
    }
  }));
  const items = listings.filter(item => (params.category === 'any' || item.classification.category === params.category)
    && (params.material === 'any' || item.classification.material === params.material)).slice(0, params.limit);
  return { apiVersion: '1', mode: 'live', searchedAt, expiresAt: new Date(Date.parse(searchedAt) + TTL).toISOString(),
    partial: sources.some(s => s.status !== 'ok') || listings.some(i => i.detailStatus === 'unavailable'),
    sources: sources.map(({ items, ...s }) => ({ ...s, candidateCount: items.length })),
    inspectedCount: listings.length, items };
}

// One persistent coordinator per integration: quotas span isolates, regions and key rotation.
export class IntegrationGateway {
  constructor(state, env) { this.state = state; this.env = env; this.inflight = new Map(); }
  async fetch(request) {
    if (new URL(request.url).pathname === '/internal/mcp-admission') {
      const now = Date.now();
      const retryAfter = await this.state.storage.transaction(async tx => {
        const previous = await tx.get('mcp-usage') || {};
        const minute = Math.floor(now / 60000), day = Math.floor(now / 86400000);
        const minuteCount = previous.minute === minute ? previous.minuteCount : 0;
        const dayCount = previous.day === day ? previous.dayCount : 0;
        if (dayCount >= 2000) return 86400 - Math.floor(now / 1000) % 86400;
        if (minuteCount >= 120) return 60 - Math.floor(now / 1000) % 60;
        await tx.put('mcp-usage', { minute, day, minuteCount: minuteCount + 1, dayCount: dayCount + 1 });
        return 0;
      });
      return retryAfter ? failure('mcp_quota_exceeded', 429, { 'retry-after': String(retryAfter) }) : json({ allowed: true });
    }
    if (new URL(request.url).pathname === '/internal/usage') {
      const usage = await this.state.storage.get('usage') || {};
      const now = Date.now();
      return json({ minuteRequests: usage.minute === Math.floor(now / 60000) ? usage.minuteCount : 0,
        dayRequests: usage.day === Math.floor(now / 86400000) ? usage.dayCount : 0,
        minuteResetsAt: new Date((Math.floor(now / 60000) + 1) * 60000).toISOString(),
        dayResetsAt: new Date((Math.floor(now / 86400000) + 1) * 86400000).toISOString() });
    }
    const auth = await authenticateIntegration(request, this.env);
    if (auth.response) return auth.response;
    let params;
    try { params = parseIntegrationQuery(new URL(request.url), auth.config); }
    catch { return failure('invalid_parameters', 400); }
    const now = Date.now();
    const retryAfter = await this.state.storage.transaction(async tx => {
      const current = await tx.get('usage') || {};
      const minute = Math.floor(now / 60000), day = Math.floor(now / 86400000);
      const minuteCount = current.minute === minute ? current.minuteCount : 0;
      const dayCount = current.day === day ? current.dayCount : 0;
      if (minuteCount >= auth.config.perMinute || dayCount >= auth.config.perDay) return dayCount >= auth.config.perDay ? 86400 - Math.floor(now / 1000) % 86400 : 60 - Math.floor(now / 1000) % 60;
      await tx.put('usage', { minute, day, minuteCount: minuteCount + 1, dayCount: dayCount + 1 });
      return 0;
    });
    if (retryAfter) return failure('quota_exceeded', 429, { 'retry-after': String(retryAfter) });
    const key = `cache:${await keyHash(JSON.stringify(params))}`;
    const cached = await this.state.storage.get(key);
    if (cached && Date.parse(cached.expiresAt) > now) return json({ ...cached, cache: { status: 'hit', ageSeconds: Math.floor((now - Date.parse(cached.searchedAt)) / 1000) } });
    let pending = this.inflight.get(key);
    const coalesced = Boolean(pending);
    if (!pending) {
      if (this.inflight.size >= 2) return failure('busy', 429, { 'retry-after': '20' });
      pending = (auth.config.mode === 'test' ? Promise.resolve(buildSandboxSearch(params)) : this.search(params)).then(async payload => {
        // No success-shaped cache entry when every source fails. Retry is still quota-bound.
        if (payload.sources.some(s => s.status === 'ok') && new TextEncoder().encode(JSON.stringify(payload)).length <= 120000) {
          await this.state.storage.transaction(async tx => {
            const entries = await tx.list({ prefix: 'cache:' });
            const expired = [...entries].filter(([, v]) => Date.parse(v.expiresAt) <= Date.now()).map(([k]) => k);
            if (expired.length) await tx.delete(expired);
            if (entries.size - expired.length >= 32) {
              const oldest = [...entries].filter(([k]) => !expired.includes(k)).sort((a,b) => a[1].searchedAt.localeCompare(b[1].searchedAt))[0];
              if (oldest) await tx.delete(oldest[0]);
            }
            await tx.put(key, payload);
          });
        }
        return payload;
      }).finally(() => this.inflight.delete(key));
      this.inflight.set(key, pending);
    }
    const payload = await pending;
    return json({ ...payload, cache: { status: coalesced ? 'coalesced' : 'miss', ageSeconds: 0 } }, payload.sources.every(s => s.status === 'failed') ? 502 : 200);
  }
  search(params) { return searchIntegration(params); }
}

// Sandbox responses never execute a provider or fetch product images.
export function buildSandboxSearch(params = { query: 'iphone 15', sites: ['olx.ro'], limit: 1, category: 'any', material: 'any' }) {
  const searchedAt = new Date().toISOString();
  const item = normalizeIntegrationListing({ title: `Example result: ${params.query}` }, 'sandbox');
  const items = (params.category === 'any' || item.classification.category === params.category)
    && (params.material === 'any' || item.classification.material === params.material) ? [item] : [];
  return { apiVersion: '1', mode: 'test', simulated: true, searchedAt, expiresAt: new Date(Date.now() + TTL).toISOString(), partial: false,
    sources: params.sites.map(source => ({ source, status: 'ok', candidateCount: 1, simulated: true })), inspectedCount: 1, items };
}
