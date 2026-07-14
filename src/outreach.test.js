import test from "node:test";
import assert from "node:assert/strict";
import { buildOpenAIRealtimeConfig, buildOpenClawHandoff, buildOutreachBrief, buildWhatsAppOptInMessage } from "./outreach.js";
import { buildCallJobs } from "./call-pipeline.js";

const listing = {
  title: "iPhone 15 Pro 256GB",
  price: "2500 lei",
  priceRon: 2500,
  condition: "folosit",
  marketType: "secondary",
  whyThisDeal: ["Se potrivește prin: iphone, 15, pro."]
};

test("builds a consented product outreach brief", () => {
  const job = buildCallJobs([{ ...listing, description: "Tel 0722 123 456", url: "https://example.test/item" }], { consented: true, approved: true })[0];
  const brief = buildOutreachBrief({
    job,
    listing,
    approved: true,
    consent: { granted: true, source: "seller_opt_in", at: "2026-07-15T10:00:00Z" }
  });

  assert.equal(brief.product.marketType, "secondary");
  assert.equal(brief.negotiation.maxDiscountPercent, 10);
  assert.throws(() => buildOutreachBrief({ job, listing, approved: true }), /documented recipient consent/);
});

test("builds transparent OpenAI Realtime instructions", () => {
  const job = buildCallJobs([{ ...listing, description: "Tel 0722 123 456" }], { consented: true, approved: true })[0];
  const brief = buildOutreachBrief({
    job,
    listing,
    approved: true,
    consent: { granted: true, source: "seller_opt_in", at: "2026-07-15T10:00:00Z" }
  });
  const config = buildOpenAIRealtimeConfig(brief);

  assert.equal(config.model, "gpt-realtime-2.1-mini");
  assert.match(config.instructions, /AI assistant/);
  assert.match(config.instructions, /do not invent/);
});

test("builds an opt-in WhatsApp handoff without sending anything", () => {
  const job = buildCallJobs([{ ...listing, description: "Tel 0722 123 456", url: "https://example.test/item" }], { consented: true, approved: true })[0];
  const brief = buildOutreachBrief({
    job,
    listing,
    approved: true,
    consent: { granted: true, source: "seller_opt_in", at: "2026-07-15T10:00:00Z" }
  });
  const message = buildWhatsAppOptInMessage(listing);
  const handoff = buildOpenClawHandoff({ brief, message });

  assert.equal(handoff.channel, "whatsapp");
  assert.equal(handoff.optInRequired, true);
  assert.match(handoff.initialMessage, /STOP/);
  assert.equal(handoff.realtime.model, "gpt-realtime-2.1-mini");
});
