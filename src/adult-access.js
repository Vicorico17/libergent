import { isAdultProductQuery } from "./search-policy.js";

export const ADULT_CONFIRMATION_SECONDS = 30 * 60;
export const ADULT_HEADER = "x-libergent-adult-confirmation";
const encoder = new TextEncoder();

async function signingKey(env) {
  const secret = env.ADULT_CONFIRMATION_SECRET;
  if (typeof secret !== "string" || secret.length < 32) return null;
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function issueAdultConfirmation(env, now = Date.now()) {
  const key = await signingKey(env);
  if (!key) return null;
  const expiresAt = now + ADULT_CONFIRMATION_SECONDS * 1000;
  const value = `${expiresAt}.${crypto.randomUUID()}`;
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
  return { token: `${value}.${Array.from(signature, (byte) => byte.toString(16).padStart(2, "0")).join("")}`, expiresAt };
}

export async function hasAdultConfirmation(request, env, now = Date.now()) {
  const token = request.headers.get(ADULT_HEADER) || "";
  const match = token.match(/^(\d{13})\.([a-f0-9-]{36})\.([a-f0-9]{64})$/);
  if (!match || Number(match[1]) <= now || Number(match[1]) > now + ADULT_CONFIRMATION_SECONDS * 1000) return false;
  const key = await signingKey(env);
  if (!key) return false;
  const signature = Uint8Array.from(match[3].match(/../g), (byte) => parseInt(byte, 16));
  return crypto.subtle.verify("HMAC", key, signature, encoder.encode(`${match[1]}.${match[2]}`));
}

export function needsAdultConfirmation(url) {
  return url.searchParams.get("category") === "adult" || isAdultProductQuery(url.searchParams.get("q")) || isAdultProductQuery(url.searchParams.get("url"));
}

export function adultGateResponse() {
  return new Response(JSON.stringify({ code: "adult_confirmation_required", error: "Confirma explicit ca ai cel putin 18 ani pentru a continua." }), {
    status: 403, headers: { "content-type": "application/json", "cache-control": "no-store" }
  });
}
