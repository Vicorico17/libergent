function decodeAttribute(value) {
  return value.replace(/&quot;|&#34;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&amp;/gi, "&");
}

export function parseForitHtml(html, limit = 20, { origin = "https://www.forit.ro" } = {}) {
  const items = [];
  const seen = new Set();
  for (const match of String(html || "").matchAll(/data-product='([^']+)'/g)) {
    let product;
    try {
      product = JSON.parse(decodeAttribute(match[1]));
    } catch {
      continue;
    }
    const title = String(product.title || "").trim();
    const price = Number(product.price);
    const href = String(product.href || "");
    if (!title || !Number.isFinite(price) || price <= 0 || !href.startsWith("/")) continue;
    const url = new URL(href, origin).href;
    if (seen.has(url)) continue;
    seen.add(url);
    items.push({
      title,
      price: `${price} RON`,
      currency: "RON",
      condition: "Nou",
      url,
      imageUrl: product.img || ""
    });
    if (items.length >= limit) break;
  }
  return { items, rawItemCount: items.length, totalResults: null };
}
