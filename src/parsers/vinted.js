function cleanText(value = "") {
  return value
    .replace(/\r/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTitle(label = "") {
  const normalized = cleanText(label);
  const markers = [", brand:", ", stare:", ", mărime:", ", marime:"];
  const cutIndex = markers
    .map((marker) => normalized.indexOf(marker))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  return cutIndex >= 0 ? normalized.slice(0, cutIndex).trim() : normalized;
}

function parseCondition(label = "", fallback = "") {
  const fromLabel = label.match(/stare:\s*([^,]+)/i)?.[1];
  if (fromLabel) {
    return cleanText(fromLabel);
  }

  if (fallback.includes("·")) {
    return cleanText(fallback.split("·").pop());
  }

  return cleanText(fallback);
}

export function parseVintedMarkdown(markdown, limit) {
  const normalized = markdown.replace(/\r/g, "");
  const startIndex = normalized.indexOf("Rezultate căutare");
  const relevant = startIndex >= 0 ? normalized.slice(startIndex) : normalized;
  const lines = relevant.split("\n").map((line) => line.trim()).filter(Boolean);
  const items = [];

  for (let index = 0; index < lines.length; index += 1) {
    const imageMatch = lines[index].match(/^!\[(.*?)\]\((https:\/\/images[^)\s]+)\)$/);
    const linkLine = imageMatch ? lines[index + 1] : lines[index];
    const linkMatch = linkLine?.match(/^\[(.+?)\]\((https:\/\/www\.vinted\.ro\/items\/[^\s)]+)(?:\s+"[^"]*")?\)$/);

    if (!linkMatch) {
      continue;
    }

    const rawLabel = cleanText(linkMatch[1]);
    const url = cleanText(linkMatch[2]);
    const imageUrl = imageMatch?.[2] || "";
    const metadata = [];
    let cursor = (imageMatch ? index + 2 : index + 1);

    while (cursor < lines.length && !lines[cursor].startsWith("![") && !lines[cursor].startsWith("[") && metadata.length < 5) {
      metadata.push(lines[cursor]);
      cursor += 1;
    }

    const price = metadata.find((line) => /\bRON\b/i.test(line) && !/incl\./i.test(line));
    if (!price) {
      index = cursor - 1;
      continue;
    }

    items.push({
      title: parseTitle(rawLabel),
      price: cleanText(price),
      currency: "RON",
      location: "",
      postedAt: "",
      condition: parseCondition(rawLabel, metadata[1] || metadata[0] || ""),
      sellerType: "",
      url,
      imageUrl
    });

    if (items.length >= limit) {
      break;
    }

    index = cursor - 1;
  }

  return {
    items,
    totalResults: Number.parseInt(relevant.match(/([\d.+]+)\s+de rezultate/i)?.[1]?.replace(/[^\d]/g, ""), 10) || null
  };
}
