function attribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] || "";
}

// Only forward links count. Previous/current-page URLs are not next-page evidence.
export function hasForwardPage(html, url = "") {
  const currentUrl = new URL(url || "https://pagination.invalid/");
  const selectedPage = html.match(/aria-current=["']page["'][^>]*>\s*(\d+)/i)?.[1];
  const current = Number(currentUrl.searchParams.get("page") || currentUrl.searchParams.get("pag") || selectedPage || 1);
  const content = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  const stack = [];
  const voidTags = new Set(["link", "meta", "img", "input", "br", "hr", "source", "area", "wbr"]);
  for (const match of content.matchAll(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi)) {
    const tag = match[0];
    const name = match[1].toLowerCase();
    if (tag.startsWith("</")) {
      const index = stack.findLastIndex(entry => entry.name === name);
      if (index >= 0) stack.splice(index);
      continue;
    }
    const disabled = stack.some(entry => entry.disabled) || /\sdisabled(?:\s|=|>)/i.test(tag) ||
      attribute(tag, "aria-disabled") === "true" || /(?:^|\s)disabled(?:\s|$)/i.test(attribute(tag, "class"));
    if (["a", "link", "button"].includes(name) && !disabled) {
      const rel = attribute(tag, "rel").split(/\s+/);
      const label = attribute(tag, "aria-label");
      const forward = rel.includes("next") || /^(?:next|pagina urmatoare|pagina următoare)$/i.test(label) || attribute(tag, "data-testid") === "pagination-forward";
      const href = attribute(tag, "href").replace(/&amp;|&#38;/gi, "&");
      if (href && !/^(?:#|javascript:)/i.test(href)) {
        try {
          const target = new URL(href, currentUrl);
          if (url && target.origin !== currentUrl.origin) continue;
          const page = Number(target.searchParams.get("page") || target.searchParams.get("pag"));
          if (page > 0) {
            if (page > current && (forward || !url || target.pathname === currentUrl.pathname)) return true;
          } else if (forward && target.href !== currentUrl.href) return true;
        } catch { /* An invalid link is not pagination evidence. */ }
      } else if (name === "button" && forward) return true;
    }
    if (!voidTags.has(name) && !tag.endsWith("/>")) stack.push({ name, disabled });
  }
  return false;
}
