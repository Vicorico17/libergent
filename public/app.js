const form = document.getElementById("searchForm");
const queryInput = document.getElementById("queryInput");
const siteInput = document.getElementById("siteInput");
const providerInput = document.getElementById("providerInput");
const limitInput = document.getElementById("limitInput");
const pagesInput = document.getElementById("pagesInput");
const searchButton = document.getElementById("searchButton");
const summaryEl = document.getElementById("summary");
const statusEl = document.getElementById("status");
const marketplacesEl = document.getElementById("marketplaces");

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
  summaryEl.innerHTML = `
    <div>
      <p class="metric-label">Average Price</p>
      <p class="metric-value">${formatRon(summary.averagePriceRon)}</p>
    </div>
    <div>
      <p class="metric-label">RON Listings</p>
      <p class="metric-value">${summary.pricedListingsRon}</p>
    </div>
    <div>
      <p class="metric-label">Listings Seen</p>
      <p class="metric-value">${summary.totalListings}</p>
    </div>
    <div>
      <p class="metric-label">Successful Sites</p>
      <p class="metric-value">${summary.successfulMarketplaces}/${summary.marketplaces}</p>
    </div>
  `;
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

  const lowest = result.lowest;
  const lowestMarkup = lowest
    ? `
      <p class="muted">Lowest visible offer</p>
      <p class="price">${formatRon(lowest.priceRon)}</p>
      <p><strong>${escapeHtml(lowest.title || "Untitled listing")}</strong></p>
      <p class="muted">${escapeHtml(lowest.location || "Location unavailable")} ${lowest.postedAt ? `• ${escapeHtml(lowest.postedAt)}` : ""}</p>
      ${lowest.url ? `<a class="listing-link" href="${escapeHtml(lowest.url)}" target="_blank" rel="noreferrer">Open listing</a>` : ""}
    `
    : `
      <p class="muted">No RON price could be parsed from the extracted listings.</p>
    `;

  const itemMarkup = result.items
    .map((item) => `
      <div class="item">
        <p class="item-title">${escapeHtml(item.title || "Untitled listing")}</p>
        <p class="item-meta">${escapeHtml(item.price || "No price")} ${item.location ? `• ${escapeHtml(item.location)}` : ""}</p>
        ${item.url ? `<a class="listing-link" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">Open listing</a>` : ""}
      </div>
    `)
    .join("");

  return `
    <article class="market-card">
      <h2>${escapeHtml(result.site)}</h2>
      ${lowestMarkup}
      <div class="items">
        ${itemMarkup || '<p class="muted">No listings returned.</p>'}
      </div>
    </article>
  `;
}

async function handleSubmit(event) {
  event.preventDefault();

  const q = queryInput.value.trim();
  if (!q) {
    return;
  }

  searchButton.disabled = true;
  statusEl.textContent = "Searching marketplaces...";
  marketplacesEl.innerHTML = "";
  summaryEl.classList.add("hidden");
  summaryEl.innerHTML = "";

  try {
    const response = await fetch(
      `/api/search?q=${encodeURIComponent(q)}&provider=${encodeURIComponent(providerInput.value)}&site=${encodeURIComponent(siteInput.value)}&limit=${encodeURIComponent(limitInput.value)}&pages=${encodeURIComponent(pagesInput.value)}`
    );
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Search failed");
    }

    renderSummary(payload.summary);
    marketplacesEl.innerHTML = payload.results.map(renderSite).join("");
    statusEl.textContent = `Search finished for "${q}" on ${siteInput.value}.`;
  } catch (error) {
    statusEl.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    searchButton.disabled = false;
  }
}

form.addEventListener("submit", handleSubmit);
