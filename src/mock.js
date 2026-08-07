import { getSite } from "./sites.js";
import { understandMarketplaceQuery } from "./query-understanding.js";

function toSlug(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildMockItems(siteKey, query, condition) {
  const slug = toSlug(query || "produs");
  const baseTitle = query.trim() || "Produs";
  const queryUnderstanding = understandMarketplaceQuery(query);
  const isCarQuery = queryUnderstanding.category === "vehicle";
  const conditionLabel =
    condition === "new" ? "Nou" :
    condition === "used" ? "Utilizat" :
    "Utilizat";

  if (isCarQuery) {
    const vehicleName = queryUnderstanding.canonicalQuery || baseTitle;
    return [
      {
        title: `${vehicleName} 2.0 GT 2019`,
        price: siteKey === "autovit.ro" ? "27 500 EUR" : "137 500 lei",
        currency: siteKey === "autovit.ro" ? "EUR" : "lei",
        location: "Cluj-Napoca",
        postedAt: "azi",
        condition: "79 000 km • Benzina • 2019",
        sellerType: "Persoana fizica",
        url: `https://${siteKey}/d/oferta/${slug}-1`,
        imageUrl: ""
      },
      {
        title: `Bara fata ${vehicleName}`,
        price: "600 lei",
        currency: "lei",
        location: "Bucuresti",
        postedAt: "azi",
        condition: "Utilizat",
        sellerType: "Persoana fizica",
        url: `https://${siteKey}/d/oferta/${slug}-part-1`,
        imageUrl: ""
      },
      {
        title: `Far dreapta ${vehicleName}`,
        price: "450 lei",
        currency: "lei",
        location: "Timisoara",
        postedAt: "ieri",
        condition: "Utilizat",
        sellerType: "Persoana fizica",
        url: `https://${siteKey}/d/oferta/${slug}-part-2`,
        imageUrl: ""
      }
    ];
  }

  return [
    {
      title: `${baseTitle} 128GB`,
      price: "2 950 lei",
      currency: "lei",
      location: "Bucuresti",
      postedAt: "azi",
      condition: conditionLabel,
      sellerType: "Persoana fizica",
      url: `https://${siteKey}/d/oferta/${slug}-1`,
      imageUrl: ""
    },
    {
      title: `${baseTitle} impecabil`,
      price: "3 150 lei",
      currency: "lei",
      location: "Cluj-Napoca",
      postedAt: "ieri",
      condition: condition === "new" ? "Nou" : "Utilizat",
      sellerType: "Persoana fizica",
      url: `https://${siteKey}/d/oferta/${slug}-2`,
      imageUrl: ""
    },
    {
      title: `${baseTitle} complet cu accesorii`,
      price: "3 400 lei",
      currency: "lei",
      location: "Timisoara",
      postedAt: "reactualizat",
      condition: condition === "used" ? "Folosit" : conditionLabel,
      sellerType: "Magazin",
      url: `https://${siteKey}/d/oferta/${slug}-3`,
      imageUrl: ""
    }
  ];
}

export function buildMockSearchResult({ siteKey, query, condition = "any", provider = "mock" }) {
  const site = getSite(siteKey);
  const items = buildMockItems(siteKey, query, condition);

  return {
    ok: true,
    provider,
    strategy: "mock-local",
    site: site.key,
    url: site.searchUrl(query),
    query,
    itemCount: items.length,
    items,
    totalResults: items.length,
    pagesUsed: 1,
    creditsUsed: 0
  };
}
