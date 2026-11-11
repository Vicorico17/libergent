import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSiteHtml } from '../site-html-parser.js';
import { SITES } from '../sites.js';

const card = (slug, title, price) => `<a class="ProductCard_card__AIbas" href="/p/${slug}">
  <h2 data-test="listProductName"><span>${title}</span><span>extensibilă</span></h2>
  <span class="ProductCard_customerPrice__vwpUw ProductCard_discounted__1WAwb">${price}</span>
  <div class="ProductCard_customerPrice__vwpUw"><span class="ProductCard_retailPrice__0rGdG">10 347 Lei</span></div>
  <div role="button" aria-label="Compară">Compară</div></a>
  <a class="ProductVariantsList_box__3iSiw" aria-label="Altă variantă" href="/p/other">variantă</a>`;

test('Bonami routing extracts names and current prices instead of comparison labels or variants', () => {
  const site = SITES['bonami.ro'];
  const url = site.searchUrl('canapea extensibila');
  assert.equal(url, 'https://www.bonami.ro/cautati?q=canapea%20extensibila');
  const first = card('sofa', 'Canapea&nbsp;Nihad', '8\u00a0276\u00a0Lei');
  const result = parseSiteHtml({ site, url, html: first + first + card('second', 'Canapea Cube', '6 628 Lei'), limit: 10 });
  assert.deepEqual(result.items.map(({ title, price, url }) => ({ title, price, url })), [
    { title: 'Canapea Nihad extensibilă', price: '8 276 Lei', url: 'https://www.bonami.ro/p/sofa' },
    { title: 'Canapea Cube extensibilă', price: '6 628 Lei', url: 'https://www.bonami.ro/p/second' }
  ]);
});

test('Bonami does not borrow missing prices or report unknown layouts as confirmed empty', () => {
  const site = SITES['bonami.ro'];
  const html = '<a class="ProductCard_card__x" href="/p/missing"><h2 data-test="listProductName">No price</h2></a>' + card('priced', 'Canapea', '500 Lei');
  const result = parseSiteHtml({ site, url: site.searchUrl('canapea'), html, limit: 10 });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].url, 'https://www.bonami.ro/p/priced');
  const empty = parseSiteHtml({ site, url: site.searchUrl('canapea'), html: '<h1>New layout</h1>', limit: 10 });
  assert.equal(empty.totalResults, null);
});
