import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "../env.js";
import { searchAcrossSites } from "../app.js";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function round(value, digits = 3) {
  return Number(value.toFixed(digits));
}

function isRelevant(item, rules) {
  const typeOk = rules.allowedListingTypes.includes(item.listingType);
  const rejected = Array.isArray(item.rejectionReasons) && item.rejectionReasons.length > 0;
  return typeOk && (!rules.disallowRejectedItems || !rejected);
}

function isUnsafePromotion(item) {
  return (
    Number.isFinite(item.relevanceScore) &&
    item.relevanceScore >= 90 &&
    Array.isArray(item.rejectionReasons) &&
    item.rejectionReasons.length > 0
  );
}

function buildReportMarkdown(summary) {
  const lines = [];
  lines.push(`# Relevance Baseline Report (${summary.generatedAt.slice(0, 10)})`);
  lines.push("");
  lines.push(`- mode: ${summary.mode}`);
  lines.push(`- topK: ${summary.topK}`);
  lines.push(`- queries: ${summary.queryCount}`);
  lines.push(`- evaluated sites: ${summary.evaluatedSiteCount}`);
  lines.push(`- avg precision@${summary.topK}: ${summary.averagePrecisionAtK}`);
  lines.push(`- unsafe promotions: ${summary.unsafePromotions}`);
  lines.push("");
  lines.push("## Target Check");
  lines.push(`- avg precision@${summary.topK} >= ${summary.targets.minAveragePrecisionAtK}: ${summary.passFail.averagePrecision}`);
  lines.push(`- unsafe promotions <= ${summary.targets.maxUnsafePromotions}: ${summary.passFail.unsafePromotions}`);
  lines.push(`- avg site coverage >= ${summary.targets.minCoverageSites}: ${summary.passFail.coverage}`);
  lines.push(`- overall: ${summary.passFail.overall}`);
  lines.push("");
  lines.push("## Per-query Metrics");
  for (const row of summary.perQuery) {
    lines.push(`- ${row.queryId} \`${row.query}\`: precision@${summary.topK}=${row.averagePrecisionAtK}, coverage=${row.siteCoverage}, unsafe=${row.unsafePromotions}`);
  }
  lines.push("");
  lines.push("## Baseline Tuning Opportunities");
  lines.push("1. Penalize rejected listings in final recommendation score. Items with non-empty `rejectionReasons` still score >=90 and appear in top-k.");
  lines.push("2. Tighten bundle/accessory suppression for core purchase intents. `listingType=bundle` frequently enters top-3 for product queries.");
  lines.push("3. Expand vertical coverage for vehicle intents. `jeep compass` currently returns one site in baseline, reducing marketplace diversity.");
  return lines.join("\n");
}

async function main() {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));
  const seedPath = path.resolve(process.cwd(), args.seed || "data/relevance/seed-queries.json");
  const judgmentsPath = path.resolve(process.cwd(), args.judgments || "data/relevance/judgments.mock.json");
  const outDir = path.resolve(process.cwd(), args.outDir || "results/relevance");
  const mode = args.mode || "mock";

  if (mode === "mock") {
    process.env.LIBERGENT_MOCK_SEARCH = "1";
  }

  const seed = readJson(seedPath);
  const judgments = readJson(judgmentsPath);
  const topK = Number(seed.topK || 3);
  const rows = [];
  let totalPrecision = 0;
  let totalUnsafe = 0;
  let totalCoverage = 0;
  let evaluatedSiteCount = 0;

  for (const queryDef of seed.queries) {
    const rules = judgments.byQueryId?.[queryDef.id] || judgments.default;
    const result = await searchAcrossSites({
      query: queryDef.text,
      condition: queryDef.condition || "any"
    });

    const siteRows = result.results
      .filter((siteResult) => siteResult.ok)
      .map((siteResult) => {
        const topItems = siteResult.items.slice(0, topK);
        const relevantCount = topItems.filter((item) => isRelevant(item, rules)).length;
        const unsafePromotions = topItems.filter(isUnsafePromotion).length;
        return {
          site: siteResult.site,
          precisionAtK: round(relevantCount / Math.max(topK, 1)),
          unsafePromotions,
          topItems: topItems.map((item) => ({
            title: item.title,
            listingType: item.listingType,
            relevanceScore: item.relevanceScore,
            rejectionReasons: item.rejectionReasons || []
          }))
        };
      });

    const avgPrecision = siteRows.length
      ? round(siteRows.reduce((sum, row) => sum + row.precisionAtK, 0) / siteRows.length)
      : 0;
    const unsafe = siteRows.reduce((sum, row) => sum + row.unsafePromotions, 0);

    rows.push({
      queryId: queryDef.id,
      query: queryDef.text,
      siteCoverage: siteRows.length,
      averagePrecisionAtK: avgPrecision,
      unsafePromotions: unsafe,
      sites: siteRows
    });

    totalPrecision += avgPrecision;
    totalUnsafe += unsafe;
    totalCoverage += siteRows.length;
    evaluatedSiteCount += siteRows.length;
  }

  const averagePrecisionAtK = round(totalPrecision / Math.max(rows.length, 1));
  const averageSiteCoverage = round(totalCoverage / Math.max(rows.length, 1));
  const targets = seed.targets;
  const passFail = {
    averagePrecision: averagePrecisionAtK >= targets.minAveragePrecisionAtK ? "PASS" : "FAIL",
    unsafePromotions: totalUnsafe <= targets.maxUnsafePromotions ? "PASS" : "FAIL",
    coverage: averageSiteCoverage >= targets.minCoverageSites ? "PASS" : "FAIL"
  };
  passFail.overall = Object.values(passFail).every((value) => value === "PASS") ? "PASS" : "FAIL";

  const summary = {
    generatedAt: new Date().toISOString(),
    mode,
    topK,
    queryCount: rows.length,
    evaluatedSiteCount,
    averagePrecisionAtK,
    averageSiteCoverage,
    unsafePromotions: totalUnsafe,
    targets,
    passFail,
    perQuery: rows
  };

  ensureDir(outDir);
  const dateStamp = summary.generatedAt.slice(0, 10);
  const jsonPath = path.join(outDir, `baseline-${dateStamp}.json`);
  const mdPath = path.join(outDir, `baseline-${dateStamp}.md`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  fs.writeFileSync(mdPath, `${buildReportMarkdown(summary)}\n`, "utf8");

  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  console.log(`Overall: ${summary.passFail.overall}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
