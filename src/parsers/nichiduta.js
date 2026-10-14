function decode(value = "") {
  return value.replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

export function extractNichidutaCards(html = "") {
  const starts = [...html.matchAll(/<div\b[^>]*class="[^"]*\blisting_product_item\b[^"]*"[^>]*>/gi)];
  const cards = starts.map((match, index) => {
    const block = html.slice(match.index, starts[index + 1]?.index ?? html.length);
    const id = match[0].match(/\brel="(\d+)"/)?.[1];
    const anchor = block.match(/<a\b[^>]*class="[^"]*\bh-prod-name\b[^"]*"[^>]*>/i)?.[0] || "";
    const title = decode(anchor.match(/\btitle="([^"]+)"/)?.[1] || "");
    const path = decode(anchor.match(/\bhref="([^"]+)"/)?.[1] || "");
    if (!id || !title || !path) return null;
    const url = new URL(path, "https://www.nichiduta.ro");
    if (url.hostname !== "www.nichiduta.ro" || url.protocol !== "https:") return null;
    url.hash = "";
    const image = decode(block.match(/\bdata-src="([^"]+)"/)?.[1] || "");
    return { id, title, url: url.href, imageUrl: image ? new URL(image, url.origin).href : "" };
  }).filter(Boolean);
  return [...new Map(cards.map((card) => [card.id, card])).values()];
}

export function parseNichidutaPrices(cards, payload, limit) {
  if (payload?.RESPONSE !== "SUCCESS" || !Array.isArray(payload.products)) {
    throw new Error("Nichiduta catalog prices are unavailable.");
  }
  const prices = new Map(payload.products.map((entry) => [String(entry.Product?.id), entry]));
  const items = cards.flatMap(({ id, ...card }) => {
    const entry = prices.get(id);
    // Match the storefront's displayed price, including active campaigns.
    const value = entry?.BlackFriday?.price ?? entry?.Price?.real_price;
    const price = Math.round(Number(value));
    if (value == null || !Number.isFinite(price) || price <= 0) return [];
    return [{ ...card, price: `${price} RON`, currency: "RON", condition: "Nou", sellerType: "Retailer" }];
  });
  if (cards.length && !items.length) throw new Error("Nichiduta returned product cards without usable prices.");
  return { items: items.slice(0, limit), rawItemCount: cards.length, totalResults: null, hasNextPage: false };
}
