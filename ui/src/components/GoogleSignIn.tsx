"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSafeNextPath } from "@/lib/auth-path";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

import { friendlyAuthError, normalizedAuthEmail } from "@/lib/auth-flow.mjs";

type AuthState = "signed_out" | "sending_email" | "opening_google" | "email_sent";

export function SignInOptions({ submitLabel = "Trimite link de conectare" }: { submitLabel?: string }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>("signed_out");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [configured] = useState(() => Boolean(getSupabaseBrowserClient()));
  const requestPending = useRef(false);
  const resendAt = useRef(0);

  useEffect(() => {
    const timer = window.setInterval(() => setCooldown(Math.max(0, Math.ceil((resendAt.current - Date.now()) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, []);

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
    const finishSignIn = () => {
      if (!mounted) return;
      router.replace(getSafeNextPath(window.location.search));
    };

    client.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        setState("signed_out");
        setMessage(friendlyAuthError(error.message));
      } else if (data.session) {
        finishSignIn();
      }
    }).catch((error) => {
      if (mounted) setMessage(friendlyAuthError(error));
    });

    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (session && event !== "INITIAL_SESSION") finishSignIn();
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  function authRedirectUrl() {
    const next = getSafeNextPath(window.location.search);
    return `${window.location.origin}/confirm?next=${encodeURIComponent(next)}`;
  }

  async function signInWithSocial() {
    const client = getSupabaseBrowserClient();
    if (!client || requestPending.current) return;
    requestPending.current = true;
    setState("opening_google");
    setMessage("");
    try {
      const { error } = await client.auth.signInWithOAuth({
        provider: "google", options: { redirectTo: authRedirectUrl() }
      });
      if (error) throw error;
    } catch (error) {
      setMessage(friendlyAuthError(error));
    } finally {
      requestPending.current = false;
      setState("signed_out");
    }
  }

  async function sendMagicLink(event: FormEvent) {
    event.preventDefault();
    const client = getSupabaseBrowserClient();
    if (!client || requestPending.current || Date.now() < resendAt.current) return;
    const normalizedEmail = normalizedAuthEmail(email);
    if (!normalizedEmail) {
      setMessage("Introdu o adresă de email validă.");
      return;
    }
    requestPending.current = true;
    setState("sending_email");
    setMessage("");
    try {
      const { error } = await client.auth.signInWithOtp({
        email: normalizedEmail,
        options: { emailRedirectTo: authRedirectUrl(), shouldCreateUser: true }
      });
      if (error) throw error;
      resendAt.current = Date.now() + 60_000;
      setCooldown(60);
      setState("email_sent");
      setMessage(`Am solicitat un link pentru ${normalizedEmail}. Verifică inboxul și folderul Spam. Deschide cel mai recent link pentru a continua.`);
    } catch (error) {
      setState("signed_out");
      setMessage(friendlyAuthError(error));
    } finally {
      requestPending.current = false;
    }
  }

  const busy = state === "sending_email" || state === "opening_google";

  return (
    <div className="flex flex-col gap-3">
      {([
        { provider: "google" as const, symbol: "G", label: "Continuă cu Google" },
      ]).map((option) => (
        <button
          key={option.provider}
          type="button"
          onClick={signInWithSocial}
          disabled={busy || !configured}
          className="inline-flex min-h-12 justify-center items-center gap-3 px-5 py-3 text-[12px] font-bold uppercase disabled:opacity-60"
          style={{ background: "#111111", color: "#F3F0E7", border: "2px solid #111111" }}
        >
          <span aria-hidden="true" className="text-[18px] leading-none">{option.symbol}</span>
          {state === "opening_google" ? "Se deschide..." : option.label}
        </button>
      ))}
      <div className="flex items-center gap-3 py-1 text-[10px] font-bold uppercase" style={{ color: "#11111188" }}><span className="h-px flex-1 bg-black/20" />sau<span className="h-px flex-1 bg-black/20" /></div>
      <form aria-busy={state === "sending_email"} onSubmit={sendMagicLink} className="flex flex-col gap-2">
        <label htmlFor="auth-email" className="text-[10px] font-bold uppercase">Email</label>
        <input id="auth-email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} disabled={busy || !configured} required value={email} onChange={(event) => { setEmail(event.target.value); setMessage(""); setState("signed_out"); }} placeholder="nume@exemplu.ro" className="min-h-12 px-4 text-[12px] font-bold outline-none" style={{ border: "2px solid #111111" }} />
        <button type="submit" disabled={busy || !configured || cooldown > 0 || !email.trim()} className="min-h-12 px-5 py-3 text-[12px] font-bold uppercase disabled:opacity-50" style={{ background: "#FF4F8B", color: "#111111", border: "2px solid #111111" }}>
          {state === "sending_email" ? "Se trimite..." : cooldown > 0 ? `Poți retrimite în ${cooldown}s` : state === "email_sent" ? "Retrimite linkul" : submitLabel}
        </button>
      </form>
      {message ? <p role="status" className="text-[10px] font-bold uppercase leading-relaxed" style={{ color: state === "email_sent" ? "#198754" : "#FF4F8B" }}>{message}</p> : null}
      <p className="text-[9px] font-bold uppercase leading-relaxed" style={{ color: "#11111177" }}>Nu ai nevoie de parolă. Linkul de email este valabil o perioadă limitată.</p>
      <p className="text-[9px] font-bold uppercase leading-relaxed" style={{ color: "#11111177" }}>Prin continuare accepți <Link href="/termeni" className="underline">termenii</Link> și <Link href="/confidentialitate" className="underline">politica de confidențialitate</Link>.</p>
    </div>
  );
}
