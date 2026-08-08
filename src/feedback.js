export const FEEDBACK_REASONS = new Set([
  "relevant",
  "wrong_product",
  "part_or_accessory",
  "wrong_model",
  "bad_price",
  "duplicate",
  "unavailable",
  "other"
]);

const ALGORITHM_VERSION = "feedback-loop-v1";

function text(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function normalizeOfferFeedbackPayload(value = {}, userId = "") {
  const body = object(value);
  const feedback = body.feedback === "like" || body.feedback === "dislike" ? body.feedback : "";
  if (!feedback) throw new Error("Expected feedback to be like or dislike");

  const reason = text(body.reason, 80) || (feedback === "like" ? "relevant" : "other");
  if (!FEEDBACK_REASONS.has(reason)) throw new Error("Unsupported feedback reason");

  const offer = object(body.offer);
  const rank = Number.parseInt(body.originalRank ?? offer.rank, 10);

  return {
    userId: text(userId, 80),
    query: text(body.query, 300),
    feedback,
    reason,
    correctionText: text(body.correctionText, 300),
    sessionId: text(body.sessionId, 120),
    searchId: text(body.searchId, 120),
    listingFingerprint: text(body.listingFingerprint, 500),
    originalRank: Number.isFinite(rank) && rank > 0 ? rank : null,
    algorithmVersion: ALGORITHM_VERSION,
    appliedAction: text(body.appliedAction, 80),
    queryUnderstanding: object(body.queryUnderstanding),
    listingFeatures: object(body.listingFeatures),
    offer: {
      title: text(offer.title, 500),
      url: text(offer.url, 2000),
      site: text(offer.site, 120),
      priceRon: Number.isFinite(Number(offer.priceRon)) ? Number(offer.priceRon) : null,
      score: Number.isFinite(Number(offer.score)) ? Number(offer.score) : null,
      rank: Number.isFinite(rank) && rank > 0 ? rank : null,
      listingType: text(offer.listingType, 120),
      queryType: text(offer.queryType, 120),
      rejectionReasons: Array.isArray(offer.rejectionReasons) ? offer.rejectionReasons.slice(0, 30).map((entry) => text(entry, 160)) : []
    }
  };
}
