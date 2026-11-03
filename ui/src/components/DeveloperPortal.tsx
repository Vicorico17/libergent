"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, Check, Code2, Copy, KeyRound, Play, RefreshCw, Terminal, Trash2 } from "lucide-react";
import { useAccountSession } from "@/lib/use-account-session";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import styles from "./DeveloperPortal.module.css";

type ApiKey = { id: string; name: string; prefix: string; mode: "test" | "live"; scopes: string[]; expiresAt: string; revokedAt: string | null };
type Usage = Record<"test" | "live", { dayRequests: number; minuteRequests: number; dayResetsAt: string; limits: { perDay: number; perMinute: number } }>;
const messages: Record<string, string> = {
  developer_api_unavailable: "Key creation is not enabled on this deployment yet. You can still try the demo below.",
  developer_storage_unavailable: "API key storage is temporarily unavailable. Please try again.",
  storage_unavailable: "API key creation is not ready on this deployment. The demo is available below.",
  api_key_limit: "You can keep 5 active keys and create up to 20 per day. Revoke an unused key or try again tomorrow.",
  verified_email_required: "Verify your account email before creating API keys.",
  authentication_required: "Sign in to manage your API keys.", invalid_session: "Your session expired. Sign in again.",
  developer_account_disabled: "API access for this account is disabled. Contact the Libergent team.",
};
async function accountRequest(path: string, init: RequestInit = {}) {
  const supabase = getSupabaseBrowserClient();
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  if (!session) throw Error(messages.authentication_required);
  const response = await fetch(path, { ...init, headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw Error(messages[body.error?.code] || "The request could not be completed. Please try again.");
  return body;
}
function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setFailed(false); }
    catch { setFailed(true); }
  }
  return <><button type="button" className={styles.copy} onClick={copy} aria-label={label}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : label}</button>{failed && <span role="status">Select the text to copy it manually.</span>}</>;
}
function DeveloperKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("My application");
  const [mode, setMode] = useState<"test" | "live">("test");
  const [details, setDetails] = useState(false);
  const [revealed, setRevealed] = useState<{ token: string; mode: string } | null>(null);
  const [confirmId, setConfirmId] = useState("");
  const refresh = useCallback(async () => {
    try {
      const data = await accountRequest("/api/developer/keys"); setError(""); setKeys(data.keys);
      const stats = await accountRequest("/api/developer/usage"); setUsage(stats.usage);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load your keys."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { queueMicrotask(() => { void refresh(); }); }, [refresh]);
  async function create(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const data = await accountRequest("/api/developer/keys", { method: "POST", body: JSON.stringify({ name, mode, scopes: details ? ["search:read", "listings:details"] : ["search:read"] }) });
      setRevealed({ token: data.token, mode: data.key.mode }); setKeys(current => [data.key, ...current]);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create key."); }
    finally { setBusy(false); }
  }
  async function revoke(id: string) {
    setBusy(true); setError("");
    try {
      await accountRequest(`/api/developer/keys/${id}`, { method: "DELETE" });
      setKeys(current => current.map(key => key.id === id ? { ...key, revokedAt: new Date().toISOString() } : key));
      setRevealed(null); setConfirmId("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not revoke key."); }
    finally { setBusy(false); }
  }
  return <div>
    {error && <p className={styles.notice} role="alert">{error}</p>}
    {loading ? <p role="status">Loading your keys…</p> : <>
      {revealed && <div className={styles.secret} role="status"><strong>Your {revealed.mode} key is ready.</strong><p>Copy it now. Store it as LIBERGENT_API_KEY on your server. You cannot reveal it again.</p><code>{revealed.token}</code><div className={styles.actions}><CopyButton text={revealed.token} label="Copy API key" /><button type="button" className={styles.secondary} onClick={() => setRevealed(null)}>I saved my key</button></div></div>}
      <form onSubmit={create} className={styles.keyForm}>
        <label>Application name<input value={name} onChange={e => setName(e.target.value)} maxLength={60} required placeholder="My application" /></label>
        <label>Environment<select value={mode} onChange={e => setMode(e.target.value as "test" | "live")}><option value="test">Test — simulated results</option><option value="live">Live — marketplace results</option></select></label>
        <label className={styles.check}><input type="checkbox" checked={details} onChange={e => setDetails(e.target.checked)} />Include listing details permission</label>
        <button className={styles.primary} disabled={busy || !name.trim() || Boolean(revealed)}><KeyRound size={16} />{busy ? "Working…" : `Create ${mode} key`}</button>
      </form>
      <p className={styles.muted}>Keys expire after 90 days. Up to 5 active keys. Create a replacement before revoking your old key.</p>
      <div className={styles.keyList}>{keys.map(key => <div key={key.id} className={styles.keyRow}><div><strong>{key.name}</strong><span className={styles.tag}>{key.mode}</span><code>{key.prefix}.••••</code><small>{key.revokedAt ? "Revoked" : `Expires ${new Date(key.expiresAt).toLocaleDateString()}`} · {key.scopes.join(", ")}</small></div>{!key.revokedAt && <div className={styles.actions}><button disabled={busy} type="button" className={styles.secondary} onClick={() => confirmId === key.id ? void revoke(key.id) : setConfirmId(key.id)}><Trash2 size={14} />{confirmId === key.id ? "Confirm revocation" : "Revoke"}</button>{confirmId === key.id && <button type="button" className={styles.secondary} onClick={() => setConfirmId("")}>Cancel</button>}</div>}</div>)}</div>
      {usage && <div className={styles.usage}>{(["test", "live"] as const).map(environment => <div key={environment}><span>{environment} usage today</span><strong>{usage[environment].dayRequests} / {usage[environment].limits.perDay}</strong><small>{usage[environment].minuteRequests} / {usage[environment].limits.perMinute} requests this minute · daily reset at 00:00 UTC</small></div>)}</div>}
      <button type="button" className={styles.secondary} onClick={() => void refresh()} disabled={busy}><RefreshCw size={14} />Refresh keys & usage</button>
    </>}
  </div>;
}
export function DeveloperPortal() {
  const account = useAccountSession();
  const [availability, setAvailability] = useState<"loading" | "ready" | "disabled" | "error">("loading");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/developer/config", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("Configuration unavailable");
        setAvailability((await response.json()).available ? "ready" : "disabled");
      }).catch(() => { if (!controller.signal.aborted) setAvailability("error"); });
    return () => controller.abort();
  }, []);
  const [language, setLanguage] = useState("curl");
  const [query, setQuery] = useState("iphone 15");
  const [origin, setOrigin] = useState("https://libergent.com");
  const [demo, setDemo] = useState("");
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoError, setDemoError] = useState("");
  useEffect(() => { queueMicrotask(() => setOrigin(window.location.origin)); }, []);
  const url = `${origin}/api/v1/search?q=${encodeURIComponent(query)}&limit=10`;
  const examples: Record<string, string> = {
    curl: `curl --fail-with-body ${JSON.stringify(url)} \\\n  -H "Authorization: Bearer $LIBERGENT_API_KEY"`,
    JavaScript: `// Run on your server (Node.js 22+).\nconst response = await fetch(${JSON.stringify(url)}, {\n  headers: { Authorization: \`Bearer \${process.env.LIBERGENT_API_KEY}\` },\n  signal: AbortSignal.timeout(35000)\n});\nif (!response.ok) throw new Error(\`Libergent: \${response.status}\`);\nconst { items, partial, sources } = await response.json();\nconsole.log({ items, partial, sources });`,
    Python: `# Run on your server. Uses the Python standard library.\nimport json, os, urllib.request\n\nrequest = urllib.request.Request(\n    ${JSON.stringify(url)},\n    headers={"Authorization": "Bearer " + os.environ["LIBERGENT_API_KEY"]}\n)\nwith urllib.request.urlopen(request, timeout=35) as response:\n    results = json.load(response)\n    print(results["items"])`,
    MCP: `// On the agent server: npm install @modelcontextprotocol/sdk\nimport { Client } from "@modelcontextprotocol/sdk/client/index.js";\nimport { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";\n\nconst client = new Client({ name: "my-agent", version: "1.0.0" });\ntry {\n  await client.connect(new StreamableHTTPClientTransport(\n    new URL(${JSON.stringify(origin + '/api/v1/mcp')}),\n    { requestInit: { headers: {\n      Authorization: \`Bearer \${process.env.LIBERGENT_API_KEY}\`\n    } } }\n  ));\n  const result = await client.callTool({\n    name: "search_products",\n    arguments: { query: ${JSON.stringify(query)}, limit: 10 }\n  }, undefined, { timeout: 45000 });\n  console.log(result);\n} finally { await client.close(); }`,
  };
  async function runDemo() {
    setDemoBusy(true); setDemoError("");
    try {
      const response = await fetch("/api/v1/demo"); if (!response.ok) throw Error();
      setDemo(JSON.stringify(await response.json(), null, 2));
    } catch { setDemoError("The demo is unavailable. Please try again shortly."); }
    finally { setDemoBusy(false); }
  }
  return <main className={styles.page}>
    <div className={styles.hero}><div><span className={styles.eyebrow}><Code2 size={16} />LIBERGENT FOR DEVELOPERS</span><h1>Your app.<br />Marketplace search.<br /><em>One API.</em></h1><p>Bring product listings, original photos and source links into your storefront, comparison tool or app.</p><div className={styles.actions}><a className={styles.primary} href="#api-keys">Get an API key <ArrowUpRight size={17} /></a><a className={styles.secondary} href="#quickstart">See the quickstart</a></div></div><div className={styles.heroCode}><span>GET /api/v1/search?q=iphone%2015</span><pre>{'{\n  "apiVersion": "1",\n  "mode": "live",\n  "partial": false,\n  "items": [\n    { "title": "…", "url": "…" }\n  ]\n}'}</pre><small>Illustrative response · real results include price, source, photos and freshness.</small></div></div>
    <div className={styles.steps}><div><span>01</span><strong>Try it</strong><p>Explore a simulated response without an account.</p></div><div><span>02</span><strong>Create a key</strong><p>Sign in. Choose test or live. Copy your key once.</p></div><div><span>03</span><strong>Make a request</strong><p>Call from your server. Put the results in your app.</p></div></div>
    <section className={styles.section} id="demo"><div className={styles.sectionHeading}><h2>Start with a demo</h2><span className={styles.tag}>NO KEY NEEDED</span></div><p>See the response format before connecting your app. Demo and test keys use simulated data and never contact marketplaces.</p><button type="button" className={styles.primary} onClick={runDemo} disabled={demoBusy}><Play size={16} />{demoBusy ? "Loading…" : "Run demo request"}</button>{demoError && <p role="alert">{demoError}</p>}{demo && <div className={styles.code}><div><span>200 OK · simulated data</span><CopyButton text={demo} label="Copy response" /></div><pre aria-label="Demo response">{demo}</pre></div>}</section>
    <section className={styles.section} id="api-keys"><div className={styles.sectionHeading}><h2>Your API keys</h2><KeyRound size={22} /></div><p>Use one account for your applications. Each key has its own name and permissions; usage limits are shared across your account.</p>{availability !== "ready" ? <p role="status">{availability === "loading" ? "Checking API key availability…" : availability === "error" ? "Could not check availability. Reload to retry." : "API key management is not enabled on this deployment. You can still use the demo."}</p> : account.status === "checking" ? <p role="status">Checking your account…</p> : account.status === "signed_in" ? <DeveloperKeys key={account.userId} /> : <div className={styles.signin}><p>Sign in with your Libergent account to create and revoke keys.</p><Link className={styles.primary} href="/auth?next=%2Fdevelopers">Sign in to get a key <ArrowUpRight size={16} /></Link></div>}</section>
    <section className={styles.section} id="quickstart"><div className={styles.sectionHeading}><h2>Copy. Paste. Search.</h2><Terminal size={22} /></div><p>Save your key as <code>LIBERGENT_API_KEY</code> in your server environment. Use a test key first, then switch to a live key for real results.</p><label className={styles.query}>Search query<input value={query} maxLength={120} onChange={e => setQuery(e.target.value)} placeholder="iphone 15, bicicleta, canapea…" /></label><div className={styles.tabs} role="group" aria-label="Example language">{Object.keys(examples).map(value => <button type="button" key={value} aria-pressed={language === value} onClick={() => setLanguage(value)}>{value}</button>)}</div><div className={styles.code}><div><span>Server-side example</span><CopyButton key={language + query + origin} text={examples[language]} label="Copy request" /></div><pre>{examples[language]}</pre></div><p className={styles.muted}>Never put the API key in frontend JavaScript, a public repository, or a NEXT_PUBLIC_ variable. Cache results on your server before showing them to visitors.</p></section>
    <section className={styles.section} id="agents"><div className={styles.sectionHeading}><h2>Connect an AI agent</h2><Code2 size={22} /></div><p>Use the REST API as a tool in your own agent, or connect an MCP client to <code>/api/v1/mcp</code>. Both use the same test/live API keys, search permissions, cache and account quotas.</p><div className={styles.reference}><div><h3>Discoverable tools</h3><p><code>search_products</code> finds products; <code>list_sources</code> lists your allowed marketplaces. Set <code>details=true</code> when your key permits listing enrichment.</p></div><div><h3>Connect from your agent host</h3><p>Choose the MCP example above. Supply your key in the Authorization header from a server secret. This read-only connection does not contact sellers or make purchases.</p><p>MCP requires separate deployment enablement. Automatic sign-in through hosted assistant platforms requires OAuth account linking, which is not included yet.</p></div></div></section>
    <section className={styles.section} id="reference"><div className={styles.sectionHeading}><h2>A small, predictable API</h2><a href="/api/v1/openapi.json" className={styles.textLink}>OpenAPI specification <ArrowUpRight size={14} /></a></div><div className={styles.reference}><div><h3>Search</h3><code>GET /api/v1/search</code><p><code>q</code> is required. Optional: <code>sites</code> (comma-separated), <code>limit</code> (1–20), and <code>details=true</code> with listing details permission.</p><p>Specialized filters are optional: <code>category=full_fur_coat</code> and <code>material=natural|synthetic|unknown</code>. Leave them out for general product search.</p></div><div><h3>Sources</h3><code>GET /api/v1/sources</code><p>Initial API coverage: OLX, Publi24 and Okazii. The default is OLX. Coverage and availability vary by source; empty results are possible.</p><p>Search is a bounded sample of up to 20 candidates, not a complete marketplace inventory.</p></div><div><h3>Starter limits</h3><p>Live: <strong>200 requests/day</strong>, 10/minute.<br />Test: <strong>1,000 requests/day</strong>, 60/minute.</p><p>Cached requests count too. HTTP 429 includes <code>Retry-After</code>. There is no billing or automatic paid upgrade in this release.</p></div><div><h3>Freshness & failures</h3><p>Results are cached for 15 minutes. Inspect <code>partial</code>, <code>sources</code> and <code>lastVerifiedAt</code>. Missing values are null; availability can be unknown.</p><p>401: replace an invalid key. 403: check permissions. 502/503: retry later. Live requests can take about 30 seconds; use a 35-second client timeout.</p></div></div></section>
  </main>;
}
