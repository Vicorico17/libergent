function isOlxCdnHost(hostname = "") {
  const value = hostname.toLowerCase();
  return value === "olxcdn.com" || value.endsWith(".olxcdn.com");
}

function unwrapOlxOptimizerUrl(url) {
  if (url.hostname !== "www.olx.ro" || url.pathname !== "/_next/image") {
    return url;
  }

  const nestedUrl = url.searchParams.get("url");
  if (!nestedUrl) {
    return url;
  }

  try {
    return new URL(nestedUrl);
  } catch {
    return url;
  }
}

export function normalizeMarketplaceImageUrl(value = "") {
  try {
    const url = unwrapOlxOptimizerUrl(new URL(value));
    return url.toString();
  } catch {
    return "";
  }
}

export function getMarketplaceImageProxyTarget(value = "") {
  const normalized = normalizeMarketplaceImageUrl(value);
  if (!normalized) {
    return "";
  }

  try {
    const url = new URL(normalized);
    return url.protocol === "https:" && isOlxCdnHost(url.hostname)
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

export function isAllowedMarketplaceImageUrl(value = "") {
  return Boolean(getMarketplaceImageProxyTarget(value));
}
