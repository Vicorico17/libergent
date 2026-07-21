"use client";

import Link from "next/link";
import { buildAuthPath } from "@/lib/auth-path";
import { useAccountSession } from "@/lib/use-account-session";

export function AccountNavLink({ next = "/", compact = false }: { next?: string; compact?: boolean }) {
  const account = useAccountSession();
  const label = account.status === "checking" ? "Cont" : account.status === "signed_in" ? "Contul meu" : "Conectează-te";
  const href = account.status === "signed_in" ? buildAuthPath("/account", next) : buildAuthPath("/auth", next);

  return (
    <Link
      href={href}
      className={compact ? "text-[11px] font-bold tracking-[0.12em] text-[#101010]" : "px-3 py-2 text-[10px] font-bold tracking-[0.12em] text-[#101010]"}
      style={compact ? undefined : { border: "1.5px solid #101010" }}
    >
      {label.toUpperCase()}
    </Link>
  );
}
