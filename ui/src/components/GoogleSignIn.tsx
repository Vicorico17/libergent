"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSafeNextPath } from "@/lib/auth-path";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type AuthState = "checking" | "signed_out" | "sending" | "email_sent";
type SocialProvider = "google" | "apple" | "facebook";

function friendlyAuthError(message = "") {
  if (/provider.*not enabled|unsupported provider/i.test(message)) return "Această metodă de conectare nu este activată încă.";
  if (/rate limit|too many requests/i.test(message)) return "Prea multe încercări. Așteaptă puțin și încearcă din nou.";
  if (/invalid email/i.test(message)) return "Introdu o adresă de email validă.";
  return message || "Autentificarea nu a putut fi finalizată.";
}

export function SignInOptions({ submitLabel = "Trimite link de conectare" }: { submitLabel?: string }) {
  const router = useRouter();
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
      } else {
        setState("signed_out");
      }
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

  async function signInWithSocial(provider: SocialProvider) {
    const client = getSupabaseBrowserClient();
    if (!client) {
      setState("signed_out");
      setMessage("Autentificarea nu este configurată încă.");
      return;
    }

    setState("sending");
    setMessage("");
    const { error } = await client.auth.signInWithOAuth({
      provider,
      options: { redirectTo: authRedirectUrl() }
    });
    if (error) {
      setState("signed_out");
      setMessage(friendlyAuthError(error.message));
    }
  }

  async function sendMagicLink(event: FormEvent) {
    event.preventDefault();
    const client = getSupabaseBrowserClient();
    const normalizedEmail = email.trim().toLowerCase();
    if (!client || !normalizedEmail) return;

    setState("sending");
    setMessage("");
    const { error } = await client.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: authRedirectUrl(),
        shouldCreateUser: true,
      }
    });
    if (error) {
      setState("signed_out");
      setMessage(friendlyAuthError(error.message));
      return;
    }
    setState("email_sent");
    setMessage(`Am trimis linkul către ${normalizedEmail}. Verifică și folderul Spam.`);
  }

  const busy = state === "checking" || state === "sending";

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
          disabled={busy}
          className="inline-flex min-h-12 justify-center items-center gap-3 px-5 py-3 text-[12px] font-bold uppercase disabled:opacity-60"
          style={{ background: option.provider === "apple" ? "white" : "#111111", color: option.provider === "apple" ? "#111111" : "#F3F0E7", border: "2px solid #111111" }}
        >
          <span aria-hidden="true" className="text-[18px] leading-none">{option.symbol}</span>
          {state === "sending" ? "Se deschide..." : option.label}
        </button>
      ))}
      <div className="flex items-center gap-3 py-1 text-[10px] font-bold uppercase" style={{ color: "#11111188" }}><span className="h-px flex-1 bg-black/20" />sau<span className="h-px flex-1 bg-black/20" /></div>
      <form onSubmit={sendMagicLink} className="flex flex-col gap-2">
        <label htmlFor="auth-email" className="text-[10px] font-bold uppercase">Email</label>
        <input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nume@exemplu.ro" className="min-h-12 px-4 text-[12px] font-bold outline-none" style={{ border: "2px solid #111111" }} />
        <button type="submit" disabled={busy || !email.trim()} className="min-h-12 px-5 py-3 text-[12px] font-bold uppercase disabled:opacity-50" style={{ background: "#FF4F8B", color: "#111111", border: "2px solid #111111" }}>
          {state === "sending" ? "Se trimite..." : state === "email_sent" ? "Retrimite linkul" : submitLabel}
        </button>
      </form>
      {message ? <p role="status" className="text-[10px] font-bold uppercase leading-relaxed" style={{ color: state === "email_sent" ? "#198754" : "#FF4F8B" }}>{message}</p> : null}
      <p className="text-[9px] font-bold uppercase leading-relaxed" style={{ color: "#11111177" }}>Nu ai nevoie de parolă. Linkul de email este valabil o perioadă limitată.</p>
      <p className="text-[9px] font-bold uppercase leading-relaxed" style={{ color: "#11111177" }}>Prin continuare accepți <Link href="/termeni" className="underline">termenii</Link> și <Link href="/confidentialitate" className="underline">politica de confidențialitate</Link>.</p>
    </div>
  );
}
