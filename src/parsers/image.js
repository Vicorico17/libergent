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
    "data-srcset",
    "srcset",
    "src"
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
