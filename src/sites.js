import { normalizeMarketplaceQuery } from "./query-normalization.js";
import { understandMarketplaceQuery } from "./query-understanding.js";

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

export const PREMIUM_CORE_SITE_KEYS = [
  "emag.ro",
  "evomag.ro",
  "cel.ro",
  "compari.ro",
  "pcgarage.ro",
  "flanco.ro",
  "altex.ro"
];

export const PREMIUM_FASHION_SITE_KEYS = [
  "sizeer.ro",
  "epantofi.ro",
  "fashiondays.ro",
  "zalando.ro",
  "aboutyou.ro",
  "answear.ro",
  "modivo.ro"
];

export const PREMIUM_HOME_SITE_KEYS = ["ikea.com", "jysk.ro", "mobexpert.ro"];
export const PREMIUM_DIY_SITE_KEYS = ["dedeman.ro", "leroymerlin.ro", "hornbach.ro"];
export const PREMIUM_SPORT_SITE_KEYS = ["decathlon.ro", "sportvision.ro", "intersport.ro"];
export const PREMIUM_PHOTO_SITE_KEYS = ["f64.ro", "photosetup.ro"];
export const PREMIUM_MUSIC_SITE_KEYS = ["soundcreation.ro", "mcmusic.ro"];
export const PREMIUM_BOOKS_SITE_KEYS = ["carturesti.ro", "libris.ro"];
export const PREMIUM_BABY_SITE_KEYS = ["noriel.ro", "nichiduta.ro", "bebetei.ro"];
export const PREMIUM_BEAUTY_SITE_KEYS = ["notino.ro", "douglas.ro", "sephora.ro"];
export const PREMIUM_PET_SITE_KEYS = ["zooplus.ro", "animax.ro", "petmart.ro"];
export const PREMIUM_HOBBY_SITE_KEYS = ["redgoblin.ro", "regatuljocurilor.ro", "bricksdepot.ro"];
// Broad experimental batch: retained as explicit data so health checks can promote,
// fix, or remove stores without changing niche routing code.
export const EXPERIMENTAL_EXPANSION = {
  fashion: ["ccc.eu", "deichmann.com", "jdsports.ro", "footshop.ro", "buzzsneakers.ro", "sneakerindustry.ro", "fashionhouse.ro", "modlet.ro"],
  home: ["somproduct.ro", "bonami.ro", "xxxlutz.ro", "thehome.ro", "mezoni.ro", "kondela.ro", "dormeo.ro", "altex.ro"],
  diy: ["mathaus.ro", "ambient.ro", "arabesque.ro", "bricodepot.ro", "ferex.ro", "miculmester.ro", "scule.ro", "egradini.ro"],
  sport: ["hervis.ro", "sportisimo.ro", "4fstore.ro", "intersport.ro", "sportano.ro", "tenis-shop.ro", "bike24.ro", "playbike.ro"],
  tech: ["vexio.ro", "forit.ro", "itgalaxy.ro", "badabum.ro", "mediagalaxy.ro", "evomag.ro", "avstore.ro", "a2t.ro"],
  auto: ["epiesa.ro", "autokarma.ro", "autodoc.ro", "unixauto.ro", "autohut.ro", "pieseauto.ro", "automag.ro", "roata.ro"],
  beauty: ["esteto.ro", "makeup.ro", "farmec.ro", "drmax.ro", "helpnet.ro", "springfarma.com", "notino.ro", "elefant.ro"],
  pet: ["epetshop.ro", "petmax.ro", "petguru.ro", "animax.ro", "petmart.ro", "zooplus.ro"],
  books: ["elefant.ro", "bookzone.ro", "nemira.ro", "librarie.net", "pravaliacucarti.ro", "okian.ro"],
  music: ["zeedo.ro", "senia.ro", "mcmusic.ro", "soundcreation.ro", "thomann.de", "musicshop.ro"]
};
export const EXPERIMENTAL_EXPANSION_SITE_KEYS = [...new Set(Object.values(EXPERIMENTAL_EXPANSION).flat())];

export const PREMIUM_SITE_KEYS = [
  ...PREMIUM_CORE_SITE_KEYS,
  ...PREMIUM_FASHION_SITE_KEYS,
  ...PREMIUM_HOME_SITE_KEYS,
  ...PREMIUM_DIY_SITE_KEYS,
  ...PREMIUM_SPORT_SITE_KEYS,
  ...PREMIUM_PHOTO_SITE_KEYS,
  ...PREMIUM_MUSIC_SITE_KEYS,
  ...PREMIUM_BOOKS_SITE_KEYS,
  ...PREMIUM_BABY_SITE_KEYS, ...PREMIUM_BEAUTY_SITE_KEYS, ...PREMIUM_PET_SITE_KEYS, ...PREMIUM_HOBBY_SITE_KEYS
  ,...EXPERIMENTAL_EXPANSION_SITE_KEYS
];

export const NICHE_CATALOG = [
  { key: "marketplaces", label: "General marketplace & second-hand", mode: "always" },
  { key: "tech", label: "Technology", mode: "query-routed" },
  { key: "automotive", label: "Vehicles", mode: "query-routed" },
  { key: "fashion", label: "Fashion & sneakers", mode: "query-routed" },
  { key: "home", label: "Home & furniture", mode: "query-routed" },
  { key: "diy", label: "DIY & tools", mode: "query-routed" },
  { key: "sport", label: "Sport & outdoor", mode: "query-routed" },
  { key: "photo", label: "Photo & video", mode: "query-routed" },
  { key: "music", label: "Music & audio", mode: "query-routed" },
  { key: "books", label: "Books, games & collectibles", mode: "query-routed" }
  ,{ key: "baby", label: "Baby & kids", mode: "query-routed" }
  ,{ key: "beauty", label: "Beauty & personal care", mode: "query-routed" }
  ,{ key: "pet", label: "Pet supplies", mode: "query-routed" }
  ,{ key: "hobby", label: "Toys & hobby", mode: "query-routed" }
];

export const SOURCE_INTEGRATION_STATES = {
  active: "active",
  experimental: "experimental",
  catalog: "catalog"
};

export const PREMIUM_BROWSER_SITE_KEYS = [
  "compari.ro",
  "pcgarage.ro",
  "flanco.ro",
  "altex.ro"
];

const REFURBISHED_TECH_KEYWORDS = [
  "telefon", "smartphone", "iphone", "samsung", "galaxy", "pixel", "xiaomi", "huawei",
  "tablet", "ipad", "laptop", "macbook", "smartwatch", "ceas"
];

const FASHION_KEYWORDS = [
  "haine", "imbracaminte", "îmbrăcăminte", "rochie", "rochii", "fusta", "fustă", "fuste",
  "bluza", "bluză", "bluze", "hanorac", "hanorace", "tricou", "tricouri", "camasa", "cămașă",
  "camasi", "cămăși", "geaca", "geacă", "geci", "pantaloni", "blugi", "jeansi", "colanti",
  "colanți", "trening", "sacou", "costum", "pantofi", "adidasi", "adidași", "sneakers",
  "tenisi", "teniși", "ghete", "cizme", "sandale", "papuci", "bocanci", "balerini",
  "geanta", "geantă", "genti", "genți", "rucsac", "portofel", "ochelari", "ceas", "curea",
  "nike", "adidas", "jordan", "new balance", "puma", "reebok", "converse", "vans", "asics",
  "skechers", "timberland", "birkenstock", "ugg", "zara", "h&m", "hm", "tommy", "levis"
];

const HOME_KEYWORDS = [
  "mobila", "mobilă", "canapea", "fotoliu", "masa", "masă", "scaun", "birou", "dulap",
  "comoda", "comodă", "pat", "saltea", "biblioteca", "bibliotecă", "raft", "etajera", "etajeră",
  "noptiera", "covor", "perdea", "lustra", "lustră", "decoratiuni", "decorațiuni"
];

const DIY_KEYWORDS = [
  "bormasina", "bormașină", "masina de gaurit", "mașina de găurit", "flex", "polizor", "fierastrau",
  "fierăstrău", "surubelnita", "șurubelniță", "burghiu", "ciocan", "compresor", "generator", "aparat sudura",
  "unealta", "unealtă", "scule", "vopsea", "gresie", "faianta", "faianță", "parchet", "centrala",
  "centrală", "calorifer", "robinet", "chiuveta", "chiuvetă", "wc", "gradina", "grădină", "drujba", "drujbă"
];

const SPORT_KEYWORDS = [
  "bicicleta", "bicicletă", "mtb", "cursiera", "cursieră", "trotineta", "trotinetă", "cort", "camping",
  "drumetie", "drumeție", "rucsac trekking", "schi", "snowboard", "pescuit", "fitness", "gantere",
  "banda alergare", "bandă alergare", "alergare", "fotbal", "baschet", "volei", "tenis", "padel",
  "racheta", "rachetă", "role", "patine", "caiac", "surf", "yoga"
];

const PHOTO_KEYWORDS = ["camera foto", "aparat foto", "mirrorless", "dslr", "obiectiv foto", "obiectiv canon", "obiectiv nikon", "obiectiv sony", "trepied", "drone", "drona", "cameră video", "gopro"];
const MUSIC_KEYWORDS = ["chitara", "chitară", "pian", "clape", "sintetizator", "tobe", "vioara", "vioară", "microfon", "amplificator", "interfata audio", "interfață audio", "boxa activa", "boxă activă", "dj controller"];
const BOOKS_KEYWORDS = ["carte", "carti", "cărți", "roman", "manual", "isbn", "manga", "comics", "benzi desenate", "joc de societate", "board game", "lego", "puzzle"];
const BABY_KEYWORDS = ["bebelus", "bebeluș", "carucior", "cărucior", "scaun masa copii", "scăunel copii", "patut", "pătuț", "jucarii copii", "jucării copii"];
const BEAUTY_KEYWORDS = ["parfum", "machiaj", "ruj", "fond de ten", "skincare", "crema fata", "cremă față", "cosmetice"];
const PET_KEYWORDS = ["caine", "câine", "pisica", "pisică", "acvariu", "hrana animale", "hrană animale", "litiera", "litieră"];
const HOBBY_KEYWORDS = ["lego", "warhammer", "pokemon", "magic the gathering", "figurina", "figurină", "board game", "joc de societate", "puzzle"];

function getCarModelPathAlias(query) {
  return understandMarketplaceQuery(query).canonicalPath || "";
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
  const queryUnderstanding = understandMarketplaceQuery(normalized);
  const hasCarModel = Boolean(queryUnderstanding.model);
  const hasCarMake = queryUnderstanding.category === "vehicle";

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

export function isFashionQuery(query = "") {
  const normalized = normalizeMarketplaceQuery(query)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return FASHION_KEYWORDS.some((keyword) => normalized.includes(keyword.normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
}

function matchesNiche(query, keywords) {
  const normalized = normalizeMarketplaceQuery(query)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return keywords.some((keyword) => normalized.includes(keyword.normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
}

export function isHomeQuery(query = "") { return matchesNiche(query, HOME_KEYWORDS); }
export function isDiyQuery(query = "") { return matchesNiche(query, DIY_KEYWORDS); }
export function isSportQuery(query = "") { return matchesNiche(query, SPORT_KEYWORDS); }
export function isPhotoQuery(query = "") { return matchesNiche(query, PHOTO_KEYWORDS); }
export function isMusicQuery(query = "") { return matchesNiche(query, MUSIC_KEYWORDS); }
export function isBooksQuery(query = "") { return matchesNiche(query, BOOKS_KEYWORDS); }
export function isBabyQuery(query = "") { return matchesNiche(query, BABY_KEYWORDS); }
export function isBeautyQuery(query = "") { return matchesNiche(query, BEAUTY_KEYWORDS); }
export function isPetQuery(query = "") { return matchesNiche(query, PET_KEYWORDS); }
export function isHobbyQuery(query = "") { return matchesNiche(query, HOBBY_KEYWORDS); }

export function getPremiumSiteKeys(query = "") {
  return [
    ...PREMIUM_CORE_SITE_KEYS,
    ...(isFashionQuery(query) ? PREMIUM_FASHION_SITE_KEYS : []),
    ...(isHomeQuery(query) ? PREMIUM_HOME_SITE_KEYS : []),
    ...(isDiyQuery(query) ? PREMIUM_DIY_SITE_KEYS : []),
    ...(isSportQuery(query) ? PREMIUM_SPORT_SITE_KEYS : []),
    ...(isPhotoQuery(query) ? PREMIUM_PHOTO_SITE_KEYS : []),
    ...(isMusicQuery(query) ? PREMIUM_MUSIC_SITE_KEYS : []),
    ...(isBooksQuery(query) ? PREMIUM_BOOKS_SITE_KEYS : []),
    ...(isBabyQuery(query) ? PREMIUM_BABY_SITE_KEYS : []), ...(isBeautyQuery(query) ? PREMIUM_BEAUTY_SITE_KEYS : []), ...(isPetQuery(query) ? PREMIUM_PET_SITE_KEYS : []), ...(isHobbyQuery(query) ? PREMIUM_HOBBY_SITE_KEYS : []),
    ...(isFashionQuery(query) ? EXPERIMENTAL_EXPANSION.fashion : []), ...(isHomeQuery(query) ? EXPERIMENTAL_EXPANSION.home : []), ...(isDiyQuery(query) ? EXPERIMENTAL_EXPANSION.diy : []), ...(isSportQuery(query) ? EXPERIMENTAL_EXPANSION.sport : []), ...(isPhotoQuery(query) || isRefurbishedTechQuery(query) ? EXPERIMENTAL_EXPANSION.tech : []), ...(isCarQuery(query) ? EXPERIMENTAL_EXPANSION.auto : []), ...(isBeautyQuery(query) ? EXPERIMENTAL_EXPANSION.beauty : []), ...(isPetQuery(query) ? EXPERIMENTAL_EXPANSION.pet : []), ...(isBooksQuery(query) ? EXPERIMENTAL_EXPANSION.books : []), ...(isMusicQuery(query) ? EXPERIMENTAL_EXPANSION.music : [])
  ];
}

function createCategoryRetailer({ key, label, priority, searchUrl, focus }) {
  return {
    key,
    label,
    priority,
    defaultEnabled: false,
    provider: "direct",
    strategy: "direct-html-retail",
    sourceType: "retailer",
    defaultCondition: "Nou",
    defaultSellerType: "Retailer",
    estimatedCreditsPerPage: 0,
    waitForMs: 0,
    timeoutMs: 18000,
    pageSize: 30,
    maxPages: 1,
    defaultLimit: 30,
    defaultMaxPages: 1,
    searchUrl,
    pagedSearchUrl(query) { return this.searchUrl(query); },
    prompt(query, limit) {
      return buildBasePrompt(label, query, limit, `This is a ${focus} retailer. Keep purchasable product cards with the current payable price; exclude editorial content, category navigation, and promotional banners.`);
    }
  };
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
  },
  "sizeer.ro": {
    key: "sizeer.ro",
    label: "Sizeer",
    priority: 16,
    defaultEnabled: false,
    provider: "direct",
    strategy: "direct-html-retail",
    sourceType: "retailer",
    defaultCondition: "Nou",
    defaultSellerType: "Retailer",
    estimatedCreditsPerPage: 0,
    waitForMs: 0,
    timeoutMs: 18000,
    pageSize: 36,
    maxPages: 1,
    defaultLimit: 36,
    defaultMaxPages: 1,
    searchUrl(query) {
      return `https://sizeer.ro/search?query%5Bmenu_item%5D=&query%5Bquerystring%5D=${encodeSearchText(query)}`;
    },
    pagedSearchUrl(query) { return this.searchUrl(query); },
    prompt(query, limit) {
      return buildBasePrompt("Sizeer Romania", query, limit, "This is a sneaker and streetwear retailer. Keep purchasable product cards and prefer the current sale price over crossed-out or historical prices.");
    }
  },
  "epantofi.ro": {
    key: "epantofi.ro",
    label: "ePantofi",
    priority: 17,
    defaultEnabled: false,
    provider: "direct",
    strategy: "direct-html-retail",
    sourceType: "retailer",
    defaultCondition: "Nou",
    defaultSellerType: "Retailer",
    estimatedCreditsPerPage: 0,
    waitForMs: 0,
    timeoutMs: 18000,
    pageSize: 36,
    maxPages: 1,
    defaultLimit: 36,
    defaultMaxPages: 1,
    searchUrl(query) {
      const encoded = encodeSearchText(query);
      return `https://epantofi.ro/s/${encoded}?q=${encoded}`;
    },
    pagedSearchUrl(query) { return this.searchUrl(query); },
    prompt(query, limit) {
      return buildBasePrompt("ePantofi Romania", query, limit, "This is a footwear, bags, and accessories retailer. Keep purchasable product cards and their current payable price.");
    }
  },
  "fashiondays.ro": {
    key: "fashiondays.ro",
    label: "Fashion Days",
    priority: 18,
    defaultEnabled: false,
    provider: "direct",
    strategy: "direct-html-retail",
    sourceType: "retailer",
    defaultCondition: "Nou",
    defaultSellerType: "Retailer",
    estimatedCreditsPerPage: 0,
    waitForMs: 0,
    timeoutMs: 18000,
    pageSize: 36,
    maxPages: 1,
    defaultLimit: 36,
    defaultMaxPages: 1,
    searchUrl(query) {
      return `https://www.fashiondays.ro/g/search/?q=${encodeSearchText(query)}`;
    },
    pagedSearchUrl(query) { return this.searchUrl(query); },
    prompt(query, limit) {
      return buildBasePrompt("Fashion Days Romania", query, limit, "This is a fashion retailer. Keep purchasable fashion product cards, excluding campaign banners and category navigation.");
    }
  },
  "zalando.ro": {
    key: "zalando.ro",
    label: "Zalando",
    priority: 19,
    defaultEnabled: false,
    provider: "direct",
    strategy: "direct-html-retail",
    sourceType: "retailer",
    defaultCondition: "Nou",
    defaultSellerType: "Retailer",
    estimatedCreditsPerPage: 0,
    waitForMs: 0,
    timeoutMs: 18000,
    pageSize: 36,
    maxPages: 1,
    defaultLimit: 36,
    defaultMaxPages: 1,
    searchUrl(query) {
      return `https://www.zalando.ro/catalog/?q=${encodeSearchText(query)}`;
    },
    pagedSearchUrl(query) { return this.searchUrl(query); },
    prompt(query, limit) {
      return buildBasePrompt("Zalando Romania", query, limit, "This is a fashion retailer. Keep product cards with an in-stock current price; ignore editorial and navigation content.");
    }
  },
  "aboutyou.ro": {
    key: "aboutyou.ro",
    label: "ABOUT YOU",
    priority: 20,
    defaultEnabled: false,
    provider: "direct",
    strategy: "direct-html-retail",
    sourceType: "retailer",
    defaultCondition: "Nou",
    defaultSellerType: "Retailer",
    estimatedCreditsPerPage: 0,
    waitForMs: 0,
    timeoutMs: 18000,
    pageSize: 36,
    maxPages: 1,
    defaultLimit: 36,
    defaultMaxPages: 1,
    searchUrl(query) {
      return `https://www.aboutyou.ro/suche?term=${encodeSearchText(query)}`;
    },
    pagedSearchUrl(query) { return this.searchUrl(query); },
    prompt(query, limit) {
      return buildBasePrompt("ABOUT YOU Romania", query, limit, "This is a fashion retailer. Keep current purchasable product cards and exclude style-editorial cards.");
    }
  },
  "answear.ro": {
    key: "answear.ro",
    label: "Answear",
    priority: 21,
    defaultEnabled: false,
    provider: "direct",
    strategy: "direct-html-retail",
    sourceType: "retailer",
    defaultCondition: "Nou",
    defaultSellerType: "Retailer",
    estimatedCreditsPerPage: 0,
    waitForMs: 0,
    timeoutMs: 18000,
    pageSize: 36,
    maxPages: 1,
    defaultLimit: 36,
    defaultMaxPages: 1,
    searchUrl(query) {
      return `https://answear.ro/k?search=${encodeSearchText(query)}`;
    },
    pagedSearchUrl(query) { return this.searchUrl(query); },
    prompt(query, limit) {
      return buildBasePrompt("Answear Romania", query, limit, "This is a fashion retailer. Keep purchasable product cards and their current price, not promotional tiles.");
    }
  },
  "modivo.ro": {
    key: "modivo.ro",
    label: "MODIVO",
    priority: 22,
    defaultEnabled: false,
    provider: "direct",
    strategy: "direct-html-retail",
    sourceType: "retailer",
    defaultCondition: "Nou",
    defaultSellerType: "Retailer",
    estimatedCreditsPerPage: 0,
    waitForMs: 0,
    timeoutMs: 18000,
    pageSize: 36,
    maxPages: 1,
    defaultLimit: 36,
    defaultMaxPages: 1,
    searchUrl(query) {
      const encoded = encodeSearchText(query);
      return `https://modivo.ro/s/${encoded}?q=${encoded}`;
    },
    pagedSearchUrl(query) { return this.searchUrl(query); },
    prompt(query, limit) {
      return buildBasePrompt("MODIVO Romania", query, limit, "This is a fashion retailer. Keep product cards with the current payable price and exclude filters and sponsored navigation.");
    }
  },
  ...Object.fromEntries([
    createCategoryRetailer({
      key: "ikea.com", label: "IKEA", priority: 23, focus: "furniture and home",
      searchUrl: (query) => `https://www.ikea.com/ro/ro/search/?q=${encodeSearchText(query)}`
    }),
    createCategoryRetailer({
      key: "jysk.ro", label: "JYSK", priority: 24, focus: "furniture and home",
      searchUrl: (query) => `https://jysk.ro/cauta?q=${encodeSearchText(query)}`
    }),
    createCategoryRetailer({
      key: "mobexpert.ro", label: "Mobexpert", priority: 25, focus: "furniture and home",
      searchUrl: (query) => `https://mobexpert.ro/search?query=${encodeSearchText(query)}`
    }),
    createCategoryRetailer({
      key: "dedeman.ro", label: "Dedeman", priority: 26, focus: "DIY, tools, and home improvement",
      searchUrl: (query) => `https://www.dedeman.ro/ro/cauta/s/${encodeSearchText(query)}`
    }),
    createCategoryRetailer({
      key: "leroymerlin.ro", label: "Leroy Merlin", priority: 27, focus: "DIY, tools, and home improvement",
      searchUrl: (query) => `https://www.leroymerlin.ro/products?query=${encodeSearchText(query)}`
    }),
    createCategoryRetailer({
      key: "hornbach.ro", label: "HORNBACH", priority: 28, focus: "DIY, tools, and home improvement",
      searchUrl: (query) => `https://www.hornbach.ro/cauta/?q=${encodeSearchText(query)}`
    }),
    createCategoryRetailer({
      key: "decathlon.ro", label: "Decathlon", priority: 29, focus: "sports and outdoor",
      searchUrl: (query) => `https://www.decathlon.ro/search?query=${encodeSearchText(query)}`
    }),
    createCategoryRetailer({
      key: "sportvision.ro", label: "Sport Vision", priority: 30, focus: "sports and outdoor",
      searchUrl: (query) => `https://www.sportvision.ro/catalogsearch/result/?q=${encodeSearchText(query)}`
    }),
    createCategoryRetailer({
      key: "intersport.ro", label: "INTERSPORT", priority: 31, focus: "sports and outdoor",
      searchUrl: (query) => `https://www.intersport.ro/catalogsearch/result/?q=${encodeSearchText(query)}`
    }),
    createCategoryRetailer({
      key: "f64.ro", label: "F64", priority: 32, focus: "photo and video equipment",
      searchUrl: (query) => `https://www.f64.ro/${encodeSearchText(query)}?map=ft`
    }),
    createCategoryRetailer({
      key: "photosetup.ro", label: "Photosetup", priority: 33, focus: "photo and video equipment",
      searchUrl: (query) => `https://www.photosetup.ro/catalogsearch/result/?q=${encodeSearchText(query)}`
    }),
    createCategoryRetailer({
      key: "soundcreation.ro", label: "SoundCreation", priority: 34, focus: "musical instruments and pro audio",
      searchUrl: (query) => `https://www.soundcreation.ro/catalogsearch/result/?q=${encodeSearchText(query)}`
    }),
    createCategoryRetailer({
      key: "mcmusic.ro", label: "M&C Musical Instruments", priority: 35, focus: "musical instruments and pro audio",
      searchUrl: (query) => `https://www.mcmusic.ro/catalogsearch/result/?q=${encodeSearchText(query)}`
    }),
    createCategoryRetailer({
      key: "carturesti.ro", label: "Cărturești", priority: 36, focus: "books, games, and collectibles",
      searchUrl: (query) => `https://carturesti.ro/search?query=${encodeSearchText(query)}`
    }),
    createCategoryRetailer({
      key: "libris.ro", label: "Libris", priority: 37, focus: "books, games, and collectibles",
      searchUrl: (query) => `https://www.libris.ro/search?query=${encodeSearchText(query)}`
    }),
    ...[
      ["noriel.ro", "Noriel", "baby and kids"], ["nichiduta.ro", "Nichiduta", "baby and kids"], ["bebetei.ro", "Bebe Tei", "baby and kids"],
      ["notino.ro", "Notino", "beauty and personal care"], ["douglas.ro", "Douglas", "beauty and personal care"], ["sephora.ro", "Sephora", "beauty and personal care"],
      ["zooplus.ro", "Zooplus", "pet supplies"], ["animax.ro", "Animax", "pet supplies"], ["petmart.ro", "PetMart", "pet supplies"],
      ["redgoblin.ro", "Red Goblin", "toys and hobby"], ["regatuljocurilor.ro", "Regatul Jocurilor", "toys and hobby"], ["bricksdepot.ro", "Bricks Depot", "toys and hobby"]
    ].map(([key, label, focus], index) => createCategoryRetailer({
      key, label, focus, priority: 38 + index,
      searchUrl: (query) => `https://www.${key}/catalogsearch/result/?q=${encodeSearchText(query)}`
    })),
    ...EXPERIMENTAL_EXPANSION_SITE_KEYS.filter((key) => !["altex.ro", "intersport.ro", "evomag.ro", "notino.ro", "animax.ro", "petmart.ro", "zooplus.ro", "mcmusic.ro", "soundcreation.ro"].includes(key)).map((key, index) => createCategoryRetailer({
      key,
      label: key.replace(/^www\./, "").replace(/\.(ro|com|eu|de)$/, ""),
      priority: 60 + index,
      focus: "experimental niche retail",
      searchUrl: (query) => `https://www.${key}/catalogsearch/result/?q=${encodeSearchText(query)}`
    }))
  ].map((site) => [site.key, site]))

};

const SITE_NICHE_KEYS = new Map([
  ["marketplaces", ["olx.ro", "vinted.ro", "lajumate.ro", "okazii.ro", "publi24.ro", "anuntul.ro", "price.ro", "shopmania.ro", "compari.ro"]],
  ["tech", ["flip.ro", "klap.ro", "emag.ro", "evomag.ro", "cel.ro", "pcgarage.ro", "flanco.ro", "altex.ro"]],
  ["automotive", ["autovit.ro", "bestauto.ro"]],
  ["fashion", PREMIUM_FASHION_SITE_KEYS],
  ["home", PREMIUM_HOME_SITE_KEYS],
  ["diy", PREMIUM_DIY_SITE_KEYS],
  ["sport", PREMIUM_SPORT_SITE_KEYS],
  ["photo", PREMIUM_PHOTO_SITE_KEYS],
  ["music", PREMIUM_MUSIC_SITE_KEYS],
  ["books", PREMIUM_BOOKS_SITE_KEYS], ["baby", PREMIUM_BABY_SITE_KEYS], ["beauty", PREMIUM_BEAUTY_SITE_KEYS], ["pet", PREMIUM_PET_SITE_KEYS], ["hobby", PREMIUM_HOBBY_SITE_KEYS]
]);

for (const [niche, siteKeys] of SITE_NICHE_KEYS) {
  for (const siteKey of siteKeys) {
    if (SITES[siteKey]) SITES[siteKey].niches = [...new Set([...(SITES[siteKey].niches || []), niche])];
  }
}

for (const [niche, siteKeys] of Object.entries(EXPERIMENTAL_EXPANSION)) {
  for (const siteKey of siteKeys) {
    if (SITES[siteKey]) SITES[siteKey].niches = [...new Set([...(SITES[siteKey].niches || []), niche])];
  }
}

const ACTIVE_SOURCE_KEYS = new Set([
  ...FREE_DEFAULT_SITE_KEYS,
  ...FREE_CAR_SITE_KEYS,
  ...FREE_TECH_SITE_KEYS
]);

for (const [siteKey, site] of Object.entries(SITES)) {
  site.integrationStatus = ACTIVE_SOURCE_KEYS.has(siteKey)
    ? SOURCE_INTEGRATION_STATES.active
    : SOURCE_INTEGRATION_STATES.experimental;
}

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
  if (isCarQuery(query)) {
    return [
      ...FREE_CAR_SITE_KEYS,
      "olx.ro",
      "lajumate.ro",
      "okazii.ro",
      "publi24.ro",
      "anuntul.ro"
    ];
  }
  const conditionalSiteKeys = [
    ...(isRefurbishedTechQuery(query) ? FREE_TECH_SITE_KEYS : [])
  ];
  return [...conditionalSiteKeys, ...FREE_DEFAULT_SITE_KEYS];
}
