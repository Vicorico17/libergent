"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useAccountSession } from "@/lib/use-account-session";
import { PREMIUM_ANNUAL_PRICE_RON, PREMIUM_TRIAL_DAYS, PREMIUM_WEEKLY_PRICE_RON } from "@/lib/pricing";

type BillingPlan = "weekly" | "annual";

export function BillingAction({ kind = "checkout", plan = "annual" }: { kind?: "checkout" | "portal"; plan?: BillingPlan }) {
  const account = useAccountSession();
  const router = useRouter();
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
      if (active) setAvailable(Boolean(value.available && (kind === "checkout" || value.hasCustomer)));
    }
    check().catch(() => {}).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [account.status, kind]);

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
        ...(kind === "checkout" ? { body: JSON.stringify({ plan }) } : {})
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

  if (checking || !available) return kind === "checkout" ? <p className="mt-3 text-center text-[10px] uppercase text-[#6B7280]">Abonamentul nu este disponibil momentan.</p> : null;
  return <div className="mt-3">
    <button type="button" disabled={busy || account.status === "checking"} onClick={start}
      className="flex min-h-12 w-full items-center justify-center border-2 border-[#111] bg-[#FF4B8B] px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-[#111] shadow-[4px_4px_0_#111] disabled:opacity-60">
      {busy ? "Se deschide..." : kind === "portal" ? "Gestionează abonamentul" : "Continuă la checkout"}
    </button>
    {kind === "checkout" && <p className="mt-2 text-center text-[10px] uppercase text-[#6B7280]">Plată de test. Cardul nu va fi debitat.</p>}
    {error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
  </div>;
}

export function BillingPlanPicker() {
  const [plan, setPlan] = useState<BillingPlan>("weekly");
  const plans = [
    { id: "weekly" as const, title: "Săptămânal", price: PREMIUM_WEEKLY_PRICE_RON, period: "săptămână", note: "Flexibil, cu plată săptămânală" },
    { id: "annual" as const, title: "Anual", price: PREMIUM_ANNUAL_PRICE_RON, period: "an", note: `Economisești ~80% față de 52 de plăți săptămânale · ~${Math.round(PREMIUM_ANNUAL_PRICE_RON / 12)} RON/lună` }
  ];
  return <div className="mt-4">
    <p className="mb-3 text-[11px] font-bold uppercase tracking-widest">{PREMIUM_TRIAL_DAYS} zile gratuite la primul abonament · alege planul</p>
    <div className="grid gap-3 sm:grid-cols-2">
      {plans.map((option) => <button key={option.id} type="button" aria-pressed={plan === option.id} onClick={() => setPlan(option.id)}
        className={`relative border-2 p-4 text-left transition-transform hover:-translate-y-0.5 ${plan === option.id ? "border-[#111] bg-[#FCE7F3] shadow-[4px_4px_0_#FF4B8B]" : "border-[#111]/40 bg-white"}`}>
        {option.id === "annual" && <span className="mb-2 inline-block bg-[#FF4B8B] px-2 py-1 text-[9px] font-bold uppercase text-[#111]">~80% economie</span>}
        <span className="block text-[12px] font-bold uppercase">{option.title}</span>
        <span className="mt-1 block text-2xl font-bold">{option.price} RON<span className="text-xs font-normal"> / {option.period}</span></span>
        <span className="mt-2 block text-[10px] leading-relaxed text-[#111]/65">{option.note}</span>
      </button>)}
    </div>
    <BillingAction plan={plan} />
    <p className="mt-3 text-[10px] leading-relaxed text-[#111]/65">Pentru primul abonament, prima plată se face după {PREMIUM_TRIAL_DAYS} zile. Apoi abonamentul se reînnoiește automat la prețul planului ales. Poți anula din cont.</p>
  </div>;
}

export function BillingReturnNotice() {
  const [result, setResult] = useState("");
  useEffect(() => {
    queueMicrotask(() => setResult(new URLSearchParams(window.location.search).get("checkout") || ""));
  }, []);
  if (result === "success") return <p role="status" className="mb-6 border border-[#111] bg-white px-4 py-3 text-center text-xs">Checkout încheiat. Accesul Premium apare după confirmarea abonamentului; verifică pagina contului.</p>;
  if (result === "cancelled") return <p role="status" className="mb-6 border border-[#111] bg-white px-4 py-3 text-center text-xs">Checkout anulat.</p>;
  return null;
}
