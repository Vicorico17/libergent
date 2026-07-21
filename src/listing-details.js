const MAX_DESCRIPTION_LENGTH = 12000;
const MAX_ATTRIBUTES = 24;
const MAX_IMAGES = 12;

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

function cleanText(value = "") {
  return decodeHtmlEntities(String(value || "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function usefulText(value = "") {
  const text = cleanText(value);
  return text && text !== "-" ? text : "";
}

function finiteNumber(value) {
  const number = typeof value === "number" ? value : Number.parseFloat(String(value || "").replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function asArray(value) {
  return Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
}

function collectJsonLdNodes(value, output = [], seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return output;
  seen.add(value);
  if (value["@type"]) output.push(value);
  for (const child of Object.values(value)) collectJsonLdNodes(child, output, seen);
  return output;
}

function parseJsonLd(html) {
  const nodes = [];
  const scripts = html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of scripts) {
    try {
      collectJsonLdNodes(JSON.parse(decodeHtmlEntities(match[1])), nodes);
    } catch {
      // Ignore malformed third-party structured data and continue with metadata fallbacks.
    }
  }
  return nodes;
}

function hasType(node, expected) {
  return asArray(node?.["@type"]).some((type) => String(type).toLowerCase() === expected.toLowerCase());
}

function firstOffer(product) {
  return asArray(product?.offers).find((offer) => offer && typeof offer === "object") || null;
}

function metaContent(html, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta\\b[^>]*(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta\\b[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["'][^>]*>`, "i")
  ];
  return usefulText(patterns.map((pattern) => html.match(pattern)?.[1] || "").find(Boolean) || "");
}

function imageUrls(product, html) {
  const candidates = [
    ...asArray(product?.image).flatMap((image) => typeof image === "string" ? [image] : [image?.url, image?.contentUrl]),
    metaContent(html, "og:image")
  ];
  return [...new Set(candidates.map((value) => String(value || "").trim()).filter((value) => /^https:\/\//i.test(value)))].slice(0, MAX_IMAGES);
}

function locationName(product, offer, html) {
  const candidates = [
    offer?.areaServed?.name,
    offer?.availableAtOrFrom?.address?.addressLocality,
    product?.offers?.areaServed?.name,
    product?.itemAvailableAtOrFrom?.address?.addressLocality,
    product?.location?.name,
    product?.address?.addressLocality,
    metaContent(html, "geo.placename")
  ];
  return usefulText(candidates.find(Boolean) || "");
}

function sellerDetails(product, offer, normalizedHtml) {
  const seller = offer?.seller || product?.seller || product?.author || null;
  const details = {
    name: usefulText(typeof seller === "string" ? seller : seller?.name || ""),
    rating: null,
    reviewCount: null,
    ratingScale: 5
  };

  const vintedSeller = normalizedHtml.match(/"name":"user_info_header"[\s\S]{0,3000}?"data":\{[\s\S]{0,500}?"name":"([^"]+)"[\s\S]{0,500}?"feedback_count":(\d+)[\s\S]{0,100}?"feedback_reputation":([\d.]+)/i);
  if (vintedSeller) {
    details.name = usefulText(vintedSeller[1]);
    details.reviewCount = Number.parseInt(vintedSeller[2], 10);
    const reputation = finiteNumber(vintedSeller[3]);
    details.rating = reputation !== null ? Math.round(reputation * 5 * 10) / 10 : null;
  }

  return details;
}

function productRating(product) {
  const rating = product?.aggregateRating;
  return {
    rating: finiteNumber(rating?.ratingValue),
    reviewCount: finiteNumber(rating?.reviewCount ?? rating?.ratingCount),
    ratingScale: finiteNumber(rating?.bestRating) || 5
  };
}

function shippingDetails(offer) {
  const shipping = asArray(offer?.shippingDetails).find((value) => value && typeof value === "object") || null;
  const shippingRate = finiteNumber(shipping?.shippingRate?.value);
  const deliveryTime = shipping?.deliveryTime || {};
  const handling = deliveryTime?.handlingTime || {};
  const transit = deliveryTime?.transitTime || {};
  const minDays = finiteNumber(transit?.minValue) ?? finiteNumber(handling?.minValue);
  const maxDays = finiteNumber(transit?.maxValue) ?? finiteNumber(handling?.maxValue);
  return {
    price: shippingRate,
    currency: usefulText(shipping?.shippingRate?.currency || offer?.priceCurrency || ""),
    status: shippingRate === 0 ? "free" : shippingRate !== null ? "known" : "unknown",
    minDays,
    maxDays
  };
}

function attributes(product) {
  const values = [];
  for (const property of asArray(product?.additionalProperty)) {
    const label = usefulText(property?.name || property?.propertyID || "");
    const value = usefulText(property?.value || property?.valueReference?.name || "");
    if (label && value && !values.some((entry) => entry.label === label && entry.value === value)) {
      values.push({ label, value });
    }
  }
  const simpleValues = [
    ["Brand", product?.brand?.name || product?.brand],
    ["Categorie", /^https?:\/\//i.test(String(product?.category || "")) ? "" : product?.category],
    ["Culoare", product?.color],
    ["SKU", product?.sku]
  ];
  for (const [label, rawValue] of simpleValues) {
    const value = usefulText(rawValue || "");
    if (value && !values.some((entry) => entry.label.toLowerCase() === label.toLowerCase())) values.push({ label, value });
  }
  return values.slice(0, MAX_ATTRIBUTES);
}

function vintedBuyerPricing(normalizedHtml, itemPrice, currency) {
  const totalMatch = normalizedHtml.match(/"totalAmount":\{"amount":"([\d.]+)","currencyCode":"([A-Z]{3})"\}/);
  const buyerProtectionTotal = finiteNumber(totalMatch?.[1]);
  const totalCurrency = usefulText(totalMatch?.[2] || currency);
  const buyerProtectionFee = buyerProtectionTotal !== null && itemPrice !== null
    ? Math.max(0, Math.round((buyerProtectionTotal - itemPrice) * 100) / 100)
    : null;
  return { buyerProtectionTotal, buyerProtectionFee, currency: totalCurrency };
}

export function parseListingDetailsHtml(html, { url = "" } = {}) {
  const nodes = parseJsonLd(html);
  const product = nodes.find((node) => hasType(node, "Product")) || {};
  const offer = firstOffer(product) || nodes.find((node) => hasType(node, "Offer") || hasType(node, "AggregateOffer")) || {};
  const normalizedHtml = html.replace(/\\"/g, "\"").replace(/\\u0026/gi, "&");
  const itemPrice = finiteNumber(offer?.price ?? offer?.lowPrice ?? offer?.priceSpecification?.[0]?.price);
  const currency = usefulText(offer?.priceCurrency || offer?.priceSpecification?.[0]?.priceCurrency || "");
  const shipping = shippingDetails(offer);
  const vintedPricing = /(^|\.)vinted\.ro$/i.test(new URL(url || "https://invalid.test").hostname)
    ? vintedBuyerPricing(normalizedHtml, itemPrice, currency)
    : { buyerProtectionTotal: null, buyerProtectionFee: null, currency };
  const totalPrice = vintedPricing.buyerProtectionTotal !== null
    ? (shipping.price !== null ? vintedPricing.buyerProtectionTotal + shipping.price : null)
    : itemPrice !== null && shipping.price !== null ? itemPrice + shipping.price : null;

  const structuredDescription = usefulText(product?.description || "");
  return {
    title: usefulText(product?.name || metaContent(html, "og:title")),
    description: (structuredDescription || metaContent(html, "og:description")).slice(0, MAX_DESCRIPTION_LENGTH),
    location: locationName(product, offer, html),
    condition: usefulText(offer?.itemCondition || product?.itemCondition || "").replace(/^https?:\/\/schema\.org\//i, "").replace(/Condition$/i, ""),
    availability: usefulText(offer?.availability || "").replace(/^https?:\/\/schema\.org\//i, ""),
    images: imageUrls(product, html),
    attributes: attributes(product),
    seller: sellerDetails(product, offer, normalizedHtml),
    productRating: productRating(product),
    pricing: {
      itemPrice,
      currency: vintedPricing.currency || currency,
      buyerProtectionFee: vintedPricing.buyerProtectionFee,
      buyerProtectionTotal: vintedPricing.buyerProtectionTotal,
      deliveryPrice: shipping.price,
      totalPrice,
      deliveryStatus: shipping.status
    },
    delivery: {
      status: shipping.status,
      price: shipping.price,
      currency: shipping.currency || currency,
      minDays: shipping.minDays,
      maxDays: shipping.maxDays
    },
    extraction: {
      provider: "direct",
      structuredData: Boolean(product?.["@type"]),
      browserUsed: false
    }
  };
}
