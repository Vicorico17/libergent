import test from "node:test";
import assert from "node:assert/strict";
import { sendWhatsAppViaOpenClaw } from "./openclaw.js";

test("sends a normalized Romanian WhatsApp message through the bridge", async () => {
  let request;
  const result = await sendWhatsAppViaOpenClaw({
    target: "0722 123 456",
    message: "Salut",
    env: { OPENCLAW_BRIDGE_URL: "https://bridge.example", OPENCLAW_BRIDGE_TOKEN: "secret" },
    fetchImpl: async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
  });

  assert.equal(result.ok, true);
  assert.equal(request.url, "https://bridge.example/whatsapp/send");
  assert.equal(request.init.headers.Authorization, "Bearer secret");
  assert.match(request.init.body, /\+40722123456/);
});

test("requires bridge configuration", async () => {
  await assert.rejects(
    () => sendWhatsAppViaOpenClaw({ target: "+40722123456", message: "Salut", env: {} }),
    /not configured/
  );
});
