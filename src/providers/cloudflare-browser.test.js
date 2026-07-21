import test from "node:test";
import assert from "node:assert/strict";
import { benchmarkMarketplaceWithBrowser, revealOlxPhonesWithBrowser, searchMarketplaceWithBrowser, searchMarketplacesWithBrowser } from "./cloudflare-browser.js";

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
  let evaluateCall = 0;
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
    evaluate: async () => {
      evaluateCall += 1;
      return evaluateCall === 1 ? null : { text: "Sună vânzătorul", x: 420, y: 180 };
    },
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
    consentDismissed: false,
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

test("searches multiple marketplaces with one shared browser session", async () => {
  let launches = 0;
  let browserCloses = 0;
  let pageCloses = 0;
  const launch = async () => {
    launches += 1;
    return {
      newPage: async () => ({
        setViewport: async () => {},
        goto: async () => ({ status: () => 200 }),
        content: async () => "<html><body>No products</body></html>",
        evaluate: async () => "No products",
        url: () => "https://example.test/search",
        close: async () => { pageCloses += 1; }
      }),
      close: async () => { browserCloses += 1; }
    };
  };
  const sites = ["one", "two"].map((key) => ({
    key: `${key}.ro`,
    strategy: "direct-html-retail",
    timeoutMs: 1000,
    searchUrl: () => `https://${key}.example/search`
  }));

  const results = await searchMarketplacesWithBrowser({}, sites.map((site) => ({ site, query: "iphone", limit: 5 })), { launch, concurrency: 2 });

  assert.equal(results.length, 2);
  assert.equal(launches, 1);
  assert.equal(pageCloses, 2);
  assert.equal(browserCloses, 1);
  assert.equal(results.reduce((sum, result) => sum + result.browserSessionsUsed, 0), 1);
});

test("uses site-specific browser navigation readiness for long-lived retail pages", async () => {
  let gotoOptions;
  const launch = async () => ({
    newPage: async () => ({
      setViewport: async () => {},
      goto: async (_url, options) => {
        gotoOptions = options;
        return { status: () => 200 };
      },
      content: async () => "<html><body>No products</body></html>",
      evaluate: async () => "No products",
      url: () => "https://retailer.example/search",
      close: async () => {}
    }),
    close: async () => {}
  });
  const site = {
    key: "retailer.ro",
    strategy: "direct-html-retail",
    timeoutMs: 16000,
    browserWaitUntil: "domcontentloaded",
    searchUrl: () => "https://retailer.example/search"
  };

  await searchMarketplaceWithBrowser({}, { site, query: "ps5", limit: 5 }, { launch });

  assert.deepEqual(gotoOptions, { waitUntil: "domcontentloaded", timeout: 16000 });
});

test("parses a page whose navigation times out after reaching the marketplace", async () => {
  let closed = false;
  const launch = async () => ({
    newPage: async () => ({
      setViewport: async () => {},
      goto: async () => {
        throw new Error("Navigation timeout of 16000 ms exceeded");
      },
      content: async () => `
        <article class="product">
          <a href="/telefon-iphone-15" title="Apple iPhone 15 128GB">Apple iPhone 15 128GB</a>
          <span class="price">3.499 lei</span>
        </article>
      `,
      evaluate: async () => "Apple iPhone 15 128GB 3.499 lei",
      url: () => "https://altex.ro/cauta/?q=iphone%2015",
      close: async () => { closed = true; }
    }),
    close: async () => {}
  });
  const site = {
    key: "altex.ro",
    strategy: "direct-html-retail",
    timeoutMs: 16000,
    browserWaitUntil: "domcontentloaded",
    searchUrl: () => "https://altex.ro/cauta/?q=iphone%2015"
  };

  const result = await searchMarketplaceWithBrowser({}, { site, query: "iphone 15", limit: 5 }, { launch });

  assert.equal(result.ok, true);
  assert.equal(result.status, null);
  assert.equal(result.itemCount, 1);
  assert.equal(closed, true);
});
