function getAttribute(tag, name) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match?.[1] || "";
}

function parseSrcset(value = "") {
  const firstCandidate = value
    .split(",")
    .map((entry) => entry.trim().split(/\s+/)[0])
    .find(Boolean);
  return firstCandidate || "";
}

function isUsableImageUrl(value = "") {
  return Boolean(value) && !/^data:/i.test(value);
}

function normalizeCandidate(value = "") {
  const candidate = value.trim();
  if (!candidate) {
    return "";
  }

  if (/^data:/i.test(candidate)) {
    return "";
  }

  if (/^blob:/i.test(candidate)) {
    return "";
  }

  if (/placeholder|spacer|avatar|icon|logo/i.test(candidate)) {
    return "";
  }

  return candidate;
}

function extractFromTag(tag = "") {
  const directCandidateAttributes = [
    "data-lazy",
    "data-src",
    "data-original",
    "data-lazy-src",
    "data-srcset",
    "srcset",
    "src"
  ];

  for (const attribute of directCandidateAttributes) {
    const value = getAttribute(tag, attribute).trim();
    if (!value) {
      continue;
    }
    if (attribute === "srcset" || attribute === "data-srcset") {
      const fromSrcset = parseSrcset(value);
      const normalizedSrcset = normalizeCandidate(fromSrcset);
      if (isUsableImageUrl(normalizedSrcset)) {
        return normalizedSrcset;
      }
      continue;
    }
    const normalized = normalizeCandidate(value);
    if (isUsableImageUrl(normalized)) {
      return normalized;
    }
  }

  return "";
}

export function extractImageCandidate(htmlChunk = "") {
  const mediaTags = [
    ...htmlChunk.matchAll(/<img\b[\s\S]*?>/gi),
    ...htmlChunk.matchAll(/<source\b[\s\S]*?>/gi)
  ].map((match) => match[0]);

  for (const tag of mediaTags) {
    const candidate = extractFromTag(tag);
    if (candidate) {
      return candidate;
    }
  }

  return "";
}
