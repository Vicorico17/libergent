import Link from "next/link";
import { LogoIcon } from "@/components/LogoIcon";

const CREAM = "#F3F0E7";
const INK = "#111111";
const PINK = "#FF4F8B";
const MONO = "var(--font-mono-var), monospace";

export function AuthDisabled() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: CREAM, color: INK, fontFamily: MONO }}
    >
      <section
        className="w-full max-w-lg p-6 sm:p-8 flex flex-col gap-6"
        style={{ border: `2px solid ${INK}`, boxShadow: `6px 6px 0 ${INK}`, background: "white" }}
      >
        <Link href="/" className="flex items-center gap-3 w-fit">
          <LogoIcon size={28} />
          <span className="text-[14px] font-bold uppercase tracking-widest">
            LiberGent<span style={{ color: PINK }}>.</span>
          </span>
        </Link>

        <div className="flex flex-col gap-3">
          <h1 className="text-[22px] sm:text-[28px] font-bold uppercase leading-tight">
            Conturile sunt dezactivate temporar
          </h1>
          <p className="text-[13px] leading-relaxed uppercase" style={{ color: `${INK}B3` }}>
            Căutarea rămâne disponibilă fără autentificare. Fluxurile de cont vor reveni când sunt conectate la infrastructura finală.
          </p>
        </div>

        <Link
          href="/search"
          className="inline-flex justify-center items-center px-5 py-3 text-[12px] font-bold uppercase"
          style={{ background: INK, color: "white", border: `2px solid ${INK}` }}
        >
          Mergi la căutare
        </Link>
      </section>
    </main>
  );
}
