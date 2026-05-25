import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

const sections = [
  {
    title: "1. Acceptarea termenilor",
    body: "Prin accesarea LiberGent accepți acești termeni. Dacă nu ești de acord cu ei, nu folosi serviciul.",
  },
  {
    title: "2. Ce oferă LiberGent",
    body: "LiberGent centralizează rezultate publice din marketplace-uri active și le afișează într-un format mai ușor de comparat. Nu vindem produsele listate și nu suntem parte în tranzacțiile dintre cumpărători, vânzători sau platformele externe.",
  },
  {
    title: "3. Conturi și acces",
    body: "Ești responsabil pentru datele introduse, pentru păstrarea confidențialității contului și pentru folosirea serviciului în mod legal. Putem limita accesul dacă detectăm abuz, trafic automatizat neautorizat sau încercări de afectare a serviciului.",
  },
  {
    title: "4. Rezultate și disponibilitate",
    body: "Rezultatele pot depinde de sursele externe, disponibilitatea marketplace-urilor, modificări ale anunțurilor și calitatea datelor publice. Nu garantăm că fiecare rezultat este complet, actualizat sau disponibil la momentul accesării.",
  },
  {
    title: "5. Utilizare permisă",
    body: "Nu ai voie să folosești LiberGent pentru activități ilegale, fraudă, scraping abuziv, copierea sistematică a rezultatelor sau încercări de acces neautorizat la infrastructură.",
  },
  {
    title: "6. Linkuri către terți",
    body: "Anunțurile și platformele externe au propriile reguli, politici și responsabilități. Verifică prețul, starea produsului, identitatea vânzătorului și termenii platformei înainte de orice tranzacție.",
  },
  {
    title: "7. Limitarea răspunderii",
    body: "LiberGent este furnizat ca instrument de căutare și comparație. În limita permisă de lege, nu răspundem pentru pierderi rezultate din informații incomplete, anunțuri retrase, modificări de preț sau tranzacții realizate în afara LiberGent.",
  },
  {
    title: "8. Modificări",
    body: "Putem actualiza acești termeni când produsul sau legislația se schimbă. Versiunea curentă va fi publicată pe această pagină.",
  },
];

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="bg-[#F8F9FA] px-6 pb-20 pt-28">
        <article className="mx-auto max-w-3xl rounded-lg border border-[#D9D9D9] bg-white p-6 sm:p-10">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#4F7CFF]">
            Legal
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-[#111111]">
            Termeni și condiții
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
          <p className="mt-10 rounded-lg bg-[#F8F9FA] p-4 text-sm leading-6 text-[#6B6B6B]">
            Pentru întrebări legate de acești termeni, folosește canalul de contact publicat de LiberGent.
          </p>
        </article>
      </main>
      <Footer />
    </>
  );
}
