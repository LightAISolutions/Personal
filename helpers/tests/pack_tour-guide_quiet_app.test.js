'use strict';
// live-site-pages/helper-app.html — the Quiet screen and the day view's 🕊 buttons (TG-PHASE-16 WP-16a, Contract C16). The
// page's own functions run in a VM against a small fake DOM: the page builds text nodes only, so what a board shows is
// read back from those nodes. The ops answer in the shapes 38_quiet_app.js returns, from the invented fixture. Skips
// cleanly when the app page is not part of this copy of the helpers (vendored layout).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PAGE_FILE = path.join(__dirname, '..', '..', 'live-site-pages', 'helper-app.html');
const PAGE = fs.existsSync(PAGE_FILE) ? fs.readFileSync(PAGE_FILE, 'utf8') : null;
const SKIP = { skip: PAGE === null ? 'the app page is not part of this copy of the helpers' : false };
const FIX = require('../packs/tour-guide/quiet/fixtures/quiet-sample.json');
const BOARD = FIX.valid[0].id;
const CORE = 'https://script.google.com/macros/s/FixtureDeployment/exec';
const J = (v) => JSON.parse(JSON.stringify(v));

class N {
  constructor(tag) { this.tagName = tag; this.children = []; this.attrs = {}; this.className = ''; this._text = ''; this.listeners = {}; this.disabled = false; this.value = ''; }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this.children = []; this._text = String(v); }
  appendChild(c) { this.children.push(c); return c; }
  removeChild(c) { this.children.splice(this.children.indexOf(c), 1); return c; }
  get firstChild() { return this.children[0] || null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(e, f) { (this.listeners[e] = this.listeners[e] || []).push(f); }
  click() { (this.listeners.click || []).forEach((f) => f({ currentTarget: this, preventDefault() {} })); }
  focus() {}
}
const all = (n, pred, out = []) => { if (!n) return out; if (pred(n)) out.push(n); n.children.forEach((c) => all(c, pred, out)); return out; };
const byClass = (n, c) => all(n, (x) => x.className.split(/\s+/).includes(c));
const buttons = (n, text) => all(n, (x) => x.tagName === 'button' && (x.textContent === text || x.getAttribute('aria-label') === text));
const texts = (n) => all(n, (x) => x.tagName !== '#text' && x._text).map((x) => x._text);

/** The page's source between two markers (both must exist, in order). */
function slice(from, to) {
  const a = PAGE.indexOf(from), b = PAGE.indexOf(to, a + 1);
  assert.ok(a >= 0 && b > a, 'markers found: ' + from + ' … ' + to);
  return PAGE.slice(a, b);
}
// The progress bar after an ask (17d) is the commands17c shell test's; here it only records that the form started it.
const WATCH_STUB = 'function watchAsk(screen, r, label) { __watched.push([screen, String((r || {}).request_id || \'\'), label]); }';

const HELPERS = () => [slice('    /* ---------- DOM helpers', '    function setStatus('), slice('    function stateView(', '    /* ---------- theme'),
  slice('    var WD = [', '    /** A stop\'s time')].join('\n');
const QUIET = () => slice('    var QUIET_ID_RE', '\n') + '\n' + slice('    /* ---------- quiet:', '    /* ---------- boot');

/**
 * A VM running the page's helpers and the Quiet section. `answer(op, args)` → { ok, body } serves both call() (the
 * screen's ops) and api() (the day view's background quiet.day); `S` overrides the page state.
 */
function page(answer, run, S = {}) {
  const st = { rendered: null, calls: [], watched: [], status: [], main: [], went: [] };
  const reply = (op, args) => { st.calls.push(J([op, args])); return answer(op, args); };
  const box = {
    __watched: st.watched,
    document: { createElement: (t) => new N(t), createTextNode: (t) => { const n = new N('#text'); n._text = String(t); return n; } },
    window: { open() {} }, tg: null, S: Object.assign({ quiet: '', trip: '', core: CORE, home: null }, S),
    render: (v) => { st.rendered = v; }, go: (s) => { st.went.push(s); }, haptic() {}, mainProgress() {},
    setStatus: (t) => { st.status.push(t); }, setMain: (t, fn) => { st.main.push([t, fn]); },
    call: (op, args, ok, fail) => { const r = reply(op, args); if (r.ok) ok(Object.assign({ ok: true }, r.body)); else if (fail) fail(Object.assign({ ok: false }, r.body)); else st.rendered = 'refused:' + r.body.reason; },
    api: (op, args, cb) => { const r = reply(op, args); if (r.network) cb(new Error('network'), null); else cb(null, Object.assign({ ok: !!r.ok }, r.body)); }
  };
  vm.runInNewContext(HELPERS() + '\n' + QUIET() + '\n' + '\n' + WATCH_STUB + '\n' + run, box);
  return { box, st };
}

/** The board as quiet.get returns it (38_quiet_app.js tgAppOpQuietGet). */
function board(over = {}) {
  const p = J(FIX.valid[0]);
  const words = { the_magnet: 'part of the place itself', not_same_kind: 'not the same kind of place', not_quieter: 'not clearly quieter', too_far: 'more than 30 minutes away' };
  return Object.assign({ id: p.id, trip: p.trip, magnet: p.magnet.name, magnet_slug: p.magnet.slug, busy: p.magnet.busy, created_on: p.created_on, date: p.date,
    count: p.items.length, added: 0, received_at: '2027-05-12T09:00:00Z', quiet: p.magnet.quiet, kind: p.magnet.kind, source: p.magnet.source,
    items: p.items, more: p.more, left_out: p.left_out.map((l) => ({ name: l.name, reason: l.reason, words: words[l.reason] })), added_entries: [] }, over);
}

test('the app page: the inline scripts compile; go(), the nav and the launch link reach the Quiet screen', SKIP, () => {
  [...PAGE.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].forEach((m) => assert.doesNotThrow(() => new vm.Script(m[1])));
  const shown = [];
  const goSrc = slice('    function go(screen, trip) {', '    function tripLabel(');
  const box = { S: { screen: 'home', trip: '', quiet: BOARD }, tg: null, flushDraft() {}, setMain() {}, $: () => ({ children: [] }) };
  // Every screen go() dispatches gets a stand-in, so another branch's screen does not break this test.
  [...new Set(goSrc.match(/\bshow[A-Z]\w*/g))].forEach((f) => { box[f] = () => shown.push(f); });
  vm.runInNewContext(slice('    var SCREENS = [', '    var TICKS') + goSrc, box);
  assert.ok(box.SCREENS.some((s) => s.id === 'quiet' && s.label === 'Quiet'), 'a Quiet tab');
  box.go('quiet');
  assert.deepEqual(shown, ['showQuiet']);
  const nav = new N('div'); box.$ = () => nav; box.document = { createElement: (t) => new N(t), createTextNode: (t) => { const n = new N('#text'); n._text = t; return n; } };
  box.el = (tag, attrs) => { const n = new N(tag); Object.keys(attrs).forEach((k) => { if (k === 'text') n._text = attrs[k]; else if (k === 'on') n.addEventListener('click', attrs.on.click); else n.setAttribute(k, attrs[k]); }); return n; };
  box.clear = (n) => { n.children = []; return n; };
  box.go = (s) => shown.push('go:' + s);
  box.buildNav();
  nav.children.find((b) => b.getAttribute('data-screen') === 'quiet').click();
  assert.equal(box.S.quiet, '', 'the tab opens the list, not the last board');
  assert.deepEqual(shown.slice(-1), ['go:quiet']);
  // The chat's 📱 button: ?screen=quiet&trip=…&quiet=<id>; anything else is dropped.
  const read = (search, sp) => {
    const b = { S: {}, tg: sp ? { initDataUnsafe: { start_param: sp } } : null, window: { location: { search } } };
    vm.runInNewContext(slice('    var SCREENS = [', '    var TICKS') + slice('    var QUIET_ID_RE', '\n') + slice('    function str(', '    function num(') +
      slice('    function query(s) {', '    function resolveCore('), b);
    b.readParams(); return b.S;
  };
  const s = read('?screen=quiet&trip=quillmere-2027&quiet=' + BOARD);
  assert.deepEqual([s.screen, s.trip, s.quiet], ['quiet', 'quillmere-2027', BOARD]);
  assert.equal(read('?screen=quiet&quiet=qt-2027-<b>').quiet, '');
  assert.equal(read('', 'screen=quiet&quiet=' + BOARD).quiet, BOARD, 'from start_param too');
});

test('Quiet: the form asks with the words given; no place asks nothing; a refusal reads in words', SKIP, () => {
  const answer = (op, args) => op === 'quiet.list' ? { ok: true, body: { boards: [], total: 0 } }
    : args.date === '4/1' ? { ok: false, body: { status: 400, reason: 'past_date' } }
    : { ok: true, body: { request_id: 'r1', routine: 'RESEARCH', fired: true, trip: 'quillmere-2027', place: args.place, slug: null, date: args.date ? '2027-05-13' : null } };
  const { st } = page(answer, 'showQuiet();');
  const view = st.rendered, inputs = all(view, (x) => x.tagName === 'input');
  assert.equal(inputs.length, 2, 'place and date');
  assert.ok(texts(view).includes('No boards yet.'));
  const ask = buttons(view, '🕊 Find quieter places')[0];
  ask.click();
  assert.deepEqual(st.calls.filter((c) => c[0] === 'quiet.new'), [], 'no place, no call');
  assert.match(view.textContent, /Not asked: Name a busy place first\./);
  inputs[0].value = '  Lantern <b>Shrine</b> ';
  ask.click();
  assert.deepEqual(st.calls.pop(), ['quiet.new', { place: 'Lantern <b>Shrine</b>' }]);
  assert.deepEqual(J(st.watched), [['quiet', 'r1', '🕊 Quieter than Lantern <b>Shrine</b>']], 'the ask starts the progress bar');
  assert.match(view.textContent, /🕊 Looking for places quieter than Lantern <b>Shrine<\/b> — the board arrives in the chat, then here\./, 'text, never markup');
  inputs[1].value = '5/13';
  ask.click();
  assert.deepEqual(st.calls.pop(), ['quiet.new', { place: 'Lantern <b>Shrine</b>', date: '5/13' }]);
  assert.match(view.textContent, / · Thu 13 May — the board arrives/);
  inputs[1].value = '4/1';
  ask.click();
  assert.match(view.textContent, /Not asked: That date has already passed\./);
  assert.equal(st.main[0][0], 'Find quieter places', 'the MainButton asks too');
});

test('Quiet: the boards, each opening its own; a bad id is dropped; names are text', SKIP, () => {
  const boards = [
    { id: BOARD, trip: 'quillmere-2027', magnet: 'Lantern Shrine', created_on: '2027-05-12', date: '2027-05-13', count: 3, added: 1 },
    { id: 'qt-20270512-copper-noodle-bar', trip: null, magnet: '<i>Copper</i> Noodle Bar', created_on: '2027-05-12', date: null, count: 0, added: 0 },
    { id: 'not a board', magnet: 'X', count: 1 }];
  const { st, box } = page((op, args) => op === 'quiet.list' ? { ok: true, body: { boards, total: 3 } } : { ok: true, body: { board: board({ id: args.id }) } }, 'showQuiet();');
  const cards = byClass(st.rendered, 'card');
  assert.equal(cards.length, 2);
  assert.deepEqual(texts(cards[0]).slice(0, 2), ['Quieter than Lantern Shrine', '2027-05-12 · Thu 13 May · 3 places · 1 added']);
  assert.deepEqual(texts(cards[1]).slice(0, 2), ['Quieter than <i>Copper</i> Noodle Bar', '2027-05-12 · nothing clearly quieter']);
  buttons(cards[1], 'Open')[0].click();
  assert.equal(box.S.quiet, 'qt-20270512-copper-noodle-bar');
  assert.deepEqual(st.calls.pop(), ['quiet.get', { id: 'qt-20270512-copper-noodle-bar' }]);
});

test('Quiet: a board — its quiet hours and source, the places with reach, why, best time, bars and labels, what was left out', SKIP, () => {
  const { st } = page(() => ({ ok: true, body: { board: board() } }), 'showQuietOne(' + JSON.stringify(BOARD) + ');');
  const view = st.rendered, t = texts(view);
  assert.equal(t[0], 'Quieter than Lantern Shrine');
  assert.equal(t[1], '2027-05-12 · Thu 13 May · shrine · 3 places');
  assert.ok(!byClass(view, 'note').length, 'a busy magnet: no not-busy note');
  assert.ok(t.includes('🕐 If you go anyway'));
  assert.ok(t.includes(FIX.valid[0].magnet.quiet));
  assert.equal(buttons(view, 'Lantern Shrine visitor page').length, 1, 'the source opens its page');
  const items = byClass(view, 'item');
  assert.equal(items.length, 3);
  assert.deepEqual(texts(items[0]).slice(0, 4), ['1', 'Reedwater Shrine', '🚶 12 min · much quieter', '➕ Add to Later']);
  assert.ok(texts(items[0]).includes('Same lantern-lit approach, a tenth of the crowd'));
  assert.ok(texts(items[0]).includes('🕐 Early morning, before 09:30'));
  assert.ok(texts(items[0]).includes('🏠 local favourite'));
  assert.deepEqual(all(items[0], (x) => x.getAttribute('data-part')).map((x) => [x.getAttribute('data-part'), x.getAttribute('data-value')]),
    [['quiet', '100'], ['quality', '79'], ['fit', '80'], ['local', '50'], ['reach', '95']]);
  assert.equal(texts(items[1])[2], '🚆 about 18 min · clearly quieter');
  assert.ok(!texts(items[1]).some((x) => /^🕐/.test(x)), 'no best time, no line');
  assert.ok(texts(items[1]).includes('☔ fine in rain'));
  assert.ok(t.includes('…and 1 more that were also quieter.'));
  assert.deepEqual(t.filter((x) => / — /.test(x)), ['Lantern Shrine Upper Hall — part of the place itself', 'Tealeaf Cafe — not the same kind of place',
    'Grand Gate Shrine — not clearly quieter', 'Far Cliff Shrine — more than 30 minutes away']);
  assert.equal(buttons(view, 'All boards').length, 1);
});

test('Quiet: an empty board on a magnet that is not busy; a board gone is a state view with the way back', SKIP, () => {
  const p = FIX.valid[1];
  let { st } = page(() => ({ ok: true, body: { board: board({ id: p.id, trip: null, magnet: p.magnet.name, busy: false, date: null, count: 0, quiet: p.magnet.quiet, kind: p.magnet.kind,
    source: null, items: [], more: 0, left_out: [] }) } }), 'showQuietOne(' + JSON.stringify(p.id) + ');');
  const t = texts(st.rendered);
  assert.equal(t[1], '2027-05-12 · noodle bar · nothing clearly quieter');
  assert.equal(byClass(st.rendered, 'note')[0].textContent, 'Copper Noodle Bar is not one of the busiest places nearby, so these are a choice rather than an escape.');
  assert.ok(t.includes('Nothing of the same kind within 30 minutes is clearly quieter.'));
  assert.ok(!t.includes('Left out'));
  ({ st } = page(() => ({ ok: false, body: { status: 404, reason: 'no_quiet' } }), 'showQuietOne(' + JSON.stringify(BOARD) + ');', { quiet: BOARD }));
  assert.deepEqual(texts(st.rendered).slice(0, 3), ['🕊', 'Board not available', 'That board is not on file any more.']);
});

test('Quiet: ➕ adds an item to the Later list and shows ✅; a refusal leaves the button and says why', SKIP, () => {
  let refuse = false;
  const answer = (op, args) => op === 'quiet.get' ? { ok: true, body: { board: board() } }
    : refuse ? { ok: false, body: { status: 409, reason: 'no_trip' } }
    : { ok: true, body: { id: BOARD, n: args.n, trip: 'quillmere-2027', slug: 'moss-step-shrine', added_entries: [{ slug: 'moss-step-shrine', at: '2027-05-12T09:01:00Z' }], days: [] } };
  const { st } = page(answer, 'showQuietOne(' + JSON.stringify(BOARD) + ');');
  buttons(st.rendered, '➕ Add to Later')[1].click();
  assert.deepEqual(st.calls.pop(), ['quiet.add', { id: BOARD, n: 2 }]);
  assert.equal(st.status.at(-1), 'Moss Step Shrine added to the Later list');
  const items = byClass(st.rendered, 'item');
  assert.deepEqual(items.map((it) => all(it, (x) => x.getAttribute('data-add'))[0].textContent), ['➕ Add to Later', '✅ Added', '➕ Add to Later']);
  const n = st.calls.length;
  all(items[1], (x) => x.getAttribute('data-add'))[0].click();
  assert.equal(st.calls.length, n, 'an added item does not ask again');
  refuse = true;
  const b = all(items[0], (x) => x.getAttribute('data-add'))[0];
  b.click();
  assert.equal(st.status.at(-1), 'Not added: No current trip — plan one in the chat first.');
  assert.equal(b.disabled, false);
});

test('the day view\'s 🕊 buttons: quiet.day in the background, two at most, a board opened or a request asked; nothing when it cannot', SKIP, () => {
  const stops = [{ slug: 'tide-hall', name: 'Tide Hall', board: 'qt-20270611-tide-hall' }, { slug: 'kite-museum', name: 'The Very Long Name Of A Kite Museum Here', board: null },
    { slug: 'harbour-tower', name: 'Harbour Tower', board: null }];
  let fail = null;
  const answer = (op, args) => op === 'quiet.day' ? (fail || { ok: true, body: { trip: args.trip, date: args.date, stops } })
    : { ok: true, body: { request_id: 'r1', trip: 'lark-bay', place: args.place, slug: args.slug, date: args.date } };
  const run = 'var card = el("div", {}); quietDayRow(card, { date: "2027-06-11", stops: [] }); this.card = card;';
  const { st, box } = page(answer, run, { trip: 'lark-bay' });
  assert.deepEqual(st.calls[0], ['quiet.day', { trip: 'lark-bay', date: '2027-06-11' }]);
  const btns = all(box.card, (x) => x.tagName === 'button');
  assert.deepEqual(btns.map((b) => b.textContent), ['🕊 Quieter than Tide Hall', '🕊 Quieter than The Very Long Name Of A Kite …'], 'cut to 30 as in the chat');
  btns[0].click();
  assert.deepEqual([box.S.quiet, st.went], ['qt-20270611-tide-hall', ['quiet']], 'its board, opened');
  btns[1].click();
  assert.deepEqual(st.calls.pop(), ['quiet.new', { place: 'The Very Long Name Of A Kite Museum Here', slug: 'kite-museum', date: '2027-06-11' }]);
  assert.equal(st.status.at(-1), '🕊 Looking for places quieter than The Very Long Name Of A Kite Museum Here · Fri 11 Jun — the board arrives in the chat, then here.');
  assert.equal(btns[1].disabled, true);
  // The trip from home when the screen has none; no trip, no core, a bad date: no call. A failed answer: no buttons.
  let r = page(answer, run, { trip: '', home: { trips: [{ slug: 'fen-coast' }] } });
  assert.equal(r.st.calls[0][1].trip, 'fen-coast');
  for (const S of [{ trip: '' }, { trip: 'lark-bay', core: '' }]) assert.equal(page(answer, run, S).st.calls.length, 0);
  assert.equal(page(answer, 'quietDayRow(el("div", {}), { date: "June 11" });', { trip: 'lark-bay' }).st.calls.length, 0);
  for (const f of [{ ok: false, body: { status: 404, reason: 'no_trip' } }, { network: true }]) {
    fail = f;
    r = page(answer, run, { trip: 'lark-bay' });
    assert.deepEqual(all(r.box.card, (x) => x.tagName === 'button'), []);
  }
});

test('the page\'s own dayCard carries the 🕊 row on an older day and on a day with the newer fields; without the Quiet section it is unchanged', SKIP, () => {
  const DAY = slice('    /* ---------- a planned day, worded like the chat', '    /* ---------- brochure:');
  const answer = (op, args) => ({ ok: true, body: { trip: args.trip, date: args.date, stops: [{ slug: 'tide-hall', name: 'Tide Hall', board: null }] } });
  const older = { date: '2027-06-11', theme: 'Shore', stops: [{ n: 1, slug: 'tide-hall', name: 'Tide Hall', arrive: '09:00', depart: '10:30', minutes: 90 }], legs: [], warnings: [] };
  const newer = J(older); newer.stops[0].crowd_slot = 'opening';
  for (const d of [older, newer]) {
    const { box, st } = page(answer, DAY + '\nthis.card = dayCard(' + JSON.stringify(d) + ', 1, 3);', { trip: 'lark-bay' });
    assert.deepEqual(st.calls, [['quiet.day', { trip: 'lark-bay', date: '2027-06-11' }]]);
    assert.deepEqual(all(box.card, (x) => x.getAttribute('data-quiet-day')).map((x) => x.textContent), ['🕊 Quieter than Tide Hall']);
  }
  // A copy of the page without the Quiet section (another branch's VM): dayCard still builds its card.
  const box = { document: { createElement: (t) => new N(t), createTextNode: (t) => { const n = new N('#text'); n._text = String(t); return n; } }, tg: null, window: {} };
  vm.runInNewContext(HELPERS() + '\n' + DAY + '\nthis.card = dayCard(' + JSON.stringify(newer) + ', 1, 3);', box);
  assert.match(box.card.textContent, /Tide Hall/);
});

// Developed by: LightAISolutions
