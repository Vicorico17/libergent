import { requireEnv } from "../env.js";

async function postCloudflare(endpointPath, body, timeoutMs = 45000) {
  requireEnv(["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"]);

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/browser-rendering/${endpointPath}`;
  const response = await fetch(endpoint, {
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    throw new Error(`Cloudflare request failed (${response.status}): ${JSON.stringify(payload)}`);
  }

  return payload;
}

export async function scrapeWithCloudflare({ url, prompt, schema, timeoutMs = 45000 }) {
  const payload = await postCloudflare(
    "json",
    {
      url,
      prompt,
      response_format: {
        type: "json_schema",
        schema
      },
      userAgent: "libergent/0.1"
    },
    timeoutMs
  );

  return payload?.result ?? payload;
}

export async function crawlWithCloudflare({ crawlConfig, schema, timeoutMs = 45000 }) {
  const config = {
    ...crawlConfig,
    jsonOptions: {
      ...(crawlConfig.jsonOptions || {}),
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "listing_results",
          schema
        }
      }
    }
  };

  const payload = await postCloudflare("crawl", config, timeoutMs);
  return payload?.result ?? payload;
}
