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
    return `https://www.publi24.ro${value}`;
  }
  return `https://www.publi24.ro/${value.replace(/^\/+/, "")}`;
}

function splitArticleBlocks(html) {
  const matches = [...html.matchAll(/<div\b[^>]*class="[^"]*\barticle-item\b[^"]*"[^>]*>/gi)];
  return matches.map((match, index) => {
    const start = match.index;
    const end = matches[index + 1]?.index ?? html.length;
    return html.slice(start, end);
  });
}

function parsePrice(block) {
  const priceBlock = block.match(/<span[^>]+class="[^"]*\barticle-price\b[^"]*"[^>]*>([\s\S]*?)<\/span>\s*(?:<\/span>)?/i)?.[1] || "";
  const newPrice = priceBlock.match(/<span[^>]+class="[^"]*\bnew-price\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1];
  const rawPrice = stripTags(newPrice || priceBlock);
  const match = rawPrice.match(/(\d[\d.,\s]*)\s*(RON|Lei|EUR|€)\b/i);
  return match ? `${match[1].trim()} ${match[2]}` : rawPrice;
}

function parseArticleBlock(block) {
  const titleMatch = block.match(/<h2[^>]+class="[^"]*\barticle-title\b[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
  const imageMatch = block.match(/<img[^>]+src="([^"]+)"[^>]*>/i);
  const locationMatch = block.match(/<p[^>]+class="[^"]*\barticle-location\b[^"]*"[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/i);
  const dateMatch = block.match(/<p[^>]+class="[^"]*\barticle-date\b[^"]*"[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/i);
  const sellerTypeMatch = block.match(/<span[^>]+class="[^"]*\barticle-lbl-txt\b[^"]*"[^>]*>(Telefon validat)<\/span>/i);

  const title = stripTags(titleMatch?.[2] || "");
  const url = toAbsoluteUrl(titleMatch?.[1] || "");
  if (!title || !url) {
    return null;
  }

  const price = parsePrice(block);
  return {
    title,
    price,
    currency: /\bRON\b/i.test(price) ? "RON" : /\blei\b/i.test(price) ? "Lei" : /€|eur/i.test(price) ? "EUR" : "",
    location: stripTags(locationMatch?.[1] || ""),
    postedAt: stripTags(dateMatch?.[1] || ""),
    condition: "",
    sellerType: stripTags(sellerTypeMatch?.[1] || ""),
    url,
    imageUrl: toAbsoluteUrl(imageMatch?.[1] || "")
  };
}

function parseTotalResults(html) {
  const text = stripTags(html);
  const match =
    text.match(/([\d. ]+)\s+anunțuri/i) ||
    text.match(/([\d. ]+)\s+anunturi/i);
  if (!match) {
    return null;
  }

  const value = Number.parseInt(match[1].replace(/[^\d]/g, ""), 10);
  return Number.isFinite(value) ? value : null;
}

function hasNextPage(html) {
  return /[?&amp;]pag=\d+/i.test(html) || /[?&]pag=\d+/i.test(html);
}

export function parsePubli24Html(html, limit) {
  const blocks = splitArticleBlocks(html);
  const items = blocks
    .map(parseArticleBlock)
    .filter(Boolean)
    .slice(0, limit);

  return {
    items,
    totalResults: parseTotalResults(html),
    rawItemCount: blocks.length,
    hasNextPage: hasNextPage(html)
  };
}
