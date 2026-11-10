// Only known tracking parameters are removed. Product, seller, SKU, and
// variant parameters remain part of identity for unfamiliar marketplaces.
export function listingIdentity(item = {}, site = '') {
  try {
    const url = new URL(item.url);
    url.hash = '';
    url.hostname = url.hostname.replace(/^www\./, '');
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_/i.test(key) || /^(?:fbclid|gclid|msclkid)$/i.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    const source = site || url.hostname;
    const id = url.hostname === 'olx.ro' ? url.pathname.match(/-(ID[a-z0-9]+)\.html$/i)?.[1]
      : url.hostname === 'vinted.ro' ? url.pathname.match(/^\/items\/(\d+)(?:-|\/|$)/)?.[1] : null;
    return id ? `${source}:${id}` : url.toString();
  } catch {
    return `${site}::${item.title || ''}::${item.price || ''}::${item.location || ''}`;
  }
}

export function uniqueListings(items, site = '') {
  const seen = new Set();
  return items.filter(item => {
    const key = listingIdentity(item, site);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
