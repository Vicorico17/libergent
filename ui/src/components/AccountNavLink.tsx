"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buildAuthPath } from "@/lib/auth-path";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useAccountSession } from "@/lib/use-account-session";

export function AccountNavLink({ next = "/", compact = false }: { next?: string; compact?: boolean }) {
  const account = useAccountSession();
  const [isPremium, setIsPremium] = useState(false);
  const label = account.status === "checking" ? "Cont" : account.status === "signed_in" ? "Contul meu" : "Conectează-te";
  const href = account.status === "signed_in" ? buildAuthPath("/account", next) : buildAuthPath("/auth", next);

  useEffect(() => {
    let active = true;
    async function loadPremiumStatus() {
      if (account.status !== "signed_in") {
        if (active) setIsPremium(false);
        return;
      }
      const supabase = getSupabaseBrowserClient();
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      if (!session?.access_token) return;
      try {
        const response = await fetch("/api/alerts", { headers: { authorization: `Bearer ${session.access_token}` } });
        if (active) setIsPremium(response.ok);
      } catch {
        if (active) setIsPremium(false);
      }
    }
    void loadPremiumStatus();
    return () => { active = false; };
  }, [account.status, account.userId]);

  return (
    <Link
      href={href}
      className={compact ? "w-fit px-2 py-1 text-[11px] font-bold tracking-[0.12em] text-[#101010]" : "px-3 py-2 text-[10px] font-bold tracking-[0.12em] text-[#101010]"}
      style={{
        border: compact ? (isPremium ? "1.5px solid #101010" : undefined) : "1.5px solid #101010",
        outline: isPremium ? "2px solid #FF3366" : undefined,
        outlineOffset: isPremium ? "2px" : undefined,
        background: isPremium ? "#FF33661A" : undefined,
      }}
    >
      {label.toUpperCase()}
    </Link>
  );
}
