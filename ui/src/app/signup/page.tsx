import { AuthShell } from "@/components/AuthShell";
import { SignInOptions } from "@/components/GoogleSignIn";

export default function SignupPage() {
  return (
    <AuthShell title="Creează contul LiberGent" description="Același flux creează contul și te conectează. Alege un provider sau primește un link securizat pe email.">
      <SignInOptions submitLabel="Creează cont prin email" />
    </AuthShell>
  );
}
