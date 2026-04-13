function cleanText(value = "") {
  return value
    .replace(/\s+/g, " ")
    .trim();
}

function extractNextData(html) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error("Lajumate page did not contain __NEXT_DATA__.");
  }

  return JSON.parse(match[1]);
}

function findAdField(ad, fieldName) {
  return ad.ad_fields?.find((field) => field.name === fieldName)?.value || "";
}

function buildListingUrl(ad) {
  return `https://lajumate.ro/ad/${ad.slug}-${ad.id}`;
}

function buildImageUrl(ad) {
  const path = ad.mainImage?.path || ad.images?.[0]?.path;
  return path ? `https://api-preprod.lajumate.ro/storage/${path}` : "";
}

export function parseLajumateHtml(html, limit) {
  const data = extractNextData(html);
  const ads = data?.props?.pageProps?.adsServer;

  if (!Array.isArray(ads)) {
    throw new Error("Lajumate page did not contain adsServer listings.");
  }

  const totalResults = Number.parseInt(data?.props?.pageProps?.paginationServer?.total, 10) || ads.length;

  const items = ads.slice(0, limit).map((ad) => ({
    title: cleanText(ad.title || ""),
    price: ad.price ? `${cleanText(String(ad.price))} ${ad.currency || ""}`.trim() : "",
    currency: ad.currency || "",
    location: cleanText(ad.city?.name || ""),
    postedAt: cleanText(ad.listed_at || ad.approved_at || ""),
    condition: cleanText(findAdField(ad, "condition")),
    sellerType: cleanText(findAdField(ad, "person_type")),
    url: buildListingUrl(ad),
    imageUrl: buildImageUrl(ad)
  }));

  return {
    items,
    totalResults,
    rawItemCount: ads.length,
    hasNextPage: totalResults > ads.length
  };
}
