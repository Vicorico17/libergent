"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useAccountSession } from "@/lib/use-account-session";

export type CreditWallet = { enabled: boolean; premium: boolean; hasCredits: boolean; balance: number; included: number; purchased: number; renewsAt: string | null; searchCost: number };
export function useCreditWallet() {
  const account = useAccountSession();
  const [state, setState] = useState<{ owner: string; data?: CreditWallet; error?: string }>({ owner: "" });
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    if (account.status !== "signed_in") return;
    const request = ++sequence.current;
    try {
      const session = (await getSupabaseBrowserClient()?.auth.getSession())?.data.session;
      if (!session) throw new Error("Conectează-te din nou.");
      const response = await fetch("/api/billing/credits", { headers: { authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Soldul nu este disponibil.");
      if (request !== sequence.current) return;
      setState({ owner: account.userId, data });
    } catch (error) {
      if (request !== sequence.current) return;
      setState(current => ({ ...current, owner: account.userId, error: error instanceof Error ? error.message : "Soldul nu este disponibil." }));
    }
  }, [account.status, account.userId]);
  useEffect(() => {
    const initial = setTimeout(() => void reload(), 0);
    const refresh = () => void reload();
    window.addEventListener("focus", refresh);
    window.addEventListener("libergent:credits", refresh);
    let attempts = 0;
    const returning = new URLSearchParams(window.location.search).get("checkout") === "success";
    const timer = returning ? setInterval(() => { if (++attempts <= 10) void reload(); }, 3000) : undefined;
    return () => { clearTimeout(initial); clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("libergent:credits", refresh); };
  }, [reload]);
  return { account, wallet: state.owner === account.userId ? state.data : undefined,
    error: state.owner === account.userId ? state.error : undefined, reload };
}
