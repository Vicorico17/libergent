import test from "node:test";
import assert from "node:assert/strict";

import { createSourceAdapter } from "../src/source-adapters/contract.js";
import {
  classifySourceAdapterFailure,
  mapFailureCodeToOrchestrationAction,
  ORCHESTRATION_ACTION,
  SourceAdapterError,
  SOURCE_FAILURE_CODE
} from "../src/source-adapters/failures.js";

test("createSourceAdapter validates unsupported contexts via taxonomy error", async () => {
  const adapter = createSourceAdapter({
    adapterId: "only-direct",
    supports: ({ provider }) => provider === "direct",
    async execute() {
      return { ok: true };
    }
  });

  await assert.rejects(
    adapter.execute({ provider: "cloudflare", site: { key: "olx.ro", strategy: "direct-html-local" } }),
    (error) => {
      assert.equal(error.name, "SourceAdapterError");
      assert.equal(error.code, SOURCE_FAILURE_CODE.ADAPTER_NOT_SUPPORTED);
      assert.equal(error.retryable, false);
      return true;
    }
  );
});

test("classifySourceAdapterFailure maps HTTP/status patterns", () => {
  const timeout = classifySourceAdapterFailure(new Error("Autovit a depășit timpul maxim de răspuns."));
  assert.equal(timeout.code, SOURCE_FAILURE_CODE.TIMEOUT);
  assert.equal(timeout.retryable, true);
  assert.equal(timeout.action, ORCHESTRATION_ACTION.RETRY);

  const rateLimited = classifySourceAdapterFailure(new Error("Cloudflare request failed (429): {}"));
  assert.equal(rateLimited.code, SOURCE_FAILURE_CODE.RATE_LIMITED);
  assert.equal(rateLimited.retryable, true);
  assert.equal(rateLimited.action, ORCHESTRATION_ACTION.RETRY);

  const upstream = classifySourceAdapterFailure(new Error("Direct fetch failed (503) for https://example.com"));
  assert.equal(upstream.code, SOURCE_FAILURE_CODE.UPSTREAM_UNAVAILABLE);
  assert.equal(upstream.retryable, true);
  assert.equal(upstream.action, ORCHESTRATION_ACTION.RETRY);

  const badResponse = classifySourceAdapterFailure(new Error("Direct fetch failed (404) for https://example.com"));
  assert.equal(badResponse.code, SOURCE_FAILURE_CODE.BAD_SOURCE_RESPONSE);
  assert.equal(badResponse.retryable, false);
  assert.equal(badResponse.action, ORCHESTRATION_ACTION.DEAD_LETTER);
});

test("classifySourceAdapterFailure preserves explicit SourceAdapterError codes", () => {
  const failure = classifySourceAdapterFailure(new SourceAdapterError("No parser", {
    code: SOURCE_FAILURE_CODE.ADAPTER_NOT_SUPPORTED,
    retryable: false,
    details: { site: "olx.ro" }
  }));

  assert.equal(failure.code, SOURCE_FAILURE_CODE.ADAPTER_NOT_SUPPORTED);
  assert.equal(failure.retryable, false);
  assert.equal(failure.action, ORCHESTRATION_ACTION.DEAD_LETTER);
  assert.deepEqual(failure.details, { site: "olx.ro" });
});

test("mapFailureCodeToOrchestrationAction covers retry dead-letter and ignore outcomes", () => {
  assert.equal(
    mapFailureCodeToOrchestrationAction(SOURCE_FAILURE_CODE.NETWORK),
    ORCHESTRATION_ACTION.RETRY
  );
  assert.equal(
    mapFailureCodeToOrchestrationAction(SOURCE_FAILURE_CODE.BAD_SOURCE_RESPONSE),
    ORCHESTRATION_ACTION.DEAD_LETTER
  );
  assert.equal(
    mapFailureCodeToOrchestrationAction(SOURCE_FAILURE_CODE.UNKNOWN),
    ORCHESTRATION_ACTION.IGNORE
  );
});
