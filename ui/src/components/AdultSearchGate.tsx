"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"

type Confirmation = { token: string; expiresAt: number }

// Never persist confirmation or results in storage. The parent keys this gate by
// query/category so navigation cannot briefly render the previous result tree.
export function AdultSearchGate({ query, category, children }: {
  query: string
  category: string
  children: (token: string) => ReactNode
}) {
  const [required, setRequired] = useState<boolean | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/adult-access", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, category }), signal: controller.signal, cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Verificarea accesului nu este disponibila. Reincarca pagina.")
        const result = await response.json()
        setRequired(result.required === true)
      }).catch(err => { if (!controller.signal.aborted) setError(String(err.message)) })
    return () => controller.abort()
  }, [query, category])

  useEffect(() => {
    if (!confirmation) return
    const clearExpired = () => { if (Date.now() >= confirmation.expiresAt) setConfirmation(null) }
    const timeout = setTimeout(() => setConfirmation(null), Math.max(0, confirmation.expiresAt - Date.now()))
    window.addEventListener("focus", clearExpired)
    window.addEventListener("pageshow", clearExpired)
    return () => { clearTimeout(timeout); window.removeEventListener("focus", clearExpired); window.removeEventListener("pageshow", clearExpired) }
  }, [confirmation])

  async function confirm() {
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/adult-access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: true }), cache: "no-store" })
      const result = await response.json()
      if (!response.ok || !result.token) throw new Error(result.error || "Confirmarea nu a reusit.")
      setConfirmation(result)
    } catch (err) { setError(err instanceof Error ? err.message : String(err)) }
    finally { setBusy(false) }
  }

  if (required === false) return children("")
  if (required && confirmation) return <>
    <div className="p-4 text-center text-sm bg-stone-100">18+ · Produse de wellness sexual · Confirmare pentru 30 de minute.
      <button className="ml-4 underline" onClick={() => setConfirmation(null)}>Iesi din categoria 18+</button>
      <p>Cautarile nu se salveaza in istoric. Acoperirea comerciantilor nu este garantata.</p>
    </div>
    {children(confirmation.token)}
  </>
  return <main className="min-h-screen flex items-center justify-center bg-stone-100 p-6">
    <section className="max-w-lg border border-black bg-white p-8 space-y-5" aria-labelledby="adult-access-title">
      <h1 id="adult-access-title" className="text-2xl font-bold">{required === null ? "Verificare acces" : "Acces 18+"}</h1>
      {required && <><p>Categoria de produse pentru wellness sexual este disponibila numai persoanelor de cel putin 18 ani. Nu include pornografie.</p>
        <p>Confirmarea este o declaratie proprie, nu verificarea identitatii. Nu solicitam acte. Expira dupa 30 de minute sau cand parasesti pagina.</p>
        <button className="block border border-black px-4 py-3 font-bold" disabled={busy} onClick={confirm}>Am cel putin 18 ani — confirma</button></>}
      {error && <p role="alert">{error}</p>}
      <Link href="/" className="block underline">{required ? "Nu confirm — inapoi la pagina principala" : "Inapoi"}</Link>
    </section>
  </main>
}
