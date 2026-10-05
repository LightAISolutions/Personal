/**
 * Phase 17b — the app's command shortcuts under Playwright: the "What do you need?" box, ★ Pinned and Recent on Home, the
 * trip card's buttons, a brochure day's and a stop's ⋯ buttons, and the Settings screen with its folded Helper health, in
 * light and dark. Every op is answered by the real bundle (core + pack) on the invented Lark Bay world from the Phase 12 tests;
 * no network. Run: node helpers/tests/shell_helper-app_shortcuts.playwright.mjs [--out DIR]
 * (screenshots default to helpers/decisions/screenshots/phase-17b). Exit 1 on any failed assertion. Invented data only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = (() => { const i = process.argv.indexOf('--out'); return i > 0 ? path.resolve(process.argv[i + 1]) : path.join(ROOT, 'helpers', 'decisions', 'screenshots', 'phase-17b'); })();
const PAGE_ORIGIN = 'https://pages.example.invalid';
const CORE = 'https://script.google.com/macros/s/FIXTURE_DEPLOYMENT_ID/exec';
const url = (q) => PAGE_ORIGIN + '/helper-app.html?core=' + encodeURIComponent(CORE) + (q ? '&' + q : '');
fs.mkdirSync(OUT, { recursive: true });

const H = require('./harness/gas-mocks');
const W = require('./pack_tour-guide_phase12_world');
const SEED = { cmd_pins: JSON.stringify([{ t: '/journey on', n: 1, at: 1 }]),
  cmd_recent: JSON.stringify([{ t: '/bookings', n: 3, at: 3 }, { t: '/today', n: 2, at: 2 }, { t: '/ping', n: 1, at: 1 }]) };

/* ---------- the Telegram.WebApp stub, served in place of telegram.org's script ---------- */
function tgStub(scheme, withInitData) {
  const theme = scheme === 'dark'
    ? { bg_color: '#17212b', text_color: '#f5f5f5', hint_color: '#9fa8b2', link_color: '#6ab3f3', button_color: '#5288c1', button_text_color: '#ffffff', secondary_bg_color: '#232e3c', section_bg_color: '#17212b', accent_text_color: '#6ab3f3', destructive_text_color: '#ef5b5b' }
    : { bg_color: '#ffffff', text_color: '#1a1a1a', hint_color: '#6f6f6f', link_color: '#2a6fb0', button_color: '#2a6fb0', button_text_color: '#ffffff', secondary_bg_color: '#f4f3ef', section_bg_color: '#ffffff', accent_text_color: '#2a6fb0', destructive_text_color: '#c0392b' };
  return `window.__tg = { main: { text: '', visible: false, fn: null, progress: false }, back: { visible: false, fn: null }, opened: [], storage: window.__seed || {}, events: {} };
  window.Telegram = { WebApp: {
    initData: ${JSON.stringify(withInitData ? 'query_id=AAFixture&user=%7B%22id%22%3A777%7D&auth_date=1700000000&hash=' + 'f'.repeat(64) : '')},
    initDataUnsafe: { user: { id: 777 }, auth_date: 1700000000, start_param: '' },
    colorScheme: ${JSON.stringify(scheme)}, themeParams: ${JSON.stringify(theme)}, viewportStableHeight: 844, viewportHeight: 844,
    ready() {}, expand() {}, setHeaderColor() {}, setBackgroundColor() {}, onEvent(n, f) { window.__tg.events[n] = f; },
    openLink(u) { window.__tg.opened.push(u); },
    HapticFeedback: { selectionChanged() {}, notificationOccurred() {} },
    MainButton: { setText(t) { window.__tg.main.text = t; }, show() { window.__tg.main.visible = true; }, hide() { window.__tg.main.visible = false; }, enable() {}, disable() {}, showProgress() { window.__tg.main.progress = true; }, hideProgress() { window.__tg.main.progress = false; }, onClick(f) { window.__tg.main.fn = f; } },
    BackButton: { show() { window.__tg.back.visible = true; }, hide() { window.__tg.back.visible = false; }, onClick(f) { window.__tg.back.fn = f; } },
    CloudStorage: { setItem(k, v, cb) { window.__tg.storage[k] = v; cb && cb(null, true); }, getItem(k, cb) { cb(null, window.__tg.storage[k] || ''); }, getItems(ks, cb) { const o = {}; ks.forEach((k) => { o[k] = window.__tg.storage[k] || ''; }); cb(null, o); }, removeItem(k, cb) { delete window.__tg.storage[k]; cb && cb(null, true); } },
    showConfirm(msg, cb) { window.__tg.confirmed = msg; cb(true); }
  } };`;
}

/* ---------- runner ---------- */
const failures = [];
const check = (cond, msg) => { if (!cond) { failures.push(msg); console.log('  FAIL ' + msg); } else console.log('  ok   ' + msg); };
const PAGE_HTML = fs.readFileSync(path.join(ROOT, 'live-site-pages', 'helper-app.html'), 'utf8');
const VERSION_TXT = fs.readFileSync(path.join(ROOT, 'live-site-pages', 'html-versions', 'helper-apphtml.version.txt'), 'utf8');
async function open(browser, scheme, q) {
  const world = W.fresh(W.at(W.DATES[1], '13:00'));
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const calls = [], errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript((seed) => { window.__seed = seed; }, SEED);
  await page.route('**/*', async (route) => {
    const req = route.request(), u = req.url();
    if (u.startsWith(PAGE_ORIGIN + '/helper-app.html')) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: PAGE_HTML });
    if (u.startsWith(PAGE_ORIGIN + '/html-versions/')) return route.fulfill({ status: 200, contentType: 'text/plain', body: VERSION_TXT });
    if (u === 'https://telegram.org/js/telegram-web-app.js') return route.fulfill({ status: 200, contentType: 'application/javascript', body: tgStub(scheme, true) + ';window.Telegram.WebApp.close=function(){window.__tg.closed=true;};' });
    if (u.startsWith(CORE)) {
      let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (e) { /* bad */ }
      calls.push({ op: body.op, args: body.args });
      const r = H.appPost(world.ctx, world.state, 'app', { op: body.op, args: body.args || {} });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r) });
    }
    if (u.startsWith(PAGE_ORIGIN + '/')) return route.fulfill({ status: 404, body: '' });
    return route.abort();
  });
  await page.goto(url(q), { waitUntil: 'load' });
  await page.waitForTimeout(600);
  return { page, ctx, calls, errors };
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: false });
const text = (page) => page.evaluate(() => document.body.innerText);
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const browser = await chromium.launch({ headless: true });
try {
  for (const scheme of ['light', 'dark']) {
    console.log('scheme ' + scheme);
    // Home: the box, the shortcuts, the trip card's buttons.
    let o = await open(browser, scheme, '');
    let t = await text(o.page);
    check(t.includes('★ /journey on') && t.includes('↻ /bookings'), 'Home shows ★ pinned then the most used');
    check(await o.page.locator('[data-trip-acts]').count() >= 1, 'the trip card has buttons');
    await o.page.fill('[aria-label="What do you need"]', 'running late'); await o.page.waitForTimeout(500);
    check(await o.page.locator('[data-need] [data-cmd]').first().getAttribute('data-cmd') === '/late', '"running late" finds /late first');
    await shot(o.page, scheme + '-1-home-need');
    await o.page.click('[data-trip-acts] [data-toggle]'); await o.page.waitForTimeout(200);
    await o.page.locator('[data-trip-acts]').first().scrollIntoViewIfNeeded();
    await shot(o.page, scheme + '-2-home-trip-more');
    check(await noSideScroll(o.page), 'Home: no sideways scroll at 390 px');
    check(o.errors.length === 0, 'Home: no page errors: ' + o.errors.join(' | '));
    await o.ctx.close();
    // Brochure: a day's ⋯ This day and a stop's ⋯.
    o = await open(browser, scheme, 'screen=brochure&trip=' + W.TRIP);
    const day = o.page.locator('[data-day-acts="' + W.DATES[1] + '"]');
    check(await day.count() === 1, 'the brochure day of today has its buttons');
    await day.locator('[data-toggle]').first().click(); await o.page.waitForTimeout(200);
    await day.scrollIntoViewIfNeeded();
    await shot(o.page, scheme + '-3-brochure-day');
    await day.locator('[data-act]', { hasText: 'Check-in' }).click(); await o.page.waitForTimeout(300);
    check(o.calls.some((c) => c.op === 'commands.run' && c.args.text === '/checkin ' + W.DATES[1]), 'Check-in runs for that day');
    check(o.errors.length === 0, 'Brochure: no page errors: ' + o.errors.join(' | '));
    await o.ctx.close();
    // Settings with the health panel open.
    o = await open(browser, scheme, 'screen=settings');
    t = await text(o.page);
    check(t.includes('Settings') && (await o.page.locator('[data-switch]').count()) >= 4, 'Settings shows the switches');
    await shot(o.page, scheme + '-4-settings');
    await o.page.click('[data-health] summary'); await o.page.waitForTimeout(200);
    await o.page.locator('[data-health]').scrollIntoViewIfNeeded();
    await shot(o.page, scheme + '-5-settings-health');
    check(await noSideScroll(o.page), 'Settings: no sideways scroll at 390 px');
    check(o.errors.length === 0, 'Settings: no page errors: ' + o.errors.join(' | '));
    await o.ctx.close();
  }
} finally { await browser.close(); }
if (failures.length) { console.log(failures.length + ' failed'); process.exit(1); }
console.log('all passed · screenshots in ' + OUT);
// Developed by: LightAISolutions
