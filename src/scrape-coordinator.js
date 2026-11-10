// One object per normalized marketplace hostname. Only internal bindings can
// call these endpoints; it never accepts arbitrary URLs or fetches user input.
export class ScrapeCoordinator {
  constructor(state) { this.state = state; }
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    let body;
    if (path === '/release' || path === '/cooldown') {
      try { body = await request.json(); } catch { return Response.json({ error: 'invalid_request' }, { status: 400 }); }
    }
    const now = Date.now();
    return this.state.storage.transaction(async storage => {
      const data = await storage.get('budget') || { window: now, requests: 0, until: 0, leases: {} };
      for (const [key, expiry] of Object.entries(data.leases)) if (expiry <= now) delete data.leases[key];
      if (now - data.window >= 60000) { data.window = now; data.requests = 0; }
      let result = {};
      let status = 200;
      if (path === '/acquire') {
        if (data.until > now || Object.keys(data.leases).length >= 2 || data.requests >= 30) {
          result = { retryAfterMs: Math.max(1000, data.until - now, data.requests >= 30 ? data.window + 60000 - now : 0) };
          status = 429;
        } else {
          const lease = crypto.randomUUID();
          data.leases[lease] = now + 45000;
          data.requests++;
          result = { lease };
        }
      } else if (path === '/release' || path === '/cooldown') {
        if (path === '/release') delete data.leases[body.lease];
        else if (Number.isFinite(body.delay)) data.until = Math.max(data.until, now + Math.max(0, Math.min(body.delay, 3600000)));
      } else return new Response('Not found', { status: 404 });
      await storage.put('budget', data);
      return Response.json(result, { status });
    });
  }
}
