import { assertCallJobCanRun } from "./call-pipeline.js";

const DEFAULT_REALTIME_MODEL = "gpt-realtime-2.1-mini";

function clean(value, max = 500) {
  return String(value || "").trim().slice(0, max);
}

function firstNumber(value) {
  return Number.isFinite(value) ? value : null;
}

export function buildWhatsAppOptInMessage(listing = {}) {
  const title = clean(listing.title, 180) || "produsul din anunț";
  const price = clean(listing.price, 80);
  const sourceUrl = clean(listing.url, 400);
  return [
    `Bună! Am văzut anunțul pentru ${title}${price ? `, la ${price}` : ""}.`,
    "Sunt un asistent AI care ajută la verificarea și negocierea ofertelor.",
    "Mai este disponibil? Dacă da, ești de acord să discutăm câteva detalii aici sau printr-un apel WhatsApp? Răspunde cu DA pentru a continua sau STOP dacă nu dorești alte mesaje.",
    sourceUrl ? `Anunț: ${sourceUrl}` : null
  ].filter(Boolean).join("\n");
}

export function buildOpenClawHandoff({ brief, message = "" } = {}) {
  if (!brief?.jobId || !brief?.to) throw new Error("A valid outreach brief is required.");
  return {
    channel: "whatsapp",
    to: brief.to,
    jobId: brief.jobId,
    optInRequired: true,
    initialMessage: message || buildWhatsAppOptInMessage(brief.product),
    realtime: buildOpenAIRealtimeConfig(brief)
  };
}

/** Build the factual product context that the voice agent may use. */
export function buildOutreachBrief({ job, listing = {}, consent = {}, approved = false } = {}) {
  const consented = consent.granted === true && Boolean(consent.source) && Boolean(consent.at);
  assertCallJobCanRun(job, { consented, approved });

  return {
    jobId: job.id,
    to: job.phone,
    consent: {
      source: clean(consent.source, 120),
      at: clean(consent.at, 80),
      expiresAt: clean(consent.expiresAt, 80)
    },
    product: {
      title: clean(listing.title, 300),
      price: clean(listing.price, 100),
      priceRon: firstNumber(listing.priceRon),
      condition: clean(listing.condition, 100),
      location: clean(listing.location, 160),
      sourceUrl: clean(listing.url, 500),
      marketType: ["retail", "secondary", "mixed"].includes(listing.marketType)
        ? listing.marketType
        : "mixed",
      priceInsight: listing.priceInsight || null,
      verifiedFacts: Array.isArray(listing.whyThisDeal)
        ? listing.whyThisDeal.map((value) => clean(value, 240)).slice(0, 6)
        : []
    },
    negotiation: {
      objective: "Ask whether the item is still available and whether the seller can offer a fair price.",
      maxDiscountPercent: 10,
      neverPromisePurchase: true,
      neverInventOffersOrFacts: true
    }
  };
}

export function buildOpenAIRealtimeInstructions(brief) {
  return [
    "You are a transparent purchasing assistant making one authorized outreach call.",
    "Say that you are an AI assistant at the start of the call; do not impersonate a human.",
    "Confirm you are speaking with the seller and briefly identify the public listing.",
    "Ask if the item is still available, then ask concise questions about condition and any material defects.",
    "Negotiate politely: ask whether the seller has flexibility, with a maximum suggested ask of 10% below the listed price.",
    "Do not claim that another buyer made an offer, do not invent market data, and do not commit the buyer to a purchase.",
    "If the person says stop, do-not-call, or is not interested, apologize, end the call, and emit an opt_out event.",
    "If asked about anything not in the facts below, say you do not know and offer to have a human follow up.",
    "Keep the call under five minutes and end with a clear next step.",
    `Facts about the listing:\n${JSON.stringify(brief.product, null, 2)}`,
    `Negotiation rules:\n${JSON.stringify(brief.negotiation, null, 2)}`
  ].join("\n\n");
}

/**
 * Provider-neutral configuration consumed by the SIP/WebSocket telephony
 * adapter. This function does not dial a number or contact OpenAI.
 */
export function buildOpenAIRealtimeConfig(brief, { model = process.env.OPENAI_REALTIME_MODEL || DEFAULT_REALTIME_MODEL } = {}) {
  return {
    model,
    instructions: buildOpenAIRealtimeInstructions(brief),
    inputAudioTranscription: { model: "gpt-4o-mini-transcribe" },
    metadata: {
      jobId: brief.jobId,
      marketType: brief.product.marketType
    }
  };
}
