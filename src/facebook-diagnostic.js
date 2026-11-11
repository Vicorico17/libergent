// Diagnostic only: does not register Facebook as a production source.
export function buildFacebookSearchUrl({ location, query }) {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(location || '') || ['category', 'item', 'search'].includes(location)) {
    throw new Error('Supply a candidate Facebook city slug or location ID.');
  }
  if (!query?.trim() || query.length > 120) throw new Error('Query must contain 1–120 characters.');
  const url = new URL(`https://www.facebook.com/marketplace/${location}/search/`);
  url.searchParams.set('query', query.trim());
  return url.href;
}

// Self-contained so it can run inside the browser without exporting raw page data.
export function inspectFacebookPage({ url, text = '', scripts = [], links = [], dialogs = '' }, requestedUrl) {
  const actual = new URL(url);
  const requested = new URL(requestedUrl);
  const clean = (value) => typeof value === 'string' ? value.slice(0, 300) : null;
  const result = {
    status: 'unrecognized_payload', resolvedPath: actual.pathname,
    locationVerified: false, partial: true, listings: [],
    itemLinkCount: links.filter((link) => /\/marketplace\/item\/\d+/.test(link)).length,
    feedFound: false, invalidJsonScripts: 0,
  };
  const blocked = (status) => ({ ...result, status });
  if (!['www.facebook.com', 'facebook.com', 'm.facebook.com'].includes(actual.hostname)) return blocked('unexpected_redirect');
  if (/\/login/.test(actual.pathname)) return blocked('login_required');
  if (/checkpoint|\/challenge/.test(actual.pathname) || /captcha|confirm you.re human|security check/i.test(dialogs)) return blocked('access_challenge');
  if (/log in|log into|conecteaz|autentific/i.test(dialogs)) return blocked('login_required');
  if (/allow.*cookies|accept.*cookies|cookie-uri|module cookie/i.test(dialogs)) return blocked('consent_required');
  if (/marketplace isn.t available|marketplace nu este disponibil/i.test(text)) return blocked('region_or_account_unavailable');
  if (actual.pathname.replace(/\/$/, '') !== requested.pathname.replace(/\/$/, '')) return blocked('location_resolution_failed');
  const listings = new Map();
  let visits = 0;
  function walk(node, depth = 0) {
    if (!node || typeof node !== 'object' || depth > 60 || ++visits > 150000) return;
    const feed = node.marketplace_search?.feed_units;
    if (Array.isArray(feed?.edges)) {
      result.feedFound = true;
      for (const edge of feed.edges) {
        const listing = edge?.node?.listing;
        if (!listing || !/^\d+$/.test(String(listing.id)) || !listing.marketplace_listing_title) continue;
        const price = listing.listing_price;
        const amount = price?.amount != null && price.amount !== '' ? Number(price.amount) : NaN;
        listings.set(String(listing.id), {
          id: String(listing.id), title: clean(listing.marketplace_listing_title),
          price: Number.isFinite(amount) && amount >= 0 ? amount : null,
          priceText: clean(price?.formatted_amount), currency: clean(price?.currency),
          city: clean(listing.location?.reverse_geocode?.city),
          url: `https://www.facebook.com/marketplace/item/${listing.id}/`,
          isSold: typeof listing.is_sold === 'boolean' ? listing.is_sold : null,
        });
      }
    }
    for (const value of Object.values(node)) walk(value, depth + 1);
  }
  for (const script of scripts) {
    try { walk(JSON.parse(script)); } catch { result.invalidJsonScripts++; }
  }
  result.listings = [...listings.values()].slice(0, 30);
  if (result.listings.length) result.status = 'extracted_unverified_location';
  else if (result.feedFound) result.status = 'empty_unverified';
  // A retained URL is not proof that Facebook applied the requested city.
  return result;
}

export async function runFacebookDiagnostic({ requestedUrl, mode, run, session, now = Date.now }) {
  if (!['local', 'remote'].includes(mode)) throw new Error('Mode must be local or remote.');
  const start = now();
  let report;
  let cleanup = 'not_attempted';
  try {
    await run(['open', requestedUrl, '--session', session,
      ...(mode === 'remote' ? ['--remote', '--verified', '--proxies'] : ['--local']),
      '--wait', 'domcontentloaded', '--timeout', '25000'], 35000);
    const expression = `(${inspectFacebookPage.toString()})({url:location.href,text:document.body.innerText.slice(0,100000),scripts:Array.from(document.querySelectorAll('script[type="application/json"]')).map(s=>s.textContent),links:Array.from(document.querySelectorAll('a[href]')).map(a=>a.href),dialogs:Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"]')).filter(e=>e.getClientRects().length).map(e=>e.innerText).join(' ')},${JSON.stringify(requestedUrl)})`;
    const raw = await run(['eval', expression, '--session', session], 15000);
    const parsed = JSON.parse(raw);
    report = parsed.result ?? parsed;
    if (!report.status || !Array.isArray(report.listings)) throw new Error('Unexpected CLI output');
  } catch (error) {
    report = { status: error.code === 'ENOENT' ? 'browse_not_installed' : 'browser_command_failed',
      listings: [], partial: true, locationVerified: false };
    // Never emit raw CLI errors: they may contain credentials or page content.
  } finally {
    try { await run(['stop', '--session', session], 10000); cleanup = 'completed'; }
    catch { cleanup = 'failed'; }
  }
  return { ...report, mode, cleanup, elapsedMs: now() - start, checkedAt: new Date().toISOString() };
}
