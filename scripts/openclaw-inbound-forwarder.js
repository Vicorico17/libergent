import fs from "node:fs";
import path from "node:path";

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

function saveState(state) {
  const seen = Array.from(state.seen).slice(-5000);
  fs.writeFileSync(STATE_FILE, JSON.stringify({ seen }, null, 2));
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

function readInboundMessages(session) {
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
    const from = String(message.senderE164 || message.senderId || "").trim();
    const text = extractText(message.content).trim();
    if (!/^\+\d{8,15}$/.test(from) || !text) continue;
    messages.push({
      messageId: entry.id,
      from,
      to: message.to || "",
      text,
      timestamp: entry.timestamp || new Date(message.timestamp || Date.now()).toISOString(),
      raw: { sessionKey: session.key, senderName: message.senderName || "", openclawMessageId: entry.id }
    });
  }
  return messages;
}

async function postInbound(message) {
  const response = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WEBHOOK_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(message)
  });
  const payload = await response.text();
  if (!response.ok) {
    throw new Error(`Webhook failed (${response.status}): ${payload}`);
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
      console.log(`forwarded inbound WhatsApp message ${message.messageId} from ${message.from}`);
    }
  }
  saveState(state);
}

const state = loadState();
console.log(`OpenClaw inbound forwarder watching ${SESSIONS_DIR}`);
setInterval(() => {
  scanOnce(state).catch((error) => console.error(error instanceof Error ? error.message : String(error)));
}, POLL_MS);
scanOnce(state).catch((error) => console.error(error instanceof Error ? error.message : String(error)));
