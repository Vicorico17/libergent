#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const help = `LiberGent selling agent (JSON input/output)
Set LIBERGENT_URL and LIBERGENT_ACCESS_TOKEN in your agent's secure environment.
  node src/selling-agent.js status
  node src/selling-agent.js catalog < JSON
  node src/selling-agent.js save < JSON
  node src/selling-agent.js publish < JSON
  node src/selling-agent.js get < JSON
  node src/selling-agent.js refresh < JSON
  node src/selling-agent.js upload /path/to/photo.jpg
Save: {"id":"stable-uuid","listing":{...}}
Publish: {"id":"same-uuid","platforms":["olx","okazii"]}
Get/refresh: {"id":"same-uuid"}
Catalog: {"kind":"categories|cities|attributes|districts","category":123,"city":123}
Only publish when instructed by the seller. Keep the same ID when checking or retrying.
OLX requires a connected account and category fields. Okazii requires seller-configured import.
Other marketplaces currently require manual completion. Never report them as published.`;

export async function runSellingAgent(command, input = {}, { env = process.env, fetcher = fetch } = {}) {
  const base = new URL(env.LIBERGENT_URL || 'https://libergent.ro');
  if (base.username || base.password || (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)))) throw new Error('Use HTTPS, or HTTP on localhost.');
  if (!env.LIBERGENT_ACCESS_TOKEN) throw new Error('Connect a LiberGent account through the secure environment; do not paste tokens into chat.');
  const api = async (path, method = 'GET', body, contentType = 'application/json') => {
    const response = await fetcher(new URL(`/api/selling/${path}`, base), {
      method, redirect: 'error', signal: AbortSignal.timeout(60000),
      headers: { authorization: `Bearer ${env.LIBERGENT_ACCESS_TOKEN}`, 'content-type': contentType },
      ...(body === undefined ? {} : { body: contentType === 'application/json' ? JSON.stringify(body) : body }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `Selling request failed (${response.status}).`);
    return payload;
  };
  if (command === 'status') {
    const config = await api('config');
    return { config, ...(config.available ? await api('connections') : { connections: [] }), manual: ['Facebook Marketplace', 'Publi24', 'LaJumate', 'Anunțul.ro', 'Vinted', 'Autovit'], note: 'Connections do not prove a listing is ready. Check category requirements and publication receipts. Okazii feed_ready is not published.' };
  }
  if (command === 'catalog') {
    if (!['categories', 'cities', 'attributes', 'districts'].includes(input.kind)) throw new Error('Invalid catalog kind.');
    const params = new URLSearchParams();
    for (const key of ['kind', 'category', 'city', 'offset']) if (input[key] !== undefined) params.set(key, String(input[key]));
    return api(`olx/catalog?${params}`);
  }
  if (command === 'upload') {
    const types = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
    const type = types[input.path?.split('.').pop()?.toLowerCase()];
    if (!type) throw new Error('Upload a JPG, PNG or WebP file.');
    const bytes = await readFile(input.path);
    if (bytes.length > 10 * 1024 * 1024) throw new Error('Photo exceeds 10 MB.');
    return api('images', 'POST', bytes, type);
  }
  if (!['save', 'publish', 'get', 'refresh'].includes(command)) throw new Error('Unknown command. Use --help.');
  if (!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(input.id || '')) throw new Error('Provide a stable UUID for this product.');
  if (command === 'publish' && (!Array.isArray(input.platforms) || !input.platforms.length || input.platforms.some((p) => !['olx', 'okazii'].includes(p)))) throw new Error('Direct submission supports only olx and okazii; other marketplaces need manual completion.');
  if (command === 'get') return api(`drafts/${input.id}`);
  return api(command === 'save' ? 'drafts' : command, 'POST', input);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const command = process.argv[2];
  if (!command || command === '--help') console.log(help);
  else {
    try {
      let input = {};
      if (command === 'upload') input = { path: process.argv[3] };
      else if (command !== 'status') {
        let raw = '';
        for await (const chunk of process.stdin) { raw += chunk; if (raw.length > 65536) throw new Error('Input exceeds 64 KB.'); }
        input = JSON.parse(raw);
      }
      console.log(JSON.stringify(await runSellingAgent(command, input), null, 2));
    } catch (error) { console.error(JSON.stringify({ error: error.message })); process.exitCode = 1; }
  }
}
