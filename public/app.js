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
const STORAGE_KEY = "libergent-last-search-v1";

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

function renderSummary(summary) {
  summaryEl.classList.remove("hidden");
  const bestOffer = summary.bestOffer;
  summaryEl.innerHTML = `
    <div>
      <p class="metric-label">Cea Mai Bună Ofertă</p>
      <p class="metric-value">${bestOffer ? formatRon(bestOffer.priceRon) : "N/A"}</p>
      <p class="muted">${bestOffer ? `${escapeHtml(bestOffer.site)} • ${escapeHtml(bestOffer.title || "Anunț")}` : "Nu am găsit încă o ofertă validă"}</p>
    </div>
    <div>
      <p class="metric-label">Preț Mediu</p>
      <p class="metric-value">${formatRon(summary.averagePriceRon)}</p>
    </div>
    <div>
      <p class="metric-label">Anunțuri Cu Preț</p>
      <p class="metric-value">${summary.pricedListingsRon}</p>
    </div>
    <div>
      <p class="metric-label">Filtru Stare</p>
      <p class="metric-value">${escapeHtml(summary.conditionLabel || "Oricare")}</p>
    </div>
    <div>
      <p class="metric-label">Anunțuri Analizate</p>
      <p class="metric-value">${summary.totalListings}</p>
    </div>
    <div>
      <p class="metric-label">Marketplace-uri Reușite</p>
      <p class="metric-value">${summary.successfulMarketplaces}/${summary.marketplaces}</p>
    </div>
    <div>
      <p class="metric-label">Credite Folosite</p>
      <p class="metric-value">${summary.creditsUsed ?? 0}/${summary.creditBudget ?? 0}</p>
    </div>
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
      <article class="market-card">
        <h2>${escapeHtml(result.site)}</h2>
        <p class="error">${escapeHtml(result.error)}</p>
      </article>
    `;
  }

  const bestOffer = result.bestOffer;
  const offerMarkup = bestOffer
    ? `
      <p class="muted">Ofertă recomandată</p>
      <p class="price">${formatRon(bestOffer.priceRon)}</p>
      <p><strong>${escapeHtml(bestOffer.title || "Anunț fără titlu")}</strong></p>
      <p class="muted">Scor calitate ${bestOffer.offerScore}/100</p>
      <p class="muted">${escapeHtml(bestOffer.location || "Locație indisponibilă")} ${bestOffer.postedAt ? `• ${escapeHtml(bestOffer.postedAt)}` : ""}</p>
      ${bestOffer.url ? `<a class="listing-link" href="${escapeHtml(bestOffer.url)}" target="_blank" rel="noreferrer">Deschide anunțul</a>` : ""}
    `
    : `
      <p class="muted">Nu am putut extrage un preț RON valid din anunțurile găsite.</p>
    `;

  const itemMarkup = result.items
    .map((item) => `
      <div class="item">
        <p class="item-title">${escapeHtml(item.title || "Anunț fără titlu")}</p>
        <p class="item-meta">${escapeHtml(item.price || "Fără preț")} ${item.condition ? `• ${escapeHtml(item.condition)}` : ""} ${item.location ? `• ${escapeHtml(item.location)}` : ""}</p>
        ${item.url ? `<a class="listing-link" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">Deschide anunțul</a>` : ""}
      </div>
    `)
    .join("");

  return `
      <article class="market-card">
      <h2>${escapeHtml(result.site)}</h2>
      ${offerMarkup}
      <div class="items">
        ${itemMarkup || '<p class="muted">Nu au fost returnate anunțuri.</p>'}
      </div>
    </article>
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
    const response = await fetch(
      `/api/search?q=${encodeURIComponent(q)}&condition=${encodeURIComponent(conditionInput.value)}`
    );
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Căutarea a eșuat");
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
