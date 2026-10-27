// Conservative text evidence only. This classifier never examines photographs.
const fold = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const rules = {
  unrelated: /\b(husa|covor|patura|material textil|carpet|rug|blanket|fabric|tapis|couverture|tissu|papus\w*|doll|poupee|cumpar|wanted|recherche)\b/,
  trim: /\b(guler|manset\w*|gluga|collar|cuffs?|hood|col|capuche|trim\w*)\b/,
  accessory: /\b(caciul\w*|palari\w*|esarf\w*|manusi|genti|geanta|vest\w*|hat|scarf|gloves?|bag|gilet|bonnet|echarpe)\b/,
  coat: /\b(hain[ae]?|palton\w*|cojoc\w*|coat|manteau)\b/,
  fur: /\b(blan[ae]?|fur|fourrure)\b/,
  synthetic: /\b(sintetic\w*|artificial\w*|ecologic\w*|faux|fake|synthetic|imitation|sinthetique|synthetique)\b/,
  natural: /\b(natur[ae]l\w*|real fur|genuine fur|vizon|nurca|mink|vison|vulpe|fox|renard|iepure|rabbit|lapin|chinchilla|sable)\b/,
  negation: /\b(nu|not|non|sans|fara|without)\b/
};
export function classifyFur(item) {
  const fields = ['title', 'description', 'material'];
  const evidence = [];
  const flags = {};
  for (const field of fields) {
    const value = item[field];
    if (!value) continue;
    const text = fold(value);
    for (const [rule, pattern] of Object.entries(rules)) {
      const match = pattern.exec(text);
      if (match) {
        flags[rule] = true;
        evidence.push({ field, rule, text: String(value).slice(Math.max(0, match.index - 60), match.index + 180), basis: 'seller_claim' });
      }
    }
  }
  const category = flags.unrelated ? 'unknown' : flags.accessory ? 'accessory' : flags.trim ? 'fur_trim_only_or_ambiguous'
    : flags.coat && flags.fur && !flags.negation ? 'full_fur_coat' : 'unknown';
  const material = flags.negation || (flags.synthetic && flags.natural) ? 'unknown'
    : flags.synthetic ? 'synthetic' : flags.natural && flags.fur ? 'natural' : 'unknown';
  return { category, material, evidence, independentlyVerified: false, age: null, authenticity: null };
}
const nullable = (v) => v === undefined || v === null || v === '' ? null : v;
const image = (url, listingUrl) => ({ url, sourceUrl: listingUrl, provenance: 'original_listing' });
export function normalizeIntegrationListing(item, source, detail = {}, verifiedAt = null) {
  const attributes = detail.attributes || [];
  const attr = (pattern) => nullable(attributes.find(a => pattern.test(fold(a.label)))?.value);
  const url = nullable(item.url);
  const images = [...new Set([item.imageUrl, ...(item.imageUrls || []), ...(detail.images || [])]
    .filter(v => typeof v === 'string' && /^https:\/\//.test(v)))];
  const listing = {
    url, source, title: nullable(detail.title || item.title),
    price: nullable(detail.pricing?.itemPrice ?? item.price),
    currency: nullable(detail.pricing?.currency || item.currency),
    location: nullable(detail.location || item.location), condition: nullable(detail.condition || item.condition),
    description: nullable(detail.description || item.description),
    mainImage: images.length ? image(images[0], url) : null,
    galleryImages: images.slice(1).map(v => image(v, url)),
    size: attr(/^(size|taille|marime)$/) || nullable(item.size), measurements: attr(/measurement|masur|dimensi|mesure/) || nullable(item.measurements),
    material: attr(/material|matiere/) || nullable(item.material), attributes,
    availability: detail.availability === 'removed' ? 'removed'
      : verifiedAt && detail.availability === 'InStock' ? 'active' : 'unknown',
    lastVerifiedAt: verifiedAt, detailStatus: detail.status || 'not_requested'
  };
  listing.classification = classifyFur(listing);
  return listing;
}
