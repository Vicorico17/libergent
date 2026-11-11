import puppeteer from '@cloudflare/puppeteer';
import { buildFacebookSearchUrl, inspectFacebookPage } from './facebook-diagnostic.js';

export async function probeFacebookOnCloudflare(binding, { location, query, engine = 'chromium' }, launch = puppeteer.launch) {
  const requestedUrl = buildFacebookSearchUrl({ location, query });
  if (!['chromium', 'kitesurf'].includes(engine)) throw new Error('Unsupported browser engine');
  const started = Date.now();
  let browser;
  let timer;
  let report = { status: 'browser_launch_failed', listings: [], partial: true, locationVerified: false };
  let cleanup = 'not_created';
  let stage = 'launch';
  try {
    browser = await launch(binding, { keep_alive: 60000, ...(engine === 'kitesurf' ? { browser: engine } : {}) });
    const work = async () => {
      stage = 'new_page';
      const page = await browser.newPage();
      await page.setViewport({ width: 1365, height: 900 });
      stage = 'navigation';
      const response = await page.goto(requestedUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
      // Bounded render wait; no pagination, consent clicks or login attempts.
      await page.waitForFunction(() => document.querySelector('a[href*="/marketplace/item/"], [role="dialog"], input[type="password"]'), { timeout: 5000 }).catch(() => {});
      stage = 'extraction';
      // Parse in the Worker: bundler-added helpers are not available inside page.evaluate.
      // Raw state stays in memory and is never logged or returned to the caller.
      const state = await page.evaluate(() => ({
        url: location.href, text: document.body?.innerText?.slice(0, 100000) || '',
        scripts: Array.from(document.querySelectorAll('script[type="application/json"]')).map(s => s.textContent).filter(s => s.includes('marketplace_search')).slice(0, 100),
        links: Array.from(document.querySelectorAll('a[href]')).map(a => a.href),
        dialogs: Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"]')).filter(e => e.getClientRects().length).map(e => e.innerText).join(' '),
      }));
      const extracted = inspectFacebookPage(state, requestedUrl);
      return { ...extracted, httpStatus: response?.status() ?? null };
    };
    report = await Promise.race([work(), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('deadline')), 35000);
    })]);
  } catch (error) {
    report.status = browser ? (error.name === 'TimeoutError' || error.message === 'deadline' ? 'timeout' : 'browser_command_failed') : 'browser_launch_failed';
    report.failedStage = stage;
    report.browserErrorCode = String(error.message).match(/net::ERR_[A-Z_]+/)?.[0] ?? null;
    if (/429|rate.limit|too many|concurren/i.test(String(error.message))) report.status = 'rate_limited';
    else if (/401|403|unauthorized|forbidden/i.test(String(error.message))) report.status = 'provider_access_denied';
  } finally {
    clearTimeout(timer);
    if (browser) {
      let closeTimer;
      try {
        await Promise.race([browser.close(), new Promise((_, reject) => { closeTimer = setTimeout(() => reject(new Error('close timeout')), 5000); })]);
        cleanup = 'completed';
      } catch { cleanup = 'failed'; }
      finally { clearTimeout(closeTimer); }
    }
  }
  return { requestedUrl, ...report, provider: 'cloudflare', engine, cleanup,
    elapsedMs: Date.now() - started, checkedAt: new Date().toISOString() };
}
