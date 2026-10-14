"use client";

import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { postingText, type SellPhoto, type SellProduct } from '@/lib/selling';
import { sellingMarketplaces } from '@/lib/selling-marketplaces';

const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-black/20 px-4 py-3 text-sm font-bold hover:bg-[#FF4F8B] disabled:opacity-40';

export function SellPostingQueue({ listing, photos, selected, handled, busy }: { listing: SellProduct; photos: SellPhoto[]; selected: string[]; handled: string[]; busy: boolean }) {
  const fingerprint = JSON.stringify([listing, photos.map((photo) => [photo.name, photo.file?.size])]);
  const [initial] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('libergent:sell-progress:v1') || 'null');
      if (saved?.fingerprint === fingerprint) return saved;
    } catch { /* No saved progress on this device. */ }
    return {};
  });
  const restore = (key: string): string[] => Array.isArray(initial[key]) ? initial[key].filter((name: unknown) => sellingMarketplaces.some((market) => market.name === name)) : [];
  const [completed, setCompleted] = useState<string[]>(() => restore('completed'));
  const [skipped, setSkipped] = useState<string[]>(() => restore('skipped'));
  const [opened, setOpened] = useState<string[]>(() => restore('opened'));
  const [notice, setNotice] = useState('');
  const [showReusable, setShowReusable] = useState(false);
  const manual = sellingMarketplaces.filter((market) => selected.includes(market.name) && !handled.includes(market.name));
  const pending = manual.filter((market) => !completed.includes(market.name) && !skipped.includes(market.name));
  const current = pending[0];

  useEffect(() => {
    try { localStorage.setItem('libergent:sell-progress:v1', JSON.stringify({ fingerprint, completed, skipped, opened })); }
    catch { /* Posting can continue without local storage. */ }
  }, [fingerprint, completed, skipped, opened]);

  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setNotice('Copiat. Lipește în formularul platformei.'); }
    catch { setShowReusable(true); setNotice('Copierea este blocată în browser. Selectează textul din previzualizare.'); }
  }
  function openCurrent() {
    if (!current) return;
    // Open only the requested destination, synchronously with the click, avoiding popup floods.
    window.open(current.url, '_blank', 'noopener,noreferrer');
    setOpened((values) => [...new Set([...values, current.name])]);
    void copy(postingText(listing));
  }

  return <section className="rounded-2xl border border-black/10 bg-white p-5 sm:p-7" aria-labelledby="queue-heading">
    <p className="font-mono text-xs font-bold text-[#C51D55]">ULTIMII PAȘI</p>
    <h2 id="queue-heading" className="mt-2 text-2xl font-bold">{busy ? 'Trimitem anunțul…' : current ? `Continuă pe ${current.name}` : 'Ai parcurs platformele selectate.'}</h2>
    <p className="my-3 text-sm">{handled.filter((name) => selected.includes(name)).length} platforme gestionate prin integrare · {completed.filter((name) => manual.some((market) => market.name === name)).length} publicări confirmate de tine · {pending.length} pași rămași</p>
    {current && !busy && <>
      <p className="mb-5 max-w-2xl text-sm">Această platformă se finalizează manual. Copiem anunțul și o deschidem pentru tine. Adaugă fotografiile, publică și revino aici pentru următoarea.</p>
      <div className="flex flex-wrap gap-3"><button type="button" className={`${button} bg-[#FF4F8B]`} onClick={openCurrent}><ExternalLink size={16} />Copiază și deschide {current.name}</button><button type="button" disabled={!opened.includes(current.name)} className={button} onClick={() => { setCompleted((values) => [...values, current.name]); setNotice('Marcat ca publicat de tine. Continuăm cu următoarea platformă.'); }}><Check size={16} />Am publicat. Următoarea</button><button type="button" className="px-3 py-2 text-sm underline" onClick={() => setSkipped((values) => [...values, current.name])}>Mai târziu</button></div>
      <details open={showReusable} onToggle={(event) => setShowReusable(event.currentTarget.open)} className="mt-5 border-t border-black/20 pt-4"><summary className="cursor-pointer text-sm font-semibold">Text și fotografii, gata de refolosit</summary><div className="my-3 flex flex-wrap gap-2">{[['Titlu', listing.title], ['Descriere', listing.description], ['Preț', listing.price], ['Localitate', listing.location]].map(([label, value]) => <button key={label} type="button" className={button} onClick={() => copy(value)}><Copy size={14} />{label}</button>)}</div><label className="block text-xs">Anunțul tău<textarea readOnly value={postingText(listing)} rows={7} className="mt-2 w-full border border-black/30 p-3 text-sm" onFocus={(event) => event.target.select()} /></label><div className="mt-3 flex flex-wrap gap-3">{photos.map((photo, index) => <a key={photo.url} href={photo.url} download={photo.name} target="_blank" rel="noopener noreferrer" className="text-xs underline">Fotografia {index + 1} ↗</a>)}</div></details>
    </>}
    {!current && !busy && <p className="my-4 text-sm">Publicările manuale sunt confirmate de tine. Verifică separat rezultatele integrărilor și eventualele platforme amânate.</p>}
    <div className="mt-5 flex flex-wrap gap-2">{manual.map((market) => <span key={market.name} className="border border-black/20 px-3 py-2 text-xs">{market.name} · {completed.includes(market.name) ? 'Confirmat de tine' : skipped.includes(market.name) ? 'Mai târziu' : 'De finalizat'}</span>)}</div>
    {skipped.length > 0 && <button type="button" className={`${button} mt-4`} onClick={() => setSkipped([])}>Reia platformele amânate</button>}
    <p role="status" className="mt-3 text-sm">{notice}</p>
  </section>;
}
