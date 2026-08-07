import fs from "node:fs/promises";
import { Workbook, SpreadsheetFile } from "@oai/artifact-tool";

const outputDir = "/Users/vicorico/code/libergent/docs";
const outputPath = `${outputDir}/libergent-feature-tracker.xlsx`;

const stories = [
  ["US-001","Discovery","Landing page","As a visitor, I want to understand LiberGent's value so I can decide whether to search.","The landing page explains Romania-first marketplace search, comparison, and contact flows; CTA links reach search.","Implemented","Static","ui/src/app/page.tsx; ui/src/components/sections/*","Static code review; browser test pending","Open"],
  ["US-002","Navigation","Global nav","As a visitor, I want to navigate to search, trends, pricing, and account/auth so I can reach core areas.","Desktop and mobile navigation expose valid routes; mobile menu opens/closes and links preserve intent.","Implemented","Static","ui/src/components/Navbar.tsx; ui/src/components/Footer.tsx","Static code review; browser test pending","Open"],
  ["US-003","Search","Free search","As a buyer, I want to enter a product query and run a free search so I can compare listings.","Submitting a non-empty query navigates to /search?q=... and calls /api/search/free; missing q is handled clearly.","Implemented","Automated","ui/src/app/search/page.tsx; src/server.js; src/worker.js","Backend contract tests pass; browser test pending","Open"],
  ["US-004","Search","Search URL state","As a buyer, I want search query and tier in the URL so I can refresh/share a search.","/search?q=...&tier=free|premium restores the query and tier without losing context.","Implemented","Static","ui/src/app/search/page.tsx","Static review; browser test pending","Open"],
  ["US-005","Search","Loading progress","As a buyer, I want transparent progress while sources are searched so I know the app is working.","Loader shows progress/source states and resolves to results, empty state, or an actionable error.","Implemented","Static","ui/src/app/search/page.tsx","Static review; browser test pending","Open"],
  ["US-006","Search","Marketplace aggregation","As a buyer, I want results from multiple marketplaces in one list so I can compare supply.","Requested sources are represented, failures are visible, and usable cards are aggregated.","Implemented","Automated","src/app.js; src/search.js; src/aggregate.js","Backend tests pass; browser test pending","Open"],
  ["US-007","Search","Query relevance","As a buyer, I want irrelevant variants, parts, accessories, wanted ads, and damaged items filtered so recommendations are trustworthy.","Required model/spec tokens are enforced; exclusions and keyword signals are exposed.","Implemented","Automated","src/relevance.js; src/aggregate.js; src/query-normalization.js","Automated relevance tests pass; browser test pending","Open"],
  ["US-008","Search","Result sorting","As a buyer, I want to sort results by relevance, keyword match, price, recency, or agent score.","Selecting a sort option changes visible order deterministically and retains filters.","Implemented","Static","ui/src/app/search/page.tsx","Static review; browser test pending","Open"],
  ["US-009","Search","Result filters","As a buyer, I want to filter by source, source type, condition, and price range.","Filters update results, can be reset, persist locally, and work in the mobile filter surface.","Implemented","Static","ui/src/app/search/page.tsx; ui/src/components/search/SearchFilters.tsx","Static review; browser test pending","Open"],
  ["US-010","Search","Progressive results","As a buyer, I want to see an initial result set and load more results so large searches remain usable.","Results are capped initially and Load more adds the configured increment until exhausted.","Implemented","Static","ui/src/app/search/page.tsx","Static review; browser test pending","Open"],
  ["US-011","Recommendations","Best used deal","As a buyer, I want a best-used recommendation so I can start with the strongest opportunity.","A qualifying used listing is shown with score, reasons, risk, keyword, and price evidence; absent evidence produces a clear limited/empty state.","Implemented","Automated","src/aggregate.js; ui/src/app/search/search-data.ts; ui/src/app/search/page.tsx","Aggregation tests pass; current API/UI integration pending","Open"],
  ["US-012","Recommendations","New benchmark","As a buyer, I want a separate new-price benchmark so I can judge used savings.","New retail inventory is separated, deduplicated, and savings/price intelligence are visible.","Implemented","Automated","src/aggregate.js; src/market-segment.js; ui/src/app/search/page.tsx","Aggregation tests pass; browser test pending","Open"],
  ["US-013","Diagnostics","Search report","As a buyer, I want source coverage, counts, provider, and errors available so I can understand search quality.","Raport Căutare is collapsed by default and exposes agent notes, source distribution, counts, and technical errors.","Implemented","Static","ui/src/app/search/page.tsx; README.md","Static review; browser test pending","Open"],
  ["US-014","Listing","Listing detail analysis","As a buyer, I want to open LiberGent analysis for a listing so I can inspect seller/product evidence.","Opening a card lazily calls supported /api/marketplace/details and shows available description, location, seller, rating, specs, delivery, and payable total; missing values stay unavailable.","Implemented","Automated","src/listing-details.js; src/worker.js; ui/src/app/search/page.tsx","Worker detail tests pass; browser test pending","Open"],
  ["US-015","Listing","External listing visit","As a buyer, I want to open the original marketplace listing so I can transact there.","Marketplace link opens the listing in a new tab with safe rel attributes.","Implemented","Static","ui/src/app/search/page.tsx; ui/src/components/AccountDashboard.tsx","Static review; browser test pending","Open"],
  ["US-016","Favorites","Save listing","As a buyer, I want to save a listing so I can compare it later.","Save toggles the listing for the signed-in account, persists locally, and reflects saved state in the card.","Implemented","Static","ui/src/app/search/page.tsx; ui/src/lib/account-data.ts","Static review; browser test pending","Open"],
  ["US-017","Favorites","Favorites dashboard","As a signed-in buyer, I want to view/remove saved listings in my account.","Account shows saved title, price, source, location, date; remove deletes the record; empty state links to search.","Implemented","Static","ui/src/components/AccountDashboard.tsx","Static review; browser test pending","Open"],
  ["US-018","Feedback","Offer feedback","As a buyer, I want to like/dislike a recommendation so the product can learn whether it helped.","Like/dislike sends valid feedback and shows success/error feedback without breaking the result.","Implemented","Automated","ui/src/app/search/page.tsx; src/server.js; src/worker.js; src/supabase.js","API validation covered; browser test pending","Open"],
  ["US-019","Contact","Seller message draft","As a buyer, I want a Romanian seller-message draft so I can contact a seller quickly.","A copyable draft is generated from listing/query context; copy success/failure is communicated.","Implemented","Static","ui/src/app/search/page.tsx","Static review; browser test pending","Open"],
  ["US-020","Contact","Marketplace contact","As a buyer, I want to open the seller contact page or resolve a public phone when supported.","Contact action records intent, uses allowlisted listings, reports phone found/unavailable, and never invents contact data.","Implemented","Automated","src/worker.js; src/phone-numbers.js; ui/src/app/search/page.tsx","OLX contact tests pass; browser test pending","Open"],
  ["US-021","Contact","WhatsApp send","As a signed-in buyer, I want to send an approved message through WhatsApp/OpenClaw.","Requires auth, normalized mobile number, consent/approval, configured bridge; result becomes visible in conversation history.","Implemented","Automated","src/worker.js; src/outreach.js; src/providers/openclaw.js; ui/src/app/search/page.tsx","Provider/worker tests pass; live config/browser pending","Open"],
  ["US-022","Conversations","Conversation center","As a signed-in buyer, I want to view private seller conversations and statuses.","Conversation center loads only the authenticated user's conversations, supports selection, refresh, status, and original listing link.","Implemented","Automated","src/worker.js; src/conversations.js; ui/src/app/search/page.tsx; ui/src/components/AccountDashboard.tsx","Auth isolation tests pass; browser test pending","Open"],
  ["US-023","Auth","Sign in with social","As a visitor, I want to sign in with Google/Apple so protected features become available.","OAuth starts with a safe redirect and returns through confirmation; configuration errors are readable.","Implemented","Static","ui/src/components/GoogleSignIn.tsx; ui/src/app/confirm/page.tsx","Static review; external auth/browser test pending","Open"],
  ["US-024","Auth","Magic link","As a visitor, I want a passwordless email link so I can access my account.","Valid email submits OTP request; invalid/empty input is blocked; success/error feedback is shown.","Implemented","Static","ui/src/components/GoogleSignIn.tsx; src/leads.js","Static review; external auth/browser test pending","Open"],
  ["US-025","Auth","Auth redirect safety","As a visitor, I want to return to my original search after authentication without open redirects.","Safe next paths are preserved; external/invalid next values fall back to /.","Implemented","Automated","ui/src/lib/auth-path.ts; ui/src/app/account/page.tsx; ui/src/components/GoogleSignIn.tsx","Static/helper coverage; browser test pending","Open"],
  ["US-026","Account","Account dashboard","As a signed-in buyer, I want a dashboard with favorites, alerts, conversations, and activity.","Dashboard loads account state, offers section navigation, counts, and sign-out.","Implemented","Static","ui/src/components/AccountDashboard.tsx; ui/src/app/account/page.tsx","Static review; browser test pending","Open"],
  ["US-027","Alerts","Create search alert","As a signed-in buyer, I want to create a product alert so I can track demand.","Query and account email are validated; alert appears with sync status and can be paused/deleted.","Partial","Static","ui/src/components/AccountDashboard.tsx; src/saved-searches.js; src/worker.js","Local UI exists; real notification delivery not evidenced","Open"],
  ["US-028","History","Search history","As a buyer, I want recent searches and activity so I can revisit work.","Searches are recorded server-side when configured and shown in account/trends with useful fallback behavior.","Implemented","Automated","src/history.js; src/history-base.js; src/worker.js; ui/src/components/AccountDashboard.tsx","History helpers/API covered; browser test pending","Open"],
  ["US-029","Trends","Public trends","As a visitor, I want to see popular queries, keywords, daily volume, and recent searches.","/trends and /trenduri render data from /api/history and fall back to browser/local fixture data when unavailable; query links open search.","Implemented","Static","ui/src/app/trends/*; ui/src/app/trenduri/page.tsx","Static review; browser test pending","Open"],
  ["US-030","Marketing","Pricing page","As a visitor, I want to understand search tiers and premium value.","Pricing content accurately reflects available tier behavior and CTA routes to a working journey.","Partial","Static","ui/src/app/pricing/page.tsx; ui/src/components/sections/Pricing.tsx; src/worker.js; src/server.js","Premium exists only on Worker; monetization/entitlement wiring not evidenced","Open"],
  ["US-031","Premium","Premium search","As a buyer, I want Premium to search extra sources and use conditional browser fallback.","Worker accepts premium without payment token, runs direct first, uses bounded browser fallback only when needed, caches results, and returns summary.","Implemented","Automated","src/worker.js; src/providers/cloudflare-browser.js; src/sites.js","Worker premium tests pass; deployed binding/browser test pending","Open"],
  ["US-032","Premium","Local premium behavior","As a local developer/user, I want the documented local API to behave consistently with deployed Premium.","Local API should either implement Premium or clearly expose an intentional unsupported state with UI-safe messaging.","Partial","Automated","src/server.js; src/worker.js; ui/src/app/search/page.tsx","Local server returns 501 while UI can request premium; integration risk","Open"],
  ["US-033","Image","Image proxy","As a buyer, I want marketplace images to load through a safe proxy.","Only allowed marketplace image URLs proxy; non-images, oversized responses, and disallowed hosts fail safely.","Implemented","Automated","src/image-proxy.js; src/server.js; src/worker.js","Proxy tests pass; browser test pending","Open"],
  ["US-034","Image","Search by picture","As a buyer, I want to upload a product photo and receive editable search keywords.","POST /api/image-search validates MIME/size, extracts structured intent, and returns query/keywords for editing before search.","Partial","Automated","src/image-search.js; src/server.js; src/worker.js; docs/classified-marketplace-feature-plan.md","Validation only; extraction endpoint currently stubbed/does not return intent","Open"],
  ["US-035","Leads","Email capture","As a visitor, I want to submit my email for updates without leaving the page.","Popup appears once after delay, validates email, submits to /api/leads, handles configured/unconfigured/error states, and can close.","Implemented","Static","ui/src/components/EmailCapturePopup.tsx; src/leads.js; src/server.js; src/worker.js","API normalization tests pass; browser test pending","Open"],
  ["US-036","API","Health checks","As an admin, I want to run protected live marketplace health checks so I can diagnose source failures.","Admin auth is required; live=1 is required; response identifies source health without exposing the endpoint publicly.","Implemented","Automated","src/health.js; src/server.js; src/worker.js","Contract path reviewed; live admin test pending","Open"],
  ["US-037","API","Listing URL safety","As a buyer, I want detail/contact fetches restricted to supported HTTPS marketplaces.","Unsupported hosts, bad schemes, and excessive redirects are rejected; successful pages are size-limited and cached.","Implemented","Automated","src/worker.js; src/listing-details.js","Worker detail/security tests pass","Open"],
  ["US-038","API","Search input limits","As a client, I want invalid query/page/limit inputs rejected or bounded so requests remain safe.","Missing q, invalid numbers, and unsupported site/provider produce appropriate 4xx responses; valid values are capped.","Implemented","Automated","src/api-params.js; src/server.js; src/worker.js","Parameter tests and worker contract pass","Open"],
  ["US-039","Privacy","Legal pages","As a visitor, I want terms and privacy pages accessible before using auth/lead features.","/termeni and /confidentialitate render readable content and are linked from auth/lead UI.","Implemented","Static","ui/src/app/termeni/page.tsx; ui/src/app/confidentialitate/page.tsx; ui/src/components/GoogleSignIn.tsx","Static review; browser test pending","Open"],
  ["US-040","Reliability","Provider fallback","As a buyer, I want transient source failures retried/fallbacked without losing the whole search.","Direct headers retry transient failures, remote fallback is bounded, source errors are retained, and successful sources remain usable.","Implemented","Automated","src/search.js; src/app.js; src/providers/*","Provider fallback tests pass; live browser test pending","Open"],
  ["US-041","Catalog","Marketplace routing","As a buyer, I want vehicle/refurbished sources included only for relevant queries.","Car-like searches route Autovit/BestAuto; relevant tech searches route Flip/Klap; unrelated searches do not add them.","Implemented","Automated","src/sites.js","Routing tests pass","Open"],
  ["US-042","Analytics","Event tracking","As a product owner, I want key search/contact/feedback/lead actions tracked for diagnosis.","Search, premium CTA, contact, copy, feedback, and lead events are emitted without blocking the user flow.","Partial","Static","ui/src/app/search/page.tsx; ui/src/components/EmailCapturePopup.tsx; src/history.js; src/supabase.js","Several events visible; complete event contract not independently verified","Open"]
];

const sourceRows = [
  ["UI routes","/; /search; /trends; /trenduri; /pricing; /account; /auth; /signup; /reset; /confirm; /termeni; /confidentialitate","ui/src/app","Route inventory from app files","Review each route in browser"],
  ["UI components","Navbar, Footer, SearchBar, SearchFilters, ProductCard, AccountDashboard, EmailCapturePopup, GoogleSignIn","ui/src/components","Interaction inventory","Browser test required"],
  ["Worker API","/api/search/free, /api/search/premium, /api/marketplace/details, /api/marketplace/contact, /api/conversations, /api/whatsapp/send, /api/image-search, /api/history, /api/feedback, /api/leads, /api/image","src/worker.js","Deployed runtime surface","Contract tests + binding-dependent tests"],
  ["Local API","/api/search/free, /api/search/premium, /api/saved-searches, /api/health/sources, /api/image-search, /api/history, /api/leads, /api/feedback, /api/image","src/server.js","Local runtime surface","Premium parity issue tracked as US-032"],
  ["Search pipeline","site routing, direct fetch, retries, remote fallback, parsing, normalization, aggregation, ranking","src/sites.js; src/search.js; src/aggregate.js; src/relevance.js","Core domain behavior","Automated suite"],
  ["Persistence","Supabase search events, leads, feedback, saved searches, WhatsApp messages","src/supabase.js; supabase/*.sql","Authenticated/persistent features","Configuration-dependent browser test"],
  ["Provider integrations","Direct parsers, Firecrawl, Cloudflare, Browser Run, OpenClaw","src/providers; src/parsers","External reliability surface","Mocks/unit tests + live smoke tests"],
  ["Existing docs","README, capability/audit docs, feature plan, QA notes","README.md; docs/*","Claim/evidence cross-check","Review against current behavior"]
];

const actionRows = [
  ["ACT-001","High","Add real image-search provider and UI upload/edit flow","Implement provider-backed intent extraction, return editable keywords/query, add upload UI, and test MIME/size/error/success paths.","US-034","Open / product work","Requires provider credentials/selection"],
  ["ACT-002","High","Run interactive browser acceptance pass","Test all navigation, search, filters, result actions, drawers, auth redirects, account sections, alerts, trends, and lead modal interactions.","US-001–US-042","Blocked in this session","Browser Node-REPL runtime unavailable"],
  ["ACT-003","High","Run authenticated integration pass","Configure test Supabase/OpenClaw/Worker bindings and verify favorites, conversations, WhatsApp, alerts, feedback, and lead persistence end to end.","US-016–US-028, US-035","Open / environment work","Requires safe test credentials"],
  ["ACT-004","High","Post-fix regression of every story","For every row, record post-fix evidence and close only when expected behavior is observed, not merely statically inferred.","All stories","Open / QA work","Must follow ACT-002 and ACT-003"],
  ["ACT-005","Medium","Assess UI dependency vulnerabilities","Review the 6 vulnerabilities reported by npm during UI install; upgrade or document accepted risk.","Reliability","Open / dependency work","Do not run npm audit fix --force without review"],
  ["ACT-006","Medium","Run live marketplace health smoke tests","Use protected admin health endpoint and one controlled live query to validate source availability and parser drift.","US-006, US-036, US-040, US-041","Open / environment work","Requires external network/admin token"],
  ["ACT-007","Low","Add server-level automated coverage for local Premium","Move the runtime smoke assertion into a repeatable automated test around the local server handler or extracted handler function.","US-032","Open / test hardening","Current fix was verified with a runtime smoke test" ]
];

const testRows = [
  ["BASELINE-001","Automated backend/provider suite","npm test","Pass","133/133 tests passed","2026-08-02","All src, parser, provider test files"],
  ["BASELINE-002","UI lint","npm --prefix ui run lint:ci","Pass","ESLint completed with exit 0","2026-08-02","All ui source"],
  ["BASELINE-003","UI production build","npm run build:ui","Pass","Next.js compiled, TypeScript passed, 15 static routes generated; npm reported 6 dependency vulnerabilities","2026-08-02","UI deployment artifact"],
  ["RUNTIME-001","Free search contract","GET /api/search/free?q=iphone%2015&site=all&limit=5&pages=1","Pass","HTTP 200; mock results returned; top-level bestOffer populated; history event recorded","2026-08-02","US-003, US-006, US-011, US-012, US-028, US-038"],
  ["RUNTIME-002","Free search validation","GET /api/search/free without q","Pass","HTTP 400 with Missing q parameter","2026-08-02","US-003, US-038"],
  ["RUNTIME-003","Local Premium parity","GET /api/search/premium?q=iphone%2015","Fail","HTTP 501: Premium search requires deployed Cloudflare Worker Browser Run binding","2026-08-02","US-030, US-031, US-032"],
  ["RUNTIME-004","Image search contract","POST /api/image-search with image/png","Fail","HTTP 501: Image search provider is not configured yet; endpoint returns no intent/query","2026-08-02","US-034"],
  ["RUNTIME-005","Feedback validation","POST /api/feedback with feedback=maybe","Pass","HTTP 400 with expected feedback validation error","2026-08-02","US-018, US-038"],
  ["RUNTIME-006","History surface","GET /api/history","Pass","HTTP 200 with totals, top queries, daily trend, recent searches","2026-08-02","US-028, US-029"],
  ["RUNTIME-007","Browser UI journey","In-app browser automation","Blocked","Node REPL/browser runtime is unavailable in this session; UI interactions remain unverified","2026-08-02","All UI interaction stories"],
  ["RUNTIME-008","Premium parity after fix","GET /api/search/premium?q=iphone%2015&site=all&limit=5&pages=1","Pass","HTTP 200; local direct Premium aggregation returned mock results and populated searchTier=premium","2026-08-02","US-032"],
  ["RUNTIME-009","UI route smoke test","HTTP GET home/search/trends/account/pricing/termeni with redirect follow","Pass","All final responses HTTP 200; initial 308 redirects are expected from static route normalization","2026-08-02","US-001, US-003, US-026, US-029, US-030, US-039"],
  ["BASELINE-004","Full repository check","npm run check","Pass","CLI help, 133 backend/provider tests, and contract checks completed successfully","2026-08-02","Backend and CLI"],
  ["PENDING-003","Post-fix regression pass","Browser + automated","Not run","Run after fixes","2026-08-02","All stories with fixes"]
];

const errorRows = [
  ["ERR-001","US-032","Local Premium API was intentionally unimplemented","Medium","Confirmed before fix: src/server.js returned 501 for /api/search/premium while UI could select premium and docs described Premium","Fixed — verified","Local server now performs direct Premium aggregation; deployed Worker retains Browser Run fallback","2026-08-02"],
  ["ERR-002","US-034","Image search endpoint validates but does not produce intent","High","Confirmed runtime: /api/image-search returns 501 because extractImageSearchIntent() always throws; feature plan expects editable extracted keywords","Open — confirmed","Implement provider-backed extraction and response contract, then wire UI upload/edit/search flow","2026-08-02"],
  ["ERR-003","US-030","Pricing/entitlement behavior is not evidenced","Medium","Static review: pricing surfaces exist but no billing/plan enforcement path is visible; Premium is worker-binding dependent","Open — static risk","Align copy with shipped beta behavior or implement entitlement/billing","2026-08-02"]
];

const qaStatusOverrides = new Map([
  ["US-003", "API pass / UI pending"], ["US-006", "API pass / UI pending"], ["US-011", "API pass / UI pending"], ["US-012", "API pass / UI pending"],
  ["US-018", "API pass / UI pending"], ["US-028", "API pass / UI pending"], ["US-029", "API pass / UI pending"], ["US-031", "API pass / UI pending"],
  ["US-032", "API pass after fix / UI pending"], ["US-034", "Fail — confirmed"], ["US-038", "API pass / UI pending"]
]);
for (const story of stories) {
  const override = qaStatusOverrides.get(story[0]);
  if (override) story[9] = override;
}

const wb = Workbook.create();
const summary = wb.worksheets.add("Summary");
const userStories = wb.worksheets.add("User Stories");
const errors = wb.worksheets.add("Error Log");
const tests = wb.worksheets.add("Test Runs");
const sources = wb.worksheets.add("Source Inventory");
const actions = wb.worksheets.add("Release Actions");

function writeTable(sheet, start, headers, rows) {
  const endCol = String.fromCharCode(64 + headers.length);
  const endRow = rows.length + 1;
  sheet.getRange(`${start}:${String.fromCharCode(start.charCodeAt(0) + headers.length - 1)}${endRow}`).values = [headers, ...rows];
}

writeTable(userStories, "A1", ["ID","Area","Surface","User story","Expected behaviour","Implementation status","Evidence type","Code/source evidence","Current evidence","QA status"], stories);
writeTable(errors, "A1", ["Error ID","Story","Observed / suspected error","Severity","Evidence","Status","Fix direction","Date"], errorRows);
writeTable(tests, "A1", ["Run ID","Scope","Command / method","Result","Evidence","Date","Coverage"], testRows);
writeTable(sources, "A1", ["Surface","Feature set","Source files","Why it matters","Verification next step"], sourceRows);
writeTable(actions, "A1", ["Action ID","Priority","What to add/change","Acceptance criteria","Related stories","Status","Dependency / constraint"], actionRows);

summary.getRange("A1:H1").merge();
summary.getRange("A1").values = [["LIBERGENT — FEATURE & USER-STORY QA TRACKER"]];
summary.getRange("A3:B10").values = [
  ["Tracker purpose","Canonical inventory, QA evidence, errors, fixes, and regression status"],
  ["Last reviewed","2026-08-02"],
  ["Stories inventoried",null],
  ["Implemented by code/tests",null],
  ["Partial / mismatch risk",null],
  ["Open QA stories",null],
  ["Open errors",null],
  ["Baseline automated tests","133 passed; UI lint passed"]
];
summary.getRange("B5:B9").formulas = [["=COUNTA('User Stories'!A2:A43)"],["=COUNTIF('User Stories'!F2:F43,\"Implemented\")"],["=COUNTIF('User Stories'!F2:F43,\"Partial\")"],["=COUNTIF('User Stories'!J2:J43,\"Open\")"],["=COUNTIF('Error Log'!F2:F4,\"Open — confirmed\")+COUNTIF('Error Log'!F2:F4,\"Open — static risk\")"]];
summary.getRange("D3:H3").merge();
summary.getRange("D3").values = [["Workflow"]];
summary.getRange("D4:H8").values = [
  ["1","Inventory from code","Complete for current tracked surface","Update rows when code changes","Owner: QA"],
  ["2","Test every story","In progress","Record evidence in Test Runs and errors in Error Log","Owner: QA"],
  ["3","Fix logistical / UX errors","Pending","Keep original story ID linked to each fix","Owner: Engineering"],
  ["4","Post-fix regression","Pending","Retest every story and record result","Owner: QA"],
  ["5","Close tracker","Pending","No open errors; every story has post-fix evidence","Owner: QA"]
];
summary.getRange("A12:H12").merge();
summary.getRange("A12").values = [["Status legend: Implemented = behavior is evidenced in current code/tests; Partial = code exists but behavior or parity is incomplete/unverified; QA status stays Open until a user-story test is run."]];

function styleHeader(sheet, range) {
  const r = sheet.getRange(range);
  r.format = { fill: "#111111", font: { bold: true, color: "#FFFFFF" }, horizontalAlignment: "center", verticalAlignment: "center", wrapText: true };
}
function styleBody(sheet, range) {
  sheet.getRange(range).format = { verticalAlignment: "top", wrapText: true };
}
function setWidths(sheet, widths) {
  widths.forEach(([col, width]) => { sheet.getRange(`${col}:${col}`).format.columnWidth = width; });
}

styleHeader(userStories, "A1:J1"); styleBody(userStories, `A2:J${stories.length + 1}`); userStories.freezePanes.freezeRows(1);
setWidths(userStories, [["A",10],["B",14],["C",22],["D",42],["E",62],["F",18],["G",16],["H",46],["I",46],["J",14]]);
styleHeader(errors, "A1:H1"); styleBody(errors, `A2:H${errorRows.length + 1}`); errors.freezePanes.freezeRows(1);
setWidths(errors, [["A",12],["B",12],["C",38],["D",12],["E",54],["F",14],["G",54],["H",14]]);
styleHeader(tests, "A1:G1"); styleBody(tests, `A2:G${testRows.length + 1}`); tests.freezePanes.freezeRows(1);
setWidths(tests, [["A",16],["B",28],["C",34],["D",14],["E",48],["F",14],["G",42]]);
styleHeader(sources, "A1:E1"); styleBody(sources, `A2:E${sourceRows.length + 1}`); sources.freezePanes.freezeRows(1);
setWidths(sources, [["A",20],["B",56],["C",44],["D",42],["E",42]]);
styleHeader(actions, "A1:G1"); styleBody(actions, `A2:G${actionRows.length + 1}`); actions.freezePanes.freezeRows(1);
setWidths(actions, [["A",12],["B",12],["C",42],["D",64],["E",24],["F",22],["G",42]]);

summary.getRange("A1:H1").format = { fill: "#FF3366", font: { bold: true, color: "#111111", size: 16 }, horizontalAlignment: "center", verticalAlignment: "center" };
summary.getRange("A3:A10").format = { fill: "#111111", font: { bold: true, color: "#FFFFFF" }, wrapText: true };
summary.getRange("B3:B10").format = { fill: "#F5F3EE", wrapText: true };
summary.getRange("D3:H3").format = { fill: "#111111", font: { bold: true, color: "#FFFFFF" }, horizontalAlignment: "center" };
summary.getRange("D4:H8").format = { fill: "#F5F3EE", wrapText: true, verticalAlignment: "top" };
summary.getRange("A12:H12").format = { fill: "#FFF0F5", wrapText: true, verticalAlignment: "top" };
setWidths(summary, [["A",22],["B",48],["C",4],["D",8],["E",25],["F",28],["G",34],["H",18]]);
summary.getRange("3:10").format.rowHeight = 34;
summary.getRange("4:8").format.rowHeight = 38;
summary.getRange("12:12").format.rowHeight = 42;

await fs.mkdir(outputDir, { recursive: true });
const xlsx = await SpreadsheetFile.exportXlsx(wb);
await xlsx.save(outputPath);
console.log(outputPath);
