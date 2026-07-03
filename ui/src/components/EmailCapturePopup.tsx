"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Mail, Send, X } from "lucide-react";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const INK = "#111111";
const CREAM = "#F5F3EE";
const PINK = "#FF3366";
const GREEN = "#22C55E";
const MONO = "var(--font-mono-var), monospace";
const EMAIL_CAPTURE_DELAY_MS = 8000;

const STORAGE_KEYS = {
  prompted: "libergent_email_capture_prompted",
  submitted: "libergent_email_capture_submitted",
  dismissed: "libergent_email_capture_dismissed",
};

type LeadResponse = {
  ok?: boolean;
  error?: string;
};

type EmailCapturePopupProps = {
  enabled: boolean;
  query: string;
  resultCount: number;
  bestOfferSource?: string;
};

function hasCaptureStorageFlag() {
  try {
    return Boolean(
      window.localStorage.getItem(STORAGE_KEYS.submitted) ||
        window.localStorage.getItem(STORAGE_KEYS.dismissed) ||
        window.localStorage.getItem(STORAGE_KEYS.prompted)
    );
  } catch {
    return true;
  }
}

function setCaptureStorageFlag(key: string) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // Storage can be unavailable in privacy-restricted browsers.
  }
}

function trackLeadEvent(action: string, query: string) {
  window.gtag?.("event", action, {
    event_category: "email_capture",
    method: "search_results_popup",
    search_term: query,
  });
}

export function EmailCapturePopup({
  enabled,
  query,
  resultCount,
  bestOfferSource,
}: EmailCapturePopupProps) {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!enabled || resultCount <= 0 || hasCaptureStorageFlag()) {
      return;
    }

    timerRef.current = setTimeout(() => {
      if (hasCaptureStorageFlag()) return;
      setCaptureStorageFlag(STORAGE_KEYS.prompted);
      setVisible(true);
      trackLeadEvent("email_capture_view", query);
    }, EMAIL_CAPTURE_DELAY_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, query, resultCount]);

  if (!visible) {
    return null;
  }

  function closePopup() {
    setCaptureStorageFlag(STORAGE_KEYS.dismissed);
    setVisible(false);
    trackLeadEvent("email_capture_dismiss", query);
  }

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setStatus("error");
      setMessage("Introdu un email valid.");
      return;
    }

    setStatus("submitting");
    setMessage("");

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          source: "search_results_popup",
          query,
          pagePath: window.location.pathname + window.location.search,
        }),
      });
      const payload = (await response.json()) as LeadResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Emailul nu a putut fi salvat.");
      }

      setCaptureStorageFlag(STORAGE_KEYS.submitted);
      setStatus("success");
      setMessage("Gata. Ești pe lista LiberGent pentru update-uri și teste noi.");
      trackLeadEvent("generate_lead", query);
      window.setTimeout(() => setVisible(false), 1400);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Emailul nu a putut fi salvat.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/35 px-4 py-5 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-capture-title"
      style={{ fontFamily: MONO }}
    >
      <div
        className="w-full max-w-[520px]"
        style={{
          border: `1px solid ${INK}`,
          background: CREAM,
          boxShadow: `6px 6px 0 0 ${INK}`,
        }}
      >
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: `1px solid ${INK}`, background: "white" }}
        >
          <div className="flex items-center gap-2 text-[12px] font-bold uppercase">
            <Mail size={16} strokeWidth={2} aria-hidden="true" />
            Lista LiberGent
          </div>
          <button
            type="button"
            onClick={closePopup}
            className="flex h-8 w-8 items-center justify-center"
            style={{ border: `1px solid ${INK}`, color: INK }}
            aria-label="Închide"
          >
            <X size={16} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: PINK }}>
              {resultCount} rezultate găsite{bestOfferSource ? ` / best pick pe ${bestOfferSource}` : ""}
            </p>
            <h2 id="email-capture-title" className="text-[24px] font-bold uppercase leading-tight" style={{ color: INK }}>
              Intră pe lista pentru update-uri LiberGent.
            </h2>
            <p className="text-[12px] font-bold uppercase leading-relaxed" style={{ color: `${INK}AA` }}>
              Pentru „{query}”, îți putem trimite update-uri despre produs, funcții noi și, când activăm fluxul, notificări despre oferte relevante.
            </p>
          </div>

          <form onSubmit={submitEmail} className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row" style={{ border: `1px solid ${INK}` }}>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="email@exemplu.ro"
                className="min-h-12 flex-1 bg-white px-4 text-[13px] font-bold outline-none"
                style={{ color: INK, fontFamily: MONO }}
                autoComplete="email"
                required
              />
              <button
                type="submit"
                disabled={status === "submitting" || status === "success"}
                className="flex min-h-12 items-center justify-center gap-2 px-5 text-[11px] font-bold uppercase disabled:opacity-60"
                style={{ background: INK, color: CREAM, borderTop: `1px solid ${INK}`, fontFamily: MONO }}
              >
                {status === "submitting" ? "Trimit..." : status === "success" ? "Salvat" : "Trimite"}
                <Send size={14} strokeWidth={2.2} aria-hidden="true" />
              </button>
            </div>

            {message ? (
              <p
                className="text-[11px] font-bold uppercase leading-relaxed"
                style={{ color: status === "success" ? GREEN : PINK }}
              >
                &gt; {message}
              </p>
            ) : null}

            <p className="text-[10px] font-bold uppercase leading-relaxed" style={{ color: `${INK}88` }}>
              Fără spam. Poți cere ștergerea datelor oricând. Detalii în{" "}
              <Link href="/confidentialitate" className="underline" style={{ color: INK }}>
                politica de confidențialitate
              </Link>
              .
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
