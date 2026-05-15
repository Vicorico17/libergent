const BG   = "#F5F2EB";
const INK  = "#111111";
const PINK = "#FF2A6D";
const MONO = "var(--font-mono-var), monospace";

const TESTIMONIALS = [
  {
    id: "01",
    initials: "AM",
    name: "Andreea M.",
    city: "Cluj-Napoca",
    quote:
      "Am găsit exact ce căutam în 10 minute, în loc de 2 ore pe OLX. LiberGent a schimbat complet cum cumpăr second-hand.",
  },
  {
    id: "02",
    initials: "MT",
    name: "Mihai T.",
    city: "București",
    quote:
      "Nu mai pierd vremea scrollând prin mii de anunțuri. LiberGent face asta pentru mine și îmi trimite direct ce e relevant.",
  },
  {
    id: "03",
    initials: "CP",
    name: "Cristina P.",
    city: "Timișoara",
    quote:
      "Simplu, rapid, exact ce trebuia. Am economisit mult timp și am găsit produse la prețuri mult mai bune decât mă așteptam.",
  },
];

const CORNERS = [
  "top-[2px] left-[2px]",
  "top-[2px] right-[2px]",
  "bottom-[2px] left-[2px]",
  "bottom-[2px] right-[2px]",
];

export function FeaturesGrid() {
  return (
    <section style={{ background: BG, fontFamily: MONO }} className="px-6 py-16 lg:py-24">
      <div className="max-w-[1280px] mx-auto">

        {/* Section header */}
        <div className="text-center mb-16 flex flex-col items-center">
          <div
            className="text-[11px] tracking-widest uppercase mb-6 font-normal"
            style={{ color: PINK }}
          >
            05 / TESTIMONIALE
          </div>

          <div className="flex items-end justify-center gap-2 mb-6">
            <h2
              className="font-bold tracking-tight leading-[0.95]"
              style={{ fontFamily: MONO, fontSize: "clamp(36px, 5vw, 68px)", color: INK }}
            >
              Ce spun utilizatorii.
            </h2>
            <div
              className="animate-pulse shrink-0 mb-2"
              style={{ width: 12, height: 12, background: PINK }}
            />
          </div>

          <div className="flex items-start gap-3 max-w-md text-left">
            <div className="shrink-0 mt-[7px]" style={{ width: 8, height: 8, background: PINK }} />
            <p className="text-[15px] font-normal leading-relaxed" style={{ color: INK }}>
              Povești reale de la oameni care caută mai repede și aleg mai bine.
            </p>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {TESTIMONIALS.map((t) => (
            <article
              key={t.id}
              className="relative flex flex-col hover:-translate-y-1 transition-transform duration-300 group"
              style={{ border: `1px solid ${INK}`, padding: "32px" }}
            >
              {/* Corner pixel marks */}
              {CORNERS.map((pos) => (
                <div
                  key={pos}
                  className={`absolute ${pos} w-1 h-1`}
                  style={{ background: INK }}
                />
              ))}

              {/* Card top: rating squares + label */}
              <div className="flex justify-between items-center mb-10 text-[11px] tracking-widest">
                <div className="flex gap-1.5">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} style={{ width: 10, height: 10, background: PINK }} />
                  ))}
                </div>
                <span className="font-normal uppercase" style={{ color: INK }}>
                  USER REPORT {t.id}
                </span>
              </div>

              {/* Quote */}
              <p
                className="text-[15px] leading-[1.8] flex-grow font-normal"
                style={{ color: INK }}
              >
                "{t.quote}"
              </p>

              {/* Card bottom */}
              <div
                className="flex justify-between items-end mt-10 pt-5"
                style={{ borderTop: `1px solid ${INK}` }}
              >
                <div className="flex items-center gap-4">
                  {/* Avatar badge */}
                  <div className="p-[1px]" style={{ background: INK }}>
                    <div
                      className="w-10 h-10 flex items-center justify-center text-[13px] font-normal"
                      style={{ background: BG, color: INK }}
                    >
                      {t.initials}
                    </div>
                  </div>
                  <div className="text-[12px]">
                    <div className="font-bold" style={{ color: INK }}>{t.name}</div>
                    <div className="mt-0.5" style={{ color: `${INK}B3` }}>{t.city}</div>
                  </div>
                </div>

                {/* Arrow — translates right on group hover */}
                <div className="transition-transform duration-300 group-hover:translate-x-1.5">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 12h14M12 5l7 7-7 7"
                      stroke={PINK}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            </article>
          ))}
        </div>

      </div>
    </section>
  );
}
