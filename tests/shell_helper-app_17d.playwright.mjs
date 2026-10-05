#!/usr/bin/env node
/**
 * Phase 17d in a real browser: the progress bar after an ask (Jon, 5 Oct 2026: "an ETA or a progress bar"). A Quiet form
 * ask shows the bar with elapsed time and "about N min left"; once two quiet boards have been answered the estimate is
 * "usually ~N min"; the board opens by itself when it lands. Same fake origin, real bundle in the Lark Bay world and
 * Telegram stub as the 17c check. Run:
 *   node helpers/tests/shell_helper-app_17d.playwright.mjs [--out DIR]
 * (screenshots default to helpers/decisions/screenshots/phase-17d). Exit 1 on any failed assertion. Invented data only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = (() => { const i = process.argv.indexOf('--out'); return i > 0 ? path.resolve(process.argv[i + 1]) : path.join(ROOT, 'helpers', 'decisions', 'screenshots', 'phase-17d'); })();
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
  return { page, ctx, calls, errors, world };
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: false });
const text = (page) => page.evaluate(() => document.body.innerText);
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const QUIET = JSON.parse(fs.readFileSync(path.join(ROOT, 'helpers', 'packs', 'tour-guide', 'quiet', 'fixtures', 'quiet-sample.json'), 'utf8'));
function board(id, name) {
  const p = JSON.parse(JSON.stringify(QUIET.valid[0]));
  p.id = id; p.trip = W.TRIP; p.created_on = W.DATES[1]; p.date = W.DATES[1];
  p.magnet = { ...p.magnet, name, slug: name.toLowerCase().replace(/\s+/g, '-'), place_id: 'FixtureLb' + name.replace(/\s+/g, '') };
  delete p.magnet.source;
  return p;
}
const bar = (page) => page.evaluate(() => {
  const w = document.getElementById('watch'), p = w && w.querySelector('.wprog'), m = w && w.querySelector('.wmeta');
  return { shown: !!w && w.offsetParent !== null, text: w ? w.innerText : '', pct: p ? Number(p.getAttribute('aria-valuenow')) : -1, meta: m ? m.textContent : '' };
});
async function ask(o, place) {
  await o.page.fill('[aria-label="Which busy place"]', place);
  await o.page.click('text=🕊 Find quieter places'); await o.page.waitForTimeout(1500);
}
// asked a little while ago: the core's clock steps forward right after the ask, so the bar shows elapsed time and progress
let afterAsk = null;
const appPost = H.appPost;
H.appPost = (ctx, state, kind, body) => { const r = appPost(ctx, state, kind, body); if (body && body.op === 'quiet.new' && afterAsk) { afterAsk(ctx); afterAsk = null; } return r; };
const browser = await chromium.launch({ headless: true });
try {
  for (const scheme of ['light', 'dark']) {
    console.log('scheme ' + scheme);
    // a first ask: no history yet, so the estimate is the default for a quiet board
    let o = await open(browser, scheme, 'screen=quiet');
    await ask(o, 'Kite Museum');
    let b = await bar(o.page);
    check(b.shown && b.text.includes('🕊 Quieter than Kite Museum'), 'the bar names the ask');
    check(b.pct >= 0 && b.pct < 95, 'the bar has a progress value (' + b.pct + ')');
    check(/^0:0\d · about 6 min left · first guess ~6 min$/.test(b.meta), 'first guess from the default: ' + b.meta);
    check(await noSideScroll(o.page), 'no sideways scroll at 390 px');
    await shot(o.page, scheme + '-1-first-guess');
    check(o.errors.length === 0, 'first ask: no page errors: ' + o.errors.join(' | '));
    await o.ctx.close();
    // with history: two boards answered in 2 and 4 minutes → "usually ~3 min"; then the answer lands and opens
    o = await open(browser, scheme, 'screen=quiet');
    const T = Date.parse(W.at(W.DATES[1], '13:00'));
    for (const [i, took] of [[0, 120], [1, 240]]) {
      o.world.ctx.__TEST_NOW = new Date(T - (20 - i * 5) * 60000).toISOString();
      const r = H.appPost(o.world.ctx, o.world.state, 'app', { op: 'quiet.new', args: { place: 'Old Mill ' + i } });
      o.world.ctx.__TEST_NOW = new Date(T - (20 - i * 5) * 60000 + took * 1000).toISOString();
      o.world.ctx.markRequestAnswered(r.request_id, { type: 'quiet' });
    }
    o.world.ctx.__TEST_NOW = new Date(T).toISOString();
    afterAsk = (ctx) => { ctx.__TEST_NOW = new Date(T + 75000).toISOString(); };
    await ask(o, 'Lantern Shrine');
    b = await bar(o.page);
    check(/^1:1\d · about 2 min left · usually ~3 min$/.test(b.meta) && b.pct > 30 && b.pct < 60, 'the estimate comes from past answers: ' + b.meta);
    await shot(o.page, scheme + '-2-usually');
    if (scheme === 'light') {
      const open1 = o.calls.filter((c) => c.op === 'quiet.new').pop();
      check(!!open1, 'the form asked quiet.new');
      W.deliver(o.world.ctx, o.world.state, 'quiet', board('qt-20270611-lantern-shrine', 'Lantern Shrine'));
      await o.page.waitForTimeout(11500);
      check((await text(o.page)).includes('Lantern Shrine') && !(await o.page.locator('#watch').isVisible()), 'the new board opened and the bar went away');
      await shot(o.page, scheme + '-3-opened');
    }
    check(o.errors.length === 0, 'with history: no page errors: ' + o.errors.join(' | '));
    await o.ctx.close();
  }
} finally { await browser.close(); }
if (failures.length) { console.log(failures.length + ' failed'); process.exit(1); }
console.log('all passed · screenshots in ' + OUT);
// Developed by: LightAISolutions
