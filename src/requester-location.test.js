import test from "node:test";
import assert from "node:assert/strict";
import { resolveRequesterLocation, _private } from "./requester-location.js";

test("returns explicit requester location without any lookup", async () => {
  let called = false;
  const location = await resolveRequesterLocation({
    explicitLocation: "Cluj-Napoca",
    headers: { "cf-ipcity": "Bucuresti" },
    fetchFn: async () => {
      called = true;
      throw new Error("should not call");
    }
  });

  assert.equal(location, "Cluj-Napoca");
  assert.equal(called, false);
});

test("uses edge-provided city header when explicit location is missing", async () => {
  const location = await resolveRequesterLocation({
    headers: { "x-vercel-ip-city": "Timisoara" }
  });

  assert.equal(location, "Timisoara");
});

test("uses IP lookup when city headers are missing", async () => {
  const location = await resolveRequesterLocation({
    headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" },
    fetchFn: async () => ({
      ok: true,
      async json() {
        return { city: "Iasi" };
      }
    })
  });

  assert.equal(location, "Iasi");
});

test("does not attempt lookup for local/private IPs", async () => {
  let called = false;
  const location = await resolveRequesterLocation({
    headers: { "x-forwarded-for": "127.0.0.1" },
    fetchFn: async () => {
      called = true;
      return { ok: true, json: async () => ({ city: "Bucuresti" }) };
    }
  });

  assert.equal(location, "");
  assert.equal(called, false);
});

test("extracts first forwarded IP", () => {
  const map = _private.normalizeHeaderMap({ "x-forwarded-for": "198.51.100.10, 198.51.100.11" });
  assert.equal(_private.extractClientIp(map), "198.51.100.10");
});
