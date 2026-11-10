import type { SearchResultItem } from "./search-data"
import { buildBuyingComparison, type BuyingKind } from "./buying-comparison"

const kinds: { key: BuyingKind; label: string; note: string }[] = [
  { key: "new", label: "Nou din magazin", note: "Verifică stocul, garanția și livrarea." },
  { key: "refurbished", label: "Recondiționat", note: "Verifică gradul de uzură, bateria și garanția." },
  { key: "used", label: "De pe marketplace", note: "Verifică starea și probează produsul înainte de plată." },
]
const money = (value: number) => `${new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 }).format(value)} lei`

export function BuyingComparison({ reference, candidates, onInspect }: {
  reference: SearchResultItem
  candidates: SearchResultItem[]
  onInspect: (item: SearchResultItem) => void
}) {
  const { offers, counts, usedVsNew, usedVsRefurbished } = buildBuyingComparison(reference, candidates)
  return (
    <section aria-labelledby="buying-comparison-title" className="overflow-hidden border-2 border-[#171717] bg-[#fffdf5] text-[#171717]">
      <div className="border-b-2 border-[#171717] p-5 sm:p-6">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest">Compară înainte să cumperi</p>
        <h2 id="buying-comparison-title" className="text-xl font-bold sm:text-2xl">De unde merită să cumperi?</h2>
        <p className="mt-2 text-sm">Compară prețul din magazin cu ofertele recondiționate și cele de pe marketplace-uri.</p>
        <p className="mt-2 break-words text-xs text-black/65">Reper: {reference.title}</p>
      </div>
      <div className="grid gap-px bg-black/20 md:grid-cols-3">
        {kinds.map(({ key, label, note }) => {
          const item = offers[key]
          return (
            <article key={key} className="flex min-w-0 flex-col bg-white p-5 sm:p-6">
              <h3 className="text-xs font-bold uppercase">{label}</h3>
              {item ? <>
                <p className="mt-4 text-3xl font-bold tabular-nums">{money(item.price!)}</p>
                <p className="mt-1 text-xs">{item.source} · {item.condition}</p>
                <p className="mt-3 break-words text-sm">{item.title}</p>
                <p className="mt-2 text-[11px] text-black/60">Minimul dintre {counts[key]} {counts[key] === 1 ? "ofertă comparabilă" : "oferte comparabile"} din căutare.</p>
                <p className="my-4 text-xs text-black/70">{note}</p>
                <button type="button" onClick={() => onInspect(item)} className="mt-auto min-h-11 border border-black px-4 py-2 text-xs font-bold hover:bg-black hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4">Vezi oferta {label.toLowerCase()}</button>
              </> : <div className="py-5">
                <p className="text-lg font-bold">Fără ofertă comparabilă</p>
                <p className="mt-2 text-xs text-black/65">Nu am găsit un preț pentru aceeași variantă în rezultatele disponibile. Asta nu înseamnă că nu există în piață.</p>
              </div>}
            </article>
          )
        })}
      </div>
      <div className="space-y-2 border-t-2 border-[#171717] p-5 sm:p-6" aria-live="polite">
        <p className="text-sm font-bold">{usedVsNew
          ? usedVsNew.amount > 0 ? `Pe marketplace economisești ${money(usedVsNew.amount)} (${usedVsNew.percent}%) față de nou.`
            : usedVsNew.amount < 0 ? `Nou este cu ${money(-usedVsNew.amount)} mai ieftin decât oferta de pe marketplace.` : "Oferta nouă și cea de pe marketplace au același preț."
          : "Nu avem suficiente oferte comparabile pentru a confirma economia față de nou."}</p>
        {usedVsRefurbished && <p className="text-sm">{usedVsRefurbished.amount > 0
          ? `Recondiționat costă cu ${money(usedVsRefurbished.amount)} mai mult decât oferta de pe marketplace. Verifică dacă starea și garanția justifică diferența.`
          : usedVsRefurbished.amount < 0 ? `Recondiționat este cu ${money(-usedVsRefurbished.amount)} mai ieftin decât oferta de pe marketplace.` : "Oferta recondiționată și cea de pe marketplace au același preț."}</p>}
        <p className="text-[11px] leading-relaxed text-black/65">Potrivire după modelul și configurația din titlu, nu verificare fizică. Prețuri afișate în rezultatele acestei căutări, fără ajustări pentru livrare sau garanție. Sursele excluse sunt respectate; alternativele pot depăși bugetul sau filtrul de stare. Confirmă prețul final la vânzător.</p>
      </div>
    </section>
  )
}
