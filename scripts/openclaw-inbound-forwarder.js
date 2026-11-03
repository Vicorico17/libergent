import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SESSIONS_DIR = process.env.OPENCLAW_SESSIONS_DIR || "/docker/openclaw-dngq/data/.openclaw/agents/main/sessions";
const WEBHOOK_URL = String(process.env.LIBERGENT_INBOUND_WEBHOOK_URL || "").replace(/\/+$/, "");
const WEBHOOK_TOKEN = String(process.env.LIBERGENT_INBOUND_WEBHOOK_TOKEN || "");
const POLL_MS = Number.parseInt(process.env.OPENCLAW_INBOUND_POLL_MS || "3000", 10);
const STATE_FILE = process.env.OPENCLAW_INBOUND_STATE_FILE || "/home/ubuntu/libergent/.openclaw-inbound-forwarder-state.json";

function loadState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    return { seen: new Set(Array.isArray(parsed.seen) ? parsed.seen : []) };
  } catch {
    return { seen: new Set() };
  }
}

export function saveState(state, stateFile = STATE_FILE) {
  const seen = Array.from(state.seen).slice(-5000);
  const temporary = `${stateFile}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify({ seen }, null, 2), { mode: 0o600 });
  fs.renameSync(temporary, stateFile);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function getWhatsAppSessions() {
  const indexPath = path.join(SESSIONS_DIR, "sessions.json");
  const index = readJson(indexPath);
  return Object.entries(index)
    .filter(([key, value]) => key.includes("whatsapp:direct:") && value?.sessionFile)
    .map(([key, value]) => ({ key, file: value.sessionFile.replace("/data/.openclaw/agents/main/sessions", SESSIONS_DIR) }));
}

function extractText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => typeof part === "string" ? part : part?.text || "").join("").trim();
  }
  return "";
}

export function readInboundMessages(session) {
  if (!fs.existsSync(session.file)) return [];
  const lines = fs.readFileSync(session.file, "utf8").split(/\n+/).filter(Boolean);
  const messages = [];
  for (const line of lines) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const message = entry?.message;
    if (entry?.type !== "message" || message?.role !== "user" || message?.sourceChannel !== "whatsapp") continue;
    if (typeof entry.id !== "string" || !entry.id.trim() || entry.id.length > 512) continue;
    const from = String(message.senderE164 || message.senderId || "").trim();
    const text = extractText(message.content).trim();
    if (!/^\+\d{8,15}$/.test(from) || !text) continue;
    messages.push({
      messageId: entry.id,
      ...(typeof message.replyToMessageId === "string" && message.replyToMessageId.trim() ? { replyToMessageId: message.replyToMessageId.trim() } : {}),
      from,
      to: message.to || "",
      text,
      timestamp: entry.timestamp || new Date(message.timestamp || Date.now()).toISOString(),
      raw: { sessionKey: session.key, senderName: message.senderName || "", openclawMessageId: entry.id }
    });
  }
  return messages;
}

export async function postInbound(message, { url = WEBHOOK_URL, token = WEBHOOK_TOKEN, fetchImpl = fetch } = {}) {
  const target = new URL(url);
  if (target.username || target.password || (target.protocol !== "https:" && !(target.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)))) {
    throw new Error("Use HTTPS for the inbound webhook, or HTTP on localhost.");
  }
  if (!token) throw new Error("Inbound webhook token is not configured.");
  const response = await fetchImpl(target.href, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(message)
  });
  const payload = await response.text();
  if (!response.ok) {
    throw new Error(`Webhook failed (${response.status}).`);
  }
  let result;
  try {
    result = JSON.parse(payload);
  } catch {
    throw new Error("Webhook returned an invalid JSON response.");
  }
  if (result?.ok !== true) {
    throw new Error("Webhook did not accept the message.");
  }
  return payload;
}

async function scanOnce(state) {
  if (!WEBHOOK_URL || !WEBHOOK_TOKEN) {
    throw new Error("Set LIBERGENT_INBOUND_WEBHOOK_URL and LIBERGENT_INBOUND_WEBHOOK_TOKEN.");
  }
  for (const session of getWhatsAppSessions()) {
    for (const message of readInboundMessages(session)) {
      if (state.seen.has(message.messageId)) continue;
      await postInbound(message);
      state.seen.add(message.messageId);
      console.log(`forwarded inbound WhatsApp message ${message.messageId}`);
    }
  }
  saveState(state);
}

export function createPollRunner(scan, onError) {
  let active = false;
  return async () => {
    if (active) return;
    active = true;
    try { await scan(); }
    catch (error) { onError(error); }
    finally { active = false; }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const state = loadState();
  const poll = createPollRunner(() => scanOnce(state), error => console.error(error instanceof Error ? error.message : String(error)));
  console.log(`OpenClaw inbound forwarder watching ${SESSIONS_DIR}`);
  setInterval(poll, Number.isFinite(POLL_MS) && POLL_MS >= 1000 ? POLL_MS : 3000);
  void poll();
}
