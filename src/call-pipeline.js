import { extractPhonesFromListing } from "./phone-numbers.js";

const MAX_JOB_NOTE_LENGTH = 2_000;

function text(value, maxLength = MAX_JOB_NOTE_LENGTH) {
  return String(value || "").trim().slice(0, maxLength);
}

/**
 * Turn search listings into reviewable call jobs. Calling is deliberately not
 * performed here: an explicit consent record and approval are required.
 */
export function buildCallJobs(listings = [], { consented = false, approved = false } = {}) {
  if (!consented) return [];

  const seen = new Set();
  return listings.flatMap((listing) => {
    const phone = extractPhonesFromListing(listing)[0];
    if (!phone || seen.has(phone)) return [];
    seen.add(phone);

    return [{
      id: `call_${Buffer.from(`${phone}:${listing.url || listing.title || ""}`).toString("base64url")}`.slice(0, 96),
      phone,
      status: approved ? "approved" : "pending_approval",
      sourceUrl: text(listing.url, 500),
      listingTitle: text(listing.title, 300),
      listingPrice: text(listing.price, 100),
      sellerType: text(listing.sellerType, 80),
      promptContext: text([
        `Listing: ${listing.title || ""}`,
        `Price: ${listing.price || ""}`,
        `Source: ${listing.url || ""}`
      ].filter(Boolean).join("\n"))
    }];
  });
}

export function assertCallJobCanRun(job, { consented = false, approved = false } = {}) {
  if (!consented) throw new Error("Call requires documented recipient consent.");
  if (!approved || job?.status !== "approved") throw new Error("Call job requires explicit approval.");
  if (!/^\+40\d{9}$/.test(job?.phone || "")) throw new Error("Call job has an invalid Romanian phone number.");
  return true;
}

/** Provider boundary for a future voice model + telephony service. */
export function createCallRunner({ placeCall, consented = false } = {}) {
  if (typeof placeCall !== "function") throw new Error("placeCall must be a function.");

  return async (job, { approved = false } = {}) => {
    assertCallJobCanRun(job, { consented, approved });
    return placeCall({
      to: job.phone,
      context: job.promptContext,
      sourceUrl: job.sourceUrl
    });
  };
}
