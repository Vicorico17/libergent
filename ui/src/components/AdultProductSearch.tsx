"use client"

import { useEffect, useState } from "react"

type Offer = { title: string; url: string; priceRon?: number | null; site: string }

export function AdultProductSearch({ token, initialQuery }: { token: string; initialQuery: string }) {
  const [input, setInput] = useState(initialQuery)
  const [query, setQuery] = useState(initialQuery)
  const [offers, setOffers] = useState<Offer[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(Boolean(initialQuery))

  useEffect(() => {
    if (!query) return
    const controller = new AbortController()
    const params = new URLSearchParams({ q: query, category: "adult", condition: "new", site: "all", provider: "direct", pages: "1", limit: "30" })
    fetch(`/api/search/free?${params}`, { headers: { "x-libergent-adult-confirmation": token }, signal: controller.signal, cache: "no-store" })
      .then(async response => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || "Cautarea nu a reusit.")
        if (!controller.signal.aborted) setOffers((payload.results || []).flatMap((result: { site: string; items?: Offer[] }) =>
          (result.items || []).map(item => ({ ...item, site: result.site }))))
      }).catch(err => { if (!controller.signal.aborted) setError(err.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [query, token])

  return <main className="mx-auto max-w-4xl p-6 space-y-6">
    <h1 className="text-3xl font-bold">Produse de wellness sexual · 18+</h1>
    <p>Cauta produse, de exemplu Lovense. Compara preturile si verifica disponibilitatea la comerciant. Fara pornografie.</p>
    <form className="flex gap-3" onSubmit={event => {
      event.preventDefault()
      if (!input.trim() || input.trim() === query) return
      setOffers([]); setError(""); setLoading(true); setQuery(input.trim())
    }}>
      <label className="flex-1">Produs
        <input className="block w-full border border-black p-3" value={input} onChange={event => setInput(event.target.value)} maxLength={120} required />
      </label>
      <button className="border border-black px-4" disabled={loading}>Cauta</button>
    </form>
    <p>Rezultatele raman doar pe aceasta pagina. Salvarea, alertele si contactarea vanzatorilor nu sunt disponibile aici.</p>
    {loading && <p role="status">Cautare in curs…</p>}
    {error && <p role="alert">{error}</p>}
    {!loading && query && !error && !offers.length && <p>Nu am gasit oferte potrivite in sursele existente. Nu garantam acoperirea acestui produs.</p>}
    <ul className="space-y-4">{offers.map((offer, index) => <li key={`${offer.url}:${index}`} className="border border-black p-4">
      <h2 className="font-bold">{offer.title}</h2>
      <p>{offer.site} · {Number.isFinite(offer.priceRon) ? `${offer.priceRon} RON` : "Pret necunoscut"}</p>
      {/^https?:\/\//i.test(offer.url) && <a href={offer.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="underline">Vezi oferta la comerciant</a>}
    </li>)}</ul>
  </main>
}
