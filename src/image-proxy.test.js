import test from "node:test";
import assert from "node:assert/strict";
import { getMarketplaceImageProxyTarget, isAllowedMarketplaceImageUrl } from "./image-proxy.js";

test("allows OLX CDN images from any olxcdn subdomain", () => {
  assert.equal(
    getMarketplaceImageProxyTarget("https://frankfurt.apollo.olxcdn.com:443/v1/files/item-RO/image;s=216x152;q=50"),
    "https://frankfurt.apollo.olxcdn.com/v1/files/item-RO/image;s=216x152;q=50"
  );
  assert.equal(
    getMarketplaceImageProxyTarget("https://ireland.apollo.olxcdn.com/v1/files/item-RO/image;s=216x152;q=50"),
    "https://ireland.apollo.olxcdn.com/v1/files/item-RO/image;s=216x152;q=50"
  );
  assert.equal(isAllowedMarketplaceImageUrl("https://cdn.example.com/item.webp"), false);
});

test("unwraps OLX optimizer image URLs before proxying", () => {
  const target = "https://ireland.apollo.olxcdn.com/v1/files/item-RO/image;s=510x680;q=50";
  const optimized = `https://www.olx.ro/_next/image?url=${encodeURIComponent(target)}&w=640&q=75`;

  assert.equal(getMarketplaceImageProxyTarget(optimized), target);
});
