const historyStatus = document.getElementById("historyStatus");
const totalSearchesEl = document.getElementById("totalSearches");
const uniqueQueriesEl = document.getElementById("uniqueQueries");
const uniqueKeywordsEl = document.getElementById("uniqueKeywords");
const topQueriesEl = document.getElementById("topQueries");
const topKeywordsEl = document.getElementById("topKeywords");
const dailyTrendEl = document.getElementById("dailyTrend");
const recentSearchesEl = document.getElementById("recentSearches");
const HISTORY_STORAGE_KEY = "libergent-search-history-v1";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

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

function renderCountList(entries) {
  if (!entries.length) {
    return '<p class="muted">Nu există încă suficiente date.</p>';
  }

  return entries
    .map((entry, index) => `
      <div class="trend-row">
        <span class="trend-rank">${index + 1}</span>
        <span class="trend-label">${escapeHtml(entry.value)}</span>
        <span class="trend-count">${entry.count}</span>
      </div>
    `)
    .join("");
}

function renderKeywordCloud(entries) {
  if (!entries.length) {
    return '<p class="muted">Nu există keywords înregistrate încă.</p>';
  }

  const maxCount = Math.max(...entries.map((entry) => entry.count), 1);
  return entries
    .map((entry) => {
      const emphasis = 0.85 + (entry.count / maxCount) * 0.9;
      return `<span class="keyword-pill" style="font-size:${emphasis.toFixed(2)}rem">${escapeHtml(entry.value)} <strong>${entry.count}</strong></span>`;
    })
    .join("");
}

function renderDailyTrend(entries) {
  if (!entries.length) {
    return '<p class="muted">Nu există încă activitate zilnică.</p>';
  }

  const maxCount = Math.max(...entries.map((entry) => entry.count), 1);
  return entries
    .map((entry) => `
      <div class="bar-row">
        <span class="bar-label">${escapeHtml(entry.date)}</span>
        <div class="bar-track"><span class="bar-fill" style="width:${Math.max(10, (entry.count / maxCount) * 100)}%"></span></div>
        <span class="bar-value">${entry.count}</span>
      </div>
    `)
    .join("");
}

function renderRecentSearches(entries) {
  if (!entries.length) {
    return '<p class="muted">Nu există încă căutări înregistrate.</p>';
  }

  return entries
    .map((entry) => `
      <article class="recent-card">
        <p class="recent-query">${escapeHtml(entry.query)}</p>
        <p class="recent-meta">
          ${escapeHtml(new Date(entry.searchedAt).toLocaleString("ro-RO"))}
          • ${entry.successfulMarketplaces}/${entry.marketplaces} marketplaces
          • ${entry.totalListings} listings
        </p>
        <p class="recent-meta">
          ${entry.bestOffer ? `Best offer: ${escapeHtml(entry.bestOffer.title)} • ${formatRon(entry.bestOffer.priceRon)}` : "Fără best offer valid"}
        </p>
      </article>
    `)
    .join("");
}

function tokenizeQuery(query = "") {
  return query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((token) => token && token.length >= 3);
}

function buildCountList(values, limit) {
  return [...values.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function buildHistoryPayloadFromEntries(entries) {
  const queryCounts = new Map();
  const keywordCounts = new Map();
  const dailyCounts = new Map();

  for (const entry of entries) {
    const normalizedQuery = entry.query?.trim();
    if (normalizedQuery) {
      queryCounts.set(normalizedQuery, (queryCounts.get(normalizedQuery) || 0) + 1);
    }

    for (const token of tokenizeQuery(normalizedQuery)) {
      keywordCounts.set(token, (keywordCounts.get(token) || 0) + 1);
    }

    const day = String(entry.searchedAt || "").slice(0, 10);
    if (day) {
      dailyCounts.set(day, (dailyCounts.get(day) || 0) + 1);
    }
  }

  return {
    updatedAt: new Date().toISOString(),
    totals: {
      searches: entries.length,
      uniqueQueries: queryCounts.size,
      uniqueKeywords: keywordCounts.size
    },
    topQueries: buildCountList(queryCounts, 12),
    topKeywords: buildCountList(keywordCounts, 20),
    dailyTrend: [...dailyCounts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([date, count]) => ({ date, count })),
    recentSearches: entries.slice(0, 30)
  };
}

function loadBrowserHistoryPayload() {
  const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const entries = JSON.parse(raw);
    return Array.isArray(entries) && entries.length
      ? buildHistoryPayloadFromEntries(entries)
      : null;
  } catch {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
    return null;
  }
}

function renderHistory(payload, sourceLabel = "server") {
  totalSearchesEl.textContent = payload.totals.searches;
  uniqueQueriesEl.textContent = payload.totals.uniqueQueries;
  uniqueKeywordsEl.textContent = payload.totals.uniqueKeywords;
  topQueriesEl.innerHTML = renderCountList(payload.topQueries);
  topKeywordsEl.innerHTML = renderKeywordCloud(payload.topKeywords);
  dailyTrendEl.innerHTML = renderDailyTrend(payload.dailyTrend);
  recentSearchesEl.innerHTML = renderRecentSearches(payload.recentSearches);
  historyStatus.textContent = `Actualizat ${new Date(payload.updatedAt).toLocaleString("ro-RO")} (${sourceLabel}).`;
}

async function loadHistory() {
  historyStatus.textContent = "Încarc trendurile...";

  try {
    const response = await fetch("/api/history");
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Nu am putut încărca istoricul.");
    }

    if (payload.totals?.searches > 0) {
      renderHistory(payload, "server");
      return;
    }

    const browserPayload = loadBrowserHistoryPayload();
    if (browserPayload) {
      renderHistory(browserPayload, "browser local");
      return;
    }

    renderHistory(payload, "server");
    if (payload.error) {
      historyStatus.textContent = `Istoricul serverului nu este disponibil: ${payload.error}`;
    }
  } catch (error) {
    const browserPayload = loadBrowserHistoryPayload();
    if (browserPayload) {
      renderHistory(browserPayload, "browser local");
      return;
    }

    historyStatus.textContent = error instanceof Error ? error.message : String(error);
  }
}

loadHistory();
