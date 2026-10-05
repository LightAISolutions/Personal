/**
 * Phase 17a — the Commands tab under Playwright: Run, Fill in (a form drawn from the registry), the preview, the MainButton,
 * "Sent" and Type your own, in light and dark. The commands.list answer is the real op's, from the GAS harness; the core is
 * stubbed by page.route(); no network. Run: node helpers/tests/shell_helper-app_commands.playwright.mjs [--out DIR]
 * (screenshots default to helpers/decisions/screenshots/phase-17a). Exit 1 on any failed assertion. Invented data only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = (() => { const i = process.argv.indexOf('--out'); return i > 0 ? path.resolve(process.argv[i + 1]) : path.join(ROOT, 'helpers', 'decisions', 'screenshots', 'phase-17a'); })();
const PAGE_ORIGIN = 'https://pages.example.invalid';
const CORE = 'https://script.google.com/macros/s/FIXTURE_DEPLOYMENT_ID/exec';
const PAGE_URL = PAGE_ORIGIN + '/helper-app.html?core=' + encodeURIComponent(CORE) + '&screen=commands';
fs.mkdirSync(OUT, { recursive: true });

const H = require('./harness/gas-mocks');
const LIST = (() => { const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: '2027-06-11T12:00:00Z' }); H.bootstrap(ctx, state); return H.appPost(ctx, state, 'app', { op: 'commands.list' }); })();
const CTX = { ok: true, trip: { slug: 'lark-bay', title: 'Lark Bay', start: '2027-06-10', end: '2027-06-12' }, today: '2027-06-11',
  trips: [{ slug: 'lark-bay', title: 'Lark Bay' }], places: ['Harbour Museum', 'Old Mill Hostel', 'Salt House'], lists: [{ name: 'Coffee to try', count: 7 }], sections: [{ value: 'food', label: 'Food' }],
  days: [{ date: '2027-06-10', n: 1, theme: 'Arrival', planned: true }, { date: '2027-06-11', n: 2, theme: 'Shore', planned: true }, { date: '2027-06-12', n: 3, theme: 'On to Fernmoor', planned: true }] };
function answer(op, args) {
  if (op === 'commands.list') return LIST;
  if (op === 'commands.context') return CTX;
  if (op === 'commands.run') return { ok: true, cmd: String(args.text).split(' ')[0], message_id: 42 };
  return { ok: false, status: 400, reason: 'unknown_op' };
}

/* ---------- the Telegram.WebApp stub, served in place of telegram.org's script ---------- */
function tgStub(scheme, withInitData) {
  const theme = scheme === 'dark'
    ? { bg_color: '#17212b', text_color: '#f5f5f5', hint_color: '#9fa8b2', link_color: '#6ab3f3', button_color: '#5288c1', button_text_color: '#ffffff', secondary_bg_color: '#232e3c', section_bg_color: '#17212b', accent_text_color: '#6ab3f3', destructive_text_color: '#ef5b5b' }
    : { bg_color: '#ffffff', text_color: '#1a1a1a', hint_color: '#6f6f6f', link_color: '#2a6fb0', button_color: '#2a6fb0', button_text_color: '#ffffff', secondary_bg_color: '#f4f3ef', section_bg_color: '#ffffff', accent_text_color: '#2a6fb0', destructive_text_color: '#c0392b' };
  return `window.__tg = { main: { text: '', visible: false, fn: null, progress: false }, back: { visible: false, fn: null }, opened: [], storage: {}, events: {} };
  window.Telegram = { WebApp: {
    initData: ${JSON.stringify(withInitData ? 'query_id=AAFixture&user=%7B%22id%22%3A777%7D&auth_date=1700000000&hash=' + 'f'.repeat(64) : '')},
    initDataUnsafe: { user: { id: 777 }, auth_date: 1700000000, start_param: '' },
    colorScheme: ${JSON.stringify(scheme)}, themeParams: ${JSON.stringify(theme)}, viewportStableHeight: 844, viewportHeight: 844,
    ready() {}, expand() {}, setHeaderColor() {}, setBackgroundColor() {}, onEvent(n, f) { window.__tg.events[n] = f; },
    openLink(u) { window.__tg.opened.push(u); },
    HapticFeedback: { selectionChanged() {}, notificationOccurred() {} },
    MainButton: { setText(t) { window.__tg.main.text = t; }, show() { window.__tg.main.visible = true; }, hide() { window.__tg.main.visible = false; }, enable() {}, disable() {}, showProgress() { window.__tg.main.progress = true; }, hideProgress() { window.__tg.main.progress = false; }, onClick(f) { window.__tg.main.fn = f; } },
    BackButton: { show() { window.__tg.back.visible = true; }, hide() { window.__tg.back.visible = false; }, onClick(f) { window.__tg.back.fn = f; } },
    CloudStorage: { setItem(k, v, cb) { window.__tg.storage[k] = v; cb && cb(null, true); }, getItem(k, cb) { cb(null, window.__tg.storage[k] || ''); }, removeItem(k, cb) { delete window.__tg.storage[k]; cb && cb(null, true); } },
    showConfirm(msg, cb) { window.__tg.confirmed = msg; cb(true); }
  } };`;
}

/* ---------- runner ---------- */
const failures = [];
const check = (cond, msg) => { if (!cond) { failures.push(msg); console.log('  FAIL ' + msg); } else console.log('  ok   ' + msg); };
const PAGE_HTML = fs.readFileSync(path.join(ROOT, 'live-site-pages', 'helper-app.html'), 'utf8');
const VERSION_TXT = fs.readFileSync(path.join(ROOT, 'live-site-pages', 'html-versions', 'helper-apphtml.version.txt'), 'utf8');
async function open(browser, scheme) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const calls = [], errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('**/*', async (route) => {
    const req = route.request(), u = req.url();
    if (u.startsWith(PAGE_ORIGIN + '/helper-app.html')) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: PAGE_HTML });
    if (u.startsWith(PAGE_ORIGIN + '/html-versions/')) return route.fulfill({ status: 200, contentType: 'text/plain', body: VERSION_TXT });
    if (u === 'https://telegram.org/js/telegram-web-app.js') return route.fulfill({ status: 200, contentType: 'application/javascript', body: tgStub(scheme, true) + ';window.Telegram.WebApp.close=function(){window.__tg.closed=true;};' });
    if (u.startsWith(CORE)) {
      let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (e) { /* bad */ }
      calls.push({ op: body.op, args: body.args });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer(body.op, body.args || {})) });
    }
    if (u.startsWith(PAGE_ORIGIN + '/')) return route.fulfill({ status: 404, body: '' });
    return route.abort();
  });
  await page.goto(PAGE_URL, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  return { page, ctx, calls, errors };
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: false });
const text = (page) => page.evaluate(() => document.body.innerText);
const browser = await chromium.launch({ headless: true });
try {
  for (const scheme of ['light', 'dark']) {
    console.log('scheme ' + scheme);
    const { page, ctx, calls, errors } = await open(browser, scheme);
    check((await text(page)).includes('Run sends one through the bot'), 'the Commands tab explains Run');
    await page.locator('[data-cmd="/late"]').scrollIntoViewIfNeeded();
    await shot(page, scheme + '-1-list');
    const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    check(noHScroll, 'no sideways scroll at 390 px');
    await page.click('[data-fill="/late 30"]'); await page.waitForTimeout(300);
    check((await text(page)).includes('Fill in: Minutes'), 'the /late form says what is missing');
    await page.click('[data-field="min"] [data-v="30"]');
    await page.click('[data-field="day"] [data-v="2027-06-12"]');
    check(await page.locator('.preview').innerText() === '/late 30 2027-06-12', 'the preview shows the exact command');
    check(await page.evaluate(() => window.__tg.main.text === 'Run' && window.__tg.main.visible), 'MainButton reads Run');
    check(await page.evaluate(() => window.__tg.back.visible), 'BackButton shown on the form');
    await shot(page, scheme + '-2-form-late');
    await page.evaluate(() => window.__tg.main.fn()); await page.waitForTimeout(300);
    const run = calls.filter((c) => c.op === 'commands.run');
    check(run.length === 1 && run[0].args.text === '/late 30 2027-06-12' && /^[A-Za-z0-9_-]{8,40}$/.test(run[0].args.nonce), 'Run sends it with a nonce');
    check((await text(page)).includes('The answer is in the chat'), 'then "Sent"');
    await shot(page, scheme + '-3-sent');
    await page.click('text=Go to chat');
    check(await page.evaluate(() => window.__tg.closed === true), 'Go to chat closes the app');
    await page.click('text=Back'); await page.waitForTimeout(200);
    await page.evaluate(() => window.__tg.back.fn()); await page.waitForTimeout(300);
    check((await text(page)).includes('Everything you can send in the chat'), 'Back from the form returns to the list');
    await page.click('[data-fill^="/route"]'); await page.waitForTimeout(300);
    await page.fill('[data-field="from"] input', 'Old Mill Hostel');
    await page.fill('[data-field="to"] input', 'Harbour Museum');
    await page.click('[data-field="mode"] [data-v="walk"]');
    check(await page.locator('.preview').innerText() === '/route Old Mill Hostel → Harbour Museum walk', 'the /route form fills both places and the mode');
    await shot(page, scheme + '-4-form-route');
    await page.evaluate(() => window.__tg.back.fn()); await page.waitForTimeout(300);
    await page.click('[data-cmd="/ask"] [data-own]');
    await page.fill('[data-cmd="/ask"] .own input', '/ask is the harbour ferry running today?');
    await page.locator('[data-cmd="/ask"]').scrollIntoViewIfNeeded();
    await shot(page, scheme + '-5-type-own');
    await page.click('[data-cmd="/ask"] [data-own-run]'); await page.waitForTimeout(300);
    check(calls.filter((c) => c.op === 'commands.run').slice(-1)[0].args.text === '/ask is the harbour ferry running today?', 'Type your own runs what was typed');
    check(errors.length === 0, 'no page errors: ' + errors.join(' | '));
    await ctx.close();
  }
} finally { await browser.close(); }
if (failures.length) { console.log(failures.length + ' failed'); process.exit(1); }
console.log('all passed · screenshots in ' + OUT);
// Developed by: LightAISolutions
