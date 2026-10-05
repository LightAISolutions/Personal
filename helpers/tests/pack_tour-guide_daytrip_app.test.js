'use strict';
// live-site-pages/helper-app.html — the Day trips screen (TG-PHASE-15 WP-15a, Contract C15). The page's own functions run
// in a VM against a small fake DOM: the page builds text nodes only, so what a board shows is read back from those nodes.
// The ops answer from the invented fixture through the shapes 33_daytrip_app.js returns. Skips cleanly when the app page
// is not part of this copy of the helpers (vendored layout).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PAGE_FILE = path.join(__dirname, '..', '..', 'live-site-pages', 'helper-app.html');
const PAGE = fs.existsSync(PAGE_FILE) ? fs.readFileSync(PAGE_FILE, 'utf8') : null;
const SKIP = { skip: PAGE === null ? 'the app page is not part of this copy of the helpers' : false };
const FIX = require('../packs/tour-guide/daytrip/fixtures/daytrip-sample.json');
const BOARD = FIX.valid[0].id;
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

const HELPERS = () => [slice('    /* ---------- DOM helpers', '    function setStatus('), slice('    function stateView(', '    /* ---------- theme')].join('\n');
const DAYTRIP = () => slice('    var DAYTRIP_ID_RE', '\n') + '\n' + slice('    /* ---------- day trips:', '    /* ---------- boot');

/** A VM running the page's helpers and the Day trips section; `answer(op, args)` → { ok, body }. */
function page(answer, run) {
  const st = { rendered: null, calls: [], watched: [], status: [], main: [] };
  const box = {
    __watched: st.watched,
    document: { createElement: (t) => new N(t), createTextNode: (t) => { const n = new N('#text'); n._text = String(t); return n; } },
    window: { open() {} }, tg: null, S: { daytrip: '' },
    render: (v) => { st.rendered = v; }, go() {}, haptic() {}, mainProgress() {},
    setStatus: (t) => { st.status.push(t); }, setMain: (t, fn) => { st.main.push([t, fn]); },
    call: (op, args, ok, fail) => { st.calls.push(J([op, args])); const r = answer(op, args); if (r.ok) ok(Object.assign({ ok: true }, r.body)); else if (fail) fail(Object.assign({ ok: false }, r.body)); else st.rendered = 'refused:' + r.body.reason; }
  };
  vm.runInNewContext(HELPERS() + '\n' + DAYTRIP() + '\n' + '\n' + WATCH_STUB + '\n' + run, box);
  return { box, st };
}

/** The board as daytrip.get returns it (33_daytrip_app.js tgAppOpDaytripGet). */
function board(over = {}) {
  const p = J(FIX.valid[0]);
  return Object.assign({ id: p.id, trip: p.trip, base: p.base.label, created_on: p.created_on, max_minutes: p.max_minutes, date: null, count: p.items.length,
    kept: 0, received_at: '2027-05-10T09:00:00Z', items: p.items, more: p.more,
    left_out: p.left_out.map((l) => ({ name: l.name, reason: l.reason, words: { too_far: 'too far', out_of_season: 'out of season' }[l.reason] })),
    kept_entries: [], trip_title: 'Quillmere', days: [{ n: 1, date: '2027-05-12' }, { n: 2, date: '2027-05-13' }, { n: 3, date: '2027-05-14' }] }, over);
}

test('the app page: the inline scripts compile; go(), the nav and the launch link reach the Day trips screen', SKIP, () => {
  [...PAGE.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].forEach((m) => assert.doesNotThrow(() => new vm.Script(m[1])));
  const shown = [];
  const box = { S: { screen: 'home', trip: '', daytrip: BOARD }, tg: null, flushDraft() {}, setMain() {}, $: () => ({ children: [] }) };
  // C15: go() also maps the What's on screen (WP-15b), so its show function must exist here too.
  ['showHome', 'showShortlist', 'showCompare', 'showFacts', 'showInterview', 'showBrochure', 'showPlaces', 'showScout', 'showVegCard', 'showDaytrip', 'showWhatson', 'showQuiet'] // C16: go() also dispatches the Quiet screen (WP-16a)
    .forEach((f) => { box[f] = () => shown.push(f); });
  vm.runInNewContext(slice('    var SCREENS = [', '    var TICKS') + slice('    function go(screen, trip) {', '    function tripLabel('), box);
  assert.ok(box.SCREENS.some((s) => s.id === 'daytrip' && s.label === 'Day trips'), 'a Day trips tab');
  box.go('daytrip');
  assert.deepEqual(shown, ['showDaytrip']);
  // The nav's Day trips button opens the list, not the last board.
  const nav = new N('div'); box.$ = () => nav; box.document = { createElement: (t) => new N(t), createTextNode: (t) => { const n = new N('#text'); n._text = t; return n; } };
  box.el = (tag, attrs) => { const n = new N(tag); Object.keys(attrs).forEach((k) => { if (k === 'text') n._text = attrs[k]; else if (k === 'on') n.addEventListener('click', attrs.on.click); else n.setAttribute(k, attrs[k]); }); return n; };
  box.clear = (n) => { n.children = []; return n; };
  box.go = (s) => shown.push('go:' + s);
  box.buildNav();
  nav.children.find((b) => b.getAttribute('data-screen') === 'daytrip').click();
  assert.equal(box.S.daytrip, '');
  assert.deepEqual(shown.slice(-1), ['go:daytrip']);
  // The chat's 📱 button carries the board: ?screen=daytrip&daytrip=<id>; anything else is dropped.
  const read = (search) => {
    const b = { S: {}, tg: null, window: { location: { search } } };
    vm.runInNewContext(slice('    var SCREENS = [', '    var TICKS') + slice('    function str(', '    function num(') +
      slice('    function query(s) {', '    function resolveCore('), b);
    b.readParams(); return b.S;
  };
  assert.deepEqual([read('?screen=daytrip&daytrip=' + BOARD).screen, read('?screen=daytrip&daytrip=' + BOARD).daytrip], ['daytrip', BOARD]);
  assert.equal(read('?screen=daytrip&daytrip=dt-2027-<b>').daytrip, '');
});

test('Day trips: the form asks with the words given; blank fields ask from where the trip stays, under 90 minutes', SKIP, () => {
  const lists = { boards: [], total: 0, kept_trips: [] };
  const answer = (op, args) => op === 'daytrip.list' ? { ok: true, body: lists }
    : args.date === 'yesterday' ? { ok: false, body: { status: 400, reason: 'bad_date' } }
    : { ok: true, body: { request_id: 'r1', routine: 'RESEARCH', fired: true, trip: 'quillmere-2027', from: args.from || null, max_minutes: args.under, date: args.date ? '2027-05-13' : null } };
  const { st } = page(answer, 'showDaytrip();');
  const view = st.rendered, inputs = all(view, (x) => x.tagName === 'input'), sel = all(view, (x) => x.tagName === 'select')[0];
  assert.equal(inputs.length, 2, 'from and date');
  assert.equal(sel.value, '90', 'under 90 minutes by default');
  assert.deepEqual(all(sel, (x) => x.tagName === 'option').map((o) => o.getAttribute('value')), ['30', '45', '60', '90', '120', '180']);
  assert.ok(texts(view).includes('No day trips yet.'));
  const ask = buttons(view, '🚆 Find day trips')[0];
  ask.click();
  assert.deepEqual(st.calls.pop(), ['daytrip.new', { under: 90 }]);
  assert.match(view.textContent, /Looking for day trips from where you stay · under 90 min — the board arrives in the chat, then here\./);
  inputs[0].value = '  Bramblecombe '; sel.value = '45'; inputs[1].value = '5/13';
  ask.click();
  assert.deepEqual(st.calls.pop(), ['daytrip.new', { from: 'Bramblecombe', under: 45, date: '5/13' }]);
  assert.match(view.textContent, /from Bramblecombe · under 45 min · on Thu 13 May — /);
  inputs[1].value = 'yesterday';
  ask.click();
  assert.match(view.textContent, /Not asked: I could not read that date/);
  assert.equal(st.main[0][0], 'Find day trips', 'the MainButton asks too');
});

test('Day trips: the boards and the kept trips, each opening its board', SKIP, () => {
  const lists = { total: 2, boards: [
    { id: BOARD, trip: 'quillmere-2027', base: 'Bramblecombe', created_on: '2027-05-10', max_minutes: 90, date: null, count: 2, kept: 1 },
    { id: 'dt-20270511-eight', trip: null, base: '<i>Fernmoor</i>', created_on: '2027-05-11', max_minutes: 45, date: '2027-05-13', count: 0, kept: 0 },
    { id: 'not a board', base: 'X', count: 1 }],
    kept_trips: [{ board: BOARD, n: 1, trip: 'quillmere-2027', base: 'Bramblecombe', name: 'Lockford', slug: 'lockford', length: 'full', ride_minutes: 42, stops: [], date: '2027-05-13', kept_at: '2027-05-10T09:01:00Z' }] };
  const { st, box } = page((op, args) => op === 'daytrip.list' ? { ok: true, body: lists } : { ok: true, body: { board: board({ id: args.id }) } }, 'showDaytrip();');
  const view = st.rendered, cards = byClass(view, 'card');
  assert.equal(cards.length, 3, 'one kept trip and two boards; the bad id is dropped');
  assert.deepEqual(texts(cards[0]).slice(0, 2), ['✅ Lockford', 'from Bramblecombe · 🚆 42 min · full day · Thu 13 May']);
  assert.deepEqual(texts(cards[1]).slice(0, 2), ['From Bramblecombe', '2027-05-10 · under 90 min · 2 trips · 1 kept']);
  assert.deepEqual(texts(cards[2]).slice(0, 2), ['From <i>Fernmoor</i>', '2027-05-11 · under 45 min · Thu 13 May · nothing worth the ride'], 'names are text, never markup');
  buttons(cards[2], 'Open')[0].click();
  assert.equal(box.S.daytrip, 'dt-20270511-eight');
  assert.deepEqual(st.calls.pop(), ['daytrip.get', { id: 'dt-20270511-eight' }]);
});

test('Day trips: a board shows ride, length, why, highlights, food, season, closed days, four bars and labels; left out in words', SKIP, () => {
  const b = board();
  b.items[1].parts = { fit: '<b>x</b>', reach: 900, season: -5, food: 70.4 };
  b.items[1].maps_url = 'javascript:alert(1)';
  const { st } = page(() => ({ ok: true, body: { board: b } }), 'showDaytripOne("' + BOARD + '");');
  const view = st.rendered, items = byClass(view, 'item');
  assert.equal(texts(view)[0], 'Day trips from Bramblecombe');
  assert.equal(texts(view)[1], '2027-05-10 · under 90 min · 2 trips · Quillmere');
  assert.equal(items.length, 2);
  assert.deepEqual(texts(items[0]).slice(0, 4), ['1', 'Lockford', '🚆 ~42 min · full day · Wyvern Vale', 'Bramblecombe Central → Lockford Halt']);
  assert.ok(texts(items[0]).includes('Canal locks, a reed-bed walk and a slow lunch: an easy, unhurried day for the party.'));
  assert.ok(texts(items[0]).includes('See: The flight of nine locks · Reed-bed boardwalk · Lock-keeper\'s museum'));
  assert.ok(texts(items[0]).includes('🌱 The lockside bakery marks vegetarian pies; checked against its own menu.'));
  assert.ok(texts(items[0]).includes('🍂 Water lilies on the canal in May.'));
  const bars = (it) => all(it, (x) => x.getAttribute('data-part')).map((x) => [x.getAttribute('data-part'), x.getAttribute('data-value')]);
  assert.deepEqual(bars(items[0]), [['fit', '78'], ['reach', '88'], ['season', '100'], ['food', '100']]);
  assert.deepEqual(bars(items[1]), [['fit', '0'], ['reach', '100'], ['season', '0'], ['food', '70']], 'hostile or out-of-range parts are clamped numbers');
  assert.deepEqual(all(items[0], (x) => x.className === 'pill label').map((x) => x._text), ['🌱 easy vegetarian', '☔ fine in rain']);
  assert.ok(texts(items[1]).includes('⛔ Closed Thu 13 May'));
  assert.equal(texts(items[1])[2], '🚆 ~64 min · half day · Wyvern Vale');
  assert.equal(buttons(items[0], 'Map ↗').length, 1);
  assert.equal(buttons(items[1], 'Map ↗').length, 0, 'a link that is not https is not shown');
  assert.ok(texts(view).includes('…and 2 more within reach.'));
  const h3 = all(view, (x) => x.tagName === 'h3').map((x) => x._text);
  assert.ok(h3.indexOf('Left out') > h3.indexOf('Day trips'), 'what was left out comes under the list');
  assert.ok(texts(view).includes('Farhaven — too far') && texts(view).includes('Cherryfield — out of season'));
  assert.equal(buttons(view, 'All day trips').length, 1);
  assert.doesNotMatch(DAYTRIP(), /innerHTML|insertAdjacentHTML|outerHTML/, 'text only, never markup');
});

test('Day trips: Keep toggles an item; the day picker keeps it on a planned day; refusals read in words', SKIP, () => {
  let kept = [];
  const answer = (op, args) => {
    if (op === 'daytrip.get') return { ok: true, body: { board: board({ kept_entries: J(kept) }) } };
    if (args.n === 2 && args.date) return { ok: false, body: { status: 400, reason: 'no_day', field: 'date' } };
    kept = kept.filter((k) => k.n !== args.n);
    if (args.keep) kept.push(Object.assign({ n: args.n, slug: FIX.valid[0].items[args.n - 1].slug, at: '2027-05-10T09:02:00Z' }, args.date ? { date: args.date } : {}));
    const out = { id: args.id, n: args.n, kept: args.keep, kept_entries: J(kept) };
    if (args.date) out.replan = { request_id: 'r2', routine: 'PLAN', fired: true, dates: [args.date], day: 2 };
    return { ok: true, body: out };
  };
  const { st } = page(answer, 'showDaytripOne("' + BOARD + '");');
  const item = (i) => byClass(st.rendered, 'item')[i];
  const keep = (i) => all(item(i), (x) => x.getAttribute('data-keep') !== null)[0];
  const days = (i) => all(item(i), (x) => x.getAttribute('data-day') !== null);
  assert.deepEqual([keep(0).textContent, keep(0).getAttribute('aria-pressed')], ['➕ Keep', 'false']);
  assert.deepEqual(days(0).map((d) => d.textContent), ['Day 1 · Wed 12 May', 'Day 2 · Thu 13 May', 'Day 3 · Fri 14 May']);
  keep(0).click();
  assert.deepEqual(st.calls.pop(), ['daytrip.keep', { id: BOARD, n: 1, keep: true }]);
  assert.deepEqual([keep(0).textContent, keep(0).getAttribute('aria-pressed')], ['✅ Kept', 'true']);
  days(0)[1].click();
  assert.deepEqual(st.calls.pop(), ['daytrip.keep', { id: BOARD, n: 1, keep: true, date: '2027-05-13' }]);
  assert.equal(st.status.pop(), 'Replanning day 2 with Lockford…');
  assert.deepEqual(days(0).map((d) => d.getAttribute('aria-pressed')), ['false', 'true', 'false'], 'the kept day is marked');
  keep(0).click();
  assert.deepEqual(st.calls.pop(), ['daytrip.keep', { id: BOARD, n: 1, keep: false }]);
  assert.deepEqual([keep(0).textContent, days(0).map((d) => d.getAttribute('aria-pressed'))], ['➕ Keep', ['false', 'false', 'false']]);
  days(1)[0].click();
  assert.equal(st.status.pop(), 'Not kept: That day is not planned on this trip any more.');
  // Without planned days there is no picker; without a board, a state in words.
  const none = page(() => ({ ok: true, body: { board: board({ days: [], trip: null, trip_title: '' }) } }), 'showDaytripOne("' + BOARD + '");');
  assert.equal(all(none.st.rendered, (x) => x.getAttribute('data-day') !== null).length, 0);
  assert.equal(all(none.st.rendered, (x) => x.getAttribute('data-keep') !== null).length, 2, 'Keep still works without a trip');
  const gone = page(() => ({ ok: false, body: { status: 404, reason: 'no_daytrip' } }), 'S.daytrip = "' + BOARD + '"; showDaytripOne("' + BOARD + '");');
  assert.equal(gone.box.S.daytrip, '');
  assert.match(gone.st.rendered.textContent, /That day trip board is not on file any more\./);
});

// Developed by: LightAISolutions
