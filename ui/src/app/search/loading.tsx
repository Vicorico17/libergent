import { MascotSVG } from "@/components/MascotSVG";

export default function SearchLoading() {
  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <header className="bg-white border-b border-[#D9D9D9] sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-3">
          <MascotSVG size={28} />
          <span className="font-pixel text-[#111111]" style={{ fontSize: "11px" }}>
            LiberGent
          </span>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-20">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <MascotSVG size={64} className="mb-4 animate-pulse" />
          <p className="font-semibold text-[#111111] mb-1">Caut oferte relevante...</p>
          <p className="text-sm text-[#6B6B6B]">Verific marketplace-urile conectate la Libergent.</p>
        </div>
      </main>
    </div>
  );
}
