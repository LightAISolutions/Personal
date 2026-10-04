'use strict';
// WP-13c item 8 (C13): scouted candidates — the places digest's `scouted: true`, the Places tab's new last column, the
// "🔎 Scouted, not chosen yet" group in /places and in the app's Places screen, and old rows exactly as before.
// Invented data only (the town "Fernhollow", invented places).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const W = require('./pack_tour-guide_p13c_world');

const DEST = 'fernhollow';
const place = (slug, over = {}) => ({ slug, name: slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '), area: 'Old Town',
  category: 'sight', tags: ['rainy day'], status: 'candidate', last_trip: null, last_researched: '2027-04-01', last_verified: '2027-04-01',
  note_line: 'An invented note.', maps_url: W.maps('Fx' + slug.replace(/-/g, '')), history_summary: '', ...over });
const placesDigest = (places) => ({ v: 1, kind: 'places_digest', destination: DEST, places });
const app = (ctx, state, op, args) => W.J(W.H.appPost(ctx, state, 'app', { op, args }));
const SHELL = 'https://app.example.invalid/helper-app.html';

test('the places digest accepts scouted only as true, in the core and in the pack schema alike', async () => {
  const { ctx } = W.fresh();
  const S = await import('../packs/tour-guide/schemas/index.mjs');
  const good = placesDigest([place('reed-mill', { scouted: true }), place('pear-walk')]);
  assert.deepEqual(W.J(ctx.tgEnvValidatePlacesDigest(good)), []);
  assert.ok(S.validatePayload('places_digest', good).ok);
  [false, 'true', 1, null, {}].forEach((v) => {
    const bad = placesDigest([place('reed-mill', { scouted: v })]);
    assert.ok(W.J(ctx.tgEnvValidatePlacesDigest(bad)).some((e) => /scouted/.test(e)), 'core refuses ' + JSON.stringify(v));
    assert.ok(!S.validatePayload('places_digest', bad).ok, 'schema refuses ' + JSON.stringify(v));
  });
  // Unknown keys are still refused by both.
  const odd = placesDigest([place('reed-mill', { scouted_by: 'x' })]);
  assert.ok(W.J(ctx.tgEnvValidatePlacesDigest(odd)).some((e) => /unknown key "scouted_by"/.test(e)));
  assert.ok(!S.validatePayload('places_digest', odd).ok);
});

test('a scouted place is stored in the new last column; it leaves the group when the next digest no longer marks it', () => {
  const { ctx, state } = W.fresh();
  let r = W.deliver(ctx, state, 'places_digest', placesDigest([place('reed-mill', { scouted: true }), place('pear-walk', { status: 'chosen' })]));
  assert.equal(r.processed, 1);
  assert.equal(W.J(ctx.tgPlacesGet('reed-mill')).scouted, true);
  assert.equal('scouted' in W.J(ctx.tgPlacesGet('pear-walk')), false, 'an unmarked place has no scouted key at all');
  const head = ctx.sheetHeaders(ctx.getSheet('Places'));
  assert.deepEqual(head.slice(-2), ['scouted', 'lists'], 'C14: scouted stays after the old columns; lists (WP-14d) is the last');
  assert.deepEqual(W.J(ctx.tgPlacesScouted()).map((p) => p.slug), ['reed-mill']);

  // A check digest that names only another place keeps the mark (it says nothing about reed-mill).
  W.deliver(ctx, state, 'places_digest', placesDigest([place('pear-walk', { status: 'chosen', last_verified: '2027-04-20' })]));
  assert.equal(W.J(ctx.tgPlacesGet('reed-mill')).scouted, true);
  // The next digest that lists it without the mark takes it out of the group; only the mark moved → "verified", not "changed".
  const res = W.J(ctx.tgPlacesUpsert(placesDigest([place('reed-mill')])));
  assert.deepEqual([res.added, res.changed, res.verified, res.same], [0, 0, 1, 0]);
  assert.equal('scouted' in W.J(ctx.tgPlacesGet('reed-mill')), false);
  assert.deepEqual(W.J(ctx.tgPlacesScouted()), []);
  // …and marked again.
  assert.equal(W.J(ctx.tgPlacesUpsert(placesDigest([place('reed-mill', { scouted: true })]))).verified, 1);
  // Sheets may hand the cell back as a boolean.
  const sh = ctx.getSheet('Places'), col = ctx.sheetHeaders(sh).indexOf('scouted') + 1;
  sh.getRange(3, col).setValue(true);
  assert.equal(W.J(ctx.tgPlacesGet('pear-walk')).scouted, true);
  sh.getRange(3, col).setValue('no');
  assert.equal('scouted' in W.J(ctx.tgPlacesGet('pear-walk')), false);
});

test('old data: a Places tab from before C13 reads and shows exactly as before, and gains the column on the next digest', () => {
  const { ctx, state } = W.fresh();
  ctx.tgPlacesUpsert(placesDigest([place('reed-mill'), place('pear-walk')]));
  W.say(ctx, state, '/places');
  const overview = W.last(state);
  W.say(ctx, state, '/places mill');
  const search = W.last(state);
  const before = W.J(ctx.tgPlacesGet('reed-mill'));
  // Make it an old tab: no scouted column at all.
  const sh = ctx.getSheet('Places');
  sh.rows().forEach((row) => { row.length = 13; });
  assert.equal(ctx.sheetHeaders(sh).includes('scouted'), false);
  assert.deepEqual(W.J(ctx.tgPlacesGet('reed-mill')), before);
  assert.equal('scouted' in before, false);
  W.say(ctx, state, '/places');
  assert.equal(W.last(state), overview);
  assert.equal(overview, '📚 <b>Places I know</b>\nfernhollow — 2\n\nSearch: <code>/places &lt;name, tag or area&gt;</code>');
  W.say(ctx, state, '/places mill');
  assert.equal(W.last(state), search);
  assert.doesNotMatch(search, /Scouted/);
  // The next digest adds the column at the end; the old rows still read the same.
  W.deliver(ctx, state, 'places_digest', placesDigest([place('weir-steps', { scouted: true })]));
  const head = ctx.sheetHeaders(sh);
  assert.deepEqual(head.slice(-2), ['scouted', 'lists'], 'C14: both columns come back at the end, lists (WP-14d) last');
  assert.deepEqual(W.J(ctx.tgPlacesGet('reed-mill')), before);
  assert.equal(W.J(ctx.tgPlacesGet('weir-steps')).scouted, true);
});

test('/places counts the scouted candidates per destination and lists them as their own group; a search puts them last', () => {
  const { ctx, state } = W.fresh();
  ctx.tgPlacesUpsert(placesDigest([place('reed-mill', { status: 'chosen' }), place('mill-race-walk', { scouted: true }),
    place('bad-mill', { name: '<b>Bad</b> & Mill', area: '<i>Quay</i>', scouted: true, maps_url: 'javascript:alert(1)' })]));
  ctx.tgPlacesUpsert({ destination: 'gull-bay', places: [place('gull-steps')] });
  W.say(ctx, state, '/places');
  assert.equal(W.last(state), '📚 <b>Places I know</b>\nfernhollow — 3 · 🔎 2 scouted\ngull-bay — 1\n\n' +
    '🔎 <b>Scouted, not chosen yet</b>\n' +
    '• &lt;b&gt;Bad&lt;/b&gt; &amp; Mill · fernhollow · &lt;i&gt;Quay&lt;/i&gt;\n' +
    '• <a href="' + W.maps('Fxmillracewalk').replace(/&/g, '&amp;') + '">Mill Race Walk</a> · fernhollow · Old Town\n\n' +
    'Search: <code>/places &lt;name, tag or area&gt;</code>');

  W.say(ctx, state, '/places mill');
  const msg = W.sends(state).pop();
  const lines = msg.text.split('\n');
  assert.equal(lines[0], '📚 <b>3 matches</b> — 📝 full note · ➕ add to the current trip · 🔁 fresh check');
  assert.match(lines[1], /^<b>1\.<\/b> <a [^>]+>Reed Mill<\/a> · chosen/);
  assert.equal(lines[3], '🔎 <b>Scouted, not chosen yet</b>');
  assert.match(lines[4], /^<b>2\.<\/b> /);
  assert.match(lines[6], /^<b>3\.<\/b> /);
  // The buttons follow the same order: 📝 1 is the chosen place.
  assert.equal(W.kbData(msg)[0], 'ps:reed-mill:n');
  // No scouted hit → no group header.
  W.say(ctx, state, '/places reed');
  assert.doesNotMatch(W.last(state), /Scouted/);
});

test('/places shows at most 20 scouted candidates and says how many more there are', () => {
  const { ctx, state } = W.fresh();
  ctx.tgPlacesUpsert(placesDigest(Array.from({ length: 23 }, (_, i) => place('stop-' + String(i + 1).padStart(2, '0'), { scouted: true }))));
  W.say(ctx, state, '/places');
  const all = W.texts(state).slice(-2).join('\n');
  assert.equal((all.match(/^• /gm) || []).length, 20);
  assert.match(all, /fernhollow — 23 · 🔎 23 scouted/);
  assert.match(all, /\n… and 3 more — <code>\/places &lt;name&gt;<\/code> finds them\./);
});

test('the app: places.search and places.get carry scouted: true on a scouted place only', () => {
  const { ctx, state } = W.fresh();
  state.props[ctx.PROP.APP_SHELL_URL] = SHELL;
  ctx.tgPlacesUpsert(placesDigest([place('reed-mill'), place('mill-race-walk', { scouted: true })]));
  const rows = app(ctx, state, 'places.search', { query: 'mill' }).rows;
  assert.deepEqual(rows.map((r) => [r.slug, r.scouted]).sort(), [['mill-race-walk', true], ['reed-mill', undefined]]);
  assert.equal(app(ctx, state, 'places.get', { slug: 'mill-race-walk' }).place.scouted, true);
  assert.equal('scouted' in app(ctx, state, 'places.get', { slug: 'reed-mill' }).place, false);
});

/* ---- the app page's Places screen, run in a vm with a tiny DOM ---- */
// The page lives outside helpers/, so a vendored copy of these tests (helpers-dist) has no page to read: that one test skips there.
const PAGE_FILE = path.join(__dirname, '..', '..', 'live-site-pages', 'helper-app.html');
const PAGE = fs.existsSync(PAGE_FILE) ? fs.readFileSync(PAGE_FILE, 'utf8') : null;
function node(tag, attrs = {}, children) {
  const n = { tag, attrs, children: [], text: attrs.text === undefined ? '' : String(attrs.text),
    appendChild(c) { if (c) this.children.push(c); return c; }, removeChild(c) { this.children.splice(this.children.indexOf(c), 1); },
    get firstChild() { return this.children[0] || null; }, setAttribute(k, v) { this.attrs[k] = v; }, addEventListener() {} };
  [].concat(children || []).forEach((c) => n.appendChild(typeof c === 'string' ? node('#text', { text: c }) : c));
  return n;
}
function runPlaces(rows) {
  const src = PAGE.slice(PAGE.indexOf('    function showPlaces() {'), PAGE.indexOf('    /* ---------- scout:'));
  let rendered = null;
  const box = { str: (v, max) => { v = v === undefined || v === null ? '' : String(v); return max && v.length > max ? v.slice(0, max - 1) + '…' : v; },
    num: (v) => (isFinite(Number(v)) ? Number(v) : 0), list: (v) => (Array.isArray(v) ? v : []), obj: (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {}),
    el: node, clear: (n) => { n.children.length = 0; return n; }, linkBtn: () => null, render: (v) => { rendered = v; },
    call: (op, args, ok) => ok({ rows, total: rows.length, filters: {} }), setMain() {}, haptic() {}, go() {}, setStatus() {}, mainProgress() {},
    setTimeout, clearTimeout };
  vm.runInNewContext(src + '\nshowPlaces();', box);
  const results = rendered.children.find((c) => c.attrs.id === 'results');
  return results.children.map((c) => (c.tag === 'h3' ? 'H3:' + c.text : c.tag === 'p' ? 'P:' + c.text : c.children[0].children[0].children[0].text));
}

test('the app\'s Places screen: the inline scripts compile; scouted rows form their own group after the others',
  { skip: PAGE === null ? 'the app page is not part of this copy of the helpers' : false }, () => {
  const scripts = [...PAGE.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(scripts.length >= 1);
  scripts.forEach((s) => assert.doesNotThrow(() => new vm.Script(s)));
  const r = (slug, scouted) => ({ slug, name: slug, destination: DEST, ...(scouted ? { scouted: true } : {}) });
  assert.deepEqual(runPlaces([r('a-scouted', true), r('b-chosen'), r('c-scouted', true), r('d-chosen')]),
    ['P:4 of 4 places', 'b-chosen', 'd-chosen', 'H3:🔎 Scouted, not chosen yet', 'a-scouted', 'c-scouted']);
  // Old rows (no scouted key) show as before: no group header; only scouted === true counts.
  assert.deepEqual(runPlaces([r('b-chosen'), r('d-chosen'), { ...r('e-odd'), scouted: 'true' }]), ['P:3 of 3 places', 'b-chosen', 'd-chosen', 'e-odd']);
  // Hostile names stay text (the page builds text nodes, never HTML).
  assert.deepEqual(runPlaces([{ ...r('x', true), name: '<img src=x onerror=alert(1)>' }]), ['P:1 of 1 places', 'H3:🔎 Scouted, not chosen yet', '<img src=x onerror=alert(1)>']);
});

// Developed by: LightAISolutions
