// These are edge burst controls, not strict worldwide usage accounting.
export async function checkFreeSearchLimits(request, env) {
  if (env.LIBERGENT_FREE_SEARCH_LIMITS_ENABLED !== '1') return null;
  const unavailable = () => Response.json({ error: 'Search limits are temporarily unavailable. Please retry shortly.' }, {
    status: 503, headers: { 'retry-after': '60', 'cache-control': 'no-store' }
  });
  if (!env.FREE_SEARCH_CLIENT_LIMITER?.limit || !env.FREE_SEARCH_TOTAL_LIMITER?.limit) return unavailable();
  try {
    // Cloudflare supplies this header. Never trust client-supplied forwarding
    // headers, cookies or query parameters to choose the anonymous quota key.
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const client = await env.FREE_SEARCH_CLIENT_LIMITER.limit({ key: `free:ip:${ip}` });
    if (typeof client?.success !== 'boolean') return unavailable();
    // A blocked client must not consume the shared allowance.
    const total = client.success
      ? await env.FREE_SEARCH_TOTAL_LIMITER.limit({ key: 'free:all' })
      : null;
    if (client.success && typeof total?.success !== 'boolean') return unavailable();
    if (!client.success || !total.success) return Response.json({ error: 'Too many searches. Please retry in a minute.' }, {
      status: 429, headers: { 'retry-after': '60', 'cache-control': 'no-store' }
    });
    return null;
  } catch {
    return unavailable();
  }
}
