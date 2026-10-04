'use strict';
// live-site-pages/helper-app.html — the Menu screen and the day view's 🍽 button (TG-PHASE-16 WP-16b, Contract C16). The
// page's own functions run in a VM against a small fake DOM (the Day trips app test's pattern): the page builds text nodes
// only, so what a check shows is read back from those nodes. The ops answer through the shapes 39_menu_app.js returns, built
// from the invented fixture. Skips cleanly when the app page is not part of this copy of the helpers (vendored layout).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PAGE_FILE = path.join(__dirname, '..', '..', 'live-site-pages', 'helper-app.html');
const PAGE = fs.existsSync(PAGE_FILE) ? fs.readFileSync(PAGE_FILE, 'utf8') : null;
const SKIP = { skip: PAGE === null ? 'the app page is not part of this copy of the helpers' : false };
const FIX = require('../packs/tour-guide/menu/fixtures/menu-sample.json');
const J = (v) => JSON.parse(JSON.stringify(v));
const P = FIX.valid[0];
const ID = P.id;
const TRIP = P.trip;

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
const all = (n, pred, out = []) => { if (!n || typeof n !== 'object') return out; if (pred(n)) out.push(n); n.children.forEach((c) => all(c, pred, out)); return out; };
const byClass = (n, c) => all(n, (x) => x.className.split(/\s+/).includes(c));
const buttons = (n, text) => all(n, (x) => x.tagName === 'button' && x.textContent === text);
const texts = (n) => all(n, (x) => x.tagName !== '#text' && x._text).map((x) => x._text);

/** The page's source between two markers (both must exist, in order). */
function slice(from, to) {
  const a = PAGE.indexOf(from), b = PAGE.indexOf(to, a + 1);
  assert.ok(a >= 0 && b > a, 'markers found: ' + from + ' … ' + to);
  return PAGE.slice(a, b);
}
const HELPERS = () => [slice('    /* ---------- DOM helpers', '    function setStatus('), slice('    function stateView(', '    /* ---------- theme')].join('\n');
const DAYVIEW = () => slice('    /* ---------- a planned day, worded like the chat', '    /* ---------- brochure:');
const MENU = () => slice('    var MENU_ID_RE', '\n') + '\n' + slice('    /* ---------- menu check:', '    /* ---------- boot');

/**
 * A VM running the page's helpers, the day view and the Menu section. `answer(op, args)` → { ok, body } answers call();
 * api() (the day view's background ask) only records and waits: `st.pending.shift()(err, body)` answers it later.
 */
function page(answer, run, S = {}) {
  const st = { rendered: null, calls: [], api: [], pending: [], status: [], main: [], went: [] };
  const box = {
    document: { createElement: (t) => new N(t), createTextNode: (t) => { const n = new N('#text'); n._text = String(t); return n; } },
    window: { open() {} }, tg: null, S: Object.assign({ menu: '' }, S),
    render: (v) => { st.rendered = v; }, haptic() {}, mainProgress() {},
    go: (s, t) => { st.went.push(t === undefined ? s : s + ':' + t); },
    setStatus: (t) => { st.status.push(t); }, setMain: (t, fn) => { st.main.push([t, fn]); },
    call: (op, args, ok, fail) => { st.calls.push(J([op, args])); const r = answer(op, args); if (r.ok) ok(Object.assign({ ok: true }, r.body)); else if (fail) fail(Object.assign({ ok: false }, r.body)); else st.rendered = 'refused:' + r.body.reason; },
    api: (op, args, cb) => { st.api.push(J([op, args])); st.pending.push(cb); }
  };
  vm.runInNewContext(HELPERS() + '\n' + DAYVIEW() + '\n' + MENU() + '\n' + run, box);
  return { box, st };
}

/** One check as menu.get returns it (39_menu_app.js tgAppOpMenuGet), from the fixture. */
function item(over = {}) {
  const p = J(P);
  return Object.assign({ id: p.id, trip: p.trip, place_slug: p.place.slug, place_name: p.place.name, checked: p.checked, fits: p.fits, date: p.date,
    received_at: '2027-05-01T09:00:00Z', local_name: p.place.local_name, fits_line: '✅ Fits your party', note: p.note, diet: p.diet,
    dishes: p.dishes, others: p.others, sources: p.sources, offer: [{ n: 2, date: '2027-05-13', replan: true }], trip_title: 'Quillmere', has_vegcard: false }, over);
}
/** A planned day as trip.digest returns it, its dinner carrying the planner's menu caveat. */
function day(over = {}, dinner = {}) {
  return Object.assign({ date: '2027-05-13', theme: 'Locks and lanterns', stops: [], legs: [],
    dinner: Object.assign({ name: 'Brindle Lantern', slug: 'brindle-lantern', start: '19:00', maps_url: 'https://maps.example/brindle', note_line: 'Menu not checked for vegetarian' }, dinner) }, over);
}

test('the app page: the inline scripts compile; the Menu tab, go(), the nav and the launch link reach the Menu screen', SKIP, async () => {
  [...PAGE.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].forEach((m) => assert.doesNotThrow(() => new vm.Script(m[1])));
  const shown = [];
  const goSrc = slice('    function go(screen, trip) {', '    function tripLabel(');
  const box = { S: { screen: 'home', trip: '', menu: ID }, tg: null, flushDraft() {}, setMain() {}, $: () => ({ children: [] }) };
  // Every screen go() dispatches gets a stand-in, so another branch's screen does not break this test.
  [...new Set(goSrc.match(/\bshow[A-Z]\w*/g))].forEach((f) => { box[f] = () => shown.push(f); });
  vm.runInNewContext(slice('    var SCREENS = [', '    var TICKS') + goSrc, box);
  assert.ok(box.SCREENS.some((s) => s.id === 'menu' && s.label === 'Menu'), 'a Menu tab');
  box.go('menu');
  assert.deepEqual(shown, ['showMenu']);
  assert.equal(box.S.menu, ID, 'go() keeps the check a 📱 button or a 🍽 tap opened');
  // The nav's Menu button opens the list, not the last check.
  const nav = new N('div'); box.$ = () => nav;
  box.el = (tag, attrs) => { const n = new N(tag); Object.keys(attrs).forEach((k) => { if (k === 'text') n._text = attrs[k]; else if (k === 'on') n.addEventListener('click', attrs.on.click); else n.setAttribute(k, attrs[k]); }); return n; };
  box.clear = (n) => { n.children = []; return n; };
  box.go = (s) => shown.push('go:' + s);
  box.buildNav();
  nav.children.find((b) => b.getAttribute('data-screen') === 'menu').click();
  assert.equal(box.S.menu, '');
  assert.deepEqual(shown.slice(-1), ['go:menu']);
  // The card's 📱 button carries the check: ?screen=menu&trip=<slug>&menu=<id>; anything else is dropped.
  const read = (search) => {
    const b = { S: {}, tg: null, window: { location: { search } } };
    vm.runInNewContext(slice('    var SCREENS = [', '    var TICKS') + slice('    function str(', '    function num(') + slice('    function query(s) {', '    function resolveCore('), b);
    b.readParams(); return b.S;
  };
  const ok = read('?screen=menu&trip=' + TRIP + '&menu=' + ID);
  assert.deepEqual([ok.screen, ok.trip, ok.menu], ['menu', TRIP, ID]);
  assert.equal(read('?screen=menu&menu=mn-2027-<b>').menu, '');
  // The day view's caveat test is the planner's own (menu/menu-check.mjs), so a dinner asks exactly when the core can answer.
  const { CAVEAT_RE } = await import('../packs/tour-guide/menu/menu-check.mjs');
  const { box: m } = page(() => ({ ok: true, body: {} }), '');
  assert.equal(m.MENU_CAVEAT_RE.source, CAVEAT_RE.source);
  assert.equal(m.MENU_CAVEAT_RE.flags, CAVEAT_RE.flags);
});

test('Menu: the form asks with the words given; the checks list opens each check', SKIP, () => {
  const lists = { total: 3, items: [
    { id: ID, trip: TRIP, place_slug: 'brindle-lantern', place_name: 'Brindle Lantern', checked: '2027-05-01', fits: 'yes', date: '2027-05-13' },
    { id: 'mn-20270502-fern-cellar', trip: null, place_slug: 'fern-cellar', place_name: '<i>Fern Cellar</i>', checked: '2027-05-02', fits: 'no', date: null },
    { id: 'not a check', place_name: 'X', fits: 'yes' }] };
  const answer = (op, args) => op === 'menu.list' ? { ok: true, body: lists }
    : op === 'menu.get' ? { ok: true, body: { item: item({ id: args.id }) } }
    : args.date === 'yesterday' ? { ok: false, body: { status: 400, reason: 'past_date', field: 'date' } }
    : { ok: true, body: { request_id: 'r1', routine: 'RESEARCH', fired: true, trip: TRIP, place: args.place, slug: null, date: args.date ? '2027-05-13' : null } };
  const { st, box } = page(answer, 'showMenu();');
  const view = st.rendered, inputs = all(view, (x) => x.tagName === 'input');
  assert.equal(inputs.length, 2, 'restaurant and day');
  assert.equal(st.main[0][0], 'Check the menu', 'the MainButton asks too');
  const ask = buttons(view, '🍽 Check the menu')[0];
  ask.click();
  assert.equal(st.calls.length, 1, 'no restaurant: nothing asked');
  assert.match(view.textContent, /Not asked: Say which restaurant\./);
  inputs[0].value = '  Brindle Lantern '; ask.click();
  assert.deepEqual(st.calls.pop(), ['menu.new', { place: 'Brindle Lantern' }]);
  assert.match(view.textContent, /🍽 Reading the menu of Brindle Lantern — the check arrives in the chat, then here\./);
  inputs[1].value = '5/13'; ask.click();
  assert.deepEqual(st.calls.pop(), ['menu.new', { place: 'Brindle Lantern', date: '5/13' }]);
  assert.match(view.textContent, /Reading the menu of Brindle Lantern for Thu 13 May — /);
  inputs[1].value = 'yesterday'; ask.click();
  assert.match(view.textContent, /Not asked: That date has already passed\./);
  const cards = byClass(view, 'card');
  assert.equal(cards.length, 2, 'the bad id is dropped');
  assert.deepEqual(texts(cards[0]).slice(0, 2), ['🍽 Brindle Lantern', 'fits · checked Sat 1 May · for Thu 13 May']);
  assert.deepEqual(texts(cards[1]).slice(0, 2), ['🍽 <i>Fern Cellar</i>', 'does not fit · checked Sun 2 May'], 'names are text, never markup');
  buttons(cards[1], 'Open')[0].click();
  assert.equal(box.S.menu, 'mn-20270502-fern-cellar');
  assert.deepEqual(st.calls.pop(), ['menu.get', { id: 'mn-20270502-fern-cellar' }]);
  const empty = page((op) => op === 'menu.list' ? { ok: true, body: { items: [], total: 0 } } : { ok: false, body: {} }, 'showMenu();');
  assert.ok(texts(empty.st.rendered).includes('No menu checks yet.'));
  const opened = page(answer, 'showMenu();', { menu: ID });
  assert.deepEqual(opened.st.calls, [['menu.get', { id: ID }]], 'a check the link carried opens directly');
});

test('Menu: a check shows the fits line, the dishes with what to ask and their prices, the others, the sources and the offer', SKIP, () => {
  const it = item({ sources: [P.sources[0], { title: 'Not a page', url: 'javascript:alert(1)' }], has_vegcard: true,
    offer: [{ n: 2, date: '2027-05-13', replan: true }, { n: 3, date: '2027-05-14', replan: false, from: '2027-04-14' },
      { n: 4, date: '2027-05-15', replan: false, from: '2027-04-15', again: true }] });
  let refuse = '';
  const answer = (op, args) => op === 'menu.get' ? { ok: true, body: { item: it } }
    : refuse ? { ok: false, body: { status: 409, reason: refuse, field: 'date' } }
    : { ok: true, body: { id: args.id, request_id: 'r2', routine: 'PLAN', fired: true, day: 2, date: args.date } };
  const { st } = page(answer, 'showMenuOne("' + ID + '");');
  const view = st.rendered, t = texts(view);
  assert.deepEqual(t.slice(0, 4), ['🍽 Brindle Lantern (Brindel Lanta)', 'checked Sat 1 May · for Thu 13 May · Quillmere', '✅ Fits your party', 'For: vegetarian, no fish stock']);
  assert.deepEqual(all(view, (x) => x.getAttribute('data-dish') !== null).map((x) => x._text), [
    '✅ Garden set of five courses (Garta Quinne) · set of 5 courses 60.00',
    '✅ Barley risotto with marsh greens · 18.50',
    '❓ Mountain noodle broth (Bergu Nuddla) · 14.50 — ask: without the fish-stock broth?',
    '✅ Pickled radish plate · 6.00',
    '✅ Honey oat tart · 7.50']);
  assert.ok(t.includes('+ 9 other dishes that do not fit'));
  const links = all(view, (x) => x.tagName === 'a');
  assert.deepEqual(links.map((a) => [a._text, a.getAttribute('href')]), [['Brindle Lantern — evening menu', 'https://brindle-lantern.example/menu']]);
  assert.match(view.textContent, /Source: Brindle Lantern — evening menu(?! · )/);
  assert.doesNotMatch(view.textContent, /Not a page/, 'a source that is not an https page is not shown (the validators allow https only)');
  assert.ok(t.includes('For day 3 (Fri 14 May) a menu check counts from Wed 14 Apr; send 🍽 again then.'));
  assert.ok(t.includes('For day 4 (Sat 15 May) this check is too old to count; send 🍽 to check again.'), 'once from has come');
  assert.ok(!t.some((x) => /does not fit; re-plan/.test(x)), 'a check that fits only offers the re-plan');
  const replan = all(view, (x) => x.getAttribute('data-replan') !== null);
  assert.deepEqual(replan.map((b) => [b._text, b.getAttribute('data-replan')]), [['🔁 Re-plan day 2', '2027-05-13']], 'only the day the check counts for');
  replan[0].click();
  assert.deepEqual(st.calls.pop(), ['menu.replan', { id: ID, date: '2027-05-13' }]);
  assert.equal(st.status.pop(), '🔁 Re-planning day 2 (Thu 13 May) with the checked menu — the new day arrives in the chat, then here.');
  assert.equal(replan[0].disabled, true);
  refuse = 'changed'; replan[0].disabled = false; replan[0].click();
  assert.equal(st.status.pop(), 'Not re-planned: That day\'s dinner has changed — open the day again.');
  assert.equal(replan[0].disabled, false, 'a refused re-plan can be tried again');
  buttons(view, '🥗 Veg card')[0].click();
  assert.deepEqual(st.went, ['vegcard:' + TRIP]);
  assert.equal(buttons(view, 'All menu checks').length, 1);
  assert.doesNotMatch(MENU(), /innerHTML|insertAdjacentHTML|outerHTML/, 'text only, never markup');
});

test('Menu: nothing fits says so beside the re-plan; no menu found has no dishes and no offer; a gone check reads in words', SKIP, () => {
  const no = page(() => ({ ok: true, body: { item: item({ fits: 'no', fits_line: '⛔ Nothing on the menu fits', dishes: [], others: 1 }) } }), 'showMenuOne("' + ID + '");');
  const t = texts(no.st.rendered);
  assert.ok(t.includes('⛔ Nothing on the menu fits'));
  assert.ok(t.includes('+ 1 other dish that does not fit'));
  assert.ok(t.includes('This dinner does not fit; re-plan day 2 (Thu 13 May) to replace it.'));
  assert.equal(buttons(no.st.rendered, '🔁 Re-plan day 2').length, 1);
  assert.equal(buttons(no.st.rendered, '🥗 Veg card').length, 0, 'no veg card: no button');
  const unk = page(() => ({ ok: true, body: { item: item({ fits: 'unknown', fits_line: '❔ No menu found to check', diet: undefined, dishes: [], others: 0, sources: [], offer: [] }) } }), 'showMenuOne("' + ID + '");');
  assert.deepEqual(texts(unk.st.rendered).slice(2, 3), ['❔ No menu found to check']);
  assert.equal(all(unk.st.rendered, (x) => x.getAttribute('data-dish') !== null || x.getAttribute('data-replan') !== null).length, 0);
  assert.doesNotMatch(unk.st.rendered.textContent, /other dish|Source:|For:/);
  const gone = page(() => ({ ok: false, body: { status: 404, reason: 'no_menu' } }), 'showMenuOne("' + ID + '");', { menu: ID });
  assert.equal(gone.box.S.menu, '');
  assert.match(gone.st.rendered.textContent, /That menu check is not on file any more\./);
});

test('the day view: 🍽 under the dinner, asked in the background; Check the menu asks, Menu: <fits> opens the check', SKIP, () => {
  let asked = null;
  const answer = (op, args) => { asked = [op, args]; return { ok: true, body: { request_id: 'r3', routine: 'RESEARCH', fired: true, trip: TRIP, place: args.place, slug: args.slug, date: args.date } }; };
  const { st, box } = page(answer, '');
  const card = box.dayCard(day(), 1, 3, TRIP);
  assert.deepEqual(st.api, [['menu.day', { trip: TRIP, date: '2027-05-13' }]]);
  const kids = card.children, at = kids.findIndex((k) => /Dinner at/.test(k.textContent));
  assert.equal(kids[at + 1].textContent, 'Menu not checked for vegetarian');
  const slot = kids[at + 2];
  assert.equal(slot.getAttribute('data-menu'), '2027-05-13', 'the slot sits right under the dinner and its note');
  assert.equal(slot.children.length, 0, 'the day shows before the answer comes');
  st.pending.shift()(null, { ok: true, button: { check: null, fits: null } });
  const ask = buttons(slot, '🍽 Check the menu')[0];
  ask.click();
  assert.deepEqual(J(asked), ['menu.new', { place: 'Brindle Lantern', slug: 'brindle-lantern', date: '2027-05-13' }]);
  assert.equal(st.status.pop(), '🍽 Reading the menu of Brindle Lantern for Thu 13 May — the check arrives in the chat, then here.');
  assert.deepEqual([ask.disabled, ask.textContent], [true, '🍽 Reading the menu…']);
  // A check that counts: its fits word, and a tap opens it on the Menu screen.
  const card2 = box.dayCard(day(), 1, 3, TRIP);
  st.pending.shift()(null, { ok: true, button: { check: ID, fits: 'partly' } });
  const open = buttons(card2, '🍽 Menu: partly fits')[0];
  open.click();
  assert.equal(box.S.menu, ID);
  assert.deepEqual(st.went, ['menu']);
  // No button: the helper says none, refuses, or does not answer.
  [[null, { ok: true, button: null }], [null, { ok: false, status: 404, reason: 'no_trip' }], [new Error('network'), null]].forEach(([err, body]) => {
    const c = box.dayCard(day(), 1, 3, TRIP);
    st.pending.shift()(err, body);
    assert.equal(all(c, (x) => x.tagName === 'button' && /🍽/.test(x.textContent)).length, 0);
  });
  // Nothing is asked without a trip, without a dinner slug, or without the planner's menu caveat.
  const before = st.api.length;
  box.dayCard(day(), 1, 3);
  box.dayCard(day({}, { slug: undefined }), 1, 3, TRIP);
  box.dayCard(day({}, { note_line: 'Quiet corner table' }), 1, 3, TRIP);
  box.dayCard(day({}, { note_line: undefined }), 1, 3, TRIP);
  assert.equal(st.api.length, before);
  box.dayCard(day({}, { note_line: 'Brindle Lantern · menu last checked 2027-03-01' }), 1, 3, TRIP);
  assert.equal(st.api.length, before + 1, 'the planner\'s "name · caveat" form asks too');
});

// Developed by: LightAISolutions
