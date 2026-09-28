function decode(value = "") {
  return String(value).replace(/&quot;/gi, '"').replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function attribute(tag = "", name) {
  return decode(tag.match(new RegExp(`\\b${name}=(["'])(.*?)\\1`, "i"))?.[2] || "");
}

export function parseIkeaHtml(html, limit) {
  const cards = [...html.matchAll(/<div\b(?=[^>]*\bdata-testid=["']plp-product-card["'])[^>]*>/gi)];
  const items = [];
  const seen = new Set();
  for (let index = 0; index < cards.length && items.length < limit; index += 1) {
    const card = html.slice(cards[index].index, cards[index + 1]?.index ?? html.length);
    const root = cards[index][0];
    const price = Number(attribute(root, "data-price"));
    const currency = attribute(root, "data-currency") || "RON";
    const imageLink = card.match(/<a\b(?=[^>]*\bclass=["'][^"']*\bplp-product__image-link\b)[^>]*>/i)?.[0] || "";
    const titleLink = card.match(/<a\b(?=[^>]*\bclass=["'][^"']*\bplp-price-module__product-link\b)[^>]*>/i)?.[0] || "";
    const image = card.slice(card.indexOf(imageLink) + imageLink.length).match(/^\s*<img\b[^>]*>/i)?.[0] || "";
    const url = attribute(imageLink, "href");
    const title = attribute(titleLink, "aria-label") || attribute(image, "alt");
    if (!url.startsWith("https://www.ikea.com/ro/ro/p/") || !title || !Number.isFinite(price) || price <= 0 || seen.has(url)) continue;
    seen.add(url);
    items.push({ title, price: `${price} ${currency}`, currency, location: "", postedAt: "",
      condition: "Nou", sellerType: "IKEA", url, imageUrl: attribute(image, "src") });
  }
  return { items, totalResults: null, rawItemCount: items.length, hasNextPage: null };
}
