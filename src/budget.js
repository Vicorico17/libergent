const DEFAULT_MULTIPLIER = 1;

const BASE_PRICING = {
  scrapePerPage: 1,
  crawlPerPage: 1,
  searchPerTenResults: 2,
  browserPerMinute: 2,
  jsonAddonPerPage: 4,
  enhancedAddonPerPage: 4
};

const SITE_PAGE_YIELDS = [
  {
    site: "vinted.ro",
    itemsPerPage: 96,
    note: "Rendered catalog page currently exposes about 96 items.",
    recommended: {
      method: "Firecrawl scrape + markdown + local parser",
      firecrawlCreditsPerPage: 1,
      why: "Highest yield per paid page. Current catalog feed exposes about 96 items on page 1.",
      avoid: "Avoid JSON extraction and browser sessions unless markup quality drops."
    }
  },
  {
    site: "olx.ro",
    itemsPerPage: 51,
    note: "First-page listing cards deduped from duplicated markup.",
    recommended: {
      method: "Firecrawl scrape + markdown + local parser",
      firecrawlCreditsPerPage: 1,
      why: "Good paid-page efficiency and stable search URLs. Better to parse locally than pay JSON costs.",
      avoid: "Avoid search credits and JSON extraction for normal result pages."
    }
  },
  {
    site: "lajumate.ro",
    itemsPerPage: 27,
    note: "SSR payload currently exposes about 27 ads on page 1.",
    recommended: {
      method: "Direct HTML fetch + __NEXT_DATA__ parsing",
      firecrawlCreditsPerPage: 0,
      why: "Current SSR payload is accessible directly, so Firecrawl credits are unnecessary for normal search pages.",
      avoid: "Avoid paid scrape unless direct fetch starts failing."
    }
  },
  {
    site: "okazii.ro",
    itemsPerPage: 10,
    note: "Embedded JSON-LD currently exposes about 10 structured offers.",
    recommended: {
      method: "Direct HTML fetch + JSON-LD/local parsing",
      firecrawlCreditsPerPage: 0,
      why: "Direct fetch is effectively free in Firecrawl-credit terms and avoids paying for low-yield pages.",
      avoid: "Avoid JSON extraction unless you need fields unavailable in local parsing."
    }
  }
];

function roundToTwo(value) {
  return Math.round(value * 100) / 100;
}

function scalePricing(multiplier = DEFAULT_MULTIPLIER) {
  return {
    scrapePerPage: BASE_PRICING.scrapePerPage * multiplier,
    crawlPerPage: BASE_PRICING.crawlPerPage * multiplier,
    searchPerTenResults: BASE_PRICING.searchPerTenResults * multiplier,
    browserPerMinute: BASE_PRICING.browserPerMinute * multiplier,
    jsonAddonPerPage: BASE_PRICING.jsonAddonPerPage * multiplier,
    enhancedAddonPerPage: BASE_PRICING.enhancedAddonPerPage * multiplier
  };
}

function buildSiteRows(pricing) {
  const basicPageCost = pricing.scrapePerPage;
  const jsonPageCost = pricing.scrapePerPage + pricing.jsonAddonPerPage;

  return SITE_PAGE_YIELDS.map((site) => ({
    ...site,
    basicPageCost,
    jsonPageCost,
    basicCostPerItem: roundToTwo(basicPageCost / site.itemsPerPage),
    jsonCostPerItem: roundToTwo(jsonPageCost / site.itemsPerPage),
    recommendedCostPerPage: site.recommended.firecrawlCreditsPerPage,
    recommendedCostPerItem: roundToTwo(site.recommended.firecrawlCreditsPerPage / site.itemsPerPage)
  }));
}

function buildBudgetExamples(rows) {
  return [100].map((budget) => ({
    budget,
    rows: rows.map((row) => ({
      site: row.site,
      basicItems: Math.floor(budget / row.basicPageCost) * row.itemsPerPage,
      jsonItems: Math.floor(budget / row.jsonPageCost) * row.itemsPerPage,
      recommendedItems: row.recommendedCostPerPage > 0
        ? Math.floor(budget / row.recommendedCostPerPage) * row.itemsPerPage
        : "not credit-bound"
    }))
  }));
}

function findMostCostlyMarketplace(rows) {
  return rows.reduce((mostCostly, row) => {
    if (!mostCostly) {
      return row;
    }

    if (row.jsonCostPerItem > mostCostly.jsonCostPerItem) {
      return row;
    }

    if (row.jsonCostPerItem === mostCostly.jsonCostPerItem && row.basicCostPerItem > mostCostly.basicCostPerItem) {
      return row;
    }

    return mostCostly;
  }, null);
}

function buildRecommendationSummary(rows) {
  const cheapestPaid = rows
    .filter((row) => row.recommendedCostPerPage > 0)
    .sort((a, b) => a.recommendedCostPerItem - b.recommendedCostPerItem)[0];

  return {
    cheapestPaidMarketplace: cheapestPaid?.site || null,
    cheapestPaidCostPerItem: cheapestPaid?.recommendedCostPerItem ?? null,
    zeroCreditSites: rows
      .filter((row) => row.recommendedCostPerPage === 0)
      .map((row) => row.site)
  };
}

export function buildBudgetPayload(multiplier = DEFAULT_MULTIPLIER) {
  const pricing = scalePricing(multiplier);
  const siteRows = buildSiteRows(pricing);
  const mostCostly = findMostCostlyMarketplace(siteRows);

  return {
    multiplier,
    pricing,
    siteRows,
    mostCostly,
    recommendationSummary: buildRecommendationSummary(siteRows),
    examples: buildBudgetExamples(siteRows),
    updatedAt: "2026-03-13",
    assumptions: [
      "Official Firecrawl pricing modeled at current published rates: scrape 1/page, crawl 1/page, search 2/10 results, browser 2/minute, JSON +4/page.",
      "Site yields reflect live first-page observations for the query 'bicicleta' on March 13, 2026.",
      "Recommended strategy favors direct local parsing where the page already exposes structured data."
    ]
  };
}
