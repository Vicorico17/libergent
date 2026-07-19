import test from "node:test";
import assert from "node:assert/strict";
import { buildConversationHistory } from "./conversations.js";

test("groups outbound and inbound WhatsApp messages by listing and seller", () => {
  const rows = [
    {
      message_id: "out-1",
      direction: "outbound",
      from_number: "libergent-agent",
      to_number: "+40722123456",
      text: "Mai este disponibil?",
      received_at: "2026-07-19T10:00:00Z",
      raw: { userId: "user-1", listing: { url: "https://www.olx.ro/d/oferta/test.html", title: "Espressor", marketplace: "OLX", price: "120 RON" } }
    },
    {
      message_id: "in-1",
      direction: "inbound",
      from_number: "+40722123456",
      to_number: "",
      text: "Da, putem negocia prețul",
      received_at: "2026-07-19T10:05:00Z",
      raw: { userId: "user-1" }
    }
  ];
  const conversations = buildConversationHistory(rows, { userId: "user-1" });

  assert.equal(conversations.length, 1);
  assert.equal(conversations[0].listingTitle, "Espressor");
  assert.equal(conversations[0].status, "negotiating");
  assert.equal(conversations[0].messages[1].role, "seller");
  assert.equal(buildConversationHistory(rows, { userId: "other-user" }).length, 0);
});

test("marks a contacted listing unavailable from the seller reply", () => {
  const [conversation] = buildConversationHistory([
    { message_id: "out", direction: "outbound", to_number: "+40722000000", text: "Disponibil?", received_at: "2026-07-19T10:00:00Z", raw: { listing: { url: "https://example.test/a" } } },
    { message_id: "in", direction: "inbound", from_number: "+40722000000", text: "S-a vândut deja", received_at: "2026-07-19T10:01:00Z", raw: {} }
  ]);

  assert.equal(conversation.status, "unavailable");
});
