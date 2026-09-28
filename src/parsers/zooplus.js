function decodeText(value = "") {
  return value.replace(/&quot;/gi, '"').replace(/&amp;/gi, "&").replace(/&#39;/gi, "'").trim();
}

export function parseZooplusHtml(html, limit = 20, { origin = "https://www.zooplus.ro" } = {}) {
  const items = [];
  for (const block of String(html || "").matchAll(/<div data-zta="product-card"[\s\S]*?(?=<div data-zta="product-card"|$)/g)) {
    const link = block[0].match(/<a\b[^>]*data-zta="product-info"[^>]*>/i)?.[0] || "";
    const href = link.match(/\bhref="([^"]+)"/i)?.[1] || "";
    const title = decodeText(link.match(/\btitle="([^"]+)"/i)?.[1] || "");
    const price = Number(block[0].match(/<meta\s+itemProp="price"\s+content="([^"]+)"/i)?.[1]);
    if (!href.startsWith("/") || !title || !Number.isFinite(price) || price <= 0) continue;
    const imageTag = block[0].match(/<img\b[^>]*data-zta="product-slider-image"[^>]*>/i)?.[0] || "";
    items.push({
      title,
      price: `${price} RON`,
      currency: "RON",
      condition: "Nou",
      url: new URL(href, origin).href,
      imageUrl: imageTag.match(/\bsrc="([^"]+)"/i)?.[1] || ""
    });
    if (items.length >= limit) break;
  }
  return { items, rawItemCount: items.length, totalResults: null };
}
