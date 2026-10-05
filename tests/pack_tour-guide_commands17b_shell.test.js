'use strict';
// live-site-pages/helper-app.html — Phase 17b in the app: the "What do you need?" box, ★ Pinned and Recent shortcuts, command
// buttons on trip, day, stop and place cards, and the Settings screen. The page's own functions run in a VM against a small fake
// DOM, and every op they call is answered by the real bundle (core + pack), so a button's command really runs and a switch
// really changes the setting it reads back. Skips when the app page is not in this copy.
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
  addEventListener(e, f) { (this.listeners[e] = this.listeners[e] || []).push(f); }
  fire(e) { (this.listeners[e] || []).forEach((f) => f({ currentTarget: this, preventDefault() {} })); }
}
const all = (n, pred, out = []) => { if (!n || typeof n !== 'object' || !n.children) return out; if (pred(n)) out.push(n); n.children.forEach((c) => all(c, pred, out)); return out; };
const byAttr = (n, k, v) => all(n, (x) => x.getAttribute && x.getAttribute(k) !== null && (v === undefined || x.getAttribute(k) === v));
const byText = (n, t) => all(n, (x) => x.tagName === 'button' && x.textContent === t)[0];
function slice(from, to) {
  const a = PAGE.indexOf(from), b = PAGE.indexOf(to, a + 1);
  assert.ok(a >= 0 && b > a, 'markers found: ' + from + ' … ' + to);
  return PAGE.slice(a, b);
}
const SRC = () => [slice('    /* ---------- DOM helpers', '    function setStatus('), slice('    function stateView(', '    /* ---------- theme'),
  slice('    /* ---------- commands:', '    /* ---------- boot')].join('\n');

/** A real backend (W world: a dated three-day trip, today its second day) and the page's functions against it. */
function page(opts = {}) {
  const { ctx, state } = opts.world || W.fresh(W.at(W.DATES[1], '13:00'));
  const store = Object.assign({}, opts.cloud || {});
  const st = { rendered: null, ops: [], status: [], confirms: [], gone: [], homes: 0, store };
  const backend = (op, args) => { st.ops.push(J([op, args])); return H.appPost(ctx, state, 'app', { op, args: args || {} }); };
  const cloud = { getItems: (keys, cb) => { const o = {}; keys.forEach((k) => { if (store[k] !== undefined) o[k] = store[k]; }); cb(null, o); }, setItem: (k, v, cb) => { store[k] = v; if (cb) cb(null, true); } };
  const box = {
    document: { createElement: (t) => new N(t), createTextNode: (t) => { const n = new N('#text'); n._text = String(t); return n; }, body: new N('body') },
    navigator: {}, window: { open() {}, scrollTo() {} }, tg: opts.noCloud ? null : { CloudStorage: cloud }, setTimeout: (f) => { f(); return 0; }, clearTimeout() {},
    S: { commands: null, screen: opts.screen || 'home', cmdCtx: null, cmdNonce: {}, recent: [], pins: [], busy: false },
    render: (v) => { st.rendered = v; }, setStatus: (t) => st.status.push(t), go: (s, t) => st.gone.push([s, t === undefined ? null : t]),
    showHome: () => { st.homes++; }, tripLabel: (t) => String((t && (t.title || t.slug)) || ''),
    api: (op, args, cb) => cb(null, backend(op, args)),
    call: (op, args, ok, fail) => { const r = backend(op, args); if (r.ok) ok(r); else if (fail) fail(r); },
    confirmThen: (msg, fn) => { st.confirms.push(msg); if (st.confirmNo !== true) fn(); },
    setMain: (t, fn) => { st.mainFn = fn; }, mainProgress() {}, haptic() {}
  };
  vm.runInNewContext(SRC(), box);
  box.S.core = 'https://script.google.com/macros/s/test/exec';
  return { st, box, ctx, state, runs: () => st.ops.filter((o) => o[0] === 'commands.run').map((o) => o[1].text) };
}

test('"What do you need?": plain words find the right command first; nothing fitting offers to ask Tour Guide', SKIP, () => {
  const { st, box, runs } = page();
  const need = box.needBox(), input = need.children[0], out = need.children[1];
  const top = (q) => { input.value = q; input.fire('input'); return byAttr(out, 'data-cmd').map((n) => n.getAttribute('data-cmd')); };
  assert.equal(top('running late')[0], '/late');
  assert.equal(top('menu')[0], '/menu', 'the name counts most');
  assert.ok(top('rain').slice(0, 3).includes('/replan'), 'rain finds Re-plan');
  assert.ok(top('vegetarian').slice(0, 3).includes('/vegcard'));
  assert.ok(top('running late').length <= 5, 'five at most');
  assert.equal(st.ops.filter((o) => o[0] === 'commands.list').length, 1, 'the list is fetched once');
  assert.deepEqual(top('zzqx'), []);
  const ask = byAttr(out, 'data-ask')[0];
  assert.match(ask.textContent, /No command fits — ask Tour Guide: “zzqx”/);
  ask.fire('click');
  assert.deepEqual(runs(), ['/ask zzqx']);
  assert.ok(byAttr(st.rendered, 'data-sent', '/ask zzqx').length, 'the Sent screen');
  input.value = 'x'; input.fire('input');
  assert.equal(out.children.length, 0, 'one letter shows nothing');
});

test('Recent: every command run from the app is kept with its count in Telegram\'s storage, newest first', SKIP, () => {
  const { st, box } = page();
  box.cmdRun('/ping'); box.cmdRun('/status'); box.cmdRun('/ping');
  assert.deepEqual(J(box.S.recent).map((x) => [x.t, x.n]), [['/ping', 2], ['/status', 1]]);
  assert.deepEqual(JSON.parse(st.store.cmd_recent).map((x) => x.t), ['/ping', '/status']);
  box.cmdRun('/expire', { confirm: true });
  assert.equal(J(box.S.recent)[0].c, true, 'a command that asks first keeps asking from a shortcut');
  for (let i = 0; i < 14; i++) box.cmdRun('/ask question ' + i);
  assert.equal(box.S.recent.length, 12, 'twelve at most');
  box.cmdRun('/ask ' + 'y'.repeat(300));
  assert.ok(!box.S.recent.some((x) => x.t.length > 200), 'a long command is not kept');
});

test('Pinned: the Sent screen pins a command; shortcuts show ★ pins first, then the most used; the store is read back clean', SKIP, () => {
  const { st, box, runs } = page();
  box.cmdRun('/today'); box.cmdRun('/bookings'); box.cmdRun('/bookings');
  box.cmdRun('/journey on');
  const pin = byAttr(st.rendered, 'data-pin', '/journey on')[0];
  assert.equal(pin.textContent, '☆ Pin');
  pin.fire('click');
  assert.equal(pin.textContent, '★ Pinned');
  assert.deepEqual(JSON.parse(st.store.cmd_pins).map((x) => x.t), ['/journey on']);
  const sc = box.scBox(3);
  assert.deepEqual(byAttr(sc, 'data-sc').map((n) => n.textContent), ['★ /journey on', '↻ /bookings', '↻ /today']);
  byAttr(sc, 'data-sc', '/bookings')[0].fire('click');
  assert.equal(runs().slice(-1)[0], '/bookings', 'a shortcut runs on tap');
  // Read back: junk in the store is dropped.
  st.store.cmd_pins = JSON.stringify([{ t: '/ping' }, { t: 'not a command' }, { t: '/ask ' + 'z'.repeat(250) }, 'x']);
  st.store.cmd_recent = '{bad json';
  box.scLoad();
  assert.deepEqual(J(box.S.pins).map((x) => x.t), ['/ping']);
  assert.deepEqual(J(box.S.recent), []);
  for (let i = 0; i < 11; i++) box.scPin('/day 2027-06-1' + (i % 10) + ' ' + i, false, true);
  assert.equal(box.scPin('/ping thirteen', false, true), false, 'twelve pins at most');
  assert.match(st.status.slice(-1)[0], /unpin one first/);
});

test('Commands tab: Pinned and Recent come first when nothing is searched', SKIP, () => {
  const { st, box } = page({ screen: 'commands' });
  box.cmdRun('/status'); box.scPin('/today', false, true);
  box.showCommands();
  const heads = all(st.rendered, (n) => n.tagName === 'h3').map((n) => n.textContent);
  assert.deepEqual(heads.slice(0, 2), ['Pinned', 'Recent']);
  assert.ok(byAttr(st.rendered, 'data-recent', '/status').length);
  const find = all(st.rendered, (n) => n.tagName === 'input')[0];
  find.value = 'late'; find.fire('input');
  assert.ok(!all(st.rendered, (n) => n.tagName === 'h3').some((n) => n.textContent === 'Recent'), 'a search shows only matches');
});

test('trip cards: the current trip has Today and ⋯ More (a form opens with Back home); another trip offers Make current', SKIP, () => {
  const { st, box, runs } = page();
  const cur = box.tripActs({ slug: W.TRIP, title: 'Lark Bay' }, true);
  const more = byAttr(cur, 'data-toggle', '⋯ More')[0], fold = byAttr(cur, 'data-fold', '⋯ More')[0];
  assert.equal(fold.hidden, true, 'folded until tapped');
  more.fire('click'); assert.equal(fold.hidden, false);
  assert.deepEqual(byAttr(fold, 'data-act').map((n) => n.getAttribute('data-act')), ['/dates', '/lodging', '/bookings', '/notes', '/later', '/whatson', '/daytrip', '/repick']);
  byText(fold, '↺ Re-pick').fire('click');
  assert.match(st.confirms[0], /\/repick/, 'Re-pick asks first');
  byText(fold, '📅 Dates').fire('click');
  assert.equal(byAttr(st.rendered, 'data-form-cmd')[0].getAttribute('data-form-cmd'), '/dates');
  byAttr(st.rendered, 'data-form-back')[0].fire('click');
  assert.deepEqual(st.gone.slice(-1), [['home', null]], 'Back returns home');
  const other = box.tripActs({ slug: 'otter-cove', title: 'Otter Cove' }, false);
  assert.equal(byAttr(other, 'data-act').length, 1);
  byText(other, 'Make current').fire('click');
  assert.equal(runs().slice(-1)[0], '/trip otter-cove');
  assert.equal(st.homes, 1, 'Home redraws instead of the Sent screen');
});

test('a brochure day of the current trip: Re-plan opens its form with the day filled in; Running late and Check-in run for that day', SKIP, () => {
  const { st, box, runs } = page({ screen: 'brochure' });
  const card = new N('div');
  box.dayActions(card, { date: W.DATES[2] }, W.TRIP);
  const fold = byAttr(card, 'data-fold', '⋯ This day')[0];
  assert.ok(fold, 'the day\'s buttons');
  byText(fold, '+30 min').fire('click');
  byText(fold, '🌙 Check-in').fire('click');
  byText(fold, '⇄ Versions').fire('click');
  assert.deepEqual(runs(), ['/late 30 ' + W.DATES[2], '/checkin ' + W.DATES[2], '/versions ' + W.DATES[2]]);
  byText(fold, '↻ Re-plan').fire('click');
  const form = st.rendered;
  assert.equal(byAttr(form, 'data-form-cmd')[0].getAttribute('data-form-cmd'), '/replan');
  assert.equal(all(form, (n) => n.className === 'preview')[0].textContent, '/replan ' + W.DATES[2], 'the day is filled in');
  st.mainFn();
  assert.match(st.confirms.slice(-1)[0], /\/replan/);
  assert.equal(runs().slice(-1)[0], '/replan ' + W.DATES[2]);
  assert.equal(st.ops.filter((o) => o[0] === 'commands.context').length, 1, 'one context call');
});

test('a day of another trip offers to make that trip current; no address, no buttons', SKIP, () => {
  const { box, runs, st } = page({ screen: 'brochure' });
  const card = new N('div');
  box.dayActions(card, { date: '2027-09-02' }, 'otter-cove');
  const pill = byAttr(card, 'data-act')[0];
  assert.equal(pill.textContent, 'Make this trip current to change its days');
  pill.fire('click');
  assert.equal(runs()[0], '/trip otter-cove');
  assert.deepEqual(st.gone.slice(-1), [['brochure', 'otter-cove']]);
  box.S.core = '';
  const none = new N('div'); box.dayActions(none, { date: W.DATES[0] }, W.TRIP);
  assert.equal(none.children.length, 0);
});

test('a stop\'s or a place\'s ⋯: Route here and Compare open their forms with the name; Quieter and Menu run for the day', SKIP, () => {
  const { st, box, runs } = page({ screen: 'brochure' });
  const pa = box.placeActs('Kite Museum', W.DATES[1], { food: false });
  assert.deepEqual(byAttr(pa.box, 'data-act').map((n) => n.getAttribute('data-act')), ['/route', '/compare', '/quiet Kite Museum on ' + W.DATES[1], '/place Kite Museum']);
  byText(pa.box, '🕊 Quieter').fire('click');
  assert.deepEqual(runs(), ['/quiet Kite Museum on ' + W.DATES[1]]);
  byText(pa.box, '🧭 Route here').fire('click');
  const to = byAttr(st.rendered, 'data-field', 'to')[0];
  assert.equal(all(to, (n) => n.tagName === 'input')[0].value, 'Kite Museum');
  const food = box.placeActs('Tide Hall', '', { food: true });
  assert.equal(byText(food.box, '🍽 Menu').getAttribute('data-act'), '/menu Tide Hall');
  assert.equal(box.placeActs('A → B', '', {}), null, 'a name that would break /route gets no buttons');
  assert.equal(box.placeActs('', '', {}), null);
});

test('Settings: the switches read the real settings; a switch runs its command and reads back the change', SKIP, () => {
  const { st, box, runs } = page({ screen: 'settings' });
  box.showSettings();
  const sw = (cmd) => byAttr(st.rendered, 'data-switch', cmd)[0];
  assert.equal(sw('/journey on').getAttribute('aria-pressed'), 'false');
  assert.equal(sw('/morning on').getAttribute('aria-pressed'), 'true');
  assert.equal(sw('/smart on').disabled, true, 'smart needs a key first');
  assert.equal(sw('/whatson auto on').textContent, 'On');
  sw('/journey on').fire('click');
  assert.deepEqual(runs(), ['/journey on']);
  assert.equal(sw('/journey on').getAttribute('aria-pressed'), 'true', 'read back after the run');
  assert.match(byAttr(st.rendered, 'data-settings-say')[0].textContent, /Done: \/journey on/);
  sw('/journey on').fire('click');
  assert.equal(runs().slice(-1)[0], '/journey off');
  const time = all(st.rendered, (n) => n.tagName === 'input' && n.getAttribute('type') === 'time')[0], set = byAttr(st.rendered, 'data-morning-at')[0];
  time.value = '04:30'; set.fire('click');
  assert.match(byAttr(st.rendered, 'data-settings-say')[0].textContent, /05:00 to 11:59/);
  assert.equal(runs().length, 2, 'nothing sent for a time out of range');
  time.value = '07:45'; set.fire('click');
  assert.equal(runs().slice(-1)[0], '/morning at 07:45');
  const morningRow = all(st.rendered, (n) => n.className === 'set' && byAttr(n, 'data-switch', '/morning on').length > 0)[0];
  assert.match(morningRow.textContent, /07:45/, 'the morning row reads back the new time');
});

test('Settings: the folded Helper health shows the /status numbers and its buttons; Expire asks first', SKIP, () => {
  const { st, box, runs, ctx } = page({ screen: 'settings' });
  box.showSettings();
  const health = byAttr(st.rendered, 'data-health')[0];
  const dl = all(health, (n) => n.tagName === 'dl')[0], pairs = {};
  for (let i = 0; i < dl.children.length; i += 2) pairs[dl.children[i].textContent] = dl.children[i + 1].textContent;
  const c = J(ctx.coreStatusCounts());
  assert.equal(pairs['Pending actions'], String(c.pending));
  assert.equal(pairs['Triggers'], String(c.triggers));
  assert.match(pairs.Helper, new RegExp('v' + c.version.replace(/\./g, '\\.')));
  byText(health, 'Expire stale proposals').fire('click');
  assert.match(st.confirms[0], /\/expire/);
  byText(health, 'Ping').fire('click');
  assert.deepEqual(runs(), ['/expire', '/ping']);
});
