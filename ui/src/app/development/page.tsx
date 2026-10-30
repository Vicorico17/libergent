import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

const MCP_URL = "https://libergent-mcp-test.vic-cazacu.workers.dev/mcp";

const codeClass = "block overflow-x-auto rounded-md border border-[#252525] bg-[#111111] p-4 text-xs leading-6 text-[#E8E4D9] sm:text-sm";
const sectionClass = "scroll-mt-28 border-t-2 border-[#111111] py-10 sm:py-14";

export const metadata: Metadata = {
  title: "Development — MCP connector și API",
  description: "Conectează LiberGent la ChatGPT, Claude și aplicațiile tale prin MCP sau API-ul HTTP.",
  alternates: { canonical: "/development" },
};

function CopyableEndpoint() {
  return <code className="block break-all rounded-md border border-[#111111] bg-white px-4 py-3 text-xs leading-6 sm:text-sm">{MCP_URL}</code>;
}

export default function DevelopmentPage() {
  return <div className="min-h-screen bg-[#F3F0E7] text-[#111111]" style={{ fontFamily: "var(--font-mono-var), monospace" }}>
    <Navbar />
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-36 sm:px-8">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#a51d50]">LiberGent / Development</p>
      <h1 className="mt-5 max-w-4xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">Conectează LiberGent<br className="hidden sm:block" /> la instrumentele tale<span className="text-[#FF4B8B]">.</span></h1>
      <p className="mt-6 max-w-3xl text-sm leading-7 sm:text-base">Folosește connectorul MCP în ChatGPT sau Claude, ori apelează API-ul HTTP din aplicația ta. Căutarea și recomandările sunt calculate de LiberGent.</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          ["01 / MCP", "ChatGPT, Claude și clienți MCP", "#mcp"],
          ["02 / REST API", "Căutare Free prin HTTP", "#api"],
          ["03 / Acces", "Limite și disponibilitate", "#access"],
        ].map(([eyebrow, title, href]) => <a key={href} href={href} className="border-2 border-[#111111] bg-white p-4 transition-transform hover:-translate-y-1">
          <span className="block text-[10px] font-bold uppercase tracking-widest text-[#a51d50]">{eyebrow}</span>
          <span className="mt-3 block text-sm font-bold">{title} ↘</span>
        </a>)}
      </div>

      <section id="mcp" className={`${sectionClass} mt-10`}>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a51d50]">01 / Model Context Protocol</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold sm:text-3xl">MCP connector</h2>
          <span className="border border-[#a51d50] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#a51d50]">Early access</span>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-7">Adaugă endpoint-ul ca remote MCP server. Acest pilot oferă unelte read-only și căutare Free; nu cere autentificare Libergent. URL-ul este un endpoint de test și se poate schimba înainte de lansarea generală.</p>
        <div className="mt-5 max-w-3xl"><CopyableEndpoint /></div>

        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <div className="border border-[#111111] bg-white p-5 sm:p-6">
            <h3 className="text-lg font-bold">Conectare la ChatGPT</h3>
            <ol className="mt-4 list-inside list-decimal space-y-3 text-sm leading-6">
              <li>Deschide ChatGPT pe web și intră la <strong>Plugins</strong>.</li>
              <li>Selectează <strong>+</strong>, apoi <strong>Add custom MCP server</strong>.</li>
              <li>Numește conexiunea „LiberGent” și adaugă URL-ul de mai sus.</li>
              <li>Continuă fără autentificare și confirmă adăugarea serverului.</li>
              <li>Într-un chat nou selectează LiberGent și cere o căutare.</li>
            </ol>
            <a className="mt-5 inline-block text-xs font-bold underline underline-offset-4" href="https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt" target="_blank" rel="noreferrer">Instrucțiunile oficiale ChatGPT ↗</a>
          </div>
          <div className="border border-[#111111] bg-white p-5 sm:p-6">
            <h3 className="text-lg font-bold">Conectare la Claude</h3>
            <ol className="mt-4 list-inside list-decimal space-y-3 text-sm leading-6">
              <li>Deschide <strong>Customize → Connectors</strong> în Claude.</li>
              <li>Alege adăugarea unui connector personalizat.</li>
              <li>Numește-l „LiberGent” și lipește URL-ul MCP.</li>
              <li>Finalizează adăugarea; connectorul nu cere login LiberGent.</li>
              <li>Activează LiberGent în conversație și solicită o căutare.</li>
            </ol>
            <a className="mt-5 inline-block text-xs font-bold underline underline-offset-4" href="https://support.claude.com/en/articles/11175166-about-custom-integrations-using-remote-mcp" target="_blank" rel="noreferrer">Instrucțiunile oficiale Claude ↗</a>
          </div>
        </div>

        <div className="mt-6 border-l-4 border-[#FF4B8B] bg-white p-5 text-sm leading-7">
          <strong>Unelte disponibile:</strong> <code>search_products</code> caută anunțuri și returnează deciziile, explicațiile, riscurile, prețurile și acoperirea surselor calculate de LiberGent; <code>get_listing_details</code> citește detalii dintr-un anunț acceptat; <code>list_sources</code> afișează sursele Free. Instrumentele nu trimit mesaje și nu modifică date.
        </div>
      </section>

      <section id="api" className={sectionClass}>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a51d50]">02 / HTTP</p>
        <h2 className="mt-3 text-2xl font-bold sm:text-3xl">REST API</h2>
        <p className="mt-4 max-w-3xl text-sm leading-7">Pentru integrare server-to-server, endpoint-ul Free întoarce JSON. Nu ai nevoie de API key pentru căutări Free. Înlocuiește termenul și filtrele după nevoie.</p>
        <pre className={`${codeClass} mt-5`}><code>{`curl "https://libergent.com/api/search/free?q=iphone%2015&condition=used&maxPriceRon=2500&near=Bucuresti&site=all&provider=auto&limit=10&pages=1"`}</code></pre>
        <h3 className="mt-8 text-base font-bold">Exemplu JavaScript</h3>
        <pre className={`${codeClass} mt-3`}><code>{`const url = new URL("https://libergent.com/api/search/free");
url.search = new URLSearchParams({
  q: "iphone 15",
  condition: "used",
  maxPriceRon: "2500",
  near: "Bucuresti",
  site: "all",
  provider: "auto",
  limit: "10",
  pages: "1",
}).toString();

const response = await fetch(url);
if (!response.ok) throw new Error("Libergent API: " + response.status);
const data = await response.json();
console.log(data.summary, data.results);`}</code></pre>
        <div className="mt-6 flex flex-col gap-4 border-2 border-[#111111] bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h3 className="font-bold">Need an API key or authenticated MCP?</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6">The versioned Developer API supports test/live search keys, usage reporting, and OpenAPI when enabled on the deployment. Check its status below. Authenticated MCP is not available yet.</p>
          </div>
          <a className="shrink-0 border-2 border-[#111111] bg-[#FF4B8B] px-4 py-3 text-center text-xs font-bold uppercase tracking-wider" href="/developers">Developer API status ↗</a>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="border border-[#111111] bg-white p-5">
            <h3 className="font-bold">Filtre disponibile</h3>
            <p className="mt-2 text-sm leading-6"><code>q</code> (obligatoriu), <code>condition</code> (<code>any</code>, <code>used</code>, <code>new</code>), <code>maxPriceRon</code>, <code>near</code>, <code>site</code>, <code>provider</code>, <code>limit</code> și <code>pages</code>. Pentru limite și valori valide, citește răspunsul API; parametrii invalizi întorc o eroare HTTP.</p>
          </div>
          <div className="border border-[#111111] bg-white p-5">
            <h3 className="font-bold">Ce primești</h3>
            <p className="mt-2 text-sm leading-6">Răspunsul include <code>summary</code> cu clasamentul, recomandările, înțelegerea căutării, analiza de preț și acoperirea surselor, plus <code>results</code> cu datele fiecărei surse.</p>
          </div>
        </div>
      </section>

      <section id="access" className={sectionClass}>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a51d50]">03 / Acces și disponibilitate</p>
        <h2 className="mt-3 text-2xl font-bold sm:text-3xl">Ce este disponibil acum</h2>
        <div className="mt-6 overflow-hidden border-2 border-[#111111] bg-white">
          <div className="grid grid-cols-[minmax(100px,0.7fr)_minmax(0,2fr)] border-b border-[#111111] bg-[#111111] px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-white sm:px-5">
            <span>Metodă</span><span>Acces</span>
          </div>
          {[
            ["MCP connector", "Pilot public, read-only, Free. Sunt aplicate limite de utilizare; URL-ul poate fi schimbat înainte de lansarea generală."],
            ["REST API Free", "Căutare JSON publică la /api/search/free. Pentru integrare server-to-server; respectă limitele și termenii LiberGent."],
            ["Developer API v1", "Chei test/live și limite per cont când integrarea este activată. Verifică disponibilitatea în /developers. MCP autentificat nu este încă disponibil."],
            ["REST API Premium", "Necesită sesiune Libergent validă și drept Premium activ. Nu este o ofertă de plată per apel."],
            ["Premium prin MCP", "Nu este încă disponibil. Va necesita identitate de client, tarifare per apel și evidența utilizării."],
          ].map(([label, description], index, array) => <div key={label} className={`grid grid-cols-[minmax(100px,0.7fr)_minmax(0,2fr)] gap-3 px-4 py-4 text-xs leading-6 sm:px-5 sm:text-sm ${index < array.length - 1 ? "border-b border-[#D7D2C7]" : ""}`}>
            <strong>{label}</strong><p>{description}</p>
          </div>)}
        </div>
        <p className="mt-5 max-w-3xl text-xs leading-6 text-[#5A554D]">API-ul este în dezvoltare și se poate modifica. Căutările pot avea rezultate parțiale în funcție de marketplace-uri. Nu colecta sistematic rezultate și nu expune token-uri sau chei private în browser ori în prompturile AI. Consultă <a className="underline" href="/confidentialitate">politica de confidențialitate</a> și <a className="underline" href="/termeni">termenii</a>.</p>
      </section>
    </main>
    <Footer />
  </div>;
}
