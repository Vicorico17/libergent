export { getSafeNextPath } from "./auth-flow.mjs";

export function buildAuthPath(pathname: string, next: string) {
  return `${pathname}?next=${encodeURIComponent(next)}`;
}
