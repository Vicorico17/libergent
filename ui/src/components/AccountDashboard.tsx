"use client";

/* eslint-disable @next/next/no-img-element */

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Bookmark, Clock3, ExternalLink, LayoutDashboard, LogOut, MessageSquare, Plus, Search, Trash2, UserRound } from "lucide-react";
import { LogoIcon } from "@/components/LogoIcon";
import {
  readAccountActivity,
  readAccountAlerts,
  readSavedListings,
  removeSavedListing,
  writeAccountAlerts,
  writeSavedListingIds,
  type AccountActivityRecord,
  type AccountAlertRecord,
  type SavedListingRecord,
} from "@/lib/account-data";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { AccountSessionState } from "@/lib/use-account-session";

const CREAM = "#F3F0E7";
const INK = "#111111";
const PINK = "#FF4F8B";
const GREEN = "#198754";
const MONO = "var(--font-mono-var), monospace";

type AccountSection = "overview" | "favorites" | "alerts" | "conversations" | "history";

type ConversationMessage = {
  id: string;
  direction: "inbound" | "outbound";
  text: string;
  timestamp: string;
};

type SellerConversation = {
  id: string;
  sellerPhone: string;
  marketplace: string;
  listingUrl: string;
  listingTitle: string;
  listingPrice: string;
  status: string;
  lastMessageAt: string;
  lastMessage: string;
  messageCount: number;
  messages: ConversationMessage[];
};

const STATUS_LABELS: Record<string, string> = {
  contacted: "Contactat",
  replied: "A răspuns",
  negotiating: "În negociere",
  unavailable: "Indisponibil",
  deal_agreed: "Acord stabilit",
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recent";
  return new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-4 p-8 text-center" style={{ border: `1px dashed ${INK}66`, background: "white" }}>
      <div className="text-[13px] font-bold uppercase">{title}</div>
      <p className="max-w-lg text-[11px] uppercase leading-relaxed" style={{ color: `${INK}99` }}>{description}</p>
      {action}
    </div>
  );
}

function SectionHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-b border-black pb-5 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: PINK }}>{eyebrow}</div>
        <h1 className="text-[23px] font-bold uppercase leading-tight sm:text-[30px]">{title}</h1>
        <p className="mt-2 text-[11px] uppercase leading-relaxed" style={{ color: `${INK}99` }}>{description}</p>
      </div>
      {action}
    </div>
  );
}

function MetricCard({ label, value, note, onClick }: { label: string; value: number; note: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="p-5 text-left transition-transform hover:-translate-y-1" style={{ border: `1px solid ${INK}`, background: "white", boxShadow: `3px 3px 0 ${INK}` }}>
      <div className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: `${INK}88` }}>{label}</div>
      <div className="my-3 text-[30px] font-bold" style={{ color: PINK }}>{value}</div>
      <div className="text-[9px] font-bold uppercase leading-relaxed">{note}</div>
    </button>
  );
}

export function AccountDashboard({ account, next }: { account: AccountSessionState; next: string }) {
  const router = useRouter();
  const [section, setSection] = useState<AccountSection>("overview");
  const [favorites, setFavorites] = useState<SavedListingRecord[]>([]);
  const [alerts, setAlerts] = useState<AccountAlertRecord[]>([]);
  const [activity, setActivity] = useState<AccountActivityRecord[]>([]);
  const [conversations, setConversations] = useState<SellerConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [conversationStatus, setConversationStatus] = useState<"loading" | "ready" | "error">("loading");
  const [conversationError, setConversationError] = useState("");
  const [alertQuery, setAlertQuery] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const selectedConversation = conversations.find((item) => item.id === selectedConversationId) || conversations[0] || null;

  useEffect(() => {
    queueMicrotask(() => {
      setFavorites(readSavedListings(account.userId));
      setAlerts(readAccountAlerts(account.userId));
      setActivity(readAccountActivity(account.userId));
    });
  }, [account.userId]);

  useEffect(() => {
    let active = true;
    async function loadConversations() {
      setConversationStatus("loading");
      const supabase = getSupabaseBrowserClient();
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      if (!session?.access_token) {
        if (active) {
          setConversationStatus("error");
          setConversationError("Sesiunea a expirat. Reconectează-te pentru conversațiile private.");
        }
        return;
      }
      try {
        const response = await fetch("/api/conversations", { headers: { authorization: `Bearer ${session.access_token}` } });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Conversațiile nu au putut fi încărcate.");
        if (!active) return;
        const nextConversations = Array.isArray(payload.conversations) ? payload.conversations : [];
        setConversations(nextConversations);
        setSelectedConversationId(nextConversations[0]?.id || "");
        setConversationStatus("ready");
        setConversationError("");
      } catch (error) {
        if (!active) return;
        setConversationStatus("error");
        setConversationError(error instanceof Error ? error.message : "Conversațiile nu au putut fi încărcate.");
      }
    }
    loadConversations();
    return () => { active = false; };
  }, []);

  const navItems = useMemo(() => [
    { id: "overview" as const, label: "Prezentare", icon: LayoutDashboard, count: null },
    { id: "favorites" as const, label: "Anunțuri apreciate", icon: Bookmark, count: favorites.length },
    { id: "alerts" as const, label: "Alerte", icon: Bell, count: alerts.filter((alert) => alert.enabled).length },
    { id: "conversations" as const, label: "Conversații", icon: MessageSquare, count: conversations.length },
    { id: "history" as const, label: "Istoric LiberGent", icon: Clock3, count: activity.length },
  ], [activity.length, alerts, conversations.length, favorites.length]);

  function deleteFavorite(id: string) {
    removeSavedListing(account.userId, id);
    const nextFavorites = favorites.filter((favorite) => favorite.id !== id);
    setFavorites(nextFavorites);
    writeSavedListingIds(account.userId, new Set(nextFavorites.map((favorite) => favorite.id)));
  }

  function updateAlerts(nextAlerts: AccountAlertRecord[]) {
    setAlerts(nextAlerts);
    writeAccountAlerts(account.userId, nextAlerts);
  }

  async function createAlert(event: FormEvent) {
    event.preventDefault();
    const query = alertQuery.trim();
    if (!query || !account.email) return;
    const createdAt = new Date().toISOString();
    const id = `${query.toLowerCase()}:${createdAt}`;
    const localAlert: AccountAlertRecord = { id, query, email: account.email, enabled: true, createdAt, syncStatus: "local" };
    updateAlerts([localAlert, ...alerts]);
    setAlertQuery("");
    setAlertMessage("Alerta a fost salvată în cont. Verificăm sincronizarea notificărilor...");
    try {
      const response = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: account.email, query, source: "account_alert", pagePath: "/account", notificationsEnabled: true }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Serviciul de alerte nu este conectat încă.");
      const synced = [localAlert, ...alerts].map((alert) => alert.id === id ? { ...alert, syncStatus: "synced" as const } : alert);
      updateAlerts(synced);
      setAlertMessage("Alerta este sincronizată pentru notificări.");
    } catch (error) {
      setAlertMessage(`${error instanceof Error ? error.message : "Serviciul de alerte nu este conectat încă."} Alerta rămâne salvată local.`);
    }
  }

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setSigningOut(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setSigningOut(false);
      return;
    }
    router.replace(next);
  }

  return (
    <main className="min-h-screen" style={{ background: CREAM, color: INK, fontFamily: MONO }}>
      <header className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6" style={{ borderBottom: `1px solid ${INK}`, background: "white" }}>
        <Link href="/" className="flex items-center gap-3"><LogoIcon size={28} /><span className="text-[13px] font-bold uppercase tracking-widest">LiberGent<span style={{ color: PINK }}>.</span></span></Link>
        <Link href={next} className="px-3 py-2 text-[9px] font-bold uppercase" style={{ border: `1px solid ${INK}` }}>Înapoi în aplicație</Link>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-64px)] max-w-[1500px] grid-cols-1 lg:grid-cols-[290px_1fr]">
        <aside className="flex flex-col border-b border-black bg-white lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3 p-5" style={{ borderBottom: `1px solid ${INK}` }}>
            <div className="flex h-11 w-11 items-center justify-center text-[16px] font-bold uppercase" style={{ border: `1px solid ${INK}`, background: PINK }}>{(account.displayName || account.email || "L").slice(0, 1)}</div>
            <div className="min-w-0"><div className="truncate text-[11px] font-bold uppercase">{account.displayName || "Cont LiberGent"}</div><div className="truncate text-[9px]" style={{ color: `${INK}88` }}>{account.email}</div></div>
          </div>
          <nav className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-1" aria-label="Meniu cont">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button key={item.id} type="button" onClick={() => setSection(item.id)} className="flex min-h-14 items-center gap-3 px-4 py-3 text-left text-[9px] font-bold uppercase" style={{ borderBottom: `1px solid ${INK}22`, background: active ? INK : "white", color: active ? "white" : INK }}>
                  <Icon size={15} /><span className="min-w-0 flex-1">{item.label}</span>{item.count !== null ? <span style={{ color: active ? PINK : `${INK}88` }}>{item.count}</span> : null}
                </button>
              );
            })}
          </nav>
          <div className="mt-auto hidden p-4 lg:block">
            <button type="button" onClick={signOut} disabled={signingOut} className="flex w-full items-center justify-center gap-2 px-4 py-3 text-[9px] font-bold uppercase disabled:opacity-50" style={{ border: `1px solid ${INK}` }}><LogOut size={14} />{signingOut ? "Se închide..." : "Deconectează-te"}</button>
          </div>
        </aside>

        <section className="min-w-0 p-5 sm:p-8 lg:p-10">
          {section === "overview" && (
            <div className="flex flex-col gap-8">
              <SectionHeader eyebrow="Account control center" title={`Salut, ${account.displayName || "bine ai revenit"}`} description="Toate deciziile tale de cumpărare într-un singur loc: favorite, monitorizări, selleri și istoricul recomandărilor." />
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Anunțuri apreciate" value={favorites.length} note="Produse păstrate pentru comparație" onClick={() => setSection("favorites")} />
                <MetricCard label="Alerte active" value={alerts.filter((alert) => alert.enabled).length} note="Căutări urmărite în cont" onClick={() => setSection("alerts")} />
                <MetricCard label="Conversații" value={conversations.length} note="Discuții private cu sellerii" onClick={() => setSection("conversations")} />
                <MetricCard label="Sesiuni LiberGent" value={activity.length} note="Căutări și recomandări recente" onClick={() => setSection("history")} />
              </div>
              <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
                <div className="p-5" style={{ border: `1px solid ${INK}`, background: "white" }}><div className="mb-4 text-[11px] font-bold uppercase">Activitate recentă</div>{activity.slice(0, 3).length ? activity.slice(0, 3).map((entry) => <Link key={entry.id} href={`/search?q=${encodeURIComponent(entry.query)}&tier=${entry.tier}`} className="flex items-center justify-between gap-4 border-t border-black/15 py-3 text-[10px]"><span className="font-bold uppercase">{entry.query}</span><span style={{ color: `${INK}77` }}>{entry.resultCount} rezultate</span></Link>) : <p className="text-[10px] uppercase" style={{ color: `${INK}77` }}>Prima ta căutare conectată va apărea aici.</p>}</div>
                <div className="p-5" style={{ border: `1px solid ${INK}`, background: PINK }}><UserRound size={22} /><div className="mt-5 text-[9px] font-bold uppercase opacity-70">Metodă conectare</div><div className="mt-1 text-[14px] font-bold uppercase">{account.provider}</div><div className="mt-4 break-all text-[10px]">{account.email}</div></div>
              </div>
            </div>
          )}

          {section === "favorites" && (
            <div className="flex flex-col gap-7">
              <SectionHeader eyebrow="Shortlist" title="Anunțuri apreciate" description="Favoritele sunt separate pe cont. Deschide sursa originală pentru disponibilitatea și prețul curent." action={<Link href="/search" className="flex items-center gap-2 px-4 py-3 text-[9px] font-bold uppercase" style={{ border: `1px solid ${INK}`, background: INK, color: "white" }}><Search size={13} />Caută produse</Link>} />
              {favorites.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{favorites.map((item) => <article key={item.id} className="flex flex-col overflow-hidden" style={{ border: `1px solid ${INK}`, background: "white" }}>{item.image ? <img src={item.image} alt="" className="aspect-[16/9] w-full object-cover" style={{ borderBottom: `1px solid ${INK}` }} /> : <div className="flex aspect-[16/9] items-center justify-center" style={{ background: `${INK}0D`, borderBottom: `1px solid ${INK}` }}><Bookmark size={24} /></div>}<div className="flex flex-1 flex-col gap-3 p-4"><div className="flex justify-between gap-3 text-[8px] font-bold uppercase"><span>{item.source}</span><span>{item.condition}</span></div><h2 className="line-clamp-2 text-[12px] font-bold uppercase">{item.title}</h2><div className="text-[15px] font-bold" style={{ color: PINK }}>{item.priceLabel}</div><div className="text-[9px] uppercase" style={{ color: `${INK}77` }}>{item.city || "Locație nespecificată"} · salvat {formatDate(item.savedAt)}</div><div className="mt-auto grid grid-cols-[1fr_auto] gap-2">{item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 px-3 py-2 text-[9px] font-bold uppercase" style={{ border: `1px solid ${INK}`, background: INK, color: "white" }}>Marketplace <ExternalLink size={11} /></a> : <span />}<button type="button" onClick={() => deleteFavorite(item.id)} aria-label={`Elimină ${item.title}`} className="p-2" style={{ border: `1px solid ${INK}` }}><Trash2 size={13} /></button></div></div></article>)}</div> : <EmptyState title="Nu ai anunțuri apreciate" description="Apasă «Salvează în favorite» pe un rezultat și vei păstra aici titlul, prețul, marketplace-ul și locația." action={<Link href="/search" className="px-4 py-3 text-[9px] font-bold uppercase" style={{ border: `1px solid ${INK}`, background: INK, color: "white" }}>Începe o căutare</Link>} />}
            </div>
          )}

          {section === "alerts" && (
            <div className="flex flex-col gap-7">
              <SectionHeader eyebrow="Monitoring" title="Alerte de căutare" description="Salvează ce urmărești. Fiecare alertă arată separat dacă este sincronizată cu serviciul de notificări sau păstrată doar în acest browser." />
              <form onSubmit={createAlert} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto]" style={{ border: `1px solid ${INK}`, background: "white" }}><label className="grid gap-2 text-[9px] font-bold uppercase">Ce produs urmărești?<input value={alertQuery} onChange={(event) => setAlertQuery(event.target.value)} required maxLength={240} placeholder="ex: iPhone 15 Pro 256GB" className="min-h-11 px-3 text-[11px] outline-none" style={{ border: `1px solid ${INK}` }} /></label><button type="submit" className="flex min-h-11 items-center justify-center gap-2 self-end px-4 text-[9px] font-bold uppercase" style={{ border: `1px solid ${INK}`, background: PINK }}><Plus size={13} />Creează alertă</button>{alertMessage ? <p role="status" className="text-[9px] uppercase leading-relaxed sm:col-span-2" style={{ color: `${INK}99` }}>{alertMessage}</p> : null}</form>
              {alerts.length ? <div className="grid gap-3">{alerts.map((alert) => <article key={alert.id} className="grid items-center gap-4 p-4 sm:grid-cols-[1fr_auto_auto]" style={{ border: `1px solid ${INK}`, background: "white" }}><div><div className="text-[12px] font-bold uppercase">{alert.query}</div><div className="mt-1 text-[9px] uppercase" style={{ color: `${INK}77` }}>{alert.email} · creată {formatDate(alert.createdAt)}</div></div><span className="w-fit px-2 py-1 text-[8px] font-bold uppercase" style={{ border: `1px solid ${alert.syncStatus === "synced" ? GREEN : PINK}`, color: alert.syncStatus === "synced" ? GREEN : PINK }}>{alert.syncStatus === "synced" ? "Sincronizată" : "Doar local"}</span><div className="flex gap-2"><button type="button" onClick={() => updateAlerts(alerts.map((entry) => entry.id === alert.id ? { ...entry, enabled: !entry.enabled } : entry))} className="px-3 py-2 text-[8px] font-bold uppercase" style={{ border: `1px solid ${INK}`, background: alert.enabled ? INK : "white", color: alert.enabled ? "white" : INK }}>{alert.enabled ? "Activă" : "Pauză"}</button><button type="button" onClick={() => updateAlerts(alerts.filter((entry) => entry.id !== alert.id))} aria-label={`Șterge alerta ${alert.query}`} className="p-2" style={{ border: `1px solid ${INK}` }}><Trash2 size={12} /></button></div></article>)}</div> : <EmptyState title="Nicio alertă salvată" description="Creează o monitorizare pentru produsul și configurația exactă pe care le cauți." />}
            </div>
          )}

          {section === "conversations" && (
            <div className="flex flex-col gap-7">
              <SectionHeader eyebrow="Private seller inbox" title="Conversații" description="Mesajele sunt încărcate prin sesiunea ta și filtrate după cont. Răspunsurile sellerilor apar în același fir." />
              {conversationStatus === "loading" ? <EmptyState title="Se încarcă conversațiile" description="Verificăm mesajele private asociate contului." /> : conversations.length ? <div className="grid min-h-[520px] overflow-hidden lg:grid-cols-[330px_1fr]" style={{ border: `1px solid ${INK}`, background: "white" }}><div className="border-b border-black lg:border-b-0 lg:border-r">{conversations.map((conversation) => <button key={conversation.id} type="button" onClick={() => setSelectedConversationId(conversation.id)} className="w-full border-b border-black/15 p-4 text-left" style={{ background: selectedConversation?.id === conversation.id ? CREAM : "white" }}><div className="flex justify-between gap-3"><span className="truncate text-[10px] font-bold uppercase">{conversation.listingTitle}</span><span className="shrink-0 text-[8px] font-bold uppercase" style={{ color: PINK }}>{STATUS_LABELS[conversation.status] || conversation.status}</span></div><div className="mt-1 text-[8px] uppercase" style={{ color: `${INK}77` }}>{conversation.marketplace} · {conversation.sellerPhone}</div><div className="mt-2 truncate text-[9px]">{conversation.lastMessage}</div></button>)}</div>{selectedConversation ? <div className="flex min-h-0 flex-col"><div className="border-b border-black p-4"><div className="text-[12px] font-bold uppercase">{selectedConversation.listingTitle}</div><div className="mt-1 text-[9px] uppercase" style={{ color: `${INK}77` }}>{selectedConversation.listingPrice} · {selectedConversation.messageCount} mesaje</div></div><div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">{selectedConversation.messages.map((message) => <div key={message.id} className={`flex ${message.direction === "outbound" ? "justify-end" : "justify-start"}`}><div className="max-w-[85%] p-3 text-[10px] leading-relaxed" style={{ border: `1px solid ${INK}`, background: message.direction === "outbound" ? INK : CREAM, color: message.direction === "outbound" ? "white" : INK }}><div>{message.text}</div><div className="mt-2 text-[8px] opacity-60">{formatDate(message.timestamp)}</div></div></div>)}</div>{selectedConversation.listingUrl ? <a href={selectedConversation.listingUrl} target="_blank" rel="noopener noreferrer" className="m-4 flex items-center justify-center gap-2 p-3 text-[9px] font-bold uppercase" style={{ border: `1px solid ${INK}` }}>Deschide anunțul <ExternalLink size={12} /></a> : null}</div> : null}</div> : <EmptyState title="Nicio conversație încă" description={conversationStatus === "error" ? conversationError : "Când contactezi un seller dintr-un rezultat, firul privat va apărea aici."} action={<Link href="/search" className="px-4 py-3 text-[9px] font-bold uppercase" style={{ border: `1px solid ${INK}`, background: INK, color: "white" }}>Găsește un produs</Link>} />}
            </div>
          )}

          {section === "history" && (
            <div className="flex flex-col gap-7">
              <SectionHeader eyebrow="LiberGent memory" title="Istoric LiberGent" description="Aici vezi căutările și recomandările generate cât timp ai fost conectat. Istoricul unei conversații complete cu asistentul va folosi aceeași secțiune când chatul este lansat." />
              {activity.length ? <div className="grid gap-3">{activity.map((entry) => <article key={entry.id} className="grid gap-4 p-4 md:grid-cols-[1fr_auto]" style={{ border: `1px solid ${INK}`, background: "white" }}><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-[12px] font-bold uppercase">{entry.query}</h2><span className="px-2 py-1 text-[8px] font-bold uppercase" style={{ background: entry.tier === "premium" ? PINK : CREAM, border: `1px solid ${INK}` }}>{entry.tier}</span></div><div className="mt-2 text-[9px] uppercase" style={{ color: `${INK}77` }}>{formatDate(entry.searchedAt)} · {entry.resultCount} rezultate</div>{entry.bestOfferTitle ? <div className="mt-3 text-[10px]"><span className="font-bold uppercase">Recomandare:</span> {entry.bestOfferTitle} {entry.bestOfferPrice ? `— ${entry.bestOfferPrice}` : ""}</div> : null}</div><div className="flex items-center gap-2"><Link href={`/search?q=${encodeURIComponent(entry.query)}&tier=${entry.tier}`} className="flex items-center gap-2 px-3 py-2 text-[8px] font-bold uppercase" style={{ border: `1px solid ${INK}`, background: INK, color: "white" }}><Search size={11} />Repetă</Link>{entry.bestOfferUrl ? <a href={entry.bestOfferUrl} target="_blank" rel="noopener noreferrer" aria-label="Deschide recomandarea" className="p-2" style={{ border: `1px solid ${INK}` }}><ExternalLink size={12} /></a> : null}</div></article>)}</div> : <EmptyState title="Istoricul este gol" description="Următoarea căutare făcută în timp ce ești conectat va salva aici întrebarea, numărul de rezultate și recomandarea principală." action={<Link href="/search" className="px-4 py-3 text-[9px] font-bold uppercase" style={{ border: `1px solid ${INK}`, background: INK, color: "white" }}>Începe o căutare</Link>} />}
            </div>
          )}

          <button type="button" onClick={signOut} disabled={signingOut} className="mt-8 flex w-full items-center justify-center gap-2 px-4 py-3 text-[9px] font-bold uppercase disabled:opacity-50 lg:hidden" style={{ border: `1px solid ${INK}`, background: "white" }}><LogOut size={14} />{signingOut ? "Se închide..." : "Deconectează-te"}</button>
        </section>
      </div>
    </main>
  );
}
