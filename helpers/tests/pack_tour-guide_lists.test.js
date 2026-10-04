'use strict';
// Tour Guide — the lists branch (TG-PHASE-14 WP-14d, Contract C14 wave 2) in the core: /lists, /list <name>, /lists sync,
// tgListNames(), the Places tab's `lists` column (absent keeps, [] clears), the places digest's `lists`, the app's
// list filter and facet, and /places showing a place's lists. Invented data only (the town "Quillmere"); no network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const H = require('./harness/gas-mocks');

const PACK_DIR = path.join(H.HELPERS_ROOT, 'packs', 'tour-guide');
const FIX = JSON.parse(fs.readFileSync(path.join(PACK_DIR, 'lists', 'fixtures', 'lists-sample.json'), 'utf8'));
const MANIFEST = JSON.parse(fs.readFileSync(path.join(PACK_DIR, 'helper.json'), 'utf8'));
const NOW = '2027-05-01T12:00:00Z';
const SHELL = 'https://app.example.invalid/helper-app.html';
const J = (v) => JSON.parse(JSON.stringify(v));

function fresh(o = {}) {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: o.now || NOW, manifest: o.manifest || MANIFEST });
  H.bootstrap(ctx, state);
  H.configureRoutine(ctx, state, 'RESEARCH');
  if (o.trip !== false) ctx.tgTripUpsert(FIX.trip);
  return { ctx, state };
}
const say = (ctx, state, text) => ctx.doPost(H.postEvent('tg', { k: state.props[ctx.PROP.WEBHOOK_SECRET] }, H.tgUpdate({ text })));
const sends = (state) => state.fetch.telegram('sendMessage').map((r) => r.json);
const texts = (state) => sends(state).map((m) => m.text);
const requests = (state) => (state.drive.listFiles(MANIFEST.drive_root + '/mailbox/to-brain') || []).filter((n) => /^req_/.test(n))
  .map((n) => JSON.parse(state.drive.readFile(MANIFEST.drive_root + '/mailbox/to-brain', n)));
const app = (ctx, state, op, args) => J(H.appPost(ctx, state, 'app', { op, args }));
function deliver(ctx, state, type, payload, over) {
  H.putEnvelope(state, H.envelope(type, payload, over));
  return J(ctx.pollFromBrain());
}
const place = (slug, over = {}) => ({ slug, name: slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '), area: 'Old Town',
  category: 'restaurant', tags: [], status: 'candidate', last_trip: null, last_researched: '2027-04-01', last_verified: '2027-04-01',
  note_line: 'An invented note.', maps_url: 'https://www.google.com/maps/search/?api=1&query=Fixture&query_place_id=Fx' + slug.replace(/-/g, ''),
  history_summary: '', ...over });
const digest = (destination, places) => ({ v: 1, kind: 'places_digest', destination, places });
/** Places on the owner's lists in two destinations. */
function stock(ctx) {
  ctx.tgPlacesUpsert(digest('quillmere', [
    place('lantern-noodle-house', { lists: ['Dinner spots'], status: 'chosen', note_line: 'Mild broth on request.' }),
    place('moss-and-pine', { lists: ['Dinner spots', 'Want to go'] }),
    place('clock-museum', { lists: ['Rainy day'], category: 'museum' }),
    place('reed-mill', { category: 'museum' })
  ]));
  ctx.tgPlacesUpsert(digest('brook-end', [place('willow-green', { lists: ['dinner spots'.replace('d', 'D'), 'Picnic'] })]));
}

/* ---------------- registration ---------------- */
test('lists: the commands and the kind\'s routing are registered', () => {
  const { ctx } = fresh();
  assert.equal(typeof ctx.getCommand('/lists'), 'function');
  assert.equal(typeof ctx.getCommand('/list'), 'function');
  const help = J(ctx.HB_REGISTRY.help);
  assert.ok(help.some((l) => l.indexOf('/lists — ') === 0), 'a help line for /lists');
  assert.ok(help.some((l) => l.indexOf('/list — ') === 0), 'a help line for /list');
  assert.equal(ctx.TG_KIND_ROUTINE['lists'], 'RESEARCH');
  assert.equal(ctx.tgKindRoutine('lists'), 'RESEARCH');
});

/* ---------------- the places digest ---------------- */
test('the places digest takes lists (C14): the core validator and the pack schema agree; an old digest still passes', async () => {
  const { ctx } = fresh();
  const S = await import('../packs/tour-guide/schemas/index.mjs');
  const cases = [
    [digest('quillmere', [place('a-place')]), true],
    [digest('quillmere', [place('a-place', { lists: [] })]), true],
    [digest('quillmere', [place('a-place', { lists: ['Dinner spots', 'x'.repeat(80)] })]), true],
    [digest('quillmere', [place('a-place', { lists: 'Dinner spots' })]), false],
    [digest('quillmere', [place('a-place', { lists: [''] })]), false],
    [digest('quillmere', [place('a-place', { lists: ['x'.repeat(81)] })]), false],
    [digest('quillmere', [place('a-place', { lists: [7] })]), false],
    [digest('quillmere', [place('a-place', { lists: Array.from({ length: 21 }, (_, i) => 'L' + i) })]), false],
    [digest('quillmere', [place('a-place', { lists: null })]), false]
  ];
  cases.forEach(([d, ok], i) => {
    const core = J(ctx.tgEnvValidatePlacesDigest(d));
    const pack = S.validatePayload('places_digest', d);
    assert.equal(core.length === 0, ok, `core, case ${i}: ${JSON.stringify(core)}`);
    assert.equal(pack.ok, ok, `schema, case ${i}: ${JSON.stringify(pack.errors)}`);
    if (!ok) assert.ok(core.some((e) => /lists/.test(e)), `core names lists, case ${i}`);
  });
});

/* ---------------- the Places tab ---------------- */
test('the Places tab: lists stored in a new last column; absent keeps them, [] clears them, a change counts as changed', () => {
  const { ctx, state } = fresh();
  let r = deliver(ctx, state, 'places_digest', digest('quillmere', [place('moss-and-pine', { lists: ['Dinner spots', 'Dinner spots', 'Want to go'] }), place('reed-mill')]));
  assert.equal(r.processed, 1);
  const head = ctx.sheetHeaders(ctx.getSheet('Places'));
  assert.equal(head[head.length - 1], 'lists');
  assert.deepEqual(J(ctx.tgPlacesGet('moss-and-pine')).lists, ['Dinner spots', 'Want to go'], 'stored once each');
  assert.equal('lists' in J(ctx.tgPlacesGet('reed-mill')), false, 'a place on no list has no lists key');
  // A digest without lists (the old pin) keeps what is stored.
  let res = J(ctx.tgPlacesUpsert(digest('quillmere', [place('moss-and-pine', { last_verified: '2027-04-20' })])));
  assert.deepEqual([res.changed, res.verified], [0, 1]);
  assert.deepEqual(J(ctx.tgPlacesGet('moss-and-pine')).lists, ['Dinner spots', 'Want to go']);
  assert.deepEqual(res.refused, []);
  // A new list set replaces it and counts as a change; [] clears it.
  res = J(ctx.tgPlacesUpsert(digest('quillmere', [place('moss-and-pine', { last_verified: '2027-04-20', lists: ['Want to go'] })])));
  assert.deepEqual([res.changed, res.places[0].changed_fields], [1, ['lists']]);
  assert.deepEqual(J(ctx.tgPlacesGet('moss-and-pine')).lists, ['Want to go']);
  res = J(ctx.tgPlacesUpsert(digest('quillmere', [place('moss-and-pine', { last_verified: '2027-04-20', lists: [] })])));
  assert.equal(res.changed, 1);
  assert.equal('lists' in J(ctx.tgPlacesGet('moss-and-pine')), false);
  // The same lists again are "same".
  ctx.tgPlacesUpsert(digest('quillmere', [place('moss-and-pine', { last_verified: '2027-04-20', lists: ['Want to go'] })]));
  res = J(ctx.tgPlacesUpsert(digest('quillmere', [place('moss-and-pine', { last_verified: '2027-04-20', lists: ['Want to go'] })])));
  assert.equal(res.same, 1);
});

test('the Places tab: a tab made before the column gains it, and its rows read exactly as before', () => {
  const { ctx } = fresh();
  const sh = ctx.getSheet('Places');
  const old = ctx.sheetHeaders(sh).filter((h) => h !== 'lists');
  sh.clear();
  sh.getRange(1, 1, 1, old.length).setValues([old]);
  const row = { slug: 'reed-mill', name: 'Reed Mill', destination: 'quillmere', area: '', category: 'museum', tags: '[]', status: 'candidate',
    last_trip: '', last_researched: '', last_verified: '', note_line: '', maps_url: '', history_json: '{"summary":""}', scouted: '' };
  sh.appendRow(old.map((h) => row[h]));
  const before = J(ctx.tgPlacesGet('reed-mill'));
  assert.equal('lists' in before, false);
  ctx.tgPlacesUpsert(digest('quillmere', [place('clock-museum', { lists: ['Rainy day'] })]));
  assert.equal(ctx.sheetHeaders(sh).slice(-1)[0], 'lists');
  assert.deepEqual(J(ctx.tgPlacesGet('reed-mill')), before);
  assert.deepEqual(J(ctx.tgPlacesGet('clock-museum')).lists, ['Rainy day']);
  // A cell that is not a JSON array of strings reads as no lists.
  const col = ctx.sheetHeaders(sh).indexOf('lists') + 1;
  sh.getRange(2, col).setValue('not json');
  assert.equal('lists' in J(ctx.tgPlacesGet('reed-mill')), false);
});

/* ---------------- tgListNames ---------------- */
test('tgListNames: every list name on a stored place with its count, sorted by name', () => {
  const { ctx } = fresh();
  assert.deepEqual(J(ctx.tgListNames()), []);
  stock(ctx);
  assert.deepEqual(J(ctx.tgListNames()), [{ name: 'Dinner spots', count: 3 }, { name: 'Picnic', count: 1 }, { name: 'Rainy day', count: 1 }, { name: 'Want to go', count: 1 }]);
});

/* ---------------- /lists ---------------- */
test('/lists: the lists with counts, when they were last read, and what to send next', () => {
  let { ctx, state } = fresh();
  say(ctx, state, '/lists');
  assert.match(texts(state).pop(), /No lists yet[\s\S]*\/lists sync/);
  assert.equal(requests(state).length, 0, '/lists alone never opens a request');

  stock(ctx);
  say(ctx, state, '/lists');
  let out = texts(state).pop();
  assert.match(out, /Your lists/);
  assert.match(out, /Dinner spots — 3\n[\s\S]*Picnic — 1\n[\s\S]*Rainy day — 1\n[\s\S]*Want to go — 1/);
  assert.match(out, /Not read from an export yet/);
  assert.match(out, /\/list &lt;name&gt; to see one · \/lists sync to read a newer export/);

  // Answer a lists request: /lists then names the day it was answered.
  say(ctx, state, '/lists sync');
  const id = requests(state)[0].id;
  assert.equal(deliver(ctx, state, 'reply', { text: 'Read 4 lists.' }, { in_reply_to: id }).processed, 1);
  say(ctx, state, '/lists');
  out = texts(state).pop();
  assert.match(out, /Last read from an export: 2027-05-01/);
  // Hostile list names stay text.
  ctx.tgPlacesUpsert(digest('quillmere', [place('odd-place', { lists: ['<b>x</b> & y'] })]));
  say(ctx, state, '/lists');
  assert.match(texts(state).pop(), /&lt;b&gt;x&lt;\/b&gt; &amp; y — 1/);
});

test('/lists sync: a lists request with the current trip, or without one; anything else is the usage line', () => {
  let { ctx, state } = fresh();
  say(ctx, state, '/lists sync');
  let reqs = requests(state);
  assert.equal(reqs.length, 1);
  assert.equal(reqs[0].payload.kind, 'lists');
  assert.equal(reqs[0].payload.trip, FIX.trip.slug);
  assert.equal(J(ctx.storeAll('Requests'))[0].routine, 'RESEARCH');
  assert.match(texts(state).join('\n'), /Reading your newest saved-lists export/);
  ({ ctx, state } = fresh({ trip: false }));
  say(ctx, state, '/lists SYNC');
  reqs = requests(state);
  assert.equal(reqs.length, 1);
  assert.equal('trip' in reqs[0].payload, false, 'no current trip: the request has no trip');
  say(ctx, state, '/lists everything');
  assert.match(texts(state).pop(), /Usage: \/lists · \/lists sync · \/list &lt;name&gt;/);
  assert.equal(requests(state).length, 1);
});

/* ---------------- /list <name> ---------------- */
test('/list <name>: the list\'s places grouped by destination, with status and note line; names fold; unknown and ambiguous names', () => {
  const { ctx, state } = fresh();
  say(ctx, state, '/list Dinner spots');
  assert.match(texts(state).pop(), /No list called “Dinner spots” — \/lists shows them/);
  stock(ctx);
  say(ctx, state, '/list dinner SPOTS');
  const out = texts(state).pop();
  assert.match(out, /📋 <b>Dinner spots<\/b> — 3 places/);
  // brook-end before quillmere; inside a destination by name.
  assert.match(out, /<b>brook-end<\/b>\n• .*Willow Green.* · candidate\n   <i>An invented note\.<\/i>\n\n<b>quillmere<\/b>\n• .*Lantern Noodle House.* · chosen\n   <i>Mild broth on request\.<\/i>\n• .*Moss And Pine/);
  assert.doesNotMatch(out, /Reed Mill|Clock Museum/);
  say(ctx, state, '/list');
  assert.match(texts(state).pop(), /Usage: \/list &lt;name&gt; — \/lists shows your lists/);
  say(ctx, state, '/list rain');
  assert.match(texts(state).pop(), /Rainy day<\/b> — 1 place\b/, 'a unique start of a name is enough');
  ctx.tgPlacesUpsert(digest('quillmere', [place('pear-walk', { lists: ['Rain walks'] })]));
  say(ctx, state, '/list rain');
  assert.match(texts(state).pop(), /Which list\? Rain walks · Rainy day/);
});

test('/list <name>: at most 40 places, then "and N more" with the app row', () => {
  const { ctx, state } = fresh();
  ctx.tgPlacesUpsert(digest('quillmere', Array.from({ length: 43 }, (_, i) => place('stop-' + String(i + 1).padStart(2, '0'), { lists: ['Long walk'] }))));
  say(ctx, state, '/list Long walk');
  let msgs = sends(state).slice(-3);
  let all = msgs.map((m) => m.text).join('\n');
  assert.equal((all.match(/^• /gm) || []).length, 40);
  assert.match(all, /… and 3 more — open Places in the app/);
  state.props[ctx.PROP.APP_SHELL_URL] = SHELL;
  say(ctx, state, '/list Long walk');
  const last = sends(state).pop();
  assert.ok(last.reply_markup.inline_keyboard.flat().some((b) => b.web_app && /^https:\/\/app\.example\.invalid\//.test(b.web_app.url)), 'the app row');
});

/* ---------------- /places and the app ---------------- */
test('/places search results show a place\'s lists', () => {
  const { ctx, state } = fresh();
  stock(ctx);
  say(ctx, state, '/places moss');
  assert.match(texts(state).pop(), /Moss And Pine.* · 📋 Dinner spots, Want to go/);
  say(ctx, state, '/places reed');
  assert.doesNotMatch(texts(state).pop(), /📋/);
});

test('the app: places.search takes a list filter and returns a lists facet; rows carry lists only when they have some', () => {
  const { ctx, state } = fresh();
  stock(ctx);
  const all = app(ctx, state, 'places.search', {});
  assert.deepEqual(all.filters.lists, ['Dinner spots', 'Picnic', 'Rainy day', 'Want to go']);
  const din = app(ctx, state, 'places.search', { list: 'dinner spots' });
  assert.deepEqual(din.rows.map((r) => r.slug).sort(), ['lantern-noodle-house', 'moss-and-pine', 'willow-green']);
  assert.deepEqual(din.rows.find((r) => r.slug === 'moss-and-pine').lists, ['Dinner spots', 'Want to go']);
  assert.equal(app(ctx, state, 'places.search', { list: 'Rainy day', query: 'clock' }).total, 1);
  assert.equal(app(ctx, state, 'places.search', { list: 'Nowhere' }).total, 0);
  assert.equal('lists' in app(ctx, state, 'places.search', { query: 'reed' }).rows[0], false);
  assert.equal(app(ctx, state, 'places.search', { list: 'x'.repeat(81) }).reason, 'too_long');
});

/* ---------------- the app page's Places screen (the list filter), run in a vm with a tiny DOM ---------------- */
// The page lives outside helpers/, so a vendored copy of these tests (helpers-dist) has no page to read: this test skips there.
const PAGE_FILE = path.join(__dirname, '..', '..', 'live-site-pages', 'helper-app.html');
const PAGE = fs.existsSync(PAGE_FILE) ? fs.readFileSync(PAGE_FILE, 'utf8') : null;
function node(tag, attrs = {}, children) {
  const n = { tag, attrs, children: [], listeners: {}, text: attrs.text === undefined ? '' : String(attrs.text), value: attrs.value === undefined ? '' : String(attrs.value),
    appendChild(c) { if (c) this.children.push(c); return c; }, removeChild(c) { this.children.splice(this.children.indexOf(c), 1); },
    get firstChild() { return this.children[0] || null; }, setAttribute(k, v) { this.attrs[k] = v; },
    addEventListener(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); } };
  [].concat(children || []).forEach((c) => n.appendChild(typeof c === 'string' ? node('#text', { text: c }) : c));
  return n;
}
function find(n, pred) { if (pred(n)) return n; for (const c of n.children || []) { const f = find(c, pred); if (f) return f; } return null; }

test('the app\'s Places screen: a list filter beside the tag filter, filled from the facet, sent as `list`',
  { skip: PAGE === null ? 'the app page is not part of this copy of the helpers' : false }, () => {
  const src = PAGE.slice(PAGE.indexOf('    function showPlaces() {'), PAGE.indexOf('    /* ---------- scout:'));
  const calls = [];
  let rendered = null, facet = { destinations: ['quillmere'], statuses: ['candidate'], tags: ['rainy day'], lists: ['Dinner spots', '<b>Rainy</b>'] };
  const box = { str: (v, max) => { v = v === undefined || v === null ? '' : String(v); return max && v.length > max ? v.slice(0, max - 1) + '…' : v; },
    num: (v) => (isFinite(Number(v)) ? Number(v) : 0), list: (v) => (Array.isArray(v) ? v : []), obj: (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {}),
    el: node, clear: (n) => { n.children.length = 0; return n; }, linkBtn: () => null, render: (v) => { rendered = v; },
    call: (op, args, ok) => { calls.push({ op, args }); ok({ rows: [], total: 0, filters: facet }); }, setMain() {}, haptic() {}, go() {}, setStatus() {}, mainProgress() {},
    setTimeout, clearTimeout };
  vm.runInNewContext(src + '\nshowPlaces();', box);
  const filters = find(rendered, (n) => n.attrs && n.attrs.class === 'filters');
  const labels = filters.children.map((c) => c.attrs['aria-label']);
  assert.deepEqual(labels, ['Trip', 'Status', 'Tag', 'List'], 'the list filter sits beside the tag filter');
  const sel = filters.children[3];
  assert.deepEqual(J(sel.children.map((o) => [o.attrs.value, o.text])), [['', 'Any list'], ['Dinner spots', 'Dinner spots'], ['<b>Rainy</b>', '<b>Rainy</b>']]);
  assert.equal(sel.hidden, false);
  sel.value = 'Dinner spots';
  sel.listeners.change.forEach((f) => f());
  assert.deepEqual(J(calls.pop()), { op: 'places.search', args: { query: '', list: 'Dinner spots' } });
  // An older core sends no lists facet: the filter stays hidden and nothing is sent.
  facet = { destinations: [], statuses: [], tags: [] };
  calls.length = 0;
  vm.runInNewContext(src + '\nshowPlaces();', box);
  const sel2 = find(rendered, (n) => n.attrs && n.attrs['aria-label'] === 'List');
  assert.equal(sel2.hidden, true);
  assert.deepEqual(J(calls[0].args), { query: '' });
});

// Developed by: LightAISolutions
