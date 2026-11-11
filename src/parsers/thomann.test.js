import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSiteHtml } from '../site-html-parser.js';
import { SITES } from '../sites.js';

const product = (overrides = {}) => ({
  texts: { title: 'Yamaha P-45 B' }, relativeLink: 'yamaha_p_45_b.htm?type=quickSearch',
  availability: { isAvailable: true },
  price: { primary: { rawPrice: '1599.0000', currency: { key: 'RON' } }, strikePrice: { rawPrice: '1777' } },
  ...overrides
});
const document = (articles, extras = {}) => `<script>tho.bootstrapModule('search.index', ${JSON.stringify([
  { articleListsSettings: { articles, alternativeArticles: [product({ texts: { title: 'Unrelated recommendation' } })], resultCount: articles.length }, ...extras }
])}, {});</script>`;
const parse = html => parseSiteHtml({ site: SITES['thomann.de'], url: SITES['thomann.de'].searchUrl('yamaha'), html, limit: 20 });

test('Thomann extracts current RON prices from only the search article list', () => {
  assert.equal(SITES['thomann.de'].searchUrl('yamaha p-45'), 'https://www.thomann.ro/search.html?sw=yamaha%20p-45');
  const result = parse(document([product(), product()]));
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].title, 'Yamaha P-45 B');
  assert.equal(result.items[0].price, '1599 RON');
  assert.equal(result.items[0].url, 'https://www.thomann.ro/yamaha_p_45_b.htm?type=quickSearch');
});

test('Thomann excludes unavailable, archived, unpriced and external products', () => {
  const result = parse(document([
    product({ availability: { isAvailable: false } }), product({ isArchived: true }),
    product({ price: { primary: { rawPrice: '0', currency: { key: 'RON' } } } }),
    product({ relativeLink: 'https://outside.test/item.htm' }),
    product({ isBstock: true })
  ]));
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].condition, 'Resigilat');
});

test('Thomann distinguishes explicit empty search from missing or invalid state', () => {
  assert.equal(parse(document([])).totalResults, 0);
  assert.equal(parse('<h1>Different page</h1>').totalResults, null);
  assert.equal(parse("<script>tho.bootstrapModule('search.index', window.untrusted());</script>").totalResults, null);
});
