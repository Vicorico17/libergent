const AREAS = [
  "Calea Victoriei",
  "Old Town",
  "Piata Romana",
  "Piata Amzei",
  "Ateneul Roman",
  "Dorobanti",
  "Floreasca",
  "Cotroceni",
  "Tineretului",
  "Bucharest wider area"
];

const CATEGORIES = [
  "Cafe",
  "Restaurant",
  "Bar",
  "Boutique hotel",
  "Salon",
  "Clinic",
  "Gallery",
  "Retail",
  "Fitness",
  "Professional services"
];

const STAGES = ["New", "Researching", "Qualified", "Contacted", "Won", "Parked"];

const SEARCH_PACKS = [
  {
    title: "Calea Victoriei hospitality",
    query: "cafes restaurants bars Calea Victoriei Bucharest",
    note: "Good fit for menus, booking pages, event landing pages, and local SEO."
  },
  {
    title: "Boutique stays",
    query: "boutique hotel guesthouse near Calea Victoriei Bucharest",
    note: "Look for weak direct booking, slow sites, or reliance on marketplaces."
  },
  {
    title: "Clinics and salons",
    query: "beauty salon clinic Piata Amzei Calea Victoriei Bucharest",
    note: "Prioritize businesses that need appointment flows and trust-building pages."
  },
  {
    title: "Galleries and retail",
    query: "gallery concept store Calea Victoriei Bucharest",
    note: "Good for catalogs, event pages, ecommerce starts, and portfolio sites."
  },
  {
    title: "Restaurants without websites",
    query: "site:instagram.com restaurant Calea Victoriei Bucharest",
    note: "Instagram-only businesses often need a lightweight owned web presence."
  },
  {
    title: "Nearby premium areas",
    query: "cafes salons clinics Dorobanti Floreasca Bucharest",
    note: "Use after Calea Victoriei to expand into higher-ticket neighborhoods."
  }
];

const STARTER_LEADS = [
  {
    id: crypto.randomUUID(),
    name: "Add real lead from Calea Victoriei search",
    area: "Calea Victoriei",
    category: "Cafe",
    sourceUrl: "https://www.google.com/maps/search/cafes+Calea+Victoriei+Bucharest",
    contact: "",
    signals: ["No website", "Active social media"],
    notes: "Starter placeholder. Replace with a real business after research.",
    status: "Researching",
    createdAt: new Date().toISOString()
  },
  {
    id: crypto.randomUUID(),
    name: "Add real lead from Piata Amzei search",
    area: "Piata Amzei",
    category: "Salon",
    sourceUrl: "https://www.google.com/maps/search/salon+Piata+Amzei+Bucharest",
    contact: "",
    signals: ["No booking/order flow", "Good reviews"],
    notes: "Check whether they have online booking and mobile-friendly service pages.",
    status: "New",
    createdAt: new Date().toISOString()
  }
];

const STORAGE_KEY = "bucharestLeadFinder.leads.v1";
const SIGNAL_POINTS = {
  "No website": 32,
  "Outdated website": 26,
  "Weak mobile UX": 20,
  "No booking/order flow": 18,
  "Active social media": 12,
  "Good reviews": 12
};

const els = {
  area: document.querySelector("#area"),
  category: document.querySelector("#category"),
  status: document.querySelector("#status"),
  query: document.querySelector("#query"),
  sortBy: document.querySelector("#sortBy"),
  visibleCount: document.querySelector("#visibleCount"),
  hotCount: document.querySelector("#hotCount"),
  leadList: document.querySelector("#leadList"),
  summaryText: document.querySelector("#summaryText"),
  leadForm: document.querySelector("#leadForm"),
  searchPacks: document.querySelector("#searchPacks"),
  exportCsv: document.querySelector("#exportCsv"),
  resetDemo: document.querySelector("#resetDemo"),
  copyChecklist: document.querySelector("#copyChecklist"),
  template: document.querySelector("#leadCardTemplate")
};

let leads = loadLeads();

function loadLeads() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return STARTER_LEADS;
  try {
    return JSON.parse(stored);
  } catch {
    return STARTER_LEADS;
  }
}

function saveLeads() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
}

function scoreLead(lead) {
  const signalScore = lead.signals.reduce((sum, signal) => sum + (SIGNAL_POINTS[signal] || 0), 0);
  const contactScore = lead.contact ? 8 : 0;
  const sourceScore = lead.sourceUrl ? 6 : 0;
  return Math.min(100, signalScore + contactScore + sourceScore);
}

function option(value) {
  const el = document.createElement("option");
  el.value = value;
  el.textContent = value;
  return el;
}

function initSelects() {
  AREAS.forEach((area) => {
    els.area.append(option(area));
    els.leadForm.elements.area.append(option(area));
  });

  CATEGORIES.forEach((category) => {
    els.category.append(option(category));
    els.leadForm.elements.category.append(option(category));
  });
}

function renderSearchPacks() {
  els.searchPacks.replaceChildren();
  SEARCH_PACKS.forEach((pack) => {
    const article = document.createElement("article");
    article.className = "pack";
    const title = document.createElement("h3");
    title.textContent = pack.title;
    const note = document.createElement("p");
    note.textContent = pack.note;
    const maps = document.createElement("a");
    maps.className = "button small";
    maps.href = `https://www.google.com/maps/search/${encodeURIComponent(pack.query)}`;
    maps.target = "_blank";
    maps.rel = "noreferrer";
    maps.textContent = "Maps";
    const web = document.createElement("a");
    web.className = "button small";
    web.href = `https://www.google.com/search?q=${encodeURIComponent(pack.query)}`;
    web.target = "_blank";
    web.rel = "noreferrer";
    web.textContent = "Web";
    const actions = document.createElement("div");
    actions.className = "card-actions";
    actions.append(maps, web);
    article.append(title, note, actions);
    els.searchPacks.append(article);
  });
}

function filteredLeads() {
  const query = els.query.value.trim().toLowerCase();
  const area = els.area.value;
  const category = els.category.value;
  const status = els.status.value;

  return leads
    .filter((lead) => area === "all" || lead.area === area)
    .filter((lead) => category === "all" || lead.category === category)
    .filter((lead) => status === "all" || lead.status === status)
    .filter((lead) => {
      if (!query) return true;
      return [lead.name, lead.area, lead.category, lead.notes, lead.contact]
        .join(" ")
        .toLowerCase()
        .includes(query);
    })
    .sort((a, b) => {
      if (els.sortBy.value === "name") return a.name.localeCompare(b.name);
      if (els.sortBy.value === "createdAt") return new Date(b.createdAt) - new Date(a.createdAt);
      return scoreLead(b) - scoreLead(a);
    });
}

function renderLeads() {
  const visible = filteredLeads();
  els.leadList.replaceChildren();
  els.visibleCount.textContent = visible.length;
  els.hotCount.textContent = visible.filter((lead) => scoreLead(lead) >= 60).length;
  els.summaryText.textContent = visible.length
    ? `${visible.length} visible lead${visible.length === 1 ? "" : "s"} sorted by ${els.sortBy.value}.`
    : "No leads match these filters.";

  visible.forEach((lead) => {
    const fragment = els.template.content.cloneNode(true);
    const card = fragment.querySelector(".lead-card");
    const meta = fragment.querySelector(".meta");
    const title = fragment.querySelector("h3");
    const score = fragment.querySelector(".score");
    const notes = fragment.querySelector(".notes");
    const tags = fragment.querySelector(".tags");
    const select = fragment.querySelector(".stage-select");
    const research = fragment.querySelector(".research");
    const copy = fragment.querySelector(".copy");
    const del = fragment.querySelector(".delete");

    card.dataset.id = lead.id;
    meta.textContent = `${lead.area} · ${lead.category}`;
    title.textContent = lead.name;
    score.textContent = scoreLead(lead);
    notes.textContent = lead.notes || "No notes yet.";

    lead.signals.forEach((signal) => {
      const tag = document.createElement("span");
      tag.className = `tag ${SIGNAL_POINTS[signal] >= 20 ? "hot" : ""}`;
      tag.textContent = signal;
      tags.append(tag);
    });

    STAGES.forEach((stage) => select.append(option(stage)));
    select.value = lead.status;
    select.addEventListener("change", () => {
      lead.status = select.value;
      saveLeads();
      renderLeads();
    });

    research.href = lead.sourceUrl || `https://www.google.com/search?q=${encodeURIComponent(`${lead.name} ${lead.area} Bucharest`)}`;
    copy.addEventListener("click", () => copyPitch(lead));
    del.addEventListener("click", () => {
      leads = leads.filter((item) => item.id !== lead.id);
      saveLeads();
      renderLeads();
    });

    els.leadList.append(fragment);
  });
}

function formSignals(form) {
  return Array.from(form.querySelectorAll("input[name='signals']:checked")).map((input) => input.value);
}

function handleSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const lead = {
    id: crypto.randomUUID(),
    name: form.elements.name.value.trim(),
    area: form.elements.area.value,
    category: form.elements.category.value,
    sourceUrl: form.elements.sourceUrl.value.trim(),
    contact: form.elements.contact.value.trim(),
    signals: formSignals(form),
    notes: form.elements.notes.value.trim(),
    status: "New",
    createdAt: new Date().toISOString()
  };

  leads.unshift(lead);
  saveLeads();
  form.reset();
  renderLeads();
}

function copyPitch(lead) {
  const pitch = [
    `Hi, I found ${lead.name} while researching ${lead.area}.`,
    `I noticed ${lead.signals.join(", ").toLowerCase() || "a few opportunities to improve the online experience"}.`,
    `A focused web build could help with discovery, trust, and conversions: ${lead.notes || "site refresh, local SEO, and a clearer contact/booking path"}.`,
    "Would it be useful if I sent a quick 3-point audit?"
  ].join("\n\n");
  writeClipboard(pitch);
}

function copyChecklist() {
  const checklist = [
    "Lead qualification checklist:",
    "- Has no website or a visibly outdated site",
    "- Has active Instagram/Facebook but no owned conversion path",
    "- Has good reviews, premium location, or clear repeat customers",
    "- Needs menu, booking, appointment, ecommerce, event, or SEO pages",
    "- Has public contact details and a specific decision maker angle"
  ].join("\n");
  writeClipboard(checklist);
}

function writeClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function exportCsv() {
  const rows = [
    ["Name", "Area", "Category", "Score", "Status", "Contact", "Source URL", "Signals", "Notes"],
    ...filteredLeads().map((lead) => [
      lead.name,
      lead.area,
      lead.category,
      scoreLead(lead),
      lead.status,
      lead.contact,
      lead.sourceUrl,
      lead.signals.join("; "),
      lead.notes
    ])
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "bucharest-leads.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  return `"${String(value || "").replaceAll('"', '""')}"`;
}

function resetDemo() {
  leads = STARTER_LEADS.map((lead) => ({ ...lead, id: crypto.randomUUID(), createdAt: new Date().toISOString() }));
  saveLeads();
  renderLeads();
}

function bindEvents() {
  [els.area, els.category, els.status, els.query, els.sortBy].forEach((el) => el.addEventListener("input", renderLeads));
  els.leadForm.addEventListener("submit", handleSubmit);
  els.exportCsv.addEventListener("click", exportCsv);
  els.resetDemo.addEventListener("click", resetDemo);
  els.copyChecklist.addEventListener("click", copyChecklist);
}

initSelects();
renderSearchPacks();
bindEvents();
renderLeads();
