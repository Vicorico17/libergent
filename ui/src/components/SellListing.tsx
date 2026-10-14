"use client";

import { useEffect, useRef, useState } from "react";
import { SellPostingQueue } from "./SellPostingQueue";
import { recommendedMarketplaces, sellingMarketplaces } from "@/lib/selling-marketplaces";
import { SellPublishing, type SellingActions } from "./SellPublishing";
import { announcementDetails } from "@/lib/selling-announcement";
import type { SellPhoto } from "@/lib/selling";
import { readPhotoCache, savePhotoCache } from "@/lib/selling-photo-cache";
import { ArrowRight, ImagePlus, X } from "lucide-react";

const marketplaces = sellingMarketplaces;
const categories = ["Electronice", "Modă și accesorii", "Casă și grădină", "Sport și hobby", "Copii", "Auto", "Altele"];
const emptyListing = { title: "", description: "", price: "", location: "", category: categories[0], condition: "Folosit — stare bună" };
const storageKey = "libergent:sell-draft:v1";
const control = "mt-2 w-full rounded-lg border border-black/20 bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#FF4F8B]";
const button = "inline-flex items-center justify-center gap-2 rounded-lg border border-black/20 px-4 py-3 text-sm font-bold transition-colors hover:bg-[#FF4F8B] disabled:cursor-not-allowed disabled:opacity-40";

type Photo = SellPhoto;

export function SellListing() {
  const [listing, setListing] = useState(emptyListing);
  const [selected, setSelected] = useState<string[]>(recommendedMarketplaces(categories[0]));
  const [photos, setPhotos] = useState<Photo[]>([]);
  const photoUrls = useRef(new Set<string>());
  const [connectionHint, setConnectionHint] = useState("Verificăm conexiunile…");
  const [publishing, setPublishing] = useState(false);
  const [view, setView] = useState<"listing" | "connections">("listing");
  const [reviewing, setReviewing] = useState(false);
  const [prepared, setPrepared] = useState(false);
  const [automaticHandled, setAutomaticHandled] = useState<string[]>([]);
  const actions = useRef<SellingActions>(null);
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.listing && Object.keys(emptyListing).every((key) => typeof saved.listing[key] === "string")) {
          // Restore browser-only storage after hydration so the server and first client render agree.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setListing(Object.fromEntries(Object.keys(emptyListing).map((key) => [key, saved.listing[key]])) as typeof emptyListing);
          if (Array.isArray(saved.selected)) setSelected(saved.selected.filter((name: string) => marketplaces.some((market) => market.name === name)));
          setNotice("Ciorna a fost restaurată.");
          if (new URLSearchParams(window.location.search).has("olx")) setPrepared(true);
        }
      }
    } catch { setNotice("Ciorna nu poate fi restaurată în acest browser."); }
    let active = true;
    const urls = photoUrls.current;
    readPhotoCache().then((stored) => {
      if (!active) return;
      const restored: Photo[] = [];
      for (const photo of stored.slice(0, 8)) {
        if (photo.file instanceof File) {
          const url = URL.createObjectURL(photo.file); urls.add(url);
          restored.push({ ...photo, url });
        } else if (photo.uploadedUrl?.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/selling-images/`)) {
          restored.push({ ...photo, url: photo.uploadedUrl });
        }
      }
      setPhotos(restored);
    }).catch(() => { if (active) setNotice("Fotografiile nu pot fi restaurate în acest browser. Adaugă-le din nou."); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; urls.forEach((url) => URL.revokeObjectURL(url)); };

  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(storageKey, JSON.stringify({ listing, selected })); }
    catch {
      // Report a failed write to the external storage system instead of silently losing the draft.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotice("Salvarea locală nu este disponibilă. Păstrează textul înainte să închizi pagina.");
    }
  }, [listing, selected, ready]);

  useEffect(() => {
    if (!ready) return;
    void savePhotoCache(photos).catch(() => setNotice("Fotografiile nu pot fi salvate local. Păstrează această pagină deschisă până la trimitere."));
  }, [photos, ready]);

  useEffect(() => { if (prepared) resultRef.current?.focus(); }, [prepared]);

  function update(key: keyof typeof emptyListing, value: string) {
    setListing((current) => {
      if (key !== "description") return { ...current, [key]: value };
      const before = announcementDetails(current.description);
      const after = announcementDetails(value);
      return { ...current, description: value,
        ...Object.fromEntries((["title", "price", "location"] as const).map((field) => [field, !current[field] || current[field] === before[field] ? after[field] : current[field]])) };
    });
    if (key === "category") setSelected(recommendedMarketplaces(value));
    setPrepared(false);

  }

  return (
    <div className="mx-auto max-w-[960px]">
      <header className="mb-8">
        <p className="mb-2 font-mono text-xs font-bold tracking-widest text-[#C51D55]">VINDE</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Un anunț. Mai multe locuri.</h1>
        <p className="mt-3 text-sm text-[#555]">Scrii anunțul o singură dată. Îl trimitem prin conturile conectate și îți arătăm rezultatul pentru fiecare platformă.</p>
      </header>
      <nav aria-label="Vinde" className="mb-6 flex gap-2 rounded-xl bg-black/5 p-1.5">
        {([["listing", "Anunțul tău"], ["connections", "Conectează platformele"]] as const).map(([value, label]) => <button key={value} type="button" disabled={publishing} aria-pressed={view === value} onClick={() => setView(value)} className={`flex-1 rounded-lg px-3 py-3 text-sm font-semibold transition-colors ${view === value ? "bg-white shadow-sm" : "hover:bg-white/50"}`}>{label}</button>)}
      </nav>
      <div hidden={view !== "listing"}>
      <ol aria-label="Pașii publicării" className="mb-5 flex gap-4 text-xs sm:text-sm">{["Scrie", "Verifică", "Trimite"].map((step, index) => <li key={step} aria-current={(prepared ? 2 : reviewing ? 1 : 0) === index ? "step" : undefined} className={(prepared ? 2 : reviewing ? 1 : 0) === index ? "font-bold text-[#C51D55]" : "text-[#666]"}>{index + 1}. {step}</li>)}</ol>
      {prepared && <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 bg-white p-5"><div><p className="font-semibold">{listing.title}</p><p className="mt-1 text-sm text-[#555]">{listing.price} lei · {listing.location} · {photos.length} fotografii</p></div><button type="button" disabled={publishing} className={button} onClick={() => { setPrepared(false); setReviewing(true); }}>Editează anunțul</button></div>}
      <form hidden={prepared} noValidate={!reviewing} onSubmit={(event) => { event.preventDefault(); if (!reviewing) { if (listing.description.trim().length < 20) { setNotice("Scrie cel puțin 20 de caractere despre produs."); event.currentTarget.querySelector("textarea")?.focus(); return; } setReviewing(true); setNotice("Verifică detaliile. Nu am trimis încă anunțul."); return; } if (listing.title.trim().length < 3 || !listing.location.trim() || listing.description.trim().length < 20) { setNotice("Completează titlul (minimum 3 caractere), localitatea și o descriere de minimum 20 de caractere."); return; } if (!selected.length) { setNotice("Selectează cel puțin un marketplace."); return; } setPrepared(true); setNotice("Verificăm trimiterea. Vezi rezultatul și pașii rămași mai jos."); actions.current?.start(); }}>
        <fieldset disabled={publishing} className="grid gap-8 lg:grid-cols-[1fr_280px]">
          <section className="min-w-0 rounded-2xl border border-black/10 bg-white p-5 sm:p-7" aria-labelledby="product-heading">
            <h2 id="product-heading" className="mb-6 font-mono text-lg font-bold">{reviewing ? "Verifică anunțul" : "Ce vinzi?"}</h2>
            <label className="mb-6 block text-sm font-semibold">Scrie anunțul aici<textarea aria-label="Scrie anunțul aici" required minLength={20} maxLength={5000} rows={6} value={listing.description} onChange={(event) => update("description", event.target.value)} placeholder={"iPhone 14, 128 GB\nFuncționează perfect, mici urme pe carcasă. Cutie și cablu incluse.\nPreț: 1500 lei\nLocalitate: București"} className={control} /><span className="mt-2 block text-xs font-normal text-[#555]">Prima linie devine titlul. Preluăm prețul în lei și „Localitate:” din text. Verifică detaliile de mai jos înainte de trimitere.</span></label>
            <div className="mb-6"><label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-black/30 bg-[#F3F0E7]/40 p-5 focus-within:ring-2 focus-within:ring-[#C51D55] text-center text-sm"><ImagePlus aria-hidden="true" /><span className="font-semibold">Adaugă fotografiile produsului</span><span className="text-xs">Maximum 8 imagini · JPG, PNG sau WebP · 10 MB fiecare</span><input type="file" className="sr-only" disabled={!ready} accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => {
              const files = Array.from(event.target.files || []);
              const valid = files.filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= 10 * 1024 * 1024);
              const accepted = valid.slice(0, 8 - photos.length).map((file) => { const url = URL.createObjectURL(file); photoUrls.current.add(url); return { url, name: file.name, file }; });
              setPhotos((current) => [...current, ...accepted]);
              if (accepted.length !== files.length) setNotice("Unele imagini nu au fost adăugate. Verifică formatul, limita de 10 MB și maximum 8 fotografii.");
              event.target.value = "";
            }} /></label>
              <p className="mt-2 text-xs text-[#555]">Pentru publicarea directă, fotografiile se încarcă la trimitere. Pentru publicarea manuală, folosește fișierele originale.</p>
              <div className="mt-3 grid grid-cols-4 gap-2">{photos.map((photo) => <div key={photo.url} className="relative aspect-square border border-[#101010]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={photo.name} className="h-full w-full object-cover" /><button type="button" aria-label={`Elimină ${photo.name}`} className="absolute right-0 top-0 bg-white p-1" onClick={() => { URL.revokeObjectURL(photo.url); photoUrls.current.delete(photo.url); setPhotos((current) => current.filter((item) => item.url !== photo.url)); }}><X size={16} /></button>
              </div>)}</div>
            </div>
            <fieldset disabled={!reviewing}><div hidden={!reviewing}><h3 className="mb-4 text-sm font-semibold">Verifică detaliile</h3>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="text-sm font-semibold sm:col-span-2">Titlul anunțului<input required minLength={3} maxLength={120} value={listing.title} onChange={(event) => update("title", event.target.value)} placeholder="Ex. iPhone 14, 128 GB, stare foarte bună" className={control} /></label>
              <label className="text-sm font-semibold">Categorie<select value={listing.category} onChange={(event) => update("category", event.target.value)} className={control}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
              <label className="text-sm font-semibold">Stare<select value={listing.condition} onChange={(event) => update("condition", event.target.value)} className={control}>{["Nou", "Folosit — ca nou", "Folosit — stare bună", "Folosit — stare acceptabilă"].map((condition) => <option key={condition}>{condition}</option>)}</select></label>
              <label className="text-sm font-semibold">Preț (RON)<input type="number" required min="1" max="999999999" step="0.01" value={listing.price} onChange={(event) => update("price", event.target.value)} placeholder="450" className={control} /></label>
              <label className="text-sm font-semibold">Localitate<input required maxLength={100} value={listing.location} onChange={(event) => update("location", event.target.value)} placeholder="Ex. București" className={control} /></label>

            </div>
            </div></fieldset>

          </section>
          <section className="self-start rounded-2xl border border-black/10 bg-white p-5 lg:sticky lg:top-28" aria-labelledby="market-heading">
            <h2 id="market-heading" className="font-mono text-lg font-bold">Unde apare anunțul</h2><p className="mb-5 mt-2 text-sm text-[#555]">Am selectat platformele recomandate categoriei tale. Poți schimba selecția oricând.</p>
            <div className="mb-4 flex flex-wrap gap-2">{selected.map((name) => <span key={name} className="rounded-md bg-[#F3F0E7] px-2 py-1 text-xs">{name}</span>)}</div>
            <details><summary className="mb-4 cursor-pointer text-sm underline">Schimbă selecția</summary>
            <button type="button" className="mb-4 text-sm font-bold underline underline-offset-4" onClick={() => { setSelected(selected.length === marketplaces.length ? [] : marketplaces.map((market) => market.name)); setPrepared(false); }}>{selected.length === marketplaces.length ? "Deselectează toate" : "Selectează toate"}</button>
            <div className="space-y-2">{marketplaces.map((market) => <label key={market.name} className={`flex cursor-pointer items-center gap-3 border p-3 ${selected.includes(market.name) ? "border-[#101010] bg-[#F3F0E7]" : "border-[#101010]/20"}`}><input type="checkbox" className="h-4 w-4 accent-[#C51D55]" checked={selected.includes(market.name)} onChange={(event) => { setSelected((current) => event.target.checked ? [...current, market.name] : current.filter((name) => name !== market.name)); setPrepared(false); }} /><span className="text-sm font-semibold">{market.name}{market.name === "Autovit" && <span className="block text-xs font-normal text-[#555]">Pentru vehicule</span>}{market.name === "Vinted" && <span className="block text-xs font-normal text-[#555]">Verifică dacă produsul este acceptat în catalog</span>}</span></label>)}</div>
            </details>
            <div className="my-4 rounded-lg bg-[#F3F0E7] p-3 text-xs leading-relaxed"><p role="status">{connectionHint}</p><button type="button" onClick={() => setView("connections")} className="mt-2 font-semibold underline">Verifică conexiunile</button></div><div className="mt-6 border-t border-[#101010] pt-5"><p className="mb-4 font-mono text-sm"><strong>{selected.length}</strong> platforme selectate</p><button disabled={!ready || !selected.length} type="submit" className={`${button} w-full bg-[#FF4F8B]`}>{publishing ? "Se trimite…" : reviewing ? "Trimite anunțul" : "Verifică anunțul"} <ArrowRight size={18} /></button><p className="mt-3 text-xs leading-relaxed text-[#555]">{reviewing ? "Trimitem prin integrările pregătite. Vei vedea separat platformele care mai au nevoie de tine." : "Urmează verificarea detaliilor. Nu publicăm nimic în acest pas."}</p></div>
          </section>
        </fieldset>
      </form>
      <p role="status" className="my-5 text-sm">{notice}</p>
      </div>
      <div hidden={view === "listing" && !prepared} ref={resultRef} tabIndex={-1} className="scroll-mt-28 outline-none">
        <SellPublishing onReadiness={setConnectionHint} connectionsOpen={view === "connections"} onOpenConnections={() => setView("connections")} actionRef={actions} onAutomaticHandled={setAutomaticHandled} onBusyChange={setPublishing} prepared={prepared} listing={listing} photos={photos} selected={selected} onRestore={(saved, savedPhotos) => { setListing(saved); setPhotos(savedPhotos); setView("listing"); setPrepared(true); }} onPhotosUploaded={(uploaded) => {
          setPhotos(uploaded);
        }} onNewListing={() => {
          setListing(emptyListing); setReviewing(false); setView("listing"); setPrepared(false); setPhotos([]);
          photoUrls.current.forEach((url) => URL.revokeObjectURL(url)); photoUrls.current.clear();
        }} />
      </div>
      {prepared && view === "listing" && <SellPostingQueue key={JSON.stringify([listing, photos.map((photo) => [photo.name, photo.file?.size])])} listing={listing} photos={photos} selected={selected} handled={automaticHandled} busy={publishing} />}

    </div>
  );
}
