"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useAccountSession } from "@/lib/use-account-session";
import { useCreditWallet } from "@/lib/use-credit-wallet";

type BillingPlan = "monthly" | "credits10" | "credits30";

export function BillingAction({ kind = "checkout", plan = "monthly" }: { kind?: "checkout" | "portal"; plan?: BillingPlan }) {
  const account = useAccountSession();
  const router = useRouter();
  const [testMode, setTestMode] = useState(false);
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function check() {
      if (kind === "portal" && account.status !== "signed_in") return;
      const session = kind === "portal" ? (await getSupabaseBrowserClient()?.auth.getSession())?.data.session : null;
      const response = await fetch(kind === "portal" ? "/api/billing/status" : "/api/billing/config", {
        headers: session?.access_token ? { authorization: `Bearer ${session.access_token}` } : {}
      });
      const value = await response.json();
      if (active) {
        setAvailable(Boolean(value.available && (kind === "checkout" ? value.offers?.some((offer: { id: string; available: boolean }) => offer.id === plan && offer.available) : value.hasCustomer)));
        setTestMode(Boolean(value.testMode));
      }
    }
    check().catch(() => {}).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [account.status, kind, plan]);

  async function start() {
    if (account.status !== "signed_in") {
      router.push(kind === "portal" ? "/auth?next=%2Faccount" : "/auth?next=%2Fpricing");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const session = (await getSupabaseBrowserClient()?.auth.getSession())?.data.session;
      if (!session?.access_token) throw new Error("Conectează-te din nou pentru a continua.");
      const response = await fetch(`/api/billing/${kind}`, {
        method: "POST",
        headers: { authorization: `Bearer ${session.access_token}`, ...(kind === "checkout" ? { "content-type": "application/json" } : {}) },
        ...(kind === "checkout" ? { body: JSON.stringify({ plan, returnTo: window.location.pathname + window.location.search }) } : {})
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Nu am putut deschide pagina de plată.");
      if (typeof payload.url !== "string" || !payload.url.startsWith("https://")) throw new Error("Adresa de plată este invalidă.");
      window.location.assign(payload.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "A apărut o eroare.");
      setBusy(false);
    }
  }

  if (checking || !available) return kind === "checkout" ? <p className="mt-3 text-center text-[10px] uppercase text-[#6B7280]">Plata nu este disponibilă momentan.</p> : null;
  return <div className="mt-3">
    <button type="button" disabled={busy || account.status === "checking"} onClick={start}
      className="flex min-h-12 w-full items-center justify-center border-2 border-[#111] bg-[#FF4B8B] px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-[#111] shadow-[4px_4px_0_#111] disabled:opacity-60">
      {busy ? "Se deschide..." : kind === "portal" ? "Gestionează abonamentul" : "Continuă la checkout"}
    </button>
    {kind === "checkout" && testMode && <p className="mt-2 text-center text-[10px] uppercase text-[#6B7280]">Plată de test. Cardul nu va fi debitat.</p>}
    {error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
  </div>;
}

export function CreditPackPicker() {
  const [plan, setPlan] = useState<BillingPlan>("credits10");
  return <div className="mt-4">
    <div className="grid grid-cols-2 gap-3" role="group" aria-label="Pachete de credite">
      {[{ id: "credits10" as const, credits: 10, price: 19 }, { id: "credits30" as const, credits: 30, price: 39 }].map(option =>
        <button key={option.id} type="button" aria-pressed={plan === option.id} onClick={() => setPlan(option.id)}
          className={`min-h-28 border-2 border-[#111] p-4 text-left ${plan === option.id ? "bg-[#FCE7F3] shadow-[3px_3px_0_#111]" : "bg-white"}`}>
          <span className="block text-xl font-bold">{option.credits} credite</span>
          <span className="mt-2 block text-sm">{option.price} RON · plată unică</span>
          <span className="mt-1 block text-xs text-[#111]/65">{(option.price / option.credits).toFixed(2)} RON / credit</span>
        </button>)}
    </div>
    <BillingAction plan={plan} />
    <p className="mt-3 text-xs leading-relaxed text-[#111]/65">Creditele cumpărate nu expiră. Folosim întâi creditele incluse în abonament. Fără reîncărcare automată.</p>
  </div>;
}

export function BillingPlanPicker() {
  const { wallet } = useCreditWallet();
  return <div className="mt-4">
    {!wallet?.premium && <div className="border-2 border-[#111] bg-[#FCE7F3] p-5">
      <p className="text-xs font-bold uppercase">Premium lunar</p>
      <p className="mt-2 text-3xl font-bold">49 RON <span className="text-sm font-normal">/ lună</span></p>
      <p className="mt-2 text-sm">40 de credite incluse în fiecare lună.</p>
      <BillingAction plan="monthly" />
      <p className="mt-3 text-xs leading-relaxed text-[#111]/65">Reînnoire automată. Anulezi din cont. Creditele lunare nefolosite expiră la sfârșitul perioadei.</p>
    </div>}
    <h3 className="mt-6 text-sm font-bold">{wallet?.premium ? "Adaugă credite Premium" : "Preferi fără abonament?"}</h3>
    <CreditPackPicker />
    <p className="mt-3 text-xs text-[#111]/65">O căutare Premium costă 1 credit. Filtrele și redeschiderea rezultatelor sunt gratuite. Căutările eșuate sunt rambursate.</p>
  </div>;
}

export function BillingReturnNotice() {
  const [result, setResult] = useState("");
  useEffect(() => {
    queueMicrotask(() => setResult(new URLSearchParams(window.location.search).get("checkout") || ""));
  }, []);
  if (result === "success") return <p role="status" className="mb-6 border border-[#111] bg-white px-4 py-3 text-center text-xs">Checkout încheiat. Creditele apar după confirmarea plății. Soldul se actualizează automat; poți verifica din nou din cont.</p>;
  if (result === "cancelled") return <p role="status" className="mb-6 border border-[#111] bg-white px-4 py-3 text-center text-xs">Checkout anulat.</p>;
  return null;
}
