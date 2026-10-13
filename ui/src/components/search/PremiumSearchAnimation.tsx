"use client"

import { useState } from "react"
import { Coins, Pause, Play, Tag } from "lucide-react"
import { LogoIcon } from "@/components/LogoIcon"
import styles from "./PremiumSearchAnimation.module.css"

export function PremiumSearchAnimation() {
  const [paused, setPaused] = useState(false)

  return (
    <div className={styles.scene} data-paused={paused}>
      <div className={styles.heading}>
        <span>La vânătoare de oferte</span>
        <button type="button" onClick={() => setPaused(value => !value)} aria-label={paused ? "Pornește animația" : "Pune animația pe pauză"} aria-pressed={paused} className={styles.pause}>
          {paused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}
        </button>
      </div>
      <div className={styles.field} aria-hidden="true">
        <svg className={styles.trail} viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M8 68 H26 L50 28 L74 68 L90 28" fill="none" stroke="#111111" strokeOpacity=".15" strokeWidth="1" strokeDasharray="2 3" />
        </svg>
        <div className={`${styles.target} ${styles.coinOne}`}><div className={styles.pickup}><Coins size={24} /><span>+ economii</span></div></div>
        <div className={`${styles.target} ${styles.dealOne}`}><div className={`${styles.pickup} ${styles.deal}`}><Tag size={17} /><span>PREȚ BUN</span></div></div>
        <div className={`${styles.target} ${styles.coinTwo}`}><div className={styles.pickup}><Coins size={24} /><span>+ economii</span></div></div>
        <div className={`${styles.target} ${styles.dealTwo}`}><div className={`${styles.pickup} ${styles.deal}`}><Tag size={17} /><span>DE VERIFICAT</span></div></div>
        <div className={styles.runner}><div className={styles.hop}><LogoIcon size={48} /></div><span className={styles.shadow} /></div>
      </div>
      <p className={styles.caption}>LiberGent explorează ofertele și compară prețurile pentru tine.</p>
    </div>
  )
}
