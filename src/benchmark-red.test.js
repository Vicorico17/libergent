import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { SOURCE_VALIDATION_SNAPSHOT } from "./source-validation-snapshot.js";

test("red browser benchmark dry run selects only unresolved sources without credentials", () => {
  const output = execFileSync(process.execPath, ["scripts/benchmark-kitesurf.js", "--state=red", "--max-sites=3", "--dry-run"], {
    cwd: process.cwd(), encoding: "utf8", env: { ...process.env, LIBERGENT_ADMIN_TOKEN: "" }
  });
  const plan = JSON.parse(output);
  assert.equal(plan.selected, 3);
  assert.equal(plan.sites.some(({ site }) => site === "olx.ro"), false);
  for (const { site, query } of plan.sites) {
    const validation = SOURCE_VALIDATION_SNAPSHOT[site];
    assert.ok(validation);
    assert.equal(query, validation.queries[0].query);
    assert.equal(validation.queries.some((check) => check.accepted > 0), false);
  }
});
