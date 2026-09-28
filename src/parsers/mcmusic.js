function clean(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/&amp;/gi, "&").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
}

export function parseMcMusicHtml(html, limit = 20, { origin = "https://www.mcmusic.ro" } = {}) {
  const items = [];
  const seen = new Set();
  const blocks = String(html || "").split(/<div class="js-product-miniature"/i).slice(1);
  for (const block of blocks) {
    const titleMatch = block.match(/<div class="product_name">\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    const priceMatch = block.match(/<span class="price">\s*([\d.,]+(?:\s|&nbsp;)*lei)/i);
    if (!titleMatch || !priceMatch) continue;
    const title = clean(titleMatch[2]);
    const price = clean(priceMatch[1]);
    let url;
    try { url = new URL(titleMatch[1], origin).href; } catch { continue; }
    if (!title || seen.has(url)) continue;
    seen.add(url);
    const imageMatch = block.match(/<img\b[^>]*data-src="([^"]+)"/i);
    items.push({ title, price, currency: "RON", condition: "Nou", url, imageUrl: imageMatch?.[1] || "" });
    if (items.length >= limit) break;
  }
  return { items, rawItemCount: items.length, totalResults: null };
}
