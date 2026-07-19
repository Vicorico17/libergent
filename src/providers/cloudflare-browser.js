import puppeteer from "@cloudflare/puppeteer";
import { extractRomanianMobilePhones } from "../phone-numbers.js";
import { parseSiteHtml } from "../site-html-parser.js";

const OLX_PHONE_RESPONSE_PATTERN = /\/api\/v1\/offers\/\d+\/(?:limited-)?phones\/?(?:\?|$)/i;

function extractPhonesFromUnknownValue(value) {
  if (typeof value === "string") return extractRomanianMobilePhones(value);
  if (Array.isArray(value)) return value.flatMap(extractPhonesFromUnknownValue);
  if (value && typeof value === "object") return Object.values(value).flatMap(extractPhonesFromUnknownValue);
  return [];
}

export async function revealOlxPhonesWithBrowser(browserBinding, listingUrl, { launch = puppeteer.launch } = {}) {
  if (!browserBinding) {
    return { phones: [], debug: { configured: false } };
  }

  const browser = await launch(browserBinding);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1365, height: 900 });
    await page.goto(listingUrl, { waitUntil: "networkidle2", timeout: 30000 });

    const phoneResponsePromise = page.waitForResponse(
      (response) => OLX_PHONE_RESPONSE_PATTERN.test(response.url()),
      { timeout: 15000 }
    ).catch(() => null);

    const clicked = await page.evaluate(() => {
      const normalize = (value) => String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
      const candidates = [...document.querySelectorAll("button, a")];
      const contactButton = candidates.find((element) => {
        const text = normalize(element.textContent);
        return text.includes("suna vanzatorul") || text.includes("arata telefon") || text.includes("show phone");
      });
      if (!contactButton) return false;
      contactButton.click();
      return true;
    });

    if (!clicked) {
      return { phones: [], debug: { configured: true, clicked: false } };
    }

    const phoneResponse = await phoneResponsePromise;
    let responsePhones = [];
    let responseStatus = null;
    if (phoneResponse) {
      responseStatus = phoneResponse.status();
      const payload = await phoneResponse.json().catch(() => null);
      responsePhones = extractPhonesFromUnknownValue(payload);
    }

    if (responsePhones.length) {
      return {
        phones: [...new Set(responsePhones)],
        debug: { configured: true, clicked: true, responseStatus, source: "phone-response" }
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
    const visibleText = await page.evaluate(() => document.body?.innerText || "");
    const visiblePhones = extractRomanianMobilePhones(visibleText);
    return {
      phones: visiblePhones,
      debug: { configured: true, clicked: true, responseStatus, source: visiblePhones.length ? "rendered-page" : "none" }
    };
  } finally {
    await browser.close();
  }
}

export async function benchmarkMarketplaceWithBrowser(
  browserBinding,
  { site, query, limit = 20 },
  { launch = puppeteer.launch } = {}
) {
  if (!browserBinding) throw new Error("Cloudflare Browser Run is not configured.");

  const url = site.searchUrl(query);
  const startedAt = Date.now();
  const browser = await launch(browserBinding);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000 });
    const response = await page.goto(url, { waitUntil: "networkidle2", timeout: site.timeoutMs || 30000 });
    const html = await page.content();
    const parsed = parseSiteHtml({ site, html, url, limit });
    const bodyText = await page.evaluate(() => document.body?.innerText || "");

    return {
      site: site.key,
      query,
      url,
      finalUrl: page.url(),
      status: response?.status?.() ?? null,
      durationMs: Date.now() - startedAt,
      htmlBytes: new TextEncoder().encode(html).byteLength,
      rawItemCount: parsed.rawItemCount,
      itemCount: parsed.items.length,
      totalResults: parsed.totalResults,
      hasNextPage: parsed.hasNextPage,
      challengeDetected: /captcha|verific[aă].{0,30}(om|robot)|access denied|just a moment/i.test(bodyText),
      sample: parsed.items.slice(0, 5).map((item) => ({
        title: item.title || "",
        price: item.price || "",
        url: item.url || "",
        imageUrl: item.imageUrl || ""
      }))
    };
  } finally {
    await browser.close();
  }
}
