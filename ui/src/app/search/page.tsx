"use client"

import { Suspense, useState, useEffect, useMemo, useRef, type ReactNode } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { CalendarDays, MapPin, Tag } from "lucide-react"
import { LogoIcon } from "@/components/LogoIcon"
import { EmailCapturePopup } from "@/components/EmailCapturePopup"
import { mapBestOffer, mapSearchResults, type SearchPayload, type SearchResultItem } from "./search-data"

// — Constants —
const CREAM  = "#F5F3EE"
const INK    = "#111111"
const PINK   = "#FF3366"
const GREEN  = "#22C55E"
const MONO   = "var(--font-mono-var), monospace"
const MODAL_BG = "#FDFAF3"

const SOURCES_LIST = ["OLX", "VINTED", "LAJUMATE", "OKAZII", "PUBLI24", "ANUNTUL", "AUTOVIT"]
const SORT_OPTIONS = ["relevanță", "preț crescător", "preț descrescător", "cel mai recent", "scor agent"]
const COND_OPTIONS = ["nou", "folosit", "ca nou", "bun", "acceptabil"]

type MarketplaceStatus = {
  successful: number
  total: number
  failed: string[]
  blocked: string[]
}

// — Loader config —
const SOURCE_TIMING = [
  { name: "OLX",      start: 0,  end: 22 },
  { name: "VINTED",   start: 4,  end: 36 },
  { name: "OKAZII",   start: 12, end: 50 },
  { name: "PUBLI24",  start: 24, end: 63 },
  { name: "ANUNTUL",  start: 36, end: 76 },
  { name: "LAJUMATE", start: 48, end: 88 },
  { name: "AUTOVIT",  start: 62, end: 100 },
]
const LOADER_STATUS = ["scanez...", "verific...", "indexez...", "compar..."]
const MAIN_BLOCKS   = 15
const SOURCE_BLOCKS = 10
const SEARCH_RESULT_LIMIT = 180
const SEARCH_PAGE_LIMIT = 2
const INITIAL_VISIBLE_RESULTS = 48
const VISIBLE_RESULT_STEP = 48

function shouldOpenFiltersByDefault() {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches
}

function formatSearchTime() {
  return new Date().toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })
}

function formatDateTime(value = "") {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "în timp real"
  return new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeStyle: "short" }).format(parsed)
}

function priceForSort(item: SearchResultItem, fallback: number) {
  return Number.isFinite(item.price) ? Number(item.price) : fallback
}

function compareByRank(a: SearchResultItem, b: SearchResultItem) {
  const aRank = typeof a.rank === "number" ? a.rank : Number.POSITIVE_INFINITY
  const bRank = typeof b.rank === "number" ? b.rank : Number.POSITIVE_INFINITY
  return aRank - bRank || b.score - a.score
}

async function readJsonResponse(response: Response): Promise<SearchPayload> {
  const body = await response.text()
  if (!body.trim()) return {}

  try {
    return JSON.parse(body) as SearchPayload
  } catch {
    const looksLikeHtml = /^\s*</.test(body)
    throw new Error(
      looksLikeHtml
        ? "API-ul de căutare a returnat HTML în loc de JSON. Reîncarcă pagina și încearcă din nou."
        : "API-ul de căutare a returnat un răspuns JSON invalid."
    )
  }
}

function isGreatAgentDeal(item: SearchResultItem) {
  return item.score > 90
}

function getAgentScoreExplanation(item: SearchResultItem) {
  const reasons = [`scor agent ${item.score}%`]

  if (typeof item.rank === "number" && item.rank <= 3) {
    reasons.push(`top ${item.rank} în rezultate`)
  }
  if (item.price !== null) {
    reasons.push(`preț valid: ${item.priceLabel}`)
  }
  if (item.condition && item.condition.toLowerCase() !== "necunoscut") {
    reasons.push(`condiție ${item.condition.toLowerCase()}`)
  }

  reasons.push(`sursă verificată: ${item.source}`)
  return reasons.join(" · ")
}

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

function AgentScoreBadge({ item, compact = false }: { item: SearchResultItem; compact?: boolean }) {
  if (!isGreatAgentDeal(item)) return null

  return (
    <span
      className={`inline-flex items-center justify-center font-bold uppercase ${compact ? "px-2 py-1 text-[9px]" : "px-3 py-1.5 text-[10px]"}`}
      title={getAgentScoreExplanation(item)}
      style={{
        background: GREEN,
        border: `1px solid ${INK}`,
        boxShadow: `2px 2px 0 ${INK}`,
        color: INK,
        fontFamily: MONO,
      }}
    >
      Deal foarte bun
    </span>
  )
}

function MetaChip({ children, icon, tone = "light" }: { children: ReactNode; icon?: ReactNode; tone?: "dark" | "light" | "muted" }) {
  const isDark = tone === "dark"

  return (
    <span
      className="inline-flex max-w-full min-w-0 items-center gap-1.5 px-2 py-1 text-[9px] font-bold uppercase leading-none"
      style={{
        background: isDark ? INK : tone === "muted" ? "#F1EEE6" : CREAM,
        border: `1px solid ${isDark ? INK : `${INK}33`}`,
        color: isDark ? "white" : tone === "muted" ? `${INK}77` : INK,
        letterSpacing: 0,
      }}
    >
      {icon && <span className="flex-none opacity-80">{icon}</span>}
      <span className="truncate">{children}</span>
    </span>
  )
}

function ListingMetaChips({ item }: { item: SearchResultItem }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <MetaChip icon={<MapPin size={10} strokeWidth={2.2} />}>{item.city}</MetaChip>
      <MetaChip tone="dark" icon={<Tag size={10} strokeWidth={2.2} />}>{item.condition}</MetaChip>
      <MetaChip tone="muted" icon={<CalendarDays size={10} strokeWidth={2.2} />}>{item.postedDateLabel}</MetaChip>
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

  useEffect(() => {
    const id = setTimeout(() => setVal(query), 0)
    return () => clearTimeout(id)
  }, [query])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const q = val.trim()
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <nav
      className="sticky top-0 z-50 px-4 py-3 sm:px-6 sm:py-4 flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-5"
      style={{ background: CREAM, borderBottom: `1px solid ${INK}`, fontFamily: MONO }}
    >
      <Link href="/" className="flex items-center gap-2.5 flex-none">
        <LogoIcon size={20} />
        <span className="text-[14px] font-bold tracking-wider uppercase" style={{ color: INK }}>LiberGent</span>
      </Link>

      <form
        onSubmit={submit}
        className="order-3 w-full max-w-none flex min-w-0 items-stretch sm:order-none sm:w-auto sm:flex-1 sm:max-w-2xl"
        style={{ border: `1px solid ${INK}` }}
      >
        <input
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          className="h-11 min-w-0 flex-1 bg-white px-3 sm:px-4 text-[13px] uppercase font-bold focus:outline-none"
          style={{ color: INK, fontFamily: MONO }}
        />
        <button
          type="submit"
          className="flex h-11 shrink-0 items-center justify-center gap-1.5 px-3 sm:gap-2 sm:px-5 text-[12px] uppercase font-bold transition-colors duration-150"
          style={{ background: INK, color: CREAM, fontFamily: MONO, borderLeft: `1px solid ${INK}` }}
          onMouseEnter={(e) => (e.currentTarget.style.background = PINK)}
          onMouseLeave={(e) => (e.currentTarget.style.background = INK)}
        >
          Caută <Arrow size={13} />
        </button>
      </form>

      <div className="flex items-center gap-5 text-[12px] uppercase font-bold flex-none ml-auto">
        <Link href="/trenduri" className="opacity-60 hover:opacity-100 transition-opacity" style={{ color: INK }}>Trenduri</Link>
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
  canClose: boolean
  onClose: () => void
}

function FilterLabel({ children }: { children: ReactNode }) {
  return <h3 className="text-[10px] uppercase font-bold pb-1.5" style={{ borderBottom: `1px dashed ${INK}` }}>{children}</h3>
}

function FilterPanel({ sort, setSort, sources, toggleSource, conditions, toggleCondition, priceMin, setPriceMin, priceMax, setPriceMax, onReset, canClose, onClose }: FilterPanelProps) {
  return (
    <aside className="w-full lg:w-64 flex-none flex flex-col" style={{ border: `1px solid ${INK}`, fontFamily: MONO }}>
      <div className="flex justify-between items-center p-3" style={{ background: "white", borderBottom: `1px solid ${INK}` }}>
        <h2 className="text-[14px] font-bold uppercase">Filters</h2>
        <button
          type="button"
          disabled={!canClose}
          onClick={onClose}
          aria-label="Close filters"
          className="h-7 w-7 flex items-center justify-center transition-opacity"
          style={{ border: `1px solid ${INK}`, color: INK, opacity: canClose ? 1 : 0.35, cursor: canClose ? "pointer" : "not-allowed" }}
          title={canClose ? "Close filters" : "Filters can be closed after search completes"}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col gap-6 p-4 flex-1" style={{ background: CREAM }}>
        <div className="flex flex-col gap-3">
          <FilterLabel>Sortare</FilterLabel>
          <div className="flex flex-col gap-2.5">
            {SORT_OPTIONS.map((opt) => (
              <label key={opt} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="sort"
                  value={opt}
                  checked={sort === opt}
                  onChange={() => setSort(opt)}
                  className="sr-only"
                />
                <div className="w-3.5 h-3.5 rounded-full border flex-none flex items-center justify-center" style={{ borderColor: INK, background: "white" }}>
                  {sort === opt && <div className="w-1.5 h-1.5 rounded-full" style={{ background: INK }} />}
                </div>
                <span className="text-[11px] lowercase">{opt}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <FilterLabel>Surse</FilterLabel>
          <div className="flex flex-col gap-2.5">
            {SOURCES_LIST.map((src) => (
              <label key={src} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sources.has(src)}
                  onChange={() => toggleSource(src)}
                  className="sr-only"
                />
                <div className="w-3.5 h-3.5 border flex-none flex items-center justify-center" style={{ borderColor: INK, background: "white" }}>
                  {sources.has(src) && <div style={{ width: 7, height: 7, background: INK }} />}
                </div>
                <span className="text-[11px] uppercase font-bold">{src}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <FilterLabel>Preț (RON)</FilterLabel>
          <div className="flex items-center gap-2">
            <input type="number" min="0" inputMode="numeric" placeholder="MIN" value={priceMin} onChange={(e) => setPriceMin(e.target.value)}
              className="w-full text-[11px] p-2 text-center uppercase focus:outline-none placeholder:opacity-30"
              style={{ background: "white", border: `1px solid ${INK}`, fontFamily: MONO, color: INK }} />
            <span className="text-[11px] font-bold flex-none">—</span>
            <input type="number" min="0" inputMode="numeric" placeholder="MAX" value={priceMax} onChange={(e) => setPriceMax(e.target.value)}
              className="w-full text-[11px] p-2 text-center uppercase focus:outline-none placeholder:opacity-30"
              style={{ background: "white", border: `1px solid ${INK}`, fontFamily: MONO, color: INK }} />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <FilterLabel>Stare</FilterLabel>
          <div className="flex flex-col gap-2.5">
            {COND_OPTIONS.map((cond) => (
              <label key={cond} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={conditions.has(cond)}
                  onChange={() => toggleCondition(cond)}
                  className="sr-only"
                />
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
type ResultItem = SearchResultItem

function useListingImage(item: SearchResultItem) {
  const images = useMemo(() => {
    const values = item.images.length ? item.images : item.image ? [item.image] : []
    return [...new Set(values.filter(Boolean))]
  }, [item.image, item.images])
  const [imageState, setImageState] = useState({ itemId: item.id, imageIndex: 0, failed: false })
  const activeState = imageState.itemId === item.id
    ? imageState
    : { itemId: item.id, imageIndex: 0, failed: false }
  const activeIndex = Math.min(activeState.imageIndex, Math.max(images.length - 1, 0))

  function handleImageError() {
    setImageState((current) => {
      const base = current.itemId === item.id
        ? current
        : { itemId: item.id, imageIndex: 0, failed: false }
      if (base.imageIndex + 1 < images.length) {
        return { ...base, imageIndex: base.imageIndex + 1 }
      }
      return { ...base, failed: true }
    })
  }

  return {
    image: activeState.failed ? undefined : images[activeIndex],
    handleImageError,
  }
}

function ResultCard({ item }: { item: ResultItem }) {
  const [hov, setHov] = useState(false)
  const { image, handleImageError } = useListingImage(item)
  const cardStyle = {
    border: `1px solid ${INK}`,
    background: "white",
    fontFamily: MONO,
    transform: hov ? "translateY(-4px)" : "none",
    boxShadow: hov ? `4px 4px 0px ${INK}` : "none",
    transition: "transform 0.25s, box-shadow 0.25s",
  }
  const content = (
    <>
      {image ? (
        <div className="relative aspect-[4/3] overflow-hidden" style={{ borderBottom: `1px solid ${INK}`, background: "#DDD9CE" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt={item.title} className="h-full w-full object-cover" onError={handleImageError} />
          <div className="absolute left-3 top-3">
            <AgentScoreBadge item={item} compact />
          </div>
        </div>
      ) : (
        <div className="relative aspect-[4/3] overflow-hidden flex items-center justify-center" style={{ borderBottom: `1px solid ${INK}`, background: "#DDD9CE" }}>
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 320 240" preserveAspectRatio="none" fill="none">
            <defs>
              <pattern id={`result-grid-${item.id.replace(/[^a-zA-Z0-9]/g, "-")}`} x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
                <path d="M 16 0 L 0 0 0 16" stroke={INK} strokeWidth="0.5" opacity="0.18" fill="none" />
              </pattern>
            </defs>
            <rect width="320" height="240" fill={`url(#result-grid-${item.id.replace(/[^a-zA-Z0-9]/g, "-")})`} />
            <circle cx="160" cy="120" r="34" stroke={INK} strokeWidth="1" opacity="0.22" />
            <path d="M144 120h32M160 104v32" stroke={INK} strokeWidth="1" opacity="0.28" />
          </svg>
          <div className="absolute left-3 top-3">
            <AgentScoreBadge item={item} compact />
          </div>
        </div>
      )}
      <div className="flex flex-col gap-4 p-4 flex-1">
        <div className="flex justify-between items-start text-[11px] font-bold" style={{ color: INK }}>
          <span>#{item.rank ?? item.id.slice(0, 2).toUpperCase()}</span><span>{item.source}</span>
        </div>
        <div className="flex-1">
          <h4 className="text-[12px] font-bold uppercase leading-snug mb-2 line-clamp-2" style={{ color: INK }}>{item.title}</h4>
          <div className="mb-3">
            <ListingMetaChips item={item} />
          </div>
          <p className="text-[14px] font-bold" style={{ color: PINK }}>{item.priceLabel}</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] uppercase font-bold pt-3" style={{ borderTop: `1px solid ${INK}22` }}>
          <span>Scor: <span style={{ color: `${INK}66` }}>{item.score}%</span></span>
          <ScoreBar score={item.score} total={8} />
        </div>
        <span
          className="w-full py-2 text-[10px] font-bold uppercase flex justify-center items-center gap-1 transition-colors duration-150"
          style={{ border: `1px solid ${INK}`, color: INK, fontFamily: MONO }}
        >
          Vezi Oferta <Arrow size={10} />
        </span>
      </div>
    </>
  )

  if (!item.url) {
    return (
      <div
        aria-disabled="true"
        className="flex flex-col overflow-hidden opacity-70"
        style={cardStyle}
      >
        {content}
      </div>
    )
  }

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col overflow-hidden"
      style={cardStyle}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {content}
    </a>
  )
}

function PanelHeader({ title }: { title: string }) {
  return (
    <div className="p-3 flex justify-between items-center" style={{ background: "white", borderBottom: `1px solid ${INK}` }}>
      <h2 className="text-[14px] font-bold uppercase">{title}</h2>
    </div>
  )
}

function RecommendationCard({ item }: { item: SearchResultItem }) {
  const { image, handleImageError } = useListingImage(item)

  return (
    <div
      className="hover:-translate-y-0.5 transition-all duration-300"
      style={{
        background: "linear-gradient(135deg, #111111 0%, #333333 50%, #111111 100%)",
        padding: 1,
        boxShadow: `4px 4px 0px ${INK}`,
      }}
    >
      <div style={{ background: CREAM }}>
        <PanelHeader title="LiberGent Recommends" />
        <div className="flex flex-col md:flex-row">
          <div className="w-full md:w-2/5 relative overflow-hidden" style={{ minHeight: 256, background: "#DDD9CE", borderRight: `1px solid ${INK}` }}>
            {image ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt={item.title} className="absolute inset-0 h-full w-full object-cover" onError={handleImageError} />
                <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.08)" }} />
              </>
            ) : (
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
              </svg>
            )}
            <div className="absolute top-4 left-4 px-3 py-1.5" style={{ background: PINK, color: "white", fontFamily: MONO }}>
              <span className="text-[13px] font-bold uppercase">#1</span>
            </div>
            <div className="absolute top-4 right-4">
              <AgentScoreBadge item={item} />
            </div>
          </div>
          <div className="flex-1 p-6 md:p-8 flex flex-col justify-between" style={{ background: "white" }}>
            <div>
              <div className="flex flex-col gap-3 mb-2">
                <AgentScoreBadge item={item} />
                <h3 className="text-[22px] font-bold uppercase tracking-tight">{item.title}</h3>
              </div>
              <div className="mb-6 flex flex-wrap gap-2">
                <MetaChip>{item.source}</MetaChip>
                <MetaChip icon={<MapPin size={10} strokeWidth={2.2} />}>{item.city}</MetaChip>
              </div>
              <div className="text-[22px] font-bold mb-8" style={{ color: PINK }}>{item.priceLabel}</div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <span className="text-[11px] uppercase font-bold w-24">Scor Agent:</span>
                <ScoreBar score={item.score} total={10} />
                <span className="text-[13px] font-bold ml-2" style={{ color: PINK }}>{item.score}%</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[11px] uppercase font-bold w-24">Condiție:</span>
                <span className="text-[11px] uppercase font-bold px-2 py-0.5" style={{ background: INK, color: "white" }}>
                  {item.condition}
                </span>
              </div>
            </div>
            <div className="mt-8 flex justify-end">
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-6 py-3 text-[12px] font-bold uppercase transition-all duration-150"
                  style={{ border: `1px solid ${INK}`, color: INK, fontFamily: MONO, boxShadow: `2px 2px 0px ${INK}` }}
                >
                  Vezi Oferta <Arrow size={16} />
                </a>
              ) : (
                <span
                  aria-disabled="true"
                  className="flex items-center gap-2 px-6 py-3 text-[12px] font-bold uppercase opacity-60"
                  style={{ border: `1px solid ${INK}`, color: INK, fontFamily: MONO }}
                >
                  Fără link direct
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// — Main search results —
function SearchResultsContent() {
  const searchParams = useSearchParams()
  const query = String(searchParams.get("q") || "").trim()

  const [sort, setSort]             = useState(SORT_OPTIONS[0])
  const [sources, setSources]       = useState(() => new Set(SOURCES_LIST))
  const [conditions, setConditions] = useState<Set<string>>(() => new Set())
  const [priceMin, setPriceMin]     = useState("")
  const [priceMax, setPriceMax]     = useState("")
  const [time, setTime]             = useState(() => formatSearchTime())
  const [results, setResults]       = useState<SearchResultItem[]>([])
  const [bestOffer, setBestOffer]   = useState<SearchResultItem | null>(null)
  const [error, setError]           = useState("")
  const [searchedAt, setSearchedAt] = useState("")
  const [totalListings, setTotalListings] = useState(0)
  const [parsedListings, setParsedListings] = useState(0)
  const [excludedListings, setExcludedListings] = useState(0)
  const [marketplaceStatus, setMarketplaceStatus] = useState<MarketplaceStatus>({ successful: 0, total: 0, failed: [], blocked: [] })
  const [isLoading, setIsLoading]   = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [searchReportOpen, setSearchReportOpen] = useState(true)
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_RESULTS)

  // Loader state
  const [showLoader, setShowLoader]       = useState(false)
  const [loaderProgress, setLoaderProgress] = useState(0)
  const [loaderDone, setLoaderDone]       = useState(false)
  const loaderTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const searchId = setTimeout(() => {
      setFiltersOpen(shouldOpenFiltersByDefault())
      if (!query) {
        setResults([])
        setBestOffer(null)
        setError("")
        setSearchedAt("")
        setTotalListings(0)
        setParsedListings(0)
        setExcludedListings(0)
        setMarketplaceStatus({ successful: 0, total: 0, failed: [], blocked: [] })
        setIsLoading(false)
        setShowLoader(false)
        setLoaderProgress(0)
        setLoaderDone(false)
        return
      }

      setIsLoading(true)
      setShowLoader(true)
      setSearchReportOpen(true)
      setVisibleCount(INITIAL_VISIBLE_RESULTS)
      setLoaderProgress(8)
      setLoaderDone(false)
      setError("")

      let prog = 0
      const TICK = 250

      if (loaderTimerRef.current) clearInterval(loaderTimerRef.current)
      loaderTimerRef.current = setInterval(() => {
        prog = Math.min(94, prog + Math.max(1, Math.round((96 - prog) * 0.08)))
        setLoaderProgress(prog)
      }, TICK)

      const params = new URLSearchParams({
        q: query,
        site: "all",
        provider: "auto",
        limit: String(SEARCH_RESULT_LIMIT),
        pages: String(SEARCH_PAGE_LIMIT),
      })

      fetch(`/api/search?${params.toString()}`, { signal: controller.signal })
        .then(async (response) => {
          const payload = await readJsonResponse(response)
          if (!response.ok || payload.error) {
            throw new Error(payload.error || "Căutarea nu a putut fi finalizată.")
          }

          const mapped = mapSearchResults(payload).slice(0, SEARCH_RESULT_LIMIT)
          setResults(mapped)
          setBestOffer(mapBestOffer(payload, mapped))
          setSearchedAt(payload.summary?.searchedAt || "")
          setTotalListings(payload.summary?.totalListings ?? mapped.length)
          setParsedListings(payload.summary?.parsedListings ?? payload.summary?.totalListings ?? mapped.length)
          setExcludedListings(payload.summary?.excludedListings ?? 0)
          setMarketplaceStatus({
            successful: payload.summary?.successfulMarketplaces ?? (payload.results || []).filter((result) => result.ok).length,
            total: payload.summary?.marketplaces ?? (payload.results || []).length,
            failed: (payload.results || [])
              .filter((result) => !result.ok)
              .map((result) => (result.site || "marketplace").toUpperCase()),
            blocked: (payload.summary?.blockedMarketplaces || []).map((site) => site.toUpperCase()),
          })
        })
        .catch((searchError) => {
          if (controller.signal.aborted) return
          setResults([])
          setBestOffer(null)
          setSearchedAt("")
          setTotalListings(0)
          setParsedListings(0)
          setExcludedListings(0)
          setError(searchError instanceof Error ? searchError.message : String(searchError))
          setMarketplaceStatus({ successful: 0, total: 0, failed: [], blocked: [] })
        })
        .finally(() => {
          if (controller.signal.aborted) return
          if (loaderTimerRef.current) {
            clearInterval(loaderTimerRef.current)
            loaderTimerRef.current = null
          }
          setLoaderProgress(100)
          setTimeout(() => {
            setLoaderDone(true)
            setSearchReportOpen(false)
            setTimeout(() => {
              setShowLoader(false)
              setIsLoading(false)
            }, 600)
          }, 250)
        })
    }, 0)

    return () => {
      clearTimeout(searchId)
      controller.abort()
      if (loaderTimerRef.current) clearInterval(loaderTimerRef.current)
    }
  }, [query])

  useEffect(() => {
    const id = setInterval(() => setTime(formatSearchTime()), 30_000)
    return () => clearInterval(id)
  }, [])

  const resetVisibleResults = () => setVisibleCount(INITIAL_VISIBLE_RESULTS)
  const updateSort = (value: string) => { setSort(value); resetVisibleResults() }
  const updatePriceMin = (value: string) => { setPriceMin(value); resetVisibleResults() }
  const updatePriceMax = (value: string) => { setPriceMax(value); resetVisibleResults() }
  const toggleSource    = (s: string) => { setSources(prev => { const n = new Set(prev); if (n.has(s)) n.delete(s); else n.add(s); return n }); resetVisibleResults() }
  const toggleCondition = (c: string) => { setConditions(prev => { const n = new Set(prev); if (n.has(c)) n.delete(c); else n.add(c); return n }); resetVisibleResults() }
  const resetFilters    = () => { setSort(SORT_OPTIONS[0]); setSources(new Set(SOURCES_LIST)); setConditions(new Set()); setPriceMin(""); setPriceMax(""); resetVisibleResults() }

  const filteredResults = useMemo(() => {
    const base = results.filter((item) => {
      if (sources.size > 0 && !sources.has(item.source)) return false
      if (conditions.size > 0 && !conditions.has(item.condition.toLowerCase())) return false
      if (priceMin && priceForSort(item, Number.NEGATIVE_INFINITY) < Number(priceMin)) return false
      if (priceMax && priceForSort(item, Number.POSITIVE_INFINITY) > Number(priceMax)) return false
      return true
    })

    return [...base].sort((a, b) => {
      if (sort === "preț crescător") return priceForSort(a, Number.POSITIVE_INFINITY) - priceForSort(b, Number.POSITIVE_INFINITY)
      if (sort === "preț descrescător") return priceForSort(b, Number.NEGATIVE_INFINITY) - priceForSort(a, Number.NEGATIVE_INFINITY)
      if (sort === "cel mai recent") return a.daysAgo - b.daysAgo
      if (sort === "scor agent") return b.score - a.score || compareByRank(a, b)
      return compareByRank(a, b)
    })
  }, [conditions, priceMax, priceMin, results, sort, sources])

  const shownBestOffer = useMemo(() => {
    if (!bestOffer) return null
    return filteredResults.find((item) => item.id === bestOffer.id) || bestOffer
  }, [bestOffer, filteredResults])

  const regularResults = useMemo(() => {
    if (!shownBestOffer) return filteredResults
    return filteredResults.filter((item) => item.id !== shownBestOffer.id)
  }, [filteredResults, shownBestOffer])

  const visibleRegularResults = regularResults.slice(0, visibleCount)

  const sourceBreakdown = useMemo(() => {
    const total = Math.max(results.length, 1)
    return SOURCES_LIST.map((name) => {
      const count = results.filter((item) => item.source === name).length
      return { name, count, pct: Math.round((count / total) * 100) }
    }).filter((entry) => entry.count > 0)
  }, [results])

  const averageScore = results.length
    ? Math.round(results.reduce((sum, item) => sum + item.score, 0) / results.length)
    : 0
  const marketplaceValue = marketplaceStatus.total ? `${marketplaceStatus.successful}/${marketplaceStatus.total}` : "0/0"
  const updatedLabel = searchedAt ? formatDateTime(searchedAt) : "în timp real"
  const statusLabel = !query ? "Introduceți o căutare" : isLoading ? "Search Session Running" : error ? "Search Session Failed" : "Search Session Complete"
  const canCloseFilters = Boolean(query) && !isLoading && !showLoader
  const filteredOutCount = Math.max(0, (parsedListings || totalListings) - results.length)
  const blockedLabel = marketplaceStatus.blocked.length ? marketplaceStatus.blocked.join(", ") : ""
  const agentNotes = [
    { text: error || `${results.length} rezultate normalizate`, pulse: false },
    { text: marketplaceStatus.total ? `${marketplaceValue} marketplace-uri au returnat date` : "marketplace-uri în așteptare", pulse: isLoading },
    {
      text: marketplaceStatus.total
        ? marketplaceStatus.blocked.length
          ? `blocate de anti-bot: ${blockedLabel}`
          : marketplaceStatus.failed.length
          ? `erori marketplace: ${marketplaceStatus.failed.join(", ")}`
          : "toate marketplace-urile cerute au fost încercate"
        : "niciun marketplace pornit încă",
      pulse: false
    },
    { text: filteredOutCount ? `${filteredOutCount} rezultate filtrate` : "filtre de calitate aplicate", pulse: false },
    { text: excludedListings ? `${excludedListings} accesorii/piese excluse` : "clasificare rezultate aplicată", pulse: false },
    { text: shownBestOffer ? `Best price detected on ${shownBestOffer.source}` : "Best offer în așteptare", pulse: false },
    { text: isLoading ? "Recommendation updating live" : "Recommendation updated live", pulse: isLoading },
  ]

  return (
    <div className="flex flex-col flex-1 pb-14" style={{ background: CREAM, fontFamily: MONO, color: INK }}>

      {/* Loading overlay — rendered above everything */}
      {showLoader && <LoadingOverlay progress={loaderProgress} done={loaderDone} />}
      <EmailCapturePopup
        enabled={Boolean(query) && !isLoading && !showLoader && !error && results.length > 0}
        query={query}
        resultCount={results.length}
        bestOfferSource={shownBestOffer?.source}
      />

      <SearchNav query={query} />

      {/* Session header */}
      <header
        className="px-6 py-4 flex flex-col sm:flex-row justify-between sm:items-end gap-4"
        style={{ borderBottom: `1px solid ${INK}`, background: CREAM }}
      >
        <div className="flex flex-col gap-1 text-[12px] uppercase font-bold">
          <span>{statusLabel}</span>
          <span>Query: <span style={{ color: PINK }}>{query ? `“${query}”` : "—"}</span></span>
          <span style={{ color: PINK }}>{filteredResults.length} Matches Found</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] uppercase font-bold px-3 py-1.5" style={{ background: "white", border: `1px solid ${INK}` }}>
          <div className="w-2 h-2 animate-pulse" style={{ background: "#22C55E" }} />
          <span>Live <span className="mx-2">|</span> {updatedLabel === "în timp real" ? time : updatedLabel}</span>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 w-full max-w-[1800px] mx-auto px-6 py-6 flex flex-col lg:flex-row gap-6">

        {filtersOpen ? (
          <FilterPanel
            sort={sort} setSort={updateSort}
            sources={sources} toggleSource={toggleSource}
            conditions={conditions} toggleCondition={toggleCondition}
            priceMin={priceMin} setPriceMin={updatePriceMin}
            priceMax={priceMax} setPriceMax={updatePriceMax}
            onReset={resetFilters}
            canClose={canCloseFilters}
            onClose={() => {
              if (canCloseFilters) setFiltersOpen(false)
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="w-full lg:w-12 flex-none flex lg:flex-col items-center justify-center gap-2 p-3 text-[11px] font-bold uppercase"
            style={{ border: `1px solid ${INK}`, background: "white", color: INK, fontFamily: MONO }}
            aria-label="Open filters"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="lg:[writing-mode:vertical-rl] lg:rotate-180">Filters</span>
          </button>
        )}

        <div className="flex-1 flex flex-col gap-6 min-w-0">

          {/* Search Report */}
          <section style={{ border: `1px solid ${INK}` }}>
            <div className="p-3 flex justify-between items-center" style={{ background: "white", borderBottom: `1px solid ${INK}` }}>
              <h2 className="text-[14px] font-bold uppercase">Search Report</h2>
              <button
                type="button"
                onClick={() => setSearchReportOpen((open) => !open)}
                className="md:hidden h-7 w-7 flex items-center justify-center"
                style={{ border: `1px solid ${INK}`, color: INK }}
                aria-label={searchReportOpen ? "Close search report" : "Open search report"}
              >
                <ChevronDown size={14} />
              </button>
            </div>
            <div className={`${searchReportOpen ? "grid" : "hidden md:grid"} grid-cols-2 md:grid-cols-6`} style={{ background: "white" }}>
              {[
                { value: String(filteredResults.length), label: "Results" },
                { value: String(parsedListings || totalListings), label: "Parsed" },
                { value: `${averageScore}%`, label: "Avg Score" },
                { value: marketplaceValue, label: "Marketplaces" },
                { value: String(filteredOutCount), label: "Filtered" },
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

          {error && (
            <section className="p-4 text-[12px] uppercase font-bold" style={{ border: `1px solid ${INK}`, background: "white", color: PINK }}>
              &gt; {error}
            </section>
          )}

          {shownBestOffer && <RecommendationCard item={shownBestOffer} />}

          {/* Results + Insights */}
          <div className="flex flex-col xl:flex-row gap-6 items-start">
            <div className="flex-1 w-full min-w-0">
              <div className="flex justify-between items-end mb-4 px-1">
                <h2 className="text-[14px] font-bold uppercase">Top Results</h2>
                <div className="flex items-center gap-2 text-[11px]">
                  <span style={{ color: `${INK}66` }}>Sortare după:</span>
                  <button className="font-bold uppercase flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity" style={{ color: INK }}>
                    {sort} <ChevronDown />
                  </button>
                </div>
              </div>
              {regularResults.length ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {visibleRegularResults.map((item) => <ResultCard key={item.id} item={item} />)}
                  </div>
                  {visibleRegularResults.length < regularResults.length && (
                    <div className="mt-5 flex justify-center">
                      <button
                        type="button"
                        onClick={() => setVisibleCount((count) => count + VISIBLE_RESULT_STEP)}
                        className="px-5 py-3 text-[11px] font-bold uppercase"
                        style={{ border: `1px solid ${INK}`, background: "white", color: INK, fontFamily: MONO }}
                      >
                        Arată mai multe ({regularResults.length - visibleRegularResults.length})
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-6 text-[12px] uppercase font-bold" style={{ border: `1px solid ${INK}`, background: "white", color: `${INK}99` }}>
                  {query ? "Nu există rezultate pentru filtrele curente." : "Caută un produs ca să vezi rezultate live."}
                </div>
              )}
            </div>

            <aside className="w-full xl:w-72 flex-none flex flex-col gap-6">
              <div style={{ border: `1px solid ${INK}`, fontFamily: MONO }}>
                <PanelHeader title="Agent Notes" />
                <ul className="p-4 flex flex-col gap-4" style={{ background: CREAM }}>
                  {agentNotes.map(({ text, pulse }) => (
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
                  {sourceBreakdown.length ? sourceBreakdown.map(({ name, count, pct }) => (
                    <div key={name} className="flex items-center gap-2 text-[11px] uppercase font-bold">
                      <span style={{ width: 64, flexShrink: 0 }}>{name}</span>
                      <div className="flex-1 h-2 mx-1" style={{ background: "#E5E0D5" }}>
                        <div className="h-full" style={{ width: `${pct}%`, background: PINK }} />
                      </div>
                      <span className="text-right" style={{ width: 76, flexShrink: 0, color: `${INK}77` }}>{count} ({pct}%)</span>
                    </div>
                  )) : (
                    <div className="text-[11px] uppercase font-bold" style={{ color: `${INK}66` }}>Nicio sursă încă.</div>
                  )}
                </div>
                <div className="p-3 flex justify-between items-center" style={{ borderTop: `1px solid ${INK}`, background: "white" }}>
                  <span className="text-[11px] uppercase font-bold">Total</span>
                  <span className="text-[14px] font-bold" style={{ color: PINK }}>{results.length}</span>
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
