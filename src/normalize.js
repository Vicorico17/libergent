const ESTIMATED_EUR_TO_RON = 5;

function detectCurrency(priceText = "") {
  const value = priceText.toLowerCase();
  if (value.includes("lei") || value.includes("ron") || value.includes("leu")) {
    return "RON";
  }
  if (value.includes("eur") || value.includes("€")) {
    return "EUR";
  }
  if (value.includes("$") || value.includes("usd")) {
    return "USD";
  }
  return null;
}

function normalizeCurrency(value, priceText = "") {
  const raw = value ? String(value).trim().toUpperCase() : detectCurrency(priceText);
  if (raw === "LEI" || raw === "LEU" || raw === "RON") {
    return "RON";
  }
  if (raw === "€" || raw === "EUR") {
    return "EUR";
  }
  if (raw === "$" || raw === "USD") {
    return "USD";
  }
  return raw || null;
}

function parseNumberFromPrice(priceValue = "") {
  if (typeof priceValue === "number") {
    return Number.isFinite(priceValue) ? priceValue : null;
  }

  const priceText = String(priceValue || "");
  if (/^\s*-/.test(priceText)) {
    return null;
  }
  const matches = priceText.match(/\d[\d.,\s]*/g);
  if (!matches) {
    return null;
  }

  const candidate = matches[0]
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!candidate) {
    return null;
  }

  const compact = candidate.replace(/\s/g, "");
  const lastCommaIndex = compact.lastIndexOf(",");
  const lastDotIndex = compact.lastIndexOf(".");
  const decimalSeparator =
    lastCommaIndex >= 0 && lastDotIndex >= 0
      ? lastCommaIndex > lastDotIndex ? "," : "."
      : getSingleDecimalSeparator(compact);
  const normalized = decimalSeparator
    ? normalizeDecimalNumber(compact, decimalSeparator)
    : compact.replace(/[^\d]/g, "");

  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function getSingleDecimalSeparator(compact) {
  const commaCount = (compact.match(/,/g) || []).length;
  const dotCount = (compact.match(/\./g) || []).length;
  const separator =
    commaCount === 1 && dotCount === 0 ? "," :
    dotCount === 1 && commaCount === 0 ? "." :
    null;

  if (!separator) {
    return null;
  }

  const [integerPart, decimalPart] = compact.split(separator);
  const integerDigits = integerPart.replace(/[^\d]/g, "");
  const decimalDigits = decimalPart.replace(/[^\d]/g, "");

  return integerDigits && decimalDigits.length > 0 && decimalDigits.length <= 2
    ? separator
    : null;
}

function normalizeDecimalNumber(compact, decimalSeparator) {
  const decimalIndex = compact.lastIndexOf(decimalSeparator);
  if (decimalIndex === -1) {
    return compact.replace(/[^\d]/g, "");
  }

  const integerPart = compact.slice(0, decimalIndex).replace(/[^\d]/g, "");
  const decimalPart = compact.slice(decimalIndex + 1).replace(/[^\d]/g, "");
  return decimalPart
    ? `${integerPart || "0"}.${decimalPart}`
    : integerPart;
}

function getPriceText(item) {
  if (typeof item.price === "string") {
    return item.price.trim();
  }
  if (Number.isFinite(item.price)) {
    return String(item.price);
  }
  if (typeof item.priceRon === "string" && item.priceRon.trim()) {
    return item.priceRon.trim();
  }
  if (Number.isFinite(item.priceRon)) {
    return String(item.priceRon);
  }
  return "";
}

function getNumericPrice(item, priceText) {
  const parsedPrice = parseNumberFromPrice(priceText);
  if (Number.isFinite(parsedPrice)) {
    return parsedPrice;
  }

  const parsedNumericPrice = parseNumberFromPrice(item.numericPrice);
  if (Number.isFinite(parsedNumericPrice)) {
    return parsedNumericPrice;
  }

  return null;
}

function getPriceRon(item, currency, numericPrice) {
  const explicitPriceRon = parseNumberFromPrice(item.priceRon);
  if (Number.isFinite(explicitPriceRon) && explicitPriceRon > 0) {
    return explicitPriceRon;
  }

  return currency === "RON" ? numericPrice :
    currency === "EUR" && Number.isFinite(numericPrice) ? numericPrice * ESTIMATED_EUR_TO_RON :
    null;
}

export function normalizeListing(item) {
  const priceText = getPriceText(item);
  const currency = normalizeCurrency(item.currency, priceText);
  const numericPrice = getNumericPrice(item, priceText);
  const priceRon = getPriceRon(item, currency, numericPrice);

  const imageUrls = [...new Set(
    (Array.isArray(item.imageUrls) ? item.imageUrls : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  )];

  return {
    ...item,
    price: priceText,
    currency,
    numericPrice,
    priceRon,
    imageUrl: item.imageUrl || imageUrls[0] || "",
    imageUrls
  };
}

export function formatRon(value) {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
    maximumFractionDigits: 0
  }).format(value);
}
