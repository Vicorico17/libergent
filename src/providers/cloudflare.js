import { requireEnv } from "../env.js";
import { buildAbortSignal } from "../abort.js";

function isMockProviderEnabled() {
  return process.env.LIBERGENT_MOCK_PROVIDER === "1";
}

function buildMockItems(url) {
  return [
    {
      title: "iPhone 15 Pro 128 GB",
      price: "3 299 lei",
      currency: "lei",
      location: "Bucuresti",
      postedAt: "azi",
      condition: "Utilizat",
      sellerType: "Persoana fizica",
      url: `${url}#listing-1`,
      imageUrl: ""
    },
    {
      title: "iPhone 15 Pro impecabil",
      price: "3 450 lei",
      currency: "lei",
      location: "Cluj-Napoca",
      postedAt: "ieri",
      condition: "Utilizat",
      sellerType: "Magazin",
      url: `${url}#listing-2`,
      imageUrl: ""
    }
  ];
}

async function postCloudflare(endpointPath, body, timeoutMs = 45000, signal) {
  if (isMockProviderEnabled()) {
    const mockItems = buildMockItems(body.url);

    if (endpointPath === "crawl") {
      return {
        success: true,
        result: {
          pages: [
            {
              url: body.url,
              status: 200,
              json: {
                items: mockItems
              }
            }
          ]
        }
      };
    }

    return {
      success: true,
      result: {
        items: mockItems
      }
    };
  }

  requireEnv(["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"]);

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/browser-rendering/${endpointPath}`;
  const response = await fetch(endpoint, {
    method: "POST",
    signal: buildAbortSignal({ timeoutMs, signal }),
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

export async function scrapeWithCloudflare({ url, prompt, schema, timeoutMs = 45000, signal }) {
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
    timeoutMs,
    signal
  );

  return payload?.result ?? payload;
}

export async function crawlWithCloudflare({ crawlConfig, schema, timeoutMs = 45000, signal }) {
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

  const payload = await postCloudflare("crawl", config, timeoutMs, signal);
  return payload?.result ?? payload;
}
