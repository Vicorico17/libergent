import test from 'node:test';
import assert from 'node:assert/strict';
import { runSearch } from './search.js';
import { SITES } from './sites.js';
import worker from './worker.js';

test('MediaGalaxy uses its public catalog API and preserves marketplace seller and listing origin', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(String(url), 'https://cerberus.mediagalaxy.ro/v2/catalog/search/iphone%2016?size=48');
    assert.equal(options.headers.referer, 'https://mediagalaxy.ro/cauta/?q=iphone%2016');
    return Response.json({ products: [{ name: 'Telefon Apple iPhone 16 128GB', sku: 'PHONE', url_key: 'iphone-16', price: 4499.99 }], meta: { total: 1 } });
  });
  const r = await runSearch({ site: SITES['mediagalaxy.ro'], provider: 'direct', query: 'iphone 16', limit: 5, maxPages: 1 });
  assert.equal(r.eligibleItemCount, 1);
  assert.equal(r.items[0].url, 'https://mediagalaxy.ro/iphone-16/cpd/PHONE/');
  assert.equal(r.items[0].sellerType, 'MediaGalaxy');
});

test('listing enrichment accepts the registered Romanian Thomann domain but rejects lookalikes', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return new Response('<script type="application/ld+json">{"@type":"Product","name":"Yamaha P-45","offers":{"price":1599,"priceCurrency":"RON"}}</script>');
  });
  const request = host => worker.fetch(new Request(`https://libergent.test/api/marketplace/details?url=${encodeURIComponent(`https://${host}/yamaha_p_45_b.htm`)}`), {});
  assert.equal((await request('www.thomann.ro')).status, 200);
  assert.equal((await request('www.thomann.ro.evil.test')).status, 400);
  assert.equal((await request('bricostore.ro')).status, 200);
  assert.equal((await request('bricostore.ro.evil.test')).status, 400);
  assert.equal(calls, 2);
});

test('Bricodepot follows the verified Bricostore migration for search and product URLs', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(String(url), 'https://nix.bricostore.ro/v2/catalog/search/bormasina%20bosch?size=48');
    assert.equal(options.headers.referer, 'https://bricostore.ro/cauta/?q=bormasina%20bosch');
    return Response.json({ products: [{ name: 'Bormasina Bosch GSB 600', sku: 'DRILL', url_key: 'bormasina-bosch', price: 250 }] });
  });
  const r = await runSearch({ site: SITES['bricodepot.ro'], provider: 'direct', query: 'bormasina bosch', limit: 5, maxPages: 1 });
  assert.equal(r.eligibleItemCount, 1);
  assert.equal(r.items[0].url, 'https://bricostore.ro/bormasina-bosch/cpd/DRILL/');
  assert.equal(r.items[0].sellerType, 'Bricostore');
});
