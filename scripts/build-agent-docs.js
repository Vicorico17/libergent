import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PRIVATE_PAGE_ROUTES, AGENT_GUIDE, renderPageDocument, renderPageIndex, addDiscoveryLinks, artifactDigest, decodeHtml } from '../src/agent-documents.js';
const root = fileURLToPath(new URL('..', import.meta.url));
const out = path.join(root, 'ui/out');
const generatedAt = new Date().toISOString();
const documents = new Map([['/agents/index.md', AGENT_GUIDE], ['/agents/llms.txt', renderPageIndex('/agents/', 'LiberGent for agents')]]);
const pages = [];
async function visit(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('_') || entry.name.startsWith('.') || entry.name === '404') continue;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) await visit(filename);
    else if (entry.name === 'index.html') {
      const relative = path.relative(out, directory).split(path.sep).join('/');
      const route = relative ? `/${relative}/` : '/';
      if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(route)) throw new Error(`Unsupported agent document route: ${route}`);
      const html = await fs.readFile(filename, 'utf8');
      const title = decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || 'LiberGent').replace(/[\[\]\r\n]/g, ' ');
      documents.set(`${route}index.md`, renderPageDocument(route, html, generatedAt));
      if (route !== '/') documents.set(`${route}llms.txt`, renderPageIndex(route, title));
      await fs.writeFile(filename, addDiscoveryLinks(html, route));
      pages.push({ route, title });
    }
  }
}
await visit(out);
if (!pages.some(page => page.route === '/')) throw new Error('Build the static UI before generating agent documents');
pages.sort((a, b) => a.route.localeCompare(b.route));
documents.set('/llms.txt', `# LiberGent\n\n> Search and compare Romanian marketplace products. Read-only API/MCP integrations provide source URLs, freshness and partial-failure evidence.\n\nThis index describes static pages, not live inventory. Private page documents contain access guidance only. Features may require configuration; check runtime capabilities.\n\n## Agent access\n\n- [Agent guide](/agents/index.md): authentication, supported actions and result verification.\n- [OpenAPI](/api/v1/openapi.json): existing developer search contract.\n- [Runtime capabilities](/.well-known/agent.json): configured API/MCP interfaces.\n- [Build evidence](/.well-known/site-evidence.json): text artifact SHA-256 checksums.\n\n## Pages\n\n${pages.map(page => `- [${page.title}](${page.route}index.md): ${page.route}`).join('\n')}\n\n## Optional\n\n- [Complete documentation](/llms-full.txt): all generated page documents.\n`);
documents.set('/llms-full.txt', [AGENT_GUIDE, ...pages.map(page => documents.get(`${page.route}index.md`))].join('\n\n---\n\n'));
let revision = null;
let dirty = null;
try {
  revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim());
} catch { /* Builds without Git explicitly report unavailable revision evidence. */ }
const artifacts = [];
for (const [url, body] of documents) {
  const filename = path.join(out, url);
  await fs.mkdir(path.dirname(filename), { recursive: true });
  await fs.writeFile(filename, body);
  artifacts.push({ path: url, sha256: artifactDigest(body), bytes: Buffer.byteLength(body) });
}
const evidence = { schemaVersion: '1', generatedAt, revision, dirty, verification: 'Same-origin unsigned integrity manifest. Does not attest marketplace truth or runtime readiness.', pages: pages.map(page => ({ path: page.route, markdown: `${page.route}index.md`, llms: `${page.route}llms.txt` })), artifacts };
await fs.mkdir(path.join(out, '.well-known'), { recursive: true });
await fs.writeFile(path.join(out, '.well-known/site-evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
const siteOrigin = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://libergent.com').origin;
if (!/^https?:\/\//.test(siteOrigin)) throw new Error('Invalid public site origin');
const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + pages.filter(page => !PRIVATE_PAGE_ROUTES.has(page.route)).map(page => `<url><loc>${siteOrigin}${page.route}</loc></url>`).join('') + '</urlset>\n';
await fs.writeFile(path.join(out, 'sitemap.xml'), sitemap, { flag: 'wx' }).catch(error => { if (error.code !== 'EEXIST') throw error; });
await fs.writeFile(path.join(out, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${siteOrigin}/sitemap.xml\n# Agent documentation: /llms.txt\n`, { flag: 'wx' }).catch(error => { if (error.code !== 'EEXIST') throw error; });
// Static asset hosting may bypass Worker code; ship content types with assets.
const headerLines = [...documents.keys()].flatMap(url => [url, `  Content-Type: ${url.endsWith('.md') ? 'text/markdown' : 'text/plain'}; charset=utf-8`, '  X-Content-Type-Options: nosniff', '  Cache-Control: public, max-age=300', '  Link: </llms.txt>; rel="describedby"', '']);
headerLines.push('/.well-known/site-evidence.json', '  Content-Type: application/json; charset=utf-8', '  Cache-Control: public, max-age=60');
const headerPath = path.join(out, '_headers');
let existing = '';
try { existing = await fs.readFile(headerPath, 'utf8'); } catch { /* No existing asset headers. */ }
existing = existing.replace(/# BEGIN GENERATED AGENT HEADERS[\s\S]*?# END GENERATED AGENT HEADERS\n?/g, '');
await fs.writeFile(headerPath, existing + '\n# BEGIN GENERATED AGENT HEADERS\n' + headerLines.join('\n') + '\n# END GENERATED AGENT HEADERS\n');
console.log(`Generated agent documentation for ${pages.length} pages (${artifacts.length} text artifacts).`);
