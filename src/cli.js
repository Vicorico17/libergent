#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "./env.js";
import { searchAcrossSites } from "./app.js";
import { getSite, getSiteKeysForAllSearch, SITES } from "./sites.js";
import { runSearch } from "./search.js";
import { formatRon } from "./normalize.js";
import { InMemorySearchIndexStore, runListingsToSearchIndexing } from "./indexing/pipeline.js";

function printHelp() {
  console.log(`libergent

Usage:
  node src/cli.js search --site <site> --query "<text>" [--provider auto|direct] [--limit 150] [--pages 3] [--out results/file.json]
  node src/cli.js search --site all --query "<text>" [--provider auto|direct] [--limit 150] [--pages 3] [--out results/file.json]
  node src/cli.js index [--mode incremental|full] [--since 2026-04-01T00:00:00.000Z] [--limit 500]
  npm run search:live -- --query "<text>"

Supported sites:
  ${Object.keys(SITES).join(", ")}
`);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      args._.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    i += 1;
  }
  return args;
}

function ensureDirForFile(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function formatPrice(item) {
  if (item?.currency === "EUR" && item?.price) {
    return item.price;
  }
  if (Number.isFinite(item?.priceRon)) {
    return formatRon(item.priceRon);
  }

  return item?.price || "Fara pret";
}

function cleanDisplayText(value = "") {
  return String(value)
    .replace(/Salvează ca favorit/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatOfferLine(item, fallbackSite = "") {
  if (!item) {
    return "Nicio oferta valida";
  }

  const bits = [
    cleanDisplayText(item.title || "Anunt fara titlu"),
    formatPrice(item),
    cleanDisplayText(item.site || fallbackSite || ""),
    cleanDisplayText(item.condition || ""),
    cleanDisplayText(item.location || "")
  ].filter(Boolean);

  return bits.join(" | ");
}

function pickGlobalExtremeOffer(results, mode) {
  const pricedItems = (results || [])
    .filter((result) => result?.ok)
    .flatMap((result) =>
      (result.items || [])
        .filter((item) => Number.isFinite(item.priceRon))
        .map((item) => ({ ...item, site: result.site }))
    );

  if (!pricedItems.length) {
    return null;
  }

  return pricedItems.reduce((best, item) => {
    if (!best) {
      return item;
    }

    if (mode === "lowest") {
      return item.priceRon < best.priceRon ? item : best;
    }

    return item.priceRon > best.priceRon ? item : best;
  }, null);
}

function buildBox(title, lines) {
  const content = [title, ...lines];
  const width = Math.max(...content.map((line) => line.length), 20);
  const top = `+${"-".repeat(width + 2)}+`;

  return [
    top,
    ...content.map((line) => `| ${line.padEnd(width, " ")} |`),
    top
  ].join("\n");
}

function buildBanner() {
  return [
    " _ _ _                               _   ",
    "| (_) |__   ___ _ __ __ _  ___ _ __ | |_ ",
    "| | | '_ \\ / _ \\ '__/ _` |/ _ \\ '_ \\| __|",
    "| | | |_) |  __/ | | (_| |  __/ | | | |_ ",
    "|_|_|_.__/ \\___|_|  \\__, |\\___|_| |_|\\__|",
    "                    |___/                 "
  ].join("\n");
}

function formatResultBlock(result) {
  if (!result.ok) {
    return [
      `[${result.site}] ERROR`,
      `  ${result.error}`
    ].join("\n");
  }

  const highest = pickGlobalExtremeOffer([result], "highest");
  const lines = [
    `[${result.site}]`,
    `  Provider: ${result.provider}`,
    `  Best offer: ${formatOfferLine(result.bestOffer, result.site)}`,
    `  Best offer link: ${result.bestOffer?.url || "No direct listing URL"}`,
    `  Lowest price: ${formatOfferLine(result.lowest, result.site)}`,
    `  Highest price: ${formatOfferLine(highest, result.site)}`,
    `  Listings returned: ${result.itemCount}${Number.isFinite(result.totalResults) ? ` / ${result.totalResults}` : ""}`
  ];

  if (!result.items.length) {
    lines.push("  No offers returned from this marketplace for the current query.");
    return lines.join("\n");
  }

  for (const [index, item] of result.items.entries()) {
    lines.push(`  ${index + 1}. ${formatOfferLine(item, result.site)}`);
    if (Number.isFinite(item.relevanceScore) || item.intentType) {
      lines.push(`     Quality: ${item.intentType || "unknown"}${Number.isFinite(item.relevanceScore) ? `, relevance ${item.relevanceScore}/100` : ""}`);
    }
    if (item.url) {
      lines.push(`     ${item.url}`);
    }
  }

  return lines.join("\n");
}

function formatPrettyReport(payload, query) {
  if (payload?.results) {
    const lines = [
      buildBanner(),
      "",
      `libergent search report`,
      `Query: ${query}`,
      ""
    ];

    const bestOffer = payload.bestOffer || payload.summary?.bestOffer;
    const lowestOffer = pickGlobalExtremeOffer(payload.results, "lowest");
    const highestOffer = pickGlobalExtremeOffer(payload.results, "highest");
    lines.push(buildBox("LIBERGENT RECOMMENDS", [
      formatOfferLine(bestOffer),
      bestOffer?.url || "No direct listing URL",
      "",
      `Lowest price: ${formatOfferLine(lowestOffer)}`,
      `Highest price: ${formatOfferLine(highestOffer)}`
    ]));
    lines.push("");
    lines.push(`Marketplaces: ${payload.summary?.successfulMarketplaces ?? 0}/${payload.summary?.marketplaces ?? payload.results.length} succeeded`);
    lines.push(`Credits used: ${payload.summary?.creditsUsed ?? 0}/${payload.summary?.creditBudget ?? 0}`);
    if (Number.isFinite(payload.summary?.averagePriceRon)) {
      lines.push(`Average RON price: ${formatRon(payload.summary.averagePriceRon)}`);
    }
    lines.push("");

    for (const result of payload.results) {
      lines.push(formatResultBlock(result));
      lines.push("");
    }

    return lines.join("\n").trimEnd();
  }

  if (payload?.ok) {
    return [
      buildBanner(),
      "",
      `libergent search report`,
      `Query: ${query}`,
      "",
      buildBox("LIBERGENT RECOMMENDS", [
        formatOfferLine(payload.bestOffer, payload.site),
        payload.bestOffer?.url || "No direct listing URL"
      ]),
      "",
      formatResultBlock(payload)
    ].join("\n");
  }

  return JSON.stringify(payload, null, 2);
}

function shapeCliPayload(payload, siteArg) {
  if (siteArg === "all") {
    return {
      ...payload,
      bestOffer: payload.summary?.bestOffer || null
    };
  }

  if (payload?.ok) {
    return {
      ...payload,
      bestOffer: payload.bestOffer || null
    };
  }

  return payload;
}

async function main() {
  loadEnv(process.cwd());
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];

  if (!command || command === "--help" || args.help) {
    printHelp();
    return;
  }

  if (command === "index") {
    const mode = args.mode || "incremental";
    const since = args.since || null;
    const limit = Number.parseInt(args.limit || "500", 10);

    if (!["incremental", "full"].includes(mode)) {
      throw new Error(`Unsupported mode "${mode}"`);
    }
    if (!Number.isFinite(limit) || limit <= 0) {
      throw new Error("Expected --limit to be a positive integer");
    }

    const seed = JSON.parse(args.seed || "[]");
    const store = new InMemorySearchIndexStore(seed);
    const result = await runListingsToSearchIndexing({
      store,
      mode,
      since,
      limit,
      logger: console
    });
    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
    return;
  }

  if (command !== "search") {
    throw new Error(`Unsupported command "${command}"`);
  }

  const siteArg = args.site;
  const query = args.query;
  const provider = args.provider || "auto";
  const limit = Number.parseInt(args.limit || "150", 10);
  const maxPages = Number.parseInt(args.pages || "3", 10);

  if (!siteArg) {
    throw new Error("Missing --site");
  }
  if (!query) {
    throw new Error("Missing --query");
  }
  if (!["auto", "direct"].includes(provider)) {
    throw new Error(`Unsupported provider "${provider}"`);
  }
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error("Expected --limit to be a positive integer");
  }
  if (!Number.isFinite(maxPages) || maxPages <= 0) {
    throw new Error("Expected --pages to be a positive integer");
  }

  const siteKeys = siteArg === "all" ? getSiteKeysForAllSearch(query) : [siteArg];
  const payload =
    siteArg === "all"
      ? await searchAcrossSites({ query, provider, limit, maxPages, siteKeys })
      : await (async () => {
          const site = getSite(siteKeys[0]);
          try {
            return { ok: true, ...(await runSearch({ provider, site, query, limit, maxPages })) };
          } catch (error) {
            return {
              ok: false,
              site: siteKeys[0],
              query,
              provider,
              error: error instanceof Error ? error.message : String(error)
            };
          }
        })();
  const outputPayload = shapeCliPayload(payload, siteArg);
  const output = JSON.stringify(outputPayload, null, 2);
  const pretty = args.pretty || args.format === "pretty";

  if (args.out) {
    const outputPath = path.resolve(process.cwd(), args.out);
    ensureDirForFile(outputPath);
    fs.writeFileSync(outputPath, `${output}\n`, "utf8");
    if (pretty) {
      console.log(formatPrettyReport(outputPayload, query));
      console.log("");
    }
    console.log(`Wrote ${outputPath}`);
    return;
  }

  console.log(pretty ? formatPrettyReport(outputPayload, query) : output);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
