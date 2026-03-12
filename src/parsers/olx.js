function cleanText(value = "") {
  return value
    .replace(/\r/g, "")
    .replace(/\n{2,}/g, "\n\n")
    .trim();
}

function parsePrice(line = "") {
  const match = line.match(/(\d[\d\s.]*)\s*(lei|ron|€|eur)?/i);
  return match ? `${match[1].trim()} ${match[2] || ""}`.trim() : line.trim();
}

function parseTotalResults(markdown) {
  const match = markdown.match(/Am găsit\s+([\d. ]+)\s+rezultate/i);
  if (!match) {
    return null;
  }

  const value = Number.parseInt(match[1].replace(/[^\d]/g, ""), 10);
  return Number.isFinite(value) ? value : null;
}

export function parseOlxMarkdown(markdown, limit) {
  const normalized = cleanText(markdown);
  const blocks = normalized.split(/\n(?=\[\!\[)/g);
  const items = [];

  for (const block of blocks) {
    const titleMatch = block.match(/\[\*\*(.+?)\*\*\]\((https:\/\/www\.olx\.ro\/d\/oferta\/[^\s)]+)\)/);
    if (!titleMatch) {
      continue;
    }

    const imageMatch = block.match(/\[\!\[(.*?)\]\((https:\/\/[^)\s]+)\)\]\((https:\/\/www\.olx\.ro\/d\/oferta\/[^\s)]+)\)/);
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const title = titleMatch[1].trim();
    const url = titleMatch[2].trim();
    const titleIndex = lines.findIndex((line) => line.includes(`[**${title}**](`));
    const priceLine = titleIndex >= 0 ? lines[titleIndex + 1] || "" : "";
    const conditionLine = titleIndex >= 0 ? lines[titleIndex + 2] || "" : "";
    const locationLine = titleIndex >= 0 ? lines[titleIndex + 3] || "" : "";

    const locationSplit = locationLine.split(" - ");
    const location = locationSplit[0] || "";
    const postedAt = locationSplit.slice(1).join(" - ");

    items.push({
      title,
      price: parsePrice(priceLine),
      currency: /€|eur/i.test(priceLine) ? "EUR" : "lei",
      location,
      postedAt,
      condition: conditionLine,
      sellerType: "",
      url,
      imageUrl: imageMatch?.[2] || ""
    });

    if (items.length >= limit) {
      break;
    }
  }

  return {
    items,
    totalResults: parseTotalResults(normalized)
  };
}
