import { extractImageCandidate } from "./image.js";

function decodeHtmlEntities(value = "") {
  return String(value || "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)));
}

function stripTags(value = "") {
  return decodeHtmlEntities(String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function toAbsoluteUrl(value = "", origin) {
  const url = decodeHtmlEntities(value).trim();
  if (!url) return "";
  try {
    return new URL(url, origin).toString();
  } catch {
    return "";
  }
}

function normalizeSearchText(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesQuery(title, query) {
  const titleTokens = new Set(normalizeSearchText(title).split(" ").filter(Boolean));
  const queryTokens = normalizeSearchText(query).split(" ").filter((token) => token.length > 1 || /^\d+$/.test(token));
  if (!queryTokens.length) return true;
  if (queryTokens.some((token) => /^\d+$/.test(token) && !titleTokens.has(token))) return false;
  const matched = queryTokens.filter((token) => titleTokens.has(token)).length;
  return matched / queryTokens.length >= 0.5;
}

function flipCondition(value = "") {
  const normalized = String(value || "").toUpperCase();
  if (normalized === "CA_NOU") return "Ca nou";
  if (normalized === "FOARTE_BUN") return "Foarte bun";
  if (normalized === "EXCELENT") return "Excelent";
  if (normalized === "BUN") return "Bun";
  return String(value || "").replace(/_/g, " ");
}

function collectFlipProducts(value, output, seenObjects = new Set()) {
  if (!value || typeof value !== "object" || seenObjects.has(value)) return;
  seenObjects.add(value);

  if (typeof value.pdpUrl === "string" && Number(value.price) > 0 && value.naming && typeof value.naming === "object") {
    output.push(value);
  }

  for (const child of Object.values(value)) {
    collectFlipProducts(child, output, seenObjects);
  }
}

export function parseFlipHtml(html, limit, { query = "", origin = "https://flip.ro" } = {}) {
  const script = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)?.[1] || "";
  let nextData;
  try {
    nextData = JSON.parse(script);
  } catch {
    nextData = null;
  }

  const products = [];
  collectFlipProducts(nextData, products);
  const seen = new Set();
  const matchingProducts = products.filter((product) => {
    const title = product.naming.title || product.naming.shortTitleWithBrand || product.naming.shortTitle || "";
    const url = toAbsoluteUrl(product.pdpUrl, origin);
    if (!title || !url || seen.has(url) || !matchesQuery(title, query)) return false;
    seen.add(url);
    return true;
  });

  const items = matchingProducts.slice(0, limit).map((product) => ({
    title: String(product.naming.title || product.naming.shortTitleWithBrand || product.naming.shortTitle || "").trim(),
    price: `${Number(product.price)} ${product.currency || "RON"}`,
    currency: product.currency || "RON",
    location: "România",
    postedAt: "",
    condition: flipCondition(product.spec?.shape || ""),
    sellerType: "Retailer refurbished",
    url: toAbsoluteUrl(product.pdpUrl, origin),
    imageUrl: toAbsoluteUrl(product.imagePath || "", origin)
  }));

  return {
    items,
    totalResults: matchingProducts.length,
    rawItemCount: products.length,
    hasNextPage: null
  };
}

function splitKlapProductBlocks(html) {
  return [...html.matchAll(/<li\b[^>]*class=["'][^"']*\bproduct\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => match[0]);
}

function parseKlapPrice(block) {
  const saleBlock = block.match(/<ins\b[^>]*>([\s\S]*?)<\/ins>/i)?.[1] || "";
  const withoutOldPrice = block.replace(/<del\b[^>]*>[\s\S]*?<\/del>/gi, " ");
  const priceBlock = saleBlock || withoutOldPrice;
  const amount = priceBlock.match(/<bdi\b[^>]*>([\s\S]*?)<\/bdi>/i)?.[1] || "";
  const text = stripTags(amount);
  const match = text.match(/(\d[\d.,\s]*)\s*(lei|ron|€|eur)/i);
  return match ? `${match[1].trim()} ${match[2]}` : "";
}

function parseKlapCondition(block) {
  const text = stripTags(block);
  return text.match(/\b(Ca nou|Excelent|Foarte bun|Bun)\b/i)?.[1] || "Recondiționat";
}

export function parseKlapHtml(html, limit, { origin = "https://klap.ro" } = {}) {
  const blocks = splitKlapProductBlocks(html);
  const seen = new Set();
  const items = [];

  for (const block of blocks) {
    if (items.length >= limit) break;
    const url = toAbsoluteUrl(
      block.match(/<a\b[^>]+class=["'][^"']*woocommerce-loop-product__link[^"']*["'][^>]+href=["']([^"']+)["']/i)?.[1] ||
      block.match(/<a\b[^>]+href=["']([^"']+)["'][^>]+class=["'][^"']*woocommerce-loop-product__link/i)?.[1] ||
      "",
      origin
    );
    const title = stripTags(block.match(/<h2\b[^>]*class=["'][^"']*woocommerce-loop-product__title[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i)?.[1] || "");
    const price = parseKlapPrice(block);
    if (!url || !title || !price || seen.has(url)) continue;
    seen.add(url);
    items.push({
      title,
      price,
      currency: /lei|ron/i.test(price) ? "RON" : "EUR",
      location: "România",
      postedAt: "",
      condition: parseKlapCondition(block),
      sellerType: "Retailer refurbished",
      url,
      imageUrl: toAbsoluteUrl(extractImageCandidate(block), origin)
    });
  }

  return {
    items,
    totalResults: null,
    rawItemCount: blocks.length,
    hasNextPage: null
  };
}
