const MAX_QUERY_LENGTH = 240;
const MAX_ACTIVE_ALERTS = 5;
const ALLOWED_FREQUENCIES = new Set(["daily", "immediate"]);
const ALLOWED_STATUSES = new Set(["active", "paused"]);

function boundedNumber(value, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(min, Math.min(max, parsed));
}

export function normalizeAlertProfile(body = {}) {
  const query = String(body.query || "").trim().slice(0, MAX_QUERY_LENGTH);
  if (!query) throw new Error("Expected a search query.");

  const frequency = ALLOWED_FREQUENCIES.has(body.frequency) ? body.frequency : "daily";
  const status = ALLOWED_STATUSES.has(body.status) ? body.status : "active";
  const criteria = body.criteria && typeof body.criteria === "object" ? body.criteria : {};
  const eventSettings = body.events && typeof body.events === "object" ? body.events : {};

  return {
    query,
    criteria: {
      priceMaxRon: boundedNumber(criteria.priceMaxRon, { max: 100_000_000 }),
      yearFrom: boundedNumber(criteria.yearFrom, { min: 1950, max: 2100 }),
      mileageMaxKm: boundedNumber(criteria.mileageMaxKm, { max: 5_000_000 }),
      location: String(criteria.location || "").trim().slice(0, 120),
      radiusKm: boundedNumber(criteria.radiusKm, { max: 1000 })
    },
    events: {
      newStrongMatch: eventSettings.newStrongMatch !== false,
      priceDrop: eventSettings.priceDrop !== false,
      betterThanShortlist: eventSettings.betterThanShortlist !== false
    },
    frequency,
    channel: "email_and_in_app",
    status
  };
}

export function extractVehicleFacts(item = {}) {
  const text = `${item.title || ""} ${item.condition || ""}`;
  const year = Number(text.match(/\b(19[5-9]\d|20[0-3]\d)\b/)?.[1]) || null;
  const mileageText = text.match(/\b(\d{1,3}(?:[ .]\d{3})+|\d{4,7})\s*km\b/i)?.[1] || "";
  const mileageKm = mileageText ? Number(mileageText.replace(/[^\d]/g, "")) : null;
  return { year, mileageKm };
}

export function listingMatchesAlert(item, profile) {
  if (!item?.url || !Number.isFinite(Number(item.priceRon ?? item.numericPrice ?? item.price))) return false;
  const priceRon = Number(item.priceRon ?? item.numericPrice ?? item.price);
  const { year, mileageKm } = extractVehicleFacts(item);
  const criteria = profile.criteria || {};
  if (criteria.priceMaxRon !== null && criteria.priceMaxRon !== undefined && priceRon > criteria.priceMaxRon) return false;
  if (criteria.yearFrom && (!year || year < criteria.yearFrom)) return false;
  if (criteria.mileageMaxKm && (!mileageKm || mileageKm > criteria.mileageMaxKm)) return false;
  if (criteria.location && !String(item.location || "").toLocaleLowerCase("ro-RO").includes(criteria.location.toLocaleLowerCase("ro-RO"))) return false;
  return true;
}

export function buildAlertEvents(profile, listings, previousStates = new Map()) {
  const events = [];
  const matching = listings.filter((item) => listingMatchesAlert(item, profile));
  const previousBestScore = Math.max(0, ...[...previousStates.values()].map((state) => Number(state.snapshot?.dealQuality?.score ?? state.snapshot?.recommendationScore ?? 0)));

  for (const item of matching) {
    const priceRon = Math.round(Number(item.priceRon ?? item.numericPrice ?? item.price));
    const previous = previousStates.get(item.url);
    const score = Number(item.recommendationScore ?? item.offerScore ?? item.dealQuality?.score ?? 0);
    const confidence = Number(item.evidenceConfidence?.score ?? 0);

    const isBetterThanPrevious = !previous && previousStates.size > 0 && score >= 70 && score >= previousBestScore + 10;
    if (isBetterThanPrevious && profile.events?.betterThanShortlist !== false) {
      events.push({
        type: "better_than_shortlist",
        eventKey: `better:${profile.id}:${item.url}`,
        listingUrl: item.url,
        payload: alertPayload(item, priceRon, `Opțiune mai bună · scor ${score}% față de ${previousBestScore}% în ofertele urmărite`)
      });
    } else if (!previous && profile.events?.newStrongMatch !== false && score >= 65 && confidence >= 40) {
      events.push({
        type: "new_strong_match",
        eventKey: `new:${profile.id}:${item.url}`,
        listingUrl: item.url,
        payload: alertPayload(item, priceRon, `Potrivire nouă · scor ${score}% · încredere ${confidence}%`)
      });
    }

    if (previous && profile.events?.priceDrop !== false && Number.isFinite(Number(previous.latest_price_ron))) {
      const oldPrice = Number(previous.latest_price_ron);
      const dropRon = oldPrice - priceRon;
      const dropPct = oldPrice > 0 ? Math.round((dropRon / oldPrice) * 1000) / 10 : 0;
      if (dropRon >= 1000 || dropPct >= 5) {
        events.push({
          type: "price_drop",
          eventKey: `drop:${profile.id}:${item.url}:${priceRon}`,
          listingUrl: item.url,
          payload: { ...alertPayload(item, priceRon, `Preț redus cu ${dropRon.toLocaleString("ro-RO")} RON (${dropPct}%)`), previousPriceRon: oldPrice, dropRon, dropPct }
        });
      }
    }
  }

  return { events, matching };
}

function alertPayload(item, priceRon, reason) {
  return {
    title: item.title || "Ofertă nouă",
    source: item.site || "Marketplace",
    priceRon,
    imageUrl: item.imageUrl || item.image || "",
    location: item.location || "",
    reason,
    dealScore: Number(item.dealQuality?.score ?? item.recommendationScore ?? item.offerScore ?? 0),
    riskFlags: Array.isArray(item.riskFlags) ? item.riskFlags.slice(0, 3) : []
  };
}

export { MAX_ACTIVE_ALERTS };
