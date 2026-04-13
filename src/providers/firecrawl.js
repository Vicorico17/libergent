import { requireEnv } from "../env.js";

const API_BASE_URL = "https://api.firecrawl.dev/v2";
const SCRAPE_API_URL = `${API_BASE_URL}/scrape`;
const CREDIT_USAGE_API_URL = `${API_BASE_URL}/team/credit-usage`;

async function parseJsonResponse(response, contextLabel) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${contextLabel} failed (${response.status}): ${JSON.stringify(payload)}`);
  }

  return payload;
}

export async function scrapeWithFirecrawl({ url, prompt, schema, waitForMs, timeoutMs = 45000 }) {
  requireEnv(["FIRECRAWL_API_KEY"]);

  const response = await fetch(SCRAPE_API_URL, {
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url,
      formats: [
        {
          type: "json",
          prompt,
          schema
        }
      ],
      onlyMainContent: false,
      maxAge: 0,
      timeout: timeoutMs,
      waitFor: waitForMs,
      actions: [
        {
          type: "wait",
          milliseconds: waitForMs
        }
      ],
      proxy: "auto"
    })
  });

  const payload = await parseJsonResponse(response, "Firecrawl request");

  return payload?.data?.json ?? payload?.json ?? payload?.data ?? payload;
}

export async function scrapeMarkdownWithFirecrawl({ url, waitForMs, timeoutMs = 45000 }) {
  requireEnv(["FIRECRAWL_API_KEY"]);

  const response = await fetch(SCRAPE_API_URL, {
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url,
      formats: ["markdown", "links"],
      onlyMainContent: false,
      maxAge: 0,
      timeout: timeoutMs,
      waitFor: waitForMs,
      proxy: "basic",
      blockAds: true
    })
  });

  const payload = await parseJsonResponse(response, "Firecrawl markdown request");

  return payload?.data ?? payload;
}

export async function getFirecrawlCreditUsage({ timeoutMs = 15000 } = {}) {
  requireEnv(["FIRECRAWL_API_KEY"]);

  const response = await fetch(CREDIT_USAGE_API_URL, {
    method: "GET",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json"
    }
  });

  const payload = await parseJsonResponse(response, "Firecrawl credit usage request");
  const data = payload?.data ?? payload;
  const remainingCredits = Number(data?.remainingCredits);
  const planCredits = Number(data?.planCredits);

  return {
    remainingCredits: Number.isFinite(remainingCredits) ? remainingCredits : null,
    planCredits: Number.isFinite(planCredits) ? planCredits : null,
    usedCredits:
      Number.isFinite(planCredits) && Number.isFinite(remainingCredits)
        ? Math.max(0, planCredits - remainingCredits)
        : null,
    billingPeriodStart: data?.billingPeriodStart ?? null,
    billingPeriodEnd: data?.billingPeriodEnd ?? null,
    raw: data
  };
}
