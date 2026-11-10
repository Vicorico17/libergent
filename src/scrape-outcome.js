// Shared by direct and rendered extraction. Do not treat an unknown empty
// document as proof that a marketplace has no inventory.
export function isChallengeHtml(html = '') {
  return /<title[^>]*>\s*(?:just a moment|attention required[^<]*cloudflare|access denied)|id=["']cf-error-details|class=["'][^"']*captcha-container/i.test(html);
}

export function extractionOutcome(parsed) {
  if (parsed.items?.length) return 'results';
  if (parsed.totalResults === 0 && !(parsed.rawItemCount > 0)) return 'empty';
  return 'parser_failure';
}

export function scrapeError(message, outcome, extras = {}) {
  return Object.assign(new Error(message), { outcome, ...extras });
}

export function errorOutcome(error) {
  if (error?.outcome) return error.outcome;
  if (error?.upstreamStatus === 429) return 'rate_limited';
  if ([401, 403].includes(error?.upstreamStatus)) return 'blocked';
  if (/timeout|timed out|timpul maxim|aborted/i.test(error?.message || '')) return 'timeout';
  return 'fetch_error';
}

export function hasEmptySearchState(html = '') {
  const clean = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  const phrase = /^(?:no (?:products|results|items) found|nu (?:am găsit|am gasit|s-au găsit|s-au gasit) (?:produse|rezultate|anunțuri|anunturi))[.!]?$/i;
  const text = value => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return phrase.test(text(clean)) || [...clean.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi)].some(match => phrase.test(text(match[1])));
}
