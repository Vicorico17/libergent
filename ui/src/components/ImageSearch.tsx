"use client";

import { useEffect, useId, useRef, useState } from "react";

async function preparePhoto(file: File): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Alege o fotografie JPEG, PNG sau WebP. Pentru HEIC, exportă fotografia ca JPEG.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Fotografia este prea mare. Alege una sub 20 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Nu am putut pregăti fotografia.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Nu am putut pregăti fotografia.')), 'image/jpeg', 0.85));
  } finally { bitmap.close(); }
}

export function ImageSearch({ onSearch }: { onSearch: (query: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const controller = useRef<AbortController | null>(null);
  const titleId = useId();
  const previewUrl = useRef('');
  const [recognized, setRecognized] = useState(false);
  const [preview, setPreview] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);

  useEffect(() => () => {
    controller.current?.abort();
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
  }, []);

  async function recognize(file: File) {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true); setError(''); setQuery(''); setRecognized(false); setPreview('');
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    try {
      const blob = await preparePhoto(file);
      if (request.signal.aborted) return;
      previewUrl.current = URL.createObjectURL(blob);
      setPreview(previewUrl.current);
      const response = await fetch('/api/image-search', {
        method: 'POST', headers: { 'content-type': blob.type }, body: blob,
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(35000)])
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Nu am putut identifica produsul.');
      if (typeof result.query !== 'string' || !result.query.trim()) throw new Error('Nu am identificat un produs. Încearcă altă fotografie.');
      setRecognized(true); setQuery(result.query); setUncertain(result.confidence !== 'high');
    } catch (cause) {
      if (!request.signal.aborted) setError(cause instanceof Error && cause.name !== 'TimeoutError' ? cause.message : 'Recunoașterea a durat prea mult. Încearcă din nou.');
    } finally { if (controller.current === request) setBusy(false); }
  }

  function search() {
    if (!query.trim() || busy) return;
    onSearch(query.trim());
    dialog.current?.close();
  }

  return <>
    <button type="button" title="Caută după fotografie" aria-label="Caută după fotografie" onClick={() => dialog.current?.showModal()}
      className="shrink-0 px-3 py-2 text-[#111111] hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-offset-2">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6h4l2-3h4l2 3h4a1 1 0 0 1 1 1v13H3V7a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.8" /></svg>
    </button>
    <dialog ref={dialog} aria-labelledby={titleId} onClose={() => { controller.current?.abort(); setBusy(false); }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto border border-black bg-[#F5F3EE] p-5 text-[#111111] shadow-xl backdrop:bg-black/50">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={titleId} className="text-lg font-bold">Caută după fotografie</h2>
        <button type="button" onClick={() => dialog.current?.close()} aria-label="Închide" className="px-3 py-2 text-xl">×</button>
      </div>
      <p className="mb-4 text-sm normal-case">Alege o fotografie cu un singur produs. Verifică descrierea înainte de căutare.</p>
      <label className="block text-sm font-semibold">Fotografie (JPEG, PNG sau WebP)
        <input type="file" accept="image/jpeg,image/png,image/webp" className="my-3 block w-full text-sm file:mr-3 file:border file:border-black file:bg-white file:px-3 file:py-2" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void recognize(file); }} />
      </label>
      {preview ? <div className="my-3 flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="Fotografia produsului ales" className="max-h-48 max-w-full object-contain" />
      </div> : null}
      <p role="status" aria-live="polite" className="my-2 text-sm normal-case">{busy ? 'Identificăm produsul…' : query ? uncertain ? 'Verifică descrierea: identificarea este incertă.' : 'Produs identificat. Poți modifica descrierea.' : ''}</p>
      {error ? <p role="alert" className="my-3 text-sm normal-case text-red-700">{error}</p> : null}
      {recognized ? <label className="my-3 block text-sm font-semibold">Ce căutăm?
        <input value={query} onChange={event => setQuery(event.target.value)} maxLength={160} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); search(); } }} className="mt-2 block w-full border border-black bg-white p-3 text-base" />
      </label> : null}
      <button type="button" onClick={search} disabled={busy || !query.trim()} className="mt-2 w-full bg-[#111111] px-4 py-3 text-sm font-bold text-white disabled:opacity-40">Caută produsul</button>
      <p className="mt-3 text-xs normal-case opacity-70">Fotografia este trimisă către Groq pentru recunoaștere. LiberGent nu o salvează. Rezultatele sunt căutate după descrierea produsului.</p>
    </dialog>
  </>;
}
