import { classifyListingIntent } from "../relevance.js";

function clean(value = "") {
  return value.replace(/<[^>]*>/g, " ").replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"').replace(/&nbsp;|&#160;/gi, " ").replace(/\s+/g, " ").trim();
}

export function parseSculeHtml(html, limit = 20, { origin = "https://www.scule.ro", query = "" } = {}) {
  const starts = [...String(html || "").matchAll(/<div\b[^>]*class="[^"]*\bprod-row\b[^"]*"[^>]*>/gi)];
  const items = [];
  const seen = new Set();
  for (const [index, start] of starts.entries()) {
    const block = html.slice(start.index, starts[index + 1]?.index ?? html.length);
    const heading = block.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i)?.[1] || "";
    const href = heading.match(/\bhref="([^"]+)"/i)?.[1];
    const title = clean(heading);
    const priceText = clean(block.match(/<p\b[^>]*class="price"[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "");
    const match = priceText.match(/^([\d.,\s]+)\s*LEI$/i);
    if (!href || !title || !match || !/\badd_to_cart\b/.test(block)) continue;
    const price = Number(match[1].replace(/[\s.]/g, "").replace(",", "."));
    let url;
    try { url = new URL(clean(href), origin); } catch { continue; }
    if (url.origin !== new URL(origin).origin || !/-pr_[a-z0-9]+$/i.test(url.pathname) || seen.has(url.href) || !Number.isFinite(price) || price <= 0) continue;
    seen.add(url.href);
    const image = block.match(/<img\b[^>]*src="([^"]+)"[^>]*>/i)?.[1] || "";
    items.push({ title, price: `${price} RON`, currency: "RON", condition: "Nou", url: url.href, imageUrl: image ? new URL(clean(image), origin).href : "" });
  }
  // Search includes accessories first; rank the complete page before truncating.
  const ranked = query ? items.map((item, index) => ({ item, index, score: classifyListingIntent(item, query).relevanceScore }))
    .sort((a, b) => b.score - a.score || a.index - b.index).map(({ item }) => item) : items;
  return { items: ranked.slice(0, limit), rawItemCount: items.length, totalResults: null, hasNextPage: null };
}
