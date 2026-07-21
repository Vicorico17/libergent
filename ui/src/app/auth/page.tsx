import { SignInOptions } from "@/components/GoogleSignIn";
import { AuthShell } from "@/components/AuthShell";

export default function AuthPage() {
  return (
    <AuthShell title="Conectează-te la LiberGent" description="Conectează-te pentru favorite, feedback, contactarea sellerilor și istoricul privat al conversațiilor.">
        <SignInOptions />
    </AuthShell>
  );
}
