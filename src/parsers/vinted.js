function cleanText(value = "") {
  return decodeHtmlEntities(
    value
      .replace(/\r/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function stripTags(value = "") {
  return cleanText(value.replace(/<[^>]+>/g, " "));
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
    return `https://www.vinted.ro${value}`;
  }
  return value;
}

function parseTitle(label = "") {
  const normalized = cleanText(label);
  const markers = [", brand:", ", stare:", ", mărime:", ", marime:"];
  const cutIndex = markers
    .map((marker) => normalized.indexOf(marker))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  return cutIndex >= 0 ? normalized.slice(0, cutIndex).trim() : normalized;
}

function parseCondition(label = "", fallback = "") {
  const fromLabel = label.match(/stare:\s*([^,]+)/i)?.[1];
  if (fromLabel) {
    return cleanText(fromLabel);
  }

  if (fallback.includes("·")) {
    return cleanText(fallback.split("·").pop());
  }

  return cleanText(fallback);
}

function parsePriceFromLabel(label = "") {
  const match = cleanText(label).match(/(\d[\d.,\s]*)\s*(Lei|RON|€|EUR)\b/i);
  return match ? `${match[1].trim()} ${match[2]}` : "";
}

function extractPostedAtFromText(...values) {
  const merged = cleanText(values.filter(Boolean).join(" · "));
  if (!merged) {
    return "";
  }

  const parts = merged
    .split(/[·|\n]/)
    .map((part) => cleanText(part))
    .filter(Boolean);

  const freshnessPatterns = [
    /\b(azi|ieri|astăzi|astazi|reactualizat(?:ă)?|actualizat(?:ă)?)\b/i,
    /\bacum\s+\d+\s*(min(?:ut(?:e)?)?|h|or[ăae]?|ore|zi(?:le)?|s[ăa]pt(?:[ăa]m[âa]n[ăa]?)?|lun[ăi])\b/i,
    /\b\d+\s*(min(?:ut(?:e)?)?|h|or[ăae]?|ore|zi(?:le)?|s[ăa]pt(?:[ăa]m[âa]n[ăa]?)?|lun[ăi])\s+în\s+urm[ăa]\b/i,
    /\b\d{1,2}\s+(ian(?:uarie)?|feb(?:ruarie)?|mar(?:tie)?|apr(?:ilie)?|mai|iun(?:ie)?|iul(?:ie)?|aug(?:ust)?|sep(?:tembrie)?|oct(?:ombrie)?|nov(?:embrie)?|dec(?:embrie)?)\b/i
  ];

  for (const part of parts) {
    if (freshnessPatterns.some((pattern) => pattern.test(part))) {
      return part;
    }
  }

  const inlineMatch = merged.match(/(azi|ieri|astăzi|astazi|reactualizat(?:ă)?|actualizat(?:ă)?|acum\s+\d+\s*(?:min(?:ut(?:e)?)?|h|or[ăae]?|ore|zi(?:le)?|s[ăa]pt(?:[ăa]m[âa]n[ăa]?)?|lun[ăi]))/i);
  return inlineMatch ? cleanText(inlineMatch[0]) : "";
}

function parseTotalResults(text = "") {
  const value = Number.parseInt(text.match(/([\d.+]+)\s+de rezultate/i)?.[1]?.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(value) ? value : null;
}

function hasNextPage(html) {
  return /[?&]page=\d+/i.test(html) || /rel="next"/i.test(html);
}

function splitGridItems(html) {
  const matches = [...html.matchAll(/<div\b(?=[^>]*data-testid="grid-item")[^>]*>/gi)];
  return matches.map((match, index) => {
    const start = match.index;
    const end = matches[index + 1]?.index ?? html.length;
    return html.slice(start, end);
  });
}

function parseGridItem(card) {
  const linkMatch = card.match(/<a[^>]+href="([^"]*\/items\/[^"]+)"[^>]*title="([^"]*)"[^>]*>/i);
  const imageMatch = card.match(/<img[^>]+src="([^"]+)"[^>]*>/i);
  const imageAltMatch = card.match(/<img[^>]+alt="([^"]*)"[^>]*>/i);
  const rawLabel = cleanText(linkMatch?.[2] || imageAltMatch?.[1] || "");
  const url = toAbsoluteUrl(linkMatch?.[1] || "");

  if (!rawLabel || !url) {
    return null;
  }

  const price = parsePriceFromLabel(rawLabel);
  if (!price) {
    return null;
  }

  return {
    title: parseTitle(rawLabel),
    description: rawLabel,
    price,
    currency: /\blei\b/i.test(price) ? "Lei" : price.match(/\b(RON|EUR|€)\b/i)?.[1] || "",
    location: "",
    postedAt: extractPostedAtFromText(stripTags(card)),
    condition: parseCondition(rawLabel),
    sellerType: "",
    url,
    imageUrl: toAbsoluteUrl(imageMatch?.[1] || "")
  };
}

export function parseVintedMarkdown(markdown, limit) {
  const normalized = markdown.replace(/\r/g, "");
  const startIndex = normalized.indexOf("Rezultate căutare");
  const relevant = startIndex >= 0 ? normalized.slice(startIndex) : normalized;
  const lines = relevant.split("\n").map((line) => line.trim()).filter(Boolean);
  const items = [];

  for (let index = 0; index < lines.length; index += 1) {
    const imageMatch = lines[index].match(/^!\[(.*?)\]\((https:\/\/images[^)\s]+)\)$/);
    const linkLine = imageMatch ? lines[index + 1] : lines[index];
    const linkMatch = linkLine?.match(/^\[(.+?)\]\((https:\/\/www\.vinted\.ro\/items\/[^\s)]+)(?:\s+"[^"]*")?\)$/);

    if (!linkMatch) {
      continue;
    }

    const rawLabel = cleanText(linkMatch[1]);
    const url = cleanText(linkMatch[2]);
    const imageUrl = imageMatch?.[2] || "";
    const metadata = [];
    let cursor = (imageMatch ? index + 2 : index + 1);

    while (cursor < lines.length && !lines[cursor].startsWith("![") && !lines[cursor].startsWith("[") && metadata.length < 5) {
      metadata.push(lines[cursor]);
      cursor += 1;
    }

    const price = metadata.find((line) => /\bRON\b/i.test(line) && !/incl\./i.test(line));
    if (!price) {
      index = cursor - 1;
      continue;
    }

    items.push({
      title: parseTitle(rawLabel),
      description: rawLabel,
      price: cleanText(price),
      currency: "RON",
      location: "",
      postedAt: extractPostedAtFromText(...metadata),
      condition: parseCondition(rawLabel, metadata[1] || metadata[0] || ""),
      sellerType: "",
      url,
      imageUrl
    });

    if (items.length >= limit) {
      break;
    }

    index = cursor - 1;
  }

  return {
    items,
    totalResults: parseTotalResults(relevant)
  };
}

export function parseVintedHtml(html, limit) {
  const blocks = splitGridItems(html);
  const items = blocks
    .map(parseGridItem)
    .filter(Boolean)
    .slice(0, limit);

  return {
    items,
    totalResults: parseTotalResults(stripTags(html)),
    rawItemCount: blocks.length,
    hasNextPage: hasNextPage(html)
  };
}
