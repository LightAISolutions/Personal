/**
 * WP-11f — the Mini App's Compare screen and the chat-style day card (live-site-pages/helper-app.html) under Playwright,
 * with a stubbed Telegram.WebApp and a stubbed core. No network: the page origin, telegram.org and the fixture core are all
 * answered by page.route(); anything else is aborted and fails the run.
 * Run: node helpers/tests/shell_helper-app_compare.playwright.mjs [--out DIR]   (screenshots default to the OS temp dir,
 * never the repo). Exit 1 on any failed assertion. Trips, places and dates are invented (Port Sorrel).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = (() => { const i = process.argv.indexOf('--out'); return i > 0 ? path.resolve(process.argv[i + 1]) : path.join(os.tmpdir(), 'wp-11f-shots'); })();
const PAGE_ORIGIN = 'https://pages.example.invalid';
const CORE = 'https://script.google.com/macros/s/FIXTURE_DEPLOYMENT_ID/exec';
const PAGE_URL = PAGE_ORIGIN + '/helper-app.html?core=' + encodeURIComponent(CORE);
fs.mkdirSync(OUT, { recursive: true });

/* ---------- invented fixtures ---------- */
const SLUG = 'port-sorrel-2031';
const D = ['2031-05-12', '2031-05-13', '2031-05-14'];
const TRIP = { slug: SLUG, title: 'Port Sorrel', destination: 'Port Sorrel', start: D[0], end: D[2], status: 'choosing', build_id: 'b-fixture-07', has_brochure: false };
const maps = (q) => 'https://maps.google.com/?q=' + encodeURIComponent(q);
const XSS = '<img src=x onerror="window.__pwned=1">';
const day = (date, kind, area, anchors, note) => ({ date, area, kind, note: note || '', anchors: anchors.map((name) => ({ slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name })) });
const OUTLINE = { build_id: 'ol-fixture-1', keys: ['A', 'B', 'C'], dates: D, notes: 'All three keep the last morning light for the train.', received_at: '2031-05-01T09:00:00Z', choice: null, options: [
  { key: 'A', title: 'Harbour first', gains: 'The old town on day 1, while you are fresh.', gives_up: 'No island day.', days: [day(D[0], 'travel', 'Old harbour', ['Lantern Museum']), day(D[1], 'full', 'Rope Quarter', ['Rope Makers Lane', 'Net Loft']), day(D[2], 'light', 'Station hill', [])] },
  { key: 'B', title: 'Island day in the middle', gains: 'A whole day on Gull Island when the ferry runs most often.', gives_up: 'The museums squeeze into one afternoon.', days: [day(D[0], 'travel', 'Old harbour', ['Lantern Museum']), day(D[1], 'full', 'Gull Island', ['Gull Island ferry', 'Cliff path']), day(D[2], 'light', 'Old harbour', ['Tide Pool Museum'])] },
  { key: 'C', title: 'Slow and rain-proof ' + XSS, gains: 'A spare day kept for rain.', gives_up: 'Fewer sights overall.', days: [day(D[0], 'travel', 'Old harbour', []), day(D[1], 'rain_spare', '', []), day(D[2], 'free', 'Quay Street', ['Salt Kitchen'])] }] };
const ver = (key, title, summary, stops, walk, transit, spare, bookings, leaves, warnings) => ({ key, title, summary, stops: stops.map(([time, name]) => ({ slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, time })),
  walk_minutes: walk, transit_minutes: transit, spare_minutes: spare, bookings, warnings, leaves_out: leaves.map((name) => ({ slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name })) });
const VERSIONS = (date, chosen) => ({ build_id: 'dv-fixture-' + date.slice(8), date, key: chosen || 'A', chosen: chosen || '', received_at: '2031-05-01T10:00:00Z', versions: [
  ver('A', 'Museums and the quay', 'Indoor-heavy, short walks', [['10:00', 'Lantern Museum'], ['12:30', 'Salt Kitchen'], ['14:00', 'Tide Pool Museum']], 35, 20, 75, ['Lantern Museum 10:00'], ['Cliff path'], []),
  ver('B', 'Cliff path and the lighthouse', 'Outdoors, one long walk', [['09:30', 'Cliff path'], ['12:00', 'Net Loft'], ['15:30', 'Lighthouse']], 140, 0, 30, [], ['Lantern Museum', 'Tide Pool Museum'], ['The cliff path closes in strong wind.']),
  ver('C', 'A slow day ' + XSS, '', [], 0, 0, 480, [], [], [])] });
// A day with one way to go comes as one version (day 3 while versions are chosen): no button, the plan uses it.
const ONE_WAY = (date) => ({ build_id: 'dv-fixture-' + date.slice(8), date, key: 'A', chosen: '', received_at: '2031-05-01T10:00:00Z', versions: [ver('A', 'A free day', '0 stops, 0 min walking, 8 h spare', [], 0, 0, 480, [], [], [])] });
const DAYS = (mode) => D.map((date, i) => ({ date, n: i + 1, planned: mode === 'planned', versions: mode === 'outline' ? null : mode === 'versions' && i === 2 ? ONE_WAY(date) : VERSIONS(date, mode === 'planned' ? 'A' : i === 0 ? 'B' : '') }));
// A trip with only one way to shape it: one outline ('one'), which the chat takes as it is while it waits ('one-taken').
const ONE = { ...OUTLINE, build_id: 'ol-fixture-2', keys: ['A'], options: [OUTLINE.options[0]] };
const JOURNEY = (mode) => mode === 'one' || mode === 'one-taken'
  ? { ok: true, trip: TRIP, mode: 'outline', stage: mode === 'one' ? 'outline' : 'versions', outline: mode === 'one' ? ONE : { ...ONE, choice: { base: 'A', mix: {} } },
    days: DAYS(mode === 'one' ? 'outline' : 'versions'), have: mode === 'one' ? 0 : 3, missing: mode === 'one' ? D : [], can_build: mode !== 'one', outline_min_days: 3 }
  : { ok: true, trip: TRIP, mode: 'outline', stage: mode === 'planned' ? '' : mode, outline: mode === 'outline' ? OUTLINE : { ...OUTLINE, choice: { base: 'B', mix: { [D[2]]: 'A' } } },
    days: DAYS(mode), have: mode === 'outline' ? 0 : 3, missing: mode === 'outline' ? D : [], can_build: mode !== 'outline', outline_min_days: 3 };
// A Phase 11 day (start, bags, dinner, extras, sunset; about times, honest legs) and an older day planned before Phase 10.
const C11_DAY = { date: D[0], n: 1, theme: 'Arrival and the old harbour', spare_minutes: 50, sunset: '19:42', bags: 'bags to the inn first',
  start: { name: 'Port Sorrel station', time: '12:10', maps_url: maps('Port Sorrel station') }, end: { name: 'Quay Street inn', time: '21:30', maps_url: maps('Quay Street inn') },
  dinner: { name: 'Salt Kitchen', slug: 'salt-kitchen', start: '19:00', maps_url: maps('Salt Kitchen'), note_line: 'Vegetable set menu changes daily.', booking_line: 'Booked for 19:00, under the trip name.' },
  extras: [{ name: 'Harbour lantern walk', kind: 'event', time: '20:30', maps_url: maps('Harbour lantern walk'), note_line: 'Free, about an hour.' }, { name: 'Kelp & Barley', kind: 'saved', maps_url: 'javascript:alert(1)' }],
  stops: [{ n: 1, slug: 'lantern-museum', name: 'Lantern Museum', arrive: '13:52', depart: '15:10', minutes: 78, time_style: 'about', maps_url: maps('Lantern Museum'), note_line: 'Start upstairs with the lens room.', last_entry: '16:30', check_on_day: 'Check the opening hours on the day.', booking_line: 'Timed ticket 14:00.', crowd_slot: 'late' },
    { n: 2, slug: 'tide-pool-museum', name: 'Tide Pool Museum ' + XSS, arrive: '15:40', depart: '16:40', minutes: 60, time_style: 'exact', maps_url: 'http://maps.google.com/?q=Tide', note_line: '' }],
  legs: [{ from: 'day-start', to: 'lodging', mode: 'TRANSIT', minutes: 14, maps_url: maps('station to inn'), buffer_minutes: 5 },
    { from: 'lodging', to: 'lantern-museum', mode: 'WALK', minutes: 25, estimated: true, distance_m: 1900, flags: ['uphill'], taxi_minutes: 8, maps_url: maps('inn to museum') },
    { from: 'lantern-museum', to: 'tide-pool-museum', mode: 'WALK', minutes: 9, distance_m: 600, maps_url: maps('museum to museum') },
    { from: 'tide-pool-museum', to: 'lodging', mode: 'WALK', minutes: 12, distance_m: 800, maps_url: maps('back') },
    { from: 'lodging', to: 'salt-kitchen', mode: 'WALK', minutes: 6, distance_m: 400, maps_url: maps('to dinner') }],
  warnings: ['The museum closes at 15:00 on Wednesdays.'], rain: [{ slug: 'net-loft', name: 'Net Loft', instead_of: 'Tide Pool Museum', km: 0.6, maps_url: maps('Net Loft') }] };
const OLD_DAY = { date: D[1], n: 2, theme: 'Rope Quarter', stops: [{ n: 1, slug: 'rope-makers-lane', name: 'Rope Makers Lane', arrive: '10:00', depart: '11:00', minutes: 60, maps_url: maps('Rope Makers Lane'), note_line: 'Workshops open at ten.' }],
  legs: [{ from: 'lodging', to: 'rope-makers-lane', mode: 'WALK', minutes: 9, maps_url: '' }], warnings: [], rain: [] };
const DIGEST = { ok: true, trip: { ...TRIP, status: 'planned' }, days: [C11_DAY, OLD_DAY], later: [] };
const HOME = { ok: true, display_name: 'Fixture Guide', trips: [TRIP], trips_total: 1, choice_round: { trip: SLUG, run: 'run-fixture-1', round: 1, items: 4, want: 2, later: 1, skip: 1, stage: 'outline' }, pending_facts: null, profile_summary: null, places: {} };
const SHORTLIST = { ok: true, trip: SLUG, run: 'run-fixture-1', round: 1, more: false, stage: 'choose', groups: [{ id: 'activities', title: 'Activities', items: [{ key: 'a1', n: 1, slug: 'lantern-museum', name: 'Lantern Museum', why_you: 'Lenses and lamps.', est_minutes: 60, area: 'Old harbour', maps_url: maps('Lantern Museum'), choice: 'w' }] }] };

/* ---------- the stub core ---------- */
function answer(op, args, mode) {
  switch (op) {
    case 'home': return HOME;
    case 'journey.get': return mode === 'off' ? { ok: true, trip: TRIP, on: false, text: 'Outlines and day versions are off — /journey on turns them on.', mode: '', stage: '', outline: null, days: [], have: 0, missing: [], can_build: false, outline_min_days: 3 } : JOURNEY(mode);
    case 'outline.choose': return { ok: true, request_id: 'req-fixture-21', via: 'flow', choice: { base: args.base, mix: args.mix || {} } };
    case 'versions.choose': return args.replace ? { ok: true, replaced: true, request_id: 'req-fixture-22' } : { ok: true, date: args.date, key: args.key, have: 3, missing: [], can_build: true };
    case 'versions.done': return { ok: true, started: true, request_id: 'req-fixture-23', via: 'flow', missing: [] };
    case 'trip.digest': return DIGEST;
    case 'shortlist.get': return SHORTLIST;
    case 'shortlist.choose_many': return { ok: true, applied: 0, refused: [] };
    case 'shortlist.done': return { ok: true, started: true, adopted: 1, stage: 'outline' };
    default: return { ok: false, status: 400, reason: 'unknown_op' };
  }
}

/* ---------- the Telegram.WebApp stub ---------- */
function tgStub(scheme, startParam) {
  const theme = scheme === 'dark'
    ? { bg_color: '#17212b', text_color: '#f5f5f5', hint_color: '#9fa8b2', link_color: '#6ab3f3', button_color: '#5288c1', button_text_color: '#ffffff', secondary_bg_color: '#232e3c', section_bg_color: '#17212b' }
    : { bg_color: '#ffffff', text_color: '#1a1a1a', hint_color: '#6f6f6f', link_color: '#2a6fb0', button_color: '#2a6fb0', button_text_color: '#ffffff', secondary_bg_color: '#f4f3ef', section_bg_color: '#ffffff' };
  return `window.__tg = { main: { text: '', visible: false, fn: null }, opened: [], storage: {}, confirmed: [] };
  window.Telegram = { WebApp: {
    initData: 'query_id=AAFixture&user=%7B%22id%22%3A777%7D&auth_date=1700000000&hash=${'f'.repeat(64)}',
    initDataUnsafe: { user: { id: 777 }, auth_date: 1700000000, start_param: ${JSON.stringify(startParam || '')} },
    colorScheme: ${JSON.stringify(scheme)}, themeParams: ${JSON.stringify(theme)}, viewportStableHeight: 844, viewportHeight: 844,
    ready() {}, expand() {}, setHeaderColor() {}, setBackgroundColor() {}, onEvent() {},
    openLink(u) { window.__tg.opened.push(u); },
    HapticFeedback: { selectionChanged() {}, notificationOccurred() {} },
    MainButton: { setText(t) { window.__tg.main.text = t; }, show() { window.__tg.main.visible = true; }, hide() { window.__tg.main.visible = false; window.__tg.main.text = ''; }, enable() {}, disable() {}, showProgress() {}, hideProgress() {}, onClick(f) { window.__tg.main.fn = f; } },
    BackButton: { show() {}, hide() {}, onClick() {} },
    CloudStorage: { setItem(k, v, cb) { window.__tg.storage[k] = v; cb && cb(null, true); }, getItem(k, cb) { cb(null, window.__tg.storage[k] || ''); }, removeItem(k, cb) { cb && cb(null, true); } },
    showConfirm(msg, cb) { window.__tg.confirmed.push(msg); cb(true); }
  } };`;
}

/* ---------- runner ---------- */
const failures = [];
const check = (cond, msg) => { if (!cond) { failures.push(msg); console.log('  FAIL ' + msg); } else console.log('  ok   ' + msg); };
const PAGE_HTML = fs.readFileSync(path.join(ROOT, 'live-site-pages', 'helper-app.html'), 'utf8');
const VERSION_TXT = fs.readFileSync(path.join(ROOT, 'live-site-pages', 'html-versions', 'helper-apphtml.version.txt'), 'utf8');

async function open(browser, { scheme = 'light', mode = 'outline', start = 'compare_' + SLUG } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const calls = [], foreign = [], errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('**/*', async (route) => {
    const req = route.request(), u = req.url();
    if (u.startsWith(PAGE_ORIGIN + '/helper-app.html')) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: PAGE_HTML });
    if (u.startsWith(PAGE_ORIGIN + '/html-versions/')) return route.fulfill({ status: 200, contentType: 'text/plain', body: VERSION_TXT });
    if (u.startsWith(PAGE_ORIGIN + '/')) return route.fulfill({ status: 404, body: '' });
    if (u === 'https://telegram.org/js/telegram-web-app.js') return route.fulfill({ status: 200, contentType: 'application/javascript', body: tgStub(scheme, start) });
    if (u.startsWith(CORE)) {
      let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (e) { /* bad */ }
      calls.push({ op: body.op, args: body.args });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer(body.op, body.args || {}, mode)) });
    }
    foreign.push(u); return route.abort();
  });
  await page.goto(PAGE_URL, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  return { page, ctx, calls, foreign, errors };
}
const shot = (page, name, full) => page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: !!full });
const text = (page) => page.evaluate(() => document.getElementById('main').innerText);
const main = (page) => page.evaluate(() => window.__tg.main.text);
const pressMain = async (page) => { await page.evaluate(() => window.__tg.main.fn()); await page.waitForTimeout(400); };
/** Nothing wider than the 390-px viewport, and no element of main sticking out past its card's right edge. */
const fits = (page) => page.evaluate(() => {
  const vw = document.documentElement.clientWidth, bad = [];
  if (document.documentElement.scrollWidth > vw) bad.push('page scrolls sideways (' + document.documentElement.scrollWidth + ')');
  document.querySelectorAll('#main *').forEach((n) => { const r = n.getBoundingClientRect(); if (r.width && r.right > vw + 0.5) bad.push(n.tagName + '.' + n.className + ' right ' + Math.round(r.right)); });
  document.querySelectorAll('#main .cell, #main .hd, #main button, #main .name, #main .meta, #main .leg, #main .sub').forEach((n) => { if (n.scrollWidth > n.clientWidth + 1) bad.push(n.tagName + '.' + n.className + ' clips (' + n.scrollWidth + '>' + n.clientWidth + ')'); });
  return bad.slice(0, 8);
});

const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME || undefined });
try {
  for (const scheme of ['light', 'dark']) {
    console.log('outlines compared · ' + scheme);
    const { page, ctx, calls, foreign, errors } = await open(browser, { scheme, mode: 'outline' });
    check(await page.evaluate(() => document.querySelector('nav button[aria-current="page"]').getAttribute('data-screen')) === 'compare', 'compare_<trip> opens the Compare screen');
    check(calls[0].op === 'journey.get' && calls[0].args.slug === SLUG, 'journey.get asks for the trip');
    check(await page.$$eval('.cmp .hd', (h) => h.map((x) => x.textContent).join('')) === 'ABC', 'one column per outline');
    check(await page.$$eval('.cmp .cell', (c) => c.length) === 9, 'a cell per day per outline');
    check(await page.$$eval('.cmp .cell[aria-pressed="true"]', (c) => c.map((x) => x.getAttribute('data-key')).join('')) === 'AAA', 'outline A is taken whole at first');
    check(await main(page) === 'Choose outline A', 'MainButton reads "Choose outline A"');
    check(!(await text(page)).includes('Each day'), 'no day versions before an outline is chosen');
    check((await fits(page)).length === 0, 'nothing overflows or clips: ' + (await fits(page)).join(' | '));
    await shot(page, scheme + '-1-outlines');
    await shot(page, scheme + '-1-outlines-full', true);
    if (scheme === 'light') {
      console.log('a mixed choice');
      await page.click(`.cmp .cell[data-date="${D[1]}"][data-key="B"]`);
      check(await page.$eval(`.cmp .cell[data-date="${D[1]}"][data-key="B"]`, (c) => c.className.includes('mixed') && c.getAttribute('aria-pressed') === 'true'), 'tapping day 2 of B takes that day from B');
      await page.click('.cmp .hd[data-key="C"]');
      check(await page.$$eval('.cmp .cell[aria-pressed="true"]', (c) => c.map((x) => x.getAttribute('data-key')).join('')) === 'CBC', 'tapping C takes C and keeps day 2 from B');
      check(await main(page) === 'Choose this mix' && (await page.textContent('#mixLine')) === 'Your pick: Outline C · day 2 from B', 'the pick is spelled out: ' + (await page.textContent('#mixLine')));
      check((await fits(page)).length === 0, 'the mixed grid fits: ' + (await fits(page)).join(' | '));
      await page.evaluate(() => { document.querySelector('.cmp').scrollIntoView(); window.scrollBy(0, -130); });
      await page.waitForTimeout(200);
      await shot(page, 'light-2-mixed');
      await pressMain(page);
      const oc = calls.filter((c) => c.op === 'outline.choose');
      check(oc.length === 1 && JSON.stringify(oc[0].args) === JSON.stringify({ slug: SLUG, build_id: 'ol-fixture-1', base: 'C', mix: { [D[1]]: 'B' } }), 'outline.choose carries the base and the mix');
      check((await text(page)).includes('Outline C · day 2 from B chosen'), 'the app says which outline was chosen');
    }
    check(await page.evaluate(() => !window.__pwned && !document.querySelector('#main img')), 'titles stay text (no markup runs)');
    check(foreign.length === 0, 'no request left for a foreign host (' + foreign.join(' ') + ')');
    check(errors.length === 0, 'no page errors (' + errors.join(' | ') + ')');
    await ctx.close();
  }

  console.log('a trip with one way to shape it');
  {
    const { page, ctx, calls, errors } = await open(browser, { mode: 'one' });
    const body = await text(page);
    check((await page.textContent('#outlines h3')) === 'Outline · one way to shape the trip' && body.includes('Only one way to shape these days came out: take it, then the versions of each day follow.'), 'one outline says there is one way and what follows');
    check(await page.$$eval('.cmp .hd', (h) => h.map((x) => x.textContent).join('')) === 'A', 'one column');
    check(await main(page) === 'Take this outline', 'MainButton reads "Take this outline"');
    check((await fits(page)).length === 0, 'one outline fits: ' + (await fits(page)).join(' | '));
    await shot(page, 'light-1b-one-outline', true);
    await pressMain(page);
    const oc = calls.filter((c) => c.op === 'outline.choose');
    check(oc.length === 1 && JSON.stringify(oc[0].args) === JSON.stringify({ slug: SLUG, build_id: 'ol-fixture-2', base: 'A', mix: {} }), 'Take this outline sends outline.choose for A');
    check(errors.length === 0, 'no page errors (' + errors.join(' | ') + ')');
    await ctx.close();
  }
  {
    const { page, ctx, errors } = await open(browser, { mode: 'one-taken' });
    const body = await text(page);
    check(body.includes('Taken as it is: only one way to shape these days came out.') && body.includes('✓ This outline is chosen'), 'an outline the chat took says it was taken as it is');
    check(await main(page) === 'Build my plan', 'the day versions follow, and Build my plan');
    check((await fits(page)).length === 0, 'it fits: ' + (await fits(page)).join(' | '));
    await shot(page, 'light-1c-one-outline-taken');
    check(errors.length === 0, 'no page errors (' + errors.join(' | ') + ')');
    await ctx.close();
  }

  console.log("a day's versions, then Build my plan");
  {
    const { page, ctx, calls, errors } = await open(browser, { mode: 'versions' });
    const body = await text(page);
    check(body.includes('Chosen: Outline B · day 3 from A') && body.includes('✓ This outline is chosen'), 'the stored outline choice shows as chosen');
    check(await page.$$eval(`.card[data-date="${D[0]}"] .ver`, (v) => v.length) === 3, 'three versions of day 1');
    check(body.includes('🚶 2 h 20 min walking · 🚆 0 min on transit · spare 30 min') && body.includes('Leaves out: Lantern Museum, Tide Pool Museum') && body.includes('🎟 Lantern Museum 10:00') && body.includes('No stops: a free day.'),
      'a version card shows walking, transit, spare time, bookings and what it leaves out');
    check(await page.$eval(`.card[data-date="${D[0]}"] .ver.on`, (v) => v.getAttribute('data-key')) === 'B' && body.includes('✓ Chosen'), "day 1's chosen version is marked");
    check(await main(page) === 'Build my plan', 'MainButton reads "Build my plan"');
    check((await fits(page)).length === 0, 'the versions fit: ' + (await fits(page)).join(' | '));
    await page.evaluate((d) => { document.querySelector(`.card[data-date="${d}"]`).scrollIntoView(); window.scrollBy(0, -130); }, D[1]);
    await page.waitForTimeout(200);
    await shot(page, 'light-3-versions');
    await page.click(`.card[data-date="${D[1]}"] button[data-key="C"]`);
    await page.waitForTimeout(300);
    const vc = calls.filter((c) => c.op === 'versions.choose');
    check(vc.length === 1 && JSON.stringify(vc[0].args) === JSON.stringify({ slug: SLUG, build_id: 'dv-fixture-13', date: D[1], key: 'C', replace: false }), 'Choose this version sends versions.choose for that day');
    check(await page.$eval(`.card[data-date="${D[1]}"] .ver.on`, (v) => v.getAttribute('data-key')) === 'C', 'the card then marks C');
    await shot(page, 'light-4-version-chosen');
    const one = `.card[data-date="${D[2]}"]`;
    check(await page.$$eval(one + ' .ver', (v) => v.length) === 1 && !(await page.$(one + ' button')), 'a day with one way to go shows its one version and no button');
    check((await page.$eval(one, (c) => c.innerText)).includes('One way to go this day — the plan uses it as it is.'), 'and says the plan uses it as it is');
    await page.evaluate((d) => { document.querySelector(`.card[data-date="${d}"]`).scrollIntoView(); window.scrollBy(0, -130); }, D[2]);
    await page.waitForTimeout(200);
    await shot(page, 'light-4b-one-way');
    await pressMain(page);
    check(calls.filter((c) => c.op === 'versions.done').length === 1 && (await text(page)).includes('Building your plan'), 'Build my plan sends versions.done once');
    check(errors.length === 0, 'no page errors (' + errors.join(' | ') + ')');
    await ctx.close();
  }

  console.log('a planned day: a version replaces it');
  {
    const { page, ctx, calls } = await open(browser, { mode: 'planned' });
    check((await text(page)).includes('Use this version instead') && (await text(page)).includes('✓ The day is planned with A'), 'planned days offer a replacement');
    await page.click(`.card[data-date="${D[0]}"] button[data-key="B"]`);
    await page.waitForTimeout(300);
    const vc = calls.filter((c) => c.op === 'versions.choose');
    check(vc.length === 1 && vc[0].args.replace === true && vc[0].args.key === 'B' && (await page.evaluate(() => window.__tg.confirmed.length)) === 1, 'replace asks first, then sends versions.choose with replace: true');
    check((await text(page)).includes('Replacing day 1'), 'the app says the day is being replanned');
    await ctx.close();
  }

  console.log('the switch off: one line, no request');
  {
    const { page, ctx, calls } = await open(browser, { mode: 'off' });
    const t = await text(page);
    check(t.includes('Outlines and day versions are off') && t.includes('Send /journey on in the chat to turn them on.'), 'off shows the one line and how to turn it on');
    check(!(await page.$('.cmp')) && !(await page.$('.ver')) && calls.every((c) => c.op === 'journey.get' || c.op === 'home'), 'off shows no grid and sends nothing else');
    check(await fits(page), 'the off line fits');
    await shot(page, 'light-6-off');
    await ctx.close();
  }

  console.log('shortlist Done names the outline stage');
  {
    const { page, ctx } = await open(browser, { start: 'shortlist_' + SLUG });
    await page.evaluate(() => window.__tg.main.fn()); await page.waitForTimeout(400);
    check((await text(page)).includes('Outlines of the trip come next'), 'Done on a dated trip points at Compare');
    await page.click('text=Open Compare'); await page.waitForTimeout(400);
    check(await page.evaluate(() => document.querySelector('nav button[aria-current="page"]').getAttribute('data-screen')) === 'compare', 'Open Compare goes to the Compare screen');
    await ctx.close();
  }

  console.log('a planned day reads like the chat card');
  {
    const { page, ctx, errors } = await open(browser, { start: 'brochure_' + SLUG });
    const body = await text(page);
    const want = ['🚩 Starts 12:10 at Port Sorrel station · bags to the inn first', '↳ transit 14 min to your lodging · +5 min spare', '↳ about 25 min walk (estimate) · uphill · taxi about 8 min',
      '1. about 13:45 Lantern Museum', '1 h 18 · last entry 16:30', '🕑 Check the opening hours on the day.', '🎟 Timed ticket 14:00.', '👥 Late is quieter', '2. 15:40–16:40 Tide Pool Museum',
      '↳ walk 12 min back to your lodging', '🍽 19:00 Dinner at Salt Kitchen', '🎟 Booked for 19:00', '🏁 Ends 21:30 at Quay Street inn', 'Spare time: 50 min',
      '✨ 20:30 Harbour lantern walk', '🔖 Kelp & Barley', '🌅 Sunset 19:42', 'Walking routes from Google are in beta'];
    want.forEach((w) => check(body.includes(w), 'day 1 shows "' + w + '"'));
    check(await page.$eval('[data-day="1"]', (c) => [...c.querySelectorAll('h4')].some((h) => h.textContent === 'If you have energy')), 'day 1 heads its extras "If you have energy"');
    check(body.indexOf('🚩 Starts') < body.indexOf('1. about') && body.indexOf('back to your lodging') < body.indexOf('🍽') && body.indexOf('🍽') < body.indexOf('🏁'), 'the lines come in the chat card\'s order');
    const hrefs = await page.$$eval('[data-day="1"] a', (a) => a.map((x) => x.getAttribute('href')));
    check(hrefs.length > 0 && hrefs.every((h) => /^https:\/\//.test(h)), 'every link is https (' + hrefs.length + ')');
    check(!(await page.$$eval('[data-day="1"] a', (a) => a.some((x) => x.textContent.includes('Kelp')))), 'a javascript: link stays plain text');
    check(!(await page.$('[data-stop="tide-pool-museum"] button.pill')), 'an http map link gets no button');
    check(await page.$eval('[data-day="2"]', (c) => c.innerText.includes('10:00–11:00 · 60 min · Workshops open at ten.') && !c.innerText.includes('↳')), 'the older day shows as before');
    check(await page.evaluate(() => !window.__pwned && !document.querySelector('#main img')), 'stop names stay text');
    check((await fits(page)).length === 0, 'the day cards fit: ' + (await fits(page)).join(' | '));
    await shot(page, 'light-5-day-card');
    await shot(page, 'light-5-day-card-full', true);
    await page.click('[data-day="1"] a >> nth=0'); await page.waitForTimeout(100);
    check((await page.evaluate(() => window.__tg.opened.length)) === 1, 'a link opens through Telegram');
    check(errors.length === 0, 'no page errors (' + errors.join(' | ') + ')');
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(failures.length ? failures.length + ' failed' : 'all passed', '· screenshots in ' + OUT);
process.exit(failures.length ? 1 : 0);

// Developed by: LightAISolutions
