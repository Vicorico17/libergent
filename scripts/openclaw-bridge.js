import http from "node:http";
import { spawn } from "node:child_process";

const HOST = process.env.OPENCLAW_BRIDGE_HOST || "127.0.0.1";
const PORT = Number.parseInt(process.env.OPENCLAW_BRIDGE_PORT || "8788", 10);
const BRIDGE_TOKEN = process.env.OPENCLAW_BRIDGE_TOKEN || "";
const CONTAINER = process.env.OPENCLAW_DOCKER_CONTAINER || "";
const MAX_BODY_BYTES = 32_000;

function json(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function authorized(req) {
  const value = String(req.headers.authorization || "");
  return Boolean(BRIDGE_TOKEN) && value === `Bearer ${BRIDGE_TOKEN}`;
}

function readJson(req) {
  return new Promise((resolve) => {
    let raw = "";
    let bytes = 0;
    req.on("data", (chunk) => {
      bytes += chunk.byteLength;
      if (bytes <= MAX_BODY_BYTES) raw += chunk;
    });
    req.on("end", () => {
      if (bytes > MAX_BODY_BYTES) return resolve({ error: "Request body is too large." });
      try {
        resolve({ data: raw ? JSON.parse(raw) : null });
      } catch {
        resolve({ error: "Request body is not valid JSON." });
      }
    });
    req.on("error", () => resolve({ error: "Request body could not be read." }));
  });
}

function runOpenClawMessage({ target, message, media, replyTo }) {
  const args = CONTAINER
    ? ["exec", CONTAINER, "openclaw", "message", "send"]
    : ["message", "send"];
  args.push("--channel", "whatsapp", "--target", target, "--message", message, "--json");
  if (media) args.push("--media", media);
  return new Promise((resolve, reject) => {
    const child = spawn(CONTAINER ? "docker" : (process.env.OPENCLAW_BIN || "openclaw"), args, {
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `OpenClaw exited with code ${code}`));
        return;
      }
      try {
        resolve(stdout.trim() ? JSON.parse(stdout) : { ok: true });
      } catch {
        resolve({ ok: true, output: stdout.trim() });
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    json(res, 200, { ok: true, service: "openclaw-bridge" });
    return;
  }

  if (req.method !== "POST" || req.url !== "/whatsapp/send") {
    json(res, 404, { error: "Not found" });
    return;
  }
  if (!authorized(req)) {
    json(res, 401, { error: "Unauthorized" });
    return;
  }

  const parsed = await readJson(req);
  if (parsed.error) {
    json(res, 400, { error: parsed.error });
    return;
  }

  const body = parsed.data || {};
  const target = String(body.target || "").trim();
  const message = String(body.message || "").trim();
  const media = String(body.media || "").trim();
  const replyTo = String(body.replyTo || "").trim();
  if (!/^\+\d{8,15}$/.test(target) || !message || message.length > 8_000) {
    json(res, 400, { error: "Expected an E.164 target and a non-empty message." });
    return;
  }

  try {
    json(res, 200, { ok: true, result: await runOpenClawMessage({ target, message, media, replyTo }) });
  } catch (error) {
    json(res, 502, { ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`OpenClaw bridge listening at http://${HOST}:${PORT}`);
});
