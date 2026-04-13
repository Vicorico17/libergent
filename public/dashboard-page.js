const dashboardStatusEl = document.getElementById("dashboardStatus");
const dashboardMetricsEl = document.getElementById("dashboardMetrics");
const dashboardProgressEl = document.getElementById("dashboardProgress");
const dashboardFactsEl = document.getElementById("dashboardFacts");
const refreshButton = document.getElementById("refreshDashboardButton");

const REFRESH_INTERVAL_MS = 30_000;
let refreshTimer = null;

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0
  }).format(value);
}

function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return "N/A";
  }

  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value < 10 ? 1 : 0
  }).format(value)}%`;
}

function formatDateTime(value) {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return date.toLocaleString("ro-RO");
}

function formatDateOnly(value) {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return date.toLocaleDateString("ro-RO", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function renderMetricCard(label, value, tone = "") {
  const toneClass = tone ? ` dashboard-value--${tone}` : "";
  return `
    <article class="dashboard-stat">
      <p class="metric-label">${escapeHtml(label)}</p>
      <p class="dashboard-value${toneClass}">${escapeHtml(value)}</p>
    </article>
  `;
}

function renderFactCard(label, value, copy) {
  return `
    <article class="dashboard-fact">
      <p class="dashboard-label">${escapeHtml(label)}</p>
      <p class="dashboard-value">${escapeHtml(value)}</p>
      <p class="dashboard-copy muted">${escapeHtml(copy)}</p>
    </article>
  `;
}

function renderDashboard(payload) {
  const usage = payload?.firecrawl || {};
  const remainingCredits = usage.remainingCredits;
  const planCredits = usage.planCredits;
  const usedCredits = usage.usedCredits;
  const usagePercent =
    Number.isFinite(planCredits) && planCredits > 0 && Number.isFinite(usedCredits)
      ? (usedCredits / planCredits) * 100
      : null;
  const remainingPercent =
    Number.isFinite(planCredits) && planCredits > 0 && Number.isFinite(remainingCredits)
      ? (remainingCredits / planCredits) * 100
      : null;

  dashboardMetricsEl.innerHTML = [
    renderMetricCard("Remaining Credits", formatNumber(remainingCredits), "sage"),
    renderMetricCard("Plan Credits", formatNumber(planCredits)),
    renderMetricCard("Used Credits", formatNumber(usedCredits), "accent"),
    renderMetricCard("Remaining %", formatPercent(remainingPercent))
  ].join("");

  dashboardProgressEl.innerHTML = Number.isFinite(remainingPercent)
    ? `
      <p class="metric-label">Remaining capacity</p>
      <div class="dashboard-progress" aria-hidden="true">
        <div class="dashboard-progress__fill" style="width:${Math.max(0, Math.min(100, remainingPercent)).toFixed(2)}%"></div>
      </div>
      <p class="muted dashboard-note">${formatPercent(usagePercent)} consumat în perioada curentă de billing.</p>
    `
    : '<p class="muted dashboard-note">Nu am putut calcula procentul de consum pentru perioada curentă.</p>';

  dashboardFactsEl.innerHTML = [
    renderFactCard("Billing Start", formatDateOnly(usage.billingPeriodStart), "Data de început a perioadei curente de credit usage."),
    renderFactCard("Billing End", formatDateOnly(usage.billingPeriodEnd), "Data la care Firecrawl resetează perioada curentă."),
    renderFactCard("Last Sync", formatDateTime(payload.updatedAt), "Timestamp-ul ultimei sincronizări făcute de backend."),
    renderFactCard(
      "Provider",
      payload.configured === false ? "firecrawl not configured" : payload.provider || "firecrawl",
      payload.message || "Dashboard-ul citește date live din backend și nu expune cheia în browser."
    )
  ].join("");
}

async function loadDashboard() {
  dashboardStatusEl.textContent = "Încarc datele live din Firecrawl...";
  refreshButton.disabled = true;

  try {
    const response = await fetch("/api/dashboard", {
      cache: "no-store"
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error || "Nu am putut încărca dashboard-ul.");
    }

    renderDashboard(payload);
    dashboardStatusEl.textContent = `Actualizat ${formatDateTime(payload.updatedAt)}.`;
  } catch (error) {
    dashboardStatusEl.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener("click", () => {
  loadDashboard();
});

loadDashboard();
refreshTimer = window.setInterval(loadDashboard, REFRESH_INTERVAL_MS);

window.addEventListener("beforeunload", () => {
  if (refreshTimer) {
    window.clearInterval(refreshTimer);
  }
});
