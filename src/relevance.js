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
    "capac",
    "carcasa",
    "curea",
    "display",
    "ecran",
    "etui",
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
  "incarcator",
  "kit",
  "mouthpiece",
  "mustiuc",
  "minge",
  "mingi",
  "paleta",
  "palete",
  "plasa",
  "plase",
  "protector",
  "racheta",
  "rachete",
  "seminte",
  "stand",
  "stativ",
  "suport",
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
  "anvelopa",
  "anvelope",
  "aripa",
  "bara",
  "capota",
  "cauciuc",
  "cauciucuri",
  "far",
  "faruri",
  "grila",
  "janta",
  "jante",
  "oglinda",
  "oglinzi",
  "parbriz",
  "portiera",
  "radiator",
  "stop",
  "stopuri"
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
    accessories: ["covorase", "husa", "huse", "jante", "anvelope", "cauciucuri"],
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
  air_fryer: {
    category: "kitchen",
    aliases: ["airfryer", "air fryer", "friteuza cu aer", "friteuza cu aer cald", "friteuza aer cald"],
    tokens: ["airfryer", "air", "fryer", "friteuza", "aer", "cald"],
    accessories: ["cos", "filtre", "forme", "hartie", "liners", "paper", "silicon", "tava"]
  }
};

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
    category: "kitchen",
    patterns: PRODUCT_TAXONOMY.air_fryer.aliases,
    tokens: PRODUCT_TAXONOMY.air_fryer.tokens
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
    ...PRODUCT_TAXONOMY.jeep_compass.parts
  ],
  sport: [
    ...PRODUCT_TAXONOMY.table_tennis_table.accessories,
    ...PRODUCT_TAXONOMY.basketball_hoop.accessories
  ],
  plant: [
    ...PRODUCT_TAXONOMY.money_tree.accessories,
    ...PRODUCT_TAXONOMY.money_tree.exclusions
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
  kitchen: 80
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
  return phrases.some((phrase) => text.includes(normalizeText(phrase)));
}

function getProductTaxonomy(normalizedQuery) {
  return Object.entries(PRODUCT_TAXONOMY).find(([, config]) =>
    config.aliases.some((alias) => normalizedQuery.includes(normalizeText(alias)))
  )?.[1] || null;
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
  const categories = new Set();
  const taxonomy = getProductTaxonomy(normalized);

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

  return {
    normalized,
    tokens: baseTokens,
    expandedTokens: [...expandedTokens],
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
  return tokens.has(normalizeText(term));
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
      if (text.includes(normalizedPhrase)) {
        matches.push({ intent, term: phrase });
      }
    }
  }

  for (const category of queryProfile.categories) {
    for (const term of CATEGORY_EXCLUSIONS[category] || []) {
      const normalizedTerm = normalizeText(term);
      if (queryProfile.normalized.includes(normalizedTerm)) {
        continue;
      }
      if (text.includes(normalizedTerm)) {
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
  const requiredNumberTokens = requiredTokens.filter((token) => /^\d+$/.test(token));
  const expandedTokens = queryProfile.expandedTokens;
  const titleMatches = requiredTokens.filter((token) => titleTokens.has(token));
  const textMatches = requiredTokens.filter((token) => textTokens.has(token));
  const numberMatches = requiredNumberTokens.filter((token) => textTokens.has(token));
  const expandedMatches = expandedTokens.filter((token) => textTokens.has(token));

  return {
    exactPhrase: Boolean(queryProfile.normalized && titleText.includes(queryProfile.normalized)),
    titleMatches,
    textMatches,
    numberMatches,
    expandedMatches,
    requiredCount: requiredTokens.length,
    requiredNumberCount: requiredNumberTokens.length
  };
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
  const hasAnchor = queryAnchors.some((token) => textTokens.has(token) || titleText.includes(token));
  const hasAccessoryHead = allAccessoryHeads.some((term) => textTokens.has(term) || titleText.includes(term));
  const hasSparePartHead = allSparePartHeads.some((term) => textTokens.has(term) || titleText.includes(term));

  if (negativeMatches.some((match) => match.intent === "wanted")) {
    return "wanted";
  }
  if (negativeMatches.some((match) => match.intent === "service")) {
    return "service";
  }
  if (negativeMatches.some((match) => match.intent === "broken")) {
    return "broken_or_for_parts";
  }
  if (includesAnyPhrase(text, NEGATIVE_PHRASES.part) || hasSparePartHead) {
    return "spare_part";
  }

  const startsWithAccessory = allAccessoryHeads.some((term) => titleText.startsWith(`${term} `));
  const accessoryForProduct = allAccessoryHeads.some((term) =>
    queryAnchors.some((anchor) =>
      titleText.includes(`${term} ${anchor}`) ||
      titleText.includes(`${term} pentru ${anchor}`) ||
      titleText.includes(`${term} for ${anchor}`) ||
      titleText.includes(`${anchor} ${term}`)
    )
  );
  const productWithAccessory = BUNDLE_MARKERS.some((marker) => titleText.includes(normalizeText(marker))) &&
    hasAnchor &&
    hasAccessoryHead;
  const basketballRimWithNet = queryProfile.taxonomy === PRODUCT_TAXONOMY.basketball_hoop &&
    (titleTokens.has("inel") || titleTokens.has("panou")) &&
    (titleTokens.has("plasa") || titleTokens.has("plase") || titleTokens.has("net"));

  if (basketballRimWithNet) {
    return "main_product";
  }
  if (hasAnchor && hasAccessoryHead && !productWithAccessory && (startsWithAccessory || accessoryForProduct)) {
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
  if (requiredNumberTokens.some((token) => !titleTokens.has(token))) {
    return false;
  }
  return queryProfile.tokens.some((token) => titleTokens.has(token)) ||
    queryProfile.expandedTokens.some((token) => titleTokens.has(token));
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
    if (Number.isFinite(priceFloor) && Number.isFinite(item.priceRon) && item.priceRon < priceFloor) {
      negativeMatches.push({ intent: "irrelevant", term: "price_below_category_floor" });
    }
  }
  const matchStats = getMatchStats(title, text, queryProfile);
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
  });
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
  for (const match of negativeMatches) {
    rejectionReasons.push(`${match.intent}:${match.term}`);
  }
  if (relevanceScore < 45) {
    rejectionReasons.push("low_relevance");
  }

  return {
    ...item,
    queryType: queryProfile.queryType,
    listingType,
    productHead: queryProfile.productHead,
    anchorTerms: queryProfile.expandedTokens,
    typeCompatibilityScore,
    intentType,
    relevanceScore,
    rejectionReasons: [...new Set(rejectionReasons)],
    isRecommendedCandidate: typeCompatibilityScore >= 0.8 && relevanceScore >= 55
  };
}
