import { SellingError, sellingConfigured, serviceHeaders, store, ownerQuery, draftQuery, digest } from './selling-store.js';
import { olxConfigured, publicOrigin, callbackUrl, olxAuthorizeUrl, olxToken, saveOlxConnection, olxAccessToken, olxRequest, olxPayload, okaziiFeed } from './selling-providers.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const fail = (message, status = 400) => { throw new SellingError(message, status); };
async function readBody(request, limit = 65536, binary = false) {
  const reader = request.body?.getReader();
  if (!reader) fail('Lipsește conținutul cererii.');
  const parts = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.length;
    if (size > limit) { await reader.cancel(); fail('Fișierul sau cererea este prea mare.', 413); }
    parts.push(value);
  }
  const data = new Uint8Array(size); let offset = 0;
  for (const part of parts) { data.set(part, offset); offset += part.length; }
  if (binary) return data;
  try { return JSON.parse(new TextDecoder().decode(data)); } catch { fail('Date JSON invalide.'); }
}
export function normalizeSellingListing(input, userId, env) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Anunț invalid.');
  const string = (key, min, max) => {
    const value = typeof input[key] === 'string' ? input[key].trim() : '';
    if (value.length < min || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) fail(`Verifică câmpul ${key}.`);
    return value;
  };
  const price = Number(input.price);
  if (!Number.isFinite(price) || price < 1 || price > 999999999) fail('Preț invalid.');
  const prefix = `${String(env.SUPABASE_URL).replace(/\/$/, '')}/storage/v1/object/public/selling-images/${userId}/`;
  if (!Array.isArray(input.images) || input.images.length > 8 || input.images.some((url) => typeof url !== 'string' || !url.startsWith(prefix) || !new RegExp(`^${uuid.source.slice(1, -1)}\\.(jpg|png|webp)$`, 'i').test(url.slice(prefix.length)))) fail('Fotografii invalide. Încarcă fotografiile din acest cont.');
  const olx = input.olx && typeof input.olx === 'object' ? input.olx : {};
  const attributes = Array.isArray(olx.attributes) ? olx.attributes.filter((a) => a && typeof a.code === 'string').map((a) => ({ code: a.code.slice(0, 100), ...(Array.isArray(a.values) ? { values: a.values.map(String).slice(0, 50) } : { value: typeof a.value === 'number' ? a.value : String(a.value ?? '').slice(0, 1000) }) })) : [];
  return { title: string('title', 3, 120), description: string('description', 20, 5000), location: string('location', 1, 100), category: string('category', 1, 125), condition: string('condition', 1, 100), contactName: string('contactName', 0, 100), phone: string('phone', 0, 30), price, images: input.images,
    olx: { categoryId: Number(olx.categoryId), cityId: Number(olx.cityId), districtId: Number(olx.districtId) || undefined, advertiserType: olx.advertiserType, attributes } };
}
const jobQuery = (userId, listingId, platform) => `${ownerQuery(userId)}&listing_id=eq.${listingId}${platform ? `&platform=eq.${platform}` : ''}`;
async function readOkaziiFeedDrafts(userId, env) {
  const drafts = []; let cursor = '';
  // Keyset pagination tolerates a PostgREST cap smaller than our requested page.
  // Never return a truncated feed that an importer could interpret as removals.
  for (let page = 0; page < 21; page++) {
    const rows = await store(env, 'selling_drafts', `${ownerQuery(userId)}&okazii_enabled=eq.true&order=id.asc&limit=200${cursor ? `&id=gt.${cursor}` : ''}`);
    if (!Array.isArray(rows)) fail('Feed-ul nu poate fi confirmat integral.', 503);
    if (!rows.length) return drafts;
    for (const row of rows) {
      if (!uuid.test(row?.id || '') || (cursor && row.id <= cursor) || drafts.length >= 2000) fail('Feed-ul depășește limita sau nu poate fi citit integral.', 503);
      cursor = row.id; drafts.push(row);
    }
  }
  fail('Feed-ul nu poate fi citit integral. Reîncearcă mai târziu.', 503);
}
export async function publishOlx({ userId, draft, env }) {
  const query = jobQuery(userId, draft.id, 'olx');
  const [existing] = await store(env, 'selling_publications', query);
  if (existing && existing.status !== 'failed') return existing;
  const payload = olxPayload(draft.listing, draft.id);
  const token = await olxAccessToken(userId, env);
  const rows = existing
    ? await store(env, 'selling_publications', `${query}&status=eq.failed`, 'PATCH', { status: 'sending', message: '', updated_at: new Date().toISOString() })
    : await store(env, 'selling_publications', 'on_conflict=user_id,listing_id,platform', 'POST', { user_id: userId, listing_id: draft.id, platform: 'olx', status: 'sending' }, 'resolution=ignore-duplicates');
  if (!rows.length) return (await store(env, 'selling_publications', query))[0];
  let result;
  try {
    const advert = await olxRequest('/adverts', token, 'POST', payload);
    result = olxPublicationReceipt(advert);
  } catch (error) {
    result = { status: error.definitive ? 'failed' : 'unknown', message: error.definitive ? [error.message, ...(error.fields || [])].join(' ') : 'OLX nu a confirmat rezultatul. Verifică anunțurile în contul OLX înainte de o nouă încercare.' };
  }
  // If persisting the receipt fails, the durable sending record blocks duplicate sends.
  const [saved] = await store(env, 'selling_publications', query, 'PATCH', { ...result, updated_at: new Date().toISOString() });
  return saved;
}
export function safeOlxUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && ['olx.ro', 'www.olx.ro'].includes(url.hostname) ? url.href : ''; } catch { return ''; }
}
export function olxPublicationReceipt(advert, expectedId = '') {
  const id = typeof advert?.id === 'number' && Number.isSafeInteger(advert.id) ? String(advert.id)
    : typeof advert?.id === 'string' ? advert.id : '';
  if (!/^[1-9]\d*$/.test(id) || (expectedId && id !== expectedId)) throw new SellingError('OLX nu a confirmat identitatea anunțului.', 502);
  const providerStatus = typeof advert.status === 'string' ? advert.status : '';
  let status = 'unknown'; let message = 'Starea anunțului nu este confirmată. Verifică în contul OLX.';
  if (providerStatus === 'active') { status = 'published'; message = 'Publicat pe OLX.'; }
  else if (['new', 'limited', 'unconfirmed', 'unpaid'].includes(providerStatus)) {
    status = 'pending'; message = 'Primit de OLX. Poate necesita moderare, confirmare sau plată.';
  } else if (['removed_by_user', 'outdated', 'blocked', 'disabled'].includes(providerStatus)) {
    status = 'inactive'; message = 'Anunțul nu este activ pe OLX. Verifică starea în contul OLX.';
  } else if (['moderated', 'removed_by_moderator'].includes(providerStatus)) {
    status = 'rejected'; message = 'Anunț respins de moderarea OLX. Verifică motivul în contul OLX.';
  }
  return { status, provider_id: id, provider_status: providerStatus, url: safeOlxUrl(advert.url), message };
}
export async function handleSelling(request, env, authenticate) {
  try { return await route(request, env, authenticate); }
  catch (error) { return json({ error: error instanceof SellingError ? error.message : 'Serviciul de publicare nu este disponibil momentan.' }, error instanceof SellingError ? error.status : 503); }
}
async function route(request, env, authenticate) {
  const url = new URL(request.url); const path = url.pathname.replace(/\/+$/, ''); const method = request.method;
  if (path === '/api/selling/config' && method === 'GET') return json({ available: sellingConfigured(env) && Boolean(env.SELLING_PUBLIC_URL), olx: olxConfigured(env), okazii: sellingConfigured(env) && Boolean(env.SELLING_PUBLIC_URL) });
  if (path === '/api/selling/olx/callback' && method === 'GET') {
    if (!olxConfigured(env)) fail('Integrarea OLX nu este activată.', 503);
    const state = url.searchParams.get('state') || '';
    const cookie = request.headers.get('cookie')?.split(';').map((item) => item.trim()).find((item) => item.startsWith('selling_oauth='))?.slice(14);
    if (!uuid.test(state) || !cookie || await digest(cookie) !== await digest(state)) fail('Sesiunea de conectare este invalidă. Reîncearcă din VINDE.', 400);
    const [entry] = await store(env, 'selling_oauth_states', `state_hash=eq.${await digest(state)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}`, 'DELETE');
    if (!entry) fail('Conectarea a expirat sau a fost deja folosită.', 400);
    let connected = false;
    if (url.searchParams.get('code') && !url.searchParams.has('error')) {
      const tokens = await olxToken({ grant_type: 'authorization_code', code: url.searchParams.get('code'), redirect_uri: callbackUrl(env) }, env);
      await saveOlxConnection(entry.user_id, tokens, env); connected = true;
    }
    return new Response(null, { status: 303, headers: { location: `${publicOrigin(env)}/vinde/?olx=${connected ? 'connected' : 'cancelled'}`, 'set-cookie': 'selling_oauth=; Path=/api/selling/olx; HttpOnly; SameSite=Lax; Max-Age=0', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } });
  }
  const feedMatch = path.match(/^\/api\/selling\/feeds\/([a-f\d-]+)\.xml$/i);
  if (feedMatch && method === 'GET') {
    if (!uuid.test(feedMatch[1])) fail('Feed inexistent.', 404);
    const [feed] = await store(env, 'selling_feeds', `token=eq.${feedMatch[1]}`);
    if (!feed) fail('Feed inexistent.', 404);
    const drafts = await readOkaziiFeedDrafts(feed.user_id, env);
    return new Response(okaziiFeed(drafts), { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
  }
  const auth = await authenticate(request, env);
  if (!auth.user) return json({ error: auth.error }, auth.status);
  const userId = auth.user.id;
  if (path === '/api/selling/okazii/connect' && method === 'POST') {
    if (!sellingConfigured(env) || !env.SELLING_PUBLIC_URL) fail('Conectarea Okazii nu este disponibilă încă.', 503);
    const origin = publicOrigin(env);
    await store(env, 'selling_feeds', 'on_conflict=user_id', 'POST', { user_id: userId }, 'resolution=ignore-duplicates');
    const [feed] = await store(env, 'selling_feeds', ownerQuery(userId));
    return json({ url: `${origin}/api/selling/feeds/${feed.token}.xml`, status: 'setup_required' });
  }
  if (path === '/api/selling/connections' && method === 'GET') {
    const connections = await store(env, 'selling_connections', `${ownerQuery(userId)}&select=platform`);
    return json({ connections });
  }
  if (path === '/api/selling/olx/connect' && method === 'POST') {
    if (!olxConfigured(env)) fail('Integrarea OLX necesită activare pe server.', 503);
    const state = crypto.randomUUID();
    await store(env, 'selling_oauth_states', '', 'POST', { state_hash: await digest(state), user_id: userId, expires_at: new Date(Date.now() + 600000).toISOString() });
    return new Response(JSON.stringify({ url: olxAuthorizeUrl(state, env) }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'set-cookie': `selling_oauth=${state}; Path=/api/selling/olx; HttpOnly; SameSite=Lax; Max-Age=600${publicOrigin(env).startsWith('https:') ? '; Secure' : ''}` } });
  }
  if (path === '/api/selling/olx/disconnect' && method === 'POST') {
    await store(env, 'selling_connections', `${ownerQuery(userId)}&platform=eq.olx`, 'DELETE'); return json({ disconnected: true });
  }
  if (path === '/api/selling/olx/catalog' && method === 'GET') {
    const kind = url.searchParams.get('kind');
    let endpoint;
    if (kind === 'categories') endpoint = '/categories';
    else if (kind === 'cities') endpoint = `/cities?limit=1000&offset=${Math.max(0, Math.min(100000, Number(url.searchParams.get('offset')) || 0))}`;
    else if (kind === 'attributes' && /^\d+$/.test(url.searchParams.get('category') || '')) endpoint = `/categories/${url.searchParams.get('category')}/attributes`;
    else if (kind === 'districts' && /^\d+$/.test(url.searchParams.get('city') || '')) endpoint = `/cities/${url.searchParams.get('city')}/districts`;
    else fail('Catalog necunoscut.');
    return json({ items: await olxRequest(endpoint, await olxAccessToken(userId, env)) });
  }
  if (path === '/api/selling/images' && method === 'POST') {
    const types = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }; const type = request.headers.get('content-type');
    if (!types[type]) fail('Format imagine invalid.');
    const data = await readBody(request, 10 * 1024 * 1024, true);
    const valid = type === 'image/jpeg' ? data[0] === 255 && data[1] === 216 && data[2] === 255 : type === 'image/png' ? [137,80,78,71,13,10,26,10].every((byte, i) => data[i] === byte) : new TextDecoder().decode(data.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(data.slice(8, 12)) === 'WEBP';
    if (!valid) fail('Fișierul nu este o imagine validă.');
    if (!sellingConfigured(env)) fail('Încărcarea imaginilor nu este configurată.', 503);
    const object = `${userId}/${crypto.randomUUID()}.${types[type]}`;
    const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/selling-images/${object}`, { method: 'POST', headers: { ...serviceHeaders(env), 'content-type': type }, body: data, signal: AbortSignal.timeout(30000) });
    if (!response.ok) fail('Fotografia nu a putut fi încărcată.', 503);
    return json({ url: `${env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/selling-images/${object}` });
  }
  if (path === '/api/selling/drafts' && method === 'GET') {
    return json({ drafts: await store(env, 'selling_drafts', `${ownerQuery(userId)}&select=id,listing,created_at&order=created_at.desc&limit=100`) });
  }
  if (path === '/api/selling/drafts' && method === 'POST') {
    const body = await readBody(request);
    if (!uuid.test(body?.id || '')) fail('Identificator invalid.');
    const listing = normalizeSellingListing(body.listing, userId, env);
    const jobs = await store(env, 'selling_publications', jobQuery(userId, body.id));
    if (jobs.some((job) => job.platform === 'olx' && job.status !== 'failed')) fail('Acest anunț a fost deja trimis către OLX. Creează un anunț nou pentru alt produs.', 409);
    const [draft] = await store(env, 'selling_drafts', 'on_conflict=user_id,id', 'POST', { id: body.id, user_id: userId, listing }, 'resolution=merge-duplicates');
    return json({ draft });
  }
  const draftMatch = path.match(/^\/api\/selling\/drafts\/([a-f\d-]+)$/i);
  if (draftMatch && method === 'GET') {
    if (!uuid.test(draftMatch[1])) fail('Anunț inexistent.', 404);
    const [draft] = await store(env, 'selling_drafts', draftQuery(userId, draftMatch[1]));
    if (!draft) fail('Anunț inexistent.', 404);
    return json({ draft, publications: await store(env, 'selling_publications', jobQuery(userId, draft.id)) });
  }
  if (path === '/api/selling/publish' && method === 'POST') {
    const body = await readBody(request);
    if (!uuid.test(body?.id || '') || !Array.isArray(body.platforms) || !body.platforms.length || body.platforms.length > 2 || body.platforms.some((p) => !['olx', 'okazii'].includes(p))) fail('Selectează platformele pentru publicare.');
    const [draft] = await store(env, 'selling_drafts', draftQuery(userId, body.id));
    if (!draft) fail('Salvează mai întâi anunțul.', 404);
    const results = [];
    for (const platform of new Set(body.platforms)) {
      try {
        if (platform === 'olx') results.push(await publishOlx({ userId, draft, env }));
        else {
          if (!env.SELLING_PUBLIC_URL) fail('Feed-ul Okazii nu este configurat.', 503);
          await store(env, 'selling_drafts', draftQuery(userId, draft.id), 'PATCH', { okazii_enabled: true });
          await store(env, 'selling_feeds', 'on_conflict=user_id', 'POST', { user_id: userId }, 'resolution=ignore-duplicates');
          const [feed] = await store(env, 'selling_feeds', ownerQuery(userId));
          const [result] = await store(env, 'selling_publications', 'on_conflict=user_id,listing_id,platform', 'POST', { user_id: userId, listing_id: draft.id, platform: 'okazii', status: 'feed_ready', url: `${publicOrigin(env)}/api/selling/feeds/${feed.token}.xml`, message: 'Adăugat în feed. Configurează importul automat în magazinul Okazii; importul nu este încă confirmat.' }, 'resolution=merge-duplicates');
          results.push(result);
        }
      } catch (error) { results.push({ platform, status: 'error', message: error instanceof SellingError ? error.message : 'Rezultatul nu poate fi confirmat. Reîncarcă starea înainte de a continua.' }); }
    }
    return json({ results });
  }
  if (path === '/api/selling/refresh' && method === 'POST') {
    const body = await readBody(request); if (!uuid.test(body?.id || '')) fail('Anunț invalid.');
    const query = jobQuery(userId, body.id, 'olx'); const [job] = await store(env, 'selling_publications', query);
    if (!job) fail('Nu există o trimitere OLX pentru acest anunț.', 404);
    const token = await olxAccessToken(userId, env);
    let receipt;
    if (job.provider_id && /^[1-9]\d*$/.test(job.provider_id)) {
      const advert = await olxRequest(`/adverts/${job.provider_id}`, token);
      receipt = olxPublicationReceipt(advert, job.provider_id);
    } else if (['sending', 'unknown'].includes(job.status)) {
      // Read-only recovery: the original POST uses the draft UUID as external_id.
      // An absent/ambiguous match is never permission to issue another POST.
      const adverts = await olxRequest(`/adverts?${new URLSearchParams({ external_id: body.id, limit: '2', offset: '0' })}`, token);
      if (!Array.isArray(adverts)) fail('Răspuns OLX invalid. Starea trimiterii nu a fost schimbată.', 502);
      if (adverts.length === 1 && String(adverts[0]?.external_id) === body.id) receipt = olxPublicationReceipt(adverts[0]);
      else receipt = { status: 'unknown', message: 'Nu există o potrivire unică confirmată. Verifică anunțurile în contul OLX; nu retrimite automat.' };
    }
    const updateQuery = !job.provider_id && ['sending', 'unknown'].includes(job.status) ? `${query}&status=eq.${job.status}` : query;
    if (receipt) await store(env, 'selling_publications', updateQuery, 'PATCH', { ...receipt, updated_at: new Date().toISOString() });
    return json({ publications: await store(env, 'selling_publications', jobQuery(userId, body.id)) });
  }
  if (path === '/api/selling/okazii/remove' && method === 'POST') {
    const body = await readBody(request); if (!uuid.test(body?.id || '')) fail('Anunț invalid.');
    await store(env, 'selling_drafts', draftQuery(userId, body.id), 'PATCH', { okazii_enabled: false });
    await store(env, 'selling_publications', jobQuery(userId, body.id, 'okazii'), 'DELETE');
    return json({ removed: true });
  }
  return json({ error: 'Rută de publicare necunoscută.' }, 404);
}
