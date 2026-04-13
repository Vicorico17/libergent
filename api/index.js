import { searchAcrossSites } from "../src/app.js";
import { buildHistoryPayload, logSearchEvent } from "../src/history.js";
import { getDefaultSiteKeys, getSite, SITES } from "../src/sites.js";

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload, null, 2));
}

export default async function handler(req, res) {
  const url = new URL(req.url || "/", `https://${req.headers.host || "localhost"}`);

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

  sendJson(res, 404, { error: "Not found" });
}
