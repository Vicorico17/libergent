import { extractImageCandidate } from "./image.js";

function cleanText(value = "") {
  return decodeHtmlEntities(
    value
      .replace(/\r/g, "")
      .replace(/\n{2,}/g, "\n\n")
      .trim()
  );
}

function stripTags(value = "") {
  return cleanText(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
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
    return `https://www.olx.ro${value}`;
  }
  return value;
}

function decodeOlxJsonString(value = "") {
  return value
    .replace(/\\\\u002F/gi, "/")
    .replace(/\\\\u0026/gi, "&")
    .replace(/\\\\u003D/gi, "=")
    .replace(/\\u002F/gi, "/")
    .replace(/\\u0026/gi, "&")
    .replace(/\\u003D/gi, "=")
    .replace(/\\"/g, "\"")
    .replace(/\\\//g, "/")
    .replace(/\\\\/g, "\\");
}

function pickBestPhotosSetCandidate(value = "") {
  const candidates = decodeOlxJsonString(value)
    .split(",")
    .map((entry) => {
      const [url = "", descriptor = ""] = entry.trim().split(/\s+/);
      const score = Number.parseInt(descriptor.replace(/[^\d]/g, ""), 10);
      return {
        url,
        score: Number.isFinite(score) ? score : 0
      };
    })
    .filter((candidate) => candidate.url);

  return candidates.sort((a, b) => b.score - a.score)[0]?.url || "";
}

function listingPathKey(url = "") {
  try {
    return new URL(toAbsoluteUrl(url)).pathname;
  } catch {
    return toAbsoluteUrl(url).split("?")[0];
  }
}

function extractFirstEscapedArrayValue(value = "") {
  return value.match(/\\?"([\s\S]*?)\\?"/)?.[1] || "";
}

function extractEmbeddedOlxImages(html = "") {
  const imageByPath = new Map();
  const listingMatches = html.matchAll(/\\"photos\\":\[(.*?)\]([\s\S]{0,5000}?)\\"urlPath\\":\\"(.*?)\\"/g);

  for (const match of listingMatches) {
    const photosRaw = match[1] || "";
    const objectTail = match[2] || "";
    const urlPath = decodeOlxJsonString(match[3] || "");
    const photosSetRaw = objectTail.match(/\\"photosSet\\":\[(.*?)\]/)?.[1] || "";
    const imageUrl =
      pickBestPhotosSetCandidate(extractFirstEscapedArrayValue(photosSetRaw)) ||
      decodeOlxJsonString(extractFirstEscapedArrayValue(photosRaw));

    if (urlPath && imageUrl) {
      imageByPath.set(listingPathKey(urlPath), imageUrl);
    }
  }

  return imageByPath;
}

function parsePrice(line = "") {
  const match = line.match(/(\d[\d\s.]*)\s*(lei|ron|€|eur)?/i);
  return match ? `${match[1].trim()} ${match[2] || ""}`.trim() : line.trim();
}

function parseTotalResults(markdown) {
  const match = markdown.match(/Am găsit\s+([\d. ]+)\s+rezultate/i);
  if (!match) {
    return null;
  }

  const value = Number.parseInt(match[1].replace(/[^\d]/g, ""), 10);
  return Number.isFinite(value) ? value : null;
}

function parseHtmlTotalResults(html) {
  const visibleCountMatch = stripTags(html).match(/Am găsit\s+([\d. ]+)\s+rezultate/i);
  if (!visibleCountMatch) {
    return null;
  }

  const value = Number.parseInt(visibleCountMatch[1].replace(/[^\d]/g, ""), 10);
  return Number.isFinite(value) ? value : null;
}

function hasNextPage(html) {
  return /href="[^"]*[?&]page=\d+/i.test(html) || /data-testid="pagination-forward"/i.test(html);
}

function splitListingCards(html) {
  const matches = [...html.matchAll(/<div\b(?=[^>]*data-cy="l-card")(?=[^>]*data-testid="l-card")[^>]*>/gi)];
  return matches.map((match, index) => {
    const start = match.index;
    const end = matches[index + 1]?.index ?? html.length;
    return html.slice(start, end);
  });
}

function parseListingCard(card, embeddedImages = new Map()) {
  const titleBlock =
    card.match(/data-testid="ad-card-title"[\s\S]*?<a[^>]+href="([^"]+)"[\s\S]*?<h4[^>]*>([\s\S]*?)<\/h4>/i) ||
    card.match(/<a[^>]+href="([^"]*\/d\/oferta\/[^"]+)"[^>]*>[\s\S]*?<h4[^>]*>([\s\S]*?)<\/h4>/i);
  const priceMatch = card.match(/data-testid="ad-price"[^>]*>([\s\S]*?)<\/p>/i);
  const locationDateMatch = card.match(/data-testid="location-date"[^>]*>([\s\S]*?)<\/p>/i);
  const imageUrl = extractImageCandidate(card);
  const conditionMatch = card.match(/data-nx-name="NexusBadge"[^>]*>([\s\S]*?)<\/div>/i);

  const title = stripTags(titleBlock?.[2] || "");
  const url = toAbsoluteUrl(titleBlock?.[1] || "");
  if (!title || !url) {
    return null;
  }
  const embeddedImageUrl = embeddedImages.get(listingPathKey(url)) || "";

  const locationDate = stripTags(locationDateMatch?.[1] || "");
  const locationSplit = locationDate.split(" - ");
  const location = locationSplit[0] || "";
  const postedAt = locationSplit.slice(1).join(" - ");
  const price = parsePrice(stripTags(priceMatch?.[1] || ""));

  return {
    title,
    price,
    currency: /€|eur/i.test(price) ? "EUR" : /\blei\b/i.test(price) ? "lei" : "",
    location,
    postedAt,
    condition: stripTags(conditionMatch?.[1] || ""),
    sellerType: "",
    url,
    imageUrl: toAbsoluteUrl(imageUrl || embeddedImageUrl)
  };
}

export function parseOlxMarkdown(markdown, limit) {
  const normalized = cleanText(markdown);
  const blocks = normalized.split(/\n(?=\[\!\[)/g);
  const items = [];

  for (const block of blocks) {
    const titleMatch = block.match(/\[\*\*(.+?)\*\*\]\((https:\/\/www\.olx\.ro\/d\/oferta\/[^\s)]+)\)/);
    if (!titleMatch) {
      continue;
    }

    const imageMatch = block.match(/\[\!\[(.*?)\]\((https:\/\/[^)\s]+)\)\]\((https:\/\/www\.olx\.ro\/d\/oferta\/[^\s)]+)\)/);
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const title = titleMatch[1].trim();
    const url = titleMatch[2].trim();
    const titleIndex = lines.findIndex((line) => line.includes(`[**${title}**](`));
    const priceLine = titleIndex >= 0 ? lines[titleIndex + 1] || "" : "";
    const conditionLine = titleIndex >= 0 ? lines[titleIndex + 2] || "" : "";
    const locationLine = titleIndex >= 0 ? lines[titleIndex + 3] || "" : "";

    const locationSplit = locationLine.split(" - ");
    const location = locationSplit[0] || "";
    const postedAt = locationSplit.slice(1).join(" - ");

    items.push({
      title,
      price: parsePrice(priceLine),
      currency: /€|eur/i.test(priceLine) ? "EUR" : "lei",
      location,
      postedAt,
      condition: conditionLine,
      sellerType: "",
      url,
      imageUrl: imageMatch?.[2] || ""
    });

    if (items.length >= limit) {
      break;
    }
  }

  return {
    items,
    totalResults: parseTotalResults(normalized)
  };
}

export function parseOlxHtml(html, limit) {
  const blocks = splitListingCards(html);
  const embeddedImages = extractEmbeddedOlxImages(html);
  const items = blocks
    .map((card) => parseListingCard(card, embeddedImages))
    .filter(Boolean)
    .slice(0, limit);

  return {
    items,
    totalResults: parseHtmlTotalResults(html),
    rawItemCount: blocks.length,
    hasNextPage: hasNextPage(html)
  };
}
