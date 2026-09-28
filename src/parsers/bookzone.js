function decode(value = "") {
  return String(value).replace(/&quot;/gi, '"').replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function attribute(tag = "", name) {
  return decode(tag.match(new RegExp(`\\b${name}=(["'])(.*?)\\1`, "i"))?.[2] || "");
}

export function parseBookzoneHtml(html, limit, { origin }) {
  const cards = [...html.matchAll(/<div\b[^>]*class=["'][^"']*\bcat-content__item\b[^"']*["'][^>]*>/gi)];
  const items = [];
  const seen = new Set();
  for (let index = 0; index < cards.length && items.length < limit; index += 1) {
    const card = html.slice(cards[index].index, cards[index + 1]?.index ?? html.length);
    if (/title=["']Produs indisponibil["']/i.test(card)) continue;
    const titleLink = card.match(/<a\b(?=[^>]*\bclass=["'][^"']*\bpi-a\b)[^>]*>/i)?.[0] || "";
    const image = card.match(/<img\b(?=[^>]*\bclass=["'][^"']*\bpi-img\b)[^>]*>/i)?.[0] || "";
    const priceText = card.match(/<span\b[^>]*class=["'][^"']*\bpi-price\b[^"']*["'][^>]*>([^<]+)<\/span>/i)?.[1] || "";
    const price = Number(priceText.match(/[\d.,]+/)?.[0]?.replace(/,/g, "."));
    const path = attribute(titleLink, "href");
    const url = path.startsWith("/carte/") || path.startsWith("/p/") ? `${origin}${path}` : "";
    const title = attribute(titleLink, "title") || attribute(image, "alt");
    if (!url || !title || !Number.isFinite(price) || price <= 0 || seen.has(url)) continue;
    seen.add(url);
    items.push({ title, price: `${price} Lei`, currency: "RON", location: "", postedAt: "",
      condition: "Nou", sellerType: "Bookzone", url, imageUrl: attribute(image, "src") });
  }
  return { items, totalResults: null, rawItemCount: items.length, hasNextPage: null };
}
