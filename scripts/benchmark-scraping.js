#!/usr/bin/env node
import fs from 'node:fs/promises';
import { searchAcrossSites } from '../src/app.js';
import { getSite } from '../src/sites.js';
import { summarizeScrapeCase, summarizeBenchmark } from '../src/scrape-benchmark.js';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1]; };
if (args.includes('--help') || !option('--cases') || !option('--out') || (!args.includes('--local') && !option('--base-url'))) {
  console.log('Usage: node scripts/benchmark-scraping.js --cases cases.json --out report.json (--local | --base-url https://libergent.com) [--baseline report.json] [--labels labels.json]');
  console.log('Cases: [{"query":"iphone 15","site":"olx.ro"}]. Max 30 cases, sequential direct/Free searches, 2 pages, 20 results. No paid searches.');
  process.exit(args.includes('--help') ? 0 : 1);
}
const cases = JSON.parse(await fs.readFile(option('--cases'), 'utf8'));
if (!Array.isArray(cases) || !cases.length || cases.length > 30) throw new Error('Provide 1–30 benchmark cases');
for (const entry of cases) {
  if (!entry || typeof entry.query !== 'string' || !entry.query.trim() || entry.query.length > 120 || typeof entry.site !== 'string') throw new Error('Invalid benchmark case');
  getSite(entry.site);
}
const labels = option('--labels') ? JSON.parse(await fs.readFile(option('--labels'), 'utf8')) : {};
const report = { checkedAt: new Date().toISOString(), environment: args.includes('--local') ? 'local-node' : option('--base-url'), cases: [] };
for (const entry of cases) {
  const started = Date.now();
  let payload;
  try {
    if (args.includes('--local')) {
      process.env.LIBERGENT_MOCK_SEARCH = '0';
      payload = await searchAcrossSites({ query: entry.query, siteKeys: [entry.site], provider: 'direct', limit: 20, maxPages: 2 });
    } else {
      const url = new URL('/api/search/free', option('--base-url'));
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid benchmark origin');
      url.search = new URLSearchParams({ q: entry.query, site: entry.site, limit: '20', pages: '2', refresh: '1' });
      const response = await fetch(url, { signal: AbortSignal.timeout(65000), redirect: 'error' });
      if (!response.ok) throw new Error(`Benchmark HTTP ${response.status}`);
      payload = await response.json();
    }
  } catch (error) {
    payload = { results: [{ ok: false, site: entry.site, error: error.message }] };
  }
  report.cases.push(summarizeScrapeCase(payload, { ...entry, durationMs: Date.now() - started, labels: labels[entry.query] || {} }));
  report.summary = summarizeBenchmark(report.cases);
  await fs.writeFile(option('--out'), JSON.stringify(report, null, 2) + '\n');
}
if (option('--baseline')) {
  const baseline = JSON.parse(await fs.readFile(option('--baseline'), 'utf8'));
  report.comparison = report.cases.map(current => {
    const previous = baseline.cases?.find(entry => entry.query === current.query && entry.site === current.site);
    return { query: current.query, site: current.site, ...(previous ? {
      uniqueListingsDelta: current.uniqueListings - previous.uniqueListings,
      durationMsDelta: current.durationMs - previous.durationMs,
      precisionDelta: current.precisionAt10 !== null && previous.precisionAt10 !== null ? current.precisionAt10 - previous.precisionAt10 : null
    } : { missingBaseline: true }) };
  });
  await fs.writeFile(option('--out'), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify(report.summary, null, 2));
