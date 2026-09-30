import test from "node:test";
import assert from "node:assert/strict";
import { detectSearchResponseFailure } from "./search.js";

test("search responses identify soft error pages and lost search redirects", () => {
  assert.match(detectSearchResponseFailure("https://a2t.ro/search?q=camera", "https://a2t.ro/page-not-found", "<title>Pagina nu a fost gasita</title>"), /error page/);
  assert.match(detectSearchResponseFailure("https://bebetei.ro/search?q=scaun", "https://comenzi.bebetei.ro/", "<title>Magazinul Familiei Tale</title>"), /home page/);
  assert.match(detectSearchResponseFailure("https://musicshop.ro/search?q=chitara", "https://musicshop.ro/search?q=chitara", "<title>musicshop.ro este de vânzare!</title>"), /error page/);
  assert.match(detectSearchResponseFailure("https://hervis.ro/search?q=bicicleta", "https://www.sportsdirect.ro/", "<title>SportsDirect</title>"), /another site/);
  assert.match(detectSearchResponseFailure("https://www.pieseauto.ro/search?q=anvelope", "https://www.pieseauto.ro/?action=sorry", "<title>Scuze...</title>"), /error page/);
  assert.equal(detectSearchResponseFailure("https://evomag.ro/search?q=iphone", "https://evomag.ro/?searchString=iphone", "<title>evomag.ro</title>"), "");
});
