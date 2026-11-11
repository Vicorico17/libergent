import { listOfferFeedback, updateOfferFeedbackReview, deleteOwnOfferFeedback } from "./supabase.js";
import { triageFeedback, evaluateFeedbackCases, feedbackLane } from "./feedback-learning.js";
import { classifyListingIntent } from "./relevance.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function canReviewFeedback(userId, env = {}) {
  return String(env.LIBERGENT_FEEDBACK_REVIEWER_IDS || "").split(",").map(s => s.trim()).filter(Boolean).includes(userId);
}

function serialize(row, reviewer) {
  const listing = row.offer || {};
  const current = row.query && listing.title ? classifyListingIntent(listing, row.query) : null;
  return {
    id: row.id, query: row.query, feedback: row.feedback, reason: row.reason,
    correctionText: row.correction_text, createdAt: row.created_at,
    listingFingerprint: row.listing_fingerprint, offer: {
      title: listing.title || row.offer_title, url: listing.url || row.offer_url,
      priceRon: listing.priceRon, description: listing.description, condition: listing.condition,
      evidenceSource: listing.evidenceSource || "legacy_partial_report",
    },
    ...(reviewer ? { lane: feedbackLane(row.reason), review: listing.review || null,
      current: current ? { candidate: current.isRecommendedCandidate, score: current.relevanceScore, reasons: current.rejectionReasons } : null } : {}),
  };
}

// Both HTTP runtimes authenticate first and share this authorization boundary.
export async function handleFeedbackApp({ method, reviewMode, userId, query, body = {} }, env = process.env) {
  if (!userId) return { status: 401, payload: { error: "Authentication required." } };
  const reviewer = canReviewFeedback(userId, env);
  if (reviewMode && !reviewer) return { status: 403, payload: { error: "Feedback reviewer access required." } };
  if (!(reviewMode ? ["GET", "PATCH"] : ["GET", "DELETE"]).includes(method)) return { status: 405, payload: { error: "Method not allowed" } };
  body = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  if (method === "GET") {
    const all = await listOfferFeedback(reviewMode ? {} : { userId, query: String(query || "").trim().slice(0, 300) }, env);
    const rows = all.slice(0, 200);
    const cases = rows.filter(row => row.offer?.review?.status === "confirmed").map(row => ({
      id: row.id, reviewed: true, query: row.query, listing: row.offer,
      expectedCandidate: row.offer.review.expectedCandidate,
    }));
    return { status: 200, payload: { rows: rows.map(row => serialize(row, reviewMode)), canReview: reviewer,
      truncated: all.length > 200,
      ...(reviewMode ? { triage: triageFeedback(rows), evaluation: cases.length ? evaluateFeedbackCases(cases) : null } : {}),
    } };
  }
  if (!UUID.test(body.id || "")) return { status: 400, payload: { error: "A valid feedback id is required." } };
  const [row] = await listOfferFeedback({ id: body.id, ...(reviewMode ? {} : { userId }) }, env);
  if (!row) return { status: 404, payload: { error: "Feedback not found." } };
  if (!reviewMode && method === "DELETE") {
    await deleteOwnOfferFeedback(row, userId, env);
    return { status: 200, payload: { ok: true } };
  }
  if (reviewMode && method === "PATCH") {
    if (!["confirmed", "rejected", "pending"].includes(body.status) ||
        (body.status === "confirmed" && (feedbackLane(row.reason) !== "matching" ||
          typeof body.expectedCandidate !== "boolean" || !row.query || !row.offer?.title || body.evidenceChecked !== true))) {
      return { status: 400, payload: { error: "Confirm matching evidence and choose whether this listing should match." } };
    }
    const updated = await updateOfferFeedbackReview(row, {
      status: body.status, expectedCandidate: body.status === "confirmed" ? body.expectedCandidate : null,
      reviewedBy: userId, reviewedAt: new Date().toISOString(),
      note: String(body.note || "").trim().slice(0, 500),
    }, env);
    return { status: updated ? 200 : 404, payload: updated ? { ok: true } : { error: "Feedback no longer exists." } };
  }
  return { status: 405, payload: { error: "Method not allowed" } };
}
