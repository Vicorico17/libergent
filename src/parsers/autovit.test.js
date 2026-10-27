import test from "node:test";
import assert from "node:assert/strict";
import { parseAutovitHtml } from "./autovit.js";

const article = (url, title, price = '') => `<article><a href="${url}"><h2>${title}</h2></a>${price}</article>`;
const schema = offers => `<script type="application/ld+json">${JSON.stringify({ mainEntity: { itemListElement: offers } })}</script>`;
const offer = (name, price, url = '') => ({ itemOffered: { name, url }, priceSpecification: { price, priceCurrency: 'EUR' } });

test("Autovit fills missing prices by identity despite dropped cards and shuffled JSON-LD", () => {
  const html = article('/autoturisme/bmw', 'BMW') + article('/autoturisme/anunt/bmw-a.html', 'BMW X5') + article('/autoturisme/anunt/bmw-b.html', 'BMW X3') +
    schema([offer('BMW X3', 20000, '/autoturisme/anunt/bmw-b.html'), offer('BMW X5', 30000, '/autoturisme/anunt/bmw-a.html')]);
  assert.deepEqual(parseAutovitHtml(html, 10).items.map(item => item.price), ['30000 EUR', '20000 EUR']);
});

test("Autovit accepts unique title evidence but does not guess among duplicate models", () => {
  const html = article('/autoturisme/anunt/a.html', 'BMW X5') + article('/autoturisme/anunt/b.html', 'BMW X3') +
    schema([offer('BMW X5', 10000), offer('BMW X5', 20000), offer('BMW X3', 25000)]);
  assert.deepEqual(parseAutovitHtml(html, 10).items.map(item => item.price), ['', '25000 EUR']);
});

test("Autovit keeps displayed prices and ignores prices outside the article", () => {
  const html = article('/autoturisme/anunt/a.html', 'BMW X5', '35000 EUR') + article('/autoturisme/anunt/b.html', 'BMW X3') + '<footer>Oferta 500 EUR</footer>' + schema([offer('BMW X5', 10000)]);
  assert.deepEqual(parseAutovitHtml(html, 10).items.map(item => item.price), ['35000 EUR', '']);
});
