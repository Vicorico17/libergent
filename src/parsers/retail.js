import { extractImageCandidate } from "./image.js";

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

function stripTags(value = "") {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function cleanText(value = "") {
  return decodeHtmlEntities(String(value || "").replace(/\s+/g, " ").trim());
}

function toAbsoluteUrl(url = "", origin) {
  const value = cleanText(url);
  if (!value || value.startsWith("#") || /^javascript:/i.test(value) || /^mailto:/i.test(value)) {
    return "";
  }
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  if (value.startsWith("//")) {
    return `https:${value}`;
  }
  if (value.startsWith("/")) {
    return `${origin}${value}`;
  }
  return `${origin}/${value.replace(/^\/+/, "")}`;
}

function parseJsonLdScripts(html) {
  return [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap((match) => {
      try {
        const parsed = JSON.parse(match[1].trim());
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [];
      }
    });
}

function flattenJsonLd(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(flattenJsonLd);
  }
  if (typeof value === "object") {
    return [value, ...flattenJsonLd(value["@graph"]), ...flattenJsonLd(value.itemListElement)];
  }
  return [];
}

function normalizeJsonLdProduct(entry, origin) {
  const product = entry?.item && typeof entry.item === "object" ? entry.item : entry;
  const type = Array.isArray(product?.["@type"]) ? product["@type"].join(" ") : product?.["@type"];
  if (!/Product|Offer/i.test(String(type || ""))) {
    return null;
  }

  const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers || product;
  const imageValue = Array.isArray(product.image) ? product.image[0] : product.image;
  const title = cleanText(product.name || offer.name || "");
  const url = toAbsoluteUrl(product.url || offer.url || "", origin);
  const priceValue = offer.lowPrice || offer.price || product.lowPrice || product.price || "";
  const currency = cleanText(offer.priceCurrency || product.priceCurrency || "");

  if (!title || !url || !Number.isFinite(Number(priceValue)) || Number(priceValue) <= 0) {
    return null;
  }

  return {
    title,
    price: priceValue ? `${priceValue} ${currency}`.trim() : "",
    currency,
    location: "",
    postedAt: "",
    condition: "Nou",
    sellerType: cleanText(offer.seller?.name || ""),
    url,
    imageUrl: toAbsoluteUrl(imageValue || "", origin)
  };
}

function parseJsonLdProducts(html, origin, limit) {
  return parseJsonLdScripts(html)
    .flatMap(flattenJsonLd)
    .map((entry) => normalizeJsonLdProduct(entry, origin))
    .filter(Boolean)
    .slice(0, limit);
}

function findPrice(block) {
  const text = stripTags(block);
  const pattern = /(?:de la|pret de la|preț de la)?\s*(\d{1,3}(?:(?:[.\s]\d{3})+|(?:,\d{3})+)(?:[,.]\d{2})?|\d+(?:[,.]\d{2})?)\s*(lei|ron|€|eur)(?:\b|$)/gi;
  const matches = [...text.matchAll(pattern)];
  const match = matches[0];
  if (!match) return "";
  const numericValue = Number(match[1].replace(/\./g, "").replace(/,/g, "."));
  return Number.isFinite(numericValue) && numericValue > 0
    ? match[1].trim() + " " + match[2]
    : "";
}

function normalizeTitle(rawTitle = "") {
  return stripTags(rawTitle)
    .replace(/\b(adauga in cos|vezi oferta|compara preturi|detalii|favorite)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyProductUrl(url, origin) {
  try {
    const parsed = new URL(url);
    if (parsed.origin !== origin) {
      return false;
    }
    const path = parsed.pathname.toLowerCase();
    return ![
      "/",
      "/login",
      "/account",
      "/cart",
      "/checkout",
      "/contact",
      "/privacy"
    ].includes(path) && !/\/(?:blog|review|reviews|forum|help|customer|account|login|cart|checkout)(?:\/|$)/i.test(path);
  } catch {
    return false;
  }
}

function parseAnchorProducts(html, origin, limit) {
  const matches = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const items = [];
  const seen = new Set();

  for (const match of matches) {
    if (items.length >= limit) {
      break;
    }

    const url = toAbsoluteUrl(match[1], origin);
    if (!url || seen.has(url) || !isLikelyProductUrl(url, origin)) {
      continue;
    }

    const start = Math.max(0, match.index - 900);
    const end = Math.min(html.length, match.index + match[0].length + 5000);
    const block = html.slice(start, end);
    const title =
      normalizeTitle(match[0].match(/\b(?:title|aria-label)=["']([^"']+)["']/i)?.[1] || "") ||
      normalizeTitle(match[2].match(/\balt=["']([^"']+)["']/i)?.[1] || "") ||
      normalizeTitle(match[2]);
    const price = findPrice(block);

    if (!title || title.length < 3 || !price) {
      continue;
    }

    seen.add(url);
    items.push({
      title,
      price,
      currency: /\b(?:lei|ron)\b/i.test(price) ? "RON" : /€|eur/i.test(price) ? "EUR" : "",
      location: "",
      postedAt: "",
      condition: "Nou",
      sellerType: "",
      url,
      imageUrl: toAbsoluteUrl(extractImageCandidate(block), origin)
    });
  }

  return items;
}

function splitClassBlocks(html, className) {
  const pattern = /<[^>]+class=["']([^"']*)["'][^>]*>/gi;
  const matches = [...html.matchAll(pattern)].filter((match) =>
    match[1].split(/\s+/).includes(className)
  );
  return matches.map((match, index) => {
    const start = match.index;
    const end = matches[index + 1]?.index ?? html.length;
    return html.slice(start, end);
  });
}

function parseProductListBlock(block, origin) {
  const title =
    normalizeTitle(block.match(/<b[^>]+class=["'][^"']*\btitlu\b[^"']*["'][^>]*>([\s\S]*?)<\/b>/i)?.[1] || "") ||
    normalizeTitle(block.match(/\balt=["']([^"']+)["']/i)?.[1] || "");
  const url = toAbsoluteUrl(block.match(/<a\b[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] || "", origin);
  const price = findPrice(block);

  if (!title || !url || !price) {
    return null;
  }

  return {
    title,
    price,
    currency: /\b(?:lei|ron)\b/i.test(price) ? "RON" : /€|eur/i.test(price) ? "EUR" : "",
    location: "",
    postedAt: "",
    condition: "Nou",
    sellerType: "",
    url,
    imageUrl: toAbsoluteUrl(extractImageCandidate(block), origin)
  };
}

function parseProductListBlocks(html, origin, limit) {
  return splitClassBlocks(html, "produs-lista")
    .map((block) => parseProductListBlock(block, origin))
    .filter(Boolean)
    .slice(0, limit);
}

function parseDataProductJson(value = "") {
  const decoded = decodeHtmlEntities(value);
  try {
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function parseEmagProductBlock(block, origin) {
  const product = parseDataProductJson(block.match(/data-product=["']([^"']+)["']/i)?.[1] || "");
  const title =
    cleanText(product?.product_name || "") ||
    normalizeTitle(block.match(/class=["'][^"']*card-v2-title[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)?.[1] || "") ||
    normalizeTitle(block.match(/aria-label=["']([^"']+)["']/i)?.[1] || "");
  const url = toAbsoluteUrl(
    block.match(/<a\b[^>]+class=["'][^"']*js-product-url[^"']*["'][^>]+href=["']([^"']+)["']/i)?.[1] ||
    block.match(/<a\b[^>]+href=["']([^"']+)["'][^>]+class=["'][^"']*js-product-url/i)?.[1] ||
    "",
    origin
  );
  const numericPrice = Number(product?.price);
  const currency = cleanText(product?.currency || "RON");
  const price = Number.isFinite(numericPrice) && numericPrice > 0 ? String(numericPrice) + " " + currency : findPrice(block);

  if (!title || !url || !price) {
    return null;
  }

  return {
    title,
    price,
    currency,
    location: "",
    postedAt: "",
    condition: "Nou",
    sellerType: "Retailer / marketplace",
    url,
    imageUrl: toAbsoluteUrl(block.match(/<img\b[^>]+src=["']([^"']+)["']/i)?.[1] || "", origin)
  };
}

function parseEmagBlocks(html, origin, limit) {
  return splitClassBlocks(html, "card-v2")
    .map((block) => parseEmagProductBlock(block, origin))
    .filter(Boolean)
    .slice(0, limit);
}

function parseEvomagProducts(html, origin, limit) {
  const matches = [...html.matchAll(/<a\b[^>]*href=["']([^"']+\.html)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const items = [];
  const seen = new Set();

  for (const match of matches) {
    if (items.length >= limit) break;
    const url = toAbsoluteUrl(match[1], origin);
    if (!url || seen.has(url) || !isLikelyProductUrl(url, origin)) continue;

    const start = Math.max(0, match.index - 300);
    const end = Math.min(html.length, match.index + match[0].length + 1200);
    const block = html.slice(start, end);
    const title =
      normalizeTitle(match[0].match(/\btitle=["']([^"']+)["']/i)?.[1] || "") ||
      normalizeTitle(match[2].match(/\balt=["']([^"']+)["']/i)?.[1] || "") ||
      normalizeTitle(match[2]);
    const price = findPrice(block);

    if (!title || title.length < 8 || !price) continue;

    seen.add(url);
    items.push({
      title,
      price,
      currency: /\b(?:lei|ron)\b/i.test(price) ? "RON" : /€|eur/i.test(price) ? "EUR" : "",
      location: "",
      postedAt: "",
      condition: "Nou",
      sellerType: "Retailer",
      url,
      imageUrl: toAbsoluteUrl(extractImageCandidate(block), origin)
    });
  }

  return items;
}

export function parseEmagHtml(html, limit, { origin }) {
  const items = dedupeItems(parseEmagBlocks(html, origin, limit)).slice(0, limit);
  return {
    items,
    totalResults: null,
    rawItemCount: items.length,
    hasNextPage: null
  };
}

export function parseEvomagHtml(html, limit, { origin }) {
  const items = dedupeItems(parseEvomagProducts(html, origin, limit)).slice(0, limit);
  return {
    items,
    totalResults: null,
    rawItemCount: items.length,
    hasNextPage: null
  };
}

function dedupeItems(items) {
  const seen = new Set();
  const output = [];

  for (const item of items) {
    const key = item.url || `${item.title}::${item.price}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(item);
  }

  return output;
}

export function parseRetailHtml(html, limit, { origin }) {
  const items = dedupeItems([
    ...parseProductListBlocks(html, origin, limit),
    ...parseJsonLdProducts(html, origin, limit),
    ...parseAnchorProducts(html, origin, limit)
  ]).slice(0, limit);

  return {
    items,
    totalResults: null,
    rawItemCount: items.length,
    hasNextPage: null
  };
}
