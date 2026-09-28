function attribute(tag = "", name) {
  return tag.match(new RegExp(`\\b${name}=(["'])(.*?)\\1`, "i"))?.[2] || "";
}

function text(value = "") {
  return String(value).replace(/<[^>]+>/g, " ").replace(/&nbsp;|\u00a0/gi, " ")
    .replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
}

export function parseMakeupHtml(html, limit) {
  const cards = [...html.matchAll(/<div\b[^>]*class=["'][^"']*\bProductCard__cardContainer\b[^"']*["'][^>]*>/gi)];
  const items = [];
  const seen = new Set();
  for (let index = 0; index < cards.length && items.length < limit; index += 1) {
    const card = html.slice(cards[index].index, cards[index + 1]?.index ?? html.length);
    const link = card.match(/<a\b(?=[^>]*\bclass=["'][^"']*\bProductCard__title\b)[^>]*>/i)?.[0] || "";
    const path = attribute(link, "href");
    const title = text(card.match(/<a\b[^>]*\bclass=["'][^"']*\bProductCard__title\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)?.[1]);
    const subtitle = text(card.match(/<div\b[^>]*\bclass=["'][^"']*\bProductCard__subTitle\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]);
    const priceText = text(card.match(/<span\b[^>]*\bclass=["'][^"']*\bPrice__priceCurrent\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]);
    const price = Number(priceText.match(/[\d\s.,]+/)?.[0]?.replace(/\s/g, "").replace(/,/g, "."));
    const image = card.match(/<img\b[^>]*>/i)?.[0] || "";
    if (!/^\/product\/\d+\/$/.test(path) || !title || !Number.isFinite(price) || price <= 0 || seen.has(path)) continue;
    seen.add(path);
    items.push({ title: [title, subtitle].filter(Boolean).join(" — "), price: `${price} RON`, currency: "RON",
      location: "", postedAt: "", condition: "Nou", sellerType: "MAKEUP", url: `https://makeup.ro${path}`,
      imageUrl: attribute(image, "src") });
  }
  return { items, totalResults: null, rawItemCount: cards.length, hasNextPage: null };
}
