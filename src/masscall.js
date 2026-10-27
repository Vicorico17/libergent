const PHONE = /^\+40\d{9}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SID = /^CA[0-9a-f]{32}$/i;

export function normalizeCallApproval(input, deal, env = {}) {
  if (!deal || deal.paused_at || ["completed", "lost", "cancelled"].includes(deal.stage)) throw new Error("This deal is not active for calls.");
  if (env.LIBERGENT_CALLING_ENABLED !== "1") throw new Error("Calling is not enabled.");
  const destination = String(input.to || "").trim();
  const idempotencyKey = String(input.idempotencyKey || "").trim();
  const objective = String(input.objective || "").trim();
  const contactSource = String(input.contactSource || "").trim();
  const recordingConsentEvidence = String(input.recordingConsentEvidence || "").trim();
  if (!PHONE.test(destination)) throw new Error("A Romanian destination in +40 format is required.");
  const allowed = String(env.LIBERGENT_ALLOWED_DESTINATIONS || "").split(",").map((item) => item.trim()).filter(Boolean);
  if (!allowed.includes(destination)) throw new Error("Destination is outside the approved pilot list.");
  if (!UUID.test(idempotencyKey)) throw new Error("A valid idempotency key is required.");
  if (!objective || objective.length > 1000) throw new Error("A call objective of up to 1,000 characters is required.");
  if (!contactSource || contactSource.length > 500 || contactSource !== deal.listing_url) throw new Error("Use this deal's listing as the approved contact source.");
  if (!recordingConsentEvidence || recordingConsentEvidence.length > 300) throw new Error("Record the pilot recipient's recording consent evidence (up to 300 characters).");
  if (input.buyerApproved !== true || input.contactPermitted !== true || input.recordingNoticeAcknowledged !== true) {
    throw new Error("Buyer approval, permitted phone contact, and recording notice acknowledgement are required.");
  }
  if (!env.MASSCALL_SERVICE_URL || String(env.MASSCALL_SERVICE_TOKEN || "").length < 32 || !PHONE.test(env.MASSCALL_CALLER_ID || "")) {
    throw new Error("The dedicated Masscall service is not configured.");
  }
  const retentionDays = Number(env.LIBERGENT_RECORDING_RETENTION_DAYS);
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 30) throw new Error("Recording retention must be configured from 1 to 30 days.");
  return { destination, idempotencyKey, objective, contactSource, recordingConsentEvidence };
}

export function callBrief(deal, objective) {
  return [
    "Disclose that you are an AI assistant and that the call is recorded. Ask for permission to continue recording; if declined, end the call. Never agree to purchase or payment. Honor opt-outs immediately.",
    `Purpose: ${objective}`,
    `Listing: ${deal.listing_title}`,
    `Listed price: ${deal.listing_price || "unknown"}`,
    deal.brief.openingOfferRon ? `Opening offer: ${deal.brief.openingOfferRon} RON` : "No opening offer approved",
    `Questions: ${(deal.brief.questions || []).join("; ")}`
  ].join("\n").slice(0, 2000);
}

export async function masscallRequest(path, { method = "GET", body, env = {}, fetchImpl = fetch } = {}) {
  const base = String(env.MASSCALL_SERVICE_URL || "").replace(/\/+$/, "");
  if (!/^https:\/\//.test(base) || !env.MASSCALL_SERVICE_TOKEN) throw new Error("The dedicated Masscall service is not configured.");
  const response = await fetchImpl(`${base}${path}`, {
    method,
    headers: { authorization: `Bearer ${env.MASSCALL_SERVICE_TOKEN}`, ...(body ? { "content-type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) {
    const error = new Error(response.status >= 500 ? "Masscall service failed." : "Masscall rejected the call request.");
    error.status = response.status;
    throw error;
  }
  if (path.endsWith("/recording")) return response;
  return response.json();
}

export function validProviderCallId(value) { return SID.test(value || ""); }
