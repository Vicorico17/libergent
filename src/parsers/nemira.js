function clean(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
}

export function parseNemiraHtml(html, limit = 20, { origin = "https://nemira.ro" } = {}) {
  const items = [];
  const seen = new Set();
  for (const match of String(html || "").matchAll(/<form\b[^>]*class="product_addtocart_form[^"]*"[^>]*>([\s\S]*?)<\/form>/gi)) {
    const block = match[1];
    const info = block.match(/<div class="product-info[^>]*>([\s\S]*?)<div class="flex">/i)?.[1] || "";
    const titleMatch = info.match(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    const priceMatch = block.match(/data-price-amount="([0-9.]+)"\s+data-price-type="finalPrice"/i);
    if (!titleMatch || !priceMatch) continue;
    const title = clean(titleMatch[2]);
    const priceValue = Number(priceMatch[1]);
    if (!title || !Number.isFinite(priceValue) || priceValue <= 0) continue;
    let url;
    try { url = new URL(titleMatch[1], origin).href; } catch { continue; }
    if (seen.has(url)) continue;
    seen.add(url);
    const imageMatch = block.match(/<img\b[^>]*class="[^"]*product-image-photo[^"]*"[^>]*src="([^"]+)"/i);
    items.push({ title, price: `${priceValue} RON`, currency: "RON", condition: "Nou", url, imageUrl: imageMatch?.[1] || "" });
    if (items.length >= limit) break;
  }
  return { items, rawItemCount: items.length, totalResults: null };
}
