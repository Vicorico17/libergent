import Link from "next/link";
import { LogoIcon } from "@/components/LogoIcon";
import { SignInOptions } from "@/components/GoogleSignIn";

const CREAM = "#F3F0E7";
const INK = "#111111";
const PINK = "#FF4F8B";
const MONO = "var(--font-mono-var), monospace";

export default function AuthPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ background: CREAM, color: INK, fontFamily: MONO }}>
      <section className="w-full max-w-lg p-6 sm:p-8 flex flex-col gap-6" style={{ border: `2px solid ${INK}`, boxShadow: `6px 6px 0 ${INK}`, background: "white" }}>
        <Link href="/" className="flex items-center gap-3 w-fit">
          <LogoIcon size={28} />
          <span className="text-[14px] font-bold uppercase tracking-widest">LiberGent<span style={{ color: PINK }}>.</span></span>
        </Link>
        <div className="flex flex-col gap-3">
          <h1 className="text-[22px] sm:text-[28px] font-bold uppercase leading-tight">Conectează-te la LiberGent</h1>
          <p className="text-[13px] leading-relaxed uppercase" style={{ color: `${INK}B3` }}>
            Conectează-te pentru favorite, analiza ofertelor, contactarea sellerilor și istoricul privat al conversațiilor.
          </p>
        </div>
        <SignInOptions />
        <p className="text-[10px] font-bold uppercase leading-relaxed" style={{ color: `${INK}88` }}>
          Prin conectare accepți <Link href="/termeni" className="underline" style={{ color: INK }}>termenii</Link> și <Link href="/confidentialitate" className="underline" style={{ color: INK }}>politica de confidențialitate</Link>.
        </p>
      </section>
    </main>
  );
}
