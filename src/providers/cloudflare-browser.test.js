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

test("launches Kitesurf through the Browser Run binding and labels its results", async () => {
  let launchOptions;
  const launch = async (_binding, options) => {
    launchOptions = options;
    return {
      newPage: async () => ({
        setViewport: async () => {},
        goto: async () => ({ status: () => 200 }),
        content: async () => "<html><body>No products</body></html>",
        evaluate: async () => "No products",
        url: () => "https://example.test/search",
        close: async () => {}
      }),
      close: async () => {}
    };
  };
  const site = {
    key: "example.ro",
    strategy: "direct-html-retail",
    timeoutMs: 1000,
    searchUrl: () => "https://example.test/search"
  };

  const [result] = await searchMarketplacesWithBrowser(
    {},
    [{ site, query: "iphone", limit: 5 }],
    { launch, engine: "kitesurf" }
  );

  assert.deepEqual(launchOptions, { browser: "kitesurf" });
  assert.equal(result.browserEngine, "kitesurf");
  assert.equal(result.provider, "cloudflare-kitesurf");
  assert.equal(result.strategy, "kitesurf-rendered-html:1-page");
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

test("detects a browser challenge from rendered HTML when visible body text is empty", async () => {
  const launch = async () => ({
    newPage: async () => ({
      setViewport: async () => {},
      goto: async () => ({ status: () => 403 }),
      content: async () => '<html><head><title>Just a moment...</title></head><body><script src="/cdn-cgi/challenge-platform/test"></script></body></html>',
      evaluate: async () => "",
      url: () => "https://challenge.example/search",
      close: async () => {}
    }),
    close: async () => {}
  });
  const site = {
    key: "challenge.ro",
    strategy: "direct-html-retail",
    timeoutMs: 1000,
    searchUrl: () => "https://challenge.example/search"
  };

  const result = await searchMarketplaceWithBrowser(
    {},
    { site, query: "iphone", limit: 5 },
    { launch, includeBodyText: true, engine: "kitesurf" }
  );

  assert.equal(result.challengeDetected, true);
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

test('browser waits for result cards and collects another page after accessories', async () => {
  const { SITES } = await import('../sites.js');
  const calls = [];
  const selectors = [];
  let closed = 0;
  const card = (id, title) => `<div data-cy="l-card" data-testid="l-card"><a href="/d/oferta/phone-ID${id}.html"><h4>${title}</h4></a><p data-testid="ad-price">2000 lei</p></div>`;
  const launch = async () => ({
    newPage: async () => {
      let current;
      return {
        setViewport: async () => {},
        goto: async url => { current = url; calls.push(url); return { status: () => 200 }; },
        waitForSelector: async selector => { selectors.push(selector); },
        content: async () => current.includes('page=2') ? card('2', 'iPhone 15 128GB') : card('1', 'Husa iPhone 15') + '<a rel="next" href="?page=2">Next</a>',
        url: () => current,
        close: async () => {}
      };
    },
    close: async () => { closed++; }
  });
  const result = await searchMarketplaceWithBrowser({}, { site: SITES['olx.ro'], query: 'iphone 15', limit: 1 }, { launch });
  assert.equal(result.eligibleItemCount, 1);
  assert.equal(result.items[0].title, 'iPhone 15 128GB');
  assert.equal(result.pagesUsed, 2);
  assert.equal(calls.length, 2);
  assert.deepEqual(selectors, ['[data-testid="l-card"]', '[data-testid="l-card"]']);
  assert.equal(closed, 1);
});

test('browser uses only the known search JSON endpoint for structured recovery', async () => {
  let responseHandler;
  const endpoint = 'https://retailer.test/api/search?q=iphone';
  const launch = async () => ({
    newPage: async () => ({
      setViewport: async () => {},
      on: (event, handler) => { if (event === 'response') responseHandler = handler; },
      goto: async () => {
        responseHandler({ url: () => 'https://retailer.test/account', status: () => 200, text: () => { throw new Error('Private response must not be read'); } });
        responseHandler({ url: () => endpoint, status: () => 200, text: async () => JSON.stringify({ products: [{ name: 'iPhone 15 128GB', sku: 'ABC', url_key: 'iphone-15', price: 2000 }], meta: { items: 1, page: 1, total_pages: 1 } }) });
        return { status: () => 200 };
      },
      content: async () => '<html><body>Application shell</body></html>',
      url: () => 'https://retailer.test/search',
      close: async () => {}
    }),
    close: async () => {}
  });
  const site = { key: 'retailer.test', strategy: 'direct-json-retail', searchUrl: () => endpoint, searchPageUrl: () => 'https://retailer.test/search', timeoutMs: 1000 };
  const result = await searchMarketplaceWithBrowser({}, { site, query: 'iphone 15', limit: 5 }, { launch });
  assert.equal(result.ok, true);
  assert.equal(result.extractionMethod, 'browser-search-json');
  assert.equal(result.eligibleItemCount, 1);
});

test('browser preserves useful first-page results when later navigation fails', async () => {
  const { SITES } = await import('../sites.js');
  const launch = async () => ({
    newPage: async () => {
      let url;
      return { setViewport: async () => {}, goto: async next => { url = next; if (next.includes('page=2')) throw new Error('connection closed'); return { status: () => 200 }; },
        url: () => url,
        content: async () => '<div data-cy="l-card" data-testid="l-card"><a href="/d/oferta/phone-ID1.html"><h4>iPhone 15 128GB</h4></a><p data-testid="ad-price">2000 lei</p></div><a rel="next" href="?page=2">Next</a>',
        close: async () => {} };
    }, close: async () => {}
  });
  const result = await searchMarketplaceWithBrowser({}, { site: SITES['olx.ro'], query: 'iphone 15', limit: 10 }, { launch });
  assert.equal(result.ok, true);
  assert.equal(result.eligibleItemCount, 1);
  assert.equal(result.exhaustedReason, 'page-error');
  assert.match(result.pageError, /connection closed/);
});
