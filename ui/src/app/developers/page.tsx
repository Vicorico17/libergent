import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { DeveloperPortal } from "@/components/DeveloperPortal";

export const metadata: Metadata = {
  title: "Developer API",
  description: "Add marketplace product search to your app. Try a demo, create test and live API keys, and start with a copy-and-paste request.",
  alternates: { canonical: "/developers/" },
};
export default function DevelopersPage() {
  return <><Navbar /><DeveloperPortal />
    <section aria-labelledby="agent-access-title" className="mx-auto mb-12 w-full max-w-5xl px-6">
      <div className="rounded-2xl border border-orange-500/30 bg-orange-500/5 p-6">
        <h2 id="agent-access-title" className="text-xl font-semibold">Acces pentru agenți, cu surse verificabile</h2>
        <p className="mt-3 text-sm leading-6">Agenții pot citi paginile în format text și pot căuta produse prin API sau MCP, folosind o cheie de dezvoltator. Rezultatele includ surse și informații despre actualizare; erorile parțiale și datele simulate rămân explicite.</p>
        <nav aria-label="Documentație pentru agenți" className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm underline underline-offset-4">
          <a href="/llms.txt">Index llms.txt</a>
          <a href="/agents/index.md">Ghid API și MCP</a>
          <a href="/.well-known/agent.json">Capabilități configurate</a>
          <a href="/.well-known/site-evidence.json">Verifică documentația</a>
        </nav>
        <p className="mt-4 text-sm opacity-75">Interfețele pentru agenți sunt doar pentru citire. Nu cumpără și nu contactează vânzători. Afirmațiile vânzătorilor nu sunt verificate independent.</p>
      </div>
    </section>
    <Footer /></>;
}
