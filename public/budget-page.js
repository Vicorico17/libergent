const budgetStatusEl = document.getElementById("budgetStatus");
const budgetTablesEl = document.getElementById("budgetTables");
const pricingContentEl = document.getElementById("pricingContent");
const workflowGridEl = document.getElementById("workflowGrid");
const strategyGridEl = document.getElementById("strategyGrid");

const WORKFLOWS = [
  {
    step: "01",
    title: "Search Intake",
    eyebrow: "input simplu",
    description: "Utilizatorul introduce doar produsul și starea. Restul deciziilor rămân interne.",
    bullets: [
      "web form + local restore din ultimul search",
      "un singur request către /api/search",
      "provider și marketplace routing ascunse în backend"
    ]
  },
  {
    step: "02",
    title: "Marketplace Extraction",
    eyebrow: "orchestrare",
    description: "libergent alege strategia potrivită per site: scrape, parsing local sau fallback dedicat.",
    bullets: [
      "URL de căutare construit per marketplace",
      "dedupe și parsing local unde randamentul este mai bun",
      "evită JSON/browser acolo unde nu adaugă valoare"
    ]
  },
  {
    step: "03",
    title: "Offer Scoring",
    eyebrow: "calitate peste preț brut",
    description: "Rezultatele sunt clasate pentru a evita oferte ieftine dar inutile, defecte sau irelevante.",
    bullets: [
      "best offer global și per marketplace",
      "medie de preț și volum de anunțuri",
      "penalizări pentru junk listings și outliers"
    ]
  }
];

const SAAS_PLANS = [
  {
    name: "Starter",
    price: 49,
    badge: "solo",
    users: "1 utilizator",
    units: "2.500 unități / lună",
    audience: "pentru reselleri individuali",
    features: [
      "căutări standard pe marketplace-uri",
      "alerte și căutări salvate",
      "potrivit pentru volum mic"
    ]
  },
  {
    name: "Pro",
    price: 99,
    badge: "default",
    users: "3 utilizatori",
    units: "7.500 unități / lună",
    audience: "pentru magazine mici și operatori activi",
    features: [
      "planul recomandat",
      "export și refresh mai des",
      "marjă bună pe vinted.ro și olx.ro"
    ]
  },
  {
    name: "Business",
    price: 249,
    badge: "scale",
    users: "10 utilizatori",
    units: "20.000 unități / lună",
    audience: "pentru echipe, agenții și volume mai mari",
    features: [
      "API și acces prioritar",
      "suport premium",
      "potrivit pentru conturi cu usage mixt"
    ]
  }
];

const REVENUE_MIX = [
  { plan: "Starter", customers: 30, revenue: 1470 },
  { plan: "Pro", customers: 55, revenue: 5445 },
  { plan: "Business", customers: 15, revenue: 3735 }
];

const UNIT_WEIGHTS = [
  { label: "vinted.ro scrape local", weight: "1 unitate" },
  { label: "olx.ro scrape local", weight: "2 unități" },
  { label: "lajumate.ro direct", weight: "1 unitate" },
  { label: "okazii.ro direct", weight: "1 unitate" },
  { label: "JSON extraction", weight: "+4 unități" },
  { label: "browser minute", weight: "+2 unități" }
];

function escapeHtml(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatCredits(value) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2
  }).format(value);
}

function formatEuro(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(value);
}

function renderWorkflowSection() {
  workflowGridEl.innerHTML = WORKFLOWS.map((workflow) => `
    <article class="workflow-card">
      <p class="workflow-step">${escapeHtml(workflow.step)}</p>
      <p class="workflow-eyebrow">${escapeHtml(workflow.eyebrow)}</p>
      <h3>${escapeHtml(workflow.title)}</h3>
      <p class="muted">${escapeHtml(workflow.description)}</p>
      <ul class="workflow-list">
        ${workflow.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}
      </ul>
    </article>
  `).join("");
}

function renderSiteStrategies(siteRows) {
  strategyGridEl.innerHTML = siteRows.map((row) => `
    <article class="strategy-card">
      <div class="strategy-card__top">
        <div>
          <p class="metric-label">Marketplace</p>
          <h3>${escapeHtml(row.site)}</h3>
        </div>
        <span class="strategy-pill">${row.recommendedCostPerPage === 0 ? "zero credits" : `${formatCredits(row.recommendedCostPerPage)} cred/page`}</span>
      </div>
      <p class="strategy-method">${escapeHtml(row.recommended.method)}</p>
      <p class="muted">${escapeHtml(row.recommended.why)}</p>
      <div class="strategy-metrics">
        <div>
          <p class="metric-label">Yield</p>
          <p class="strategy-value">${row.itemsPerPage}</p>
        </div>
        <div>
          <p class="metric-label">Cost / item</p>
          <p class="strategy-value">${formatCredits(row.recommendedCostPerItem)}</p>
        </div>
      </div>
      <p class="strategy-note">${escapeHtml(row.recommended.avoid)}</p>
    </article>
  `).join("");
}

function renderBudgetTable(headers, rows) {
  const headMarkup = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const bodyMarkup = rows
    .map((row) => `
      <tr>
        ${row.map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join("")}
      </tr>
    `)
    .join("");

  return `
    <div class="table-wrap">
      <table class="budget-table">
        <thead><tr>${headMarkup}</tr></thead>
        <tbody>${bodyMarkup}</tbody>
      </table>
    </div>
  `;
}

function renderCostGraph(rows, key, maxValue) {
  return rows
    .map((row) => {
      const value = row[key];
      const width = maxValue > 0 ? Math.max(8, Math.round((value / maxValue) * 100)) : 0;

      return `
        <div class="graph-row">
          <div class="graph-labels">
            <span class="graph-site">${escapeHtml(row.site)}</span>
            <span class="graph-value">${formatCredits(value)} credite/item</span>
          </div>
          <div class="graph-track" aria-hidden="true">
            <div class="graph-bar" style="width:${width}%"></div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderBudget(payload) {
  const pricingRows = [
    ["Scrape / pagină", `${formatCredits(payload.pricing.scrapePerPage)} credite`],
    ["Crawl / pagină", `${formatCredits(payload.pricing.crawlPerPage)} credite`],
    ["Search / 10 rezultate", `${formatCredits(payload.pricing.searchPerTenResults)} credite`],
    ["Browser / minut", `${formatCredits(payload.pricing.browserPerMinute)} credite`],
    ["JSON add-on / pagină", `+${formatCredits(payload.pricing.jsonAddonPerPage)} credite`],
    ["Enhanced add-on / pagină", `+${formatCredits(payload.pricing.enhancedAddonPerPage)} credite`]
  ];

  const siteRows = payload.siteRows.map((row) => [
    row.site,
    row.itemsPerPage,
    row.basicPageCost,
    row.basicCostPerItem,
    row.jsonPageCost,
    row.jsonCostPerItem
  ]);

  const recommendedRows = payload.siteRows.map((row) => [
    row.site,
    row.recommended.method,
    row.recommendedCostPerPage,
    row.recommendedCostPerItem,
    row.recommended.avoid
  ]);

  const exampleRows = payload.examples[0].rows.map((row) => [
    row.site,
    `~${row.basicItems} iteme`,
    `~${row.jsonItems} iteme`,
    typeof row.recommendedItems === "number" ? `~${row.recommendedItems} iteme` : "nelimitat de credite"
  ]);

  const assumptionsMarkup = payload.assumptions
    .map((assumption) => `<li>${escapeHtml(assumption)}</li>`)
    .join("");
  const sortedByCost = [...payload.siteRows].sort((a, b) => b.jsonCostPerItem - a.jsonCostPerItem);
  const graphMax = sortedByCost[0]?.jsonCostPerItem || 0;
  const mostCostly = payload.mostCostly;
  const summary = payload.recommendationSummary;

  renderSiteStrategies(payload.siteRows);

  budgetTablesEl.innerHTML = `
    <article class="budget-card budget-card--accent">
      <h3>Cel mai costisitor marketplace</h3>
      <p class="budget-highlight-site">${escapeHtml(mostCostly.site)}</p>
      <p class="budget-highlight-copy">
        ${escapeHtml(mostCostly.site)} este cel mai scump de extras pe item la modelul actual:
        ${formatCredits(mostCostly.basicCostPerItem)} credite/item cu scrape simplu și
        ${formatCredits(mostCostly.jsonCostPerItem)} credite/item cu JSON.
      </p>
      <p class="muted">${escapeHtml(mostCostly.note)}</p>
    </article>
    <article class="budget-card">
      <h3>Cele mai bune alegeri per site</h3>
      <p class="muted">
        Cele mai ieftine surse plătite sunt ${escapeHtml(summary.cheapestPaidMarketplace || "n/a")}
        la aproximativ ${summary.cheapestPaidCostPerItem != null ? `${formatCredits(summary.cheapestPaidCostPerItem)} credite/item` : "n/a"}.
        Site-urile fără cost Firecrawl în strategia recomandată: ${escapeHtml(summary.zeroCreditSites.join(", "))}.
      </p>
    </article>
    <article class="budget-card budget-card--wide">
      <h3>Grafic cost per item</h3>
      <p class="muted">Comparație după costul cu JSON extraction la prețul real actual.</p>
      <div class="budget-graph">
        ${renderCostGraph(sortedByCost, "jsonCostPerItem", graphMax)}
      </div>
    </article>
    <article class="budget-card">
      <h3>Tarife efective</h3>
      ${renderBudgetTable(["Metrică", "Cost"], pricingRows)}
    </article>
    <article class="budget-card">
      <h3>Randament per site</h3>
      ${renderBudgetTable(
        ["Site", "Iteme / pagină", "Cost bază", "Cost / item", "Cost JSON", "Cost JSON / item"],
        siteRows
      )}
    </article>
    <article class="budget-card">
      <h3>Strategie recomandată</h3>
      ${renderBudgetTable(
        ["Site", "Metodă", "Credite / pagină", "Credite / item", "Ce eviți"],
        recommendedRows
      )}
    </article>
    <article class="budget-card">
      <h3>Exemplu la 100 credite</h3>
      ${renderBudgetTable(["Site", "Scrape simplu", "Scrape + JSON", "Strategie recomandată"], exampleRows)}
      <ul class="budget-notes">${assumptionsMarkup}</ul>
    </article>
  `;

  budgetStatusEl.textContent = `Actualizat ${payload.updatedAt}`;
}

function renderPricingSection() {
  const totalRevenue = REVENUE_MIX.reduce((sum, row) => sum + row.revenue, 0);
  const totalCustomers = REVENUE_MIX.reduce((sum, row) => sum + row.customers, 0);

  const plansMarkup = SAAS_PLANS.map((plan) => `
    <article class="plan-card ${plan.badge === "default" ? "plan-card--featured" : ""}">
      <p class="plan-badge">${escapeHtml(plan.badge)}</p>
      <h3>${escapeHtml(plan.name)}</h3>
      <p class="plan-price">${formatEuro(plan.price)}<span>/lună</span></p>
      <p class="muted">${escapeHtml(plan.audience)}</p>
      <p class="plan-meta">${escapeHtml(plan.users)}</p>
      <p class="plan-meta">${escapeHtml(plan.units)}</p>
      <ul class="plan-features">
        ${plan.features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join("")}
      </ul>
    </article>
  `).join("");

  const weightsMarkup = UNIT_WEIGHTS.map((row) => `
    <div class="usage-row">
      <span>${escapeHtml(row.label)}</span>
      <strong>${escapeHtml(row.weight)}</strong>
    </div>
  `).join("");

  pricingContentEl.innerHTML = `
    <div class="pricing-topline">
      <div>
        <p class="metric-label">Țintă</p>
        <p class="metric-value">${formatEuro(totalRevenue)}</p>
        <p class="muted">${totalCustomers} clienți în mixul recomandat</p>
      </div>
      <div>
        <p class="metric-label">Plan Anchor</p>
        <p class="metric-value">${formatEuro(99)}</p>
        <p class="muted">Pro trebuie să fie planul default</p>
      </div>
      <div>
        <p class="metric-label">Risc de Marjă</p>
        <p class="metric-value">Okazii</p>
        <p class="muted">cel mai costisitor marketplace în modelul actual</p>
      </div>
    </div>

    <div class="plans-grid">
      ${plansMarkup}
    </div>

    <div class="pricing-grid">
      <article class="pricing-card pricing-card--wide">
        <h3>Mix recomandat pentru €10k+ MRR</h3>
        ${renderBudgetTable(["Plan", "Clienți", "Venit"], REVENUE_MIX.map((row) => [row.plan, row.customers, formatEuro(row.revenue)]))}
        <p class="pricing-total">Total: <strong>${totalCustomers} clienți</strong> • <strong>${formatEuro(totalRevenue)}</strong></p>
      </article>

      <article class="pricing-card">
        <h3>Reguli de cost intern</h3>
        <div class="usage-weights">
          ${weightsMarkup}
        </div>
      </article>

      <article class="pricing-card">
        <h3>Politică de overage</h3>
        <div class="usage-weights">
          <div class="usage-row"><span>Starter</span><strong>€15 / 1.000 unități</strong></div>
          <div class="usage-row"><span>Pro</span><strong>€12 / 1.000 unități</strong></div>
          <div class="usage-row"><span>Business</span><strong>€10 / 1.000 unități</strong></div>
        </div>
      </article>
    </div>
  `;
}

async function loadBudget() {
  try {
    const response = await fetch("/api/budget");
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Nu am putut încărca bugetul.");
    }

    renderBudget(payload);
    renderPricingSection();
    renderWorkflowSection();
  } catch (error) {
    budgetStatusEl.textContent = error instanceof Error ? error.message : String(error);
  }
}

loadBudget();
