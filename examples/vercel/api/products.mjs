// General catalog example: set LIBERGENT_CATALOG_QUERY for your application.
// Vercel Node.js Function. Keep this module server-side; no NEXT_PUBLIC_* secrets.
export const config = { maxDuration: 40 };
export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'method_not_allowed' }); }
  const origin = process.env.LIBERGENT_API_ORIGIN;
  const key = process.env.LIBERGENT_API_KEY;
  if (!origin || !key) return res.status(503).json({ error: 'catalog_not_configured' });
  try {
    const url = new URL('/api/v1/search', origin);
    // Fixed server-owned query: never forward arbitrary visitor URLs or headers.
    url.search = new URLSearchParams({ q: process.env.LIBERGENT_CATALOG_QUERY || 'iphone 15', sites: 'olx.ro', limit: '20' }).toString();
    const response = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(35000), redirect: 'error' });
    if (!response.ok) {
      res.setHeader('Cache-Control', 'no-store');
      if (response.status === 429) res.setHeader('Retry-After', response.headers.get('retry-after') || '60');
      return res.status(503).json({ error: 'catalog_temporarily_unavailable' });
    }
    const catalog = await response.json();
    if (catalog.apiVersion !== '1' || !Array.isArray(catalog.items)) throw Error('invalid_contract');
    // Removed listings are retained in the integration response for reconciliation,
    // but should not be advertised in the storefront.
    catalog.items = catalog.items.filter(item => item.availability !== 'removed');
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    const ttl = Math.max(1, Math.min(catalog.partial ? 60 : 900, Math.floor((Date.parse(catalog.expiresAt) - Date.now()) / 1000)));
    res.setHeader('Vercel-CDN-Cache-Control', `public, s-maxage=${ttl}`);
    return res.status(200).json(catalog);
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ error: 'catalog_temporarily_unavailable' });
  }
}
