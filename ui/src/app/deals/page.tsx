"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useAccountSession } from "@/lib/use-account-session";

type Brief = {
  maxPriceRon: number;
  openingOfferRon: number | null;
  questions: string[];
  deliveryPreference: string;
  location: string;
  timing: string;
  dealBreakers: string;
};
type Deal = {
  id: string;
  listing_url: string;
  listing_title: string;
  marketplace: string;
  listing_price: string;
  brief: Brief;
  stage: string;
  paused_at: string | null;
  agreed_price_ron: number | null;
  agreed_terms: string;
  buyer_accepted_at: string | null;
  completed_at: string | null;
  outcome_reason: string;
  updated_at: string;
};
type Conversation = {
  id: string;
  sellerPhone: string;
  listingUrl: string;
  status: string;
  messages: Array<{ id: string; direction: "inbound" | "outbound"; text: string; timestamp: string }>;
};
type DealEvent = { id: number; event_type: string; stage: string; details: { agreedPriceRon?: number; outcomeReason?: string }; created_at: string };

const STAGES: Record<string, string> = {
  draft: "Pregătire", contacting: "Contact inițiat", negotiating: "În discuție",
  terms_agreed: "Termeni propuși", buyer_accepted: "Acceptat de cumpărător",
  completed: "Cumpărare confirmată", lost: "Încheiat fără tranzacție", cancelled: "Oprit"
};
const INPUT = "w-full border border-black bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#FF3366]";
const BUTTON = "border border-black bg-black px-4 py-3 text-xs font-bold uppercase text-white disabled:opacity-50";

async function dealRequest(path: string, method = "GET", body?: object) {
  const client = getSupabaseBrowserClient();
  const session = client ? (await client.auth.getSession()).data.session : null;
  if (!session?.access_token) throw new Error("Conectează-te pentru a folosi asistentul.");
  const response = await fetch(path, {
    method,
    headers: { authorization: `Bearer ${session.access_token}`, "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Cererea a eșuat (${response.status}).`);
  return payload;
}

function DealContent() {
  const params = useSearchParams();
  const requestedListingUrl = params.get("url") || "";
  const account = useAccountSession();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [events, setEvents] = useState<DealEvent[]>([]);
  const [replyConversationId, setReplyConversationId] = useState("");
  const [replyText, setReplyText] = useState("");
  const [modelReason, setModelReason] = useState("");
  const [modelBusy, setModelBusy] = useState(false);
  const selectedDealRef = useRef("");
  const sendAttempt = useRef<{ signature: string; key: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [listingUrl, setListingUrl] = useState(requestedListingUrl);
  const [listingTitle, setListingTitle] = useState(params.get("title") || "");
  const [marketplace, setMarketplace] = useState(params.get("marketplace") || "");
  const [listingPrice, setListingPrice] = useState(params.get("price") || "");
  const [maxPrice, setMaxPrice] = useState("");
  const [openingOffer, setOpeningOffer] = useState("");
  const [questions, setQuestions] = useState("");
  const [deliveryPreference, setDeliveryPreference] = useState("");
  const [location, setLocation] = useState("");
  const [timing, setTiming] = useState("");
  const [dealBreakers, setDealBreakers] = useState("");
  const [agreedPrice, setAgreedPrice] = useState("");
  const [agreedTerms, setAgreedTerms] = useState("");
  const [reason, setReason] = useState("");
  const selected = deals.find((deal) => deal.id === selectedId) || null;
  const replyConversation = conversations.find((item) => item.id === replyConversationId) || null;

  function showDetail(payload: { openingDraft?: string; conversations?: Conversation[]; events?: DealEvent[]; replyDraft?: string | null; replyConversationId?: string | null }, dealId = "") {
    if (dealId && selectedDealRef.current !== dealId) return;
    setDraft(String(payload.openingDraft || ""));
    setConversations(Array.isArray(payload.conversations) ? payload.conversations : []);
    setEvents(Array.isArray(payload.events) ? payload.events : []);
    setReplyText(String(payload.replyDraft || ""));
    setModelReason("");
    setReplyConversationId(String(payload.replyConversationId || ""));
  }

  useEffect(() => {
    if (account.status !== "signed_in") return;
    let active = true;
    dealRequest("/api/deals").then((payload) => {
      if (!active) return;
      const next = Array.isArray(payload.deals) ? payload.deals as Deal[] : [];
      setDeals(next);
      const chosen = next.find((item) => item.listing_url === requestedListingUrl) || next[0];
      selectedDealRef.current = chosen?.id || "";
      setSelectedId(chosen?.id || "");
      if (chosen) {
        setAgreedPrice(chosen.agreed_price_ron ? String(chosen.agreed_price_ron) : "");
        setAgreedTerms(chosen.agreed_terms || "");
        dealRequest(`/api/deals/${chosen.id}`).then((detail) => { if (active) showDetail(detail, chosen.id); }).catch(() => { if (active) setDraft(""); });
      }
    }).catch((failure) => { if (active) setError(failure instanceof Error ? failure.message : "Nu am putut încărca negocierile."); });
    return () => { active = false; };
  }, [account.status, requestedListingUrl]);

  function selectDeal(deal: Deal) {
    selectedDealRef.current = deal.id;
    setSelectedId(deal.id);
    setAgreedPrice(deal.agreed_price_ron ? String(deal.agreed_price_ron) : "");
    setAgreedTerms(deal.agreed_terms || "");
    showDetail({});
    dealRequest(`/api/deals/${deal.id}`).then((detail) => showDetail(detail, deal.id)).catch(() => setError("Nu am putut încărca discuția."));
  }

  async function createDeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const payload = await dealRequest("/api/deals", "POST", {
        listingUrl, listingTitle, marketplace, listingPrice,
        brief: {
          maxPriceRon: Number(maxPrice), openingOfferRon: openingOffer ? Number(openingOffer) : null,
          questions: questions.split(/\n+/).map((value) => value.trim()).filter(Boolean),
          deliveryPreference, location, timing, dealBreakers
        }
      });
      setDeals((current) => [payload.deal as Deal, ...current]);
      selectedDealRef.current = payload.deal.id;
      setSelectedId(payload.deal.id);
      showDetail(payload);
      dealRequest(`/api/deals/${payload.deal.id}`).then((detail) => showDetail(detail, payload.deal.id)).catch(() => null);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Nu am putut crea negocierea."); }
    finally { setBusy(false); }
  }

  async function changeStage(action: string) {
    if (!selected) return;
    setBusy(true); setError("");
    try {
      const payload = await dealRequest(`/api/deals/${selected.id}`, "PATCH", {
        action, ...(agreedPrice ? { agreedPriceRon: Number(agreedPrice) } : {}), agreedTerms, reason
      });
      setDeals((current) => current.map((item) => item.id === selected.id ? payload.deal as Deal : item));
      dealRequest(`/api/deals/${selected.id}`).then((detail) => showDetail(detail, selected.id)).catch(() => null);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Nu am putut actualiza negocierea."); }
    finally { setBusy(false); }
  }

  async function sendApprovedReply() {
    if (!selected || !replyConversation || !replyText.trim() || busy) return;
    const message = replyText.trim();
    const signature = `${selected.id}:${replyConversation.id}:${message}`;
    if (sendAttempt.current?.signature !== signature) sendAttempt.current = { signature, key: crypto.randomUUID() };
    if (!window.confirm(`Trimiți mesajul către seller?\n\n${message}`)) return;
    setBusy(true); setError("");
    try {
      const payload = await dealRequest("/api/whatsapp/send", "POST", {
        dealId: selected.id, idempotencyKey: sendAttempt.current.key,
        conversationId: replyConversation.id, target: replyConversation.sellerPhone, message,
        listing: { url: selected.listing_url, title: selected.listing_title, marketplace: selected.marketplace, price: selected.listing_price }
      });
      if (!payload.historySaved) setError("Mesajul a fost preluat, dar istoricul nu a putut fi salvat. Nu îl retrimite automat.");
      else {
        sendAttempt.current = null;
        setReplyText("");
        showDetail(await dealRequest(`/api/deals/${selected.id}`), selected.id);
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Mesajul nu a putut fi trimis."); }
    finally { setBusy(false); }
  }

  async function requestModelDraft() {
    if (!selected || modelBusy) return;
    setModelBusy(true); setError("");
    try {
      const payload = await dealRequest(`/api/deals/${selected.id}/suggest`, "POST");
      setReplyText(String(payload.proposal?.message || ""));
      setReplyConversationId(String(payload.conversationId || ""));
      setModelReason(String(payload.proposal?.reason || ""));
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Asistentul nu a putut pregăti un răspuns."); }
    finally { setModelBusy(false); }
  }

  if (account.status === "checking") return <p>Verificăm contul...</p>;
  if (account.status === "signed_out") return <p>Conectează-te pentru a porni o negociere. <Link href="/auth?next=%2Fdeals" className="underline">Conectare</Link></p>;

  return <main className="mx-auto max-w-6xl px-4 py-10 text-[#111]">
    <Link href="/search" className="text-xs font-bold uppercase underline">← Înapoi la căutare</Link>
    <p className="mt-8 text-xs font-bold uppercase text-[#FF3366]">Premium · Asistent de negociere</p>
    <h1 className="mt-2 text-3xl font-black uppercase">De la anunț la tranzacție</h1>
    <p className="mt-3 max-w-3xl text-sm leading-relaxed">Stabilește limita de preț și condițiile tale. Urmărește separat contactul, termenii acceptați și cumpărarea confirmată.</p>
    {error && <p role="alert" className="mt-6 border border-[#FF3366] bg-white p-4 text-sm">{error} {error.includes("Premium") && <Link href="/pricing" className="font-bold underline">Vezi Premium</Link>}</p>}
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="border border-black bg-white p-5">
        <h2 className="text-lg font-black uppercase">Brief nou</h2>
        <form onSubmit={createDeal} className="mt-5 grid gap-4">
          <label className="grid gap-1 text-xs font-bold uppercase">Link anunț<input className={INPUT} type="url" required maxLength={2000} value={listingUrl} onChange={(event) => setListingUrl(event.target.value)} /></label>
          <label className="grid gap-1 text-xs font-bold uppercase">Produs<input className={INPUT} required maxLength={300} value={listingTitle} onChange={(event) => setListingTitle(event.target.value)} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-xs font-bold uppercase">Marketplace<input className={INPUT} maxLength={80} value={marketplace} onChange={(event) => setMarketplace(event.target.value)} /></label>
            <label className="grid gap-1 text-xs font-bold uppercase">Preț afișat<input className={INPUT} maxLength={100} value={listingPrice} onChange={(event) => setListingPrice(event.target.value)} /></label>
            <label className="grid gap-1 text-xs font-bold uppercase">Preț maxim RON<input className={INPUT} type="number" min="1" step="1" required value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} /></label>
            <label className="grid gap-1 text-xs font-bold uppercase">Ofertă inițială RON<input className={INPUT} type="number" min="1" step="1" value={openingOffer} onChange={(event) => setOpeningOffer(event.target.value)} /></label>
          </div>
          <label className="grid gap-1 text-xs font-bold uppercase">Întrebări pentru seller, una pe rând<textarea className={INPUT} rows={3} value={questions} onChange={(event) => setQuestions(event.target.value)} /></label>
          <label className="grid gap-1 text-xs font-bold uppercase">Livrare sau ridicare<input className={INPUT} maxLength={200} value={deliveryPreference} onChange={(event) => setDeliveryPreference(event.target.value)} /></label>
          <div className="grid grid-cols-2 gap-3"><label className="grid gap-1 text-xs font-bold uppercase">Locație<input className={INPUT} maxLength={120} value={location} onChange={(event) => setLocation(event.target.value)} /></label><label className="grid gap-1 text-xs font-bold uppercase">Când<input className={INPUT} maxLength={120} value={timing} onChange={(event) => setTiming(event.target.value)} /></label></div>
          <label className="grid gap-1 text-xs font-bold uppercase">Condiții eliminatorii<textarea className={INPUT} rows={2} maxLength={500} value={dealBreakers} onChange={(event) => setDealBreakers(event.target.value)} /></label>
          <button className={BUTTON} disabled={busy}>Creează brief</button>
        </form>
      </section>
      <section className="border border-black bg-white p-5">
        <h2 className="text-lg font-black uppercase">Negocierile mele</h2>
        <div className="mt-4 flex flex-wrap gap-2">{deals.map((deal) => <button key={deal.id} type="button" onClick={() => selectDeal(deal)} className={`border border-black px-3 py-2 text-xs ${selectedId === deal.id ? "bg-black text-white" : "bg-white"}`}>{deal.listing_title}</button>)}</div>
        {!deals.length && <p className="mt-5 text-sm">Niciun brief încă.</p>}
        {selected && <div className="mt-6 grid gap-5">
          <div><h3 className="text-base font-black">{selected.listing_title}</h3><p className="text-xs">{selected.marketplace} · {STAGES[selected.stage] || selected.stage}{selected.paused_at ? " · Pauză" : ""}</p><p className="mt-1 text-xs">Limită: {selected.brief.maxPriceRon} RON · Oferta inițială: {selected.brief.openingOfferRon ?? "nesetată"}</p><a href={selected.listing_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-bold underline">Deschide anunțul</a></div>
          <div className="border border-black bg-[#F5F3EE] p-4"><p className="text-xs font-bold uppercase">Mesaj inițial pregătit</p><p className="mt-2 whitespace-pre-wrap text-sm">{draft || "Se pregătește mesajul..."}</p><button type="button" disabled={!draft} onClick={() => navigator.clipboard.writeText(draft).catch(() => setError("Copierea a eșuat."))} className="mt-3 text-xs font-bold uppercase underline">Copiază pentru contactul permis pe marketplace</button></div>
          <p className="text-xs leading-relaxed">Mesajul pregătit nu este trimis automat. Folosește contactul permis de marketplace și marchează progresul după ce verifici răspunsul sellerului.</p>
          <div className="border-t border-black pt-4">
            <div className="flex items-center justify-between gap-3"><h4 className="text-sm font-black uppercase">Discuția cu sellerul</h4><button type="button" className="text-xs font-bold uppercase underline" onClick={() => dealRequest(`/api/deals/${selected.id}`).then((detail) => showDetail(detail, selected.id)).catch(() => setError("Nu am putut reîncărca mesajele."))}>Actualizează</button></div>
            {!conversations.length && <p className="mt-2 text-xs">Niciun mesaj WhatsApp asociat acestui anunț. Discuțiile de pe marketplace rămân pe pagina anunțului.</p>}
            {conversations.map((conversation) => <div key={conversation.id} className="mt-3 border border-black p-3"><p className="text-xs font-bold">{conversation.sellerPhone} · {conversation.status}</p><div className="mt-2 max-h-60 space-y-2 overflow-auto">{conversation.messages.map((message) => <p key={message.id} className="border-l-2 border-[#FF3366] pl-2 text-xs"><strong>{message.direction === "inbound" ? "Seller" : "LiberGent"}:</strong> {message.text}</p>)}</div></div>)}
            {replyConversation && !selected.paused_at && !["draft", "completed", "lost", "cancelled"].includes(selected.stage) && <div className="mt-4 grid gap-2"><label htmlFor="deal-reply" className="text-xs font-bold uppercase">Răspuns pregătit pentru aprobare</label><button type="button" className="border border-black bg-white px-4 py-3 text-xs font-bold uppercase" disabled={modelBusy} onClick={requestModelDraft}>{modelBusy ? "Pregătim..." : "Propunere AI"}</button><p className="text-xs">Pentru propunerea AI, trimitem brief-ul și ultimele mesaje ale sellerului către furnizorul modelului. Verifică textul înainte de trimitere.</p>{modelReason && <p className="text-xs">Motiv: {modelReason}</p>}<textarea id="deal-reply" className={INPUT} rows={4} maxLength={2000} value={replyText} onChange={(event) => setReplyText(event.target.value)} /><button type="button" className={BUTTON} disabled={busy || !replyText.trim()} onClick={sendApprovedReply}>Verifică și trimite răspunsul</button></div>}
          </div>
          <div className="border-t border-black pt-4"><h4 className="text-sm font-black uppercase">Istoric etape</h4>{events.length ? <ol className="mt-3 grid gap-2">{events.map((event) => <li key={event.id} className="border-l-2 border-[#FF3366] pl-3 text-xs"><strong>{STAGES[event.stage] || event.event_type}</strong> · {new Date(event.created_at).toLocaleString("ro-RO")}{event.details?.agreedPriceRon ? ` · ${event.details.agreedPriceRon} RON` : ""}{event.details?.outcomeReason ? ` · ${event.details.outcomeReason}` : ""}</li>)}</ol> : <p className="mt-2 text-xs">Nu există evenimente încă.</p>}</div>
          {!selected.paused_at && !["completed", "lost", "cancelled"].includes(selected.stage) && <button type="button" className={BUTTON} disabled={busy} onClick={() => changeStage("pause")}>Pune în pauză</button>}
          {selected.paused_at && <button type="button" className={BUTTON} disabled={busy} onClick={() => changeStage("resume")}>Reia</button>}
          {!selected.paused_at && selected.stage === "draft" && <button type="button" className={BUTTON} disabled={busy} onClick={() => changeStage("contacting")}>Am contactat sellerul</button>}
          {!selected.paused_at && selected.stage === "contacting" && <button type="button" className={BUTTON} disabled={busy} onClick={() => changeStage("negotiating")}>Sellerul a răspuns</button>}
          {!selected.paused_at && selected.stage === "negotiating" && <><label className="grid gap-1 text-xs font-bold uppercase">Preț propus de seller RON<input className={INPUT} type="number" min="1" step="1" value={agreedPrice} onChange={(event) => setAgreedPrice(event.target.value)} /></label><label className="grid gap-1 text-xs font-bold uppercase">Termeni propuși de seller<textarea className={INPUT} rows={3} value={agreedTerms} onChange={(event) => setAgreedTerms(event.target.value)} /></label></>}
          {selected.stage === "terms_agreed" && <p className="text-xs">Sellerul a propus {selected.agreed_price_ron} RON. Termeni: {selected.agreed_terms}</p>}
          {!selected.paused_at && selected.stage === "negotiating" && <button type="button" className={BUTTON} disabled={busy} onClick={() => changeStage("terms_agreed")}>Sellerul a propus acești termeni</button>}
          {!selected.paused_at && selected.stage === "terms_agreed" && <button type="button" className={BUTTON} disabled={busy} onClick={() => changeStage("buyer_accepted")}>Accept eu termenii</button>}
          {!selected.paused_at && selected.stage === "buyer_accepted" && <button type="button" className={BUTTON} disabled={busy} onClick={() => changeStage("completed")}>Confirm că am cumpărat</button>}
          {!selected.paused_at && !["completed", "lost", "cancelled"].includes(selected.stage) && <><label className="grid gap-1 text-xs font-bold uppercase">Motiv de închidere<input className={INPUT} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} /></label><div className="flex gap-2"><button type="button" className="border border-black px-3 py-2 text-xs font-bold uppercase" disabled={busy} onClick={() => changeStage("lost")}>Nu s-a făcut tranzacția</button><button type="button" className="border border-black px-3 py-2 text-xs font-bold uppercase" disabled={busy} onClick={() => changeStage("cancelled")}>Oprește</button></div></>}
          {selected.outcome_reason && <p className="text-xs">Motiv: {selected.outcome_reason}</p>}
        </div>}
      </section>
    </div>
  </main>;
}

export default function DealsPage() {
  return <Suspense fallback={<main className="p-8">Se încarcă...</main>}><DealContent /></Suspense>;
}
