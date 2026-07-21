"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { AuthShell } from "@/components/AuthShell";
import { getSafeNextPath } from "@/lib/auth-path";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function ConfirmPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      queueMicrotask(() => setError("Autentificarea nu este configurată încă."));
      return;
    }

    let mounted = true;
    async function confirm() {
      const params = new URLSearchParams(window.location.search);
      const next = getSafeNextPath(window.location.search);
      const tokenHash = params.get("token_hash");
      const type = params.get("type") as EmailOtpType | null;
      const code = params.get("code");
      const providerError = params.get("error_description") || params.get("error");

      if (providerError) {
        if (mounted) setError(providerError);
        return;
      }

      let confirmationError: Error | null = null;
      const existing = await client!.auth.getSession();
      if (!existing.data.session && tokenHash && type) {
        const result = await client!.auth.verifyOtp({ token_hash: tokenHash, type });
        confirmationError = result.error;
      } else if (!existing.data.session && code) {
        const result = await client!.auth.exchangeCodeForSession(code);
        confirmationError = result.error;
      }

      const session = await client!.auth.getSession();
      if (!mounted) return;
      if (session.data.session) {
        router.replace(next);
      } else {
        setError(confirmationError?.message || session.error?.message || "Linkul este invalid sau a expirat.");
      }
    }

    confirm();
    return () => { mounted = false; };
  }, [router]);

  return (
    <AuthShell title="Confirmăm conectarea" description={error || "Verificăm linkul securizat și pregătim contul tău."}>
      {error ? (
        <Link href="/auth" className="inline-flex min-h-12 items-center justify-center px-5 py-3 text-[12px] font-bold uppercase" style={{ background: "#111111", color: "white", border: "2px solid #111111" }}>Solicită un link nou</Link>
      ) : (
        <div role="status" className="flex items-center gap-3 text-[11px] font-bold uppercase"><span className="h-3 w-3 animate-pulse rounded-full bg-[#FF4F8B]" /> Conectare în curs...</div>
      )}
    </AuthShell>
  );
}
