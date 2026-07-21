"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AccountDashboard } from "@/components/AccountDashboard";
import { AuthShell } from "@/components/AuthShell";
import { buildAuthPath, getSafeNextPath } from "@/lib/auth-path";
import { useAccountSession } from "@/lib/use-account-session";

function AccountContent() {
  const searchParams = useSearchParams();
  const account = useAccountSession();
  const next = getSafeNextPath(`?${searchParams.toString()}`);

  if (account.status === "checking") {
    return <AuthShell title="Contul tău" description="Verificăm sesiunea curentă."><p role="status" className="text-[11px] font-bold uppercase">Se încarcă...</p></AuthShell>;
  }

  if (account.status === "signed_out") {
    return (
      <AuthShell title="Contul tău" description="Conectează-te pentru a vedea informațiile contului și funcțiile private.">
        <Link href={buildAuthPath("/auth", next)} className="inline-flex min-h-12 items-center justify-center px-5 py-3 text-[12px] font-bold uppercase" style={{ background: "#111111", color: "white", border: "2px solid #111111" }}>Conectează-te</Link>
      </AuthShell>
    );
  }

  return <AccountDashboard account={account} next={next} />;
}

export default function AccountPage() {
  return <Suspense fallback={<AuthShell title="Contul tău" description="Verificăm sesiunea curentă."><p role="status" className="text-[11px] font-bold uppercase">Se încarcă...</p></AuthShell>}><AccountContent /></Suspense>;
}
