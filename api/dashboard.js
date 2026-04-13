import { getFirecrawlCreditUsage } from "../src/providers/firecrawl.js";

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload, null, 2));
}

export default async function handler(req, res) {
  if (!process.env.FIRECRAWL_API_KEY) {
    sendJson(res, 200, {
      provider: "firecrawl",
      live: false,
      configured: false,
      updatedAt: new Date().toISOString(),
      firecrawl: {
        remainingCredits: null,
        planCredits: null,
        usedCredits: null,
        billingPeriodStart: null,
        billingPeriodEnd: null,
        raw: null
      },
      message: "FIRECRAWL_API_KEY is not configured. Product search still uses direct scraping."
    });
    return;
  }

  try {
    const firecrawl = await getFirecrawlCreditUsage();
    sendJson(res, 200, {
      provider: "firecrawl",
      live: true,
      configured: true,
      updatedAt: new Date().toISOString(),
      firecrawl
    });
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}
