"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { buildAuthPath, getSafeNextPath } from "@/lib/auth-path";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useAccountSession } from "@/lib/use-account-session";

function AccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const account = useAccountSession();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const next = getSafeNextPath(`?${searchParams.toString()}`);

  async function signOut() {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    setSigningOut(true);
    setError("");
    const { error: signOutError } = await client.auth.signOut();
    if (signOutError) {
      setSigningOut(false);
      setError(signOutError.message);
      return;
    }
    router.replace(next);
  }

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

  return (
    <AuthShell title={account.displayName || "Contul tău"} description="Sesiunea este activă. Favoritele și conversațiile tale sunt izolate pe acest cont.">
      <dl className="grid gap-2 text-[11px] uppercase">
        <div className="grid gap-1 p-3" style={{ border: "1px solid #11111133", background: "#F3F0E7" }}><dt className="font-bold opacity-60">Email</dt><dd className="break-all font-bold normal-case">{account.email || "Nespecificat"}</dd></div>
        <div className="grid gap-1 p-3" style={{ border: "1px solid #11111133", background: "#F3F0E7" }}><dt className="font-bold opacity-60">Metodă de conectare</dt><dd className="font-bold">{account.provider}</dd></div>
      </dl>
      <Link href={next} className="inline-flex min-h-12 items-center justify-center px-5 py-3 text-[12px] font-bold uppercase" style={{ background: "#111111", color: "white", border: "2px solid #111111" }}>Înapoi în aplicație</Link>
      <button type="button" onClick={signOut} disabled={signingOut} className="min-h-12 px-5 py-3 text-[12px] font-bold uppercase disabled:opacity-60" style={{ background: "white", color: "#111111", border: "2px solid #111111" }}>{signingOut ? "Se deconectează..." : "Deconectează-te"}</button>
      {error ? <p role="alert" className="text-[10px] font-bold uppercase text-[#FF4F8B]">{error}</p> : null}
    </AuthShell>
  );
}

export default function AccountPage() {
  return <Suspense fallback={<AuthShell title="Contul tău" description="Verificăm sesiunea curentă."><p role="status" className="text-[11px] font-bold uppercase">Se încarcă...</p></AuthShell>}><AccountContent /></Suspense>;
}
