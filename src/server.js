import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { URL } from "node:url";
import { loadEnv } from "./env.js";
import { searchAcrossSites, searchAcrossSitesScored } from "./app.js";
import { buildHistoryPayload, logSearchEvent } from "./history.js";
import { getDefaultSiteKeys, getSite, getSiteKeysForAllSearch } from "./sites.js";
import { insertOfferFeedbackToSupabase, isSupabaseConfigured } from "./supabase.js";
import { createSearchTelemetry } from "./search-telemetry.js";

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

function readJsonBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : null);
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
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
    const telemetry = createSearchTelemetry({
      route: "/api/search",
      query,
      condition,
      provider,
      site
    });

    if (!query) {
      sendJson(res, 400, { error: "Missing q parameter" });
      return;
    }

    try {
      const siteKeys = site === "all"
        ? getSiteKeysForAllSearch(query)
        : site === "default"
          ? getDefaultSiteKeys()
          : [getSite(site).key];
      const payload = await searchAcrossSites({ query, condition, provider, limit, maxPages, siteKeys });
      await logSearchEvent({ query, condition, provider, siteKeys, payload });
      telemetry.logSuccess({
        siteKeys,
        marketplaces: payload.summary?.marketplaces ?? 0,
        successfulMarketplaces: payload.summary?.successfulMarketplaces ?? 0
      });
      sendJson(res, 200, payload);
    } catch (error) {
      telemetry.logError(error);
      sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }

  if (url.pathname === "/api/search/scored") {
    const query = url.searchParams.get("q")?.trim();
    const condition = url.searchParams.get("condition") || "any";
    const provider = url.searchParams.get("provider") || "auto";
    const site = url.searchParams.get("site") || "default";
    const limitParam = url.searchParams.get("limit");
    const pagesParam = url.searchParams.get("pages");
    const rankLimitParam = url.searchParams.get("rankLimit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    const maxPages = pagesParam ? Number.parseInt(pagesParam, 10) : undefined;
    const rankingLimit = rankLimitParam ? Number.parseInt(rankLimitParam, 10) : undefined;
    const telemetry = createSearchTelemetry({
      route: "/api/search/scored",
      query,
      condition,
      provider,
      site
    });

    if (!query) {
      sendJson(res, 400, { error: "Missing q parameter" });
      return;
    }

    try {
      const siteKeys = site === "all"
        ? getSiteKeysForAllSearch(query)
        : site === "default"
          ? getDefaultSiteKeys()
          : [getSite(site).key];
      const payload = await searchAcrossSitesScored({
        query,
        condition,
        provider,
        limit,
        maxPages,
        siteKeys,
        rankingLimit
      });
      await logSearchEvent({ query, condition, provider, siteKeys, payload });
      telemetry.logSuccess({
        siteKeys,
        marketplaces: payload.summary?.marketplaces ?? 0,
        successfulMarketplaces: payload.summary?.successfulMarketplaces ?? 0,
        rankedResults: payload.rankedResults?.length ?? 0
      });
      sendJson(res, 200, payload);
    } catch (error) {
      telemetry.logError(error);
      sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }

  if (url.pathname === "/api/history") {
    sendJson(res, 200, await buildHistoryPayload());
    return;
  }

  if (url.pathname === "/api/feedback") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const body = await readJsonBody(req);
    const feedback = body?.feedback;
    if (feedback !== "like" && feedback !== "dislike") {
      sendJson(res, 400, { error: "Expected feedback to be like or dislike" });
      return;
    }

    if (!isSupabaseConfigured()) {
      sendJson(res, 200, { ok: false, error: "Supabase is not configured." });
      return;
    }

    try {
      await insertOfferFeedbackToSupabase({
        query: body.query,
        feedback,
        offer: body.offer
      });
      sendJson(res, 200, { ok: true });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
    }
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
