export type SavedFeedback = {
  id: string; query: string; feedback: string; reason: string; listingFingerprint: string;
  createdAt?: string; offer?: { url?: string; title?: string };
}

// Input is newest first. Only the most recent decision for an exact listing
// applies; pricing and availability reports never become persistent exclusions.
export function personalFeedbackExclusions(rows: SavedFeedback[]) {
  const seen = new Set<string>()
  return rows.filter(row => {
    const identity = row.listingFingerprint || row.offer?.url
    if (!identity || seen.has(identity)) return false
    seen.add(identity)
    return row.feedback === "dislike" && ["wrong_product", "wrong_model", "part_or_accessory"].includes(row.reason)
  })
}
