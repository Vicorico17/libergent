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
  ]
};

const CATEGORY_PRICE_FLOORS_RON = {
  washing_machine: 120,
  phone: 600,
  console: 700,
  protein: 60
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

function getQueryProfile(query) {
  const normalized = normalizeText(query);
  const baseTokens = tokenize(query);
  const expandedTokens = new Set(baseTokens);
  const categories = new Set();

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
    categories: [...categories]
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
  if (!matchStats.requiredCount || matchStats.textMatches.length === 0) {
    return "weak_match";
  }
  if (matchStats.requiredNumberCount && matchStats.numberMatches.length < matchStats.requiredNumberCount) {
    return "weak_match";
  }

  const priority = ["wanted", "service", "part", "broken", "irrelevant", "commercial"];
  const firstNegative = priority.find((intent) => negativeMatches.some((match) => match.intent === intent));
  return firstNegative || "product";
}

function scoreRelevance({ item, queryProfile, negativeMatches, matchStats }) {
  let score = 0;

  if (matchStats.exactPhrase) {
    score += 45;
  }

  if (matchStats.requiredCount) {
    score += Math.round((matchStats.titleMatches.length / matchStats.requiredCount) * 35);
    score += Math.round((matchStats.textMatches.length / matchStats.requiredCount) * 15);
  }

  score += Math.min(matchStats.expandedMatches.length * 3, 12);

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

  if (matchStats.requiredCount > 1 && matchStats.titleMatches.length <= 1 && !matchStats.exactPhrase) {
    score -= 20;
  }
  if (matchStats.requiredNumberCount && matchStats.numberMatches.length < matchStats.requiredNumberCount) {
    score -= 50;
  }

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
  const negativeMatches = findNegativeMatches(text, queryProfile);
  for (const category of queryProfile.categories) {
    const priceFloor = CATEGORY_PRICE_FLOORS_RON[category];
    if (Number.isFinite(priceFloor) && Number.isFinite(item.priceRon) && item.priceRon < priceFloor) {
      negativeMatches.push({ intent: "irrelevant", term: "price_below_category_floor" });
    }
  }
  const matchStats = getMatchStats(title, text, queryProfile);
  const intentType = getIntentType(negativeMatches, matchStats);
  const relevanceScore = scoreRelevance({ item, queryProfile, negativeMatches, matchStats });
  const rejectionReasons = [];

  if (intentType !== "product") {
    rejectionReasons.push(intentType);
  }
  if (matchStats.requiredCount && matchStats.textMatches.length === 0) {
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
    intentType,
    relevanceScore,
    rejectionReasons: [...new Set(rejectionReasons)],
    isRecommendedCandidate: intentType === "product" && relevanceScore >= 45
  };
}
