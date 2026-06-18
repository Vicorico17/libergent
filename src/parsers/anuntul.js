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

function cleanText(value = "") {
  return decodeHtmlEntities(value.replace(/\s+/g, " ").trim());
}

function stripTags(value = "") {
  return cleanText(value.replace(/<[^>]+>/g, " "));
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
    return `https://www.anuntul.ro${value}`;
  }
  return `https://www.anuntul.ro/${value.replace(/^\/+/, "")}`;
}

function splitListingBlocks(html) {
  const matches = [...html.matchAll(/<div\b[^>]*class="[^"]*\bitm\b[^"]*"[^>]*>/gi)];
  return matches.map((match, index) => {
    const start = match.index;
    const end = matches[index + 1]?.index ?? html.length;
    return html.slice(start, end);
  });
}

function parsePrice(block) {
  const priceBlock = block.match(/<div[^>]+class="[^"]*\bcard-text\b[^"]*\btext-red-at\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || "";
  const price = stripTags(priceBlock);
  const match = price.match(/(\d[\d.,\s]*)\s*(RON|Lei|EUR|€)(?:\b|$)/i);
  return match ? `${match[1].trim()} ${match[2]}` : price;
}

function parseCurrency(price = "") {
  if (/\b(ron|lei)\b/i.test(price)) {
    return "RON";
  }
  if (/\bEUR\b|€/i.test(price)) {
    return "EUR";
  }
  return "";
}

function parseTags(block) {
  const tagsBlock = block.match(/<div[^>]+class="[^"]*\banunt-etichete\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || "";
  return [...tagsBlock.matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean);
}

function parseCondition(tags) {
  return tags.find((tag) => /^(nou|utilizat|folosit|second hand|ca nou)$/i.test(tag)) || "";
}

function parseLocationAndDate(block) {
  const matches = [...block.matchAll(/<span[^>]+class="[^"]*\bfloat-end\b[^"]*"[^>]*>([\s\S]*?)<\/span>/gi)];
  const text = stripTags(matches.at(-1)?.[1] || "");
  if (!text) {
    return { location: "", postedAt: "" };
  }

  const parts = text.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) {
    return { location: text, postedAt: "" };
  }

  return {
    location: parts.slice(0, -1).join(", "),
    postedAt: parts.at(-1) || ""
  };
}

function isPlaceholderImage(url = "") {
  return /\/build\/no-photo\//i.test(url) || /no[_-]?photo/i.test(url);
}

function parseListingBlock(block) {
  const titleMatch = block.match(/<div[^>]+class="[^"]*\bcard-title\b[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
  const title = stripTags(titleMatch?.[2] || "");
  const url = toAbsoluteUrl(titleMatch?.[1] || "");
  if (!title || !url) {
    return null;
  }

  const rawImageUrl = extractImageCandidate(block);
  const imageUrl = isPlaceholderImage(rawImageUrl) ? "" : toAbsoluteUrl(rawImageUrl);
  const tags = parseTags(block);
  const condition = parseCondition(tags);
  const locationAndDate = parseLocationAndDate(block);
  const price = parsePrice(block);

  return {
    title,
    price,
    currency: parseCurrency(price),
    location: locationAndDate.location,
    postedAt: locationAndDate.postedAt,
    condition,
    sellerType: tags.filter((tag) => tag !== condition).join(", "),
    url,
    imageUrl,
    imageUrls: imageUrl ? [imageUrl] : []
  };
}

function parseTotalResults(html) {
  const text = stripTags(html);
  const match = text.match(/Am g[ăa]sit\s*[-:]?\s*([\d. ]+)\s+anun[tț]uri/i);
  if (!match) {
    return null;
  }

  const value = Number.parseInt(match[1].replace(/[^\d]/g, ""), 10);
  return Number.isFinite(value) ? value : null;
}

function hasNextPage(html) {
  return /rel=["']next["']/i.test(html) || /[?&](?:amp;)?page=\d+/i.test(html);
}

export function parseAnuntulHtml(html, limit) {
  const blocks = splitListingBlocks(html);
  const items = blocks
    .map(parseListingBlock)
    .filter(Boolean)
    .slice(0, limit);

  return {
    items,
    totalResults: parseTotalResults(html),
    rawItemCount: blocks.length,
    hasNextPage: hasNextPage(html)
  };
}
