function clean(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/&amp;/gi, "&").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
}

export function parseLibrisHtml(html, limit = 20, { origin = "https://www.libris.ro" } = {}) {
  const items = [];
  const seen = new Set();
  const blocks = String(html || "").split(/<li class="categ-prod-item gtmContainer"/i).slice(1);
  for (const block of blocks) {
    const titleMatch = block.match(/<a href="([^"]+)"[^>]*>\s*<h3 class="pr-title-categ-pg">([\s\S]*?)<\/h3>/i);
    const priceMatch = block.match(/<p class="price-reduced(?:\s+[^\"]*)?">\s*([\d.,]+\s*Lei)/i);
    if (!titleMatch || !priceMatch) continue;
    const title = clean(titleMatch[2]);
    const price = clean(priceMatch[1]);
    let url;
    try { url = new URL(titleMatch[1], origin).href; } catch { continue; }
    if (!title || !new URL(url).pathname.startsWith("/carte/") || seen.has(url)) continue;
    seen.add(url);
    const imageMatch = block.match(/<img[^>]*src="([^"]+)"[^>]*alt="Coperta/i);
    items.push({ title, price, currency: "RON", condition: "Nou", url, imageUrl: imageMatch?.[1] || "" });
    if (items.length >= limit) break;
  }
  return { items, rawItemCount: items.length, totalResults: null };
}
