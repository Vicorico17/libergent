import { parseOlxHtml } from "./parsers/olx.js";
import { parseLajumateHtml } from "./parsers/lajumate.js";
import { parseOkaziiHtml } from "./parsers/okazii.js";
import { parsePubli24Html } from "./parsers/publi24.js";
import { parseVintedHtml } from "./parsers/vinted.js";
import { parseAutovitHtml } from "./parsers/autovit.js";
import { parseAnuntulHtml } from "./parsers/anuntul.js";
import { parseEmagHtml, parseEvomagHtml, parseRetailHtml } from "./parsers/retail.js";

export function parseSiteHtml({ site, html, url, limit }) {
  let parsed;
  if (site.key === "lajumate.ro") {
    parsed = parseLajumateHtml(html, limit);
  } else if (site.key === "okazii.ro") {
    parsed = parseOkaziiHtml(html, limit);
  } else if (site.key === "olx.ro") {
    parsed = parseOlxHtml(html, limit);
  } else if (site.key === "vinted.ro") {
    parsed = parseVintedHtml(html, limit);
  } else if (site.key === "publi24.ro") {
    parsed = parsePubli24Html(html, limit);
  } else if (site.key === "autovit.ro") {
    parsed = parseAutovitHtml(html, limit);
  } else if (site.key === "anuntul.ro") {
    parsed = parseAnuntulHtml(html, limit);
  } else if (site.key === "emag.ro") {
    parsed = parseEmagHtml(html, limit, { origin: new URL(url).origin });
  } else if (site.key === "evomag.ro") {
    parsed = parseEvomagHtml(html, limit, { origin: new URL(url).origin });
  } else if (site.strategy === "direct-html-retail") {
    parsed = parseRetailHtml(html, limit, { origin: new URL(url).origin });
  } else {
    throw new Error(`No HTML parser configured for ${site.key}`);
  }

  return {
    items: Array.isArray(parsed.items) ? parsed.items : [],
    totalResults: parsed.totalResults ?? null,
    rawItemCount: Number.isFinite(parsed.rawItemCount) ? parsed.rawItemCount : parsed.items?.length || 0,
    hasNextPage: parsed.hasNextPage ?? null
  };
}
