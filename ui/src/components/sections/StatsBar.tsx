const stats = [
  { value: "12.400+", label: "Produse găsite" },
  { value: "48", label: "Platforme scanate" },
  { value: "6", label: "Categorii active" },
];

export function StatsBar() {
  return (
    <section className="bg-white border-y border-[#D9D9D9]">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="grid grid-cols-3 divide-x divide-[#D9D9D9]">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col items-center text-center px-6 gap-1.5">
              <span
                className="font-pixel text-[#111111]"
                style={{ fontSize: "clamp(20px, 4vw, 40px)", lineHeight: 1.1 }}
              >
                {s.value}
              </span>
              <span className="text-sm text-[#6B6B6B] font-medium">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
