import test from "node:test";
import assert from "node:assert/strict";
import { normalizeLeadPayload } from "./leads.js";

test("normalizeLeadPayload normalizes valid email lead data", () => {
  const lead = normalizeLeadPayload({
    email: "  Buyer@Example.RO ",
    source: "search_results_popup",
    query: "iphone 15 pro",
    pagePath: "/search?q=iphone+15+pro"
  });

  assert.deepEqual(lead, {
    email: "buyer@example.ro",
    source: "search_results_popup",
    query: "iphone 15 pro",
    pagePath: "/search?q=iphone+15+pro"
  });
});

test("normalizeLeadPayload rejects invalid email addresses", () => {
  assert.throws(
    () => normalizeLeadPayload({ email: "not-an-email" }),
    /Expected a valid email address/
  );
});

test("normalizeLeadPayload applies safe defaults and limits", () => {
  const lead = normalizeLeadPayload({
    email: "user@example.com",
    source: "",
    query: "q".repeat(300),
    pagePath: "/".repeat(400)
  });

  assert.equal(lead.source, "search_results_popup");
  assert.equal(lead.query.length, 240);
  assert.equal(lead.pagePath.length, 300);
});
