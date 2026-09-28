function attribute(tag = "", name) {
  return tag.match(new RegExp(`\\b${name}=(["'])(.*?)\\1`, "i"))?.[2]?.replace(/&amp;/gi, "&") || "";
}

export function parseFashionDaysHtml(html, limit) {
  const cards = [...html.matchAll(/<li\b[^>]*class=["'][^"']*\bproduct-card\b[^"']*["'][^>]*>/gi)];
  const items = [];
  const seen = new Set();
  for (let index = 0; index < cards.length && items.length < limit; index += 1) {
    const card = html.slice(cards[index].index, cards[index + 1]?.index ?? html.length);
    const link = card.match(/<a\b(?=[^>]*\bdata-gtm-price=)[^>]*>/i)?.[0] || "";
    const price = Number(attribute(link, "data-gtm-price"));
    const name = attribute(link, "data-gtm-name") || attribute(link, "title");
    const brand = attribute(link, "data-gtm-brand-name");
    const status = attribute(link, "data-gtm-status");
    const image = card.match(/<img\b(?=[^>]*\bdata-original=)[^>]*>/i)?.[0] || "";
    let url;
    try { url = new URL(attribute(link, "href")); } catch { continue; }
    if (url.hostname !== "www.fashiondays.ro" || !url.pathname.startsWith("/p/") || !name ||
      !Number.isFinite(price) || price <= 0 || /sold.?out|unavailable/i.test(status) || seen.has(url.pathname)) continue;
    seen.add(url.pathname);
    items.push({ title: [brand, name].filter(Boolean).join(" "), price: `${price} RON`, currency: "RON",
      location: "", postedAt: "", condition: "Nou", sellerType: "Fashion Days",
      url: `${url.origin}${url.pathname}`, imageUrl: attribute(image, "data-original") });
  }
  return { items, totalResults: null, rawItemCount: cards.length, hasNextPage: null };
}
