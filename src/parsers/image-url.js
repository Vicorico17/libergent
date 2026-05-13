function readAttribute(tag = "", name = "") {
  const match = tag.match(new RegExp(`${name}="([^"]+)"`, "i"));
  return match?.[1]?.trim() || "";
}

function pickFromSrcset(srcset = "") {
  const candidate = srcset
    .split(",")
    .map((value) => value.trim().split(/\s+/)[0] || "")
    .find(Boolean);
  return candidate || "";
}

function isUsable(url = "") {
  return Boolean(url) && !/^data:/i.test(url);
}

export function extractImageUrlFromHtmlBlock(block = "") {
  const imgTag = block.match(/<img\b[^>]*>/i)?.[0] || "";
  if (!imgTag) {
    return "";
  }

  const candidates = [
    pickFromSrcset(readAttribute(imgTag, "srcset")),
    pickFromSrcset(readAttribute(imgTag, "data-srcset")),
    readAttribute(imgTag, "src"),
    readAttribute(imgTag, "data-src"),
    readAttribute(imgTag, "data-original"),
    readAttribute(imgTag, "data-lazy-src"),
    readAttribute(imgTag, "data-lazy")
  ];

  return candidates.find(isUsable) || "";
}
