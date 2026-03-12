import { requireEnv } from "../env.js";

const API_URL = "https://api.firecrawl.dev/v2/scrape";

export async function scrapeWithFirecrawl({ url, prompt, schema, waitForMs, timeoutMs = 45000 }) {
  requireEnv(["FIRECRAWL_API_KEY"]);

  const response = await fetch(API_URL, {
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

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Firecrawl request failed (${response.status}): ${JSON.stringify(payload)}`);
  }

  return payload?.data?.json ?? payload?.json ?? payload?.data ?? payload;
}
