const LOCAL_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^fc/i,
  /^fd/i
];

function clean(value = "") {
  return String(value || "").trim();
}

function normalizeHeaderMap(headers = {}) {
  const map = new Map();

  if (headers && typeof headers.get === "function") {
    for (const [key, value] of headers.entries()) {
      map.set(key.toLowerCase(), clean(value));
    }
    return map;
  }

  for (const [key, value] of Object.entries(headers || {})) {
    map.set(String(key).toLowerCase(), clean(Array.isArray(value) ? value[0] : value));
  }

  return map;
}

function firstHeaderValue(headerMap, headerNames) {
  for (const name of headerNames) {
    const value = clean(headerMap.get(name));
    if (value) {
      return value;
    }
  }
  return "";
}

function extractClientIp(headerMap) {
  const directIp = firstHeaderValue(headerMap, ["cf-connecting-ip", "x-real-ip", "true-client-ip"]);
  if (directIp) {
    return directIp;
  }

  const forwardedFor = firstHeaderValue(headerMap, ["x-forwarded-for"]);
  if (!forwardedFor) {
    return "";
  }

  return clean(forwardedFor.split(",")[0]);
}

function isLocalIp(ip) {
  if (!ip) {
    return true;
  }

  return LOCAL_IP_PATTERNS.some((pattern) => pattern.test(ip));
}

async function lookupCityByIp(ip, fetchFn = globalThis.fetch) {
  if (!ip || isLocalIp(ip) || typeof fetchFn !== "function") {
    return "";
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetchFn(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      headers: {
        "accept": "application/json"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      return "";
    }

    const payload = await response.json();
    return clean(payload?.city);
  } catch {
    return "";
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function resolveRequesterLocation({
  explicitLocation = "",
  headers = {},
  fetchFn = globalThis.fetch
} = {}) {
  const providedLocation = clean(explicitLocation);
  if (providedLocation) {
    return providedLocation;
  }

  const headerMap = normalizeHeaderMap(headers);
  const edgeDerivedLocation = firstHeaderValue(headerMap, ["cf-ipcity", "x-vercel-ip-city", "x-appengine-city"]);
  if (edgeDerivedLocation) {
    return edgeDerivedLocation;
  }

  const clientIp = extractClientIp(headerMap);
  return lookupCityByIp(clientIp, fetchFn);
}

export const _private = {
  extractClientIp,
  isLocalIp,
  lookupCityByIp,
  normalizeHeaderMap
};
