"use client";

import { useEffect, useRef } from "react";
import { Coins, Plus, X } from "lucide-react";
import { CreditPackPicker } from "@/components/BillingAction";
import { useCreditWallet, type CreditWallet } from "@/lib/use-credit-wallet";

export function CreditBalance({ wallet, onRefresh }: { wallet: CreditWallet; onRefresh: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const open = () => dialog.current?.showModal();
    window.addEventListener("libergent:topup", open);
    return () => window.removeEventListener("libergent:topup", open);
  }, []);
  if (!wallet.enabled) return null;
  const low = wallet.balance <= 3;
  return <>
    <section aria-label="Credite Premium" className="flex flex-wrap items-center justify-between gap-4 border-2 border-[#111] bg-white p-4 sm:p-5" style={{ boxShadow: "4px 4px 0 #111" }}>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center border border-[#111] bg-[#FCE7F3]"><Coins size={22} /></span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider">{wallet.premium ? "Premium · căutarea ta implicită" : "Credite de căutare"}</p>
          <p aria-live="polite" className="mt-1 text-xl font-bold">{wallet.balance} <span className="text-sm font-normal">{wallet.balance === 1 ? "credit disponibil" : "credite disponibile"}</span></p>
        </div>
      </div>
      <button type="button" onClick={() => dialog.current?.showModal()} className="flex min-h-11 items-center gap-2 border border-[#111] bg-[#FF4B8B] px-4 text-xs font-bold"><Plus size={15} />Adaugă credite</button>
      <div className="basis-full text-xs leading-relaxed text-[#111]/70">
        {wallet.included} incluse · {wallet.purchased} cumpărate · 1 credit / căutare
        {wallet.renewsAt && <span className="block">Creditele incluse expiră pe {new Date(wallet.renewsAt).toLocaleDateString("ro-RO")}. Primești altele la reînnoirea plătită.</span>}
        {low && <p className="mt-2 font-semibold text-[#9B1748]">{wallet.balance === 0 ? "Creditele s-au terminat. Adaugă un pachet și continuă în Premium. Rezultatele tale rămân disponibile." : "Mai ai doar câteva căutări. Poți adăuga credite oricând."}</p>}
      </div>
    </section>
    <dialog ref={dialog} aria-labelledby="credit-topup-title" onClose={onRefresh} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto border-2 border-[#111] bg-[#F3F0E7] p-5 text-[#111] shadow-[6px_6px_0_#111] backdrop:bg-black/45 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-xs uppercase">Mai multe oferte, când ai nevoie</p><h2 id="credit-topup-title" className="mt-2 text-2xl font-bold">Adaugă credite</h2></div>
        <button type="button" aria-label="Închide" onClick={() => dialog.current?.close()} className="flex h-11 w-11 shrink-0 items-center justify-center border border-[#111]"><X size={20} /></button>
      </div>
      <p className="mt-3 text-sm">Ai {wallet.balance} credite. O căutare Premium folosește 1 credit.</p>
      <CreditPackPicker />
      <p className="mt-4 text-xs">După plată te întorci aici. Căutarea și filtrele tale sunt păstrate.</p>
    </dialog>
  </>;
}

export function AccountCreditBalance() {
  const { wallet, error, reload, account } = useCreditWallet();
  if (account.status !== "signed_in") return null;
  if (error) return <div role="alert" className="border border-black bg-white p-4 text-sm">{error} <button onClick={() => void reload()} className="ml-2 min-h-11 underline">Încearcă din nou</button></div>;
  if (!wallet) return <p role="status" className="p-4 text-sm">Încărcăm creditele…</p>;
  return <CreditBalance wallet={wallet} onRefresh={() => void reload()} />;
}
