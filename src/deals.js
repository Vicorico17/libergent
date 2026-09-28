const MAX_TEXT = 500;

function cleanText(value, max = MAX_TEXT) {
  return String(value || "").trim().slice(0, max);
}

function money(value, label, { required = false } = {}) {
  if (value === "" || value === null || value === undefined) {
    if (required) throw new Error(`${label} is required.`);
    return null;
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > 100_000_000) {
    throw new Error(`${label} must be a positive whole RON amount.`);
  }
  return number;
}

export function normalizeDealBrief(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Deal brief must be an object.");
  const maxPriceRon = money(value.maxPriceRon, "Maximum price", { required: true });
  const openingOfferRon = money(value.openingOfferRon, "Opening offer");
  if (openingOfferRon !== null && openingOfferRon > maxPriceRon) throw new Error("Opening offer exceeds the maximum price.");
  const questions = Array.isArray(value.questions)
    ? value.questions.map((item) => cleanText(item, 200)).filter(Boolean).slice(0, 5)
    : [];
  return {
    maxPriceRon,
    openingOfferRon,
    questions,
    deliveryPreference: cleanText(value.deliveryPreference, 200),
    location: cleanText(value.location, 120),
    timing: cleanText(value.timing, 120),
    dealBreakers: cleanText(value.dealBreakers, 500)
  };
}

export function normalizeDealCreate(value = {}) {
  const listingUrl = cleanText(value.listingUrl, 2000);
  const listingTitle = cleanText(value.listingTitle, 300);
  if (!listingUrl || !listingTitle) throw new Error("Listing URL and title are required.");
  return {
    listing_url: listingUrl,
    listing_title: listingTitle,
    marketplace: cleanText(value.marketplace, 80),
    listing_price: cleanText(value.listingPrice, 100),
    brief: normalizeDealBrief(value.brief)
  };
}

export const DEAL_STAGES = ["draft", "contacting", "negotiating", "terms_agreed", "buyer_accepted", "completed", "lost", "cancelled"];
const TERMINAL = new Set(["completed", "lost", "cancelled"]);
const NEXT = {
  draft: ["contacting", "cancelled"],
  contacting: ["negotiating", "lost", "cancelled"],
  negotiating: ["terms_agreed", "lost", "cancelled"],
  terms_agreed: ["buyer_accepted", "negotiating", "lost", "cancelled"],
  buyer_accepted: ["completed", "lost", "cancelled"]
};

export function normalizeDealChange(value = {}, current = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Deal change must be an object.");
  const action = cleanText(value.action, 40);
  if (!action) throw new Error("Deal action is required.");
  if (TERMINAL.has(current.stage)) throw new Error("This deal is closed.");
  if (action === "pause") return { paused_at: new Date().toISOString() };
  if (action === "resume") return { paused_at: null };
  if (current.paused_at) throw new Error("Resume the deal before changing its stage.");
  if (!NEXT[current.stage]?.includes(action)) throw new Error(`Cannot move a deal from ${current.stage} to ${action}.`);
  const update = { stage: action };
  if (action === "terms_agreed" || action === "buyer_accepted") {
    if (action === "buyer_accepted" && ((value.agreedPriceRon !== undefined && Number(value.agreedPriceRon) !== Number(current.agreed_price_ron)) || (value.agreedTerms !== undefined && cleanText(value.agreedTerms, 1000) !== current.agreed_terms))) {
      throw new Error("Buyer acceptance must match the recorded seller terms.");
    }
    const agreedPriceRon = money(value.agreedPriceRon ?? current.agreed_price_ron, "Agreed price", { required: true });
    if (agreedPriceRon > current.brief.maxPriceRon) throw new Error("Agreed price exceeds the buyer's maximum. Update the brief with the buyer first.");
    update.agreed_price_ron = agreedPriceRon;
    update.agreed_terms = cleanText(value.agreedTerms ?? current.agreed_terms, 1000);
    if (!update.agreed_terms) throw new Error("Agreed terms are required.");
  }
  if (action === "buyer_accepted") update.buyer_accepted_at = new Date().toISOString();
  if (action === "completed") {
    if (!current.buyer_accepted_at) throw new Error("Buyer acceptance is required before completion.");
    update.completed_at = new Date().toISOString();
  }
  if (action === "lost" || action === "cancelled") {
    update.outcome_reason = cleanText(value.reason, 300);
    if (!update.outcome_reason) throw new Error("A reason is required to close the deal.");
  }
  return update;
}

export function buildDealOpeningDraft(deal) {
  const brief = deal.brief;
  const opening = brief.openingOfferRon ? ` Aș putea oferi ${brief.openingOfferRon} RON, dacă totul este în regulă.` : "";
  const questions = brief.questions.length ? ` ${brief.questions.map((q) => q.endsWith("?") ? q : `${q}?`).join(" ")}` : "";
  return `Bună! Sunt asistentul LiberGent și contactez în numele unui cumpărător interesat de ${deal.listing_title}. Mai este disponibil?${questions}${opening} Dacă preferați să nu mai primiți mesaje, spuneți-mi și mă opresc.`;
}

export function buildDealReplyDraft(deal, conversation) {
  const last = conversation?.messages?.at(-1);
  if (!last || last.direction !== "inbound" || ["unavailable", "completed", "cancelled", "lost"].includes(deal.stage)) return null;
  const text = String(last.text || "").toLocaleLowerCase("ro-RO");
  if (/nu mai (este|e) disponibil|s-a vândut|s a vandut|indisponibil|nu mai (trimite|scrie)|oprește|opreste|\bstop\b/.test(text)) return null;
  if (/de acord|rămâne stabilit|ramane stabilit|bătut palma|batut palma|ne-am înțeles|ne-am inteles/.test(text)) {
    return "Mulțumesc pentru răspuns. Voi confirma prețul și condițiile exacte cu cumpărătorul înainte de a stabili următorul pas.";
  }
  if (/preț|pret|ofertă|oferta|negoci/.test(text)) {
    return deal.brief.openingOfferRon
      ? `Mulțumesc! Cumpărătorul ar putea oferi ${deal.brief.openingOfferRon} RON, dacă starea produsului corespunde anunțului. Este acceptabil pentru dvs.?`
      : "Mulțumesc! Care este cel mai bun preț final și ce include oferta? Voi confirma apoi cu cumpărătorul.";
  }
  const firstQuestion = deal.brief.questions?.[0];
  return firstQuestion
    ? `Mulțumesc pentru răspuns. ${firstQuestion.endsWith("?") ? firstQuestion : `${firstQuestion}?`}`
    : "Mulțumesc pentru răspuns. Îmi puteți confirma starea produsului și modalitatea de predare? Voi verifica detaliile cu cumpărătorul.";
}
