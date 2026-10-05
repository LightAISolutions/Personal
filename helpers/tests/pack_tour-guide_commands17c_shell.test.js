'use strict';
// live-site-pages/helper-app.html — Phase 17c in the app: five tabs (Home, Today, Discover, Places, More) with a second row for
// Discover and More, the Today tab, and answers that open in their own screen — a slow one watched until it arrives. The page's
// own functions run in a VM against a small fake DOM; every op they call is answered by the real bundle (core + pack).
// Invented data only (the Lark Bay world). Skips when the app page is not in this copy.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const H = require('./harness/gas-mocks');
const W = require('./pack_tour-guide_phase12_world');

const PAGE_FILE = path.join(__dirname, '..', '..', 'live-site-pages', 'helper-app.html');
const PAGE = fs.existsSync(PAGE_FILE) ? fs.readFileSync(PAGE_FILE, 'utf8') : null;
const SKIP = { skip: PAGE === null ? 'the app page is not part of this copy of the helpers' : false };
const J = (v) => JSON.parse(JSON.stringify(v));
const QUIET = JSON.parse(fs.readFileSync(path.join(H.HELPERS_ROOT, 'packs', 'tour-guide', 'quiet', 'fixtures', 'quiet-sample.json'), 'utf8'));

class N {
  constructor(tag) { this.tagName = tag; this.children = []; this.attrs = {}; this._text = ''; this.listeners = {}; this.value = ''; this.hidden = false; const self = this;
    this.classList = { add(c) { self.className = (self.className + ' ' + c).trim(); }, remove(c) { self.className = self.className.split(' ').filter((x) => x !== c).join(' '); } }; this.className = ''; }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this.children = []; this._text = String(v); }
  appendChild(c) { this.children.push(c); return c; }
  removeChild(c) { this.children.splice(this.children.indexOf(c), 1); return c; }
  get firstChild() { return this.children[0] || null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(e, f) { (this.listeners[e] = this.listeners[e] || []).push(f); }
  fire(e) { (this.listeners[e] || []).forEach((f) => f({ currentTarget: this, preventDefault() {} })); }
}
const all = (n, pred, out = []) => { if (!n || typeof n !== 'object' || !n.children) return out; if (pred(n)) out.push(n); n.children.forEach((c) => all(c, pred, out)); return out; };
const byAttr = (n, k, v) => all(n, (x) => x.getAttribute && x.getAttribute(k) !== null && (v === undefined || x.getAttribute(k) === v));
function slice(from, to) {
  const a = PAGE.indexOf(from), b = PAGE.indexOf(to, a + 1);
  assert.ok(a >= 0 && b > a, 'markers found: ' + from + ' … ' + to);
  return PAGE.slice(a, b);
}
const doc = { createElement: (t) => new N(t), createTextNode: (t) => { const n = new N('#text'); n._text = String(t); return n; }, body: new N('body') };

/** A quiet board in the Lark Bay world (the fixture's first board, made this place's on day 2). */
function board(id, name) {
  const p = J(QUIET.valid[0]);
  p.id = id; p.trip = W.TRIP; p.created_on = W.DATES[1]; p.date = W.DATES[1];
  p.magnet = { ...p.magnet, name, slug: name.toLowerCase().replace(/\s+/g, '-'), place_id: 'FixtureLb' + name.replace(/\s+/g, '') };
  delete p.magnet.source;
  return p;
}

/** The commands block against a real backend; go() and dayCard() are recorded, the 10 s poll waits in st.timers. */
function page(opts = {}) {
  const { ctx, state } = opts.world || W.fresh(W.at(W.DATES[1], '13:00'));
  const st = { rendered: null, ops: [], status: [], gone: [], days: [], timers: [] };
  const nodes = { watch: new N('div') };
  const backend = (op, args) => { st.ops.push(J([op, args])); return H.appPost(ctx, state, 'app', { op, args: args || {} }); };
  const box = {
    document: doc, navigator: {}, window: { open() {}, scrollTo() {} }, tg: null, $: (id) => nodes[id] || null,
    setTimeout: (f, ms) => { if (ms >= 5000) st.timers.push(f); else f(); return 0; }, clearTimeout() {},
    S: { commands: null, screen: opts.screen || 'home', cmdCtx: null, cmdNonce: {}, recent: [], pins: [], busy: false, scout: '', daytrip: '', board: '', quiet: '', menu: '' },
    render: (v) => { st.rendered = v; }, setStatus: (t) => st.status.push(t), go: (s, t) => st.gone.push([s, t === undefined ? null : t]),
    showHome() {}, tripLabel: (t) => String((t && (t.title || t.slug)) || ''),
    api: (op, args, cb) => cb(null, backend(op, args)),
    call: (op, args, ok, fail) => { const r = backend(op, args); if (r.ok) ok(r); else if (fail) fail(r); },
    confirmThen: (msg, fn) => fn(), setMain() {}, mainProgress() {}, haptic() {},
    dayCard: (d, i, total, trip, o) => { st.days.push({ date: d.date, i, total, trip, open: !!(o && o.open), back: typeof (o && o.back) }); return new N('div'); }
  };
  vm.runInNewContext([slice('    /* ---------- DOM helpers', '    function setStatus('), slice('    function stateView(', '    /* ---------- theme'),
    slice('    /* ---------- commands:', '    /* ---------- boot')].join('\n'), box);
  box.S.core = 'https://script.google.com/macros/s/test/exec';
  return { st, box, ctx, state, nodes };
}

test('five tabs: the tab holding a screen is current; Discover and More show their screens in a second row; a tab opens its list', SKIP, () => {
  const nav = new N('nav'), sub = new N('nav'), shown = [];
  const box = { S: { screen: 'home', trip: '', scout: 'sc-20270611-tea', menu: 'mn-20270611-x' }, tg: null, flushDraft() {}, setMain() {}, document: doc,
    $: (id) => ({ nav, subnav: sub })[id] || null };
  const goSrc = slice('    function go(screen, trip) {', '    function tripLabel(');
  [...new Set(goSrc.match(/\bshow[A-Z]\w*/g))].forEach((f) => { box[f] = () => shown.push(f); });
  vm.runInNewContext(slice('    function el(', '    function clear(') + slice('    function clear(', '\n') + '\n' + slice('    var SCREENS = [', '    var SCOUT_ID_RE') + goSrc, box);
  box.buildNav();
  const tabs = nav.children.map((b) => b._text || b.textContent);
  assert.deepEqual(tabs, ['Home', 'Today', 'Discover', 'Places', 'More']);
  assert.deepEqual(J(box.TABS).flatMap((t) => t.screens).filter((s) => s !== 'vegcard').sort(), J(box.SCREENS).map((s) => s.id).sort(), 'every screen belongs to one tab');
  const cur = () => nav.children.filter((b) => b.getAttribute('aria-current') === 'page').map((b) => b.getAttribute('data-tab'));
  const row = () => sub.hidden ? [] : sub.children.filter((b) => !b.hidden).map((b) => b.getAttribute('data-screen'));
  box.go('whatson');
  assert.deepEqual([cur(), row()], [['discover'], ['scout', 'daytrip', 'whatson', 'quiet', 'menu', 'compare']]);
  assert.equal(sub.children.find((b) => b.getAttribute('aria-current') === 'page').getAttribute('data-screen'), 'whatson');
  box.go('brochure');
  assert.deepEqual([cur(), row(), sub.hidden], [['home'], [], true], 'a Home screen has no second row');
  box.go('commands');
  assert.deepEqual([cur(), row()], [['more'], ['settings', 'interview', 'commands']]);
  box.go('today');
  assert.deepEqual([cur(), sub.hidden, shown.slice(-1)[0]], [['today'], true, 'showToday']);
  box.go('vegcard');
  assert.deepEqual(cur(), ['home'], 'the veg card sits under Home');
  nav.children.find((b) => b.getAttribute('data-tab') === 'discover').fire('click');
  assert.deepEqual([box.S.screen, box.S.scout], ['scout', ''], 'Discover opens the scout list, not the last scout');
  sub.children.find((b) => b.getAttribute('data-screen') === 'menu').fire('click');
  assert.deepEqual([box.S.screen, box.S.menu], ['menu', '']);
});

test('?screen=today opens the Today tab; every old deep link still opens its screen', SKIP, () => {
  const read = (search) => {
    const b = { S: {}, tg: null, window: { location: { search } } };
    vm.runInNewContext(slice('    function str(', '    function num(') + slice('    function query(s) {', '    function resolveCore(') + slice('    var SCREENS = [', '    var TICKS') + '\nreadParams();', b);
    return b.S.screen;
  };
  assert.equal(read('?screen=today'), 'today');
  ['shortlist', 'compare', 'facts', 'interview', 'brochure', 'places', 'scout', 'daytrip', 'whatson', 'quiet', 'menu', 'commands', 'settings'].forEach((s) => assert.equal(read('?screen=' + s), s));
});

test('Today: the current trip\'s day today with its buttons open; before the trip its first day; after it, no current trip', SKIP, () => {
  let p = page();
  p.box.showToday();
  assert.equal(p.st.rendered.getAttribute('data-today'), W.DATES[1]);
  assert.match(p.st.rendered.textContent, /^Today · Day 2/);
  assert.deepEqual(p.st.days, [{ date: W.DATES[1], i: 1, total: 3, trip: W.TRIP, open: true, back: 'function' }]);
  byAttr(p.st.rendered, 'data-run', '/today')[0].fire('click');
  assert.deepEqual(p.st.ops.filter((o) => o[0] === 'commands.run').map((o) => o[1].text), ['/today']);
  assert.deepEqual(p.st.gone.slice(-1), [['today', null]], '/today\'s answer opens the Today tab');
  p = page({ world: W.fresh(W.at('2027-06-01', '09:00')) });
  p.box.showToday();
  assert.match(p.st.rendered.textContent, /^Next · Day 1/);
  assert.equal(p.st.days[0].date, W.DATES[0]);
  p = page({ world: W.fresh(W.at('2027-06-20', '09:00')) });
  p.box.showToday();
  assert.match(p.st.rendered.textContent, /No current trip/, 'a finished trip is no longer current');
  assert.deepEqual(p.st.days, []);
});

test('an answer opens in its screen: a switch or a chat-only answer still shows Sent; a slow answer is watched and opens when it lands', SKIP, () => {
  const { st, box, ctx, state, nodes } = page();
  assert.equal(W.deliver(ctx, state, 'quiet', board('qt-20270611-tide-hall', 'Tide Hall')).processed, 1);
  box.cmdRun('/ping');
  assert.equal(st.rendered.getAttribute('data-sent'), '/ping', 'no screen for /ping: Sent');
  box.cmdRun('/quiet Kite Museum');
  assert.deepEqual(st.gone.slice(-1), [['quiet', null]], 'the Quiet list opens at once');
  assert.equal(nodes.watch.hidden, false);
  assert.match(nodes.watch.textContent, /Working on “\/quiet Kite Museum” — it opens here when it’s ready/);
  assert.equal(st.timers.length, 1);
  st.timers.shift()();   // nothing new yet: it looks again in 10 s
  assert.equal(st.ops.filter((o) => o[0] === 'quiet.list').length, 1);
  assert.equal(st.timers.length, 1);
  assert.equal(W.deliver(ctx, state, 'quiet', board('qt-20270611-kite-museum', 'Kite Museum')).processed, 1);
  st.timers.shift()();
  assert.deepEqual([box.S.quiet, st.gone.slice(-1)[0], nodes.watch.hidden], ['qt-20270611-kite-museum', ['quiet', null], true], 'the new board opens; the old one was not taken for it');
  assert.equal(st.timers.length, 0, 'the watch ended');
});

test('a watched answer that lands after you moved on waits on the bar with Open; ✕ stops the watch', SKIP, () => {
  const { st, box, ctx, state, nodes } = page();
  box.cmdRun('/quiet Kite Museum');
  box.S.screen = 'places';   // the owner went elsewhere
  assert.equal(W.deliver(ctx, state, 'quiet', board('qt-20270611-kite-museum', 'Kite Museum')).processed, 1);
  const before = st.gone.length;
  st.timers.shift()();
  assert.equal(st.gone.length, before, 'it does not pull the owner away');
  assert.match(nodes.watch.textContent, /Your answer to “\/quiet Kite Museum” is ready/);
  byAttr(nodes.watch, 'data-watch-open')[0].fire('click');
  assert.deepEqual([box.S.quiet, st.gone.slice(-1)[0], nodes.watch.hidden], ['qt-20270611-kite-museum', ['quiet', null], true]);
  box.cmdRun('/quiet Tide Hall');
  nodes.watch.children.find((b) => b.getAttribute('aria-label') === 'Hide').fire('click');
  assert.equal(nodes.watch.hidden, true);
  const n = st.ops.length;
  st.timers.shift()();
  assert.equal(st.ops.length, n, 'a stopped watch reads nothing more');
});
// Developed by: LightAISolutions
