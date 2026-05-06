import Link from "next/link";
import { MascotSVG } from "../MascotSVG";

export function FinalCTA() {
  return (
    <section className="bg-[#111111] py-24 px-6">
      <div className="max-w-2xl mx-auto flex flex-col items-center text-center gap-8">
        <MascotSVG size={80} color="#ffffff" />

        <div>
          <h2
            className="font-pixel text-white mb-4"
            style={{ fontSize: "clamp(18px, 3.5vw, 36px)", lineHeight: 1.3 }}
          >
            Gata să găsești
            <br />
            ce cauți?
          </h2>
          <p className="text-[#6B6B6B] text-base">
            Fără card. Fără complicații.
          </p>
        </div>

        {/* Colored pillars */}
        <div className="flex items-center gap-3 text-base font-semibold">
          <span className="text-[#4F7CFF]">Observă.</span>
          <span className="text-[#A259FF]">Analizează.</span>
          <span className="text-[#FFC857]">Livrează.</span>
        </div>

        <Link
          href="/auth"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[#4F7CFF] text-white font-semibold text-base hover:bg-[#3d6aec] transition-colors"
        >
          Caută acum — e gratuit
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 2l6 6-6 6M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </Link>
      </div>
    </section>
  );
}
