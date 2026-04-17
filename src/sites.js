function slugifySpacesWithDash(value) {
  return value.trim().replace(/\s+/g, "-");
}

function encodeSearchText(value) {
  return encodeURIComponent(value.trim());
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
  "audi",
  "bmw",
  "chevrolet",
  "citroen",
  "dacia",
  "fiat",
  "ford",
  "honda",
  "hyundai",
  "jeep",
  "kia",
  "mazda",
  "mercedes",
  "mitsubishi",
  "nissan",
  "opel",
  "peugeot",
  "renault",
  "seat",
  "skoda",
  "suzuki",
  "toyota",
  "volkswagen",
  "volvo"
];

const CAR_MODELS = [
  "compass",
  "golf",
  "logan",
  "octavia",
  "passat",
  "x5"
];

function slugifyCarPath(query) {
  return query
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isCarQuery(query = "") {
  const tokens = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const tokenSet = new Set(tokens);

  return CAR_MAKES.some((make) => tokenSet.has(make)) ||
    tokens.some((token) => CAR_MODELS.includes(token)) ||
    /\b(auto|autoturism|masina|masini|suv)\b/i.test(query);
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
  return Object.values(SITES)
    .filter((site) => site.defaultEnabled)
    .sort((a, b) => a.priority - b.priority)
    .map((site) => site.key);
}

export function getSiteKeysForAllSearch(query) {
  if (isCarQuery(query)) {
    return ["autovit.ro"];
  }

  return Object.values(SITES)
    .filter((site) => site.defaultEnabled)
    .sort((a, b) => a.priority - b.priority)
    .map((site) => site.key);
}
