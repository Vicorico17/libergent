const testimonials = [
  {
    stars: 5,
    quote:
      "Am găsit exact ce căutam în 10 minute, în loc de 2 ore pe OLX. LiberGent a schimbat complet cum cumpăr second-hand.",
    name: "Andreea M.",
    location: "Cluj-Napoca",
    avatar: "AM",
    avatarColor: "#4F7CFF",
  },
  {
    stars: 5,
    quote:
      "Nu mai pierd vremea scrollând prin mii de anunțuri. LiberGent face asta pentru mine și îmi trimite direct ce e relevant.",
    name: "Mihai T.",
    location: "București",
    avatar: "MT",
    avatarColor: "#A259FF",
  },
  {
    stars: 5,
    quote:
      "Simplu, rapid, exact ce trebuia. Am economisit mult timp și am găsit produse la prețuri mult mai bune decât mă așteptam.",
    name: "Cristina P.",
    location: "Timișoara",
    avatar: "CP",
    avatarColor: "#FFC857",
  },
];

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 14 14" fill="#FFC857">
          <path d="M7 1l1.5 4h4.3l-3.5 2.5 1.3 4L7 9l-3.6 2.5 1.3-4L1.2 5h4.3L7 1z" />
        </svg>
      ))}
    </div>
  );
}

export function Testimonials() {
  return (
    <section className="bg-white py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-xs font-pixel text-[#FFC857] mb-4 tracking-widest uppercase">
            Testimoniale
          </p>
          <h2
            className="font-pixel text-[#111111]"
            style={{ fontSize: "clamp(16px, 3vw, 32px)", lineHeight: 1.2 }}
          >
            Ce spun utilizatorii.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="bg-[#F8F9FA] rounded-2xl p-6 flex flex-col gap-4"
              style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.06)" }}
            >
              <Stars count={t.stars} />
              <p className="text-[#111111] text-sm leading-relaxed flex-1">“{t.quote}”</p>
              <div className="flex items-center gap-3 pt-2 border-t border-[#D9D9D9]">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: t.avatarColor }}
                >
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#111111]">{t.name}</p>
                  <p className="text-xs text-[#6B6B6B]">{t.location}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
