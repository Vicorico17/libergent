"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type AuthState = "checking" | "signed_out" | "signed_in";
type SocialProvider = "google" | "apple" | "facebook";

function getSafeNextPath() {
  if (typeof window === "undefined") return "/";
  const next = new URLSearchParams(window.location.search).get("next") || "/";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export function SignInOptions() {
  const [state, setState] = useState<AuthState>("checking");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      queueMicrotask(() => {
        setState("signed_out");
        setMessage("Autentificarea nu este configurată încă.");
      });
      return;
    }

    let mounted = true;
    client.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        setState("signed_out");
        setMessage(error.message);
        return;
      }
      setState(data.session ? "signed_in" : "signed_out");
    });

    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      if (mounted) setState(session ? "signed_in" : "signed_out");
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  function authRedirectUrl() {
    return `${window.location.origin}/auth?next=${encodeURIComponent(getSafeNextPath())}`;
  }

  async function signInWithSocial(provider: SocialProvider) {
    const client = getSupabaseBrowserClient();
    if (!client) {
      setState("signed_out");
      setMessage("Autentificarea nu este configurată încă.");
      return;
    }

    setState("checking");
    setMessage("");
    const { error } = await client.auth.signInWithOAuth({
      provider,
      options: { redirectTo: authRedirectUrl() }
    });
    if (error) {
      setState("signed_out");
      setMessage(error.message);
    }
  }

  async function sendMagicLink(event: FormEvent) {
    event.preventDefault();
    const client = getSupabaseBrowserClient();
    const normalizedEmail = email.trim().toLowerCase();
    if (!client || !normalizedEmail) return;

    setState("checking");
    setMessage("");
    const { error } = await client.auth.signInWithOtp({
      email: normalizedEmail,
      options: { emailRedirectTo: authRedirectUrl() }
    });
    setState("signed_out");
    setMessage(error ? error.message : "Ți-am trimis un link de conectare pe email.");
  }

  if (state === "signed_in") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[12px] font-bold uppercase">Ești conectat la contul tău LiberGent.</p>
        <Link href={getSafeNextPath()} className="inline-flex justify-center items-center px-5 py-3 text-[12px] font-bold uppercase" style={{ background: "#111111", color: "#F3F0E7", border: "2px solid #111111" }}>
          Mergi la căutare
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {([
        { provider: "google" as const, symbol: "G", label: "Continuă cu Google" },
        { provider: "apple" as const, symbol: "A", label: "Continuă cu Apple" },
        { provider: "facebook" as const, symbol: "f", label: "Continuă cu Facebook" },
      ]).map((option) => (
        <button
          key={option.provider}
          type="button"
          onClick={() => signInWithSocial(option.provider)}
          disabled={state === "checking"}
          className="inline-flex min-h-12 justify-center items-center gap-3 px-5 py-3 text-[12px] font-bold uppercase disabled:opacity-60"
          style={{ background: option.provider === "apple" ? "white" : "#111111", color: option.provider === "apple" ? "#111111" : "#F3F0E7", border: "2px solid #111111" }}
        >
          <span aria-hidden="true" className="text-[18px] leading-none">{option.symbol}</span>
          {state === "checking" ? "Se verifică..." : option.label}
        </button>
      ))}
      <div className="flex items-center gap-3 py-1 text-[10px] font-bold uppercase" style={{ color: "#11111188" }}><span className="h-px flex-1 bg-black/20" />sau<span className="h-px flex-1 bg-black/20" /></div>
      <form onSubmit={sendMagicLink} className="flex flex-col gap-2">
        <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="EMAIL" className="min-h-12 px-4 text-[12px] font-bold uppercase outline-none" style={{ border: "2px solid #111111" }} />
        <button type="submit" disabled={state === "checking" || !email.trim()} className="min-h-12 px-5 py-3 text-[12px] font-bold uppercase disabled:opacity-50" style={{ background: "#FF4F8B", color: "#111111", border: "2px solid #111111" }}>
          Trimite link de conectare
        </button>
      </form>
      {message ? <p className="text-[10px] font-bold uppercase leading-relaxed" style={{ color: "#FF4F8B" }}>{message}</p> : null}
    </div>
  );
}
