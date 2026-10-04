'use strict';
// live-site-pages/helper-app.html — the Commands tab: the screen draws what commands.list answers (45_commands_app.js), a
// search narrows it, an example copies on tap. The page's own functions run in a VM against a small fake DOM (the Menu app
// test's pattern), and the answer is the real op's answer from the bundle. Skips when the app page is not in this copy.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const H = require('./harness/gas-mocks');

const PAGE_FILE = path.join(__dirname, '..', '..', 'live-site-pages', 'helper-app.html');
const PAGE = fs.existsSync(PAGE_FILE) ? fs.readFileSync(PAGE_FILE, 'utf8') : null;
const SKIP = { skip: PAGE === null ? 'the app page is not part of this copy of the helpers' : false };
const J = (v) => JSON.parse(JSON.stringify(v));

class N {
  constructor(tag) { this.tagName = tag; this.children = []; this.attrs = {}; this._text = ''; this.listeners = {}; this.value = ''; const self = this;
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
const all = (n, pred, out = []) => { if (!n || typeof n !== 'object') return out; if (pred(n)) out.push(n); n.children.forEach((c) => all(c, pred, out)); return out; };
const byAttr = (n, k) => all(n, (x) => x.getAttribute && x.getAttribute(k) !== null);
function slice(from, to) {
  const a = PAGE.indexOf(from), b = PAGE.indexOf(to, a + 1);
  assert.ok(a >= 0 && b > a, 'markers found: ' + from + ' … ' + to);
  return PAGE.slice(a, b);
}
const SRC = () => [slice('    /* ---------- DOM helpers', '    function setStatus('), slice('    function stateView(', '    /* ---------- theme'),
  slice('    /* ---------- commands:', '    /* ---------- boot')].join('\n');

/** The real commands.list answer, from the bundle with the core and the pack loaded. */
function realAnswer() {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: '2027-05-01T12:00:00Z' });
  H.bootstrap(ctx, state);
  return H.appPost(ctx, state, 'app', { op: 'commands.list' });
}
function page(answer, clip) {
  const st = { rendered: null, calls: [], status: [] };
  const box = {
    document: { createElement: (t) => new N(t), createTextNode: (t) => { const n = new N('#text'); n._text = String(t); return n; }, body: new N('body'), execCommand: () => false },
    navigator: clip === undefined ? {} : { clipboard: { writeText: (t) => { st.copied = t; return clip ? Promise.resolve() : Promise.reject(new Error('denied')); } } },
    window: { open() {} }, tg: null, S: { commands: null }, setTimeout: () => 0,
    render: (v) => { st.rendered = v; }, haptic() {}, go() {}, setStatus: (t) => st.status.push(t),
    call: (op, args, ok, fail) => { st.calls.push(J([op, args])); const r = answer(op, args); if (r.ok) ok(r); else fail(r); }
  };
  vm.runInNewContext(SRC() + '\nshowCommands();', box);
  return { st, box };
}

test('the app page: the Commands tab is in the nav and go() reaches it', SKIP, () => {
  [...PAGE.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].forEach((m) => assert.doesNotThrow(() => new vm.Script(m[1])));
  const shown = [], goSrc = slice('    function go(screen, trip) {', '    function tripLabel(');
  const box = { S: { screen: 'home' }, tg: null, flushDraft() {}, setMain() {}, $: () => ({ children: [] }) };
  [...new Set(goSrc.match(/\bshow[A-Z]\w*/g))].forEach((f) => { box[f] = () => shown.push(f); });
  vm.runInNewContext(slice('    var SCREENS = [', '    var TICKS') + goSrc, box);
  assert.deepEqual(J(box.SCREENS.slice(-1)), [{ id: 'commands', label: 'Commands' }]);
  box.go('commands');
  assert.deepEqual(shown, ['showCommands']);
});

test('Commands: every command of the answer, grouped, with its examples; the list is fetched once', SKIP, () => {
  const ans = realAnswer();
  const { st, box } = page(() => ans);
  const view = st.rendered, cmds = byAttr(view, 'data-cmd').map((n) => n.getAttribute('data-cmd'));
  assert.deepEqual([...cmds].sort(), ans.groups.flatMap((g) => g.commands.map((c) => c.cmd)).sort());
  assert.match(view.textContent, new RegExp('Everything you can send in the chat — ' + ans.count + ' commands'));
  assert.match(view.textContent, /Plan a trip/);
  assert.match(view.textContent, /Without a command/);
  const late = byAttr(view, 'data-cmd').find((n) => n.getAttribute('data-cmd') === '/late');
  assert.deepEqual(byAttr(late, 'data-form').map((n) => n.getAttribute('data-form')), ['/late 30', '/late 30 2']);
  box.showCommands();
  assert.equal(st.calls.length, 1, 'the second visit draws from memory');
});

test('Commands: the search narrows by command, description or example; no match says so', SKIP, () => {
  const { st } = page(() => realAnswer());
  const view = st.rendered, find = all(view, (x) => x.tagName === 'input')[0];
  find.value = 'menu'; find.fire('input');
  const hits = byAttr(view, 'data-cmd').map((n) => n.getAttribute('data-cmd'));
  assert.ok(hits.includes('/menu') && !hits.includes('/late'), hits.join(' '));
  assert.doesNotMatch(view.textContent, /Without a command/);
  find.value = 'late'; find.fire('input');
  const late = byAttr(view, 'data-cmd').map((n) => n.getAttribute('data-cmd'));
  assert.ok(late.includes('/late') && !late.includes('/plan'), 'a word is matched whole, not inside "later": ' + late.join(' '));
  find.value = 'date'; find.fire('input');
  assert.ok(byAttr(view, 'data-cmd').map((n) => n.getAttribute('data-cmd')).includes('/dates'), 'a plural still matches');
  find.value = 'zzz nothing'; find.fire('input');
  assert.match(view.textContent, /No command matches “zzz nothing”\./);
  find.value = ''; find.fire('input');
  assert.ok(byAttr(view, 'data-cmd').length > 40);
});

test('Commands: an example copies on tap; without a clipboard it says to type it', SKIP, async () => {
  const ans = realAnswer();
  const { st } = page(() => ans, true);
  const form = byAttr(st.rendered, 'data-form').find((n) => n.getAttribute('data-form') === '/plan Lisbon');
  form.fire('click');
  await new Promise((r) => setImmediate(r));
  assert.equal(st.copied, '/plan Lisbon');
  assert.equal(st.status.pop(), 'Copied /plan Lisbon — paste it in the chat.');
  const { st: st2 } = page(() => ans);
  byAttr(st2.rendered, 'data-form')[0].fire('click');
  assert.match(st2.status.pop(), /^Copy is not available here — type \/\S+/);
});

test('Commands: a refusal shows the reason and points at /help; odd rows are dropped', SKIP, () => {
  const { st } = page(() => ({ ok: false, status: 503, reason: 'busy' }));
  assert.match(st.rendered.textContent, /Commands not available.*finish it there first\. \/help in the chat lists them\./);
  const { st: st2 } = page(() => ({ ok: true, count: 2, tips: [], groups: [{ id: 'x', title: 'X', commands: [{ cmd: '/ok', does: 'Fine.', forms: [{ text: '/ok', means: 'it' }] }, { cmd: '<b>bad', does: 'no' }] }] }));
  assert.deepEqual(byAttr(st2.rendered, 'data-cmd').map((n) => n.getAttribute('data-cmd')), ['/ok']);
});
