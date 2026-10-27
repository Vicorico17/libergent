import { buildSandboxSearch, INTEGRATION_SOURCES } from './integration.js';
const nullableString = { type: ['string', 'null'] };
const image = { type: 'object', required: ['url', 'sourceUrl', 'provenance'], properties: {
  url: { type: 'string', format: 'uri' }, sourceUrl: nullableString, provenance: { const: 'original_listing' }
} };
const item = { type: 'object', required: ['url', 'source', 'title', 'price', 'currency', 'location', 'condition', 'description', 'mainImage', 'galleryImages', 'size', 'measurements', 'material', 'attributes', 'availability', 'lastVerifiedAt', 'detailStatus', 'classification'], properties: {
  url: nullableString, source: { type: 'string' }, title: nullableString, price: { type: ['number', 'string', 'null'], description: 'Structured amount when available; otherwise original price text. No inferred conversion.' }, currency: nullableString,
  location: nullableString, condition: nullableString, description: nullableString, size: nullableString, measurements: nullableString, material: nullableString,
  mainImage: { anyOf: [image, { type: 'null' }] }, galleryImages: { type: 'array', items: image },
  attributes: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, value: { type: 'string' } } } },
  availability: { enum: ['active', 'removed', 'unknown'] }, lastVerifiedAt: { type: ['string', 'null'], format: 'date-time' }, detailStatus: { enum: ['verified', 'unavailable', 'not_requested'] },
  classification: { type: 'object', properties: { category: { enum: ['full_fur_coat', 'fur_trim_only_or_ambiguous', 'accessory', 'unknown'] }, material: { enum: ['natural', 'synthetic', 'unknown'] }, independentlyVerified: { const: false }, age: { type: 'null' }, authenticity: { type: 'null' }, evidence: { type: 'array', items: { type: 'object', properties: { field: { type: 'string' }, rule: { type: 'string' }, text: { type: 'string' }, basis: { const: 'seller_claim' } } } } } }
} };
const envelope = { type: 'object', required: ['apiVersion', 'mode', 'searchedAt', 'expiresAt', 'partial', 'sources', 'inspectedCount', 'items'], properties: {
  apiVersion: { const: '1' }, mode: { enum: ['test', 'live'] }, simulated: { type: 'boolean' }, searchedAt: { type: 'string', format: 'date-time' }, expiresAt: { type: 'string', format: 'date-time' }, partial: { type: 'boolean' }, inspectedCount: { type: 'integer' },
  cache: { type: 'object', properties: { status: { enum: ['hit', 'miss', 'coalesced'] }, ageSeconds: { type: 'integer' } } },
  sources: { type: 'array', items: { type: 'object', required: ['source', 'status', 'candidateCount'], properties: { source: { type: 'string' }, status: { enum: ['ok', 'failed'] }, candidateCount: { type: 'integer' }, error: { enum: ['timeout', 'source_unavailable'] }, simulated: { type: 'boolean' } } } },
  items: { type: 'array', items: { $ref: '#/components/schemas/Listing' } }
} };
const response = (description, schema) => ({ description, content: { 'application/json': { schema } } });
export const OPENAPI = {
  openapi: '3.1.0', info: { title: 'Libergent API', version: '1.0.0', description: 'Product search for storefronts and applications. Create scoped test/live keys at /developers. Test keys return simulated data and never contact marketplaces.' },
  servers: [{ url: '/' }],
  paths: {
    '/api/v1/search': { get: { operationId: 'searchProducts', summary: 'Search products', security: [{ ApiKey: [] }],
      parameters: [
        { name: 'q', required: true, in: 'query', schema: { type: 'string', minLength: 1, maxLength: 120 }, description: 'Any supported product query, e.g. iphone 15 or bicicleta.' },
        { name: 'sites', in: 'query', schema: { type: 'string', default: 'olx.ro' }, description: `Comma-separated allowed sources: ${INTEGRATION_SOURCES.join(', ')}.` },
        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 20, default: 20 } },
        { name: 'details', in: 'query', schema: { type: 'boolean', default: false }, description: 'Requires listings:details. Enrich within a bounded time budget.' },
        { name: 'category', in: 'query', schema: { enum: ['any', 'full_fur_coat'], default: 'any' }, description: 'Optional specialized filter. Leave any for general product searches.' },
        { name: 'material', in: 'query', schema: { enum: ['any', 'natural', 'synthetic', 'unknown'], default: 'any' }, description: 'Optional fur-material seller-claim filter.' }
      ], responses: { '200': response('Complete or partial results. Inspect partial and source errors.', { $ref: '#/components/schemas/SearchResponse' }), '502': response('Every source failed. No successful cache entry is written.', { $ref: '#/components/schemas/SearchResponse' }),
        ...Object.fromEntries([[400,'Invalid query or parameters'],[401,'Invalid, expired or revoked key'],[403,'Missing scope'],[404,'API not enabled'],[429,'Quota exhausted or busy; honor Retry-After'],[503,'Authentication or storage unavailable']].map(([code, description]) => [code, { ...response(description, { $ref: '#/components/schemas/Error' }), ...(code === 429 ? { headers: { 'Retry-After': { schema: { type: 'integer' }, description: 'Seconds until retry.' } } } : {}) }]))
      } } },
    '/api/v1/demo': { get: { operationId: 'getDemo', summary: 'Try the response format without a key', security: [], responses: { '200': response('Simulated sample. No source requests.', { $ref: '#/components/schemas/SearchResponse' }) } } },
    '/api/v1/sources': { get: { operationId: 'listSources', summary: 'List supported API sources', security: [], responses: { '200': response('Current API source allowlist, not a guarantee of uptime.', { type: 'object', properties: { apiVersion: { const: '1' }, sources: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } } } } }) } } }
  },
  components: { securitySchemes: { ApiKey: { type: 'http', scheme: 'bearer', bearerFormat: 'lg_test_… or lg_live_…', description: 'Send the API key from your server. Never use a personal session or admin key.' } },
    schemas: { Listing: item, SearchResponse: envelope, Error: { type: 'object', required: ['apiVersion', 'error'], properties: { apiVersion: { const: '1' }, error: { type: 'object', required: ['code'], properties: { code: { type: 'string' } } } } } }
  }
};
export function handleApiReference(request) {
  if (request.method !== 'GET') return Response.json({ error: { code: 'method_not_allowed' } }, { status: 405, headers: { allow: 'GET' } });
  const path = new URL(request.url).pathname;
  const data = path.endsWith('/openapi.json') ? OPENAPI : path.endsWith('/sources') ? { apiVersion: '1', sources: INTEGRATION_SOURCES.map(id => ({ id, name: ({ 'olx.ro': 'OLX', 'publi24.ro': 'Publi24', 'okazii.ro': 'Okazii' })[id] })) } : buildSandboxSearch();
  return Response.json(data, { headers: { 'cache-control': 'public, max-age=60' } });
}
