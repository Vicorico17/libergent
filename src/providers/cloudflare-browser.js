import puppeteer from "@cloudflare/puppeteer";
import { extractRomanianMobilePhones } from "../phone-numbers.js";
import { parseSiteHtml } from "../site-html-parser.js";

const OLX_PHONE_RESPONSE_PATTERN = /\/offers\/\d+\/[^?]*phone/i;

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

    const button = await page.evaluate(() => {
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
      if (!contactButton) return null;
      contactButton.scrollIntoView({ block: "center", inline: "center" });
      const rect = contactButton.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      return {
        text: String(contactButton.textContent || "").trim().slice(0, 120),
        x: rect.left + (rect.width / 2),
        y: rect.top + (rect.height / 2)
      };
    });

    if (!button) {
      return { phones: [], debug: { configured: true, clicked: false } };
    }

    await page.mouse.click(button.x, button.y);

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
    const pageState = await page.evaluate(() => ({
      text: document.body?.innerText || "",
      title: document.title || "",
      dialogs: [...document.querySelectorAll('[role="dialog"], [aria-modal="true"]')]
        .map((element) => String(element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 240))
        .filter(Boolean)
        .slice(0, 3)
    }));
    const visiblePhones = extractRomanianMobilePhones(pageState.text);
    const normalizedText = pageState.text.toLowerCase();
    const pageSignals = [
      normalizedText.includes("captcha") ? "captcha" : null,
      normalizedText.includes("verifică") || normalizedText.includes("verifica") ? "verification" : null,
      normalizedText.includes("conectează-te") || normalizedText.includes("conecteaza-te") ? "login" : null,
      normalizedText.includes("ceva nu a mers") ? "error" : null
    ].filter(Boolean);
    return {
      phones: visiblePhones,
      debug: {
        configured: true,
        clicked: true,
        buttonText: button.text,
        responseStatus,
        source: visiblePhones.length ? "rendered-page" : "none",
        finalUrl: page.url(),
        pageTitle: pageState.title,
        pageSignals,
        dialogs: pageState.dialogs
      }
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
  const result = await searchMarketplaceWithBrowser(
    browserBinding,
    { site, query, limit },
    { launch, includeBodyText: true }
  );

  return {
    site: result.site,
    query: result.query,
    url: result.url,
    finalUrl: result.finalUrl,
    status: result.status,
    durationMs: result.durationMs,
    htmlBytes: result.htmlBytes,
    rawItemCount: result.rawItemCount,
    itemCount: result.itemCount,
    totalResults: result.totalResults,
    hasNextPage: result.hasNextPage,
    challengeDetected: result.challengeDetected,
    sample: result.items.slice(0, 5).map((item) => ({
      title: item.title || "",
      price: item.price || "",
      url: item.url || "",
      imageUrl: item.imageUrl || ""
    }))
  };
}

export async function searchMarketplaceWithBrowser(
  browserBinding,
  { site, query, limit = 20 },
  { launch = puppeteer.launch, includeBodyText = false } = {}
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
    const bodyText = includeBodyText
      ? await page.evaluate(() => document.body?.innerText || "")
      : "";
    const items = parsed.items.map((item) => ({
      ...item,
      sourceType: item.sourceType || site.sourceType || "classifieds",
      condition: item.condition || site.defaultCondition || "",
      sellerType: item.sellerType || site.defaultSellerType || ""
    }));

    return {
      ok: true,
      provider: "cloudflare-browser",
      strategy: "browser-rendered-html:1-page",
      site: site.key,
      query,
      url,
      finalUrl: page.url(),
      status: response?.status?.() ?? null,
      durationMs: Date.now() - startedAt,
      htmlBytes: new TextEncoder().encode(html).byteLength,
      rawItemCount: parsed.rawItemCount,
      itemCount: items.length,
      items,
      totalResults: parsed.totalResults,
      hasNextPage: parsed.hasNextPage,
      pagesUsed: 1,
      creditsUsed: 0,
      browserSessionsUsed: 1,
      challengeDetected: /captcha|verific[aă].{0,30}(om|robot)|access denied|just a moment/i.test(bodyText),
    };
  } finally {
    await browser.close();
  }
}
