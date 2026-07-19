import puppeteer from "@cloudflare/puppeteer";
import { extractRomanianMobilePhones } from "../phone-numbers.js";

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
