import fs from "node:fs";
import { SITES } from "../src/sites.js";
import { SOURCE_VALIDATION_SNAPSHOT } from "../src/source-validation-snapshot.js";

const [reportPath, ...evidenceArgs] = process.argv.slice(2);
if (!reportPath) {
  throw new Error("Usage: node scripts/refresh-source-validation-snapshot.js <validate-shops.json> [production-free-response.json ...] [--browser-report=path --browser-verified=site,...]");
}
const productionPaths = evidenceArgs.filter((arg) => !arg.startsWith("--"));
const browserReportPaths = evidenceArgs.filter((arg) => arg.startsWith("--browser-report="))
  .map((arg) => arg.slice("--browser-report=".length));
const verifiedBrowserSites = new Set((evidenceArgs.find((arg) => arg.startsWith("--browser-verified="))?.slice("--browser-verified=".length) || "")
  .split(",").map((site) => site.trim()).filter(Boolean));
if (verifiedBrowserSites.size && !browserReportPaths.length) throw new Error("--browser-verified requires --browser-report.");

const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const expectedSites = Object.keys(SITES);
const reportedSites = new Map((report.sources || []).map((source) => [source.site, source]));
if (reportedSites.size !== expectedSites.length || expectedSites.some((site) => !reportedSites.has(site))) {
  throw new Error(`Expected one validation result for all ${expectedSites.length} registered sources.`);
}

const productionBySite = new Map();
for (const filePath of productionPaths) {
  const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const checkedAt = payload.summary?.searchedAt;
  if (!Number.isFinite(Date.parse(checkedAt)) || !Array.isArray(payload.results)) {
    throw new Error(`Invalid production Free response: ${filePath}`);
  }
  for (const result of payload.results) {
    if (!reportedSites.has(result.site)) continue;
    const checks = productionBySite.get(result.site) || [];
    checks.push({
      checkedAt,
      query: result.query || "",
      ok: Boolean(result.ok),
      accepted: result.includedItemCount ?? result.itemCount ?? 0,
      error: result.ok ? "" : result.error || "Search failed.",
      cacheHit: Boolean(payload.summary.cacheHit)
    });
    productionBySite.set(result.site, checks);
  }
}

const browserBySite = new Map();
for (const browserReportPath of browserReportPaths) {
  const payload = JSON.parse(fs.readFileSync(browserReportPath, "utf8"));
  if (!Number.isFinite(Date.parse(payload.testedAt)) || !Array.isArray(payload.results)) {
    throw new Error(`Invalid browser benchmark report: ${browserReportPath}`);
  }
  for (const result of payload.results) {
    if (!verifiedBrowserSites.has(result.site)) continue;
    if (!reportedSites.has(result.site) || !result.ok || result.challengeDetected || result.itemCount <= 0 ||
      !result.sample?.some((item) => item.title && item.price && item.url)) {
      throw new Error(`Browser result for ${result.site} is not usable.`);
    }
    browserBySite.set(result.site, {
      checkedAt: payload.testedAt,
      query: result.query,
      engine: result.engine || payload.engine,
      accepted: result.itemCount,
      priceVerified: true
    });
  }
}
for (const site of verifiedBrowserSites) {
  if (!browserBySite.has(site)) throw new Error(`No usable browser result for verified site ${site}.`);
}

const refreshed = Object.fromEntries(expectedSites.map((siteKey) => {
  const source = reportedSites.get(siteKey);
  const checkedAt = source.checkedAt || report.checkedAt;
  const previous = SOURCE_VALIDATION_SNAPSHOT[siteKey] || {};
  const productionChecks = new Map();
  for (const check of [...(previous.productionChecks || []), ...(productionBySite.get(siteKey) || [])]) {
    productionChecks.set(`${check.checkedAt.slice(0, 10)}:${check.query}`, check);
  }
  const latestProduction = [...productionChecks.values()]
    .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))
    .slice(0, 10);
  const directChecks = source.checks.map((check) => ({
    query: check.query,
    ok: check.ok,
    raw: check.rawItemCount,
    accepted: check.includedItemCount,
    durationMs: check.durationMs,
    error: check.error || ""
  }));
  const recentProductionSuccess = latestProduction.some((check) =>
    check.checkedAt.slice(0, 10) >= checkedAt.slice(0, 10) && check.accepted > 0);
  const browserChecks = new Map();
  for (const check of [...(previous.browserChecks || []), ...(browserBySite.has(siteKey) ? [browserBySite.get(siteKey)] : [])]) {
    browserChecks.set(`${check.checkedAt.slice(0, 10)}:${check.query}:${check.engine}`, check);
  }
  const latestBrowser = [...browserChecks.values()].sort((a, b) => b.checkedAt.localeCompare(a.checkedAt)).slice(0, 10);
  const recentBrowserSuccess = latestBrowser.some((check) =>
    check.checkedAt.slice(0, 10) >= checkedAt.slice(0, 10) && check.accepted > 0 && check.priceVerified);
  return [siteKey, {
    checkedAt,
    provider: report.provider,
    environment: "local-node",
    queries: directChecks,
    repeatedNoUsefulResults: directChecks.every((check) => check.accepted === 0) && !recentProductionSuccess && !recentBrowserSuccess,
    ...(latestProduction.length ? { productionChecks: latestProduction } : {}),
    ...(latestBrowser.length ? { browserChecks: latestBrowser } : {})
  }];
}));

const output = [
  "// Dated direct probes, production Free-search responses, and reviewed browser benchmarks.",
  "// Point-in-time evidence, not continuous uptime.",
  "export const SOURCE_VALIDATION_SNAPSHOT = {",
  ...Object.entries(refreshed).map(([site, value]) => `  ${JSON.stringify(site)}: ${JSON.stringify(value)},`),
  "};",
  ""
].join("\n");
fs.writeFileSync(new URL("../src/source-validation-snapshot.js", import.meta.url), output);
console.log(`Refreshed ${expectedSites.length} source checks from ${report.checkedAt}.`);
