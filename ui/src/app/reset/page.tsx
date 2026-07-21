import { AuthShell } from "@/components/AuthShell";
import { SignInOptions } from "@/components/GoogleSignIn";

export default function ResetPage() {
  return (
    <AuthShell title="Recuperează accesul" description="LiberGent folosește conectare fără parolă. Introdu emailul și îți trimitem un link nou de acces.">
      <SignInOptions submitLabel="Trimite un link nou" />
    </AuthShell>
  );
}
