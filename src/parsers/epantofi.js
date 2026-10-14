function text(value = "") {
  return value.replace(/<[^>]*>/g, " ").replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"').replace(/&#39;/g, "'").replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, " ").trim();
}

export function parseEpantofiHtml(html, limit = 20, { origin = "https://epantofi.ro" } = {}) {
  const items = [];
  const seen = new Set();
  // Restrict extraction to real product cards, excluding menus and promotion prices.
  for (const match of String(html || "").matchAll(/<li\b[^>]*data-product-card="[^"]*"[^>]*>([\s\S]*?)<\/li>/gi)) {
    const card = match[1];
    const anchor = card.match(/<a\b[^>]*class="[^"]*\bproduct-card-link\b[^"]*"[^>]*>/i)?.[0] || "";
    const href = anchor.match(/\bhref="([^"]+)"/i)?.[1];
    const image = card.match(/<img\b[^>]*>/i)?.[0] || "";
    const title = text(image.match(/\balt="([^"]+)"/i)?.[1] || "");
    const priceBlock = card.match(/<div\b[^>]*class="[^"]*\bprice-wrapper\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || "";
    const amount = priceBlock.match(/<span\b[^>]*>\s*([\d.,\s]+)\s*<\/span>/i)?.[1];
    if (!href || !title || !amount || !/\bLei\b/i.test(text(priceBlock))) continue;
    const price = Number(amount.replace(/[\s.]/g, "").replace(",", "."));
    let url;
    try { url = new URL(text(href), origin); } catch { continue; }
    if (url.origin !== new URL(origin).origin || !url.pathname.startsWith("/p/") || seen.has(url.href) || !Number.isFinite(price) || price <= 0) continue;
    seen.add(url.href);
    items.push({ title, price: `${price} RON`, currency: "RON", condition: "Nou", url: url.href,
      imageUrl: text(image.match(/\bsrc="([^"]+)"/i)?.[1] || "") });
  }
  return { items: items.slice(0, limit), rawItemCount: items.length, totalResults: null, hasNextPage: null };
}
