'use strict';
// live-site-pages/helper-app.html — the What's on screen (TG-PHASE-15 WP-15b, Contract C15). The page's own functions run in
// a VM against a small fake DOM: the page builds text nodes only, so what the screen says is read back from those nodes.
// Invented data only (the fixture's Quillmere board). Skips cleanly when the app page is not part of this copy of the
// helpers (vendored layout).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const H = require('./harness/gas-mocks');
const MANIFEST = require('../packs/tour-guide/helper.json');

const PAGE_FILE = path.join(__dirname, '..', '..', 'live-site-pages', 'helper-app.html');
const PAGE = fs.existsSync(PAGE_FILE) ? fs.readFileSync(PAGE_FILE, 'utf8') : null;
const SKIP = { skip: PAGE === null ? 'the app page is not part of this copy of the helpers' : false };
const FIX = require('../packs/tour-guide/whatson/fixtures/whatson-sample.json');
const J = (v) => JSON.parse(JSON.stringify(v));
const ID = FIX.valid[0].id, TRIP = FIX.valid[0].trip;

class N {
  constructor(tag) { this.tagName = tag; this.children = []; this.attrs = {}; this.className = ''; this._text = ''; this.listeners = {}; this.disabled = false; this.value = ''; }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this.children = []; this._text = String(v); }
  appendChild(c) { this.children.push(c); return c; }
  removeChild(c) { this.children.splice(this.children.indexOf(c), 1); return c; }
  get firstChild() { return this.children[0] || null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; }
  addEventListener(e, f) { (this.listeners[e] = this.listeners[e] || []).push(f); }
  focus() {}
  click() { (this.listeners.click || []).forEach((f) => f({ currentTarget: this })); }
}
const all = (n, pred, out = []) => { if (pred(n)) out.push(n); n.children.forEach((c) => all(c, pred, out)); return out; };
const byClass = (n, c) => all(n, (x) => x.className.split(/\s+/).includes(c));
const buttons = (n) => all(n, (x) => x.tagName === 'button');
const button = (n, text) => buttons(n).filter((x) => x.textContent === text || x.getAttribute('aria-label') === text)[0];
const texts = (n) => all(n, (x) => x._text !== '').map((x) => x._text);

/** The page's source between two markers (both must exist, in order). */
function slice(from, to) {
  const a = PAGE.indexOf(from), b = PAGE.indexOf(to, a + 1);
  assert.ok(a >= 0 && b > a, 'markers found: ' + from + ' … ' + to);
  return PAGE.slice(a, b);
}
const HELPERS = () => [slice('    /* ---------- DOM helpers', '    function setStatus('), slice('    function stateView(', '    /* ---------- theme')].join('\n');
const WHATSON = () => slice('    /* ---------- what\'s on:', '    /* ---------- boot ----------');

/** A VM context running the page's helpers and the What's on screen; call answers from `answer(op, args)` → { ok, body }. */
function page(answer, S = {}, run = '') {
  const st = { rendered: null, calls: [], status: [], opened: [] };
  const box = {
    document: { title: '', createElement: (t) => new N(t), createTextNode: (t) => { const n = new N('#text'); n._text = String(t); return n; } },
    window: { open: (u) => st.opened.push(u) }, tg: null, S: Object.assign({ trip: TRIP, board: '', home: null }, S),
    render: (v) => { st.rendered = v; }, haptic() {}, setStatus: (t) => st.status.push(String(t || '')), setMain() {}, mainProgress() {},
    call: (op, args, ok, fail) => { st.calls.push(J([op, args])); const r = answer(op, args); if (r.ok) ok(Object.assign({ ok: true }, r.body)); else if (fail) fail(Object.assign({ ok: false }, r.body)); }
  };
  vm.runInNewContext(HELPERS() + '\n' + slice('    var SCOUT_ID_RE', '    var TICKS') + '\n' + WHATSON() + '\n' + run, box);
  return { box, st };
}

/** The real core behind the screen: the fixture's trip (12–14 May), days 12 and 13 planned, the fixture's board delivered.
 *  → answer(op, args) for page(), plus the core and the requests it opened. */
function core() {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: '2027-05-01T12:00:00Z', manifest: MANIFEST });
  H.bootstrap(ctx, state);
  H.configureRoutine(ctx, state, 'RESEARCH');
  H.configureRoutine(ctx, state, 'PLAN');
  ctx.tgTripUpsert(J(FIX.trip));
  H.putEnvelope(state, H.envelope('plan_digest', { v: 1, kind: 'plan_digest', trip: TRIP, build_id: 'build-wo-app', verified_on: '2027-04-30',
    days: ['2027-05-12', '2027-05-13'].map((d) => ({ date: d, theme: 'Mere', stops: [], legs: [], warnings: [] })), later: [],
    drive: { plan: 'fixtureDrivePlanFile01', brochure_html: null, brochure_pdf: null } }));
  H.putEnvelope(state, H.envelope('whatson', J(FIX.valid[0])));
  ctx.pollFromBrain();
  const answer = (op, args) => { const r = J(H.appPost(ctx, state, 'app', { op, args })); return { ok: r.ok === true, body: r }; };
  const requests = () => (state.drive.listFiles(MANIFEST.drive_root + '/mailbox/to-brain') || []).filter((n) => /^req_/.test(n))
    .map((n) => JSON.parse(state.drive.readFile(MANIFEST.drive_root + '/mailbox/to-brain', n)));
  return { ctx, state, answer, requests };
}
const itemCard = (view, name) => byClass(view, 'item').filter((x) => x.textContent.includes(name))[0];

test('the app page: What\'s on is a screen, &board= opens one board, go() shows it and its nav button starts from the list', SKIP, () => {
  const scripts = [...PAGE.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  scripts.forEach((s) => assert.doesNotThrow(() => new vm.Script(s)));
  const top = slice('    var SCREENS = [', '    var TICKS');
  const params = [slice('    function query(s) {', '    function resolveCore('), top].join('\n');
  const read = (search, sp) => {
    const box = { window: { location: { search } }, tg: sp ? { initDataUnsafe: { start_param: sp } } : null, S: { screen: '', trip: '', scout: '', board: '' } };
    vm.runInNewContext(HELPERS() + '\n' + params + '\nreadParams();', box);
    return box.S;
  };
  let s = read('?screen=whatson&trip=' + TRIP + '&board=' + ID);
  assert.deepEqual([s.screen, s.trip, s.board], ['whatson', TRIP, ID]);
  assert.equal(read('?screen=whatson&board=wo-bad').board, '', 'only a board id is taken');
  assert.equal(read('', 'screen=whatson&board=' + ID).board, ID, 'from start_param too');
  const box = { S: { screen: 'home', trip: '', board: ID }, tg: null, flushDraft() {}, setMain() {}, $: () => ({ children: [] }) };
  const shown = [];
  ['showHome', 'showShortlist', 'showCompare', 'showFacts', 'showInterview', 'showBrochure', 'showPlaces', 'showScout', 'showVegCard', 'showWhatson', 'showDaytrip', 'showQuiet'] // C16: go() also dispatches the Quiet screen (WP-16a)
    .forEach((f) => { box[f] = () => shown.push(f); });
  vm.runInNewContext(slice('    function go(screen, trip) {', '    function buildNav() {'), box);
  box.go('whatson', TRIP);
  assert.deepEqual([shown, box.S.screen], [['showWhatson'], 'whatson']);
  const nav = new N('nav');
  const nb = { S: { board: ID }, SCREENS: [], go: (x) => shown.push('go:' + x), $: () => nav, clear: (n) => { n.children = []; return n; },
    el: (t, a) => { const n = new N(t); n._text = a.text; n.attrs['data-screen'] = a['data-screen']; n.listeners.click = [a.on.click]; return n; } };
  vm.runInNewContext(top + '\n' + slice('    function buildNav() {', '    function tripLabel('), nb);
  nb.buildNav();
  const wo = nav.children.filter((b) => b.attrs['data-screen'] === 'whatson')[0];
  assert.equal(wo._text, 'What\'s on');
  wo.click();
  assert.deepEqual([nb.S.board, shown.pop()], ['', 'go:whatson']);
});

test('the list: past boards with their place, window and count; Open shows the board; the form asks as /whatson does', SKIP, () => {
  const c = core();
  const { box, st } = page(c.answer, {}, 'showWhatson();');
  assert.deepEqual(st.calls.map((x) => x[0]), ['whatson.list']);
  const rows = byClass(st.rendered, 'card');
  assert.equal(rows.length, 1);
  assert.match(rows[0].textContent, /What's on in Quillmere/);
  assert.match(rows[0].textContent, /Wed 12 May – Fri 14 May · 4 things/);
  button(rows[0], 'Open').click();
  assert.equal(box.S.board, ID);
  assert.deepEqual(st.calls[1], ['whatson.get', { id: ID }]);
  assert.match(st.rendered.textContent, /What's on in Quillmere/);

  // The form: place and dates go to whatson.new; the answer says what was asked.
  const f = page(c.answer, {}, 'showWhatson();');
  const inputs = all(f.st.rendered, (x) => x.tagName === 'input');
  assert.deepEqual(inputs.map((i) => i.attrs.type), ['text', 'date', 'date']);
  [inputs[0].value, inputs[1].value, inputs[2].value] = ['Fernby Cross', '2027-05-10', '2027-05-11'];
  button(f.st.rendered, '🗓 Look it up').click();
  assert.deepEqual(f.st.calls[1], ['whatson.new', { place: 'Fernby Cross', from: '2027-05-10', to: '2027-05-11' }]);
  assert.match(f.st.rendered.textContent, /Looking up what is on in Fernby Cross, Mon 10 May – Tue 11 May/);
  const asked = c.requests().filter((q) => q.payload.kind === 'whatson').map((q) => q.payload);
  assert.equal(asked.length, 1);
  assert.deepEqual([asked[0].place, asked[0].from, asked[0].to, asked[0].dates_given], ['Fernby Cross', '2027-05-10', '2027-05-11', true]);

  // A refusal is said in the screen's own words; a "to" without a "from" never reaches the core.
  const g = page(c.answer, {}, 'showWhatson();');
  const gi = all(g.st.rendered, (x) => x.tagName === 'input');
  [gi[0].value, gi[1].value, gi[2].value] = ['Fernby Cross', '2027-05-10', '2027-06-30'];
  button(g.st.rendered, '🗓 Look it up').click();
  assert.match(g.st.rendered.textContent, /Not asked: Please keep it to 31 days or fewer\./);
  [gi[1].value, gi[2].value] = ['', '2027-05-12'];
  const n = g.st.calls.length;
  button(g.st.rendered, '🗓 Look it up').click();
  assert.equal(g.st.calls.length, n);
  assert.equal(g.st.status.pop(), 'Say the first day too.');
  assert.equal(c.requests().filter((q) => q.payload.kind === 'whatson').length, 1);
});

test('the list: none yet, and a list the core cannot give', SKIP, () => {
  let r = page(() => ({ ok: true, body: { boards: [], total: 0 } }), {}, 'showWhatson();');
  assert.match(r.st.rendered.textContent, /Nothing looked up yet\./);
  r = page(() => ({ ok: false, body: { status: 500, reason: 'busy' } }), {}, 'showWhatson();');
  assert.match(r.st.rendered.textContent, /Boards not available \(The chat is busy/);
});

test('a board: grouped by date ("All these days" first), each item\'s kind, times, venue, why, food, price, booking, source and confidence', SKIP, () => {
  const c = core();
  const { st } = page(c.answer, { board: ID }, 'showWhatson();');
  assert.deepEqual(st.calls, [['whatson.get', { id: ID }]]);
  const v = st.rendered;
  const heads = all(v, (x) => x.tagName === 'h3').map((x) => x.textContent);
  assert.deepEqual(heads, ['All these days', 'Thu 13 May', 'Fri 14 May', 'Sources', 'Left out']);
  const order = all(v, (x) => x.tagName === 'h3' || x.className.split(/\s+/).includes('item')).map((x) => (x.tagName === 'h3' ? '#' + x.textContent : x.textContent.replace(/^\d+/, '').slice(0, 30)));
  assert.equal(order.findIndex((x) => x.startsWith('Reed')) - order.indexOf('#All these days'), 1);
  // Lantern (13–14) and market (13) both start on the 13th: the board's own order within a day.
  assert.ok(order.indexOf('#Thu 13 May') < order.findIndex((x) => x.startsWith('Thursday Quay')));
  const lantern = itemCard(v, 'Lantern Walk');
  const t = texts(lantern);
  ['🏮 light-up', '19:30–22:00', 'Mere Boardwalk · North Shore', 'Paper lanterns along the boardwalk at dusk; flat and easy, about an hour.',
    '🌱 Vegetarian noodles at the boathouse stall.', '💴 free', '🎟 No booking; arrive before 19:15.', 'dates not yet confirmed', '2 days', 'evening', 'crowded']
    .forEach((want) => assert.ok(t.some((x) => x.includes(want)), want + ' in ' + JSON.stringify(t)));
  assert.ok(button(lantern, 'Source ↗'), 'a link to the source');
  button(lantern, 'Source ↗').click();
  assert.deepEqual(st.opened, ['https://whatson.example.org/lantern-walk']);
  const reed = itemCard(v, 'Reed and Rush');
  assert.ok(texts(reed).some((x) => x.includes('until Wed 30 Jun')), 'it runs on past the window');
  assert.ok(texts(reed).some((x) => x === 'confirmed'));
  const market = texts(itemCard(v, 'Thursday Quay'));
  assert.ok(market.some((x) => x.includes('08:00–13:00 · Old Quay')) && !market.some((x) => x.includes('Old Quay · Old Quay')), 'a venue named as its area once: ' + JSON.stringify(market));
  const holiday = itemCard(v, 'Founders');
  assert.equal(button(holiday, '➕ Choose'), undefined, 'a holiday informs; it cannot be chosen');
  assert.ok(button(reed, '➕ Choose') && button(lantern, '➕ Choose'));
  assert.match(v.textContent, /Quillmere what's on/);
  assert.match(v.textContent, /Spring Regatta — not on these dates/);
  assert.match(v.textContent, /Night Ferry Concert — sold out/);
  assert.match(v.textContent, /Wed 12 May – Fri 14 May · 4 things · trip Quillmere/);
});

test('choosing: one day fits → chosen at once; several → "Which day?"; a planned day offers Re-plan, which opens the replan', SKIP, () => {
  const c = core();
  const { st } = page(c.answer, { board: ID }, 'showWhatson();');
  const v = st.rendered;
  const chosen = () => J(c.ctx.tgWhatsonGet(ID).chosen.map((x) => [x.item, x.chosen_on]));

  // The market runs on the 13th only: one tap chooses it, the core decides the day.
  button(itemCard(v, 'Thursday Quay'), '➕ Choose').click();
  assert.deepEqual(st.calls.pop(), ['whatson.choose', { id: ID, item: 'thursday-quay-market-0506', choose: true }]);
  assert.deepEqual(chosen(), [['thursday-quay-market-0506', '2027-05-13']]);
  let market = itemCard(v, 'Thursday Quay');
  assert.equal(button(market, '✅ Chosen').getAttribute('aria-pressed'), 'true');
  assert.ok(texts(market).some((x) => x === 'Chosen for Thu 13 May'));
  assert.ok(button(market, '🔁 Re-plan Thu 13 May'), 'the 13th is planned');

  // Re-plan opens the replan request for that day.
  const before = c.requests().length;
  button(market, '🔁 Re-plan Thu 13 May').click();
  assert.deepEqual(st.calls.pop(), ['whatson.choose', { id: ID, item: 'thursday-quay-market-0506', choose: true, chosen_on: '2027-05-13', replan: true }]);
  const rp = c.requests().slice(before).map((q) => q.payload);
  assert.deepEqual(rp.map((p) => [p.kind, p.trip, p.dates, p.whatson]), [['replan', TRIP, ['2027-05-13'], { board: ID, item: 'thursday-quay-market-0506' }]]);
  assert.match(st.status.pop(), /^🔁 Re-planning day 2 \(Thu 13 May\)/);

  // The lantern walk runs on the 13th and 14th: the toggle asks which day, and the 14th (not planned) has no Re-plan.
  const n = st.calls.length;
  button(itemCard(v, 'Lantern Walk'), '➕ Choose').click();
  let lantern = itemCard(v, 'Lantern Walk');
  assert.ok(texts(lantern).includes('Which day?'));
  assert.deepEqual(buttons(lantern).map((b) => b.textContent).filter((x) => /^(Thu|Fri) /.test(x)), ['Thu 13 May', 'Fri 14 May']);
  assert.equal(st.calls.length, n, 'asking which day needs no call');
  button(lantern, 'Fri 14 May').click();
  assert.deepEqual(st.calls.pop(), ['whatson.choose', { id: ID, item: 'lantern-walk-on-the-mere-0513', choose: true, chosen_on: '2027-05-14' }]);
  lantern = itemCard(v, 'Lantern Walk');
  assert.ok(texts(lantern).some((x) => x === 'Chosen for Fri 14 May'));
  assert.equal(buttons(lantern).filter((b) => /Re-plan/.test(b.textContent)).length, 0);
  assert.deepEqual(chosen().sort(), [['lantern-walk-on-the-mere-0513', '2027-05-14'], ['thursday-quay-market-0506', '2027-05-13']]);

  // Un-choosing says what happens to a day already planned.
  button(itemCard(v, 'Thursday Quay'), '✅ Chosen').click();
  assert.deepEqual(st.calls.pop(), ['whatson.choose', { id: ID, item: 'thursday-quay-market-0506', choose: false }]);
  assert.equal(st.status.pop(), 'Removed — any day already planned keeps it until that day is re-planned');
  market = itemCard(v, 'Thursday Quay');
  assert.ok(button(market, '➕ Choose'));
  assert.deepEqual(chosen(), [['lantern-walk-on-the-mere-0513', '2027-05-14']]);
  assert.equal(st.rendered, v, 'the board is redrawn in place, not re-rendered from the top');
});

test('choosing: a "which_day" answer from the core (the trip changed) shows its days; a refusal is said in words', SKIP, () => {
  const c = core();
  let first = true;
  const answer = (op, args) => {
    if (op === 'whatson.choose' && first) { first = false; return { ok: false, body: { status: 409, reason: 'which_day', days: ['2027-05-12', '2027-05-13'] } }; }
    return c.answer(op, args);
  };
  const { st } = page(answer, { board: ID }, 'showWhatson();');
  button(itemCard(st.rendered, 'Thursday Quay'), '➕ Choose').click();
  const market = itemCard(st.rendered, 'Thursday Quay');
  assert.deepEqual(buttons(market).map((b) => b.textContent).filter((x) => /^(Wed|Thu) /.test(x)), ['Wed 12 May', 'Thu 13 May']);
  button(market, 'Wed 12 May').click();
  assert.equal(st.status.pop(), 'Not chosen: That day is not one the item runs on.');
  const gone = page(() => ({ ok: false, body: { status: 404, reason: 'no_whatson' } }), { board: ID }, 'showWhatson();');
  assert.match(gone.st.rendered.textContent, /That board is not on file any more\./);
  assert.equal(gone.box.S.board, '');
});

// Developed by: LightAISolutions
