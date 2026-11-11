import { probeFacebookOnCloudflare } from '../src/facebook-cloudflare-diagnostic.js';
import { buildFacebookSearchUrl } from '../src/facebook-diagnostic.js';

const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Facebook search diagnostic</title>
<style>body{font:16px system-ui;max-width:850px;margin:40px auto;padding:20px;background:#faf8f2;color:#222}label{display:block;margin:16px 0}input,select,button{font:inherit;padding:10px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:white;padding:20px}button{cursor:pointer}li{margin:15px 0}</style>
<h1>Facebook search test</h1><p>Uses a real Cloudflare browser. One page per test; no login or seller contact. Location values are candidates until verified on Facebook.</p>
<form id="form"><label>Search <input name="query" value="iphone 15" maxlength="120" required></label>
<label>Facebook location slug or ID <input name="location" value="bucharest" pattern="[a-zA-Z0-9-]{1,80}" required></label>
<label>Browser <select name="engine"><option value="chromium">Chromium</option><option value="kitesurf">Kitesurf</option></select></label><button>Run Cloudflare test</button></form>
<p id="status" role="status">Ready. Each test uses browser quota.</p><ul id="cards"></ul><pre id="report"></pre>
<script>const form=document.querySelector('form');form.onsubmit=async e=>{e.preventDefault();form.querySelector('button').disabled=true;document.querySelector('#status').textContent='Testing on Cloudflare…';document.querySelector('#cards').replaceChildren();try{const response=await fetch('/probe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))});const data=await response.json();document.querySelector('#status').textContent=data.status+' — location verification: '+(data.locationVerified?'verified':'still required');document.querySelector('#report').textContent=JSON.stringify(data,null,2);for(const card of data.listings||[]){const li=document.createElement('li');const a=document.createElement('a');a.href=card.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=card.title+' — '+(card.priceText||'price unknown')+' — '+(card.city||'city unknown');li.append(a);document.querySelector('#cards').append(li)}}catch{document.querySelector('#status').textContent='Test could not complete. Check the local runner.'}finally{form.querySelector('button').disabled=false}};</script></html>`;

let active = false;
let lastRun = 0;
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Development-only surface: refuses public hosts even if mistakenly deployed.
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return json({ status: 'local_only' }, 403);
    if (request.headers.get('Origin') && request.headers.get('Origin') !== url.origin) return json({ status: 'origin_denied' }, 403);
    if (url.pathname === '/' && request.method === 'GET') return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
    if (url.pathname !== '/probe' || request.method !== 'POST') return json({ status: 'not_found' }, 404);
    if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({ status: 'invalid_request' }, 400);
    let options;
    try {
      const raw = await request.text();
      if (raw.length > 4096) throw new Error('too large');
      options = JSON.parse(raw);
      buildFacebookSearchUrl(options);
      if (options.engine && !['chromium', 'kitesurf'].includes(options.engine)) throw new Error('engine');
    } catch { return json({ status: 'invalid_request' }, 400); }
    if (active || Date.now() - lastRun < 5000) return json({ status: 'rate_limited' }, 429);
    active = true;
    lastRun = Date.now();
    try { return json(await probeFacebookOnCloudflare(env.BROWSER, options)); }
    finally { active = false; }
  },
};
