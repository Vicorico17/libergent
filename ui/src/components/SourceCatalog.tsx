"use client";

import { useEffect, useState } from "react";

type Source = { domain: string; tier: "free" | "premium"; status: string; selection: string };

export function SourceCatalog() {
  const [sources, setSources] = useState<Source[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/sources", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Source catalog unavailable");
        const payload = await response.json();
        if (!Array.isArray(payload.sources)) throw new Error("Invalid source catalog");
        setSources(payload.sources);
      }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, []);

  return (
    <section id="surse" className="border-t border-[#111111] px-6 py-10 md:px-12" aria-labelledby="source-catalog-title">
      <h2 id="source-catalog-title" className="text-2xl font-bold">Marketplace-uri Free și Premium</h2>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed">
        Alegem sursele în funcție de produsul căutat. Free include marketplace-uri second-hand și repere de preț nou.
        Premium extinde comparația cu magazine specializate. Numărul de surse nu garantează un rezultat mai bun sau disponibilitatea unui produs.
      </p>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed">
        Sursele experimentale sunt în evaluare și pot să nu returneze oferte. Raportul fiecărei căutări arată ce surse au răspuns.
        Facebook Marketplace nu este integrat în căutarea automată.
      </p>
      {failed ? <p role="status" className="mt-4">Lista surselor nu poate fi încărcată acum. Reîncarcă pagina pentru a încerca din nou.</p> : !sources.length ? <p role="status" className="mt-4">Se încarcă sursele…</p> : (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {(["free", "premium"] as const).map((tier) => (
            <div key={tier}>
              <h3 className="mb-3 text-lg font-bold">{tier === "free" ? "Free" : "Premium · în evaluare"}</h3>
              <ul className="grid gap-2 text-sm sm:grid-cols-2">
                {sources.filter((source) => source.tier === tier).map((source) => (
                  <li key={source.domain} className="border border-[#11111133] p-3">
                    <span className="font-semibold">{source.domain}</span>
                    <span className="mt-1 block text-xs text-[#555]">
                      {source.status === "experimental" ? "Experimental · " : ""}
                      {source.selection === "vehicles" ? "Autoturisme" : source.selection === "refurbished-tech" ? "Tehnologie recondiționată" : "În funcție de căutare"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
