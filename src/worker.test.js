import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.js";

test("posts WhatsApp messages to the configured OpenClaw bridge", async (t) => {
  const originalFetch = globalThis.fetch;
  let bridgeRequest;

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (url, init) => {
    bridgeRequest = { url, init };
    return new Response(JSON.stringify({ ok: true, messageId: "msg_123" }), { status: 200 });
  };

  const response = await worker.fetch(
    new Request("https://libergent.test/api/whatsapp/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target: "0722 123 456", message: "Salut" })
    }),
    {
      OPENCLAW_BRIDGE_URL: "https://bridge.example/",
      OPENCLAW_BRIDGE_TOKEN: "secret"
    }
  );

  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.target, "+40722123456");
  assert.equal(payload.messageId, "msg_123");
  assert.equal(bridgeRequest.url, "https://bridge.example/whatsapp/send");
  assert.equal(bridgeRequest.init.headers.authorization, "Bearer secret");
  assert.equal(bridgeRequest.init.body, JSON.stringify({ target: "+40722123456", message: "Salut" }));
});

test("requires the OpenClaw bridge token before sending WhatsApp messages", async () => {
  const response = await worker.fetch(
    new Request("https://libergent.test/api/whatsapp/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target: "+40722123456", message: "Salut" })
    }),
    {
      OPENCLAW_BRIDGE_URL: "https://bridge.example"
    }
  );

  const payload = await response.json();

  assert.equal(response.status, 503);
  assert.equal(payload.ok, false);
  assert.match(payload.error, /not configured/i);
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
