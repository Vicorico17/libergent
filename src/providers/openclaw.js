import { normalizeRomanianPhone } from "../phone-numbers.js";

export async function sendWhatsAppViaOpenClaw({ target, message, media, replyTo, env = process.env, fetchImpl = fetch } = {}) {
  const bridgeUrl = String(env.OPENCLAW_BRIDGE_URL || "").replace(/\/+$/, "");
  const token = String(env.OPENCLAW_BRIDGE_TOKEN || "");
  const phone = normalizeRomanianPhone(target);
  if (!bridgeUrl || !token) throw new Error("OpenClaw bridge is not configured.");
  if (!phone) throw new Error("Expected a valid Romanian phone number.");
  if (!String(message || "").trim()) throw new Error("WhatsApp message cannot be empty.");

  const response = await fetchImpl(`${bridgeUrl}/whatsapp/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ target: phone, message: String(message).trim(), media, replyTo })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || `OpenClaw bridge failed (${response.status}).`);
  return payload;
}
