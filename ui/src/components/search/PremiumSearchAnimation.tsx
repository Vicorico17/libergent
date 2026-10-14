"use client"

import { useRef, useState, useSyncExternalStore } from "react"
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Coins, Trophy } from "lucide-react"
import { LogoIcon } from "@/components/LogoIcon"
import { MascotNewspaper, MascotTallHat } from "@/components/MascotSVG"
import { discountPercent, flipCard, movePlayer, nextCoin, shuffled, type MemoryState } from "./waiting-games"
import styles from "./PremiumSearchAnimation.module.css"

const SCORE_KEY = "libergent.waiting-games.points.v1"
let fallbackScore = 0
function readScore() {
  try {
    const value = Number(localStorage.getItem(SCORE_KEY))
    return Number.isSafeInteger(value) && value >= 0 ? Math.max(value, fallbackScore) : fallbackScore
  } catch { return fallbackScore }
}
function addScore(points: number) {
  fallbackScore = readScore() + points
  try { localStorage.setItem(SCORE_KEY, String(fallbackScore)) } catch { /* Play remains available without storage. */ }
  window.dispatchEvent(new Event("libergent-game-score"))
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback)
  window.addEventListener("libergent-game-score", callback)
  return () => {
    window.removeEventListener("storage", callback)
    window.removeEventListener("libergent-game-score", callback)
  }
}
const games = [
  { id: "coins", label: "Monede", hint: "Mișcă mascota până la monedă. Săgeți pe tastatură sau butoanele de mai jos. +10 puncte / monedă." },
  { id: "memory", label: "Perechi", hint: "Găsește personajele LiberGent identice. Întoarce câte două cărți. +20 puncte / pereche." },
  { id: "deals", label: "Reduceri", hint: "Ajută detectivul LiberGent să aleagă cea mai mare reducere procentuală. +15 puncte / răspuns corect." },
] as const
const characters = ["Explorator", "Detectiv", "Gentleman", "Vânător de oferte"]
function GameCharacter({ variant, size = 36 }: { variant: number; size?: number }) {
  if (variant === 1) return <MascotNewspaper size={size} />
  if (variant === 2) return <MascotTallHat size={size} />
  if (variant === 3) return <MascotNewspaper size={size} color="#FF3366" />
  return <LogoIcon size={size} />
}
const arrows = [
  { key: "ArrowLeft", label: "Stânga", Icon: ArrowLeft },
  { key: "ArrowUp", label: "Sus", Icon: ArrowUp },
  { key: "ArrowDown", label: "Jos", Icon: ArrowDown },
  { key: "ArrowRight", label: "Dreapta", Icon: ArrowRight },
]
function makeOffers() {
  return shuffled([10, 20, 30, 40, 50]).slice(0, 3).map(percent => {
    const original = [100, 200, 300, 400][Math.floor(Math.random() * 4)]
    return { original, price: original * (100 - percent) / 100 }
  })
}

export function PremiumSearchAnimation() {
  const [game, setGame] = useState<(typeof games)[number]["id"] | null>(null)
  const [sessionPoints, setSessionPoints] = useState(0)
  const total = useSyncExternalStore(subscribe, readScore, () => 0)
  const [message, setMessage] = useState("Alege un mini-joc cât timp căutăm.")
  const [hunt, setHunt] = useState({ player: 0, coin: 10 })
  const huntRef = useRef(hunt)
  const [memory, setMemory] = useState<MemoryState>({ cards: [], open: [], matched: [] })
  const memoryRef = useRef(memory)
  const [offers, setOffers] = useState<ReturnType<typeof makeOffers>>([])
  const [answer, setAnswer] = useState<number | null>(null)
  const answered = useRef(false)
  const active = games.find(entry => entry.id === game)

  function award(points: number) {
    setSessionPoints(value => value + points)
    addScore(points)
    setMessage(`+${points} puncte!`)
  }
  function start(id: NonNullable<typeof game>) {
    setGame(id)
    setMessage("Spor la joacă! Căutarea continuă în fundal.")
    if (id === "coins") {
      huntRef.current = { player: 0, coin: nextCoin(0) }
      setHunt(huntRef.current)
    }
    if (id === "memory") {
      memoryRef.current = { cards: shuffled([0, 0, 1, 1, 2, 2, 3, 3]), open: [], matched: [] }
      setMemory(memoryRef.current)
    }
    if (id === "deals") nextOffers()
  }
  function move(direction: string) {
    const current = huntRef.current
    const player = movePlayer(current.player, direction)
    if (player === current.player) return
    const collected = player === current.coin
    huntRef.current = { player, coin: collected ? nextCoin(player) : current.coin }
    setHunt(huntRef.current)
    if (collected) award(10)
  }
  function flip(index: number) {
    const result = flipCard(memoryRef.current, index)
    memoryRef.current = result.state
    setMemory(result.state)
    if (result.points) award(result.points)
    else if (result.state.open.length === 2) setMessage("Nu sunt o pereche. Reține simbolurile și încearcă din nou.")
  }
  function nextOffers() {
    setOffers(makeOffers())
    setAnswer(null)
    answered.current = false
  }
  function choose(index: number) {
    if (answered.current) return
    answered.current = true
    setAnswer(index)
    const best = Math.max(...offers.map(offer => discountPercent(offer.original, offer.price)))
    if (discountPercent(offers[index].original, offers[index].price) === best) award(15)
    else setMessage(`Cea mai mare reducere era ${best}%. Încearcă următoarea rundă!`)
  }

  return (
    <section className={styles.scene} aria-label="Mini-jocuri în așteptarea rezultatelor">
      <header className={styles.heading}>
        <div className={styles.title}><LogoIcon size={32} /><span><small>LiberGent Arcade</small>Joacă-te cât căutăm</span></div>
        <span className={styles.score}><Trophy size={14} aria-hidden="true" />{sessionPoints} puncte</span>
      </header>
      <div className={styles.tabs} aria-label="Alege mini-jocul">
        {games.map(entry => <button type="button" key={entry.id} aria-pressed={game === entry.id} onClick={() => start(entry.id)}>{entry.label}</button>)}
      </div>
      {active ? <>
        <div className={styles.guide}><span className={styles.guideCharacter}><GameCharacter variant={game === "deals" ? 1 : game === "memory" ? 2 : 0} size={38} /></span><p className={styles.instructions}>{active.hint}</p></div>
        {game === "coins" && <div className={styles.game}>
          <div className={styles.board} tabIndex={0} role="group" aria-label="Tablă de monede. Folosește săgețile pentru a mișca mascota." onKeyDown={event => {
            if (arrows.some(arrow => arrow.key === event.key)) { event.preventDefault(); move(event.key) }
          }}>
            {Array.from({ length: 16 }, (_, index) => <div key={index} className={styles.cell} aria-hidden="true">
              {hunt.player === index ? <LogoIcon size={36} /> : hunt.coin === index ? <span className={styles.coinToken}><Coins size={24} className={styles.coin} /></span> : <span className={styles.dot} />}
            </div>)}
          </div>
          <p className={styles.position}>Mascotă: rând {Math.floor(hunt.player / 4) + 1}, coloană {hunt.player % 4 + 1}. Monedă: rând {Math.floor(hunt.coin / 4) + 1}, coloană {hunt.coin % 4 + 1}.</p>
          <div className={styles.controls}>{arrows.map(({ key, label, Icon }) => <button type="button" key={key} aria-label={label} onClick={() => move(key)}><Icon size={19} aria-hidden="true" /></button>)}</div>
        </div>}
        {game === "memory" && <div className={styles.game}>
          <div className={styles.memory}>{memory.cards.map((symbol, index) => {
            const matched = memory.matched.includes(index)
            const visible = matched || memory.open.includes(index)
            return <button type="button" key={index} disabled={matched || memory.open.includes(index) || memory.open.length === 2} data-matched={matched} data-revealed={visible} aria-label={`Cartea ${index + 1}: ${visible ? `${characters[symbol]}${matched ? ", pereche găsită" : ""}` : "ascunsă"}`} onClick={() => flip(index)}>
              {visible ? <><GameCharacter variant={symbol} /><span className={styles.cardLabel}>{characters[symbol]}</span></> : <><LogoIcon size={26} /><span className={styles.cardLabel}>LIBERGENT</span></>}
            </button>
          })}</div>
          {memory.open.length === 2 && <button type="button" className={styles.next} onClick={() => {
            memoryRef.current = { ...memoryRef.current, open: [] }
            setMemory(memoryRef.current)
            setMessage("Alege alte două cărți.")
          }}>Întoarce cărțile · încearcă din nou</button>}
          {memory.matched.length === 8 && <button type="button" className={styles.next} onClick={() => start("memory")}>Toate perechile găsite! Joacă din nou</button>}
        </div>}
        {game === "deals" && <div className={styles.game}>
          <div className={styles.offers}>{offers.map((offer, index) => <button type="button" key={index} disabled={answer !== null} data-correct={answer !== null && discountPercent(offer.original, offer.price) === Math.max(...offers.map(value => discountPercent(value.original, value.price)))} onClick={() => choose(index)}>
            <span className={styles.offerNumber}>DOSAR 0{index + 1}</span><GameCharacter variant={index} size={34} /><del>{offer.original} lei</del><strong>{offer.price} lei</strong>{answer !== null && <b>−{discountPercent(offer.original, offer.price)}%</b>}
          </button>)}</div>
          <p className={styles.position}>Prețuri fictive, doar pentru joc.</p>
          {answer !== null && <button type="button" className={styles.next} onClick={nextOffers}>Următoarea rundă</button>}
        </div>}
      </> : <div className={styles.welcome}><span className={styles.welcomeCharacter}><MascotNewspaper size={64} /></span><p><strong>Misiunea ta începe aici.</strong><br />Monede, personaje și oferte de investigat. Alege un joc și adună puncte cu LiberGent.</p></div>}
      <div className={styles.feedback}><LogoIcon size={24} /><p role="status">{message}</p></div>
      <footer className={styles.footer}>Total pe acest dispozitiv: <strong>{total} puncte</strong>. Puncte de joc, fără valoare monetară. Rezultatele apar automat când sunt gata.</footer>
    </section>
  )
}
