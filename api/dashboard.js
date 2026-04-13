import { getFirecrawlCreditUsage } from "../src/providers/firecrawl.js";

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload, null, 2));
}

export default async function handler(req, res) {
  try {
    const firecrawl = await getFirecrawlCreditUsage();
    sendJson(res, 200, {
      provider: "firecrawl",
      live: true,
      updatedAt: new Date().toISOString(),
      firecrawl
    });
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}
