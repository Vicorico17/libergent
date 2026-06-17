export const SEARCH_PROVIDERS = ["auto", "direct", "firecrawl", "cloudflare"];
export const REMOTE_PROVIDER_FALLBACK_ORDER = ["cloudflare", "firecrawl"];

const PROVIDER_CREDENTIAL_KEYS = {
  firecrawl: ["FIRECRAWL_API_KEY"],
  cloudflare: ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"]
};

export function normalizeSearchProvider(provider = "auto") {
  const normalized = String(provider || "auto").trim().toLowerCase();
  if (!SEARCH_PROVIDERS.includes(normalized)) {
    throw new Error(`Unsupported provider "${provider}". Supported providers: ${SEARCH_PROVIDERS.join(", ")}`);
  }

  return normalized;
}

export function getProviderCredentialKeys(provider) {
  return PROVIDER_CREDENTIAL_KEYS[provider] || [];
}

export function isProviderConfigured(provider, env = globalThis.process?.env || {}) {
  const requiredKeys = getProviderCredentialKeys(provider);
  return requiredKeys.length === 0 || requiredKeys.every((key) => Boolean(env[key]));
}
