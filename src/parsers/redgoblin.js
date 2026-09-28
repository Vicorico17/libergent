function clean(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/&amp;/gi, "&").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
}

export function parseRedGoblinHtml(html, limit = 20, { origin = "https://redgoblin.ro" } = {}) {
  const items = [];
  const seen = new Set();
  const blocks = String(html || "").split(/<li\s+class="productgrid--item\b/i).slice(1);
  for (const block of blocks) {
    const titleMatch = block.match(/<h2 class="productitem--title">\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    const priceMatch = block.match(/<span class="money" data-price>\s*([\s\S]*?)<\/span>/i);
    if (!titleMatch || !priceMatch) continue;
    const title = clean(titleMatch[2]);
    const price = clean(priceMatch[1]);
    if (!title || !/^\d[\d.,]*\s*lei$/i.test(price)) continue;
    let url;
    try { url = new URL(titleMatch[1], origin).href; } catch { continue; }
    if (!new URL(url).pathname.startsWith("/products/") || seen.has(url)) continue;
    seen.add(url);
    const imageMatch = block.match(/<img\s[^>]*src="([^"]+\.\w+(?:\?[^"]*)?)"[^>]*data-rimg="noscript"/i);
    const imageUrl = imageMatch ? new URL(imageMatch[1], origin).href : "";
    items.push({ title, price, currency: "RON", condition: "Nou", url, imageUrl });
    if (items.length >= limit) break;
  }
  return { items, rawItemCount: items.length, totalResults: null };
}
