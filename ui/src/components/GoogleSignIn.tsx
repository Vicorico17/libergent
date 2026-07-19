"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type AuthState = "checking" | "signed_out" | "signed_in" | "error";

function getSafeNextPath() {
  if (typeof window === "undefined") return "/";
  const next = new URLSearchParams(window.location.search).get("next") || "/";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export function GoogleSignIn() {
  const [state, setState] = useState<AuthState>("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      queueMicrotask(() => {
        setState("error");
        setMessage("Autentificarea Google nu este configurată încă.");
      });
      return;
    }

    let mounted = true;
    client.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        setState("error");
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

  async function signInWithGoogle() {
    const client = getSupabaseBrowserClient();
    if (!client) {
      setState("error");
      setMessage("Autentificarea Google nu este configurată încă.");
      return;
    }

    setState("checking");
    setMessage("");
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth?next=${encodeURIComponent(getSafeNextPath())}` }
    });
    if (error) {
      setState("error");
      setMessage(error.message);
    }
  }

  if (state === "signed_in") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[12px] font-bold uppercase">Ești conectat cu Google.</p>
        <Link href={getSafeNextPath()} className="inline-flex justify-center items-center px-5 py-3 text-[12px] font-bold uppercase" style={{ background: "#111111", color: "#F3F0E7", border: "2px solid #111111" }}>
          Mergi la căutare
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={state === "checking" || state === "error"}
        className="inline-flex min-h-12 justify-center items-center gap-3 px-5 py-3 text-[12px] font-bold uppercase disabled:opacity-60"
        style={{ background: "#111111", color: "#F3F0E7", border: "2px solid #111111" }}
      >
        <span aria-hidden="true" className="text-[18px] leading-none">G</span>
        {state === "checking" ? "Se verifică..." : "Continuă cu Google"}
      </button>
      {message ? <p className="text-[10px] font-bold uppercase leading-relaxed" style={{ color: "#FF4F8B" }}>{message}</p> : null}
    </div>
  );
}
