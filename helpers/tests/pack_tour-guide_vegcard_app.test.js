'use strict';
// live-site-pages/helper-app.html — the Veg card screen and the brochure PDF button (TG-PHASE-14 WP-14c, Contract C14).
// The page's own functions run in a VM against a small fake DOM: the page builds text nodes only, so the card's text is
// read back from those nodes. Skips cleanly when the app page is not part of this copy of the helpers (vendored layout).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PAGE_FILE = path.join(__dirname, '..', '..', 'live-site-pages', 'helper-app.html');
const PAGE = fs.existsSync(PAGE_FILE) ? fs.readFileSync(PAGE_FILE, 'utf8') : null;
const SKIP = { skip: PAGE === null ? 'the app page is not part of this copy of the helpers' : false };
const FIX = require('../packs/tour-guide/vegcard/vegcard-fixture-party.json');
const TRIP = 'fernhollow-2099';

class N {
  constructor(tag) {
    this.tagName = tag; this.children = []; this.attrs = {}; this.className = ''; this._text = ''; this.listeners = {}; this.disabled = false;
    const self = this;
    this.classList = {
      toggle(c, on) { const s = new Set(self.className.split(/\s+/).filter(Boolean)); const want = on === undefined ? !s.has(c) : !!on; if (want) s.add(c); else s.delete(c); self.className = [...s].join(' '); return want; },
      contains(c) { return self.className.split(/\s+/).includes(c); }
    };
  }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this.children = []; this._text = String(v); }
  appendChild(c) { this.children.push(c); return c; }
  removeChild(c) { this.children.splice(this.children.indexOf(c), 1); return c; }
  get firstChild() { return this.children[0] || null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; }
  addEventListener(e, f) { (this.listeners[e] = this.listeners[e] || []).push(f); }
  click() { (this.listeners.click || []).forEach((f) => f({})); }
}
const all = (n, pred, out = []) => { if (pred(n)) out.push(n); n.children.forEach((c) => all(c, pred, out)); return out; };
const byClass = (n, c) => all(n, (x) => x.className.split(/\s+/).includes(c));
const button = (n, text) => all(n, (x) => x.tagName === 'button' && (x.textContent === text || x.getAttribute('aria-label') === text))[0];

/** The page's source between two markers (both must exist, in order). */
function slice(from, to) {
  const a = PAGE.indexOf(from), b = PAGE.indexOf(to, a + 1);
  assert.ok(a >= 0 && b > a, 'markers found: ' + from + ' … ' + to);
  return PAGE.slice(a, b);
}
const HELPERS = () => [slice('    /* ---------- DOM helpers', '    function httpsUrl('), slice('    function stateView(', '    /* ---------- theme'),
  slice('    function tripLabel(', '    /* ---------- home')].join('\n');

/** A VM context running the page's helpers plus the named parts; call answers from `answer(op, args)` → { ok, body }. */
function page(parts, answer, extra = {}, run = '') {
  const st = { rendered: null, calls: [], gone: [] };
  const nodes = {};
  const box = Object.assign({
    document: { title: '', createElement: (t) => new N(t), createTextNode: (t) => { const n = new N('#text'); n._text = String(t); return n; } },
    $: (id) => (nodes[id] = nodes[id] || new N('div')), S: { trip: TRIP, home: null },
    render: (v) => { st.rendered = v; }, go: (s, t) => { st.gone.push([s, t]); }, haptic() {}, setStatus() {}, setMain() {},
    call: (op, args, ok, fail) => { st.calls.push(JSON.parse(JSON.stringify([op, args]))); const r = answer(op, args); if (r.ok) ok(Object.assign({ ok: true }, r.body)); else if (fail) fail(Object.assign({ ok: false }, r.body)); }
  }, extra);
  vm.runInNewContext(HELPERS() + '\n' + parts.join('\n') + '\n' + run, box);
  return { box, st };
}
const VEG = () => slice('    /* ---------- veg card:', '    /* ---------- places:');
const PDF = () => slice('    var PDF_WHY', '    /* ---------- veg card:');
async function cardFor(name) {
  const [{ vegCard }, { partyDiet }] = await Promise.all([import('../packs/tour-guide/vegcard/index.mjs'), import('../packs/tour-guide/travellers/travellers-party.mjs')]);
  const f = FIX[name];
  return vegCard({ party: { ...partyDiet(f.members), size: f.members.length }, country: f.country, trip: TRIP });
}

test('the app page: the inline scripts compile, and go() opens the Veg card screen', SKIP, () => {
  const scripts = [...PAGE.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(scripts.length >= 1);
  scripts.forEach((s) => assert.doesNotThrow(() => new vm.Script(s)));
  const shown = [];
  // C15: go() also dispatches the Day trips screen (WP-15a) and the What's on screen (WP-15b), so their show functions must exist here too.
  const shows = ['showHome', 'showShortlist', 'showCompare', 'showFacts', 'showInterview', 'showBrochure', 'showPlaces', 'showScout', 'showVegCard', 'showDaytrip', 'showWhatson'];
  const box = { S: { screen: 'home', trip: '' }, tg: null, flushDraft() {}, setMain() {}, $: () => ({ children: [] }) };
  shows.forEach((f) => { box[f] = () => shown.push(f); });
  vm.runInNewContext(slice('    function go(screen, trip) {', '    function buildNav() {'), box);
  box.go('vegcard', TRIP);
  assert.deepEqual(shown, ['showVegCard']);
  assert.equal(box.S.screen, 'vegcard');
  assert.equal(box.S.trip, TRIP);
});

test('home: a 🥗 button on a trip row whose has_vegcard is true opens that trip\'s veg card; no button otherwise', SKIP, () => {
  const home = { trips_total: 3, places: {}, trips: [
    { slug: TRIP, title: 'Fernhollow', has_vegcard: true }, { slug: 'quillmoor-2099', title: 'Quillmoor', has_vegcard: 'true' }, { slug: 'brackenford-2099', title: 'Brackenford' }] };
  const { st } = page([slice('    function showHome() {', '    /* ---------- shortlist:')], () => ({ ok: true, body: home }), {}, 'showHome();');
  const rows = byClass(st.rendered, 'card');
  assert.equal(rows.length, 3);
  const veg = rows.map((r) => button(r, 'Veg card'));
  assert.ok(veg[0], 'the trip with a card has the button');
  assert.equal(veg[0].textContent, '🥗');
  assert.equal(veg[1], undefined, 'only has_vegcard === true counts');
  assert.equal(veg[2], undefined);
  veg[0].click();
  assert.deepEqual(st.gone, [['vegcard', TRIP]]);
});

test('Veg card: every line\'s local text large with its English beneath; one button hides and shows the English', SKIP, async () => {
  const card = await cardFor('vegetarian_pair_nuts');
  const { st } = page([VEG()], (op, args) => {
    assert.equal(op, 'vegcard.get'); assert.deepEqual(JSON.parse(JSON.stringify(args)), { slug: TRIP });
    return { ok: true, body: { trip: TRIP, fp: card.fp, received_at: '2099-01-01T00:00:00Z', card } };
  }, {}, 'showVegCard();');
  const v = st.rendered;
  assert.ok(v.className.split(' ').includes('vc-full'), 'the full-screen view');
  assert.equal(byClass(v, 'vc-head')[0].textContent, '🥗 Veg card — show this to the staff');
  const lines = byClass(v, 'vc-line');
  const want = card.sections.flatMap((s) => s.lines);
  assert.equal(lines.length, want.length);
  lines.forEach((ln, i) => {
    assert.equal(ln.children.length, 2);
    assert.equal(ln.children[0].className, 'vc-local'); assert.equal(ln.children[0].textContent, want[i].local);
    assert.equal(ln.children[0].getAttribute('lang'), 'ja');
    assert.equal(ln.children[1].className, 'vc-en'); assert.equal(ln.children[1].textContent, want[i].en);
  });
  assert.equal(byClass(v, 'vc-sec').length, card.sections.length);
  assert.match(byClass(v, 'meta')[0].textContent, /party of 2/);
  const tog = button(v, 'Hide English');
  assert.equal(tog.getAttribute('aria-pressed'), 'false');
  tog.click();
  assert.ok(v.classList.contains('hide-en'));
  assert.equal(tog.textContent, 'Show English');
  assert.equal(tog.getAttribute('aria-pressed'), 'true');
  tog.click();
  assert.ok(!v.classList.contains('hide-en'));
  button(v, '← Close').click();
  assert.deepEqual(st.gone, [['home', undefined]]);
});

test('Veg card: an English-only card says so, has no hide button, and lists the English-only items; hostile text stays text', SKIP, async () => {
  const card = await cardFor('no_table');
  assert.equal(card.lang, null);
  card.sections[0].lines[0].en = '<img src=x onerror=alert(1)>';
  const { st } = page([VEG()], () => ({ ok: true, body: { trip: TRIP, fp: card.fp, received_at: '', card } }), {}, 'showVegCard();');
  const v = st.rendered;
  assert.equal(button(v, 'Hide English'), undefined);
  assert.equal(byClass(v, 'note')[0].textContent, 'No local-language phrases for this country yet — English only.');
  const lines = byClass(v, 'vc-line');
  assert.ok(lines.every((l) => l.className === 'vc-line only' && l.children.length === 1));
  assert.equal(lines[0].textContent, '<img src=x onerror=alert(1)>');
  assert.equal(all(v, (x) => x.tagName === 'img').length, 0, 'no element came from the text');
  assert.deepEqual(byClass(v, 'vc-eo')[0].children.map((li) => li.textContent), card.english_only);
  assert.ok(card.english_only.length >= 1);
});

test('Veg card: no card stored → how to get one in the chat; no trip → nothing is asked', SKIP, () => {
  let r = page([VEG()], () => ({ ok: false, body: { status: 404, reason: 'no_vegcard' } }), {}, 'showVegCard();');
  assert.match(r.st.rendered.textContent, /No veg card yet[\s\S]*\/vegcard/);
  r = page([VEG()], () => { throw new Error('no call expected'); }, { S: { trip: '' } }, 'showVegCard();');
  assert.match(r.st.rendered.textContent, /No trip chosen/);
  assert.equal(r.st.calls.length, 0);
});

test('Brochure PDF: "Sent to the chat", "Building — it arrives in the chat", and each refusal beside the button', SKIP, () => {
  const run = (answer) => {
    const { box, st } = page([PDF()], answer);
    const row = box.pdfRow(TRIP), btn = row.children[0], note = row.children[1];
    assert.equal(btn.textContent, '📄 PDF');
    btn.click();
    assert.deepEqual(st.calls, [['brochure.pdf', { slug: TRIP }]]);
    assert.equal(btn.disabled, false, 'the button is usable again');
    return note.textContent;
  };
  assert.equal(run(() => ({ ok: true, body: { sent: true } })), 'Sent to the chat');
  assert.equal(run(() => ({ ok: true, body: { building: true } })), 'Building — it arrives in the chat');
  assert.equal(run(() => ({ ok: false, body: { status: 409, reason: 'too_soon', retry_after: 60 } })), 'Just asked — try again in a minute.');
  assert.equal(run(() => ({ ok: false, body: { status: 404, reason: 'no_brochure' } })), 'The brochure file is not available.');
  assert.equal(run(() => ({ ok: false, body: { status: 503, reason: 'not_sent' } })), 'The chat did not take the file — send /brochure there.');
  assert.equal(run(() => ({ ok: false, body: { status: 409, reason: 'no_chat' } })), 'The chat is not paired yet.');
});

test('Brochure screen: the PDF row sits under the trip heading, for a trip with or without a brochure', SKIP, () => {
  const src = slice('    function showBrochure() {', '    /* The brochure PDF, sent to the chat');
  const digest = { trip: { slug: TRIP, title: 'Fernhollow' }, days: [], later: [] };
  const { st } = page([src, PDF()], (op) => (op === 'trip.digest' ? { ok: true, body: digest } : { ok: true, body: { sent: true } }),
    { dayCard: () => new N('div'), linkBtn: () => null, httpsUrl: () => '' }, 'showBrochure();');
  const row = byClass(st.rendered, 'pdf-row')[0];
  assert.ok(row, 'the PDF row is on the brochure screen');
  assert.equal(st.rendered.children.indexOf(row), 2, 'after the heading and the lede');
  row.children[0].click();
  assert.equal(row.children[1].textContent, 'Sent to the chat');
});

// Developed by: LightAISolutions
