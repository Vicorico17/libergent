import { parseOlxHtml } from "./parsers/olx.js";
import { parseLajumateHtml } from "./parsers/lajumate.js";
import { parseOkaziiHtml } from "./parsers/okazii.js";
import { parsePubli24Html } from "./parsers/publi24.js";
import { parseVintedHtml } from "./parsers/vinted.js";
import { parseAutovitHtml } from "./parsers/autovit.js";
import { parseAnuntulHtml } from "./parsers/anuntul.js";
import { parseEmagHtml, parseEvomagHtml, parseF64Html, parseRetailHtml } from "./parsers/retail.js";
import { parseIkeaHtml } from "./parsers/ikea.js";
import { parseBookzoneHtml } from "./parsers/bookzone.js";
import { parseFlipHtml, parseKlapHtml } from "./parsers/refurbished.js";
import { parseForitHtml } from "./parsers/forit.js";
import { parseZooplusHtml } from "./parsers/zooplus.js";
import { parseRegatulJocurilorHtml } from "./parsers/regatuljocurilor.js";
import { parseTheHomeHtml } from "./parsers/thehome.js";
import { parseRedGoblinHtml } from "./parsers/redgoblin.js";
import { parseNemiraHtml } from "./parsers/nemira.js";
import { parsePhotoSetupHtml } from "./parsers/photosetup.js";
import { parseLibrisHtml } from "./parsers/libris.js";
import { parseMcMusicHtml } from "./parsers/mcmusic.js";
import { parseCelHtml } from "./parsers/cel.js";

export function parseSiteHtml({ site, html, url, limit, query = "" }) {
  let parsed;
  if (site.key === "lajumate.ro") {
    parsed = parseLajumateHtml(html, limit);
  } else if (site.key === "okazii.ro") {
    parsed = parseOkaziiHtml(html, limit);
  } else if (site.key === "olx.ro") {
    parsed = parseOlxHtml(html, limit);
  } else if (site.key === "vinted.ro") {
    parsed = parseVintedHtml(html, limit);
  } else if (site.key === "publi24.ro" || site.key === "bestauto.ro") {
    parsed = parsePubli24Html(html, limit, { origin: new URL(url).origin });
  } else if (site.key === "autovit.ro") {
    parsed = parseAutovitHtml(html, limit);
  } else if (site.key === "anuntul.ro") {
    parsed = parseAnuntulHtml(html, limit);
  } else if (site.key === "emag.ro") {
    parsed = parseEmagHtml(html, limit, { origin: new URL(url).origin });
  } else if (site.key === "evomag.ro") {
    parsed = parseEvomagHtml(html, limit, { origin: new URL(url).origin });
  } else if (site.key === "flip.ro") {
    parsed = parseFlipHtml(html, limit, { query, origin: new URL(url).origin });
  } else if (site.key === "klap.ro") {
    parsed = parseKlapHtml(html, limit, { origin: new URL(url).origin });
  } else if (site.key === "forit.ro") {
    parsed = parseForitHtml(html, limit, { origin: new URL(url).origin });
  } else if (site.key === "zooplus.ro") {
    parsed = parseZooplusHtml(html, limit, { origin: new URL(url).origin });
  } else if (site.key === "regatuljocurilor.ro") {
    parsed = parseRegatulJocurilorHtml(html, limit, { origin: new URL(url).origin });
  } else if (site.key === "thehome.ro") {
    parsed = parseTheHomeHtml(html, limit, { origin: new URL(url).origin });
  } else if (site.key === "redgoblin.ro") {
    parsed = parseRedGoblinHtml(html, limit, { origin: new URL(url).origin });
  } else if (site.key === "nemira.ro") {
    parsed = parseNemiraHtml(html, limit, { origin: new URL(url).origin });
  } else if (site.key === "photosetup.ro") {
    parsed = parsePhotoSetupHtml(html, limit, { origin: new URL(url).origin });
  } else if (site.key === "libris.ro") {
    parsed = parseLibrisHtml(html, limit, { origin: new URL(url).origin });
  } else if (site.key === "mcmusic.ro") {
    parsed = parseMcMusicHtml(html, limit, { origin: new URL(url).origin });
  } else if (site.key === "cel.ro") {
    parsed = parseCelHtml(html, limit, { origin: new URL(url).origin });
  } else if (site.key === "ikea.com") {
    parsed = parseIkeaHtml(html, limit);
  } else if (site.key === "f64.ro") {
    parsed = parseF64Html(html, limit, { origin: new URL(url).origin });
  } else if (site.key === "bookzone.ro") {
    parsed = parseBookzoneHtml(html, limit, { origin: new URL(url).origin });
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
