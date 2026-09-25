function normalize(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasPhrase(text, phrase) {
  const normalizedPhrase = normalize(phrase);
  return normalizedPhrase && (` ${text} `).includes(` ${normalizedPhrase} `);
}

export const VEHICLE_MAKES = [
  "abarth", "alfa romeo", "audi", "bentley", "bmw", "byd", "cadillac", "chevrolet",
  "chrysler", "citroen", "cupra", "dacia", "daewoo", "dodge", "ds", "fiat", "ford",
  "honda", "hyundai", "infiniti", "isuzu", "iveco", "jaguar", "jeep", "kia", "lancia",
  "land rover", "lexus", "maserati", "mazda", "mercedes", "mg", "mini", "mitsubishi",
  "nissan", "opel", "peugeot", "polestar", "porsche", "range rover", "renault", "saab",
  "seat", "skoda", "smart", "subaru", "suzuki", "tesla", "toyota", "volkswagen", "volvo"
];

const STANDALONE_VEHICLE_MODELS = new Set([
  "astra", "clio", "corolla", "duster", "insignia", "kodiaq", "kuga", "logan",
  "megane", "mondeo", "octavia", "passat", "qashqai", "rav4", "sandero", "sportage",
  "tiguan", "tucson"
]);

// This is deliberately data, not branching logic. New high-volume entities can be
// added without changing routing or ranking behavior.
const PRODUCT_ENTITIES = [
  {
    id: "ford_mustang",
    category: "vehicle",
    make: "ford",
    model: "mustang",
    aliases: ["ford mustang", "mustang"],
    canonicalQuery: "Ford Mustang",
    canonicalPath: "ford-mustang",
    confidence: 0.94,
    alternatives: [
      { label: "Machete Mustang", query: "macheta mustang" },
      { label: "Haine Mustang", query: "haine mustang" }
    ]
  },
  {
    id: "volkswagen_passat_cc",
    category: "vehicle",
    make: "volkswagen",
    model: "passat cc",
    aliases: ["volkswagen passat cc", "vw passat cc", "passat cc"],
    canonicalQuery: "Volkswagen Passat CC",
    canonicalPath: "volkswagen-passat-cc",
    confidence: 0.98
  },
  {
    id: "jeep_compass",
    category: "vehicle",
    make: "jeep",
    model: "compass",
    aliases: ["jeep compass"],
    canonicalQuery: "Jeep Compass",
    canonicalPath: "jeep-compass",
    confidence: 0.98
  },
  ...[
    ["dacia", "logan"], ["dacia", "duster"], ["dacia", "sandero"],
    ["skoda", "octavia"], ["skoda", "superb"], ["skoda", "kodiaq"],
    ["volkswagen", "passat"], ["volkswagen", "polo"], ["volkswagen", "tiguan"],
    ["ford", "mondeo"], ["ford", "kuga"], ["toyota", "corolla"],
    ["toyota", "rav4"], ["renault", "megane"], ["renault", "clio"],
    ["opel", "astra"], ["opel", "insignia"], ["peugeot", "308"],
    ["peugeot", "3008"], ["nissan", "qashqai"], ["hyundai", "tucson"],
    ["kia", "sportage"], ["audi", "a4"], ["audi", "a6"],
    ["bmw", "x5"], ["bmw", "x3"], ["mercedes", "c class"]
  ].map(([make, model]) => ({
    id: `${make}_${model}`.replace(/\s+/g, "_"),
    category: "vehicle",
    make,
    model,
    aliases: STANDALONE_VEHICLE_MODELS.has(model) ? [`${make} ${model}`, model] : [`${make} ${model}`],
    canonicalQuery: `${make} ${model}`,
    canonicalPath: `${make}-${model}`.replace(/\s+/g, "-"),
    confidence: 0.9
  }))
];

const PRODUCT_FAMILIES = [
  { category: "collectible", patterns: ["macheta", "machete", "model auto"], label: "Machete și obiecte de colecție", confidence: 0.94, refinements: ["Scară", "Stare"] },
  { category: "apparel", patterns: ["haine", "tricou", "hanorac", "geaca", "adidasi", "pantofi"], label: "Îmbrăcăminte și încălțăminte", confidence: 0.94, refinements: ["Mărime", "Stare"] },
  { category: "tablet", patterns: ["ipad", "tableta"], label: "Tabletă", confidence: 0.95, refinements: ["Model", "Stocare"] },
  { category: "computer", patterns: ["mac mini", "macbook", "laptop"], label: "Calculator", confidence: 0.95, refinements: ["Model", "Memorie"] },
  { category: "tv", patterns: ["smart tv", "televizor"], label: "Televizor", confidence: 0.95, refinements: ["Model", "Diagonală"] },
  { category: "phone", patterns: ["samsung galaxy", "telefon", "smartphone"], modelPattern: /\bsamsung [sa]\d{2}\b/, label: "Telefon", confidence: 0.95, refinements: ["Model", "Stocare", "Stare"] },
  { category: "console", patterns: ["nintendo", "xbox"], label: "Consolă", confidence: 0.95, refinements: ["Model", "Stare"] },
  { category: "phone", patterns: ["iphone"], label: "Apple iPhone", confidence: 0.96, refinements: ["Model", "Stocare", "Stare"] },
  { category: "console", patterns: ["playstation", "ps5", "ps4"], label: "PlayStation", confidence: 0.95, refinements: ["Model", "Stare"] },
  { category: "washing_machine", patterns: ["masina de spalat", "washing machine", "washer"], label: "Mașină de spălat", confidence: 0.96, refinements: ["Capacitate", "Stare"] },
  { category: "kitchen", patterns: ["air fryer", "airfryer", "friteuza cu aer"], label: "Friteuză cu aer", confidence: 0.94, refinements: ["Capacitate", "Stare"] },
  { category: "luggage", patterns: ["valiza", "troler", "troller", "suitcase"], label: "Bagaj de călătorie", confidence: 0.9, refinements: ["Mărime", "Stare"] }
];

function findEntity(normalizedQuery) {
  return PRODUCT_ENTITIES
    .flatMap((entity) => entity.aliases.map((alias) => ({ entity, alias: normalize(alias) })))
    .filter(({ alias }) => hasPhrase(normalizedQuery, alias))
    .sort((a, b) => b.alias.length - a.alias.length)[0]?.entity || null;
}

const AMBIGUOUS_MAKES = new Set(["mini", "smart", "ds", "mg", "seat"]);
const AMBIGUOUS_MAKE_MODELS = /\b(?:mini (?:cooper|countryman|clubman|one)|smart (?:fortwo|forfour)|ds [3-9]|mg (?:[3-7]|zs|hs)|seat (?:ibiza|leon|arona|ateca|alhambra|toledo))\b/;
function findVehicleMake(normalizedQuery) {
  return VEHICLE_MAKES
    .slice()
    .sort((a, b) => b.length - a.length)
    .find((make) => hasPhrase(normalizedQuery, make) && (!AMBIGUOUS_MAKES.has(make) ||
      AMBIGUOUS_MAKE_MODELS.test(normalizedQuery) || /\b(?:autoturism|masina|benzina|diesel|inmatriculat|km|19[89]\d|20[0-3]\d)\b/.test(normalizedQuery))) || null;
}

function buildFamilyUnderstanding(family, query, normalized) {
  return {
    category: family.category,
    entityId: null,
    make: null,
    model: null,
    productType: "main_product",
    label: family.label,
    canonicalQuery: query.trim(),
    canonicalPath: null,
    comparableKey: `${family.category}:${normalized}`,
    confidence: family.confidence,
    alternatives: [],
    refinements: family.refinements
  };
}

export function understandMarketplaceQuery(query = "") {
  const normalized = normalize(query);
  const family = PRODUCT_FAMILIES.find((candidate) =>
    candidate.patterns.some((pattern) => hasPhrase(normalized, pattern)) || candidate.modelPattern?.test(normalized)
  );
  const entityCandidate = findEntity(normalized);
  const entity = entityCandidate?.category === "vehicle" && ["apparel", "collectible"].includes(family?.category)
    ? null
    : entityCandidate;

  if (entity) {
    return {
      category: entity.category,
      entityId: entity.id,
      make: entity.make || null,
      model: entity.model || null,
      productType: entity.category === "vehicle" ? "complete_vehicle" : "main_product",
      label: entity.canonicalQuery,
      canonicalQuery: entity.canonicalQuery,
      canonicalPath: entity.canonicalPath || null,
      comparableKey: entity.id,
      confidence: entity.confidence,
      alternatives: entity.alternatives || [],
      refinements: entity.category === "vehicle" ? ["An", "Buget", "Motor", "Cutie"] : []
    };
  }

  if (family) {
    return buildFamilyUnderstanding(family, query, normalized);
  }

  const vehicleMake = findVehicleMake(normalized);
  if (vehicleMake) {
    return {
      category: "vehicle",
      entityId: `vehicle_make_${vehicleMake.replace(/\s+/g, "_")}`,
      make: vehicleMake,
      model: null,
      productType: "complete_vehicle",
      label: `Automobile ${vehicleMake}`,
      canonicalQuery: query.trim(),
      canonicalPath: null,
      comparableKey: `vehicle:${vehicleMake}`,
      confidence: 0.9,
      alternatives: [],
      refinements: ["Model", "An", "Buget", "Motor"]
    };
  }

  return {
    category: null,
    entityId: null,
    make: null,
    model: null,
    productType: "main_product",
    label: query.trim() ? `„${query.trim()}”` : "Căutare",
    canonicalQuery: query.trim(),
    canonicalPath: null,
    comparableKey: normalized ? `query:${normalized}` : null,
    confidence: 0.45,
    alternatives: [],
    refinements: []
  };
}

export const __testables = { PRODUCT_ENTITIES, normalize };
