import { classifyListingIntent, normalizeText } from "./relevance.js";
import { FEEDBACK_REASONS } from "./feedback.js";

const MATCH_REASONS = new Set(["wrong_product", "wrong_model", "part_or_accessory"]);

export function feedbackLane(reason) {
  if (MATCH_REASONS.has(reason) || reason === "relevant") return "matching";
  return { bad_price: "pricing", duplicate: "deduplication", unavailable: "freshness" }[reason] || "manual_review";
}

// Accept normalized API payloads and exported offer_feedback rows. Reports are
// evidence for review, never trusted labels or instructions for the matcher.
export function triageFeedback(rows) {
  if (!Array.isArray(rows)) throw new Error("Feedback input must be a JSON array");
  const groups = new Map();
  let skipped = 0;
  for (const row of rows) {
    const query = typeof row?.query === "string" ? row.query.trim() : "";
    const title = row?.offer?.title || row?.offer_title;
    if (!query || typeof title !== "string" || !title.trim() ||
        !FEEDBACK_REASONS.has(row.reason) || !["like", "dislike"].includes(row.feedback)) {
      skipped++;
      continue;
    }
    const identity = row.listingFingerprint || row.listing_fingerprint || row.offer?.url || row.offer_url || normalizeText(title);
    const key = JSON.stringify([normalizeText(query), identity]);
    if (!groups.has(key)) groups.set(key, {
      query, title, reports: 0, reasons: new Set(), lanes: new Set(), voters: new Set(), labels: new Set(),
    });
    const group = groups.get(key);
    group.reports++;
    group.reasons.add(row.reason);
    group.lanes.add(feedbackLane(row.reason));
    const voter = row.userId || row.user_id;
    if (voter) group.voters.add(voter);
    if (row.feedback === "like" && row.reason === "relevant") group.labels.add(true);
    if (row.feedback === "dislike" && MATCH_REASONS.has(row.reason)) group.labels.add(false);
    if ((row.feedback === "like") !== (row.reason === "relevant")) group.lanes.add("manual_review");
  }
  return {
    inputCount: rows.length, skipped,
    groups: [...groups.values()].map(({ reasons, lanes, voters, labels, ...group }) => ({
      ...group, reasons: [...reasons].sort(), lanes: [...lanes].sort(),
      distinctUsers: voters.size, conflictingLabels: labels.size > 1,
      suggestedExpected: labels.size === 1 ? [...labels][0] : null,
      reviewRequired: true,
    })).sort((a, b) => b.distinctUsers - a.distinctUsers || b.reports - a.reports || a.query.localeCompare(b.query)),
  };
}

export function evaluateFeedbackCases(cases) {
  if (!Array.isArray(cases) || !cases.length) throw new Error("Evaluation needs a non-empty JSON array of reviewed cases");
  const ids = new Set();
  const results = cases.map((entry) => {
    if (!entry || typeof entry.id !== "string" || !entry.id.trim() || ids.has(entry.id) ||
        entry.reviewed !== true || typeof entry.query !== "string" || !entry.query.trim() ||
        typeof entry.listing?.title !== "string" || !entry.listing.title.trim() ||
        typeof entry.expectedCandidate !== "boolean") {
      throw new Error("Each case needs a unique id, reviewed: true, query, listing.title and boolean expectedCandidate");
    }
    ids.add(entry.id);
    const actual = classifyListingIntent(entry.listing, entry.query);
    return {
      id: entry.id, expected: entry.expectedCandidate, actual: actual.isRecommendedCandidate,
      passed: actual.isRecommendedCandidate === entry.expectedCandidate,
      relevanceScore: actual.relevanceScore, rejectionReasons: actual.rejectionReasons,
    };
  });
  const positives = results.filter((r) => r.expected).length;
  const negatives = results.length - positives;
  const falseAccepts = results.filter((r) => !r.expected && r.actual).length;
  const falseRejects = results.filter((r) => r.expected && !r.actual).length;
  return {
    total: results.length, passed: results.filter((r) => r.passed).length,
    positives, negatives, falseAccepts, falseRejects,
    falseAcceptRate: negatives ? falseAccepts / negatives : null,
    falseRejectRate: positives ? falseRejects / positives : null,
    results,
  };
}
