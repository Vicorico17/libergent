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
    return `https://www.autovit.ro${value}`;
  }
  return value;
}

function splitListingBlocks(html) {
  const articleMatches = [...html.matchAll(/<article\b[^>]*>/gi)];
  if (articleMatches.length) {
    return articleMatches.map((match, index) => {
      const start = match.index;
      const end = articleMatches[index + 1]?.index ?? html.length;
      return html.slice(start, end);
    });
  }

  const linkMatches = [...html.matchAll(/<a[^>]+href="(?:https?:\/\/www\.autovit\.ro)?\/autoturisme\/[^"]+"[^>]*>/gi)];
  return linkMatches.map((match, index) => {
    const start = Math.max(0, match.index - 1200);
    const end = linkMatches[index + 1]?.index ?? Math.min(html.length, match.index + 5000);
    return html.slice(start, end);
  });
}

function parsePrice(block) {
  const text = stripTags(block);
  const match =
    text.match(/(\d[\d.,\s]*)\s*EUR\b/i) ||
    text.match(/(\d[\d.,\s]*)\s*€/i) ||
    text.match(/(\d[\d.,\s]*)\s*(RON|Lei)\b/i);
  return match ? `${match[1].trim()} ${match[2] || "EUR"}` : "";
}

function parseTitle(block) {
  const headingMatch = block.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
  if (headingMatch) {
    return stripTags(headingMatch[1]);
  }

  const ariaMatch = block.match(/<a[^>]+aria-label="([^"]+)"[^>]*href="(?:https?:\/\/www\.autovit\.ro)?\/autoturisme\/[^"]+"/i);
  if (ariaMatch) {
    return cleanText(ariaMatch[1]);
  }

  const titleMatch = block.match(/<a[^>]+href="(?:https?:\/\/www\.autovit\.ro)?\/autoturisme\/[^"]+"[^>]*>([\s\S]*?)<\/a>/i);
  return stripTags(titleMatch?.[1] || "");
}

function parseListingBlock(block) {
  const urlMatch = block.match(/<a[^>]+href="((?:https?:\/\/www\.autovit\.ro)?\/autoturisme\/[^"]+)"[^>]*>/i);
  const imageMatch = block.match(/<img[^>]+src="([^"]+)"[^>]*>/i);
  const title = parseTitle(block);
  const url = toAbsoluteUrl(urlMatch?.[1] || "");

  if (
    !title ||
    !url ||
    /^[\d\s.,]+$/.test(title) ||
    /\/autoturisme\/(?:jeep|[^/]+)\/?$/i.test(url)
  ) {
    return null;
  }

  const text = stripTags(block);
  const yearMatch = text.match(/\b(19[8-9]\d|20[0-3]\d)\b/);
  const mileageMatch = text.match(/(\d{1,3}(?:[ .]\d{3})*)\s*km\b/i);
  const fuelMatch = text.match(/\b(Benzina|Diesel|Hibrid(?: Plug-In)?|Electric)\b/i);
  const locationMatch = text.match(/\b([A-ZĂÂÎȘȚ][a-zăâîșț-]+(?:\s+[A-ZĂÂÎȘȚ][a-zăâîșț-]+)*)\s+\(([A-ZĂÂÎȘȚa-zăâîșț-]+)\)/);
  const details = [
    mileageMatch ? `${cleanText(mileageMatch[1])} km` : "",
    fuelMatch?.[1] || "",
    yearMatch?.[1] || ""
  ].filter(Boolean);

  return {
    title,
    price: parsePrice(block),
    currency: /€|eur/i.test(block) ? "EUR" : /\blei|ron\b/i.test(block) ? "RON" : "",
    location: locationMatch ? `${locationMatch[1]} (${locationMatch[2]})` : "",
    postedAt: /Reactualizat/i.test(text) ? "Reactualizat" : /Publicat/i.test(text) ? "Publicat" : "",
    condition: details.join(" • "),
    sellerType: /Privat/i.test(text) ? "Privat" : /Profesionist/i.test(text) ? "Profesionist" : "",
    url,
    imageUrl: toAbsoluteUrl(imageMatch?.[1] || "")
  };
}

function parseTotalResults(html) {
  const text = stripTags(html);
  const match =
    text.match(/Număr de anunțuri:\s*([\d. ]+)/i) ||
    text.match(/Numar de anunturi:\s*([\d. ]+)/i);
  if (!match) {
    return null;
  }

  const value = Number.parseInt(match[1].replace(/[^\d]/g, ""), 10);
  return Number.isFinite(value) ? value : null;
}

function parseJsonLdOffers(html) {
  const scripts = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  const offers = [];

  for (const script of scripts) {
    try {
      const parsed = JSON.parse(decodeHtmlEntities(script[1]));
      const itemList = parsed?.mainEntity?.itemListElement;
      if (Array.isArray(itemList)) {
        offers.push(...itemList);
      }
    } catch {
      // Ignore unrelated JSON-LD blocks.
    }
  }

  return offers.map((offer) => {
    const price = offer?.priceSpecification?.price;
    const currency = offer?.priceSpecification?.priceCurrency || "";
    const title = offer?.itemOffered?.name || "";
    return {
      title: cleanText(title),
      price: price ? `${price} ${currency}`.trim() : "",
      currency: cleanText(currency)
    };
  });
}

function hasNextPage(html) {
  return /\/autoturisme\/[^"]+\/\?page=\d+/i.test(html) || /aria-label="Next"/i.test(html);
}

export function parseAutovitHtml(html, limit) {
  const blocks = splitListingBlocks(html);
  const jsonLdOffers = parseJsonLdOffers(html);
  const items = blocks
    .map(parseListingBlock)
    .filter(Boolean)
    .map((item, index) => {
      if (item.price) {
        return item;
      }

      const offer = jsonLdOffers[index];
      if (!offer?.price) {
        return item;
      }

      return {
        ...item,
        price: offer.price,
        currency: offer.currency || item.currency
      };
    })
    .slice(0, limit);

  return {
    items,
    totalResults: parseTotalResults(html),
    rawItemCount: blocks.length,
    hasNextPage: hasNextPage(html)
  };
}
