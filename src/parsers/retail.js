import { productCondition } from "../product-condition.js";
import { normalizeListing } from "../normalize.js";
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

  const offers = Array.isArray(product.offers) ? product.offers : [product.offers || product];
  const offer = offers.find(candidate => candidate && typeof candidate === "object" &&
    !/OutOfStock|SoldOut|Discontinued/i.test(String(candidate.availability || product.availability || "")) &&
    !/DamagedCondition/i.test(String(candidate.itemCondition || product.itemCondition || "")) &&
    Number(candidate.price ?? candidate.lowPrice ?? product.price ?? product.lowPrice) > 0);
  if (!offer) return null;
  const imageValue = Array.isArray(product.image) ? product.image[0] : product.image;
  const title = cleanText(product.name || offer.name || "");
  const url = toAbsoluteUrl(product.url || offer.url || "", origin);
  const priceValue = offer.price ?? offer.lowPrice ?? product.price ?? product.lowPrice ?? "";
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
    condition: productCondition(offer.itemCondition || product.itemCondition) === "used" ? "Recondiționat / folosit" : "Nou",
    sellerType: cleanText(offer.seller?.name || ""),
    url,
    imageUrl: toAbsoluteUrl(typeof imageValue === "object" ? imageValue?.url || "" : imageValue || "", origin)
  };
}

function parseJsonLdProducts(html, origin, limit) {
  return parseJsonLdScripts(html)
    .flatMap(flattenJsonLd)
    .map((entry) => normalizeJsonLdProduct(entry, origin))
    .filter(Boolean)
    .slice(0, limit);
}

// Balanced ranges keep neighboring product prices and images out of a card.
function elementRanges(html) {
  const stack = [];
  const ranges = [];
  const voidTags = new Set(["img", "input", "meta", "link", "br", "hr", "source", "area", "wbr"]);
  for (const match of html.matchAll(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi)) {
    const tag = match[1].toLowerCase();
    if (match[0].startsWith("</")) {
      const index = stack.findLastIndex(entry => entry.tag === tag);
      if (index < 0) continue;
      for (const entry of stack.splice(index)) ranges.push({ ...entry, end: match.index + match[0].length });
    } else if (!voidTags.has(tag) && !match[0].endsWith("/>")) {
      stack.push({ tag, start: match.index, open: match[0], contentStart: match.index + match[0].length });
    }
  }
  return ranges;
}

function cardForAnchor(html, match, matches, ranges) {
  const containing = ranges.filter(range => range.start <= match.index && range.end >= match.index + match[0].length &&
    (["article", "li"].includes(range.tag) || (["div", "section"].includes(range.tag) &&
      (range.open.match(/class=["']([^"']*)/i)?.[1] || "").split(/\s+/).some(name => ["product", "product-card", "product-item", "produs-lista", "card-v2"].includes(name)))));
  const card = containing.sort((a, b) => (a.end - a.start) - (b.end - b.start))[0];
  if (card) return html.slice(card.start, card.end);
  // Unstructured fallback starts at this product and stops at the next URL.
  const next = matches.find(candidate => candidate.index > match.index && candidate[1] !== match[1]);
  return html.slice(match.index, Math.min(next?.index ?? html.length, match.index + match[0].length + 1200));
}

function findPrice(block) {
  const excluded = /(?:old|regular|original|rrp|installment|monthly|shipping|delivery|transport|rate|rata|bonus|voucher)/i;
  const ranges = elementRanges(block);
  const ignored = ranges.filter(range => ["del", "s", "script", "style"].includes(range.tag) ||
    excluded.test(range.open.match(/class=["']([^"']*)/i)?.[1] || ""));
  const priceRanges = ranges.filter(range => /(?:itemprop=["']price["']|class=["'][^"']*(?:price|pret))/i.test(range.open) &&
    !ignored.some(other => range.start >= other.start && range.end <= other.end));
  let priceBlock = block;
  for (const range of ignored) priceBlock = priceBlock.slice(0, range.start) + " ".repeat(range.end - range.start) + priceBlock.slice(range.end);
  const leafPrices = priceRanges.filter(range => !priceRanges.some(child => child.start > range.start && child.end < range.end));
  const candidates = leafPrices.length ? leafPrices.map(range => priceBlock.slice(range.start, range.end)) : [priceBlock];
  for (const candidate of candidates) {
    // Remove crossed-out amounts even inside a price wrapper.
    const cleaned = candidate.replace(/<(del|s|script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
    const text = stripTags(cleaned).replace(/(\d)\s+([,.])\s*(\d{2})\b/g, "$1$2$3");
    const pattern = /(\d{1,3}(?:(?:[.\s]\d{3})+|(?:,\d{3})+)(?:[,.]\d{2})?|\d+(?:[,.]\d{2})?)\s*(lei|ron|€|eur)(?=\W|$)/gi;
    for (const match of text.matchAll(pattern)) {
      const before = text.slice(Math.max(0, match.index - 35), match.index);
      const after = text.slice(match.index + match[0].length, match.index + match[0].length + 25);
      if (/(?:transport|livrare|rata|rate|lunar|bonus|voucher|economis|pret vechi)[^.!;:]*:?\s*$/i.test(before) || /^\s*(?:\/\s*luna|pe luna|lunar|bonus|cashback|voucher)\b/i.test(after)) continue;
      const price = `${match[1].trim()} ${match[2]}`;
      if (normalizeListing({ price }).numericPrice > 0) return price;
    }
  }
  return "";
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
  const ranges = elementRanges(html);

  for (const match of matches) {
    if (items.length >= limit) {
      break;
    }

    const url = toAbsoluteUrl(match[1], origin);
    if (!url || seen.has(url) || !isLikelyProductUrl(url, origin)) {
      continue;
    }

    const block = cardForAnchor(html, match, matches, ranges);
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
      condition: productCondition(title) === "used" ? "Recondiționat / folosit" : "Nou",
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
    condition: productCondition(title) === "used" ? "Recondiționat / folosit" : "Nou",
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
    condition: productCondition(title) === "used" ? "Recondiționat / folosit" : "Nou",
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
  // Search pages include navigation promotions before the actual result list.
  // Never let those unrelated offers consume the result limit or supply prices.
  const pageRanges = elementRanges(html);
  const results = pageRanges.find(range =>
    (range.open.match(/class=["']([^"']*)/i)?.[1] || "").split(/\s+/).includes("produse_liste_filter"));
  if (results) html = html.slice(results.start, results.end);
  else if (/class=["'][^"']*\bindex-category-menu\b/i.test(html)) return [];
  const matches = [...html.matchAll(/<a\b[^>]*href=["']([^"']+\.html)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const items = [];
  const seen = new Set();
  const ranges = elementRanges(html);

  for (const match of matches) {
    if (items.length >= limit) break;
    const url = toAbsoluteUrl(match[1], origin);
    if (!url || seen.has(url) || !isLikelyProductUrl(url, origin)) continue;

    const block = cardForAnchor(html, match, matches, ranges);
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
      condition: productCondition(title) === "used" ? "Recondiționat / folosit" : "Nou",
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
  const unavailableUrls = new Set(parseJsonLdScripts(html).flatMap(flattenJsonLd).flatMap(entry => {
    const product = entry?.item || entry;
    const offers = Array.isArray(product?.offers) ? product.offers : [product?.offers || product];
    return offers.length && offers.every(offer => /OutOfStock|SoldOut|Discontinued/i.test(String(offer?.availability || product?.availability || "")) || /DamagedCondition/i.test(String(offer?.itemCondition || product?.itemCondition || "")))
      ? [toAbsoluteUrl(product.url || offers[0]?.url || "", origin)] : [];
  }));
  const items = dedupeItems([
    ...parseJsonLdProducts(html, origin, limit),
    ...parseProductListBlocks(html, origin, limit),
    ...parseAnchorProducts(html, origin, limit)
  ]).filter(item => !unavailableUrls.has(item.url)).slice(0, limit);

  return {
    items,
    totalResults: null,
    rawItemCount: items.length,
    hasNextPage: null
  };
}
