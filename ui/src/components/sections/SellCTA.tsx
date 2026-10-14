import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function SellCTA() {
  return (
    <section className="border-y-2 border-[#101010] bg-[#FF4F8B] px-6 py-10 text-[#101010]">
      <div className="mx-auto flex max-w-[1280px] flex-col justify-between gap-6 sm:flex-row sm:items-center">
        <div><p className="mb-3 font-mono text-xs font-bold tracking-widest">AI CEVA DE VÂNZARE?</p><h2 className="text-2xl font-bold sm:text-3xl">Un produs. Mai multe marketplace-uri.</h2><p className="mt-2 text-sm">Pregătești anunțul o singură dată. Îl refolosești oriunde vinzi.</p></div>
        <Link href="/vinde" className="inline-flex items-center justify-center gap-8 border-2 border-[#101010] bg-[#F3F0E7] px-8 py-4 font-mono font-bold shadow-[4px_4px_0_#101010] transition-transform hover:-translate-y-1">VINDE <ArrowUpRight size={20} aria-hidden="true" /></Link>
      </div>
    </section>
  );
}
