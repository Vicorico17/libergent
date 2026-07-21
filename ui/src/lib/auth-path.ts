export function getSafeNextPath(search = "", fallback = "/") {
  const next = new URLSearchParams(search).get("next") || fallback;
  return next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : fallback;
}

export function buildAuthPath(pathname: string, next: string) {
  return `${pathname}?next=${encodeURIComponent(next)}`;
}
