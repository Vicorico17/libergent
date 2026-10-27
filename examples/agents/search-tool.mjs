// Framework-neutral tool definition and server-side executor for a custom agent loop.
export const searchProductsTool = {
  name: 'search_products',
  description: 'Search marketplace products. Preserve source URLs, unknown fields and partial failures. Test keys return simulated listings.',
  inputSchema: { type: 'object', additionalProperties: false, required: ['query'], properties: {
    query: { type: 'string', minLength: 1, maxLength: 120 }, limit: { type: 'integer', minimum: 1, maximum: 20 }
  } }
};
export async function executeSearchProducts({ query, limit = 10 }, { apiKey, origin, fetcher = fetch } = {}) {
  if (typeof query !== 'string' || !query.trim() || query.length > 120 || !Number.isInteger(limit) || limit < 1 || limit > 20) throw Error('Invalid search arguments');
  if (!apiKey || !origin) throw Error('Configure the API origin and key on the agent server');
  const url = new URL('/api/v1/search', origin);
  url.search = new URLSearchParams({ q: query, limit: String(limit) }).toString();
  const response = await fetcher(url, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(35000), redirect: 'error' });
  const data = await response.json();
  return { ok: response.ok, status: response.status, retryAfterSeconds: response.headers.has('retry-after') ? Number(response.headers.get('retry-after')) : null, data };
}
