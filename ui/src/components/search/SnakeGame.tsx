"use client"

import { useEffect, useEffectEvent, useRef, useState } from "react"
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Coins } from "lucide-react"
import { LogoIcon } from "@/components/LogoIcon"
import { newSnake, stepSnake, turnSnake, SNAKE_SIZE, type Direction } from "./snake-game"
import styles from "./PremiumSearchAnimation.module.css"

const controls = [
  { direction: 'ArrowLeft', label: 'Stânga', Icon: ArrowLeft },
  { direction: 'ArrowUp', label: 'Sus', Icon: ArrowUp },
  { direction: 'ArrowDown', label: 'Jos', Icon: ArrowDown },
  { direction: 'ArrowRight', label: 'Dreapta', Icon: ArrowRight },
] as const
export function SnakeGame({ onScore, finished }: { onScore: (points: number) => void; finished: boolean }) {
  const [snake, setSnake] = useState(newSnake)
  const current = useRef(snake)
  const board = useRef<HTMLDivElement>(null)
  const score = useEffectEvent(onScore)
  const running = snake.status === 'playing' && !finished

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      const result = stepSnake(current.current)
      current.current = result.state
      setSnake(result.state)
      if (result.points) score(result.points)
    }, 240)
    function pause() {
      if (current.current.status === 'playing') {
        current.current = { ...current.current, status: 'paused' }
        setSnake(current.current)
      }
    }
    function visibility() { if (document.hidden) pause() }
    window.addEventListener('blur', pause)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('blur', pause)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [running])

  function steer(direction: Direction) {
    current.current = turnSnake(current.current, direction)
    setSnake(current.current)
  }
  function toggle() {
    if (finished) return
    const state = current.current
    current.current = state.status === 'playing' ? { ...state, status: 'paused' }
      : state.status === 'paused' ? { ...state, status: 'playing' } : { ...newSnake(), status: 'playing' }
    setSnake(current.current)
    board.current?.focus()
  }
  const roundPoints = (snake.body.length - 3) * 10
  return <div className={styles.game} onKeyDown={event => {
    const control = controls.find(control => control.direction === event.key)
    if (control) { event.preventDefault(); steer(control.direction) }
  }}>
    <div className={styles.snakeStats}><span>RUNDA TA · {roundPoints} PCT</span><span>+10 / MONEDĂ</span></div>
    <div className={styles.snakeFrame}>
      <div ref={board} tabIndex={0} role="group" aria-label="Snake LiberGent. Folosește săgețile pentru direcție și spațiu pentru pauză." className={styles.snakeBoard} onKeyDown={event => {
        if (event.key === ' ' && event.target === event.currentTarget) { event.preventDefault(); toggle() }
      }}>
        {Array.from({ length: SNAKE_SIZE ** 2 }, (_, index) => <div key={index} className={styles.snakeCell} aria-hidden="true">
          {index === snake.body[0] ? <LogoIcon size={32} className={styles.snakeHead} />
            : snake.body.includes(index) ? <span className={styles.snakeBody} />
            : index === snake.food ? <Coins size={22} className={styles.snakeFood} /> : null}
        </div>)}
      </div>
      {snake.status !== 'playing' && <div className={styles.snakeOverlay}>
        <LogoIcon size={48} />
        <strong>{snake.status === 'ready' ? 'SNAKE, DAR LIBERGENT.' : snake.status === 'paused' ? 'PAUZĂ DE VÂNĂTOARE' : snake.status === 'won' ? 'AI CUCERIT TABLA!' : 'MAI ÎNCERCĂ O DATĂ!'}</strong>
        <span>{snake.status === 'ready' ? 'Adună monede. Crești. Evită pereții și coada.' : `${roundPoints} puncte în această rundă. Punctele câștigate se păstrează.`}</span>
        <button type="button" className={styles.next} onClick={toggle} disabled={finished}>{snake.status === 'paused' ? 'Continuă jocul →' : snake.status === 'ready' ? 'Joacă Snake →' : 'Joacă din nou →'}</button>
      </div>}
    </div>
    <div className={styles.controls}>{controls.map(({ direction, label, Icon }) => <button type="button" key={direction} aria-label={label} disabled={!running} onClick={() => steer(direction)}><Icon size={20} aria-hidden="true" /></button>)}
      <button type="button" onClick={toggle} disabled={finished} className={styles.pauseButton}>{running ? 'Pauză' : snake.status === 'paused' ? 'Continuă' : 'Start'}</button>
    </div>
    <p role="status" className={styles.position}>{snake.status === 'over' ? 'Ai lovit un perete sau coada. Poți începe o rundă nouă.' : snake.status === 'won' ? 'Toate monedele au fost colectate!' : 'Săgeți / butoane pentru direcție · Spațiu pentru pauză'}</p>
  </div>
}
