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
function page(answer, clip, runAnswer) {
  const st = { rendered: null, calls: [], status: [], runs: [], confirms: [], main: [] };
  const box = {
    document: { createElement: (t) => new N(t), createTextNode: (t) => { const n = new N('#text'); n._text = String(t); return n; }, body: new N('body'), execCommand: () => false },
    navigator: clip === undefined ? {} : { clipboard: { writeText: (t) => { st.copied = t; return clip ? Promise.resolve() : Promise.reject(new Error('denied')); } } },
    window: { open() {} }, tg: null, S: { commands: null, screen: 'commands' }, setTimeout: () => 0,
    render: (v) => { st.rendered = v; }, haptic() {}, go() {}, setStatus: (t) => st.status.push(t),
    call: (op, args, ok, fail) => { st.calls.push(J([op, args])); const r = answer(op, args); if (r.ok) ok(r); else fail(r); },
    api: (op, args, cb) => { st.runs.push(J([op, args])); const r = (runAnswer || (() => ({ ok: true })))(op, args); if (r instanceof Error) cb(r, null); else cb(null, r); },
    confirmThen: (msg, fn) => { st.confirms.push(msg); if (st.confirmYes !== false) fn(); },
    setMain: (t, fn) => { st.main.push(t); st.mainFn = fn; }, mainProgress() {}
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
  assert.deepEqual(byAttr(late, 'data-fill').map((n) => n.getAttribute('data-fill')), ['/late 30'], 'examples of one template share one Fill in');
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

/* ---------------- Phase 17a: Run, Fill in, Type your own ---------------- */
const cmdRow = (view, cmd) => byAttr(view, 'data-cmd').find((n) => n.getAttribute('data-cmd') === cmd);
const CTX = { ok: true, trip: { slug: 'lark-bay', title: 'Lark Bay', start: '2027-06-10', end: '2027-06-12' }, today: '2027-06-11',
  trips: [{ slug: 'lark-bay', title: 'Lark Bay' }, { slug: 'fernmoor', title: 'Fernmoor' }],
  days: [{ date: '2027-06-10', n: 1, theme: 'Arrival', planned: true }, { date: '2027-06-11', n: 2, theme: 'Shore', planned: true }, { date: '2027-06-12', n: 3, theme: '', planned: false }],
  places: ['Harbour Museum', 'Old Mill Hostel'], lists: [{ name: 'Lark Bay food', count: 12 }], sections: [{ value: 'food', label: 'Food' }] };
const runner = (refuse) => (op, args) => (op === 'commands.context' ? CTX : refuse ? refuse(args) : { ok: true, cmd: args.text.split(' ')[0], message_id: 9 });

test('Run: a ready-made form goes through commands.run with a nonce and ends on "Sent"; /start only copies', SKIP, () => {
  const ans = realAnswer();
  const { st } = page(() => ans, undefined, runner());
  const run = byAttr(cmdRow(st.rendered, '/status'), 'data-run')[0];
  assert.equal(run.getAttribute('data-run'), '/status');
  run.fire('click');
  assert.equal(st.runs.length, 1);
  assert.equal(st.runs[0][0], 'commands.run');
  assert.equal(st.runs[0][1].text, '/status');
  assert.match(st.runs[0][1].nonce, /^[A-Za-z0-9_-]{8,40}$/);
  assert.equal(st.rendered.getAttribute('data-sent'), '/status');
  assert.match(st.rendered.textContent, /Sent.*The answer is in the chat, under “▶️ \/status”\./);
  assert.equal(st.confirms.length, 0, 'a harmless command runs without asking');
  const start = cmdRow(page(() => ans).st.rendered, '/start');
  assert.equal(byAttr(start, 'data-run').length + byAttr(start, 'data-own').length, 0, '/start (pairing) stays in the chat');
});

test('Run: a form that drops things asks first; no → nothing is sent; a refusal says why and a lost answer keeps its nonce', SKIP, () => {
  const ans = realAnswer();
  const { st } = page(() => ans, undefined, runner());
  st.confirmYes = false;
  byAttr(cmdRow(st.rendered, '/lodging'), 'data-run').find((n) => n.getAttribute('data-run') === '/lodging clear').fire('click');
  assert.deepEqual([st.confirms, st.runs.length], [['Run /lodging clear?'], 0]);
  let n = 0;
  const p2 = page(() => ans, undefined, runner(() => (++n === 1 ? new Error('network') : n === 2 ? { ok: true, duplicate: true } : { ok: false, status: 409, reason: 'chat_only' })));
  const run = byAttr(cmdRow(p2.st.rendered, '/bookings'), 'data-run').find((x) => x.getAttribute('data-run') === '/bookings now');
  run.fire('click');
  assert.equal(p2.st.status.pop(), 'Not sent — no connection. Try again.');
  run.fire('click');
  assert.equal(p2.st.runs[0][1].nonce, p2.st.runs[1][1].nonce, 'the retry carries the same nonce, so it cannot run twice');
  assert.equal(p2.st.rendered.getAttribute('data-sent'), '/bookings now', 'a duplicate (it had run) still reads as sent');
  const p3 = page(() => ans, undefined, runner(() => ({ ok: false, status: 409, reason: 'chat_only' })));
  byAttr(cmdRow(p3.st.rendered, '/ping'), 'data-run')[0].fire('click');
  assert.equal(p3.st.status.pop(), 'Not sent: That one only works when typed in the chat.');
});

test('Fill in: the form draws its fields from the registry and the context, previews the exact command and runs it', SKIP, () => {
  const ans = realAnswer();
  const { st } = page(() => ans, undefined, runner());
  byAttr(cmdRow(st.rendered, '/late'), 'data-fill')[0].fire('click');
  const view = st.rendered;
  assert.equal(view.getAttribute('data-form-cmd'), '/late');
  const fields = byAttr(view, 'data-field');
  assert.deepEqual(fields.map((f) => [f.getAttribute('data-field'), f.getAttribute('data-kind')]), [['min', 'number'], ['day', 'day']]);
  assert.match(fields[1].textContent, /Rehearse on · optional/);
  const days = byAttr(fields[1], 'data-v').map((b) => b.textContent);
  assert.deepEqual(days, ['Day 1 · Thu 10 Jun', 'Day 2 · Fri 11 Jun · today', 'Day 3 · Sat 12 Jun']);
  const preview = all(view, (x) => /\bpreview\b/.test(x.className))[0];
  assert.equal(preview.textContent, 'Fill in: Minutes');
  st.mainFn();
  assert.equal(st.runs.filter((r) => r[0] === 'commands.run').length, 0, 'nothing is sent while a required field is empty');
  byAttr(fields[0], 'data-v').find((b) => b.getAttribute('data-v') === '30').fire('click');
  assert.equal(preview.textContent, '/late 30');
  byAttr(fields[1], 'data-v').find((b) => b.getAttribute('data-v') === '2027-06-12').fire('click');
  assert.equal(preview.textContent, '/late 30 2027-06-12');
  const box = all(fields[0], (x) => x.tagName === 'input')[0];
  box.value = '999'; box.fire('input');
  assert.equal(preview.textContent, 'Minutes must be 5–240');
  box.value = '45'; box.fire('input');
  assert.equal(st.main.slice(-1)[0], 'Run');
  st.mainFn();
  const sent = st.runs.filter((r) => r[0] === 'commands.run');
  assert.deepEqual(sent.map((r) => r[1].text), ['/late 45 2027-06-12']);
  assert.equal(st.rendered.getAttribute('data-sent'), '/late 45 2027-06-12');
});

test('Fill in: choices, saved lists, place names and the current trip come from the context; other forms of the command are one tap', SKIP, () => {
  const ans = realAnswer();
  const open = (cmd, text) => { const p = page(() => ans, undefined, runner()); byAttr(cmdRow(p.st.rendered, cmd), 'data-fill').find((n) => n.getAttribute('data-fill') === text).fire('click'); return p.st; };
  let st = open('/route', '/route Old Mill Hostel → Harbour Museum');
  assert.deepEqual(byAttr(st.rendered, 'data-field').map((f) => f.getAttribute('data-kind')), ['place', 'place', 'choice']);
  const dl = all(st.rendered, (x) => x.tagName === 'datalist')[0];
  assert.deepEqual(dl.children.map((o) => o.getAttribute('value')), CTX.places);
  st = open('/review', '/review Lisbon');
  assert.equal(all(st.rendered, (x) => /\bpreview\b/.test(x.className))[0].textContent, '/review lark-bay', 'the current trip is picked already');
  st = open('/list', '/list Coffee to try');
  assert.deepEqual(byAttr(st.rendered, 'data-v').map((b) => b.textContent), ['Lark Bay food · 12']);
  st = open('/interview', '/interview food');
  assert.deepEqual(byAttr(st.rendered, 'data-v').map((b) => b.getAttribute('data-v')), ['food']);
  const other = byAttr(st.rendered, 'data-other').find((b) => b.getAttribute('data-other') === '/interview all');
  st.confirmYes = true; other.fire('click');
  assert.deepEqual(st.confirms, ['Run /interview all?']);
  assert.equal(st.runs.filter((r) => r[0] === 'commands.run')[0][1].text, '/interview all');
});

test('Type your own: a box under each command, prefilled with it; what is not a command is not sent', SKIP, () => {
  const ans = realAnswer();
  const { st } = page(() => ans, undefined, runner());
  const row = cmdRow(st.rendered, '/ask');
  byAttr(row, 'data-own')[0].fire('click');
  const input = all(row, (x) => x.tagName === 'input')[0];
  assert.equal(input.value, '/ask ');
  input.value = 'is the castle open?';
  byAttr(row, 'data-own-run')[0].fire('click');
  assert.equal(st.status.pop(), 'That is not a command — it has to start with /.');
  input.value = '/ask   is the castle open?  ';
  byAttr(row, 'data-own-run')[0].fire('click');
  assert.deepEqual(st.runs.map((r) => r[1].text), ['/ask is the castle open?']);
});
// Developed by: LightAISolutions
