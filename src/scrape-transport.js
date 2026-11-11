import { buildAbortSignal } from './abort.js';
import { scrapeError } from './scrape-outcome.js';

const MAX_BODY_BYTES = 4 * 1024 * 1024;
// OLX search HTML exceeds the default bound in production. Keep the larger
// allowance confined to this origin; streamed responses remain size-limited.
const OLX_MAX_BODY_BYTES = 8 * 1024 * 1024;

function responseBodyLimit(url) {
  const host = new URL(url).hostname;
  return host === 'olx.ro' || host === 'www.olx.ro' ? OLX_MAX_BODY_BYTES : MAX_BODY_BYTES;
}
export function retryAfterMs(value, now = Date.now()) {
  if (!value) return 0;
  const seconds = Number(value);
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
  return Number.isFinite(delay) ? Math.max(0, Math.min(delay, 3600000)) : 0;
}

export async function readBoundedResponse(response, maxBytes = MAX_BODY_BYTES) {
  if (Number(response.headers.get('content-length')) > maxBytes) {
    await response.body?.cancel();
    throw scrapeError('Marketplace response exceeds extraction size limit', 'invalid_response');
  }
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw scrapeError('Marketplace response exceeds extraction size limit', 'invalid_response');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
  return body;
}

function subscriber(promise, signal) {
  if (!signal) return promise;
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

// In-flight coalescing is per process/isolate. Optional domain leases extend
// traffic budgets and cooldowns across Worker isolates through a Durable Object.
export function createScrapeTransport({ fetchImpl = (...args) => fetch(...args), now = Date.now, coordinator = null } = {}) {
  const domains = new Map();
  const pending = new Map();
  async function run(url, options) {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (!domains.has(host)) {
      if (domains.size >= 256) {
        const idle = [...domains].find(([, state]) => !state.active && state.until <= now());
        if (!idle) throw scrapeError('Scrape domain budget exhausted', 'rate_limited');
        domains.delete(idle[0]);
      }
      domains.set(host, { active: 0, until: 0, window: now(), requests: 0 });
    }
    const state = domains.get(host);
    if (now() - state.window >= 60000) { state.window = now(); state.requests = 0; }
    if (state.until > now() || state.active >= 2 || state.requests >= 30) {
      throw scrapeError('Marketplace request deferred by source budget', 'rate_limited', { retryAfterMs: Math.max(1000, state.until - now()) });
    }
    state.active++;
    state.requests++;
    let lease;
    const stub = coordinator?.get(coordinator.idFromName(host));
    try {
      if (stub) {
        const response = await stub.fetch('https://scrape.internal/acquire', { method: 'POST' });
        const result = await response.json();
        if (!response.ok) throw scrapeError('Marketplace request deferred by shared source budget', 'rate_limited', { retryAfterMs: result.retryAfterMs });
        lease = result.lease;
      }
      if (options.metrics) options.metrics.originRequests++;
      const response = await fetchImpl(url, { ...options, signal: buildAbortSignal({ timeoutMs: 30000 }) });
      const cooldown = retryAfterMs(response.headers.get('retry-after'), now()) ||
        (response.status === 429 ? 60000 : response.status === 403 ? 30000 : 0);
      if (cooldown) {
        state.until = now() + cooldown;
        if (stub) await stub.fetch('https://scrape.internal/cooldown', { method: 'POST', body: JSON.stringify({ delay: cooldown }) });
      }
      const body = await readBoundedResponse(response, Math.min(responseBodyLimit(url), responseBodyLimit(response.url || url)));
      return { body, status: response.status, statusText: response.statusText, headers: [...response.headers], url: response.url };
    } finally {
      state.active--;
      if (lease) await stub.fetch('https://scrape.internal/release', { method: 'POST', body: JSON.stringify({ lease }) }).catch(() => {});
    }
  }
  return async function fetchScrape(url, options = {}) {
    options.signal?.throwIfAborted();
    const key = JSON.stringify([String(url), options.method || 'GET', options.headers || {}, options.body || '']);
    let promise = pending.get(key);
    if (promise && options.metrics) options.metrics.coalescedRequests++;
    if (!promise) {
      if (pending.size >= 128) throw scrapeError('Scrape request capacity exhausted', 'rate_limited');
      promise = run(url, options).finally(() => pending.delete(key));
      pending.set(key, promise);
    }
    const result = await subscriber(promise, options.signal);
    const response = new Response([204, 205, 304].includes(result.status) ? null : result.body.slice(), result);
    Object.defineProperty(response, 'url', { value: result.url });
    return response;
  };
}

let namespace;
let previousFetch;
let transport;
export function configureScrapeCoordinator(binding) {
  if (namespace !== binding) { namespace = binding; transport = null; }
}
export function fetchScrape(url, options) {
  if (!transport || previousFetch !== globalThis.fetch) {
    previousFetch = globalThis.fetch;
    transport = createScrapeTransport({ fetchImpl: previousFetch, coordinator: namespace });
  }
  return transport(url, options);
}

export async function acquireBrowserSourceLease(url) {
  if (!namespace) return { release: async () => {}, cooldown: async () => {} };
  const host = new URL(url).hostname.replace(/^www\./, '');
  const stub = namespace.get(namespace.idFromName(host));
  const response = await stub.fetch('https://scrape.internal/acquire', { method: 'POST' });
  const body = await response.json();
  if (!response.ok) throw scrapeError('Browser source deferred by shared budget', 'rate_limited', { retryAfterMs: body.retryAfterMs });
  return {
    release: () => stub.fetch('https://scrape.internal/release', { method: 'POST', body: JSON.stringify({ lease: body.lease }) }).catch(() => {}),
    cooldown: delay => stub.fetch('https://scrape.internal/cooldown', { method: 'POST', body: JSON.stringify({ delay }) }).catch(() => {})
  };
}
