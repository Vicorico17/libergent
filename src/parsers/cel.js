function clean(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/&amp;/gi, "&").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
}

export function parseCelHtml(html, limit = 20, { origin = "https://www.cel.ro" } = {}) {
  const items = [];
  const seen = new Set();
  const blocks = String(html || "").split(/<div data-pid_prod="[^"]+" class="product_data\b/i).slice(1);
  for (const block of blocks) {
    const titleMatch = block.match(/<h2 class="productTitle">\s*<a href="([^"]+)"[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/i);
    const priceMatch = block.match(/<span class="price"[^>]*content="([\d.,]+)"/i);
    if (!titleMatch || !priceMatch) continue;
    const title = clean(titleMatch[2]);
    const numericPrice = Number(priceMatch[1].replace(/,/g, "."));
    if (!title || !Number.isFinite(numericPrice) || numericPrice <= 0) continue;
    let url;
    try { url = new URL(titleMatch[1], origin).href; } catch { continue; }
    if (seen.has(url)) continue;
    seen.add(url);
    const imageMatch = block.match(/<div class="productListing-poza">[\s\S]*?<img\s+src="([^"]+)"/i);
    items.push({ title, price: `${numericPrice} RON`, currency: "RON", condition: "Nou", url, imageUrl: imageMatch?.[1] || "" });
    if (items.length >= limit) break;
  }
  return { items, rawItemCount: items.length, totalResults: null };
}
