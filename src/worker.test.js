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
