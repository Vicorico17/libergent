function cleanText(value = "") {
  return decodeHtmlEntities(
    value
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function decodeHtmlEntities(value = "") {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)));
}

function toAbsoluteUrl(url = "") {
  const value = cleanText(url);
  if (!value) {
    return "";
  }
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  if (value.startsWith("//")) {
    return `https:${value}`;
  }
  if (value.startsWith("/")) {
    return `https://www.okazii.ro${value}`;
  }
  return value;
}

function parseJsonLdScripts(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((match) => {
      try {
        return JSON.parse(match[1]);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function normalizeCondition(conditionUrl = "") {
  if (conditionUrl.includes("NewCondition")) {
    return "Nou";
  }
  if (conditionUrl.includes("UsedCondition")) {
    return "Utilizat";
  }
  return "";
}

function normalizeOfferPrice(offer) {
  if (!Number.isFinite(offer.price)) {
    return "";
  }

  const currency = cleanText(offer.priceCurrency || "");
  return `${offer.price} ${currency}`.trim();
}

function splitListingBlocks(html) {
  return html
    .split(/<div class="lising-old-li\b[^>]*>/i)
    .slice(1)
    .map((block) => block.split(/<div class="lising-old-li\b[^>]*>/i)[0])
    .filter((block) => block.includes('class="list-item'));
}

function parseListingCard(block) {
  const titleMatch =
    block.match(/<div class="item-title"[\s\S]*?<a[^>]+href="([^"]+)"[^>]*title="([^"]*)"[^>]*>/i) ||
    block.match(/<div class="item-title"[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
  const imageMatch = block.match(/<img[^>]+src="([^"]+)"/i);
  const priceMatches = [...cleanText(block).matchAll(/\d[\d.\s]*,\s*\d{2}\s*Lei/gi)];
  const title = cleanText(titleMatch?.[2] || "");
  const url = toAbsoluteUrl(titleMatch?.[1] || "");
  const price = priceMatches.length
    ? cleanText(priceMatches.at(-1)?.[0] || "").replace(/\s*,\s*/g, ",")
    : "";

  if (!title || !url) {
    return null;
  }

  return {
    title,
    price,
    currency: /\blei\b/i.test(price) ? "Lei" : "",
    location: "",
    postedAt: "",
    condition: "",
    sellerType: "",
    url,
    imageUrl: toAbsoluteUrl(imageMatch?.[1] || "")
  };
}

function parseSearchListingItems(html, limit) {
  const items = splitListingBlocks(html)
    .map(parseListingCard)
    .filter(Boolean);

  return items.slice(0, limit);
}

function parseSearchTotalResults(html) {
  const metaCountMatch =
    html.match(/content="(\d+)\s+oferte\b[^"]*"/i) ||
    html.match(/>\s*(\d+)\s+oferte\b/i);
  if (metaCountMatch) {
    const value = Number.parseInt(metaCountMatch[1], 10);
    return Number.isFinite(value) ? value : null;
  }

  if (/rel="next"/i.test(html) || /[?&]page=2\b/i.test(html)) {
    return null;
  }

  return null;
}

function hasSearchNextPage(html) {
  return /rel="next"/i.test(html) || /[?&]page=\d+/i.test(html);
}

function parseJsonLdOffers(html, limit) {
  const jsonLdObjects = parseJsonLdScripts(html);
  const product = jsonLdObjects
    .flatMap((entry) => entry["@graph"] || entry)
    .find((entry) => entry?.["@type"] === "Product" && entry?.offers?.offers);

  const offers = product?.offers?.offers?.flat?.() || [];
  const items = offers.slice(0, limit).map((offer) => ({
    title: cleanText(offer.name || ""),
    price: normalizeOfferPrice(offer),
    currency: cleanText(offer.priceCurrency || ""),
    location: "",
    postedAt: "",
    condition: normalizeCondition(offer.itemCondition),
    sellerType: cleanText(offer.seller?.name || ""),
    url: toAbsoluteUrl(offer.url || ""),
    imageUrl: toAbsoluteUrl(offer.image || "")
  }));

  return {
    items,
    totalResults: Number.isFinite(product?.offers?.offerCount) ? product.offers.offerCount : items.length
  };
}

export function parseOkaziiHtml(html, limit) {
  const searchItems = parseSearchListingItems(html, limit);
  if (searchItems.length) {
    return {
      items: searchItems,
      totalResults: parseSearchTotalResults(html),
      rawItemCount: splitListingBlocks(html).length,
      hasNextPage: hasSearchNextPage(html)
    };
  }

  const parsed = parseJsonLdOffers(html, limit);
  return {
    ...parsed,
    rawItemCount: parsed.items.length,
    hasNextPage: parsed.totalResults ? parsed.totalResults > parsed.items.length : null
  };
}
