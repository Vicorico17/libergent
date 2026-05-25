import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

const sections = [
  {
    title: "1. Ce date putem prelucra",
    body: "Putem prelucra date introduse de tine, cum ar fi căutările efectuate, date de cont dacă alegi să te autentifici, feedback despre rezultate și date tehnice obișnuite precum adresa IP, tipul de browser, paginile accesate și evenimente de utilizare.",
  },
  {
    title: "2. De ce folosim datele",
    body: "Folosim datele pentru a furniza căutarea, a îmbunătăți relevanța rezultatelor, a proteja serviciul împotriva abuzului, a reține preferințe tehnice și a înțelege folosirea site-ului prin analytics.",
  },
  {
    title: "3. Google Analytics",
    body: "Site-ul este pregătit să folosească Google Analytics atunci când este configurat un Measurement ID. Analytics ne ajută să înțelegem paginile vizitate și interacțiunile generale, fără să vindem datele personale ale utilizatorilor.",
  },
  {
    title: "4. Cookie-uri și tehnologii similare",
    body: "Putem folosi cookie-uri strict necesare pentru funcționarea site-ului și cookie-uri de analiză, în funcție de configurarea produsului. Setările browserului pot bloca sau șterge cookie-uri, dar anumite funcții pot fi afectate.",
  },
  {
    title: "5. Temeiuri și perioade de păstrare",
    body: "Prelucrăm date pe baza consimțământului, a interesului legitim de a opera și securiza serviciul sau a obligațiilor legale aplicabile. Păstrăm datele doar cât este necesar pentru scopurile descrise sau cât cere legea.",
  },
  {
    title: "6. Partajarea datelor",
    body: "Putem partaja date cu furnizori tehnici care ajută la găzduire, analiză, securitate sau autentificare. Nu vindem date personale. Putem divulga date dacă legea sau o autoritate competentă ne cere acest lucru.",
  },
  {
    title: "7. Drepturile tale",
    body: "Conform GDPR, poți cere acces la date, rectificare, ștergere, restricționarea prelucrării, portabilitate, opoziție la anumite prelucrări și retragerea consimțământului atunci când acesta este temeiul prelucrării.",
  },
  {
    title: "8. Securitate",
    body: "Aplicăm măsuri tehnice și organizaționale rezonabile pentru protejarea datelor, dar niciun serviciu online nu poate garanta securitate absolută.",
  },
  {
    title: "9. Actualizări",
    body: "Putem actualiza această politică atunci când se schimbă produsul, furnizorii tehnici sau cerințele legale. Versiunea curentă va fi publicată pe această pagină.",
  },
];

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="bg-[#F8F9FA] px-6 pb-20 pt-28">
        <article className="mx-auto max-w-3xl rounded-lg border border-[#D9D9D9] bg-white p-6 sm:p-10">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#4F7CFF]">
            Legal
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-[#111111]">
            Politică de confidențialitate
          </h1>
          <p className="mt-3 text-sm text-[#6B6B6B]">
            Ultima actualizare: 25 mai 2026
          </p>
          <div className="mt-10 space-y-8">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-lg font-semibold text-[#111111]">{section.title}</h2>
                <p className="mt-2 text-sm leading-7 text-[#6B6B6B]">{section.body}</p>
              </section>
            ))}
          </div>
          <div className="mt-10 rounded-lg bg-[#F8F9FA] p-4 text-sm leading-6 text-[#6B6B6B]">
            <p>
              Pentru informații generale despre drepturile GDPR, poți consulta{" "}
              <a
                href="https://commission.europa.eu/law/law-topic/data-protection/reform/rights-citizens/my-rights_es"
                className="font-medium text-[#4F7CFF] hover:underline"
              >
                pagina Comisiei Europene
              </a>{" "}
              și{" "}
              <a
                href="https://www.dataprotection.ro/servlet/ViewDocument?id=1298"
                className="font-medium text-[#4F7CFF] hover:underline"
              >
                materialele ANSPDCP
              </a>.
            </p>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
