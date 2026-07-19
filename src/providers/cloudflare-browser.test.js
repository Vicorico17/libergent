import test from "node:test";
import assert from "node:assert/strict";
import { revealOlxPhonesWithBrowser } from "./cloudflare-browser.js";

test("returns an unconfigured result without launching a browser", async () => {
  let launched = false;
  const result = await revealOlxPhonesWithBrowser(null, "https://www.olx.ro/d/oferta/test.html", {
    launch: async () => {
      launched = true;
    }
  });

  assert.equal(launched, false);
  assert.deepEqual(result, { phones: [], debug: { configured: false } });
});

test("clicks the OLX seller button and extracts the phone response", async () => {
  let closed = false;
  let navigatedTo = "";
  const response = {
    url: () => "https://www.olx.ro/api/v1/offers/307024117/phones/",
    status: () => 200,
    json: async () => ({ data: { phones: ["0722 123 456"] } })
  };
  const page = {
    setViewport: async () => {},
    goto: async (url) => {
      navigatedTo = url;
    },
    waitForResponse: async (predicate) => predicate(response) ? response : null,
    evaluate: async () => true
  };
  const launch = async () => ({
    newPage: async () => page,
    close: async () => {
      closed = true;
    }
  });

  const listingUrl = "https://www.olx.ro/d/oferta/espressor-IDkMeZT.html";
  const result = await revealOlxPhonesWithBrowser({}, listingUrl, { launch });

  assert.equal(navigatedTo, listingUrl);
  assert.equal(closed, true);
  assert.deepEqual(result.phones, ["+40722123456"]);
  assert.deepEqual(result.debug, {
    configured: true,
    clicked: true,
    responseStatus: 200,
    source: "phone-response"
  });
});
