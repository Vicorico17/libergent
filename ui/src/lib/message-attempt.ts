// Persist retries across reloads in this tab without storing message text,
// phone numbers or session credentials in browser storage.
export async function getMessageAttempt(input: { userId: string; target: string; listingUrl: string; message: string }) {
  const digits = input.target.replace(/\D/g, "").replace(/^00/, "")
  const phone = digits.startsWith("0") ? `40${digits.slice(1)}` : digits
  const fingerprint = JSON.stringify([input.userId, phone, input.listingUrl, input.message.trim().slice(0, 2000)])
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(fingerprint))
  const storageKey = `libergent:message-attempt:${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("")}`
  try {
    const previous = sessionStorage.getItem(storageKey)
    const key = previous && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(previous) ? previous : crypto.randomUUID()
    sessionStorage.setItem(storageKey, key)
    return { key, storageKey }
  } catch {
    throw new Error("Nu putem păstra confirmarea trimiterii în acest browser. Activează stocarea pentru site înainte de a trimite.")
  }
}

export function finishMessageAttempt(attempt: { storageKey: string }) {
  try { sessionStorage.removeItem(attempt.storageKey) } catch { /* Retain duplicate protection on failure. */ }
}
