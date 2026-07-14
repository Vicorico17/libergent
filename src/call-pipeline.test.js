import test from "node:test";
import assert from "node:assert/strict";
import { assertCallJobCanRun, buildCallJobs, createCallRunner } from "./call-pipeline.js";

const listings = [
  { title: "Bike", price: "100 lei", url: "https://example.test/1", description: "Tel 0722 123 456" },
  { title: "Duplicate", url: "https://example.test/2", description: "Tel +40 722 123 456" }
];

test("builds deduplicated pending jobs only after consent", () => {
  assert.deepEqual(buildCallJobs(listings), []);
  const jobs = buildCallJobs(listings, { consented: true });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].status, "pending_approval");
  assert.equal(jobs[0].phone, "+40722123456");
});

test("runner requires approval before invoking provider", async () => {
  const job = buildCallJobs(listings, { consented: true, approved: true })[0];
  let called = false;
  const run = createCallRunner({
    consented: true,
    placeCall: async (payload) => { called = payload.to; return { id: "test" }; }
  });

  await assert.rejects(() => run(job), /explicit approval/);
  assert.equal(called, false);
  await run(job, { approved: true });
  assert.equal(called, "+40722123456");
  assertCallJobCanRun(job, { consented: true, approved: true });
});
