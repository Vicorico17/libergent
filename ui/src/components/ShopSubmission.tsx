"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, Check, Plus } from "lucide-react";

export function ShopSubmission() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const sending = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    sending.current = true;
    setStatus("sending");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("/api/shop-suggestions", {
        method: "POST", headers: { "content-type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ name: data.get("name"), url: data.get("url"), niche: data.get("niche"), note: data.get("note") }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error("Submission failed");
      setStatus("sent");
      form.reset();
    } catch {
      setStatus("error");
    } finally {
      clearTimeout(timer);
      sending.current = false;
    }
  }
  const fieldClass = "mt-2 block min-h-12 w-full border border-[#111111]/40 bg-white px-3 py-3 text-sm font-normal outline-offset-2 focus:outline-[#111111]";
  return <section className="mt-8 border-2 border-[#111111] bg-[#ffe4ef] p-5 sm:p-6" aria-labelledby="shop-submission-title">
    <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
      <div><h2 id="shop-submission-title" className="text-lg font-bold sm:text-xl">Adăugați magazinul pe LiberGent</h2><p className="mt-2 max-w-xl text-xs leading-relaxed">Propuneți magazinul vostru pentru căutarea LiberGent. Analizăm fiecare propunere înainte de integrare.</p></div>
      <button type="button" aria-expanded={open} aria-controls="shop-submission-form" onClick={() => setOpen(value => !value)} className="flex min-h-12 shrink-0 items-center justify-center gap-2 border-2 border-[#111111] bg-[#111111] px-5 py-3 text-xs font-bold text-white transition-colors hover:bg-[#333] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#111111]">
        <Plus size={16} aria-hidden="true" />{open ? "Închide formularul" : "Adăugați magazinul"}
      </button>
    </div>
    <div id="shop-submission-form" hidden={!open}>
      {status === "sent" ? <p role="status" className="mt-6 flex items-start gap-2 border border-[#15803d] bg-[#dcfce7] p-4 text-sm text-[#166534]"><Check size={18} aria-hidden="true" className="shrink-0" />Propunerea a fost trimisă și așteaptă evaluarea. Mulțumim!</p> : <form onSubmit={submit} className="mt-6 border-t border-[#111111]/20 pt-6">
        <fieldset disabled={status === "sending"} className="grid gap-4 sm:grid-cols-2">
          <legend className="sr-only">Detaliile magazinului</legend>
          <label className="text-xs font-bold">Numele magazinului<input name="name" required minLength={2} maxLength={100} autoComplete="organization" className={fieldClass} /></label>
          <label className="text-xs font-bold">Adresa website-ului<input name="url" type="url" required maxLength={500} placeholder="https://magazin.ro" autoComplete="url" className={fieldClass} /></label>
          <label className="text-xs font-bold sm:col-span-2">Ce produse vindeți?<input name="niche" required minLength={2} maxLength={40} placeholder="Ex. electronice, modă, sport" className={fieldClass} /></label>
          <label className="text-xs font-bold sm:col-span-2">Detalii suplimentare (opțional)<textarea name="note" maxLength={800} rows={3} className={fieldClass} /></label>
          <div className="sm:col-span-2">
            {status === "error" && <p role="alert" className="mb-4 text-sm text-[#9d174d]">Nu am putut confirma trimiterea. Verificați conexiunea și încercați din nou.</p>}
            <button type="submit" className="flex min-h-12 items-center gap-2 border-2 border-[#111111] bg-[#dcfce7] px-5 py-3 text-xs font-bold disabled:opacity-60">{status === "sending" ? "Se trimite…" : "Trimite propunerea"}<ArrowUpRight size={16} aria-hidden="true" /></button>
          </div>
        </fieldset>
      </form>}
    </div>
  </section>;
}
