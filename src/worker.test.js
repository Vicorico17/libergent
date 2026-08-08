import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.js";

test("exposes the direct search contract at /api/search/free", async (t) => {
  const originalMockSearch = process.env.LIBERGENT_MOCK_SEARCH;
  t.after(() => {
    if (originalMockSearch === undefined) {
      delete process.env.LIBERGENT_MOCK_SEARCH;
    } else {
      process.env.LIBERGENT_MOCK_SEARCH = originalMockSearch;
    }
  });

  const response = await worker.fetch(
    new Request("https://libergent.test/api/search/free?q=iphone&site=default&limit=5"),
    { LIBERGENT_MOCK_SEARCH: "1" }
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.searchTier, "free");
  assert.ok(payload.summary.marketplaces > 0);
});

test("enriches a supported listing directly when its analysis is opened", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () => new Response(`
    <script type="application/ld+json">
      {"@type":"Product","name":"Produs test","description":"Descriere completă","offers":{"@type":"Offer","price":100,"priceCurrency":"RON","areaServed":{"name":"Brașov"}}}
    </script>
  `, { status: 200, headers: { "content-type": "text/html" } });

  const listingUrl = "https://www.olx.ro/d/oferta/produs-test-ID123.html";
  const response = await worker.fetch(
    new Request(`https://libergent.test/api/marketplace/details?url=${encodeURIComponent(listingUrl)}`),
    {}
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.details.description, "Descriere completă");
  assert.equal(payload.details.location, "Brașov");
  assert.equal(payload.details.extraction.provider, "direct");
  assert.equal(payload.details.extraction.browserUsed, false);
});

test("rejects unsupported hosts for listing enrichment", async () => {
  const response = await worker.fetch(
    new Request("https://libergent.test/api/marketplace/details?url=https%3A%2F%2Fexample.com%2Fproduct"),
    {}
  );
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.ok, false);
  assert.match(payload.error, /not supported/i);
});

test("requires authentication before Premium search", async () => {
  const response = await worker.fetch(
    new Request("https://libergent.test/api/search/premium?q=iphone&site=all"),
    {}
  );
  const payload = await response.json();

  assert.equal(response.status, 401);
  assert.match(payload.error, /authentication/i);
});

test("requires authentication before accepting search feedback", async () => {
  const response = await worker.fetch(new Request("https://libergent.test/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: "whiteboard", feedback: "dislike", reason: "part_or_accessory" })
  }), {});
  const payload = await response.json();

  assert.equal(response.status, 401);
  assert.match(payload.error, /authentication/i);
});

test("stores authenticated structured search feedback", async (t) => {
  const originalFetch = globalThis.fetch;
  let storedRow;

  globalThis.fetch = async (url, init = {}) => {
    const requestUrl = String(url);
    if (requestUrl === "https://supabase.example/auth/v1/user") {
      return new Response(JSON.stringify({ id: "user-1", email: "buyer@example.test" }), { status: 200 });
    }
    if (requestUrl.startsWith("https://supabase.example/rest/v1/offer_feedback")) {
      storedRow = JSON.parse(init.body);
      return new Response(null, { status: 201 });
    }
    return new Response("[]", { status: 200 });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const response = await worker.fetch(new Request("https://libergent.test/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer user-token" },
    body: JSON.stringify({
      query: "whiteboard",
      feedback: "dislike",
      reason: "part_or_accessory",
      correctionText: "whiteboard magnetic 120x90",
      sessionId: "session-1",
      searchId: "search-1",
      listingFingerprint: "olx:marker-1",
      originalRank: 1,
      appliedAction: "hide_similar",
      queryUnderstanding: { target: "whiteboard" },
      listingFeatures: { accessoryTerms: ["marker"] },
      offer: { title: "Set markere whiteboard", site: "olx", url: "https://example.test/marker-1", priceRon: 25 }
    })
  }), {
    SUPABASE_URL: "https://supabase.example",
    SUPABASE_SECRET_KEY: "service-secret"
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(storedRow.user_id, "user-1");
  assert.equal(storedRow.reason, "part_or_accessory");
  assert.equal(storedRow.correction_text, "whiteboard magnetic 120x90");
  assert.equal(storedRow.applied_action, "hide_similar");
  assert.equal(storedRow.algorithm_version, "feedback-loop-v1");
});

test("keeps Premium search locked for a signed-in free account", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const requestUrl = String(url);
    if (requestUrl === "https://supabase.example/auth/v1/user") return new Response(JSON.stringify({ id: "user-free", email: "free@example.test" }), { status: 200 });
    if (requestUrl.includes("/rest/v1/user_entitlements")) return new Response("[]", { status: 200 });
    return new Response("[]", { status: 200 });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const response = await worker.fetch(new Request("https://libergent.test/api/search/premium?q=iphone&site=all", {
    headers: { authorization: "Bearer user-token" }
  }), {
    SUPABASE_URL: "https://supabase.example",
    SUPABASE_SECRET_KEY: "service-secret",
    BROWSER: {}
  });
  const payload = await response.json();

  assert.equal(response.status, 403);
  assert.equal(payload.code, "premium_required");
});

test("keeps automatic alerts behind Premium entitlement", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const requestUrl = String(url);
    if (requestUrl === "https://supabase.example/auth/v1/user") return new Response(JSON.stringify({ id: "user-free", email: "free@example.test" }), { status: 200 });
    if (requestUrl.includes("/rest/v1/user_entitlements")) return new Response("[]", { status: 200 });
    return new Response("[]", { status: 200 });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const response = await worker.fetch(new Request("https://libergent.test/api/alerts", { headers: { authorization: "Bearer user-token" } }), {
    SUPABASE_URL: "https://supabase.example",
    SUPABASE_SECRET_KEY: "service-secret"
  });
  const payload = await response.json();
  assert.equal(response.status, 403);
  assert.equal(payload.code, "premium_required");
});

test("returns Premium alert profiles and inbox events for entitled users", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const requestUrl = String(url);
    if (requestUrl === "https://supabase.example/auth/v1/user") return new Response(JSON.stringify({ id: "user-premium", email: "premium@example.test" }), { status: 200 });
    if (requestUrl.includes("/rest/v1/alert_profiles")) return new Response(JSON.stringify([{ id: "alert-1", query: "BMW 320d", status: "active" }]), { status: 200 });
    if (requestUrl.includes("/rest/v1/alert_events")) return new Response(JSON.stringify([{ id: "event-1", event_type: "price_drop" }]), { status: 200 });
    return new Response("[]", { status: 200 });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const response = await worker.fetch(new Request("https://libergent.test/api/alerts", { headers: { authorization: "Bearer user-token" } }), {
    SUPABASE_URL: "https://supabase.example",
    SUPABASE_SECRET_KEY: "service-secret",
    LIBERGENT_PREMIUM_EMAILS: "premium@example.test"
  });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.alerts[0].id, "alert-1");
  assert.equal(payload.events[0].event_type, "price_drop");
});

test("Premium search skips Browser Run when direct marketplace results are usable", async (t) => {
  const originalMockSearch = process.env.LIBERGENT_MOCK_SEARCH;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url) === "https://supabase.example/auth/v1/user") {
      return new Response(JSON.stringify({ id: "user-premium", email: "premium@example.test" }), { status: 200 });
    }
    return new Response("[]", { status: 200 });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalMockSearch === undefined) {
      delete process.env.LIBERGENT_MOCK_SEARCH;
    } else {
      process.env.LIBERGENT_MOCK_SEARCH = originalMockSearch;
    }
  });

  const response = await worker.fetch(
    new Request("https://libergent.test/api/search/premium?q=iphone&site=all&limit=5", {
      headers: { authorization: "Bearer user-token" }
    }),
    {
      BROWSER: {},
      LIBERGENT_MOCK_SEARCH: "1",
      SUPABASE_URL: "https://supabase.example",
      SUPABASE_SECRET_KEY: "service-secret",
      LIBERGENT_PREMIUM_EMAILS: "premium@example.test"
    }
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.summary.browserMarketplaces, 0);
  assert.equal(payload.summary.browserSessionsUsed, 0);
  assert.equal(payload.summary.browserFallbackLimit, payload.summary.browserEligibleMarketplaces);
  assert.equal(payload.summary.kitesurfEnabled, true);
  assert.equal(payload.summary.successfulKitesurfMarketplaces, 0);
  assert.deepEqual(payload.summary.browserFallbackMarketplaces, []);
  assert.deepEqual(payload.summary.kitesurfFallbackMarketplaces, []);
  assert.deepEqual(payload.summary.chromiumFallbackMarketplaces, []);
  assert.deepEqual(payload.summary.browserDiagnostics, []);
});

test("Premium search attempts Kitesurf for every empty selected source before bounded Chromium recovery", async (t) => {
  const originalMockSearch = process.env.LIBERGENT_MOCK_SEARCH;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url) === "https://supabase.example/auth/v1/user") {
      return new Response(JSON.stringify({ id: "user-premium", email: "premium@example.test" }), { status: 200 });
    }
    if (String(url).startsWith("https://supabase.example/")) {
      return new Response("[]", { status: 200 });
    }
    return new Response("<html><body>No matching products</body></html>", {
      status: 200,
      headers: { "content-type": "text/html" }
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalMockSearch === undefined) {
      delete process.env.LIBERGENT_MOCK_SEARCH;
    } else {
      process.env.LIBERGENT_MOCK_SEARCH = originalMockSearch;
    }
  });

  const browserBinding = {
    fetch: async () => new Response("preview browser unavailable", { status: 503 })
  };
  const response = await worker.fetch(
    new Request("https://libergent.test/api/search/premium?q=iphone&site=all&limit=5", {
      headers: { authorization: "Bearer user-token" }
    }),
    {
      BROWSER: browserBinding,
      LIBERGENT_MOCK_SEARCH: "0",
      SUPABASE_URL: "https://supabase.example",
      SUPABASE_SECRET_KEY: "service-secret",
      LIBERGENT_PREMIUM_EMAILS: "premium@example.test"
    }
  );
  const payload = await response.json();
  const kitesurfDiagnostics = payload.summary.browserDiagnostics.filter((entry) => entry.engine === "kitesurf");
  const chromiumDiagnostics = payload.summary.browserDiagnostics.filter((entry) => entry.engine === "chromium");

  assert.equal(response.status, 200);
  assert.equal(payload.summary.kitesurfFallbackMarketplaces.length, payload.summary.browserEligibleMarketplaces);
  assert.equal(kitesurfDiagnostics.length, payload.summary.browserEligibleMarketplaces);
  assert.equal(chromiumDiagnostics.length, 5);
  assert.deepEqual(payload.summary.chromiumFallbackMarketplaces, ["okazii.ro", "compari.ro", "pcgarage.ro", "flanco.ro", "altex.ro"]);
  assert.equal(kitesurfDiagnostics.every((entry) => entry.ok === false), true);
});

test("posts WhatsApp messages to the configured OpenClaw bridge", async (t) => {
  const originalFetch = globalThis.fetch;
  let bridgeRequest;
  let storedMessage;

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (url, init) => {
    const requestUrl = String(url);
    if (requestUrl === "https://supabase.example/auth/v1/user") {
      return new Response(JSON.stringify({ id: "user-1", email: "buyer@example.test" }), { status: 200 });
    }
    if (requestUrl.startsWith("https://supabase.example/rest/v1/whatsapp_messages")) {
      storedMessage = JSON.parse(init.body);
      return new Response(null, { status: 201 });
    }
    bridgeRequest = { url: requestUrl, init };
    return new Response(JSON.stringify({ ok: true, messageId: "msg_123" }), { status: 200 });
  };

  const response = await worker.fetch(
    new Request("https://libergent.test/api/whatsapp/send", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer user-token" },
      body: JSON.stringify({ target: "0722 123 456", message: "Salut", listing: { url: "https://www.olx.ro/d/oferta/test.html", title: "Test OLX" } })
    }),
    {
      OPENCLAW_BRIDGE_URL: "https://bridge.example/",
      OPENCLAW_BRIDGE_TOKEN: "secret",
      SUPABASE_URL: "https://supabase.example",
      SUPABASE_SECRET_KEY: "service-secret"
    }
  );

  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.target, "+40722123456");
  assert.equal(payload.messageId, "msg_123");
  assert.match(payload.conversationId, /^wa_/);
  assert.equal(payload.historySaved, true);
  assert.equal(bridgeRequest.url, "https://bridge.example/whatsapp/send");
  assert.equal(bridgeRequest.init.headers.authorization, "Bearer secret");
  assert.equal(bridgeRequest.init.body, JSON.stringify({ target: "+40722123456", message: "Salut" }));
  assert.equal(storedMessage.raw.userId, "user-1");
  assert.equal(storedMessage.raw.listing.title, "Test OLX");
});

test("requires the OpenClaw bridge token before sending WhatsApp messages", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ id: "user-1" }), { status: 200 });
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const response = await worker.fetch(
    new Request("https://libergent.test/api/whatsapp/send", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer user-token" },
      body: JSON.stringify({ target: "+40722123456", message: "Salut" })
    }),
    {
      OPENCLAW_BRIDGE_URL: "https://bridge.example",
      SUPABASE_URL: "https://supabase.example",
      SUPABASE_SECRET_KEY: "service-secret"
    }
  );

  const payload = await response.json();

  assert.equal(response.status, 503);
  assert.equal(payload.ok, false);
  assert.match(payload.error, /not configured/i);
});

test("returns only the authenticated account's seller conversations", async (t) => {
  const originalFetch = globalThis.fetch;
  let historyRequestUrl = "";
  globalThis.fetch = async (url) => {
    const requestUrl = String(url);
    if (requestUrl === "https://supabase.example/auth/v1/user") {
      return new Response(JSON.stringify({ id: "user-1" }), { status: 200 });
    }
    historyRequestUrl = requestUrl;
    return new Response(JSON.stringify([
      { message_id: "mine", direction: "outbound", from_number: "agent", to_number: "+40722111111", text: "Salut", received_at: "2026-07-19T10:00:00Z", raw: { userId: "user-1", listing: { url: "https://example.test/mine", title: "Al meu" } } },
      { message_id: "theirs", direction: "outbound", from_number: "agent", to_number: "+40722222222", text: "Secret", received_at: "2026-07-19T10:01:00Z", raw: { userId: "user-2", listing: { url: "https://example.test/theirs", title: "Al altuia" } } }
    ]), { status: 200 });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const response = await worker.fetch(new Request("https://libergent.test/api/conversations", {
    headers: { authorization: "Bearer user-token" }
  }), {
    SUPABASE_URL: "https://supabase.example",
    SUPABASE_SECRET_KEY: "service-secret"
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.conversations.length, 1);
  assert.equal(payload.conversations[0].listingTitle, "Al meu");
  assert.doesNotMatch(JSON.stringify(payload), /Secret|Al altuia/);
  assert.equal(new URL(historyRequestUrl).searchParams.get("raw->>userId"), "eq.user-1");
});


test("resolves OLX listing phones through the OLX offer phone endpoint", async (t) => {
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (url) => {
    requestedUrls.push(String(url));
    if (String(url).includes("/api/v1/offers/299484800/phones/")) {
      return new Response(JSON.stringify({ data: { phones: ["076 720 9070"] } }), { status: 200 });
    }
    return new Response(String.raw`window.__PRERENDERED_STATE__= "{\\"ad\\":{\\"ad\\":{\\"id\\":299484800,\\"title\\":\\"Kirby Air Riders Nintendo Switch 2 nou sigilat\\"}}}"; support +40201100020`, { status: 200 });
  };

  const listingUrl = "https://www.olx.ro/d/oferta/kirby-air-riders-nintendo-switch-2-nou-sigilat-IDkgBG0.html";
  const response = await worker.fetch(
    new Request(`https://libergent.test/api/marketplace/contact?url=${encodeURIComponent(listingUrl)}`),
    {}
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload.phones, ["+40767209070"]);
  assert.equal(payload.contactStatus, "phone_found");
  assert.equal(payload.marketplace, "olx.ro");
  assert.equal(payload.debug.offerId, "299484800");
  assert.equal(requestedUrls[1], "https://www.olx.ro/api/v1/offers/299484800/phones/");
});

test("resolves OLX listing phones when the ad JSON uses normal quotes and spacing", async (t) => {
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (url) => {
    requestedUrls.push(String(url));
    if (String(url).includes("/api/v1/offers/421337/phones/")) {
      return new Response(JSON.stringify({ data: { phones: ["0744 555 666"] } }), { status: 200 });
    }
    return new Response(
      '<script>window.state = {"ad":{"id":421337, "title":"Aparat de cafea"}}</script>',
      { status: 200 }
    );
  };

  const listingUrl = "https://www.olx.ro/d/oferta/aparat-de-cafea-bialetti-new-venus-2-cani-IDkMfce.html";
  const response = await worker.fetch(
    new Request(`https://libergent.test/api/marketplace/contact?url=${encodeURIComponent(listingUrl)}`),
    {}
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload.phones, ["+40744555666"]);
  assert.equal(requestedUrls[1], "https://www.olx.ro/api/v1/offers/421337/phones/");
});

test("resolves OLX phones when the phone endpoint returns phone objects", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (url) => {
    if (String(url).includes("/api/v1/offers/421338/phones/")) {
      return new Response(JSON.stringify({ data: { phones: [{ phoneNumber: "0755 111 222" }] } }), { status: 200 });
    }
    return new Response('<script>window.state = {"ad":{"id":421338,"title":"Aparat"}}</script>', { status: 200 });
  };

  const listingUrl = "https://www.olx.ro/d/oferta/aparat-IDtest.html";
  const response = await worker.fetch(
    new Request(`https://libergent.test/api/marketplace/contact?url=${encodeURIComponent(listingUrl)}`),
    {}
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload.phones, ["+40755111222"]);
});

test("falls back to OLX limited-phones when the regular endpoint is empty", async (t) => {
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (url) => {
    const requestUrl = String(url);
    requestedUrls.push(requestUrl);
    if (requestUrl.includes("/limited-phones/")) {
      return new Response(JSON.stringify({ data: { phones: ["0733 444 555"] } }), { status: 200 });
    }
    if (requestUrl.includes("/phones/")) {
      return new Response(JSON.stringify({ data: { phones: [] } }), { status: 200 });
    }
    return new Response('<script>window.state = {"ad":{"id":421339,"title":"Aparat"}}</script>', { status: 200 });
  };

  const listingUrl = "https://www.olx.ro/d/oferta/espressor-IDkMeZT.html";
  const response = await worker.fetch(
    new Request(`https://libergent.test/api/marketplace/contact?url=${encodeURIComponent(listingUrl)}`),
    {}
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload.phones, ["+40733444555"]);
  assert.deepEqual(payload.debug.attempts, [
    { endpoint: "phones", status: 200, phones: 0 },
    { endpoint: "limited-phones", status: 200, phones: 1 }
  ]);
  assert.equal(requestedUrls[1], "https://www.olx.ro/api/v1/offers/421339/phones/");
  assert.equal(requestedUrls[2], "https://www.olx.ro/api/v1/offers/421339/limited-phones/");
});

test("keeps OLX listing cookies when requesting the seller phone", async (t) => {
  const originalFetch = globalThis.fetch;
  let phoneRequest;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (url, init = {}) => {
    if (String(url).includes("/api/v1/offers/421340/phones/")) {
      phoneRequest = init;
      return new Response(JSON.stringify({ data: { phones: ["0722 333 444"] } }), { status: 200 });
    }
    return new Response('<script>window.state = {"ad":{"id":421340,"title":"Aparat"}}</script>', {
      status: 200,
      headers: { "set-cookie": "device_id=public-session; Path=/; Secure; HttpOnly" }
    });
  };

  const listingUrl = "https://www.olx.ro/d/oferta/espressor-IDcookie.html";
  const response = await worker.fetch(
    new Request(`https://libergent.test/api/marketplace/contact?url=${encodeURIComponent(listingUrl)}`),
    {}
  );
  const payload = await response.json();

  assert.deepEqual(payload.phones, ["+40722333444"]);
  assert.equal(payload.debug.cookieReceived, true);
  assert.equal(phoneRequest.headers.cookie, "device_id=public-session");
  assert.equal(phoneRequest.headers["x-requested-with"], "XMLHttpRequest");
});
