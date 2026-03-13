const form = document.getElementById("searchForm");
const queryInput = document.getElementById("queryInput");
const conditionInput = document.getElementById("conditionInput");
const searchButton = document.getElementById("searchButton");
const summaryEl = document.getElementById("summary");
const statusEl = document.getElementById("status");
const marketplacesEl = document.getElementById("marketplaces");
const loadingOverlay = document.getElementById("loadingOverlay");
const loadingTitle = document.getElementById("loadingTitle");
const loadingText = document.getElementById("loadingText");
const STORAGE_KEY = "libergent-last-search-v2";
const DEFAULT_SEARCH_LIMIT = 150;

function formatRon(value) {
  if (!Number.isFinite(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
    maximumFractionDigits: 0
  }).format(value);
}

function escapeHtml(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function cleanDisplayText(value = "") {
  return String(value)
    .replace(/Salvează ca favorit/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatPrice(item) {
  if (Number.isFinite(item?.priceRon)) {
    return formatRon(item.priceRon);
  }

  return item?.price || "Fără preț";
}

function formatOfferLine(item, fallbackSite = "") {
  if (!item) {
    return "Nicio ofertă validă";
  }

  const bits = [
    cleanDisplayText(item.title || "Anunț fără titlu"),
    formatPrice(item),
    cleanDisplayText(item.site || fallbackSite || ""),
    cleanDisplayText(item.condition || ""),
    cleanDisplayText(item.location || "")
  ].filter(Boolean);

  return bits.join(" | ");
}

function pickExtremeOffer(items, mode, fallbackSite = "") {
  const pricedItems = (items || [])
    .filter((item) => Number.isFinite(item?.priceRon))
    .map((item) => ({ ...item, site: item.site || fallbackSite }));

  if (!pricedItems.length) {
    return null;
  }

  return pricedItems.reduce((best, item) => {
    if (!best) {
      return item;
    }

    if (mode === "lowest") {
      return item.priceRon < best.priceRon ? item : best;
    }

    return item.priceRon > best.priceRon ? item : best;
  }, null);
}

function renderSummary(summary) {
  summaryEl.classList.remove("hidden");
  const bestOffer = summary.bestOffer;
  const recommendationLine = bestOffer ? formatOfferLine(bestOffer) : "Nu am găsit încă o ofertă validă";
  summaryEl.innerHTML = `
    <article class="report-banner ${bestOffer ? "report-banner--winner" : ""}">
      <div class="report-banner__copy">
        ${bestOffer ? '<div class="winner-mark" aria-hidden="true">♛</div>' : ""}
        <p class="eyebrow">libergent recommends</p>
        <h3>${bestOffer ? formatRon(bestOffer.priceRon) : "N/A"}</h3>
        <p class="report-banner__line">${escapeHtml(recommendationLine)}</p>
        ${bestOffer?.url ? `<a class="listing-link" href="${escapeHtml(bestOffer.url)}" target="_blank" rel="noreferrer">Deschide anunțul recomandat</a>` : ""}
      </div>
      <div class="report-banner__metrics">
        <div>
          <p class="metric-label">Preț Mediu</p>
          <p class="metric-value">${formatRon(summary.averagePriceRon)}</p>
        </div>
        <div>
          <p class="metric-label">Marketplaces</p>
          <p class="metric-value">${summary.successfulMarketplaces}/${summary.marketplaces}</p>
        </div>
        <div>
          <p class="metric-label">Listings</p>
          <p class="metric-value">${summary.totalListings}</p>
        </div>
        <div>
          <p class="metric-label">Credite</p>
          <p class="metric-value">${summary.creditsUsed ?? 0}/${summary.creditBudget ?? 0}</p>
        </div>
      </div>
      <div class="report-banner__footer">
        <span>${summary.pricedListingsRon} anunțuri cu preț</span>
        <span>Filtru: ${escapeHtml(summary.conditionLabel || "Oricare")}</span>
      </div>
    </article>
  `;
}

function renderResults(payload) {
  renderSummary(payload.summary);
  marketplacesEl.innerHTML = payload.results.map(renderSite).join("");
}

function saveLastSearch({ query, condition, payload }) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      query,
      condition,
      payload,
      savedAt: Date.now()
    })
  );
}

function loadLastSearch() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function renderSite(result) {
  if (!result.ok) {
    return `
      <article class="market-card market-card--error">
        <div class="market-card__header">
          <h2>[${escapeHtml(result.site)}]</h2>
          <span class="market-status market-status--error">error</span>
        </div>
        <p class="error">${escapeHtml(result.error)}</p>
      </article>
    `;
  }

  const bestOffer = result.bestOffer;
  const lowest = result.lowest;
  const highest = pickExtremeOffer(result.items, "highest", result.site);
  const listingCount = Number.isFinite(result.totalResults) ? `${result.itemCount} / ${result.totalResults}` : String(result.itemCount);

  const itemMarkup = result.items
    .map((item, index) => `
      <div class="item">
        <p class="item-title">${index + 1}. ${escapeHtml(formatOfferLine(item, result.site))}</p>
        ${item.url ? `<a class="listing-link" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.url)}</a>` : ""}
      </div>
    `)
    .join("");

  return `
    <details class="market-card market-card--collapsible">
      <summary class="market-summary">
        <div class="market-summary__top">
          <div class="market-card__header">
            <h2>[${escapeHtml(result.site)}]</h2>
            ${bestOffer?.offerScore ? `<span class="market-score">${bestOffer.offerScore}/100</span>` : ""}
          </div>
          <span class="market-toggle">Vezi toate</span>
        </div>
        <div class="market-highlights">
          <div class="market-highlight">
            <span class="report-key">Best offer</span>
            <span class="report-value">${escapeHtml(formatOfferLine(bestOffer, result.site))}</span>
          </div>
          <div class="market-highlight">
            <span class="report-key">Lowest</span>
            <span class="report-value">${escapeHtml(formatOfferLine(lowest, result.site))}</span>
          </div>
          <div class="market-highlight">
            <span class="report-key">Highest</span>
            <span class="report-value">${escapeHtml(formatOfferLine(highest, result.site))}</span>
          </div>
        </div>
      </summary>
      <div class="market-expand">
        <div class="market-report">
          <div class="report-row">
            <span class="report-key">Best offer link</span>
            <span class="report-value">${bestOffer?.url ? `<a class="listing-link" href="${escapeHtml(bestOffer.url)}" target="_blank" rel="noreferrer">Open listing</a>` : "No direct listing URL"}</span>
          </div>
          <div class="report-row">
            <span class="report-key">Listings returned</span>
            <span class="report-value">${escapeHtml(listingCount)}</span>
          </div>
        </div>
        <div class="items">
          ${itemMarkup || '<p class="muted">Nu au fost returnate anunțuri.</p>'}
        </div>
      </div>
    </details>
  `;
}

function setLoadingState(isLoading, query = "", condition = "any") {
  loadingOverlay.classList.toggle("hidden", !isLoading);
  loadingOverlay.setAttribute("aria-hidden", String(!isLoading));

  if (!isLoading) {
    return;
  }

  const conditionLabel =
    condition === "new" ? "noi" :
    condition === "used" ? "folosite" :
    "relevante";

  loadingTitle.textContent = `Caut oferte ${conditionLabel} pentru „${query}”`;
  loadingText.textContent = "Verific OLX, Vinted, Lajumate și Okazii, ordonez anunțurile și calculez cea mai bună ofertă.";
}

async function parseApiResponse(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Serverul a răspuns cu un payload invalid (${response.status}).`);
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  const q = queryInput.value.trim();
  if (!q) {
    return;
  }

  searchButton.disabled = true;
  statusEl.textContent = "Căutarea a pornit...";
  marketplacesEl.innerHTML = "";
  summaryEl.classList.add("hidden");
  summaryEl.innerHTML = "";
  setLoadingState(true, q, conditionInput.value);

  try {
    const params = new URLSearchParams({
      q,
      condition: conditionInput.value,
      site: "all",
      limit: String(DEFAULT_SEARCH_LIMIT)
    });
    const response = await fetch(
      `/api/search?${params.toString()}`
    );
    const payload = await parseApiResponse(response);

    if (!response.ok) {
      throw new Error(payload?.error || `Căutarea a eșuat (${response.status}).`);
    }

    if (!payload) {
      throw new Error("Serverul nu a trimis niciun răspuns pentru căutare.");
    }

    renderResults(payload);
    saveLastSearch({
      query: q,
      condition: conditionInput.value,
      payload
    });
    statusEl.textContent = `Căutarea pentru „${q}” s-a terminat.`;
  } catch (error) {
    statusEl.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    searchButton.disabled = false;
    setLoadingState(false);
  }
}

form.addEventListener("submit", handleSubmit);

const savedSearch = loadLastSearch();
if (savedSearch?.payload) {
  queryInput.value = savedSearch.query || "";
  conditionInput.value = savedSearch.condition || "any";
  renderResults(savedSearch.payload);

  const savedAt = new Date(savedSearch.savedAt || Date.now());
  statusEl.textContent = `Rezultatele salvate local au fost restaurate. Ultima actualizare: ${savedAt.toLocaleString("ro-RO")}.`;
}
