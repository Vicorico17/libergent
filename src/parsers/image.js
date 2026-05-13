function getAttribute(tag, name) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  return decodeHtmlEntities(match?.[1] || "");
}

function decodeHtmlEntities(value = "") {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function parseSrcset(value = "") {
  const candidates = value
    .split(",")
    .map((entry) => {
      const [url = "", descriptor = ""] = entry.trim().split(/\s+/);
      const width = Number.parseInt(descriptor.replace(/[^\d]/g, ""), 10);
      return {
        url,
        score: Number.isFinite(width) ? width : 0
      };
    })
    .filter((candidate) => candidate.url);

  const bestCandidate = candidates
    .sort((a, b) => b.score - a.score)[0];
  return bestCandidate?.url || "";
}

function isUsableImageUrl(value = "") {
  return Boolean(value) && !/^data:/i.test(value);
}

export function extractImageCandidate(htmlChunk = "") {
  const imgTag = htmlChunk.match(/<img\b[\s\S]*?>/i)?.[0] || "";
  if (!imgTag) {
    return "";
  }

  const directCandidateAttributes = [
    "data-lazy",
    "data-src",
    "data-original",
    "data-lazy-src",
    "src",
    "data-srcset",
    "srcset"
  ];

  for (const attribute of directCandidateAttributes) {
    const value = getAttribute(imgTag, attribute).trim();
    if (!value) {
      continue;
    }
    if (attribute === "srcset" || attribute === "data-srcset") {
      const fromSrcset = parseSrcset(value);
      if (isUsableImageUrl(fromSrcset)) {
        return fromSrcset;
      }
      continue;
    }
    if (isUsableImageUrl(value)) {
      return value;
    }
  }

  return "";
}
