const STOP_WORDS = new Set([
  "a",
  "al",
  "ale",
  "cu",
  "de",
  "din",
  "for",
  "in",
  "la",
  "of",
  "pe",
  "pentru",
  "si",
  "the"
]);

const NEGATIVE_INTENTS = {
  wanted: [
    "achizitionez",
    "achizitii",
    "caut",
    "cumpar",
    "cumparam",
    "cumparare"
  ],
  service: [
    "curatare",
    "debarasare",
    "diagnosticare",
    "instalare",
    "montaj",
    "reconditionare",
    "reparatie",
    "reparatii",
    "service",
    "servis",
    "transport"
  ],
  part: [
    "accesorii",
    "accesoriu",
    "adaptor",
    "acumulator",
    "baterie",
    "cablu",
    "cap",
    "capete",
    "capac",
    "carcasa",
    "curea",
    "duza",
    "duze",
    "display",
    "ecran",
    "etui",
    "filtru",
    "filtre",
    "folie",
    "furtun",
    "garnitura",
    "husa",
    "incarcator",
    "modul",
    "motor",
    "piesa",
    "piese",
    "placa",
    "pompa",
    "rulment",
    "piciorus",
    "picioruse",
    "steag",
    "steaguri",
    "suport",
    "telecomanda",
    "tok",
    "usa"
  ],
  broken: [
    "blocat",
    "defect",
    "defecta",
    "defecte",
    "fisurat",
    "icloud",
    "nefunctional",
    "spart",
    "stricat",
    "stricata"
  ]
};

const NEGATIVE_PHRASES = {
  service: [
    "service gsm",
    "reparatii telefoane",
    "reparatii masina de spalat",
    "reparatii masini de spalat"
  ],
  part: [
    "pentru piese"
  ],
  commercial: [
    "format din",
    "orice model",
    "toate marcile",
    "toate modelele"
  ]
};

const ACCESSORY_HEADS = [
  "accesorii",
  "accesoriu",
  "adaptor",
  "alimentator",
  "banda",
  "box",
  "cablu",
  "capac",
  "case",
  "charger",
  "ghiveci",
  "ghivece",
  "cutie",
  "curea",
  "etui",
  "folie",
  "geanta",
  "husa",
  "huse",
  "incarcator",
  "kit",
  "mouthpiece",
  "mustiuc",
  "minge",
  "mingi",
  "paleta",
  "palete",
  "perie",
  "perii",
  "plasa",
  "plase",
  "protector",
  "racheta",
  "rachete",
  "recipient",
  "rezervor",
  "rola",
  "role",
  "sac",
  "saci",
  "seminte",
  "stand",
  "stativ",
  "suport",
  "tub",
  "tuburi",
  "toc"
];

const MEDIA_OR_TOY_HEADS = [
  "book",
  "books",
  "carte",
  "carti",
  "lego",
  "manual",
  "roman"
];

const VEHICLE_PART_HEADS = [
  "alternator",
  "amortizor",
  "amortizoare",
  "anvelopa",
  "anvelope",
  "antena",
  "aripa",
  "bara",
  "bot",
  "cadru",
  "capota",
  "caseta",
  "catalizator",
  "cauciuc",
  "cauciucuri",
  "dezmembrari",
  "dezmembrez",
  "dezmembrat",
  "dezmembrate",
  "diferential",
  "directie",
  "electromotor",
  "etrier",
  "etriere",
  "evacuare",
  "far",
  "faruri",
  "felga",
  "felgi",
  "fuzeta",
  "grila",
  "grile",
  "grup",
  "hutoracs",
  "injector",
  "injectoare",
  "janta",
  "jante",
  "nara",
  "nari",
  "oglinda",
  "oglinzi",
  "parbriz",
  "planetara",
  "prag",
  "praguri",
  "portiera",
  "punte",
  "radiator",
  "rezervor",
  "stop",
  "stopuri"
];

const VEHICLE_NON_VEHICLE_TERMS = [
  "adidasi",
  "altaya",
  "atlas",
  "bburago",
  "blazer",
  "buty",
  "die cast",
  "diecast",
  "herpa",
  "hot wheels",
  "kaido",
  "kisauto",
  "kurtka",
  "lego",
  "macheta",
  "machete",
  "majorette",
  "marynarka",
  "matchbox",
  "pantofi",
  "puma",
  "recznik",
  "sapka",
  "sneakersy",
  "spodnie",
  "welly"
];

const VEHICLE_ACCESSORY_HEADS = [
  "covoare",
  "covoras",
  "covorase",
  "presuri",
  "suport telefon",
  "suport telefoane"
];

const SPARE_PART_HEADS = [
  "acumulator",
  "baterie",
  "carcasa",
  "display",
  "ecran",
  "furtun",
  "garnitura",
  "modul",
  "motor",
  "piesa",
  "piese",
  "placa",
  "pompa",
  "rulment",
  "usa",
  ...VEHICLE_PART_HEADS
];

const BUNDLE_MARKERS = [
  "bundle",
  "cu accesorii",
  "kit complet",
  "pachet",
  "set"
];

const ATTRIBUTE_MATCH_MARKERS = [
  "format",
  "forma de",
  "in forma de",
  "model",
  "stil",
  "tip"
];

const PRODUCT_TAXONOMY = {
  trumpet: {
    category: "instrument",
    aliases: ["trumpet", "trumpeta", "trompeta"],
    accessories: ["box", "case", "cutie", "husa", "mouthpiece", "mustiuc", "stand", "stativ", "suport", "toc"]
  },
  jeep_compass: {
    category: "vehicle",
    aliases: ["jeep compass"],
    tokens: ["jeep", "compass"],
    accessories: [...VEHICLE_ACCESSORY_HEADS, "husa", "huse", "jante", "anvelope", "cauciucuri"],
    parts: VEHICLE_PART_HEADS
  },
  table_tennis_table: {
    category: "sport",
    aliases: ["masa de ping pong", "masa ping pong", "masa tenis de masa", "table tennis table", "ping pong table"],
    tokens: ["masa", "ping", "pong", "tenis"],
    accessories: ["fileu", "husa", "minge", "mingi", "paleta", "palete", "racheta", "rachete", "set"]
  },
  basketball_hoop: {
    category: "sport",
    aliases: ["cos de baschet", "cos baschet", "basketball hoop", "panou baschet cu cos"],
    tokens: ["cos", "baschet", "basketball", "hoop", "panou", "inel"],
    accessories: ["minge", "mingi", "net", "plasa", "plase"]
  },
  money_tree: {
    category: "plant",
    aliases: ["money tree", "pachira", "pachira aquatica", "arborele banilor", "copacul banilor"],
    tokens: ["money", "tree", "pachira", "arborele", "banilor", "copacul"],
    accessories: ["seminte"],
    exclusions: MEDIA_OR_TOY_HEADS
  },
  luggage: {
    category: "luggage",
    aliases: ["valiza", "geamantan", "troler", "troller", "suitcase", "luggage"],
    tokens: ["valiza", "geamantan", "troler", "troller", "suitcase", "luggage"],
    accessories: ["husa", "roata", "roti"],
    exclusions: [
      "bormasina",
      "camping",
      "masina de gaurit",
      "masa",
      "picamar",
      "pliabila",
      "rotopercutor",
      "scule",
      "unelte"
    ]
  },
  air_fryer: {
    category: "kitchen",
    aliases: ["airfryer", "air fryer", "friteuza cu aer", "friteuza cu aer cald", "friteuza aer cald"],
    tokens: ["airfryer", "air", "fryer", "friteuza", "aer", "cald"],
    accessories: ["cos", "filtre", "forme", "hartie", "liners", "paper", "silicon", "tava"]
  },
  padel: {
    category: "padel",
    aliases: ["padel", "padla", "padel racket", "racheta padel", "paleta padel"],
    tokens: ["padel", "padla", "racket", "racheta", "rakieta", "paleta", "uto"],
    racketEvidence: [
      "at10",
      "attack",
      "cobalt",
      "equation",
      "genius",
      "hybrit",
      "hybrid",
      "luxury",
      "ml10",
      "nextgen",
      "quantum",
      "racket",
      "racheta",
      "rakieta",
      "uto",
      "x one",
      "x-one"
    ]
  }
};

const BRAND_ALIASES = [
  { brand: "acer", aliases: ["acer"] },
  { brand: "adidas", aliases: ["adidas"] },
  { brand: "aeg", aliases: ["aeg"] },
  { brand: "audi", aliases: ["audi"] },
  { brand: "apple", aliases: ["apple", "iphone", "ipad", "macbook"] },
  { brand: "ariston", aliases: ["ariston"] },
  { brand: "asus", aliases: ["asus"] },
  { brand: "beko", aliases: ["beko"] },
  { brand: "bmw", aliases: ["bmw"] },
  { brand: "bosch", aliases: ["bosch"] },
  { brand: "canon", aliases: ["canon"] },
  { brand: "citroen", aliases: ["citroen"] },
  { brand: "dacia", aliases: ["dacia"] },
  { brand: "decathlon", aliases: ["decathlon"] },
  { brand: "dell", aliases: ["dell"] },
  { brand: "dyson", aliases: ["dyson"] },
  { brand: "electrolux", aliases: ["electrolux"] },
  { brand: "ford", aliases: ["ford"] },
  { brand: "garmin", aliases: ["garmin"] },
  { brand: "harman kardon", aliases: ["harman kardon", "harman"] },
  { brand: "huawei", aliases: ["huawei"] },
  { brand: "hp", aliases: ["hp", "hewlett packard"] },
  { brand: "ikea", aliases: ["ikea"] },
  { brand: "indesit", aliases: ["indesit"] },
  { brand: "jbl", aliases: ["jbl"] },
  { brand: "jeep", aliases: ["jeep"] },
  { brand: "lenovo", aliases: ["lenovo"] },
  { brand: "lg", aliases: ["lg"] },
  { brand: "miele", aliases: ["miele"] },
  { brand: "mercedes", aliases: ["mercedes", "mercedes benz"] },
  { brand: "microsoft", aliases: ["microsoft", "xbox"] },
  { brand: "new balance", aliases: ["new balance", "nb"] },
  { brand: "nike", aliases: ["nike", "jordan", "air jordan"] },
  { brand: "nintendo", aliases: ["nintendo", "switch"] },
  { brand: "nox", aliases: ["nox"] },
  { brand: "nvidia", aliases: ["nvidia", "geforce", "rtx"] },
  { brand: "philips", aliases: ["philips"] },
  { brand: "peugeot", aliases: ["peugeot"] },
  { brand: "puma", aliases: ["puma"] },
  { brand: "reebok", aliases: ["reebok"] },
  { brand: "renault", aliases: ["renault"] },
  { brand: "rowenta", aliases: ["rowenta", "rowneta"] },
  { brand: "samsung", aliases: ["samsung", "galaxy"] },
  { brand: "seat", aliases: ["seat"] },
  { brand: "siemens", aliases: ["siemens"] },
  { brand: "skoda", aliases: ["skoda"] },
  { brand: "sony", aliases: ["sony", "playstation", "ps5", "ps4"] },
  { brand: "toyota", aliases: ["toyota"] },
  { brand: "volkswagen", aliases: ["volkswagen", "vw"] },
  { brand: "whirlpool", aliases: ["whirlpool"] },
  { brand: "xiaomi", aliases: ["xiaomi", "redmi", "poco"] },
  { brand: "yamaha", aliases: ["yamaha"] },
  { brand: "zanussi", aliases: ["zanussi"] }
];

const VEHICLE_BRANDS = new Set([
  "audi",
  "bmw",
  "citroen",
  "dacia",
  "ford",
  "jeep",
  "mercedes",
  "opel",
  "peugeot",
  "renault",
  "seat",
  "skoda",
  "toyota",
  "volkswagen",
  "vw"
]);

const QUERY_ALIASES = [
  {
    category: "washing_machine",
    patterns: ["masina de spalat", "masini de spalat", "washing machine", "washer"],
    tokens: ["masina", "spalat", "rufe", "washer", "washing"]
  },
  {
    category: "phone",
    patterns: ["iphone"],
    tokens: ["iphone", "apple"]
  },
  {
    category: "console",
    patterns: ["playstation", "ps5", "ps4"],
    tokens: ["playstation", "ps5", "ps4", "sony"]
  },
  {
    category: "protein",
    patterns: ["proteine", "proteina", "protein", "whey"],
    tokens: ["proteine", "proteina", "protein", "whey"]
  },
  {
    category: "instrument",
    patterns: PRODUCT_TAXONOMY.trumpet.aliases,
    tokens: PRODUCT_TAXONOMY.trumpet.aliases
  },
  {
    category: "vehicle",
    patterns: PRODUCT_TAXONOMY.jeep_compass.aliases,
    tokens: PRODUCT_TAXONOMY.jeep_compass.tokens
  },
  {
    category: "sport",
    patterns: PRODUCT_TAXONOMY.table_tennis_table.aliases,
    tokens: PRODUCT_TAXONOMY.table_tennis_table.tokens
  },
  {
    category: "sport",
    patterns: PRODUCT_TAXONOMY.basketball_hoop.aliases,
    tokens: PRODUCT_TAXONOMY.basketball_hoop.tokens
  },
  {
    category: "plant",
    patterns: PRODUCT_TAXONOMY.money_tree.aliases,
    tokens: PRODUCT_TAXONOMY.money_tree.tokens
  },
  {
    category: "luggage",
    patterns: PRODUCT_TAXONOMY.luggage.aliases,
    tokens: PRODUCT_TAXONOMY.luggage.tokens
  },
  {
    category: "kitchen",
    patterns: PRODUCT_TAXONOMY.air_fryer.aliases,
    tokens: PRODUCT_TAXONOMY.air_fryer.tokens
  },
  {
    category: "padel",
    patterns: PRODUCT_TAXONOMY.padel.aliases,
    tokens: PRODUCT_TAXONOMY.padel.tokens
  }
];

const CATEGORY_EXCLUSIONS = {
  washing_machine: [
    "antivibratii",
    "aspirator",
    "copii",
    "jucarie",
    "jucarii",
    "oale",
    "sac",
    "saci",
    "saculet",
    "saculeti",
    "set",
    "tacamuri",
    "tigai",
    "vase"
  ],
  phone: [
    "banda",
    "conector",
    "geam",
    "protector",
    "r sim",
    "rsim",
    "sim",
    "telefontok"
  ],
  console: [
    "cd",
    "controller",
    "far cry",
    "fifa",
    "fortnite",
    "game",
    "gra",
    "joc",
    "jocuri",
    "maneta"
  ],
  protein: [
    "blender",
    "lame",
    "mixer",
    "pahar",
    "portabil",
    "shaker",
    "smoothie",
    "sticla",
    "usb"
  ],
  instrument: [
    ...PRODUCT_TAXONOMY.trumpet.accessories
  ],
  vehicle: [
    ...PRODUCT_TAXONOMY.jeep_compass.accessories,
    ...PRODUCT_TAXONOMY.jeep_compass.parts,
    ...VEHICLE_PART_HEADS,
    ...VEHICLE_NON_VEHICLE_TERMS,
    "bot complet",
    "fata completa"
  ],
  sport: [
    ...PRODUCT_TAXONOMY.table_tennis_table.accessories,
    ...PRODUCT_TAXONOMY.basketball_hoop.accessories
  ],
  plant: [
    ...PRODUCT_TAXONOMY.money_tree.accessories,
    ...PRODUCT_TAXONOMY.money_tree.exclusions
  ],
  luggage: [
    ...PRODUCT_TAXONOMY.luggage.accessories,
    ...PRODUCT_TAXONOMY.luggage.exclusions
  ],
  kitchen: [
    ...PRODUCT_TAXONOMY.air_fryer.accessories
  ]
};

const CATEGORY_PRICE_FLOORS_RON = {
  washing_machine: 120,
  phone: 600,
  console: 700,
  protein: 60,
  vehicle: 7000,
  sport: 120,
  plant: 20,
  luggage: 30,
  kitchen: 80
};

const TOKEN_VARIANTS = {
  padel: ["padla", "padeluto"],
  padla: ["padel"],
  husa: ["huse"],
  huse: ["husa"]
};

export function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(value = "") {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token && !STOP_WORDS.has(token));
}

function hasAnyToken(tokens, terms) {
  return [...terms].some((term) => tokens.has(normalizeText(term)));
}

function includesAnyPhrase(text, phrases) {
  const textTokens = new Set(tokenize(text));
  return phrases.some((phrase) => textHasTerm(text, textTokens, phrase));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getTokenVariants(token) {
  const normalized = normalizeText(token);
  return [normalized, ...(TOKEN_VARIANTS[normalized] || [])];
}

function tokenSetHasTerm(tokens, term) {
  return getTokenVariants(term).some((variant) => tokens.has(variant));
}

function textHasTerm(text, tokens, term) {
  const normalizedTerm = normalizeText(term);
  if (!normalizedTerm) {
    return false;
  }
  if (normalizedTerm.includes(" ")) {
    return new RegExp(`(?:^| )${escapeRegExp(normalizedTerm)}(?: |$)`).test(text);
  }
  return tokenSetHasTerm(tokens, normalizedTerm);
}

function textStartsWithTerm(text, term) {
  const normalizedTerm = normalizeText(term);
  if (!normalizedTerm) {
    return false;
  }
  if (normalizedTerm.includes(" ")) {
    return text === normalizedTerm || text.startsWith(`${normalizedTerm} `);
  }
  return getTokenVariants(normalizedTerm).some((variant) => text === variant || text.startsWith(`${variant} `));
}

function hasPadelProductEvidence(text, textTokens, queryProfile) {
  if (queryProfile.taxonomy !== PRODUCT_TAXONOMY.padel) {
    return false;
  }

  const evidenceTerms = queryProfile.taxonomy.racketEvidence || [];
  return evidenceTerms.some((term) => textHasTerm(text, textTokens, term));
}

function hasRequiredTokenEvidence(text, textTokens, token, queryProfile) {
  if (tokenSetHasTerm(textTokens, token)) {
    return true;
  }

  if (["padel", "padla"].includes(normalizeText(token)) && hasPadelProductEvidence(text, textTokens, queryProfile)) {
    return true;
  }

  return false;
}

function getProductTaxonomy(normalizedQuery) {
  return Object.entries(PRODUCT_TAXONOMY).find(([, config]) =>
    config.aliases.some((alias) => normalizedQuery.includes(normalizeText(alias)))
  )?.[1] || null;
}

export function getQueryBrandTerms(query) {
  const normalizedQuery = normalizeText(query);
  const tokenSet = new Set(tokenize(query));
  const brandTerms = new Set();

  for (const brandConfig of BRAND_ALIASES) {
    const matchedAliases = brandConfig.aliases.filter((alias) => {
      const normalizedAlias = normalizeText(alias);
      const aliasTokens = tokenize(alias);
      return aliasTokens.length > 1
        ? normalizedQuery.includes(normalizedAlias)
        : tokenSet.has(normalizedAlias);
    });

    if (!matchedAliases.length) {
      continue;
    }

    for (const token of tokenize(brandConfig.brand)) {
      brandTerms.add(token);
    }
    for (const alias of matchedAliases) {
      for (const token of tokenize(alias)) {
        brandTerms.add(token);
      }
    }
  }

  return [...brandTerms];
}

function parseQueryType({ normalized, tokens, taxonomy }) {
  const tokenSet = new Set(tokens);
  const accessoryHeads = new Set([
    ...ACCESSORY_HEADS.map(normalizeText),
    ...(taxonomy?.accessories || []).map(normalizeText)
  ]);

  if (hasAnyToken(tokenSet, NEGATIVE_INTENTS.wanted)) {
    return "wanted";
  }
  if (hasAnyToken(tokenSet, NEGATIVE_INTENTS.service)) {
    return "service";
  }
  if (includesAnyPhrase(normalized, NEGATIVE_PHRASES.part) || hasAnyToken(tokenSet, SPARE_PART_HEADS)) {
    return "spare_part";
  }
  if (hasAnyToken(tokenSet, NEGATIVE_INTENTS.broken)) {
    return "broken_or_for_parts";
  }
  if (hasAnyToken(tokenSet, accessoryHeads)) {
    return "accessory";
  }
  return "main_product";
}

function getQueryProfile(query) {
  const normalized = normalizeText(query);
  const baseTokens = tokenize(query);
  const expandedTokens = new Set(baseTokens);
  const brandTerms = getQueryBrandTerms(query);
  const categories = new Set();
  const taxonomy = getProductTaxonomy(normalized);
  const tokenSet = new Set(baseTokens);
  const hasVehicleBrand = [...VEHICLE_BRANDS].some((brand) => tokenSet.has(brand));

  for (const alias of QUERY_ALIASES) {
    if (alias.patterns.some((pattern) => normalized.includes(pattern))) {
      if (alias.category) {
        categories.add(alias.category);
      }
      for (const token of alias.tokens) {
        expandedTokens.add(token);
      }
    }
  }
  for (const token of brandTerms) {
    expandedTokens.add(token);
  }
  if (hasVehicleBrand) {
    categories.add("vehicle");
  }

  return {
    normalized,
    tokens: baseTokens,
    expandedTokens: [...expandedTokens],
    brandTerms,
    categories: [...categories],
    taxonomy,
    queryType: parseQueryType({ normalized, tokens: baseTokens, taxonomy }),
    productHead: baseTokens.find((token) => {
      const allAccessoryHeads = [
        ...ACCESSORY_HEADS,
        ...(taxonomy?.accessories || [])
      ].map(normalizeText);
      return !allAccessoryHeads.includes(token) && !SPARE_PART_HEADS.map(normalizeText).includes(token);
    }) || baseTokens.at(-1) || ""
  };
}

function includesToken(tokens, term) {
  return tokenSetHasTerm(tokens, term);
}

function findNegativeMatches(text, queryProfile) {
  const queryTokenSet = new Set(queryProfile.expandedTokens);
  const textTokens = new Set(tokenize(text));
  const matches = [];

  for (const [intent, terms] of Object.entries(NEGATIVE_INTENTS)) {
    for (const term of terms) {
      if (includesToken(queryTokenSet, term)) {
        continue;
      }
      if (includesToken(textTokens, term)) {
        matches.push({ intent, term });
      }
    }
  }

  for (const [intent, phrases] of Object.entries(NEGATIVE_PHRASES)) {
    for (const phrase of phrases) {
      const normalizedPhrase = normalizeText(phrase);
      if (queryProfile.normalized.includes(normalizedPhrase)) {
        continue;
      }
      if (textHasTerm(text, textTokens, phrase)) {
        matches.push({ intent, term: phrase });
      }
    }
  }

  const categoriesForExclusions = queryProfile.queryType === "main_product"
    ? queryProfile.categories
    : queryProfile.categories.filter((category) => category !== "vehicle");

  for (const category of categoriesForExclusions) {
    for (const term of CATEGORY_EXCLUSIONS[category] || []) {
      const normalizedTerm = normalizeText(term);
      if (textHasTerm(queryProfile.normalized, queryTokenSet, normalizedTerm)) {
        continue;
      }
      if (textHasTerm(text, textTokens, normalizedTerm)) {
        matches.push({ intent: "irrelevant", term });
      }
    }
  }

  return matches;
}

function getMatchStats(title, text, queryProfile) {
  const titleText = normalizeText(title);
  const titleTokens = new Set(tokenize(title));
  const textTokens = new Set(tokenize(text));
  const requiredTokens = queryProfile.tokens;
  const brandTerms = queryProfile.brandTerms || [];
  const brandTokenSet = new Set(brandTerms);
  const nonBrandRequiredTokens = requiredTokens.filter((token) => !brandTokenSet.has(token));
  const requiredNumberTokens = requiredTokens.filter((token) => /^\d+$/.test(token));
  const expandedTokens = queryProfile.expandedTokens;
  const titleMatches = requiredTokens.filter((token) => hasRequiredTokenEvidence(titleText, titleTokens, token, queryProfile));
  const textMatches = requiredTokens.filter((token) => hasRequiredTokenEvidence(text, textTokens, token, queryProfile));
  const missingRequiredTokens = requiredTokens.filter((token) => !hasRequiredTokenEvidence(text, textTokens, token, queryProfile));
  const missingCriticalTokens = nonBrandRequiredTokens.filter((token) =>
    token.length >= 4 &&
    !/^\d+$/.test(token) &&
    !hasRequiredTokenEvidence(text, textTokens, token, queryProfile)
  );
  const brandTitleMatches = brandTerms.filter((token) => tokenSetHasTerm(titleTokens, token));
  const brandTextMatches = brandTerms.filter((token) => tokenSetHasTerm(textTokens, token));
  const numberMatches = requiredNumberTokens.filter((token) => tokenSetHasTerm(textTokens, token));
  const expandedMatches = expandedTokens.filter((token) => tokenSetHasTerm(textTokens, token));

  return {
    exactPhrase: Boolean(queryProfile.normalized && titleText.includes(queryProfile.normalized)),
    titleMatches,
    textMatches,
    brandTitleMatches,
    brandTextMatches,
    brandCount: brandTerms.length ? 1 : 0,
    numberMatches,
    expandedMatches,
    missingRequiredTokens,
    missingCriticalTokens,
    requiredCount: requiredTokens.length,
    requiredNumberCount: requiredNumberTokens.length
  };
}

function detectModelVariantMismatch({ title, text, queryProfile }) {
  const normalizedTitle = normalizeText(title);
  const normalizedText = normalizeText(text);
  const queryTokens = new Set(queryProfile.tokens);
  const titleTokens = new Set(tokenize(normalizedTitle));
  const textTokens = new Set(tokenize(normalizedText));

  const queryHasPro = queryTokens.has("pro");
  const queryHasMax = queryTokens.has("max");
  const titleHasPro = titleTokens.has("pro") || textTokens.has("pro");
  const titleHasMax = titleTokens.has("max") || textTokens.has("max");

  const queryWantsProOnly = queryHasPro && !queryHasMax;
  const queryWantsProMax = queryHasPro && queryHasMax;
  const titleIsProOnly = titleHasPro && !titleHasMax;
  const titleIsProMax = titleHasPro && titleHasMax;

  if (queryWantsProOnly && titleIsProMax) {
    return { mismatch: true, reason: "pro_vs_pro_max" };
  }
  if (queryWantsProMax && titleIsProOnly) {
    return { mismatch: true, reason: "pro_max_vs_pro" };
  }
  return { mismatch: false, reason: "" };
}

function getIntentType(negativeMatches, matchStats) {
  if (!matchStats.requiredCount || (matchStats.textMatches.length === 0 && matchStats.expandedMatches.length === 0)) {
    return "weak_match";
  }
  if (matchStats.requiredNumberCount && matchStats.numberMatches.length < matchStats.requiredNumberCount) {
    return "weak_match";
  }

  const priority = ["wanted", "service", "part", "broken", "irrelevant", "commercial"];
  const firstNegative = priority.find((intent) => negativeMatches.some((match) => match.intent === intent));
  return firstNegative || "product";
}

function getListingType({ title, text, queryProfile, negativeMatches }) {
  const titleText = normalizeText(title);
  const titleTokens = new Set(tokenize(title));
  const textTokens = new Set(tokenize(text));
  const allAccessoryHeads = [
    ...ACCESSORY_HEADS,
    ...(queryProfile.taxonomy?.accessories || [])
  ].map(normalizeText);
  const allSparePartHeads = SPARE_PART_HEADS.map(normalizeText);
  const queryAnchors = queryProfile.expandedTokens.map(normalizeText);
  const brandAnchorSet = new Set((queryProfile.brandTerms || []).map(normalizeText));
  const productAnchors = queryAnchors.filter((token) => !brandAnchorSet.has(token));
  const hasAnchor = queryAnchors.some((token) => textHasTerm(titleText, textTokens, token));
  const hasAccessoryHead = allAccessoryHeads.some((term) => textHasTerm(titleText, textTokens, term));
  const hasSparePartHead = allSparePartHeads.some((term) => textHasTerm(titleText, textTokens, term));
  const startsWithProductAnchor = productAnchors.some((anchor) => textStartsWithTerm(titleText, anchor));
  const startsWithAccessory = allAccessoryHeads.some((term) => textStartsWithTerm(titleText, term));
  const accessoryForProduct = allAccessoryHeads.some((term) =>
    productAnchors.some((anchor) =>
      titleText.includes(`${normalizeText(term)} ${anchor}`) ||
      titleText.includes(`${normalizeText(term)} pentru ${anchor}`) ||
      titleText.includes(`${normalizeText(term)} for ${anchor}`) ||
      titleText.includes(`${anchor} ${normalizeText(term)}`)
    )
  );
  const productWithAccessory = BUNDLE_MARKERS.some((marker) => textHasTerm(titleText, titleTokens, marker)) &&
    hasAnchor &&
    hasAccessoryHead;
  const accessorySet = ["set", "pachet", "kit"].some((marker) => textStartsWithTerm(titleText, marker)) &&
    hasAnchor &&
    hasAccessoryHead;
  const clearAccessoryMatch = hasAnchor && hasAccessoryHead && (startsWithAccessory || accessoryForProduct || accessorySet);

  if (negativeMatches.some((match) => match.intent === "wanted")) {
    return "wanted";
  }
  if (negativeMatches.some((match) => match.intent === "service")) {
    return "service";
  }
  if (negativeMatches.some((match) => match.intent === "broken")) {
    return "broken_or_for_parts";
  }
  if (queryProfile.queryType === "accessory" && hasAnchor && hasAccessoryHead) {
    return "accessory";
  }
  if (includesAnyPhrase(text, NEGATIVE_PHRASES.part) || hasSparePartHead) {
    return "spare_part";
  }

  const anchorUsedAsAttribute = productAnchors.some((anchor) =>
    ATTRIBUTE_MATCH_MARKERS.some((marker) => titleText.includes(`${normalizeText(marker)} ${anchor}`))
  );
  const basketballRimWithNet = queryProfile.taxonomy === PRODUCT_TAXONOMY.basketball_hoop &&
    (titleTokens.has("inel") || titleTokens.has("panou")) &&
    (titleTokens.has("plasa") || titleTokens.has("plase") || titleTokens.has("net"));

  if (basketballRimWithNet) {
    return "main_product";
  }
  if (
    queryProfile.queryType === "main_product" &&
    startsWithProductAnchor &&
    !startsWithAccessory &&
    !negativeMatches.some((match) => match.intent === "part" || match.intent === "irrelevant")
  ) {
    return "main_product";
  }
  if (queryProfile.queryType === "main_product" && anchorUsedAsAttribute && !startsWithProductAnchor) {
    return "weak_match";
  }
  // If the listing is clearly an accessory-for-product phrase, keep it as accessory
  // even when it also contains generic bundle markers like "set" or "pachet".
  if (clearAccessoryMatch) {
    return "accessory";
  }
  if (productWithAccessory) {
    return "bundle";
  }
  if (negativeMatches.some((match) => match.intent === "part" || match.intent === "irrelevant")) {
    return "spare_part";
  }
  if (!matchStatsHasProductEvidence(titleTokens, queryProfile)) {
    return "weak_match";
  }

  return "main_product";
}

function matchStatsHasProductEvidence(titleTokens, queryProfile) {
  if (!queryProfile.tokens.length) {
    return false;
  }
  const requiredNumberTokens = queryProfile.tokens.filter((token) => /^\d+$/.test(token));
  if (requiredNumberTokens.some((token) => !tokenSetHasTerm(titleTokens, token))) {
    return false;
  }
  return queryProfile.tokens.some((token) => tokenSetHasTerm(titleTokens, token)) ||
    queryProfile.expandedTokens.some((token) => tokenSetHasTerm(titleTokens, token));
}

function scoreTypeCompatibility(queryType, listingType) {
  if (listingType === "wanted" || listingType === "service" || listingType === "broken_or_for_parts" || listingType === "weak_match") {
    return 0;
  }

  if (queryType === "accessory") {
    if (listingType === "accessory") {
      return 1;
    }
    if (listingType === "bundle") {
      return 0.65;
    }
    return 0.25;
  }

  if (queryType === "spare_part") {
    return listingType === "spare_part" ? 1 : 0.2;
  }

  if (queryType === "main_product") {
    if (listingType === "main_product") {
      return 1;
    }
    if (listingType === "bundle") {
      return 0.85;
    }
    if (listingType === "accessory") {
      return 0.15;
    }
    if (listingType === "spare_part") {
      return 0.05;
    }
  }

  return 0;
}

function scoreRelevance({ item, queryProfile, negativeMatches, matchStats, typeCompatibilityScore }) {
  let score = 0;

  if (matchStats.exactPhrase) {
    score += 45;
  }

  if (matchStats.requiredCount) {
    score += Math.round((matchStats.titleMatches.length / matchStats.requiredCount) * 35);
    score += Math.round((matchStats.textMatches.length / matchStats.requiredCount) * 15);
  }
  if (matchStats.brandCount) {
    const brandTitleRatio = Math.min(1, matchStats.brandTitleMatches.length / matchStats.brandCount);
    const brandTextRatio = Math.min(1, matchStats.brandTextMatches.length / matchStats.brandCount);
    score += Math.round(brandTitleRatio * 24);
    score += Math.round(brandTextRatio * 10);
    if (!matchStats.brandTextMatches.length) {
      score -= 18;
    }
  }

  score += Math.min(matchStats.expandedMatches.length * 3, 12);
  if (
    matchStats.requiredCount > 1 &&
    matchStats.expandedMatches.length >= 2 &&
    matchStats.titleMatches.length < matchStats.requiredCount
  ) {
    score += 10;
  }
  if (matchStats.requiredCount && !matchStats.titleMatches.length && matchStats.expandedMatches.length) {
    score += 35;
  }
  if (matchStats.requiredCount && !matchStats.textMatches.length && matchStats.expandedMatches.length) {
    score += 15;
  }

  if (item.price) {
    score += 10;
  }

  for (const match of negativeMatches) {
    if (match.intent === "wanted" || match.intent === "service") {
      score -= 60;
    } else if (match.intent === "part" || match.intent === "broken" || match.intent === "irrelevant") {
      score -= 45;
    } else {
      score -= 25;
    }
  }

  if (
    matchStats.requiredCount > 1 &&
    matchStats.titleMatches.length <= 1 &&
    matchStats.expandedMatches.length <= 1 &&
    !matchStats.exactPhrase
  ) {
    score -= 20;
  }
  if (matchStats.requiredNumberCount && matchStats.numberMatches.length < matchStats.requiredNumberCount) {
    score -= 50;
  }
  if (matchStats.brandCount && !matchStats.brandTitleMatches.length && matchStats.titleMatches.length < matchStats.requiredCount) {
    score -= 12;
  }
  if (matchStats.missingCriticalTokens.length) {
    score -= Math.min(95, matchStats.missingCriticalTokens.length * 55);
  }
  score += Math.round((typeCompatibilityScore - 0.5) * 40);

  return Math.max(0, Math.min(100, score));
}

export function classifyListingIntent(item, query) {
  const queryProfile = getQueryProfile(query);
  const title = item.title || "";
  const text = normalizeText([
    item.title,
    item.description,
    item.condition,
    item.sellerType
  ].filter(Boolean).join(" "));
  let negativeMatches = findNegativeMatches(text, queryProfile);
  for (const category of queryProfile.categories) {
    const priceFloor = CATEGORY_PRICE_FLOORS_RON[category];
    if (queryProfile.queryType === "main_product" && Number.isFinite(priceFloor) && Number.isFinite(item.priceRon) && item.priceRon < priceFloor) {
      negativeMatches.push({ intent: "irrelevant", term: "price_below_category_floor" });
    }
  }
  const matchStats = getMatchStats(title, text, queryProfile);
  const variantMatch = detectModelVariantMismatch({ title, text, queryProfile });
  const listingType = getListingType({ title, text, queryProfile, negativeMatches });
  if (queryProfile.taxonomy === PRODUCT_TAXONOMY.basketball_hoop && listingType === "main_product") {
    negativeMatches = negativeMatches.filter((match) => !["plasa", "plase", "net", "set"].includes(match.term));
  }
  const typeCompatibilityScore = scoreTypeCompatibility(queryProfile.queryType, listingType);
  const legacyIntentType = getIntentType(negativeMatches, matchStats);
  const intentType =
    listingType === "main_product" || listingType === "bundle" ? "product" :
    listingType === "spare_part" ? "part" :
    listingType;
  const relevanceScore = scoreRelevance({
    item,
    queryProfile,
    negativeMatches,
    matchStats,
    typeCompatibilityScore
  }) - (variantMatch.mismatch ? 35 : 0) - (matchStats.missingCriticalTokens.length * 25);
  const rejectionReasons = [];

  if (typeCompatibilityScore < 0.8) {
    rejectionReasons.push(`type_mismatch:${queryProfile.queryType}->${listingType}`);
  }
  if (legacyIntentType !== "product") {
    rejectionReasons.push(legacyIntentType);
  }
  if (matchStats.requiredCount && matchStats.textMatches.length === 0 && matchStats.expandedMatches.length === 0) {
    rejectionReasons.push("missing_query_tokens");
  }
  if (matchStats.requiredNumberCount && matchStats.numberMatches.length < matchStats.requiredNumberCount) {
    rejectionReasons.push("missing_model_number");
  }
  if (matchStats.brandCount && matchStats.brandTextMatches.length === 0) {
    rejectionReasons.push("missing_brand");
  }
  if (matchStats.missingCriticalTokens.length) {
    rejectionReasons.push("missing_critical_query_tokens");
  }
  for (const match of negativeMatches) {
    rejectionReasons.push(`${match.intent}:${match.term}`);
  }
  if (relevanceScore < 45) {
    rejectionReasons.push("low_relevance");
  }
  if (variantMatch.mismatch) {
    rejectionReasons.push(`variant_mismatch:${variantMatch.reason}`);
  }

  return {
    ...item,
    queryType: queryProfile.queryType,
    listingType,
    productHead: queryProfile.productHead,
    anchorTerms: queryProfile.expandedTokens,
    brandTerms: queryProfile.brandTerms,
    typeCompatibilityScore,
    intentType,
    relevanceScore: Math.max(0, Math.min(100, relevanceScore)),
    rejectionReasons: [...new Set(rejectionReasons)],
    isRecommendedCandidate: typeCompatibilityScore >= 0.8 && relevanceScore >= 55 && matchStats.missingCriticalTokens.length === 0
  };
}
