"use client"

import { Suspense, useState, useEffect, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { LogoIcon } from "@/components/LogoIcon"

// — Constants —
const CREAM  = "#F5F3EE"
const INK    = "#111111"
const PINK   = "#FF3366"
const GREEN  = "#22C55E"
const MONO   = "var(--font-mono-var), monospace"
const MODAL_BG = "#FDFAF3"

// — Static data —
const SOURCES_LIST = ["OLX", "VINTED", "LAJUMATE", "OKAZII", "PUBLI24", "AUTOVIT"]
const SORT_OPTIONS = ["relevanță", "preț crescător", "preț descrescător", "cel mai recent", "scor agent"]
const COND_OPTIONS = ["nou", "folosit", "ca nou", "bun", "acceptabil"]

const RESULTS = [
  { id: "02", title: "Dezmembrez Mercedes S320/S400/S500/S600", source: "OLX",     city: "Târgoviște",          price: 99,  score: 62 },
  { id: "03", title: "Dezmembrez Orice Piesă Din Auto",          source: "OLX",     city: "Târgoviște",          price: 99,  score: 62 },
  { id: "04", title: "Dezmembrez Hyundai Tucson 2006–2009",       source: "OLX",     city: "București, Sector 6", price: 100, score: 62 },
  { id: "05", title: "Dezmembrez Peugeot 307 1.6 Benzină",       source: "PUBLI24", city: "Timișoara, Timiș",    price: 100, score: 60 },
  { id: "06", title: "Dezmembrez BMW E46 316I 2002",              source: "PUBLI24", city: "Brașov",              price: 120, score: 59 },
  { id: "07", title: "Cutie Viteze Manuală VW Passat B6",         source: "OLX",     city: "Cluj-Napoca",         price: 150, score: 58 },
  { id: "08", title: "Motor 1.9 TDI BKC 105CP",                   source: "OLX",     city: "Iași",                price: 450, score: 57 },
  { id: "09", title: "Piesă Decorativă Din Ceramică",             source: "OKAZII",  city: "Constanța",           price: 45,  score: 56 },
]

const BREAKDOWN = [
  { name: "OLX",      count: 42, pct: 58 },
  { name: "PUBLI24",  count: 14, pct: 19 },
  { name: "OKAZII",   count:  9, pct: 12 },
  { name: "VINTED",   count:  5, pct:  7 },
  { name: "LAJUMATE", count:  3, pct:  4 },
]

const AGENT_NOTES = [
  { text: "18 duplicate listings removed",  pulse: false },
  { text: "4 suspicious listings filtered", pulse: false },
  { text: "Best price detected on OLX",     pulse: false },
  { text: "Recommendation updated live",    pulse: true  },
]

// — Loader config —
const SOURCE_TIMING = [
  { name: "OLX",      start: 0,  end: 25 },
  { name: "VINTED",   start: 5,  end: 40 },
  { name: "OKAZII",   start: 15, end: 55 },
  { name: "PUBLI24",  start: 30, end: 70 },
  { name: "LAJUMATE", start: 45, end: 85 },
  { name: "AUTOVIT",  start: 60, end: 100 },
]
const LOADER_STATUS = ["scanez...", "verific...", "indexez...", "compar..."]
const MAIN_BLOCKS   = 15
const SOURCE_BLOCKS = 10

// — Atoms —
function Arrow({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronDown({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ScoreBar({ score, total = 10 }: { score: number; total?: number }) {
  const filled = Math.round(total * score / 100)
  const h = total === 8 ? 6 : 12
  const w = total === 8 ? 6 : 8
  return (
    <div className="flex gap-[2px]">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: w, height: h,
            background: i < filled ? PINK : "transparent",
            border: `1px solid ${PINK}`,
          }}
        />
      ))}
    </div>
  )
}

// — Loading Overlay —
function LoadingOverlay({ progress, done }: { progress: number; done: boolean }) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 400)
    return () => clearInterval(id)
  }, [])

  const filledMain = Math.floor((progress / 100) * MAIN_BLOCKS)
  const step1 = progress > 30
  const step2 = progress > 60
  const step3 = progress > 90

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{
        background: "rgba(0,0,0,0.35)",
        opacity: done ? 0 : 1,
        transition: "opacity 0.5s ease",
        pointerEvents: done ? "none" : "auto",
      }}
    >
      <div
        style={{
          background: MODAL_BG,
          border: `1px solid ${INK}`,
          boxShadow: `4px 4px 0 0 ${INK}`,
          fontFamily: MONO,
          width: "100%",
          maxWidth: 520,
        }}
      >
        {/* Header */}
        <div
          className="flex justify-between items-center p-3 text-[13px] font-bold uppercase"
          style={{ borderBottom: `1px solid ${INK}`, background: MODAL_BG }}
        >
          <span>Live Search</span>
          <span className="tracking-widest text-[18px] leading-none">...</span>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-6" style={{ background: MODAL_BG }}>

          {/* Main status */}
          <p className="text-[13px] font-bold uppercase">
            {done ? "Căutare finalizată." : "Căutăm în marketplace-uri active..."}
          </p>

          {/* Source rows */}
          <div className="flex flex-col gap-2.5">
            {SOURCE_TIMING.map(({ name, start, end }) => {
              const lp = progress >= end ? 1 : progress <= start ? 0 : (progress - start) / (end - start)
              const filled = Math.floor(lp * SOURCE_BLOCKS)
              const isComplete = lp === 1
              const statusText = isComplete
                ? "gata"
                : lp > 0
                ? LOADER_STATUS[tick % LOADER_STATUS.length]
                : "standby"

              return (
                <div key={name} className="flex items-center text-[11px] w-full uppercase">
                  {/* Green dot */}
                  <div
                    className={`w-2 h-2 rounded-full mr-3 flex-none ${isComplete ? "" : "animate-pulse"}`}
                    style={{
                      background: GREEN,
                      boxShadow: isComplete ? "none" : `0 0 5px ${GREEN}`,
                    }}
                  />
                  {/* Name */}
                  <div className="font-bold" style={{ width: 76, flexShrink: 0 }}>{name}</div>
                  {/* Progress blocks */}
                  <div className="flex-1 flex gap-[2px]">
                    {Array.from({ length: SOURCE_BLOCKS }).map((_, i) => (
                      <div
                        key={i}
                        style={{
                          width: 10, height: 10,
                          background: i < filled ? PINK : "transparent",
                          border: `1px solid ${i < filled ? PINK : "#D2CFC6"}`,
                          transition: "background 0.1s, border-color 0.1s",
                        }}
                      />
                    ))}
                  </div>
                  {/* Status label */}
                  <div
                    style={{
                      width: 72,
                      textAlign: "right",
                      flexShrink: 0,
                      color: isComplete ? INK : "#A8A69E",
                      fontWeight: isComplete ? "bold" : "normal",
                    }}
                  >
                    {statusText}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Checklist */}
          <div
            className="flex justify-between items-center text-[10px] uppercase pt-4"
            style={{ borderTop: `1px dashed ${INK}55` }}
          >
            {[
              { label: "verific surse",    active: step1 },
              { label: "elimin duplicate", active: step2 },
              { label: "analizez prețuri", active: step3 },
            ].map(({ label, active }) => (
              <div
                key={label}
                className="flex items-center gap-1.5 transition-all duration-300"
                style={{ color: active ? INK : `${INK}44`, fontWeight: active ? "bold" : "normal" }}
              >
                <span style={{ color: active ? GREEN : `${INK}44`, fontSize: 13 }}>
                  {active ? "☑" : "○"}
                </span>
                {label}
              </div>
            ))}
          </div>

          {/* Main progress bar */}
          <div>
            <div className="text-[11px] font-bold uppercase mb-3">Progres Scanare</div>
            <div className="flex items-center gap-4">
              <div className="flex-1 flex gap-[3px]">
                {Array.from({ length: MAIN_BLOCKS }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 h-4"
                    style={{
                      background: i < filledMain ? PINK : "#E4E2DA",
                      transition: "background 0.1s",
                    }}
                  />
                ))}
              </div>
              <div
                className="text-[20px] font-bold"
                style={{ color: PINK, width: 52, textAlign: "right", flexShrink: 0 }}
              >
                {Math.floor(progress)}%
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="p-3 text-[11px] uppercase"
          style={{ borderTop: `1px solid ${INK}`, background: MODAL_BG }}
        >
          {done ? (
            <><span style={{ color: PINK }}>&gt;</span> rezultate pregătite. afișăm cele mai bune oferte.</>
          ) : (
            <><span style={{ color: PINK }}>&gt;</span> agent <span style={{ color: PINK }}>activ</span>. continuăm căutarea celor mai bune oferte.</>
          )}
        </div>
      </div>
    </div>
  )
}

// — SearchNav —
function SearchNav({ query }: { query: string }) {
  const router = useRouter()
  const [val, setVal] = useState(query)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const q = val.trim()
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <nav
      className="sticky top-0 z-50 px-6 py-4 flex items-center gap-5"
      style={{ background: CREAM, borderBottom: `1px solid ${INK}`, fontFamily: MONO }}
    >
      <Link href="/" className="flex items-center gap-2.5 flex-none">
        <LogoIcon size={20} />
        <span className="text-[14px] font-bold tracking-wider uppercase" style={{ color: INK }}>LiberGent</span>
      </Link>

      <form
        onSubmit={submit}
        className="flex-1 max-w-2xl flex"
        style={{ border: `1px solid ${INK}` }}
      >
        <input
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          className="flex-1 bg-white px-4 py-2.5 text-[13px] uppercase font-bold focus:outline-none"
          style={{ color: INK, fontFamily: MONO }}
        />
        <button
          type="submit"
          className="flex items-center gap-2 px-5 py-2.5 text-[12px] uppercase font-bold transition-colors duration-150"
          style={{ background: INK, color: CREAM, fontFamily: MONO, borderLeft: `1px solid ${INK}` }}
          onMouseEnter={(e) => (e.currentTarget.style.background = PINK)}
          onMouseLeave={(e) => (e.currentTarget.style.background = INK)}
        >
          Caută <Arrow size={13} />
        </button>
      </form>

      <div className="flex items-center gap-5 text-[12px] uppercase font-bold flex-none ml-auto">
        <Link href="#" className="opacity-60 hover:opacity-100 transition-opacity" style={{ color: INK }}>Trenduri</Link>
        <Link href="#" className="opacity-60 hover:opacity-100 transition-opacity" style={{ color: INK }}>Cont</Link>
        <div
          className="w-8 h-8 flex items-center justify-center cursor-pointer transition-colors duration-150"
          style={{ border: `1px solid ${INK}`, color: INK }}
          onMouseEnter={(e) => { const el = e.currentTarget; el.style.background = INK; el.style.color = "white" }}
          onMouseLeave={(e) => { const el = e.currentTarget; el.style.background = "transparent"; el.style.color = INK }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </nav>
  )
}

// — BottomBar —
function BottomBar() {
  const trackRef = useRef<HTMLDivElement>(null)
  const posRef   = useRef(0)
  const rafRef   = useRef<number>(0)

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const tick = () => {
      posRef.current -= 0.5
      const half = track.scrollWidth / 2
      if (posRef.current <= -half) posRef.current = 0
      track.style.transform = `translateX(${posRef.current}px)`
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const msg = "> agent activ. continuăm căutarea celor mai bune oferte pentru criteriile selectate... monitorizare live inițiată.      "

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-2.5"
      style={{ background: "white", borderTop: `1px solid ${INK}`, fontFamily: MONO }}
    >
      <div className="flex-1 overflow-hidden flex items-center">
        <div ref={trackRef} className="flex whitespace-nowrap">
          <span className="text-[11px] uppercase font-bold" style={{ color: INK }}>
            {msg}{msg}
          </span>
        </div>
      </div>
      <button
        className="flex-none ml-4 flex items-center gap-1 text-[11px] uppercase font-bold opacity-60 hover:opacity-100 transition-opacity"
        style={{ borderLeft: `1px solid ${INK}`, paddingLeft: 16, color: INK }}
      >
        Logs <ChevronDown />
      </button>
    </div>
  )
}

// — FilterPanel —
interface FilterPanelProps {
  sort: string; setSort: (v: string) => void
  sources: Set<string>; toggleSource: (v: string) => void
  conditions: Set<string>; toggleCondition: (v: string) => void
  priceMin: string; setPriceMin: (v: string) => void
  priceMax: string; setPriceMax: (v: string) => void
  onReset: () => void
}

function FilterPanel({ sort, setSort, sources, toggleSource, conditions, toggleCondition, priceMin, setPriceMin, priceMax, setPriceMax, onReset }: FilterPanelProps) {
  function Label({ children }: { children: React.ReactNode }) {
    return <h3 className="text-[10px] uppercase font-bold pb-1.5" style={{ borderBottom: `1px dashed ${INK}` }}>{children}</h3>
  }

  return (
    <aside className="w-full lg:w-64 flex-none flex flex-col" style={{ border: `1px solid ${INK}`, fontFamily: MONO }}>
      <div className="flex justify-between items-center p-3" style={{ background: "white", borderBottom: `1px solid ${INK}` }}>
        <h2 className="text-[14px] font-bold uppercase">Filters</h2>
        <svg width="14" height="4" viewBox="0 0 14 4" fill="none">
          <circle cx="2" cy="2" r="1.5" fill={INK} />
          <circle cx="7" cy="2" r="1.5" fill={INK} />
          <circle cx="12" cy="2" r="1.5" fill={INK} />
        </svg>
      </div>

      <div className="flex flex-col gap-6 p-4 flex-1" style={{ background: CREAM }}>
        <div className="flex flex-col gap-3">
          <Label>Sortare</Label>
          <div className="flex flex-col gap-2.5">
            {SORT_OPTIONS.map((opt) => (
              <label key={opt} className="flex items-center gap-3 cursor-pointer" onClick={() => setSort(opt)}>
                <div className="w-3.5 h-3.5 rounded-full border flex-none flex items-center justify-center" style={{ borderColor: INK, background: "white" }}>
                  {sort === opt && <div className="w-1.5 h-1.5 rounded-full" style={{ background: INK }} />}
                </div>
                <span className="text-[11px] lowercase">{opt}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Label>Surse</Label>
          <div className="flex flex-col gap-2.5">
            {SOURCES_LIST.map((src) => (
              <label key={src} className="flex items-center gap-3 cursor-pointer" onClick={() => toggleSource(src)}>
                <div className="w-3.5 h-3.5 border flex-none flex items-center justify-center" style={{ borderColor: INK, background: "white" }}>
                  {sources.has(src) && <div style={{ width: 7, height: 7, background: INK }} />}
                </div>
                <span className="text-[11px] uppercase font-bold">{src}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Label>Preț (RON)</Label>
          <div className="flex items-center gap-2">
            <input type="text" placeholder="MIN" value={priceMin} onChange={(e) => setPriceMin(e.target.value)}
              className="w-full text-[11px] p-2 text-center uppercase focus:outline-none placeholder:opacity-30"
              style={{ background: "white", border: `1px solid ${INK}`, fontFamily: MONO, color: INK }} />
            <span className="text-[11px] font-bold flex-none">—</span>
            <input type="text" placeholder="MAX" value={priceMax} onChange={(e) => setPriceMax(e.target.value)}
              className="w-full text-[11px] p-2 text-center uppercase focus:outline-none placeholder:opacity-30"
              style={{ background: "white", border: `1px solid ${INK}`, fontFamily: MONO, color: INK }} />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Label>Stare</Label>
          <div className="flex flex-col gap-2.5">
            {COND_OPTIONS.map((cond) => (
              <label key={cond} className="flex items-center gap-3 cursor-pointer" onClick={() => toggleCondition(cond)}>
                <div className="w-3.5 h-3.5 border flex-none flex items-center justify-center" style={{ borderColor: INK, background: "white" }}>
                  {conditions.has(cond) && <div style={{ width: 7, height: 7, background: INK }} />}
                </div>
                <span className="text-[11px] lowercase">{cond}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={onReset}
        className="flex justify-between items-center p-4 text-[11px] font-bold uppercase transition-colors duration-150"
        style={{ borderTop: `1px solid ${INK}`, color: INK }}
        onMouseEnter={(e) => { const el = e.currentTarget; el.style.background = INK; el.style.color = "white" }}
        onMouseLeave={(e) => { const el = e.currentTarget; el.style.background = CREAM; el.style.color = INK }}
      >
        Reset Filters
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M23 4v6h-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M1 20v-6h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </aside>
  )
}

// — ResultCard —
type ResultItem = typeof RESULTS[0]

function ResultCard({ item }: { item: ResultItem }) {
  const [hov, setHov] = useState(false)
  return (
    <article
      className="flex flex-col gap-4 p-4"
      style={{
        border: `1px solid ${INK}`, background: "white", fontFamily: MONO,
        transform: hov ? "translateY(-4px)" : "none",
        boxShadow: hov ? `4px 4px 0px ${INK}` : "none",
        transition: "transform 0.25s, box-shadow 0.25s",
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div className="flex justify-between items-start text-[11px] font-bold" style={{ color: INK }}>
        <span>#{item.id}</span><span>{item.source}</span>
      </div>
      <div className="flex-1">
        <h4 className="text-[12px] font-bold uppercase leading-snug mb-2 line-clamp-2" style={{ color: INK }}>{item.title}</h4>
        <p className="text-[10px] uppercase mb-3" style={{ color: `${INK}77` }}>{item.city}</p>
        <p className="text-[14px] font-bold" style={{ color: PINK }}>{item.price} RON</p>
      </div>
      <div className="flex items-center gap-2 text-[10px] uppercase font-bold pt-3" style={{ borderTop: `1px solid ${INK}22` }}>
        <span>Scor: <span style={{ color: `${INK}66` }}>{item.score}%</span></span>
        <ScoreBar score={item.score} total={8} />
      </div>
      <button
        className="w-full py-2 text-[10px] font-bold uppercase flex justify-center items-center gap-1 transition-colors duration-150"
        style={{ border: `1px solid ${INK}`, color: INK, fontFamily: MONO }}
        onMouseEnter={(e) => { e.currentTarget.style.background = INK; e.currentTarget.style.color = "white" }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = INK }}
      >
        Vezi Oferta <Arrow size={10} />
      </button>
    </article>
  )
}

function PanelHeader({ title }: { title: string }) {
  return (
    <div className="p-3 flex justify-between items-center" style={{ background: "white", borderBottom: `1px solid ${INK}` }}>
      <h2 className="text-[14px] font-bold uppercase">{title}</h2>
    </div>
  )
}

// — Main search results —
function SearchResultsContent() {
  const searchParams = useSearchParams()
  const query = searchParams.get("q") || "piesa"

  const [sort, setSort]             = useState(SORT_OPTIONS[0])
  const [sources, setSources]       = useState(() => new Set(SOURCES_LIST))
  const [conditions, setConditions] = useState<Set<string>>(() => new Set(["folosit"]))
  const [priceMin, setPriceMin]     = useState("")
  const [priceMax, setPriceMax]     = useState("")
  const [time, setTime]             = useState("")

  // Loader state
  const [showLoader, setShowLoader]       = useState(true)
  const [loaderProgress, setLoaderProgress] = useState(0)
  const [loaderDone, setLoaderDone]       = useState(false)
  const loaderTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Start/restart loader on each new query
  useEffect(() => {
    setShowLoader(true)
    setLoaderProgress(0)
    setLoaderDone(false)

    if (loaderTimerRef.current) clearInterval(loaderTimerRef.current)

    let prog = 0
    const DURATION = 6000
    const TICK     = 50
    const step     = (TICK / DURATION) * 100

    loaderTimerRef.current = setInterval(() => {
      prog += step
      if (prog >= 100) {
        prog = 100
        setLoaderProgress(100)
        clearInterval(loaderTimerRef.current!)
        loaderTimerRef.current = null
        setTimeout(() => {
          setLoaderDone(true)
          setTimeout(() => setShowLoader(false), 600)
        }, 800)
      } else {
        setLoaderProgress(prog)
      }
    }, TICK)

    return () => { if (loaderTimerRef.current) clearInterval(loaderTimerRef.current) }
  }, [query])

  useEffect(() => {
    const fmt = () => new Date().toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })
    setTime(fmt())
    const id = setInterval(() => setTime(fmt()), 30_000)
    return () => clearInterval(id)
  }, [])

  const toggleSource    = (s: string) => setSources(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n })
  const toggleCondition = (c: string) => setConditions(prev => { const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c); return n })
  const resetFilters    = () => { setSort(SORT_OPTIONS[0]); setSources(new Set(SOURCES_LIST)); setConditions(new Set()); setPriceMin(""); setPriceMax("") }

  return (
    <div className="flex flex-col flex-1 pb-14" style={{ background: CREAM, fontFamily: MONO, color: INK }}>

      {/* Loading overlay — rendered above everything */}
      {showLoader && <LoadingOverlay progress={loaderProgress} done={loaderDone} />}

      <SearchNav query={query} />

      {/* Session header */}
      <header
        className="px-6 py-4 flex flex-col sm:flex-row justify-between sm:items-end gap-4"
        style={{ borderBottom: `1px solid ${INK}`, background: CREAM }}
      >
        <div className="flex flex-col gap-1 text-[12px] uppercase font-bold">
          <span>Search Session Complete</span>
          <span>Query: <span style={{ color: PINK }}>"{query}"</span></span>
          <span style={{ color: PINK }}>73 Matches Found</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] uppercase font-bold px-3 py-1.5" style={{ background: "white", border: `1px solid ${INK}` }}>
          <div className="w-2 h-2 animate-pulse" style={{ background: "#22C55E" }} />
          <span>Live <span className="mx-2">|</span> 15 Mai 2026 / {time || "00:20"}</span>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 w-full max-w-[1800px] mx-auto px-6 py-6 flex flex-col lg:flex-row gap-6">

        <FilterPanel
          sort={sort} setSort={setSort}
          sources={sources} toggleSource={toggleSource}
          conditions={conditions} toggleCondition={toggleCondition}
          priceMin={priceMin} setPriceMin={setPriceMin}
          priceMax={priceMax} setPriceMax={setPriceMax}
          onReset={resetFilters}
        />

        <div className="flex-1 flex flex-col gap-6 min-w-0">

          {/* Search Report */}
          <section style={{ border: `1px solid ${INK}` }}>
            <PanelHeader title="Search Report" />
            <div className="grid grid-cols-2 md:grid-cols-5" style={{ background: "white" }}>
              {[
                { value: "73",  label: "Results" },
                { value: "68%", label: "Avg Score" },
                { value: "6",   label: "Sources" },
                { value: "18",  label: "Duplicates Removed" },
              ].map(({ value, label }) => (
                <div key={label} className="p-4 flex flex-col items-center justify-center gap-1" style={{ borderRight: `1px solid ${INK}` }}>
                  <span className="text-[20px] font-bold" style={{ color: PINK }}>{value}</span>
                  <span className="text-[10px] uppercase font-bold text-center">{label}</span>
                </div>
              ))}
              <div className="p-4 flex flex-col items-center justify-center gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 animate-pulse" style={{ background: GREEN }} />
                  <span className="text-[10px] uppercase font-bold">Updated Live</span>
                </div>
                <span className="text-[11px] uppercase font-bold">{time || "00:20"}</span>
              </div>
            </div>
          </section>

          {/* Agent Recommendation */}
          <div
            className="hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
            style={{
              background: "linear-gradient(135deg, #111111 0%, #333333 50%, #111111 100%)",
              padding: 1,
              boxShadow: `4px 4px 0px ${INK}`,
            }}
          >
            <div style={{ background: CREAM }}>
              <PanelHeader title="Agent Recommendation" />
              <div className="flex flex-col md:flex-row">
                <div className="w-full md:w-2/5 relative overflow-hidden" style={{ minHeight: 256, background: "#DDD9CE", borderRight: `1px solid ${INK}` }}>
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 256" preserveAspectRatio="xMidYMid slice" fill="none">
                    <defs>
                      <pattern id="srch-grid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                        <path d="M 20 0 L 0 0 0 20" stroke={INK} strokeWidth="0.4" opacity="0.2" fill="none" />
                      </pattern>
                    </defs>
                    <rect width="400" height="256" fill="url(#srch-grid)" />
                    <circle cx="200" cy="128" r="66" stroke={INK} strokeWidth="0.75" opacity="0.2" />
                    <circle cx="200" cy="128" r="44" stroke={INK} strokeWidth="0.75" opacity="0.2" />
                    <circle cx="200" cy="128" r="9" fill={INK} opacity="0.18" />
                    <line x1="200" y1="78" x2="200" y2="119" stroke={INK} strokeWidth="0.75" opacity="0.25" />
                    <line x1="200" y1="137" x2="200" y2="178" stroke={INK} strokeWidth="0.75" opacity="0.25" />
                    <line x1="150" y1="128" x2="191" y2="128" stroke={INK} strokeWidth="0.75" opacity="0.25" />
                    <line x1="209" y1="128" x2="250" y2="128" stroke={INK} strokeWidth="0.75" opacity="0.25" />
                    <rect x="8" y="8" width="20" height="1" fill={INK} opacity="0.3" />
                    <rect x="8" y="8" width="1" height="20" fill={INK} opacity="0.3" />
                    <rect x="372" y="8" width="20" height="1" fill={INK} opacity="0.3" />
                    <rect x="391" y="8" width="1" height="20" fill={INK} opacity="0.3" />
                  </svg>
                  <div className="absolute top-4 left-4 flex flex-col px-3 py-1.5" style={{ background: PINK, color: "white", fontFamily: MONO }}>
                    <span className="text-[10px] font-bold tracking-widest">#01</span>
                    <span className="text-[13px] font-bold uppercase">Agent Pick</span>
                  </div>
                </div>
                <div className="flex-1 p-6 md:p-8 flex flex-col justify-between" style={{ background: "white" }}>
                  <div>
                    <h3 className="text-[22px] font-bold uppercase tracking-tight mb-2">Piesă Decorativă</h3>
                    <p className="text-[11px] uppercase font-bold mb-6" style={{ color: `${INK}55` }}>PUBLI24 / Cernavodă, Constanța</p>
                    <div className="text-[22px] font-bold mb-8" style={{ color: PINK }}>65 RON</div>
                  </div>
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                      <span className="text-[11px] uppercase font-bold w-24">Scor Agent:</span>
                      <ScoreBar score={64} total={10} />
                      <span className="text-[13px] font-bold ml-2" style={{ color: PINK }}>64%</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[11px] uppercase font-bold w-24">Condiție:</span>
                      <span className="text-[11px] uppercase font-bold px-2 py-0.5" style={{ background: INK, color: "white" }}>Acceptabil</span>
                    </div>
                  </div>
                  <div className="mt-8 flex justify-end">
                    <button
                      className="flex items-center gap-2 px-6 py-3 text-[12px] font-bold uppercase transition-all duration-150"
                      style={{ border: `1px solid ${INK}`, color: INK, fontFamily: MONO, boxShadow: `2px 2px 0px ${INK}` }}
                      onMouseEnter={(e) => { const el = e.currentTarget; el.style.background = INK; el.style.color = "white"; el.style.transform = "translateY(-2px)" }}
                      onMouseLeave={(e) => { const el = e.currentTarget; el.style.background = "transparent"; el.style.color = INK; el.style.transform = "none" }}
                    >
                      Vezi Oferta <Arrow size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Results + Insights */}
          <div className="flex flex-col xl:flex-row gap-6 items-start">
            <div className="flex-1 w-full min-w-0">
              <div className="flex justify-between items-end mb-4 px-1">
                <h2 className="text-[14px] font-bold uppercase">Top Results</h2>
                <div className="flex items-center gap-2 text-[11px]">
                  <span style={{ color: `${INK}66` }}>Sortare după:</span>
                  <button className="font-bold uppercase flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity" style={{ color: INK }}>
                    Scor Agent <ChevronDown />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {RESULTS.map((item) => <ResultCard key={item.id} item={item} />)}
              </div>
            </div>

            <aside className="w-full xl:w-72 flex-none flex flex-col gap-6">
              <div style={{ border: `1px solid ${INK}`, fontFamily: MONO }}>
                <PanelHeader title="Agent Notes" />
                <ul className="p-4 flex flex-col gap-4" style={{ background: CREAM }}>
                  {AGENT_NOTES.map(({ text, pulse }) => (
                    <li key={text} className={`flex items-start gap-2 text-[11px] uppercase font-bold${pulse ? " animate-pulse" : ""}`}>
                      <span style={{ color: PINK }} className="flex-none mt-0.5">&gt;</span>
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div style={{ border: `1px solid ${INK}`, fontFamily: MONO }}>
                <PanelHeader title="Sources Breakdown" />
                <div className="p-4 flex flex-col gap-3" style={{ background: CREAM }}>
                  {BREAKDOWN.map(({ name, count, pct }) => (
                    <div key={name} className="flex items-center gap-2 text-[11px] uppercase font-bold">
                      <span style={{ width: 64, flexShrink: 0 }}>{name}</span>
                      <div className="flex-1 h-2 mx-1" style={{ background: "#E5E0D5" }}>
                        <div className="h-full" style={{ width: `${pct}%`, background: PINK }} />
                      </div>
                      <span className="text-right" style={{ width: 76, flexShrink: 0, color: `${INK}77` }}>{count} ({pct}%)</span>
                    </div>
                  ))}
                </div>
                <div className="p-3 flex justify-between items-center" style={{ borderTop: `1px solid ${INK}`, background: "white" }}>
                  <span className="text-[11px] uppercase font-bold">Total</span>
                  <span className="text-[14px] font-bold" style={{ color: PINK }}>73</span>
                </div>
              </div>
            </aside>
          </div>

        </div>
      </main>

      <BottomBar />
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: CREAM, fontFamily: MONO }}>
      <div className="text-[12px] uppercase tracking-widest" style={{ color: PINK }}>&gt; Căutare în curs...</div>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SearchResultsContent />
    </Suspense>
  )
}
