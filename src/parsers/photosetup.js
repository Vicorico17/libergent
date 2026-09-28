function clean(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
}

export function parsePhotoSetupHtml(html, limit = 20, { origin = "https://www.photosetup.ro" } = {}) {
  const items = [];
  const seen = new Set();
  const blocks = String(html || "").split(/<li class="js-pagination-result">/i).slice(1);
  for (const block of blocks) {
    const titleMatch = block.match(/<p class="card__title[^>]*>\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    const priceMatch = block.match(/<span class="price__current">[\s\S]*?<span class="js-value">([\s\S]*?)<\/span>/i);
    if (!titleMatch || !priceMatch) continue;
    const title = clean(titleMatch[2]);
    const price = clean(priceMatch[1]);
    if (!title || !/^\d[\d.,]*\s*lei$/i.test(price)) continue;
    let url;
    try { url = new URL(titleMatch[1], origin).href; } catch { continue; }
    if (!new URL(url).pathname.startsWith("/products/") || seen.has(url)) continue;
    seen.add(url);
    const imageMatch = block.match(/<img\s+srcset="([^\s,]+)[^"]*"[^>]*class="[^"]*card__main-image/i);
    const imageUrl = imageMatch ? new URL(imageMatch[1].replace(/&amp;/g, "&"), origin).href : "";
    items.push({ title, price, currency: "RON", condition: "Nou", url, imageUrl });
    if (items.length >= limit) break;
  }
  return { items, rawItemCount: items.length, totalResults: null };
}
