import test from "node:test";
import assert from "node:assert/strict";
import { generateDealReplyWithModel, validateModelDealReply } from "./deal-ai.js";

const deal = { stage: "negotiating", listing_title: "Telefon", marketplace: "OLX", listing_price: "1900 RON", brief: { maxPriceRon: 1800, openingOfferRon: 1500, questions: [] } };
const conversation = { messages: [{ direction: "outbound", text: "Mai este disponibil?" }, { direction: "inbound", text: "Da, ce preț oferiți?" }] };

test("model reply validator rejects above-limit prices and binding commitments", () => {
  assert.throws(() => validateModelDealReply({ message: "Oferim 1900 RON", offerRon: 1900 }, deal), /limit/);
  assert.throws(() => validateModelDealReply({ message: "Acceptăm oferta", offerRon: null }, deal), /commitment/);
  assert.equal(validateModelDealReply({ message: "Pot oferi 1500 RON?", offerRon: 1500, reason: "Brief", needsBuyerDecision: false }, deal).offerRon, 1500);
});

test("model draft uses a structured response without storing it", async (t) => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url: String(url), init };
    return new Response(JSON.stringify({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify({ message: "Pot oferi 1500 RON?", reason: "Within brief", needsBuyerDecision: false, offerRon: 1500 }) }] }] }), { status: 200 });
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  const result = await generateDealReplyWithModel(deal, conversation, { OPENAI_API_KEY: "test-key", DEAL_AGENT_OPENAI_MODEL: "test-model" });
  assert.equal(result.offerRon, 1500);
  assert.equal(request.url, "https://api.openai.com/v1/responses");
  const body = JSON.parse(request.init.body);
  assert.equal(body.store, false);
  assert.equal(body.text.format.type, "json_schema");
  assert.equal(body.model, "test-model");
  assert.doesNotMatch(body.input, /test-key/);
});
