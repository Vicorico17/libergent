// The public search page bootstraps its product list as JSON arguments. Parse
// only that known module; never execute scripts or collect recommendations.
export function parseThomannHtml(html, limit = 20) {
  let state;
  for (const script of String(html || '').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const payload = script[1].match(/^\s*tho\.bootstrapModule\(['"]search\.index['"],\s*([\s\S]*)\);\s*$/);
    if (!payload) continue;
    try { state = JSON.parse(`[${payload[1]}]`)?.[0]?.[0]; } catch { continue; }
    break;
  }
  const articles = state?.articleListsSettings?.articles;
  if (!Array.isArray(articles)) return { items: [], rawItemCount: 0, totalResults: null };
  const items = [];
  const seen = new Set();
  for (const product of articles) {
    if (!product || product.isArchived || product.availability?.isAvailable === false) continue;
    const title = String(product.texts?.title || '').trim();
    const price = Number(product.price?.primary?.rawPrice);
    const currency = product.price?.primary?.currency?.key;
    if (!title || !Number.isFinite(price) || price <= 0 || !['RON', 'EUR'].includes(currency) || !product.relativeLink) continue;
    let url;
    try {
      const parsed = new URL(product.relativeLink, 'https://www.thomann.ro/');
      if (parsed.protocol !== 'https:' || parsed.hostname !== 'www.thomann.ro' || !parsed.pathname.endsWith('.htm')) continue;
      url = parsed.href;
    } catch { continue; }
    if (seen.has(url)) continue;
    seen.add(url);
    items.push({ title, price: `${price} ${currency}`, currency,
      condition: product.isBstock ? 'Resigilat' : 'Nou', sellerType: 'Thomann', url, imageUrl: '' });
  }
  const count = state.articleListsSettings.resultCount;
  return { items: items.slice(0, limit), rawItemCount: articles.length,
    totalResults: Number.isInteger(count) && count >= 0 ? count : null,
    hasNextPage: state.pagingSettings?.currentPage < state.pagingSettings?.lastPage };
}
