"use client";

import Link from 'next/link';
import { useEffect, useImperativeHandle, useState, type Ref } from 'react';
import { Send, RefreshCw, Link2 } from 'lucide-react';
import { OlxPublishingSettings } from './OlxPublishingSettings';
import { savePhotoCache } from '@/lib/selling-photo-cache';
import { sellingRequest, publicationLabels, type SellProduct, type SellPhoto, type OlxSettings, type Publication } from '@/lib/selling';

const control = 'mt-1 w-full border border-[#101010]/40 bg-white px-3 py-2 text-sm';
const button = 'inline-flex items-center justify-center gap-2 border border-[#101010] px-4 py-3 text-sm font-bold hover:bg-[#FF4F8B] disabled:opacity-40 disabled:cursor-not-allowed';
const initialOlx: OlxSettings = { categoryId: 0, cityId: 0, advertiserType: 'private', attributes: [] };
const storageKey = 'libergent:sell-publishing:v1';

export type SellingActions = { start: () => void };

export function SellPublishing({ actionRef, onAutomaticHandled, listing, photos, selected, prepared, onBusyChange, onPhotosUploaded, onNewListing, onRestore }: { actionRef: Ref<SellingActions>; onAutomaticHandled: (names: string[]) => void; onBusyChange: (busy: boolean) => void; prepared: boolean; listing: SellProduct; photos: SellPhoto[]; selected: string[]; onPhotosUploaded: (photos: SellPhoto[]) => void; onNewListing: () => void; onRestore: (listing: SellProduct, photos: SellPhoto[]) => void }) {
  const [config, setConfig] = useState<{ available: boolean; olx: boolean; okazii: boolean } | null>(null);
  const [connected, setConnected] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [id, setId] = useState('');
  const [olx, setOlx] = useState(initialOlx);
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [history, setHistory] = useState<{ id: string; listing: SellProduct }[]>([]);
  const [results, setResults] = useState<Publication[]>([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [submitOlx, setSubmitOlx] = useState(true);
  const [submitOkazii, setSubmitOkazii] = useState(true);
  const olxSent = results.some((result) => result.platform === 'olx' && !['failed', 'error'].includes(result.status));
  const targets = [...(submitOlx && selected.includes('OLX') && connected && signedIn && contactName.trim() && olx.categoryId && olx.cityId && config?.olx && !olxSent ? ['olx'] : []), ...(submitOkazii && selected.includes('Okazii') && signedIn && config?.okazii ? ['okazii'] : [])];

  useEffect(() => {
    let active = true;
    async function load() {
      let draftId = crypto.randomUUID() as string;
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
        if (saved && /^[a-f\d-]{36}$/i.test(saved.id)) {
          draftId = saved.id;
          if (saved.olx && Array.isArray(saved.olx.attributes)) setOlx({ ...initialOlx, ...saved.olx });
          setContactName(typeof saved.contactName === 'string' ? saved.contactName : '');
          setPhone(typeof saved.phone === 'string' ? saved.phone : '');
        }
      } catch { /* A fresh draft remains usable when browser storage is unavailable. */ }
      if (!active) return;
      setId(draftId); setLoaded(true);
      try {
        const response = await fetch('/api/selling/config');
        if (!response.ok) throw new Error();
        const settings = await response.json(); if (!active) return; setConfig(settings);
        if (settings.available) {
          const connections = await sellingRequest('/connections'); if (!active) return; setSignedIn(true);
          setConnected(connections.connections.some((connection: { platform: string }) => connection.platform === 'olx'));
          const inventory = await sellingRequest('/drafts'); if (active) setHistory(inventory.drafts);
          try { const saved = await sellingRequest(`/drafts/${draftId}`); if (active) setResults(saved.publications); } catch { /* Draft may not have been sent yet. */ }
        }
      } catch { if (active) setNotice('Conectează-te și verifică disponibilitatea publicării.'); }
    }
    void load(); return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(storageKey, JSON.stringify({ id, olx, contactName, phone })); } catch { /* Server saves still work. */ }
  }, [loaded, id, olx, contactName, phone]);

  useEffect(() => {
    onAutomaticHandled(results.filter((result) => result.status !== 'failed').map((result) => result.platform === 'olx' ? 'OLX' : 'Okazii'));
  }, [results, onAutomaticHandled]);

  useImperativeHandle(actionRef, () => ({ start: () => { void run(publish); } }));

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); onBusyChange(true); setNotice('');
    try { await action(); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Cererea nu a putut fi finalizată.'); }
    finally { setBusy(false); onBusyChange(false); }
  }
  async function publish() {
    if (!loaded) { setNotice('Conexiunile se încarcă. Poți începe cu pașii de mai jos.'); return; }
    if (!targets.length) { setNotice('Continuă cu platformele de mai jos. Poți conecta conturile pentru publicare directă din Setări.'); return; }
    if (targets.includes('olx') && (!contactName.trim() || !olx.categoryId || !olx.cityId)) throw new Error('Completează numele de contact, categoria și localitatea OLX.');
    if (!olxSent) {
      const uploaded: SellPhoto[] = [];
      for (const photo of photos) {
        if (photo.uploadedUrl) uploaded.push(photo);
        else if (photo.file) {
          const result = await sellingRequest('/images', 'POST', photo.file);
          uploaded.push({ ...photo, uploadedUrl: result.url });
        } else throw new Error('Adaugă din nou fotografiile înainte de publicare.');
      }
      onPhotosUploaded(uploaded);
      await sellingRequest('/drafts', 'POST', { id, listing: { ...listing, contactName, phone, olx, images: uploaded.map((photo) => photo.uploadedUrl) } });
    }
    const response = await sellingRequest('/publish', 'POST', { id, platforms: targets });
    setResults((current) => [...current.filter((item) => !response.results.some((result: Publication) => result.platform === item.platform)), ...response.results]);
    setNotice('Am procesat cererea. Verifică rezultatul separat pentru fiecare platformă.');
    const inventory = await sellingRequest('/drafts'); setHistory(inventory.drafts);
  }
  return <section className="mb-8 border-2 border-[#101010] bg-[#F3F0E7] p-5 sm:p-7" aria-labelledby="publish-heading">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 font-mono text-xs font-bold tracking-widest text-[#C51D55]">PUBLICARE DIN LIBERGENT</p><h2 id="publish-heading" className="text-2xl font-bold">Conturile tale de vânzător</h2></div><Link href="/auth/?next=%2Fvinde%2F" className="text-sm underline underline-offset-4">Conectează-te la LiberGent</Link></div>
    <p className="my-4 max-w-3xl text-sm leading-relaxed">Conectează conturile o singură dată. La următorul anunț, folosim automat integrările pregătite.</p>
    {config && !config.available && <p className="mb-5 border border-[#101010]/30 bg-white p-4 text-sm">Publicarea directă nu este activată încă pe acest server. Anunțul rămâne disponibil pentru publicare manuală.</p>}
    {history.length > 0 && <label className="mb-5 block max-w-xl text-sm font-semibold">Anunțurile tale salvate (ultimele 100)<select disabled={busy} className={control} value={history.some((draft) => draft.id === id) ? id : ''} onChange={(event) => {
      const draftId = event.target.value; if (!draftId) return;
      void run(async () => {
        const saved = await sellingRequest(`/drafts/${draftId}`);
        const product = saved.draft.listing;
        setId(draftId); setOlx(product.olx || initialOlx); setContactName(product.contactName || ''); setPhone(product.phone || ''); setResults(saved.publications);
        onRestore({ title: product.title, description: product.description, price: String(product.price), location: product.location, category: product.category, condition: product.condition }, product.images.map((url: string, index: number) => ({ url, uploadedUrl: url, name: `Fotografie ${index + 1}` })));
      });
    }}><option value="">Anunț nou</option>{history.map((draft) => <option key={draft.id} value={draft.id}>{draft.listing.title}</option>)}</select></label>}
    <details className="mb-4"><summary className="cursor-pointer py-3 text-sm font-bold">Setări de publicare · {connected ? "OLX conectat" : "conectează conturile"}</summary><fieldset disabled={busy} className="grid gap-5 lg:grid-cols-2">
      <div className="border border-[#101010] bg-white/50 p-4">
        <div className="flex items-center justify-between gap-3"><h3 className="font-bold">OLX</h3><span className="font-mono text-xs">{connected ? 'CONECTAT' : 'CONECTARE NECESARĂ'}</span></div>
        <p className="my-3 text-sm">Publicare directă din contul tău. OLX poate cere confirmare, moderare sau plata unei taxe în cont.</p>
        {!config?.olx && <p className="mb-3 text-xs text-[#555]">Integrarea necesită activarea accesului de partener OLX.</p>}
        <button type="button" disabled={!config?.olx || busy} className={button} onClick={() => run(async () => {
          if (connected) { await sellingRequest('/olx/disconnect', 'POST'); setConnected(false); }
          else { await savePhotoCache(photos); const result = await sellingRequest('/olx/connect', 'POST'); window.location.assign(result.url); }
        })}><Link2 size={16} />{connected ? 'Deconectează OLX' : 'Conectează contul OLX'}</button>
        {connected && <>
          <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={submitOlx} disabled={!selected.includes('OLX') || olxSent} onChange={(event) => setSubmitOlx(event.target.checked)} />Trimite către OLX{!selected.includes('OLX') && ' — selectează OLX mai sus'}</label>
          <label className="mt-4 block text-xs">Nume de contact<input maxLength={100} className={control} value={contactName} onChange={(event) => setContactName(event.target.value)} /></label>
          <label className="mt-3 block text-xs">Telefon (dacă este cerut de categorie)<input type="tel" maxLength={30} className={control} value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
          <OlxPublishingSettings value={olx} onChange={setOlx} />
        </>}
      </div>
      <div className="border border-[#101010] bg-white/50 p-4"><div className="flex items-center justify-between"><h3 className="font-bold">Okazii</h3><span className="font-mono text-xs">IMPORT AUTOMAT</span></div><p className="my-3 text-sm">Configurezi o singură dată adresa feed-ului în magazinul tău Okazii. Următoarele anunțuri se adaugă în același feed.</p><ol className="ml-5 list-decimal space-y-2 text-sm"><li>Include anunțul în feed folosind butonul de mai jos.</li><li>În Okazii, alege Import produse → Import automat și adaugă adresa feed-ului.</li><li>Asociază categoriile și configurează livrarea, plata și actualizarea.</li></ol><a className="mt-4 inline-block text-xs underline" href="https://ajutor.okazii.ro/magazine-okazii-ro/import-produse.html" target="_blank" rel="noopener noreferrer">Instrucțiuni Okazii ↗</a><label className="mt-5 flex items-center gap-2 text-sm"><input type="checkbox" checked={submitOkazii} disabled={!selected.includes('Okazii') || !config?.okazii} onChange={(event) => setSubmitOkazii(event.target.checked)} />Include în feed-ul Okazii{!selected.includes('Okazii') && ' — selectează Okazii mai sus'}</label><p className="mt-3 text-xs text-[#555]">Titlul din feed este limitat la 80 de caractere. Importul și publicarea sunt gestionate de Okazii.</p></div>
    </fieldset></details>
    <p className="mb-3 mt-5 text-xs text-[#555]">{!prepared && "Completează formularul și apasă Publică peste tot. "}Prin trimitere, fotografiile devin accesibile prin link pentru platformele selectate. Butonul nu cumpără promovări sau pachete.</p>
    {olxSent && <p className="my-3 text-sm">Acest anunț a fost deja trimis către OLX. Starea de mai jos se referă la versiunea salvată la trimitere. Modificările din formular nu actualizează anunțul OLX.</p>}
    <div className="flex flex-wrap gap-3"><button hidden={!prepared || !targets.length} type="button" disabled={busy || !loaded || !targets.length || !prepared} className={`${button} bg-[#FF4F8B]`} onClick={() => run(publish)}><Send size={16} />{busy ? 'Se procesează…' : `Trimite din nou doar către integrările pregătite (${targets.length})`}</button><button type="button" disabled={busy || !config?.available} className={button} onClick={() => run(async () => { const response = await sellingRequest('/refresh', 'POST', { id }); setResults(response.publications); const connections = await sellingRequest('/connections'); setConnected(connections.connections.some((connection: { platform: string }) => connection.platform === 'olx')); })}><RefreshCw size={16} />Verifică starea</button><button type="button" disabled={busy} className={button} onClick={() => { setId(crypto.randomUUID()); setOlx({ ...initialOlx, cityId: olx.cityId, districtId: olx.districtId, advertiserType: olx.advertiserType }); setResults([]); setNotice('Anunț nou. Publicările precedente rămân în conturile platformelor.'); onNewListing(); }}>Alt produs / anunț nou</button></div>
    <p role="status" className="mt-4 text-sm">{notice}</p>
    <div className="mt-4 space-y-3">{results.map((result) => <div key={result.platform} className="border border-[#101010]/30 bg-white p-4"><p className="font-bold">{result.platform === 'olx' ? 'OLX' : 'Okazii'} · {publicationLabels[result.status] || result.status}</p><p className="mt-1 text-sm">{result.message}</p>{result.url && (result.platform === 'okazii' ? <><label className="mt-3 block text-xs">Adresa feed-ului pentru import<input readOnly className={control} value={result.url} onFocus={(event) => event.target.select()} /></label><button type="button" className={`${button} mt-2`} onClick={() => run(async () => { await navigator.clipboard.writeText(result.url!); setNotice('Adresa feed-ului a fost copiată.'); })}>Copiază adresa</button><button type="button" disabled={busy} className={`${button} ml-2 mt-2`} onClick={() => run(async () => { await sellingRequest('/okazii/remove', 'POST', { id }); setResults((current) => current.filter((item) => item.platform !== 'okazii')); setNotice('Scos din feed. Dacă a fost importat deja, verifică și retrage anunțul din Okazii.'); })}>Scoate din feed</button></> : <a className="mt-2 inline-block text-sm underline" href={result.url} target="_blank" rel="noopener noreferrer">Vezi anunțul OLX ↗</a>)}</div>)}</div>
  </section>;
}
