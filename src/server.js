import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { URL } from "node:url";
import { loadEnv } from "./env.js";
import { searchAcrossSites } from "./app.js";
import { buildHistoryPayload, logSearchEvent } from "./history.js";
import { getDefaultSiteKeys, getSite, SITES } from "./sites.js";

const PORT = Number.parseInt(process.env.PORT || "8787", 10);
const HOST = process.env.HOST || "127.0.0.1";
const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public");

loadEnv(ROOT);

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath);
  const typeMap = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8"
  };

  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": typeMap[ext] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || `localhost:${PORT}`}`);

  if (url.pathname === "/api/search") {
    const query = url.searchParams.get("q")?.trim();
    const condition = url.searchParams.get("condition") || "any";
    const provider = url.searchParams.get("provider") || "auto";
    const site = url.searchParams.get("site") || "default";
    const limitParam = url.searchParams.get("limit");
    const pagesParam = url.searchParams.get("pages");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    const maxPages = pagesParam ? Number.parseInt(pagesParam, 10) : undefined;

    if (!query) {
      sendJson(res, 400, { error: "Missing q parameter" });
      return;
    }

    try {
      const siteKeys = site === "all"
        ? Object.keys(SITES)
        : site === "default"
          ? getDefaultSiteKeys()
          : [getSite(site).key];
      const payload = await searchAcrossSites({ query, condition, provider, limit, maxPages, siteKeys });
      await logSearchEvent({ query, condition, provider, siteKeys, payload });
      sendJson(res, 200, payload);
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }

  if (url.pathname === "/api/history") {
    sendJson(res, 200, await buildHistoryPayload());
    return;
  }

  const filePath = url.pathname === "/"
    ? path.join(PUBLIC_DIR, "index.html")
    : url.pathname === "/trends"
        ? path.join(PUBLIC_DIR, "trends.html")
      : url.pathname === "/todo"
        ? path.join(PUBLIC_DIR, "todo.html")
      : path.join(PUBLIC_DIR, url.pathname);

  sendFile(res, filePath);
});

server.listen(PORT, HOST, () => {
  console.log(`libergent server running at http://${HOST}:${PORT}`);
});
