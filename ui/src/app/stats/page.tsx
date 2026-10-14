import type { Metadata } from "next";
import { StatsDashboard } from "./StatsDashboard";

export const metadata: Metadata = {
  title: "Statistici live | LiberGent",
  description: "Activitatea LiberGent: căutări înregistrate, surse, rezultate și ultimele verificări automate ale agenților.",
};

export default function StatsPage() {
  return <StatsDashboard />;
}
