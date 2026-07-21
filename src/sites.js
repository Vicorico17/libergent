import { normalizeMarketplaceQuery } from "./query-normalization.js";

function slugifySpacesWithDash(value) {
  return value.trim().replace(/\s+/g, "-");
}

function encodeSearchText(value) {
  return encodeURIComponent(value.trim());
}

function slugifyRetailSearchPath(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildBasePrompt(siteLabel, query, limit, extra = "") {
  return [
    `You are extracting marketplace search results from ${siteLabel}.`,
    `Query: "${query}".`,
    "Return only real visible listing cards from the results page.",
    "Ignore navigation, filters, banners, cookie prompts, login prompts, and non-listing UI.",
    `Return at most ${limit} listings.`,
    "For each listing, extract the displayed title, raw price text, currency if visible, location if visible, posted time if visible, condition if visible, seller type if visible, listing URL, and image URL.",
    "Use absolute URLs whenever possible.",
    "Do not invent missing values.",
    extra
  ]
    .filter(Boolean)
    .join(" ");
}

const CAR_MAKES = [
  "abarth",
  "alfa",
  "alfa-romeo",
  "audi",
  "bentley",
  "bmw",
  "byd",
  "cadillac",
  "chevrolet",
  "chrysler",
  "citroen",
  "cupra",
  "dacia",
  "daewoo",
  "dodge",
  "ds",
  "fiat",
  "ford",
  "honda",
  "hyundai",
  "infiniti",
  "isuzu",
  "iveco",
  "jaguar",
  "jeep",
  "kia",
  "lancia",
  "land",
  "land-rover",
  "lexus",
  "maserati",
  "mazda",
  "mercedes",
  "mercedes-benz",
  "mg",
  "mini",
  "mitsubishi",
  "nissan",
  "opel",
  "peugeot",
  "polestar",
  "porsche",
  "range",
  "renault",
  "saab",
  "seat",
  "skoda",
  "smart",
  "subaru",
  "suzuki",
  "tesla",
  "toyota",
  "volkswagen",
  "volvo"
];

const CAR_KEYWORDS = [
  "masina",
  "masini",
  "autoturism",
  "autoturisme",
  "auto",
  "suv",
  "sedan",
  "coupe",
  "cabrio",
  "break",
  "combi",
  "pickup",
  "hatchback",
  "diesel",
  "benzina",
  "hibrid",
  "hybrid",
  "electric",
  "electrica",
  "4x4"
];

const CAR_PART_KEYWORDS = [
  "anvelopa",
  "anvelope",
  "baterie",
  "cauciucuri",
  "janta",
  "jante",
  "parbriz",
  "piesa",
  "piese",
  "roti",
  "ulei"
];

export const FREE_DEFAULT_SITE_KEYS = [
  "olx.ro",
  "lajumate.ro",
  "vinted.ro",
  "okazii.ro",
  "publi24.ro",
  "anuntul.ro",
  "price.ro",
  "shopmania.ro"
];

export const FREE_CAR_SITE_KEYS = ["autovit.ro", "bestauto.ro"];
export const FREE_TECH_SITE_KEYS = ["flip.ro", "klap.ro"];

export const PREMIUM_SITE_KEYS = [
  "emag.ro",
  "evomag.ro",
  "cel.ro",
  "compari.ro",
  "pcgarage.ro",
  "flanco.ro",
  "altex.ro"
];

export const PREMIUM_BROWSER_SITE_KEYS = [
  "compari.ro",
  "pcgarage.ro",
  "flanco.ro",
  "altex.ro",
  "cel.ro"
];

const REFURBISHED_TECH_KEYWORDS = [
  "telefon", "smartphone", "iphone", "samsung", "galaxy", "pixel", "xiaomi", "huawei",
  "tablet", "ipad", "laptop", "macbook", "smartwatch", "ceas"
];

const CAR_MODEL_PATH_ALIASES = [
  {
    patterns: [
      /\bpassat\s+cc\b/,
      /\bvw\s+passat\s+cc\b/,
      /\bvolkswagen\s+passat\s+cc\b/
    ],
    slug: "volkswagen-passat-cc"
  }
];

function normalizeCarText(value = "") {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getCarModelPathAlias(query) {
  const normalized = normalizeCarText(query);
  return CAR_MODEL_PATH_ALIASES.find((alias) =>
    alias.patterns.some((pattern) => pattern.test(normalized))
  )?.slug || "";
}

function slugifyCarPath(query) {
  const modelAlias = getCarModelPathAlias(query);
  if (modelAlias) {
    return modelAlias;
  }

  const tokens = query
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((token) => !["auto", "autoturism", "autoturisme", "masina", "masini", "suv"].includes(token));

  return tokens.join("-");
}

export function isCarQuery(query = "") {
  const normalized = normalizeMarketplaceQuery(query)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/\bmasin[ai]\s+de\s+spalat\b/.test(normalized) || /\bspalat\s+rufe\b/.test(normalized)) {
    return false;
  }
  if (/\b(scaun\s+auto|isofix|trotineta|scooter)\b/.test(normalized)) {
    return false;
  }

  const tokens = normalized
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const tokenSet = new Set(tokens);
  const joined = tokens.join(" ");
  const hasCarPartKeyword = CAR_PART_KEYWORDS.some((keyword) => tokenSet.has(keyword));
  if (hasCarPartKeyword) {
    return false;
  }

  const hasYear = /\b(19[8-9]\d|20[0-3]\d)\b/.test(normalized);
  const hasMileage = /\b\d{1,3}(?:[ .]\d{3})?\s*km\b/.test(normalized);
  const hasVariantCode = /\b([a-z]\d{1,2}|\d\.\d)\b/.test(normalized);
  const hasCarKeyword = CAR_KEYWORDS.some((keyword) => tokenSet.has(keyword) || joined.includes(keyword));
  const hasCarModel = Boolean(getCarModelPathAlias(normalized));

  const hasCarMake = CAR_MAKES.some((make) => {
    if (make.includes("-")) {
      return joined.includes(make.replace("-", " "));
    }
    return tokenSet.has(make);
  });

  if (hasCarKeyword || hasCarMake || hasCarModel || hasMileage) {
    return true;
  }

  if (tokens.length >= 2 && hasYear && hasVariantCode) {
    return true;
  }

  return false;
}

export function isRefurbishedTechQuery(query = "") {
  const normalized = normalizeMarketplaceQuery(query)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const tokens = new Set(normalized.split(/[^a-z0-9]+/).filter(Boolean));
  return REFURBISHED_TECH_KEYWORDS.some((keyword) => tokens.has(keyword));
}

export const SITES = {
  "autovit.ro": {
    key: "autovit.ro",
    label: "Autovit",
    priority: 0,
    defaultEnabled: false,
    provider: "direct",
    strategy: "direct-html-local",
    estimatedCreditsPerPage: 0,
    waitForMs: 0,
    timeoutMs: 18000,
    pageSize: 32,
    maxPages: 6,
    defaultLimit: 32,
    defaultMaxPages: 1,
    searchUrl(query) {
      const parts = slugifyCarPath(query).split("-").filter(Boolean);
      if (parts.length >= 2) {
        return `https://www.autovit.ro/autoturisme/${parts[0]}/${parts.slice(1).join("-")}/`;
      }
      if (parts.length === 1) {
        return `https://www.autovit.ro/autoturisme/${parts[0]}/`;
      }
      return "https://www.autovit.ro/autoturisme/";
    },
    pagedSearchUrl(query, page) {
      const base = this.searchUrl(query);
      return page <= 1 ? base : `${base}${base.includes("?") ? "&" : "?"}page=${page}`;
    },
    prompt(query, limit) {
      return buildBasePrompt(
        "Autovit",
        query,
        limit,
        "This page contains car listings. Keep only full vehicles, not parts, tires, accessories, services, or wanted ads."
      );
    }
  },
  "bestauto.ro": {
    key: "bestauto.ro",
    label: "BestAuto",
    priority: 1,
    defaultEnabled: false,
    provider: "direct",
    strategy: "direct-html-local",
    sourceType: "automotive",
    estimatedCreditsPerPage: 0,
    waitForMs: 0,
    timeoutMs: 16000,
    pageSize: 40,
    maxPages: 4,
    defaultLimit: 40,
    defaultMaxPages: 1,
    searchUrl(query) {
      return `https://www.bestauto.ro/anunturi/?q=${encodeSearchText(query).replace(/%20/g, "+")}`;
    },
    pagedSearchUrl(query, page) {
      const base = this.searchUrl(query);
      return page <= 1 ? base : `${base}&pag=${page}`;
    },
    prompt(query, limit) {
      return buildBasePrompt("BestAuto", query, limit, "Keep complete vehicle listings and exclude parts, tires, accessories, and services.");
    }
  },
  "olx.ro": {
    key: "olx.ro",
    label: "OLX Romania",
    priority: 1,
    defaultEnabled: true,
    provider: "direct",
    strategy: "direct-html-local",
    estimatedCreditsPerPage: 0,
    waitForMs: 0,
    timeoutMs: 20000,
    pageSize: 50,
    maxPages: 12,
    defaultLimit: 50,
    defaultMaxPages: 1,
    searchUrl(query) {
      return `https://www.olx.ro/oferte/q-${slugifySpacesWithDash(query)}/?search%5Border%5D=created_at%3Adesc`;
    },
    pagedSearchUrl(query, page) {
      const base = this.searchUrl(query);
      return page <= 1 ? base : `${base}&page=${page}`;
    },
    prompt(query, limit) {
      return buildBasePrompt(
        "OLX Romania",
        query,
        limit,
        "This page is a classifieds search results page. Prioritize listing cards with price and city."
      );
    }
  },
  "vinted.ro": {
    key: "vinted.ro",
    label: "Vinted Romania",
    priority: 3,
    defaultEnabled: true,
    provider: "direct",
    strategy: "direct-html-local",
    estimatedCreditsPerPage: 0,
    waitForMs: 0,
    timeoutMs: 25000,
    pageSize: 95,
    maxPages: 6,
    defaultLimit: 95,
    defaultMaxPages: 1,
    searchUrl(query) {
      return `https://www.vinted.ro/catalog?search_text=${encodeSearchText(query)}&order=newest_first`;
    },
    pagedSearchUrl(query, page) {
      const base = this.searchUrl(query);
      return page <= 1 ? base : `${base}&page=${page}`;
    },
    prompt(query, limit) {
      return buildBasePrompt(
        "Vinted Romania",
        query,
        limit,
        "Focus on product tiles in the catalog feed and ignore sign-in or personalized recommendations."
      );
    }
  },
  "flip.ro": {
    key: "flip.ro",
    label: "Flip",
    priority: 4,
    defaultEnabled: false,
    provider: "direct",
    strategy: "direct-html-local",
    sourceType: "classifieds",
    estimatedCreditsPerPage: 0,
    waitForMs: 0,
    timeoutMs: 22000,
    pageSize: 500,
    maxPages: 1,
    defaultLimit: 500,
    defaultMaxPages: 1,
    searchUrl() {
      return "https://flip.ro/magazin/";
    },
    pagedSearchUrl() {
      return this.searchUrl();
    },
    prompt(query, limit) {
      return buildBasePrompt("Flip", query, limit, "Use the final payable refurbished-product price, never monthly installments or crossed-out retail prices.");
    }
  },
  "klap.ro": {
    key: "klap.ro",
    label: "Klap",
    priority: 5,
    defaultEnabled: false,
    provider: "direct",
    strategy: "direct-html-local",
    sourceType: "classifieds",
    estimatedCreditsPerPage: 0,
    waitForMs: 0,
    timeoutMs: 22000,
    pageSize: 48,
    maxPages: 1,
    defaultLimit: 48,
    defaultMaxPages: 1,
    searchUrl(query) {
      return `https://klap.ro/?s=${encodeSearchText(query)}&post_type=product`;
    },
    pagedSearchUrl(query) {
      return this.searchUrl(query);
    },
    prompt(query, limit) {
      return buildBasePrompt("Klap", query, limit, "Use the current refurbished-product sale price and ignore crossed-out prices and financing copy.");
    }
  },
  "lajumate.ro": {
    key: "lajumate.ro",
    label: "Lajumate",
    priority: 2,
    defaultEnabled: true,
    provider: "direct",
    strategy: "direct-html-local",
    estimatedCreditsPerPage: 0,
    waitForMs: 0,
    timeoutMs: 12000,
    pageSize: 26,
    maxPages: 6,
    defaultLimit: 26,
    defaultMaxPages: 1,
    searchUrl(query) {
      return `https://lajumate.ro/anunturi/c/${encodeSearchText(query)}`;
    },
    pagedSearchUrl(query, page) {
      const base = this.searchUrl(query);
      return page <= 1 ? base : `${base}?page=${page}`;
    },
    prompt(query, limit) {
      return buildBasePrompt(
        "Lajumate",
        query,
        limit,
        "Results may appear under anunturi listings. Keep only marketplace offers."
      );
    }
  },
  "okazii.ro": {
    key: "okazii.ro",
    label: "Okazii",
    priority: 4,
    defaultEnabled: true,
    provider: "direct",
    strategy: "direct-html-local",
    estimatedCreditsPerPage: 0,
    waitForMs: 0,
    timeoutMs: 12000,
    pageSize: 36,
    maxPages: 6,
    defaultLimit: 36,
    defaultMaxPages: 1,
    disableQueryFilter: true,
    searchUrl(query) {
      return `https://www.okazii.ro/cautare/${encodeSearchText(query).replace(/%20/g, "+")}.html`;
    },
    pagedSearchUrl(query, page) {
      const base = this.searchUrl(query);
      return page <= 1 ? base : `${base}?page=${page}`;
    },
    prompt(query, limit) {
      return buildBasePrompt(
        "Okazii",
        query,
        limit,
        "Results can include marketplace catalog items. Keep only visible result cards related to the query."
      );
    }
  },
  "publi24.ro": {
    key: "publi24.ro",
    label: "Publi24",
    priority: 5,
    defaultEnabled: true,
    provider: "direct",
    strategy: "direct-html-local",
    estimatedCreditsPerPage: 0,
    waitForMs: 0,
    timeoutMs: 12000,
    pageSize: 30,
    maxPages: 11,
    defaultLimit: 330,
    defaultMaxPages: 11,
    searchUrl(query) {
      return `https://www.publi24.ro/anunturi/?q=${encodeSearchText(query).replace(/%20/g, "+")}`;
    },
    pagedSearchUrl(query, page) {
      const base = this.searchUrl(query);
      return page <= 1 ? base : `${base}&pag=${page}`;
    },
    prompt(query, limit) {
      return buildBasePrompt(
        "Publi24",
        query,
        limit,
        "Results appear as article-item classified cards. Keep only product or service listings that match the query."
      );
    }
  },
  "anuntul.ro": {
    key: "anuntul.ro",
    label: "Anuntul",
    priority: 6,
    defaultEnabled: true,
    provider: "direct",
    strategy: "direct-html-local",
    estimatedCreditsPerPage: 0,
    waitForMs: 0,
    timeoutMs: 12000,
    pageSize: 50,
    maxPages: 8,
    defaultLimit: 50,
    defaultMaxPages: 1,
    searchUrl(query) {
      return `https://www.anuntul.ro/anunturi/?q=${encodeSearchText(query).replace(/%20/g, "+")}`;
    },
    pagedSearchUrl(query, page) {
      const base = this.searchUrl(query);
      return page <= 1 ? base : `${base}&page=${page}`;
    },
    prompt(query, limit) {
      return buildBasePrompt(
        "Anuntul",
        query,
        limit,
        "Results appear as Anuntul classified cards. Keep only visible marketplace offers that match the query."
      );
    }
  },
  "price.ro": {
    key: "price.ro",
    label: "Price.ro",
    priority: 7,
    defaultEnabled: true,
    provider: "direct",
    strategy: "direct-html-retail",
    sourceType: "price_aggregator",
    defaultCondition: "Nou",
    defaultSellerType: "Aggregator",
    estimatedCreditsPerPage: 0,
    waitForMs: 0,
    timeoutMs: 16000,
    pageSize: 24,
    maxPages: 1,
    defaultLimit: 24,
    defaultMaxPages: 1,
    searchUrl(query) {
      return `https://www.price.ro/index.php?action=q&text=${encodeSearchText(query)}`;
    },
    pagedSearchUrl(query) {
      return this.searchUrl(query);
    },
    prompt(query, limit) {
      return buildBasePrompt("Price.ro", query, limit, "This is a Romanian price comparison site. Keep product result cards and starting-price offers from stores.");
    }
  },
  "compari.ro": {
    key: "compari.ro",
    label: "Compari.ro",
    priority: 8,
    defaultEnabled: false,
    provider: "direct",
    strategy: "direct-html-retail",
    sourceType: "price_aggregator",
    defaultCondition: "Nou",
    defaultSellerType: "Aggregator",
    estimatedCreditsPerPage: 0,
    waitForMs: 0,
    timeoutMs: 18000,
    pageSize: 24,
    maxPages: 1,
    defaultLimit: 24,
    defaultMaxPages: 1,
    searchUrl(query) {
      return `https://www.compari.ro/CategorySearch.php?st=${encodeSearchText(query)}`;
    },
    pagedSearchUrl(query) {
      return this.searchUrl(query);
    },
    prompt(query, limit) {
      return buildBasePrompt("Compari.ro", query, limit, "This is a Romanian price comparison site. Keep product cards and offer summaries, not store reviews or navigation.");
    }
  },
  "shopmania.ro": {
    key: "shopmania.ro",
    label: "ShopMania",
    priority: 9,
    defaultEnabled: true,
    provider: "direct",
    strategy: "direct-html-retail",
    sourceType: "price_aggregator",
    defaultCondition: "Nou",
    defaultSellerType: "Aggregator",
    estimatedCreditsPerPage: 0,
    waitForMs: 0,
    timeoutMs: 16000,
    pageSize: 24,
    maxPages: 1,
    defaultLimit: 24,
    defaultMaxPages: 1,
    searchUrl(query) {
      return `https://www.shopmania.ro/shopping?q=${encodeSearchText(query)}`;
    },
    pagedSearchUrl(query) {
      return this.searchUrl(query);
    },
    prompt(query, limit) {
      return buildBasePrompt("ShopMania Romania", query, limit, "This is a price comparison site. Keep product cards with price and shop information.");
    }
  },
  "emag.ro": {
    key: "emag.ro",
    label: "eMAG",
    priority: 10,
    defaultEnabled: false,
    provider: "direct",
    strategy: "direct-html-retail",
    sourceType: "retailer_marketplace",
    defaultCondition: "Nou",
    defaultSellerType: "Retailer / marketplace",
    estimatedCreditsPerPage: 0,
    waitForMs: 0,
    timeoutMs: 18000,
    pageSize: 30,
    maxPages: 1,
    defaultLimit: 30,
    defaultMaxPages: 1,
    searchUrl(query) {
      return `https://www.emag.ro/search/${encodeSearchText(query)}`;
    },
    pagedSearchUrl(query) {
      return this.searchUrl(query);
    },
    prompt(query, limit) {
      return buildBasePrompt("eMAG Romania", query, limit, "This is a retailer and marketplace search page. Keep product result cards with prices and seller/store info if visible.");
    }
  },
  "evomag.ro": {
    key: "evomag.ro",
    label: "evoMAG",
    priority: 11,
    defaultEnabled: false,
    provider: "direct",
    strategy: "direct-html-retail",
    sourceType: "retailer",
    defaultCondition: "Nou",
    defaultSellerType: "Retailer",
    estimatedCreditsPerPage: 0,
    waitForMs: 0,
    timeoutMs: 18000,
    pageSize: 24,
    maxPages: 1,
    defaultLimit: 24,
    defaultMaxPages: 1,
    searchUrl(query) {
      return `https://www.evomag.ro/?searchString=${encodeSearchText(query)}`;
    },
    pagedSearchUrl(query) {
      return this.searchUrl(query);
    },
    prompt(query, limit) {
      return buildBasePrompt("evoMAG", query, limit, "This is a retailer search page. Keep only product cards with visible prices.");
    }
  },
  "pcgarage.ro": {
    key: "pcgarage.ro",
    label: "PC Garage",
    priority: 14,
    defaultEnabled: false,
    provider: "direct",
    strategy: "direct-html-retail",
    sourceType: "retailer",
    defaultCondition: "Nou",
    defaultSellerType: "Retailer",
    estimatedCreditsPerPage: 0,
    waitForMs: 0,
    timeoutMs: 18000,
    pageSize: 24,
    maxPages: 1,
    defaultLimit: 24,
    defaultMaxPages: 1,
    searchUrl(query) {
      return `https://www.pcgarage.ro/cauta/${encodeSearchText(query)}/`;
    },
    pagedSearchUrl(query) {
      return this.searchUrl(query);
    },
    prompt(query, limit) {
      return buildBasePrompt("PC Garage", query, limit, "This is a retailer search page. Keep only product cards with visible prices.");
    }
  },
  "altex.ro": {
    key: "altex.ro",
    label: "Altex",
    priority: 15,
    defaultEnabled: false,
    provider: "direct",
    strategy: "direct-html-retail",
    sourceType: "retailer",
    defaultCondition: "Nou",
    defaultSellerType: "Retailer",
    estimatedCreditsPerPage: 0,
    waitForMs: 0,
    browserWaitUntil: "domcontentloaded",
    browserWaitForMs: 2500,
    timeoutMs: 16000,
    pageSize: 24,
    maxPages: 1,
    defaultLimit: 24,
    defaultMaxPages: 1,
    searchUrl(query) {
      return `https://altex.ro/cauta/?q=${encodeSearchText(query)}`;
    },
    pagedSearchUrl(query) {
      return this.searchUrl(query);
    },
    prompt(query, limit) {
      return buildBasePrompt("Altex", query, limit, "This is a retailer search page. Keep only product cards with visible prices.");
    }
  },
  "flanco.ro": {
    key: "flanco.ro",
    label: "Flanco",
    priority: 12,
    defaultEnabled: false,
    provider: "direct",
    strategy: "direct-html-retail",
    sourceType: "retailer",
    defaultCondition: "Nou",
    defaultSellerType: "Retailer",
    estimatedCreditsPerPage: 0,
    waitForMs: 0,
    browserWaitUntil: "domcontentloaded",
    browserWaitForMs: 2500,
    timeoutMs: 16000,
    pageSize: 24,
    maxPages: 1,
    defaultLimit: 24,
    defaultMaxPages: 1,
    searchUrl(query) {
      return `https://www.flanco.ro/catalogsearch/result/?q=${encodeSearchText(query)}`;
    },
    pagedSearchUrl(query) {
      return this.searchUrl(query);
    },
    prompt(query, limit) {
      return buildBasePrompt("Flanco", query, limit, "This is a retailer search page. Keep only product cards with visible prices.");
    }
  },
  "cel.ro": {
    key: "cel.ro",
    label: "CEL.ro",
    priority: 13,
    defaultEnabled: false,
    provider: "direct",
    strategy: "direct-html-retail",
    sourceType: "retailer",
    defaultCondition: "Nou",
    defaultSellerType: "Retailer",
    estimatedCreditsPerPage: 0,
    waitForMs: 0,
    browserWaitUntil: "domcontentloaded",
    browserWaitForMs: 1500,
    timeoutMs: 24000,
    pageSize: 24,
    maxPages: 1,
    defaultLimit: 24,
    defaultMaxPages: 1,
    searchUrl(query) {
      return `https://www.cel.ro/cauta/${slugifyRetailSearchPath(query)}/`;
    },
    pagedSearchUrl(query) {
      return this.searchUrl(query);
    },
    prompt(query, limit) {
      return buildBasePrompt("CEL.ro", query, limit, "This is a retailer search page. Keep only product cards with visible prices.");
    }
  }

};

export function getSite(siteKey) {
  const site = SITES[siteKey];
  if (!site) {
    throw new Error(`Unsupported site "${siteKey}". Supported sites: ${Object.keys(SITES).join(", ")}`);
  }
  return site;
}

export function getDefaultSiteKeys() {
  return [...FREE_DEFAULT_SITE_KEYS];
}

export function getSiteKeysForAllSearch(query) {
  const conditionalSiteKeys = [
    ...(isCarQuery(query) ? FREE_CAR_SITE_KEYS : []),
    ...(isRefurbishedTechQuery(query) ? FREE_TECH_SITE_KEYS : [])
  ];
  return [...conditionalSiteKeys, ...FREE_DEFAULT_SITE_KEYS];
}
