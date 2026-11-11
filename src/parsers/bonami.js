import { extractImageCandidate } from './image.js';

function plainText(value = '') {
  return value.replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ').trim();
}

// Read only the main product link. Variant links and the nested comparison
// control have their own aria-labels, which are not the product's title.
export function parseBonamiHtml(html, limit = 20) {
  const items = [];
  const seen = new Set();
  for (const match of String(html || '').matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const [, attributes, card] = match;
    if (!/\bclass=["'][^"']*\bProductCard_card__/i.test(attributes)) continue;
    const href = attributes.match(/\bhref=["']([^"']+)["']/i)?.[1];
    const title = plainText(card.match(/<h2\b[^>]*\bdata-test=["']listProductName["'][^>]*>([\s\S]*?)<\/h2>/i)?.[1]);
    const price = plainText(card.match(/<span\b[^>]*\bclass=["'][^"']*\bProductCard_customerPrice__[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]);
    if (!href || !title || !/^\d[\d\s.,]*\s*(?:Lei|RON)$/i.test(price)) continue;
    let url;
    try {
      const parsed = new URL(href, 'https://www.bonami.ro');
      if (parsed.protocol !== 'https:' || !['bonami.ro', 'www.bonami.ro'].includes(parsed.hostname) || !parsed.pathname.startsWith('/p/')) continue;
      url = parsed.href;
    } catch { continue; }
    if (seen.has(url)) continue;
    seen.add(url);
    items.push({ title, price, currency: 'RON', condition: 'Nou', url, imageUrl: extractImageCandidate(card) });
  }
  return { items: items.slice(0, limit), rawItemCount: items.length, totalResults: null, hasNextPage: null };
}
