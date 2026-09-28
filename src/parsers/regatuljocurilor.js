function plainText(value = "") {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
}

export function parseRegatulJocurilorHtml(html, limit = 20, { origin = "https://regatuljocurilor.ro" } = {}) {
  const items = [];
  for (const block of String(html || "").matchAll(/<div class="product-miniature js-product-miniature"[\s\S]*?(?=<div class="product-miniature js-product-miniature"|$)/g)) {
    const titleLink = block[0].match(/<h3\b[^>]*class="[^"]*product-title[^"]*"[^>]*>\s*<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    const title = plainText(titleLink?.[2]);
    const url = titleLink?.[1] || "";
    const price = plainText(block[0].match(/<span\b[^>]*class="price"[^>]*>([\s\S]*?)<\/span>/i)?.[1]);
    if (!title || !url || !/\d/.test(price)) continue;
    const image = block[0].match(/<img\b[^>]*data-src\s*=\s*"([^"]+)"/i)?.[1] || "";
    items.push({
      title,
      price,
      currency: /RON|lei/i.test(price) ? "RON" : "",
      condition: "Nou",
      url: new URL(url, origin).href,
      imageUrl: image
    });
    if (items.length >= limit) break;
  }
  return { items, rawItemCount: items.length, totalResults: null };
}
