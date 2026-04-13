import { requireEnv } from "../env.js";

const API_BASE_URL = "https://api.firecrawl.dev/v2";
const SCRAPE_API_URL = `${API_BASE_URL}/scrape`;

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
