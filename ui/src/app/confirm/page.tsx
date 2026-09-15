"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { callbackProviderError, friendlyAuthError } from "@/lib/auth-flow.mjs";
import { AuthShell } from "@/components/AuthShell";
import { getSafeNextPath } from "@/lib/auth-path";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function ConfirmPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [retryHref, setRetryHref] = useState("/auth");
  const confirmation = useRef<Promise<void> | null>(null);

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
      const rawType = params.get("type");
      const type = rawType && ["email", "signup", "magiclink", "recovery", "invite", "email_change"].includes(rawType) ? rawType as EmailOtpType : null;
      if (mounted) setRetryHref(`/auth?next=${encodeURIComponent(next)}`);
      const code = params.get("code");
      const providerError = callbackProviderError(window.location.search, window.location.hash);

      if (providerError) {
        if (mounted) setError(providerError);
        return;
      }

      // Reuse the exchange during React effect replay: one-time codes must not
      // be consumed by two concurrent callbacks.
      confirmation.current ||= (async () => {
        const existing = await client!.auth.getSession();
        if (existing.error) throw existing.error;
        if (existing.data.session) return;
        if (tokenHash && type) {
          const result = await client!.auth.verifyOtp({ token_hash: tokenHash, type });
          if (result.error) throw result.error;
        } else if (code) {
          const result = await client!.auth.exchangeCodeForSession(code);
          if (result.error) throw result.error;
        }
      })();
      await confirmation.current;

      const session = await client!.auth.getSession();
      if (!mounted) return;
      if (session.data.session) {
        router.replace(next);
      } else {
        setError(session.error ? friendlyAuthError(session.error) : "Linkul este invalid sau a expirat.");
      }
    }

    confirm().catch((failure) => { if (mounted) setError(friendlyAuthError(failure)); });
    return () => { mounted = false; };
  }, [router]);

  return (
    <AuthShell title="Confirmăm conectarea" description={error || "Verificăm linkul securizat și pregătim contul tău."}>
      {error ? (
        <Link href={retryHref} className="inline-flex min-h-12 items-center justify-center px-5 py-3 text-[12px] font-bold uppercase" style={{ background: "#111111", color: "white", border: "2px solid #111111" }}>Solicită un link nou</Link>
      ) : (
        <div role="status" className="flex items-center gap-3 text-[11px] font-bold uppercase"><span className="h-3 w-3 animate-pulse rounded-full bg-[#FF4F8B]" /> Conectare în curs...</div>
      )}
    </AuthShell>
  );
}
