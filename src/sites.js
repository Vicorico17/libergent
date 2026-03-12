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

export const SITES = {
  "olx.ro": {
    key: "olx.ro",
    label: "OLX Romania",
    priority: 1,
    defaultEnabled: true,
    provider: "firecrawl",
    strategy: "firecrawl-markdown-local",
    estimatedCreditsPerPage: 1,
    waitForMs: 5000,
    timeoutMs: 90000,
    pageSize: 40,
    maxPages: 12,
    defaultLimit: 320,
    defaultMaxPages: 8,
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
    defaultEnabled: false,
    provider: "cloudflare",
    strategy: "search-page",
    estimatedCreditsPerPage: 0,
    waitForMs: 5000,
    timeoutMs: 90000,
    pageSize: 48,
    maxPages: 6,
    defaultLimit: 24,
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
    provider: "firecrawl",
    strategy: "search-page",
    estimatedCreditsPerPage: 5,
    waitForMs: 4000,
    timeoutMs: 90000,
    pageSize: 40,
    maxPages: 6,
    defaultLimit: 24,
    defaultMaxPages: 1,
    searchUrl(query) {
      return `https://lajumate.ro/cauta_${encodeSearchText(query)}.html?sort=date-desc`;
    },
    pagedSearchUrl(query, page) {
      const base = this.searchUrl(query);
      return page <= 1 ? base : `${base}&page=${page}`;
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
    defaultEnabled: false,
    provider: "cloudflare",
    strategy: "crawl-seed",
    estimatedCreditsPerPage: 0,
    waitForMs: 4000,
    timeoutMs: 90000,
    pageSize: 36,
    maxPages: 6,
    defaultLimit: 24,
    defaultMaxPages: 1,
    searchUrl(query) {
      return `https://www.okazii.ro/cauta/${encodeSearchText(query)}/?sort=date_desc`;
    },
    pagedSearchUrl(query, page) {
      const base = this.searchUrl(query);
      return page <= 1 ? base : `${base}&page=${page}`;
    },
    prompt(query, limit) {
      return buildBasePrompt(
        "Okazii",
        query,
        limit,
        "Results can include marketplace catalog items. Keep only visible result cards related to the query."
      );
    },
    crawlConfig(query) {
      const seed = `https://www.okazii.ro/cauta/${encodeSearchText(query)}/`;
      return {
        url: seed,
        limit: 10,
        depth: 1,
        formats: ["json"],
        jsonOptions: {
          prompt: this.prompt(query, 10)
        },
        options: {
          includePatterns: [
            "https://www.okazii.ro/cauta/**",
            "https://www.okazii.ro/**"
          ]
        }
      };
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
