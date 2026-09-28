function plainText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseTheHomeHtml(html, limit = 20, { origin = "https://www.thehome.ro" } = {}) {
  const items = [];
  const seen = new Set();
  const blocks = String(html || "").split(/<div class="product product--grid">/i).slice(1);
  for (const block of blocks) {
    const product = block.split(/<div class="product product--grid">/i, 1)[0];
    const titleMatch = product.match(/<a class="product__name" href="([^"]+)">([\s\S]*?)<\/a>/i);
    const priceMatch = product.match(/class="product__info product__info--price-gross"[\s\S]*?<span>([\s\S]*?)<\/span>/i);
    if (!titleMatch || !priceMatch) continue;
    const title = plainText(titleMatch[2]);
    const price = plainText(priceMatch[1]);
    if (!title || !/\d[\d.]*\s*RON/i.test(price)) continue;
    let url;
    try { url = new URL(titleMatch[1], origin).href; } catch { continue; }
    if (seen.has(url)) continue;
    seen.add(url);
    const imageMatch = product.match(/class="grid-image__image lazyload"[^>]*data-src="([^"]+)"/i)
      || product.match(/data-src="([^"]+)"[^>]*class="grid-image__image lazyload"/i);
    items.push({ title, price, currency: "RON", condition: "Nou", url, imageUrl: imageMatch?.[1] || "" });
    if (items.length >= limit) break;
  }
  return { items, rawItemCount: items.length, totalResults: null };
}
