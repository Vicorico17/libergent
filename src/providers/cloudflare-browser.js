import puppeteer from "@cloudflare/puppeteer";
import { extractRomanianMobilePhones } from "../phone-numbers.js";
import { parseSiteHtml } from "../site-html-parser.js";
import { filterRelevantItems } from "../search.js";

const OLX_PHONE_RESPONSE_PATTERN = /\/offers\/\d+\/[^?]*phone/i;
const BROWSER_ENGINES = new Set(["chromium", "kitesurf"]);

export function normalizeBrowserEngine(value = "chromium") {
  const engine = String(value || "chromium").trim().toLowerCase();
  if (!BROWSER_ENGINES.has(engine)) throw new Error(`Unsupported browser engine "${engine}".`);
  return engine;
}

async function launchBrowser(launch, browserBinding, engine) {
  return engine === "kitesurf"
    ? launch(browserBinding, { browser: "kitesurf" })
    : launch(browserBinding);
}

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

    const consentButton = await page.evaluate(() => {
      const normalize = (value) => String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
      const dialogs = [...document.querySelectorAll('[role="dialog"], [aria-modal="true"]')];
      const candidates = dialogs.flatMap((dialog) => [...dialog.querySelectorAll("button")]);
      const acceptButton = candidates.find((element) => {
        const text = normalize(element.textContent);
        const style = window.getComputedStyle(element);
        const visible = element.getClientRects().length > 0 && style.visibility !== "hidden" && style.display !== "none";
        return visible && ["accepta", "accepta toate", "accept tot", "sunt de acord"].includes(text);
      });
      if (!acceptButton) return null;
      acceptButton.scrollIntoView({ block: "center", inline: "center" });
      const rect = acceptButton.getBoundingClientRect();
      return rect.width && rect.height
        ? { x: rect.left + (rect.width / 2), y: rect.top + (rect.height / 2) }
        : null;
    });
    if (consentButton) {
      await page.mouse.click(consentButton.x, consentButton.y);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

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
      const candidates = [...document.querySelectorAll('[data-testid="show-phone"], button, a')];
      const contactButton = candidates.find((element) => {
        const text = normalize(element.textContent);
        const style = window.getComputedStyle(element);
        const visible = element.getClientRects().length > 0 && style.visibility !== "hidden" && style.display !== "none";
        const enabled = !element.disabled && element.getAttribute("aria-disabled") !== "true" && element.getAttribute("data-button-disabled") !== "true";
        const isPhoneControl = element.getAttribute("data-testid") === "show-phone" ||
          text.includes("suna vanzatorul") || text.includes("arata telefon") ||
          text === "arata" || text.includes("afiseaza telefon") || text.includes("show phone");
        return visible && enabled && isPhoneControl;
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
      return { phones: [], debug: { configured: true, consentDismissed: Boolean(consentButton), clicked: false } };
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
        debug: { configured: true, consentDismissed: Boolean(consentButton), clicked: true, responseStatus, source: "phone-response" }
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
        consentDismissed: Boolean(consentButton),
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
  { launch = puppeteer.launch, engine = "chromium" } = {}
) {
  const result = await searchMarketplaceWithBrowser(
    browserBinding,
    { site, query, limit },
    { launch, includeBodyText: true, engine }
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
    queryMismatchItemCount: result.queryMismatchItemCount,
    totalResults: result.totalResults,
    hasNextPage: result.hasNextPage,
    challengeDetected: result.challengeDetected,
    browserEngine: result.browserEngine,
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
  { launch = puppeteer.launch, includeBodyText = false, browser: sharedBrowser = null, engine = "chromium" } = {}
) {
  if (!browserBinding) throw new Error("Cloudflare Browser Run is not configured.");

  const browserEngine = normalizeBrowserEngine(engine);
  const url = site.searchUrl(query);
  const startedAt = Date.now();
  const browser = sharedBrowser || await launchBrowser(launch, browserBinding, browserEngine);
  const ownsBrowser = !sharedBrowser;
  let page;
  try {
    page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000 });
    let response = null;
    let navigationTimeoutError = null;
    try {
      response = await page.goto(url, {
        waitUntil: site.browserWaitUntil || "networkidle2",
        timeout: site.timeoutMs || 30000
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const currentUrl = page.url?.() || "";
      const usableTimedOutNavigation = /navigation timeout|timeout.+exceeded/i.test(message)
        && currentUrl
        && currentUrl !== "about:blank";
      if (!usableTimedOutNavigation) throw error;
      navigationTimeoutError = error;
    }
    const browserWaitForMs = Math.max(0, Math.min(Number(site.browserWaitForMs) || 0, 5000));
    if (browserWaitForMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, browserWaitForMs));
    }
    const html = await page.content();
    const parsed = parseSiteHtml({ site, html, url, limit, query });
    if (navigationTimeoutError && parsed.rawItemCount === 0) {
      throw navigationTimeoutError;
    }
    const bodyText = includeBodyText
      ? await page.evaluate(() => document.body?.innerText || "")
      : "";
    const challengeDetected = /captcha|verific[aă].{0,30}(om|robot)|access denied|just a moment|sorry, you have been blocked|unable to access/i.test(bodyText) ||
      /<title[^>]*>\s*(just a moment|attention required[^<]*cloudflare)|cdn-cgi\/challenge-platform|id=["']cf-error-details|class=["'][^"']*captcha-container|access denied/i
        .test(html.slice(0, 30000));
    const relevantItems = site.disableQueryFilter ? parsed.items : filterRelevantItems(parsed.items, query);
    const items = relevantItems.map((item) => ({
      ...item,
      sourceType: item.sourceType || site.sourceType || "classifieds",
      condition: item.condition || site.defaultCondition || "",
      sellerType: item.sellerType || site.defaultSellerType || ""
    }));

    return {
      ok: true,
      provider: browserEngine === "kitesurf" ? "cloudflare-kitesurf" : "cloudflare-browser",
      strategy: `${browserEngine}-rendered-html:1-page`,
      browserEngine,
      site: site.key,
      query,
      url,
      finalUrl: page.url(),
      status: response?.status?.() ?? null,
      durationMs: Date.now() - startedAt,
      htmlBytes: new TextEncoder().encode(html).byteLength,
      rawItemCount: parsed.rawItemCount,
      itemCount: items.length,
      queryMismatchItemCount: Math.max(0, parsed.rawItemCount - items.length),
      items,
      totalResults: parsed.totalResults,
      hasNextPage: parsed.hasNextPage,
      pagesUsed: 1,
      creditsUsed: 0,
      browserSessionsUsed: 1,
      challengeDetected,
    };
  } finally {
    if (page?.close) await page.close().catch(() => {});
    if (ownsBrowser) await browser.close();
  }
}

export async function searchMarketplacesWithBrowser(
  browserBinding,
  searches,
  { launch = puppeteer.launch, includeBodyText = false, concurrency = 2, engine = "chromium" } = {}
) {
  if (!browserBinding) throw new Error("Cloudflare Browser Run is not configured.");
  const browserEngine = normalizeBrowserEngine(engine);
  const browser = await launchBrowser(launch, browserBinding, browserEngine);
  const results = new Array(searches.length);
  let nextIndex = 0;

  async function pageWorker() {
    while (nextIndex < searches.length) {
      const index = nextIndex;
      nextIndex += 1;
      const search = searches[index];
      try {
        results[index] = await searchMarketplaceWithBrowser(browserBinding, search, {
          includeBodyText,
          browser,
          engine: browserEngine
        });
      } catch (error) {
        results[index] = {
          ok: false,
          site: search.site.key,
          query: search.query,
          provider: browserEngine === "kitesurf" ? "cloudflare-kitesurf" : "cloudflare-browser",
          browserEngine,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
  }

  try {
    const workerCount = Math.max(1, Math.min(Number(concurrency) || 1, searches.length));
    await Promise.all(Array.from({ length: workerCount }, () => pageWorker()));
    return results.map((result, index) => ({
      ...result,
      browserSessionsUsed: index === 0 ? 1 : 0
    }));
  } finally {
    await browser.close();
  }
}
