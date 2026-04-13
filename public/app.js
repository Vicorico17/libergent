const form = document.getElementById("searchForm");
const queryInput = document.getElementById("queryInput");
const conditionInput = document.getElementById("conditionInput");
const searchButton = document.getElementById("searchButton");
const summaryEl = document.getElementById("summary");
const statusEl = document.getElementById("status");
const marketplacesEl = document.getElementById("marketplaces");
const accountForm = document.getElementById("accountForm");
const accountFormTitle = document.getElementById("accountFormTitle");
const accountLoggedOut = document.getElementById("accountLoggedOut");
const accountEmail = document.getElementById("accountEmail");
const accountPassword = document.getElementById("accountPassword");
const showCreateAccountButton = document.getElementById("showCreateAccountButton");
const showLoginButton = document.getElementById("showLoginButton");
const createAccountButton = document.getElementById("createAccountButton");
const loginButton = document.getElementById("loginButton");
const cancelAccountButton = document.getElementById("cancelAccountButton");
const logoutButton = document.getElementById("logoutButton");
const accountWallet = document.getElementById("accountWallet");
const accountName = document.getElementById("accountName");
const walletBalance = document.getElementById("walletBalance");
const accountStatus = document.getElementById("accountStatus");
const loadingOverlay = document.getElementById("loadingOverlay");
const loadingTitle = document.getElementById("loadingTitle");
const loadingText = document.getElementById("loadingText");
const loadingProgressFill = document.getElementById("loadingProgressFill");
const loadingProgressLabel = document.getElementById("loadingProgressLabel");
const loadingProgressBar = document.querySelector(".loading-progress");
const STORAGE_KEY = "libergent-last-search-v2";
const HISTORY_STORAGE_KEY = "libergent-search-history-v1";
const ACCOUNT_STORAGE_KEY = "libergent-mock-accounts-v1";
const SESSION_STORAGE_KEY = "libergent-mock-session-v1";
const GUEST_SEARCH_USED_KEY = "libergent-guest-search-used-v1";
const DEFAULT_SEARCH_LIMIT = 500;
const MAX_BROWSER_HISTORY_ENTRIES = 200;
const STARTING_WALLET_RON = 10;
const SEARCH_COST_RON = 1;
const MARKETPLACE_PROGRESS_STEPS = ["OLX", "Lajumate", "Vinted", "Okazii", "Publi24"];

let loadingProgressTimer = null;
let currentAccountEmail = null;
let accountMode = "closed";

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

function formatWallet(value) {
  return `${Number(value || 0).toFixed(2)} RON`;
}

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

function loadAccounts() {
  const raw = localStorage.getItem(ACCOUNT_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    localStorage.removeItem(ACCOUNT_STORAGE_KEY);
    return {};
  }
}

function saveAccounts(accounts) {
  localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(accounts));
}

function getCurrentAccount() {
  if (!currentAccountEmail) {
    return null;
  }

  return loadAccounts()[currentAccountEmail] || null;
}

function setCurrentAccount(email) {
  currentAccountEmail = email;
  if (email) {
    localStorage.setItem(SESSION_STORAGE_KEY, email);
  } else {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }
  renderAccount();
}

function showAccountForm(mode) {
  accountMode = mode;
  accountForm.hidden = false;
  accountLoggedOut.hidden = true;
  accountFormTitle.textContent = mode === "create" ? "Create account" : "Log in";
  createAccountButton.hidden = mode !== "create";
  loginButton.hidden = mode !== "login";
  accountStatus.textContent = mode === "create"
    ? `Create a local demo account and get ${STARTING_WALLET_RON} RON.`
    : "Log in to your local demo account.";
  accountEmail.focus();
}

function hideAccountForm(message = "") {
  accountMode = "closed";
  accountForm.hidden = true;
  accountLoggedOut.hidden = false;
  accountStatus.textContent = message || "Conectează-te ca să poți porni căutări demo.";
}

function updateSearchAvailability() {
  const account = getCurrentAccount();
  const canSearch = Boolean(account) && Number(account.walletRon || 0) >= SEARCH_COST_RON;
  const guestSearchUsed = localStorage.getItem(GUEST_SEARCH_USED_KEY) === "1";
  searchButton.disabled = Boolean(account) && !canSearch;
  searchButton.textContent = account
    ? canSearch
      ? `Caută (${SEARCH_COST_RON} RON)`
      : "Wallet gol"
    : guestSearchUsed
      ? "Log in pentru mai multe"
      : "Caută gratuit";
}

function renderAccount(message = "") {
  const account = getCurrentAccount();
  const isLoggedIn = Boolean(account);

  accountLoggedOut.hidden = isLoggedIn || accountMode !== "closed";
  accountForm.hidden = isLoggedIn || accountMode === "closed";
  accountWallet.hidden = !isLoggedIn;

  if (account) {
    accountName.textContent = account.email;
    walletBalance.textContent = formatWallet(account.walletRon);
    accountStatus.textContent = message || "";
  } else {
    accountName.textContent = "-";
    walletBalance.textContent = formatWallet(0);
    if (message && accountMode !== "closed") {
      accountStatus.textContent = message;
    } else if (accountMode === "closed") {
      accountStatus.textContent = localStorage.getItem(GUEST_SEARCH_USED_KEY) === "1"
        ? "Ai folosit căutarea gratuită. Creează cont sau loghează-te pentru mai multe."
        : "Poți face o căutare gratuită fără cont.";
    }
  }

  updateSearchAvailability();
}

function createAccount() {
  const email = normalizeEmail(accountEmail.value);
  const password = accountPassword.value;

  if (!email || !password) {
    renderAccount("Completează emailul și parola pentru contul demo.");
    return;
  }

  const accounts = loadAccounts();
  if (accounts[email]) {
    renderAccount("Contul demo există deja. Folosește Log in.");
    return;
  }

  accounts[email] = {
    email,
    password,
    walletRon: STARTING_WALLET_RON,
    createdAt: new Date().toISOString()
  };
  saveAccounts(accounts);
  accountMode = "closed";
  setCurrentAccount(email);
  renderAccount(`Cont demo creat. Ai primit ${STARTING_WALLET_RON} RON.`);
}

function loginAccount(event) {
  event.preventDefault();

  const email = normalizeEmail(accountEmail.value);
  const password = accountPassword.value;
  const account = loadAccounts()[email];

  if (!account || account.password !== password) {
    renderAccount("Emailul sau parola demo nu se potrivesc.");
    return;
  }

  accountMode = "closed";
  setCurrentAccount(email);
  renderAccount("Ai intrat în contul demo.");
}

function logoutAccount() {
  setCurrentAccount(null);
  hideAccountForm("Ai ieșit din contul demo.");
  renderAccount("Ai ieșit din contul demo.");
}

function chargeSearch() {
  const account = getCurrentAccount();
  if (!account) {
    throw new Error("Conectează-te sau creează un cont demo înainte de căutare.");
  }
  if (Number(account.walletRon || 0) < SEARCH_COST_RON) {
    throw new Error("Nu mai ai suficient sold demo pentru căutare.");
  }

  const accounts = loadAccounts();
  accounts[account.email] = {
    ...account,
    walletRon: Math.max(0, Number(account.walletRon || 0) - SEARCH_COST_RON)
  };
  saveAccounts(accounts);
  renderAccount(`Căutare taxată: -${SEARCH_COST_RON} RON.`);
}

function canSearchAsGuest() {
  return localStorage.getItem(GUEST_SEARCH_USED_KEY) !== "1";
}

function markGuestSearchUsed() {
  localStorage.setItem(GUEST_SEARCH_USED_KEY, "1");
  renderAccount();
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

function saveBrowserHistoryEntry({ query, condition, provider = "auto", siteKeys = [], payload }) {
  const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
  let entries = [];

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      entries = Array.isArray(parsed) ? parsed : [];
    } catch {
      entries = [];
    }
  }

  entries.unshift({
    query,
    condition,
    provider,
    siteKeys,
    searchedAt: payload?.summary?.searchedAt || new Date().toISOString(),
    successfulMarketplaces: payload?.summary?.successfulMarketplaces ?? 0,
    marketplaces: payload?.summary?.marketplaces ?? 0,
    totalListings: payload?.summary?.totalListings ?? 0,
    creditsUsed: payload?.summary?.creditsUsed ?? 0,
    bestOffer: payload?.summary?.bestOffer
      ? {
          title: payload.summary.bestOffer.title || "",
          site: payload.summary.bestOffer.site || "",
          priceRon: payload.summary.bestOffer.priceRon ?? null,
          url: payload.summary.bestOffer.url || ""
        }
      : null
  });

  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_BROWSER_HISTORY_ENTRIES)));
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
  const listingCountLabel = Number.isFinite(result.totalResults)
    ? `${result.itemCount} shown from ${result.totalResults} found`
    : `${result.itemCount} shown`;

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
            <span class="report-value market-best-offer">
              ${escapeHtml(formatOfferLine(bestOffer, result.site))}
              ${bestOffer?.url ? `<a class="listing-link listing-link--inline" href="${escapeHtml(bestOffer.url)}" target="_blank" rel="noreferrer">Open listing</a>` : ""}
            </span>
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
        <div class="market-total">
          <span class="market-total__label">Listings</span>
          <span class="market-total__value">${escapeHtml(listingCountLabel)}</span>
        </div>
        <div class="items">
          ${itemMarkup || '<p class="muted">Nu au fost returnate anunțuri.</p>'}
        </div>
      </div>
    </details>
  `;
}

function setLoadingProgress(percent, label) {
  const safePercent = Math.max(0, Math.min(100, percent));
  loadingProgressFill.style.width = `${safePercent.toFixed(1)}%`;
  loadingProgressBar.setAttribute("aria-valuenow", String(Math.round(safePercent)));
  loadingProgressLabel.textContent = label;
}

function stopLoadingProgress() {
  if (loadingProgressTimer) {
    window.clearInterval(loadingProgressTimer);
    loadingProgressTimer = null;
  }
}

function startLoadingProgress() {
  stopLoadingProgress();

  const totalSteps = MARKETPLACE_PROGRESS_STEPS.length;
  let completedSteps = 0;

  setLoadingProgress(3, "Pregătesc marketplace-urile...");

  loadingProgressTimer = window.setInterval(() => {
    const marketplace = MARKETPLACE_PROGRESS_STEPS[Math.min(completedSteps, totalSteps - 1)];
    const cappedCompletedSteps = Math.min(completedSteps + 1, Math.max(1, Math.floor(totalSteps * 0.92)));
    const percent = (cappedCompletedSteps / totalSteps) * 92;

    setLoadingProgress(
      percent,
      `Caut pe ${marketplace}...`
    );
    completedSteps = cappedCompletedSteps;

    if (completedSteps >= Math.floor(totalSteps * 0.92)) {
      stopLoadingProgress();
    }
  }, 900);
}

function finishLoadingProgress(payload) {
  stopLoadingProgress();

  const actualPages = (payload?.results || []).reduce(
    (sum, result) => sum + (Number.isFinite(result.pagesUsed) ? result.pagesUsed : 0),
    0
  );

  setLoadingProgress(
    100,
    actualPages
      ? `${actualPages} pagini verificate. Rezultatele sunt gata.`
      : "Pagini verificate. Rezultatele sunt gata."
  );
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function setLoadingState(isLoading, query = "", condition = "any") {
  loadingOverlay.classList.toggle("hidden", !isLoading);
  loadingOverlay.setAttribute("aria-hidden", String(!isLoading));

  if (!isLoading) {
    stopLoadingProgress();
    return;
  }

  const conditionLabel =
    condition === "new" ? "noi" :
    condition === "used" ? "folosite" :
    "relevante";

  loadingTitle.textContent = `Caut oferte ${conditionLabel} pentru „${query}”`;
  loadingText.textContent = "Verific OLX, Vinted, Lajumate, Okazii și Publi24, ordonez anunțurile și calculez cea mai bună ofertă.";
  startLoadingProgress();
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

  const account = getCurrentAccount();
  if (!account && !canSearchAsGuest()) {
    statusEl.textContent = "Ai folosit căutarea gratuită. Creează cont sau loghează-te pentru mai multe căutări.";
    renderAccount("Ai folosit căutarea gratuită. Creează cont sau loghează-te pentru mai multe.");
    showAccountForm("create");
    return;
  }
  if (account && Number(account.walletRon || 0) < SEARCH_COST_RON) {
    statusEl.textContent = "Nu mai ai suficient sold demo pentru căutare.";
    renderAccount("Wallet-ul demo este gol.");
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

    finishLoadingProgress(payload);
    await wait(250);
    if (account) {
      chargeSearch();
    } else {
      markGuestSearchUsed();
      renderAccount("Ai folosit căutarea gratuită. Creează cont sau loghează-te pentru mai multe.");
    }
    renderResults(payload);
    saveLastSearch({
      query: q,
      condition: conditionInput.value,
      payload
    });
    saveBrowserHistoryEntry({
      query: q,
      condition: conditionInput.value,
      siteKeys: payload.results?.map((result) => result.site).filter(Boolean) || [],
      payload
    });
    statusEl.textContent = `Căutarea pentru „${q}” s-a terminat.`;
  } catch (error) {
    statusEl.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    searchButton.disabled = false;
    updateSearchAvailability();
    setLoadingState(false);
  }
}

showCreateAccountButton.addEventListener("click", () => showAccountForm("create"));
showLoginButton.addEventListener("click", () => showAccountForm("login"));
createAccountButton.addEventListener("click", createAccount);
accountForm.addEventListener("submit", loginAccount);
cancelAccountButton.addEventListener("click", () => {
  hideAccountForm();
  renderAccount();
});
logoutButton.addEventListener("click", logoutAccount);
form.addEventListener("submit", handleSubmit);

setCurrentAccount(localStorage.getItem(SESSION_STORAGE_KEY));

const savedSearch = loadLastSearch();
if (savedSearch?.payload) {
  queryInput.value = savedSearch.query || "";
  conditionInput.value = savedSearch.condition || "any";
  renderResults(savedSearch.payload);

  const savedAt = new Date(savedSearch.savedAt || Date.now());
  statusEl.textContent = `Rezultatele salvate local au fost restaurate. Ultima actualizare: ${savedAt.toLocaleString("ro-RO")}.`;
}
