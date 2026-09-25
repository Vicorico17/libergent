import test from "node:test";
import assert from "node:assert/strict";
import { hasForwardPage } from "./pagination.js";
import { parseSiteHtml } from "../site-html-parser.js";
import { SITES } from "../sites.js";

test("pagination compares target pages with the actual current URL", () => {
  for (const parameter of ['page', 'pag']) {
    const url = `https://example.test/search?q=phone&${parameter}=3`;
    assert.equal(hasForwardPage(`<a href="?q=phone&amp;${parameter}=2">Previous</a><a href="?${parameter}=3">3</a>`, url), false);
    assert.equal(hasForwardPage(`<a href="?q=phone&amp;${parameter}=4">4</a>`, url), true);
    assert.equal(hasForwardPage(`<a rel="next" href="?${parameter}=2">Next</a>`, url), false);
  }
});

test("disabled, unrelated and script-only pagination is not forward evidence", () => {
  const url = 'https://example.test/search?page=2';
  for (const html of [
    '<a aria-disabled="true" rel="next" href="?page=3">Next</a>',
    '<li class="disabled"><a rel="next" href="?page=3">Next</a></li>',
    '<button disabled data-testid="pagination-forward">Next</button>',
    '<script>const link = `<a href="?page=3">Next</a>`</script>',
    '<a href="https://other.test/search?page=3">Other</a>',
    '<a href="/other-category?page=3">Other</a>',
    '<span data-testid="pagination-forward" aria-disabled="true"></span>'
  ]) assert.equal(hasForwardPage(html, url), false, html);
  assert.equal(hasForwardPage('<link rel="next" href="?page=3">', url), true);
  assert.equal(hasForwardPage('<button aria-label="Next">Next</button>', url), true);
  assert.equal(hasForwardPage('<a href="?page=2">2</a><span aria-current="page">3</span>'), false);
});

test("dispatcher passes the requested page into all classified marketplace parsers", () => {
  for (const key of ['olx.ro', 'vinted.ro', 'anuntul.ro', 'publi24.ro', 'bestauto.ro', 'okazii.ro', 'autovit.ro']) {
    const parameter = ['publi24.ro', 'bestauto.ro'].includes(key) ? 'pag' : 'page';
    const url = `https://www.${key}/search?${parameter}=2`;
    const parse = html => parseSiteHtml({ site: SITES[key], html, url, limit: 10 });
    assert.equal(parse(`<a href="?${parameter}=1">Previous</a>`).hasNextPage, false, key);
    assert.equal(parse(`<a rel="next" href="?${parameter}=3">Next</a>`).hasNextPage, true, key);
  }
});
