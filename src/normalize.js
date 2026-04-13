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

function parseNumberFromPrice(priceText = "") {
  const matches = priceText.match(/[\d.,\s]+/g);
  if (!matches) {
    return null;
  }

  const candidate = matches
    .join(" ")
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
      : /[,.]\d{2}$/.test(compact)
        ? compact.at(-3)
        : null;
  const normalized = decimalSeparator
    ? compact
        .replace(new RegExp(`[^\\d\\${decimalSeparator}]`, "g"), "")
        .replace(decimalSeparator, ".")
    : compact.replace(/[^\d]/g, "");

  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

export function normalizeListing(item) {
  const priceText = typeof item.price === "string" ? item.price.trim() : "";
  const rawCurrency = item.currency ? String(item.currency).toUpperCase() : detectCurrency(priceText);
  const currency = rawCurrency === "LEI" || rawCurrency === "LEU" ? "RON" : rawCurrency;
  const numericPrice = parseNumberFromPrice(priceText);
  const priceRon = currency === "RON" ? numericPrice : null;

  return {
    ...item,
    price: priceText,
    currency,
    numericPrice,
    priceRon
  };
}

export function formatRon(value) {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
    maximumFractionDigits: 0
  }).format(value);
}
