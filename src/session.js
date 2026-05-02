export const AUTH_COOKIE_NAME = "libergent-auth";
export const FREE_SEARCH_COOKIE_NAME = "libergent-free-search";
export const SIGN_IN_BONUS_LEI = 10;
export const NO_MORE_FREE_CREDITS_ERROR = "NO_MORE_FREE_CREDITS";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function parseCookieHeader(header = "") {
  return header
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex === -1) {
        return cookies;
      }

      const name = part.slice(0, separatorIndex).trim();
      const rawValue = part.slice(separatorIndex + 1);

      if (!name) {
        return cookies;
      }

      try {
        cookies[name] = decodeURIComponent(rawValue);
      } catch {
        cookies[name] = rawValue;
      }

      return cookies;
    }, {});
}

export function serializeCookie(name, value, options = {}) {
  const attributes = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge != null) {
    attributes.push(`Max-Age=${Math.max(0, options.maxAge)}`);
  }

  if (options.path) {
    attributes.push(`Path=${options.path}`);
  }

  if (options.sameSite) {
    attributes.push(`SameSite=${options.sameSite}`);
  }

  if (options.httpOnly) {
    attributes.push("HttpOnly");
  }

  return attributes.join("; ");
}

export function normalizeSearchQuery(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function isSignedIn(cookies = {}) {
  return cookies[AUTH_COOKIE_NAME] === "member";
}

export function getFreeSearchQuery(cookies = {}) {
  return String(cookies[FREE_SEARCH_COOKIE_NAME] || "").trim();
}

export function canSearchForFree(cookies = {}, query = "") {
  if (isSignedIn(cookies)) {
    return true;
  }

  const storedQuery = getFreeSearchQuery(cookies);
  if (!storedQuery) {
    return true;
  }

  return normalizeSearchQuery(storedQuery) === normalizeSearchQuery(query);
}

export function buildSessionPayload(cookies = {}) {
  const signedIn = isSignedIn(cookies);
  const freeSearchQuery = getFreeSearchQuery(cookies);

  return {
    signedIn,
    credits: {
      availableLei: signedIn ? SIGN_IN_BONUS_LEI : 0,
      signInBonusLei: SIGN_IN_BONUS_LEI
    },
    guest: {
      freeSearchUsed: Boolean(freeSearchQuery),
      freeSearchQuery: freeSearchQuery || null,
      remainingFreeSearches: freeSearchQuery ? 0 : 1
    }
  };
}

export function buildFreeSearchCookie(query) {
  return serializeCookie(FREE_SEARCH_COOKIE_NAME, query.trim(), {
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "Lax",
    httpOnly: true
  });
}

export function buildSignInCookies() {
  return [
    serializeCookie(AUTH_COOKIE_NAME, "member", {
      maxAge: COOKIE_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "Lax",
      httpOnly: true
    }),
    serializeCookie(FREE_SEARCH_COOKIE_NAME, "", {
      maxAge: 0,
      path: "/",
      sameSite: "Lax",
      httpOnly: true
    })
  ];
}

export function buildNoMoreCreditsPayload(cookies = {}) {
  return {
    error: "No more credits. Sign in to get 10 lei in credits.",
    code: NO_MORE_FREE_CREDITS_ERROR,
    ...buildSessionPayload(cookies)
  };
}
