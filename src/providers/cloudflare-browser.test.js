import test from "node:test";
import assert from "node:assert/strict";
import { benchmarkMarketplaceWithBrowser, revealOlxPhonesWithBrowser } from "./cloudflare-browser.js";

test("returns an unconfigured result without launching a browser", async () => {
  let launched = false;
  const result = await revealOlxPhonesWithBrowser(null, "https://www.olx.ro/d/oferta/test.html", {
    launch: async () => {
      launched = true;
    }
  });

  assert.equal(launched, false);
  assert.deepEqual(result, { phones: [], debug: { configured: false } });
});

test("clicks the OLX seller button and extracts the phone response", async () => {
  let closed = false;
  let clickedPoint = null;
  let navigatedTo = "";
  const response = {
    url: () => "https://www.olx.ro/api/v1/offers/307024117/phones/",
    status: () => 200,
    json: async () => ({ data: { phones: ["0722 123 456"] } })
  };
  const page = {
    setViewport: async () => {},
    goto: async (url) => {
      navigatedTo = url;
    },
    waitForResponse: async (predicate) => predicate(response) ? response : null,
    evaluate: async () => ({ text: "Sună vânzătorul", x: 420, y: 180 }),
    mouse: {
      click: async (x, y) => {
        clickedPoint = { x, y };
      }
    }
  };
  const launch = async () => ({
    newPage: async () => page,
    close: async () => {
      closed = true;
    }
  });

  const listingUrl = "https://www.olx.ro/d/oferta/espressor-IDkMeZT.html";
  const result = await revealOlxPhonesWithBrowser({}, listingUrl, { launch });

  assert.equal(navigatedTo, listingUrl);
  assert.deepEqual(clickedPoint, { x: 420, y: 180 });
  assert.equal(closed, true);
  assert.deepEqual(result.phones, ["+40722123456"]);
  assert.deepEqual(result.debug, {
    configured: true,
    clicked: true,
    responseStatus: 200,
    source: "phone-response"
  });
});

test("benchmarks rendered marketplace HTML with the existing site parser", async () => {
  let closed = false;
  const page = {
    setViewport: async () => {},
    goto: async () => ({ status: () => 200 }),
    content: async () => `
      <div class="itm">
        <div class="card-title"><a href="/anunt-iphone-test">iPhone test</a></div>
        <div class="card-text text-red-at">1.200 RON</div>
      </div>`,
    evaluate: async () => "iPhone test 1.200 RON",
    url: () => "https://www.anuntul.ro/anunturi/?q=iphone"
  };
  const launch = async () => ({
    newPage: async () => page,
    close: async () => {
      closed = true;
    }
  });
  const site = {
    key: "anuntul.ro",
    strategy: "direct-html-local",
    timeoutMs: 1000,
    searchUrl: () => "https://www.anuntul.ro/anunturi/?q=iphone"
  };

  const result = await benchmarkMarketplaceWithBrowser({}, { site, query: "iphone", limit: 5 }, { launch });

  assert.equal(closed, true);
  assert.equal(result.status, 200);
  assert.equal(result.itemCount, 1);
  assert.equal(result.sample[0].title, "iPhone test");
});
