/**
 * WP-9c — the Mini App shell (live-site-pages/helper-app.html) under Playwright with a stubbed Telegram.WebApp and a
 * stubbed core. No network: telegram.org, the page origin and the fixture core are all answered by page.route().
 * Run: node helpers/tests/shell_helper-app.playwright.mjs [--out DIR]   (screenshots default to helpers/decisions/screenshots/wp-9c)
 * Exit 1 on any failed assertion. Fixture data is invented (Harbor Town).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = (() => { const i = process.argv.indexOf('--out'); return i > 0 ? path.resolve(process.argv[i + 1]) : path.join(ROOT, 'helpers', 'decisions', 'screenshots', 'wp-9c'); })();
const PAGE_ORIGIN = 'https://pages.example.invalid';
const CORE = 'https://script.google.com/macros/s/FIXTURE_DEPLOYMENT_ID/exec';
const PAGE_URL = PAGE_ORIGIN + '/helper-app.html?core=' + encodeURIComponent(CORE);
fs.mkdirSync(OUT, { recursive: true });

/* ---------- invented fixtures ---------- */
const TRIP = { slug: 'harbor-town-2027', title: 'Harbor Town', destination: 'Harbor Town', start: '2027-05-12', end: '2027-05-15', status: 'choosing', build_id: 'b-fixture-01', has_brochure: true, verified_on: '2027-05-01', lodging: 'Quay Street inn' };
const ITEM = (key, n, name, why, min, area, gem) => ({ key, n, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, why_you: why, est_minutes: min, area, maps_url: 'https://maps.google.com/?q=' + encodeURIComponent(name), gem: !!gem, labels: gem ? ['hidden gem'] : [], choice: '' });
const SHORTLIST = { ok: true, trip: TRIP.slug, run: 'run-fixture-1', round: 1, more: true, stage: 'choose', groups: [
  { id: 'activities', title: 'Activities', items: [ITEM('a1', 1, 'Lighthouse Walk', 'A quiet cliff path you said you like — early light, no crowds.', 90, 'Old Harbour'), ITEM('a2', 2, 'Tide Pool Museum', 'Small, hands-on, closes early — fits your slow mornings.', 60, 'Quay Street'), ITEM('a3', 3, 'Rope Makers\' Lane', 'Working craft lane, no tickets, locals only.', 45, 'Rope Quarter', true), ITEM('a4', 4, 'Harbour Ferry Loop', 'Forty minutes on the water for the price of a bus ticket.', 40, 'Pier 3')] },
  { id: 'food', title: 'Food', items: [ITEM('f1', 1, 'Salt Kitchen', 'Vegetable-first set lunch, changes daily.', 60, 'Quay Street'), ITEM('f2', 2, 'Kelp & Barley', 'Brewery canteen; the barley bowl is the local plate.', 50, 'Rope Quarter', true), ITEM('f3', 3, 'The Net Loft Café', 'Cardamom buns, sea view, cash only.', 30, 'Old Harbour')] }] };
const DIGEST = { ok: true, trip: TRIP, days: [
  { date: '2027-05-12', theme: 'Old Harbour on foot', stops: [{ n: 1, slug: 'lighthouse-walk', name: 'Lighthouse Walk', arrive: '09:00', depart: '10:30', minutes: 90, maps_url: 'https://maps.google.com/?q=Lighthouse+Walk', note_line: 'Go before the tour boats dock.' }, { n: 2, slug: 'the-net-loft-cafe', name: 'The Net Loft Café', arrive: '10:45', depart: '11:15', minutes: 30, maps_url: 'https://maps.google.com/?q=Net+Loft', note_line: 'Cash only.' }], legs: [{ from: 'lighthouse-walk', to: 'the-net-loft-cafe', mode: 'walk', minutes: 12 }], warnings: ['The museum closes at 15:00 on Wednesdays.'], rain: [{ slug: 'tide-pool-museum', name: 'Tide Pool Museum', instead_of: 'Lighthouse Walk', km: 0.8, maps_url: 'https://maps.google.com/?q=Tide+Pool+Museum' }] },
  { date: '2027-05-13', theme: 'Rope Quarter', stops: [{ n: 1, slug: 'rope-makers-lane', name: 'Rope Makers\' Lane', arrive: '10:00', depart: '10:45', minutes: 45, maps_url: 'https://maps.google.com/?q=Rope+Makers', note_line: '' }], legs: [], warnings: [], rain: [] }],
  later: [{ slug: 'harbour-ferry-loop', name: 'Harbour Ferry Loop', reason: 'owner_choice', reason_text: 'saved by you' }] };
const BROCHURE_HTML = '<!doctype html><html><head><title>Harbor Town brochure</title><style>body{font-family:Georgia,serif;padding:16px}h1{color:#2a6fb0}</style></head><body><h1 id="d1">Harbor Town — 3 days</h1><p>Day 1 — Old Harbour on foot.</p><script>document.body.setAttribute("data-ran","1");try{parent.__pwned=1;}catch(e){}</script><p id="after">If this line shows and nothing above ran, the sandbox held.</p></body></html>';
const PLACES = [{ slug: 'lighthouse-walk', name: 'Lighthouse Walk', destination: 'Harbor Town', area: 'Old Harbour', category: 'walk', tags: ['outdoor', 'free'], status: 'planned', last_trip: 'harbor-town-2027', last_verified: '2027-05-01', note_line: 'Go before the tour boats dock.', maps_url: 'https://maps.google.com/?q=Lighthouse+Walk' },
  { slug: 'salt-kitchen', name: 'Salt Kitchen', destination: 'Harbor Town', area: 'Quay Street', category: 'restaurant', tags: ['vegetarian', 'lunch'], status: 'wanted', last_trip: 'harbor-town-2027', last_verified: '2027-05-01', note_line: 'Vegetable-first set lunch, changes daily.', maps_url: 'https://maps.google.com/?q=Salt+Kitchen' },
  { slug: 'kelp-and-barley', name: 'Kelp & Barley', destination: 'Harbor Town', area: 'Rope Quarter', category: 'restaurant', tags: ['gem'], status: 'later', last_trip: '', last_verified: '', note_line: 'Brewery canteen; the barley bowl is the local plate.', maps_url: 'https://maps.google.com/?q=Kelp' }];
const BANK = { v: 1, title: 'Travel preferences interview', sections: [
  { id: 'pace', title: 'Pace & rhythm', questions: [{ qid: 'pace-01', text: 'How full should a typical sightseeing day be?', kind: 'scale', dimension: 'pace', options: [{ label: 'Relaxed', value: 'relaxed', polarity: '+' }, { label: 'Normal', value: 'normal', polarity: '+' }, { label: 'Packed', value: 'packed', polarity: '+' }], skip_ok: true }] },
  { id: 'food', title: 'Food', questions: [{ qid: 'food-01', text: 'Which foods do you look forward to? Pick any.', kind: 'multi', dimension: 'food', options: [{ label: 'Local specialties', value: 'local', polarity: '+' }, { label: 'Street food', value: 'street', polarity: '+' }, { label: 'Fine dining', value: 'fine', polarity: '+' }], skip_ok: true, other: true },
    { qid: 'food-03', text: 'Anything you cannot eat?', kind: 'text', dimension: 'food', options: [], skip_ok: true }] }] };
const FACTS = { ok: true, trip: TRIP.slug, found: [{ n: '1', kind: 'dates', text: 'May 12 – May 15, 2027', start: '2027-05-12', end: '2027-05-15', choice: '' }, { n: '2', kind: 'lodging', text: 'Quay Street inn, 3 nights', choice: '' }, { n: '3', kind: 'flight', text: 'Arrives 11:40 on May 12', choice: '' }], missing: ['companions'] };
const HOME = { ok: true, trips: [TRIP, { slug: 'moor-weekend-2026', title: 'Moor weekend', destination: 'High Moor', start: '2026-11-07', end: '2026-11-08', status: 'done', build_id: 'b-fixture-00', has_brochure: false }], trips_total: 2, choice_round: { trip: TRIP.slug, run: 'run-fixture-1', round: 1, items: 7, want: 0, later: 0, skip: 0, stage: '' }, pending_facts: { trip: TRIP.slug }, profile_summary: { updated: '2026-10-01' }, places: { 'Harbor Town': 3, 'High Moor': 5 } };

function answer(op, args, mode) {
  if (mode === 403) return { ok: false, status: 403, reason: 'forbidden' };
  if (mode === 429) return { ok: false, status: 429, reason: 'daily_cap' };
  if (mode === 'planning') {   // the chat moved past the shortlist: the round is closed, no facts are open
    if (op === 'home') return { ...HOME, choice_round: { ...HOME.choice_round, want: 2, later: 4, skip: 1, stage: 'planning' }, pending_facts: null };
    if (op === 'shortlist.get') return { ...SHORTLIST, stage: 'planning', more: false };
    if (op === 'shortlist.done' || op === 'facts.get') return { ok: false, status: 409, reason: 'no_flow', stage: 'planning' };
  }
  switch (op) {
    case 'home': return HOME;
    case 'shortlist.get': return SHORTLIST;
    case 'shortlist.choose_many': return { ok: true, applied: (args.choices || []).length, refused: [] };
    case 'shortlist.done': case 'shortlist.more': return { ok: true, started: true };
    case 'trip.digest': return DIGEST;
    case 'brochure.get': return mode === 'link' ? { ok: true, link: 'https://drive.example.invalid/file/fixture-brochure' } : { ok: true, html: BROCHURE_HTML };
    case 'places.search': return { ok: true, rows: PLACES.filter((p) => !args.query || (p.name + p.note_line).toLowerCase().includes(String(args.query).toLowerCase())), total: PLACES.length, filters: { destinations: ['Harbor Town', 'High Moor'], statuses: ['planned', 'wanted', 'later'], tags: ['outdoor', 'free', 'vegetarian', 'lunch', 'gem'] } };
    case 'places.get': return { ok: true, place: { ...PLACES[0], history: [{ trip: 'harbor-town-2027', date: '2027-05-01', text: 'Researched for the May trip; the path is closed in storms.' }] } };
    case 'places.check': return { ok: true, request_id: 'req-fixture-9', count: (args.slugs || []).length };
    case 'interview.bank': return { ok: true, bank: BANK, answers: [{ qid: 'pace-01', value: 'relaxed', polarity: '+', kind: 'scale' }] };
    case 'interview.submit': return { ok: true, request_id: 'req-fixture-10', answers: (args.answers || []).length };
    case 'facts.get': return FACTS;
    case 'facts.confirm': return { ok: true, applied: (args.facts || []).length + (args.edits || []).length, refused: [], done: true };
    default: return { ok: false, status: 400, reason: 'unknown_op' };
  }
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
    CloudStorage: { setItem(k, v, cb) { window.__tg.storage[k] = v; cb && cb(null, true); }, getItem(k, cb) { cb(null, window.__tg.storage[k] || ''); } }
  } };`;
}

/* ---------- runner ---------- */
const failures = [];
const check = (cond, msg) => { if (!cond) { failures.push(msg); console.log('  FAIL ' + msg); } else console.log('  ok   ' + msg); };
const PAGE_HTML = fs.readFileSync(path.join(ROOT, 'live-site-pages', 'helper-app.html'), 'utf8');
const VERSION_TXT = fs.readFileSync(path.join(ROOT, 'live-site-pages', 'html-versions', 'helper-apphtml.version.txt'), 'utf8');

async function open(browser, { scheme = 'light', telegram = true, initData = true, mode = null, url = PAGE_URL } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const calls = [], foreign = [], errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Blocked script execution in 'about:srcdoc'/.test(m.text())) errors.push(m.text()); });   // the sandbox refusing the brochure's script is the point
  await page.route('**/*', async (route) => {
    const req = route.request(), u = req.url();
    if (u.startsWith(PAGE_ORIGIN + '/helper-app.html')) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: PAGE_HTML });
    if (u.startsWith(PAGE_ORIGIN + '/html-versions/')) return route.fulfill({ status: 200, contentType: 'text/plain', body: VERSION_TXT });
    if (u.startsWith(PAGE_ORIGIN + '/')) return route.fulfill({ status: 404, body: '' });
    if (u === 'https://telegram.org/js/telegram-web-app.js') return route.fulfill({ status: 200, contentType: 'application/javascript', body: telegram ? tgStub(scheme, initData) : '' });
    if (u.startsWith(CORE)) {
      let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (e) { /* bad */ }
      calls.push({ op: body.op, args: body.args, initData: body.initData, ct: req.headers()['content-type'], method: req.method() });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer(body.op, body.args || {}, mode)) });
    }
    foreign.push(u); return route.abort();
  });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  return { page, ctx, calls, foreign, errors };
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png') });
const text = (page) => page.evaluate(() => document.body.innerText);
const nav = async (page, screen) => { await page.click(`nav button[data-screen="${screen}"]`); await page.waitForTimeout(500); };

const browser = await chromium.launch({ headless: true });
try {
  for (const scheme of ['light', 'dark']) {
    console.log('scheme ' + scheme);
    const { page, ctx, calls, foreign, errors } = await open(browser, { scheme });
    check((await text(page)).includes('Your trips'), 'home renders the trips');
    check(await page.evaluate(() => window.__tg.storage.core) === CORE, 'core kept in CloudStorage');
    check(calls.every((c) => c.method === 'POST' && c.ct === 'text/plain;charset=utf-8' && c.initData.length > 0), 'every call is a text/plain POST carrying initData');
    await shot(page, scheme + '-1-home');
    await nav(page, 'shortlist'); await shot(page, scheme + '-2-shortlist');
    check((await text(page)).includes('Lighthouse Walk'), 'shortlist lists the items');
    await nav(page, 'facts'); await shot(page, scheme + '-3-facts');
    await nav(page, 'interview'); await shot(page, scheme + '-4-interview');
    await nav(page, 'brochure'); await page.waitForTimeout(600); await shot(page, scheme + '-5-brochure');
    await nav(page, 'places'); await page.waitForTimeout(500); await shot(page, scheme + '-6-places');
    check(foreign.length === 0, 'no request left for a foreign host (' + foreign.join(' ') + ')');
    check(errors.length === 0, 'no page errors (' + errors.join(' | ') + ')');
    await ctx.close();
  }

  console.log('shortlist batch');
  {
    const { page, ctx, calls } = await open(browser, {});
    await nav(page, 'shortlist');
    await page.click('.item[data-key="a1"] button[data-v="w"]'); await page.click('.item[data-key="a3"] button[data-v="l"]'); await page.click('.item[data-key="f2"] button[data-v="s"]'); await page.click('.item[data-key="a1"] button[data-v="w"]'); await page.click('.item[data-key="a1"] button[data-v="l"]');
    check(calls.filter((c) => c.op && c.op.startsWith('shortlist.choose')).length === 0, 'ticks send nothing');
    check(await page.evaluate(() => window.__tg.main.text) === 'Save 3 choices' && await page.evaluate(() => window.__tg.main.visible), 'MainButton reads "Save 3 choices"');
    await page.evaluate(() => window.__tg.main.fn()); await page.waitForTimeout(400);
    const batch = calls.filter((c) => c.op === 'shortlist.choose_many');
    check(batch.length === 1 && batch[0].args.run === 'run-fixture-1' && JSON.stringify(batch[0].args.choices) === JSON.stringify([{ n: 'a1', choice: 'l' }, { n: 'a3', choice: 'l' }, { n: 'f2', choice: 's' }]), 'one choose_many with the three final choices');
    check(await page.evaluate(() => window.__tg.main.text) === 'Done choosing', 'MainButton then reads "Done choosing"');
    await page.evaluate(() => window.__tg.main.fn()); await page.waitForTimeout(400);
    check(calls.filter((c) => c.op === 'shortlist.done').length === 1 && calls.filter((c) => c.op === 'shortlist.choose_many').length === 1, 'Done sends shortlist.done once and no second batch');
    await shot(page, 'state-shortlist-done');
    await ctx.close();
  }

  console.log('facts and interview submit');
  {
    const { page, ctx, calls } = await open(browser, {});
    await nav(page, 'facts');
    await page.click('.card:nth-of-type(1) .choices button[data-v="y"]'); await page.click('.card:nth-of-type(2) .choices button[data-v="e"]'); await page.fill('.card:nth-of-type(2) textarea', 'Quay Street inn, 2 nights'); await page.click('.card:nth-of-type(3) .choices button[data-v="n"]');
    await page.evaluate(() => window.__tg.main.fn()); await page.waitForTimeout(400);
    const fc = calls.filter((c) => c.op === 'facts.confirm');
    check(fc.length === 1 && JSON.stringify(fc[0].args) === JSON.stringify({ trip: TRIP.slug, facts: [{ n: '1', choice: 'y' }, { n: '3', choice: 'n' }], edits: [{ n: '2', text: 'Quay Street inn, 2 nights' }] }), 'facts.confirm carries keeps, drops and the edit');
    await nav(page, 'interview');
    await page.click('.choices button[data-v="packed"]'); await page.click('.choices button[data-v="local"]'); await page.click('.choices button[data-v="street"]'); await page.fill('input[type=text]', 'shellfish, peanuts');
    await page.evaluate(() => window.__tg.main.fn()); await page.waitForTimeout(400);
    const iv = calls.filter((c) => c.op === 'interview.submit');
    check(iv.length === 1 && JSON.stringify(iv[0].args) === JSON.stringify({ version: 1, answers: [{ qid: 'pace-01', values: ['packed'] }, { qid: 'food-01', values: ['local', 'street', 'shellfish', 'peanuts'] }] }), 'interview.submit carries the picks and the typed values');
    await ctx.close();
  }

  console.log('brochure sandbox');
  {
    const { page, ctx } = await open(browser, { url: PAGE_URL + '&screen=brochure&trip=' + TRIP.slug });
    await page.waitForTimeout(800);
    const fr = page.frames().find((f) => f !== page.mainFrame());
    check(!!fr, 'the brochure frame exists');
    const ran = fr ? await fr.evaluate(() => document.body.getAttribute('data-ran')).catch(() => 'n/a') : 'none';
    const after = fr ? await fr.evaluate(() => (document.getElementById('after') || {}).textContent || '').catch(() => '') : '';
    check(ran !== '1' && await page.evaluate(() => window.__pwned) === undefined, 'the brochure <script> did not run (data-ran=' + ran + ')');
    check(after.includes('sandbox held'), 'the brochure markup rendered inside the frame');
    check(await page.evaluate(() => document.querySelector('iframe').getAttribute('sandbox')) === '', 'frame is sandboxed with no allowances');
    check(await page.evaluate(() => window.__tg.back.visible), 'BackButton shown off the home screen');
    await ctx.close();
    const { page: p2, ctx: c2 } = await open(browser, { url: PAGE_URL + '&screen=brochure&trip=' + TRIP.slug, mode: 'link' });
    await p2.waitForTimeout(600); check((await text(p2)).includes('too large'), 'over-size brochure shows the Drive link'); await shot(p2, 'state-brochure-link');
    await p2.click('text=Open the brochure'); check((await p2.evaluate(() => window.__tg.opened))[0] === 'https://drive.example.invalid/file/fixture-brochure', 'the link opens through Telegram.openLink');
    await c2.close();
  }

  console.log('error states');
  {
    const a = await open(browser, { telegram: false }); check((await text(a.page)).includes("Open this from your helper's bot") && a.calls.length === 0, 'no Telegram → refusal, no call'); await shot(a.page, 'state-no-telegram'); await a.ctx.close();
    const b = await open(browser, { initData: false }); check((await text(b.page)).includes("Open this from your helper's bot") && b.calls.length === 0, 'empty initData → refusal, no call'); await b.ctx.close();
    const c = await open(browser, { mode: 403 }); check((await text(c.page)).includes('This app only answers its owner'), '403 state'); await shot(c.page, 'state-403'); await c.ctx.close();
    const h = await open(browser, { mode: 'planning' }); const ht = await text(h.page);
    check(ht.includes('CLOSED') && ht.includes('building the days') && !(await h.page.$('text=Choose')), 'a closed round shows its stage and no Choose button');
    await h.page.click('text="View"'); await h.page.waitForTimeout(300); check((await text(h.page)).includes('Round 1 is closed') && !(await h.page.evaluate(() => window.__tg.main.visible)), 'the closed round is read-only');
    await h.page.click('text=Facts'); await h.page.waitForTimeout(300); check((await text(h.page)).includes('Nothing to confirm') && !(await text(h.page)).includes('That did not work'), 'no open facts is a quiet state, not an error'); await shot(h.page, 'state-round-closed'); await h.ctx.close();
    const d = await open(browser, { mode: 429 }); check((await text(d.page)).includes('Daily limit reached'), '429 state'); await shot(d.page, 'state-429'); await d.ctx.close();
    const e = await open(browser, { url: PAGE_ORIGIN + '/helper-app.html' }); check((await text(e.page)).includes('No helper address') && e.calls.length === 0, 'no core and nothing stored → explanatory line'); await e.ctx.close();
    const f = await open(browser, { url: PAGE_ORIGIN + '/helper-app.html?core=' + encodeURIComponent('https://evil.example.invalid/exec') }); check((await text(f.page)).includes('No helper address') && f.calls.length === 0 && f.foreign.length === 0, 'a core outside script.google.com is ignored'); await f.ctx.close();
    const g = await open(browser, { url: PAGE_URL + '&screen=places' }); check((await text(g.page)).includes('Places') && g.calls.some((c) => c.op === 'places.search'), '?screen=places opens the places screen'); await g.ctx.close();
  }
  console.log('layout');
  {
    const { page, ctx } = await open(browser, {});
    for (const s of ['home', 'shortlist', 'facts', 'interview', 'places']) {
      await nav(page, s);
      const r = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, small: Array.from(document.querySelectorAll('button, a, input, select')).filter((b) => { const x = b.getBoundingClientRect(); return x.width > 0 && x.height > 0 && x.height < 44; }).length }));
      check(r.scroll <= 390 && r.small === 0, s + ': no horizontal scroll, every visible tap target ≥ 44px (small=' + r.small + ')');
    }
    await ctx.close();
  }
} finally { await browser.close(); }
console.log(failures.length ? `\n${failures.length} FAILED` : '\nall checks passed');
process.exit(failures.length ? 1 : 0);

// Developed by: LightAISolutions
