#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "./env.js";
import { searchAcrossSites } from "./app.js";
import { getSite, SITES } from "./sites.js";
import { runSearch } from "./search.js";

function printHelp() {
  console.log(`libergent

Usage:
  node src/cli.js search --site <site> --query "<text>" [--provider auto|firecrawl|cloudflare] [--limit 20] [--pages 1] [--out results/file.json]
  node src/cli.js search --site all --query "<text>" [--provider auto|firecrawl|cloudflare] [--limit 20] [--pages 1] [--out results/file.json]

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

async function main() {
  loadEnv(process.cwd());
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];

  if (!command || command === "--help" || args.help) {
    printHelp();
    return;
  }

  if (command !== "search") {
    throw new Error(`Unsupported command "${command}"`);
  }

  const siteArg = args.site;
  const query = args.query;
  const provider = args.provider || "auto";
  const limit = Number.parseInt(args.limit || "20", 10);
  const maxPages = Number.parseInt(args.pages || "1", 10);

  if (!siteArg) {
    throw new Error("Missing --site");
  }
  if (!query) {
    throw new Error("Missing --query");
  }
  if (!["auto", "firecrawl", "cloudflare"].includes(provider)) {
    throw new Error(`Unsupported provider "${provider}"`);
  }
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error("Expected --limit to be a positive integer");
  }
  if (!Number.isFinite(maxPages) || maxPages <= 0) {
    throw new Error("Expected --pages to be a positive integer");
  }

  const siteKeys = siteArg === "all" ? Object.keys(SITES) : [siteArg];
  const payload =
    siteArg === "all"
      ? await searchAcrossSites({ query, provider, limit, maxPages })
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
  const output = JSON.stringify(payload, null, 2);

  if (args.out) {
    const outputPath = path.resolve(process.cwd(), args.out);
    ensureDirForFile(outputPath);
    fs.writeFileSync(outputPath, `${output}\n`, "utf8");
    console.log(`Wrote ${outputPath}`);
    return;
  }

  console.log(output);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
