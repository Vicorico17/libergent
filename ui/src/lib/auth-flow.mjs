/** @param {unknown} error */
export function friendlyAuthError(error) {
  const message = error instanceof Error ? error.message
    : typeof error === "string" ? error
    : error && typeof error === "object" && "message" in error ? String(error.message) : "";
  if (/provider.*not enabled|unsupported provider/i.test(message)) return "Această metodă de conectare nu este activată încă.";
  if (/rate.limit|too many requests|security purposes|over_email_send_rate_limit/i.test(message)) return "Prea multe încercări. Așteaptă un minut înainte de a solicita alt link.";
  if (/expired|invalid.*token|otp_expired|access_denied/i.test(message)) return "Linkul a expirat, a fost deja folosit sau conectarea a fost anulată. Solicită un link nou.";
  if (/invalid email|email.*invalid/i.test(message)) return "Introdu o adresă de email validă.";
  if (/fetch|network|timeout|timed out/i.test(message)) return "Nu ne putem conecta acum. Verifică internetul și încearcă din nou.";
  return "Conectarea nu a reușit. Încearcă din nou sau folosește cealaltă metodă de conectare.";
}

/** @param {string} value */
export function normalizedAuthEmail(value) {
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

/** @param {string} search @param {string} hash */
export function callbackProviderError(search, hash) {
  for (const input of [search.replace(/^\?/, ""), hash.replace(/^#/, "")]) {
    const params = new URLSearchParams(input);
    const error = params.get("error_description") || params.get("error");
    if (error) return friendlyAuthError(error);
  }
  return null;
}

export function getSafeNextPath(search = "", fallback = "/") {
  const next = new URLSearchParams(search).get("next") || fallback;
  return next.startsWith("/") && !next.startsWith("//") && !/[\\\u0000-\u001f\u007f]/.test(next) ? next : fallback;
}
