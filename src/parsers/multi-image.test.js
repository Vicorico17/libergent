import test from "node:test";
import assert from "node:assert/strict";
import { parseLajumateHtml } from "./lajumate.js";
import { parseOkaziiHtml } from "./okazii.js";

test("parseLajumateHtml keeps all available listing images", () => {
  const payload = {
    props: {
      pageProps: {
        paginationServer: { total: 1 },
        adsServer: [
          {
            id: 123,
            slug: "iphone-15",
            title: "iPhone 15",
            price: 2500,
            currency: "RON",
            city: { name: "Bucuresti" },
            listed_at: "azi",
            mainImage: { path: "main.jpg" },
            images: [{ path: "main.jpg" }, { path: "2.jpg" }, { path: "3.jpg" }],
            ad_fields: []
          }
        ]
      }
    }
  };

  const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload)}</script>`;
  const parsed = parseLajumateHtml(html, 5);
  assert.equal(parsed.items.length, 1);
  assert.deepEqual(parsed.items[0].imageUrls, [
    "https://api-preprod.lajumate.ro/storage/main.jpg",
    "https://api-preprod.lajumate.ro/storage/2.jpg",
    "https://api-preprod.lajumate.ro/storage/3.jpg"
  ]);
  assert.equal(parsed.items[0].imageUrl, "https://api-preprod.lajumate.ro/storage/main.jpg");
});

test("parseOkaziiHtml keeps all JSON-LD image urls for an offer", () => {
  const html = `
    <script type="application/ld+json">
      {
        "@graph": [
          {
            "@type": "Product",
            "offers": {
              "offerCount": 1,
              "offers": [
                {
                  "name": "Telefon",
                  "price": 999,
                  "priceCurrency": "RON",
                  "url": "/oferta/telefon",
                  "image": ["https://img.example/1.jpg", "https://img.example/2.jpg"]
                }
              ]
            }
          }
        ]
      }
    </script>
  `;

  const parsed = parseOkaziiHtml(html, 5);
  assert.equal(parsed.items.length, 1);
  assert.deepEqual(parsed.items[0].imageUrls, [
    "https://img.example/1.jpg",
    "https://img.example/2.jpg"
  ]);
  assert.equal(parsed.items[0].imageUrl, "https://img.example/1.jpg");
});
