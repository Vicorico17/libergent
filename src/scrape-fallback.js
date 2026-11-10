export function needsBrowserFallback(result) {
  if (result?.outcome === 'empty' || result?.outcome === 'rate_limited') return false;
  if (!result?.ok) return true;
  const count = result.eligibleItemCount ?? result.itemCount ?? result.items?.length ?? 0;
  const raw = result.rawItemCount ?? count;
  return count === 0 || (count < 3 && raw > count * 3);
}

export function preferBrowserFallback(direct, browser) {
  if (!browser) return direct;
  if (!direct?.ok) return browser.ok ? browser : direct || browser;
  if (!browser.ok) return direct;
  const useful = result => result.eligibleItemCount ?? result.itemCount ?? result.items?.length ?? 0;
  return useful(browser) > useful(direct) ? browser : direct;
}
