'use strict';
// kits/research — budgets, ledger, two-source rule, confidence labels, duration ranges, run-file schema.
// No network: search and fetch are the fixture-backed fakes in kits/research/fixtures/research-fake-web.mjs.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const T0 = Date.parse('2026-10-01T10:00:00Z');
const kit = () => import('../kits/research/index.mjs');
const web = () => import('../kits/research/fixtures/research-fake-web.mjs');

// A session over the fixture web with a controllable clock.
async function session(budgets = {}, opts = {}) {
  const k = await kit();
  const w = (await web()).fakeWeb(undefined, opts);
  const clock = { t: T0 };
  const s = k.ResearchSession.start({ topic: 'Lantern Hall test', budgets, search: w.search, fetch: w.fetch, clock: () => clock.t });
  return { k, w, s, clock };
}

test('registrable domain and publisher key collapse subdomains and country mirrors', async () => {
  const { registrableDomain, publisherKey } = await kit();
  assert.equal(registrableDomain('https://www.velmora-guide.example/x'), 'velmora-guide.example');
  assert.equal(registrableDomain('https://shop.lanternhall.co.uk/'), 'lanternhall.co.uk');
  assert.equal(registrableDomain('https://someone.github.io/post'), 'someone.github.io');
  assert.equal(publisherKey('https://tripplanner.example/a'), publisherKey('https://tripplanner.invalid/b'));
  assert.equal(publisherKey('https://tripplanner.co.uk/a'), 'tripplanner');
  assert.notEqual(publisherKey('https://alice.github.io/'), publisherKey('https://bob.github.io/'));
  assert.equal(registrableDomain('javascript:alert(1)'), null);
});

const OFFICIAL = 'https://lanternhall.example/visit';
const GUIDE = 'https://www.velmora-guide.example/lantern-hall';
const COPY = 'https://travelnotes-mirror.example/lantern-hall';
const TP_A = 'https://tripplanner.example/velmora/lantern-hall';
const TP_B = 'https://tripplanner.invalid/lantern-hall';
const OLD = 'https://old-blog.example/2022/velmora';
const NEWS = 'https://citynews.example/lantern-hall-tuesdays';
const Q1 = 'lantern hall velmora opening hours';
const Q2 = 'lantern hall velmora how long to visit';

// ---------------------------------------------------------------- budgets

test('budgets: defaults, caps and bad values (exit code 2)', async () => {
  const { normalizeBudgets, DEFAULT_BUDGETS, MAX_BUDGETS } = await kit();
  assert.deepEqual(normalizeBudgets({}), { searches: 20, fetches: 40, wall_time_s: 1800 });
  assert.deepEqual(normalizeBudgets({}), { ...DEFAULT_BUDGETS });
  assert.equal(normalizeBudgets({ searches: '5' }).searches, 5);
  assert.equal(normalizeBudgets({ fetches: MAX_BUDGETS.fetches }).fetches, 200);
  for (const bad of [{ searches: 0 }, { fetches: 201 }, { wall_time_s: 10801 }, { searches: 2.5 }, { fetches: 'lots' }]) {
    assert.throws(() => normalizeBudgets(bad), (e) => e.exitCode === 2 && /budget/.test(e.message));
  }
});

test('session: an over-budget fetch is refused BEFORE the injected fetch runs, and is logged but not citable', async () => {
  const { k, w, s } = await session({ fetches: 1 });
  const ok = await s.fetch(OFFICIAL, { official: true });
  assert.equal(ok.status, 'ok');
  assert.equal(s.remaining().fetches, 0);
  await assert.rejects(s.fetch(GUIDE), (e) => e instanceof k.BudgetExhaustedError && e.code === 'fetches' && e.exitCode === 3);
  assert.deepEqual(w.calls.fetch, [OFFICIAL], 'the refused URL was never fetched');
  const refused = s.state.ledger.find((e) => e.status === 'refused');
  assert.ok(refused && refused.kind === 'fetch' && refused.excerpt === '' && refused.url === GUIDE);
  assert.equal(s.state.counters.fetches, 1);
  assert.equal(s.state.counters.refused, 1);
  assert.throws(() => s.claim({ id: 'hours', kind: 'hours', text: 'Open 10-18', supports: [refused.id] }), /cannot be cited/);
});

test('session: the search budget and wall time are enforced; a finished run refuses everything', async () => {
  const { k, w, s, clock } = await session({ searches: 1, wall_time_s: 60 });
  await s.search(Q1);
  await assert.rejects(s.search(Q2), (e) => e.code === 'searches');
  assert.deepEqual(w.calls.search, [Q1]);

  const b = await session({ wall_time_s: 60 });
  b.clock.t = T0 + 61000;
  await assert.rejects(b.s.search(Q1), (e) => e instanceof k.BudgetExhaustedError && e.code === 'wall_time');
  await assert.rejects(b.s.fetch(OFFICIAL), (e) => e.code === 'wall_time');
  assert.equal(b.w.calls.search.length + b.w.calls.fetch.length, 0);

  clock.t = T0 + 10000;
  const sum = s.finish();
  assert.equal(sum.status, 'finished');
  await assert.rejects(s.fetch(OFFICIAL), (e) => e.code === 'run_finished');
  assert.throws(() => s.recordApi({ provider: 'maps.example', excerpt: 'x' }), (e) => e.code === 'run_finished');
});

test('session: failed fetches and failed searches count against the budget and are never citable', async () => {
  const { s } = await session();
  const e404 = await s.fetch('https://nowhere.example/page');
  assert.equal(e404.status, 'error');
  assert.equal(e404.http_status, 404);
  assert.equal(s.state.counters.fetches, 1);
  const thrower = (await kit()).ResearchSession.start({ topic: 't', search: async () => { throw new Error('boom'); }, clock: () => T0 });
  const se = await thrower.search('anything');
  assert.equal(se.status, 'error');
  assert.equal(thrower.state.counters.searches, 1);
  assert.throws(() => s.claim({ id: 'x', kind: 'other', text: 'x', supports: [e404.id] }), /status error/);
});

test('search results: invalid URLs are dropped, each result is cited as L00n.k, a bare search ref is refused', async () => {
  const { s } = await session();
  const e = await s.search(Q1);
  assert.equal(e.results.length, 3, 'the javascript: result is dropped');
  assert.match(e.note, /1/);
  assert.equal(e.results[2].injection_suspect, true, 'the reviews-hub snippet is flagged');
  assert.equal(e.injection_suspect, true, 'a search with a flagged result is flagged');
  assert.throws(() => s.claim({ id: 'h', kind: 'hours', text: 'x', supports: [e.id] }), /cite one of its results/);
  assert.throws(() => s.claim({ id: 'h', kind: 'hours', text: 'x', supports: [`${e.id}.9`] }), /no result 9/);
});

// ---------------------------------------------------------------- two-source rule and labels

// Fetch every fixture page once; returns { s, id: url -> ledger id, search: {q1, q2} }.
async function fullRun(opts) {
  const ctx = await session({}, opts);
  const { s } = ctx;
  const id = {};
  const q1 = await s.search(Q1);
  const q2 = await s.search(Q2);
  id[OFFICIAL] = (await s.fetch(OFFICIAL, { official: true, query: Q1 })).id;
  for (const u of [GUIDE, COPY, TP_A, TP_B, OLD, NEWS, 'https://reviews-hub.example/lantern-hall']) id[u] = (await s.fetch(u)).id;
  return { ...ctx, id, q1: q1.id, q2: q2.id };
}

const label = (s, claimId) => s.check().claims.find((c) => c.id === claimId);

test('confirmed: two independent publishers with at least one fetched page', async () => {
  const { s, id } = await fullRun();
  s.claim({ id: 'lh.hours', kind: 'hours', place: 'Lantern Hall', text: 'Open 10:00-18:00', supports: [id[OFFICIAL], id[GUIDE]] });
  const l = label(s, 'lh.hours');
  assert.equal(l.label, 'confirmed');
  assert.equal(l.plan_critical, true);
  assert.equal(l.plan_ready, true);
  assert.equal(l.independent_sources, 2);
});

test('not independent: a syndicated copy (same text) and a brand mirror on another TLD are one source', async () => {
  const { k, s, id } = await fullRun();
  const guide = s.state.ledger.find((e) => e.id === id[GUIDE]);
  const copy = s.state.ledger.find((e) => e.id === id[COPY]);
  assert.ok(k.textSimilarity(guide.excerpt, copy.excerpt) >= k.SIMILARITY_THRESHOLD);
  s.claim({ id: 'copy', kind: 'hours', text: 'Open 10-18', supports: [id[GUIDE], id[COPY]] });
  s.claim({ id: 'brand', kind: 'price', text: 'Adults 14 crowns', supports: [id[TP_A], id[TP_B]] });
  for (const c of ['copy', 'brand']) {
    const l = label(s, c);
    assert.equal(l.independent_sources, 1, c);
    assert.equal(l.label, 'single-source', c);
    assert.equal(l.plan_ready, false, `${c} is plan-critical and needs two independent sources`);
  }
});

test('derived_from and canonical URLs merge publishers', async () => {
  const { s } = await session();
  const a = await s.fetch(GUIDE);
  const b = await s.fetch(COPY, { derived_from: a.id });
  s.claim({ id: 'd', kind: 'hours', text: 'x', supports: [a.id, b.id] });
  assert.equal(label(s, 'd').independent_sources, 1);
  const { record } = await kit();
  const r = record(s.state, 'fetch', { url: 'https://reprints.example/lh', text: 'Open daily from ten to six, closed Monday.', canonical: GUIDE }, T0);
  s.claim({ id: 'c', kind: 'hours', text: 'x', supports: [a.id, r.entry.id] });
  assert.equal(label(s, 'c').independent_sources, 1);
});

test('likely: snippet-only independent sources, or one official source; neither makes a critical claim plan-ready', async () => {
  const { s, id, q2 } = await fullRun();
  s.claim({ id: 'snips', kind: 'visit_duration', text: '1.5-2.5 h', supports: [`${q2}.1`, `${q2}.3`] });
  s.claim({ id: 'snip-mirror', kind: 'visit_duration', text: '1.5-2.5 h', supports: [`${q2}.1`, `${q2}.2`] });
  s.claim({ id: 'official-only', kind: 'tickets', text: 'Timed entry', supports: [id[OFFICIAL]] });
  assert.equal(label(s, 'snips').label, 'likely');
  assert.equal(label(s, 'snip-mirror').label, 'single-source');
  assert.equal(label(s, 'official-only').label, 'likely');
  for (const c of ['snips', 'snip-mirror', 'official-only']) assert.equal(label(s, c).plan_ready, false, c);
  const report = s.check();
  assert.equal(report.ready, false);
  assert.deepEqual(report.not_ready.sort(), ['official-only', 'snip-mirror', 'snips']);
});

test('conflicting: any usable contradicting source wins over support', async () => {
  const { s, id } = await fullRun();
  s.claim({ id: 'closed', kind: 'closed_days', text: 'Closed Mondays', supports: [id[OFFICIAL], id[GUIDE]], contradicts: [id[NEWS]] });
  const l = label(s, 'closed');
  assert.equal(l.label, 'conflicting');
  assert.deepEqual(l.contradicted_by, [id[NEWS]]);
  assert.equal(l.plan_ready, false);
  assert.throws(() => s.claim({ id: 'closed', supports: [id[NEWS]] }), /both support and contradict/);
});

test('stale: an old page date, or a fetch older than the kind allows', async () => {
  const { s, id, clock } = await fullRun();
  s.claim({ id: 'winter', kind: 'hours', text: 'Open 11-16 in winter', supports: [id[OLD]] });
  assert.equal(label(s, 'winter').label, 'stale');
  s.claim({ id: 'fresh', kind: 'hours', text: 'Open 10-18', supports: [id[OFFICIAL], id[GUIDE], id[OLD]] });
  const l = label(s, 'fresh');
  assert.equal(l.label, 'confirmed');
  assert.ok(l.ignored.some((x) => x.ref === id[OLD] && x.why === 'stale'));
  s.claim({ id: 'dur', kind: 'visit_duration', text: '90-120 min', supports: [id[OFFICIAL], id[GUIDE]] });
  clock.t = T0 + 31 * 86400000; // hours sources go stale after 30 days of fetch age; durations after 365
  assert.equal(label(s, 'fresh').label, 'stale');
  assert.equal(label(s, 'dur').label, 'confirmed');
});

test('unverified: only flagged or unusable sources; non-critical single-source claims are plan-ready', async () => {
  const { s, id, q1 } = await fullRun();
  s.claim({ id: 'always-open', kind: 'hours', text: 'Open 24 hours', supports: [id['https://reviews-hub.example/lantern-hall'], `${q1}.3`] });
  const l = label(s, 'always-open');
  assert.equal(l.label, 'unverified');
  assert.equal(l.ignored.filter((x) => x.why === 'injection_suspect').length, 2);
  s.claim({ id: 'walk', kind: 'other', text: 'Evening lighting walk', supports: [id[GUIDE]] });
  assert.equal(label(s, 'walk').plan_critical, false);
  assert.equal(label(s, 'walk').plan_ready, true);
  s.claim({ id: 'walk', critical: true });
  assert.equal(label(s, 'walk').plan_critical, true);
  assert.equal(label(s, 'walk').plan_ready, false);
  s.claim({ id: 'walk', supports: [id[OFFICIAL]] });
  assert.equal(label(s, 'walk').plan_critical, true, 'critical once, critical always');
});

test('a claim update with one bad ref changes nothing', async () => {
  const { s, id } = await fullRun();
  s.claim({ id: 'h', kind: 'hours', text: 'Open 10-18', supports: [id[OFFICIAL]] });
  const before = JSON.stringify(s.state);
  assert.throws(() => s.claim({ id: 'h', supports: [id[GUIDE], 'L999'] }), /no ledger entry L999/);
  assert.throws(() => s.claim({ id: 'n', kind: 'hours', text: 'x', supports: [id[GUIDE], 'nope'] }), /bad source ref/);
  assert.throws(() => s.claim({ id: 'Bad Id', kind: 'hours', text: 'x' }), /claim id/);
  assert.throws(() => s.claim({ id: 'k', kind: 'weather', text: 'x' }), /claim kind/);
  assert.equal(JSON.stringify(s.state), before);
});

// ---------------------------------------------------------------- run file and schema

test('run file: valid against the JSON Schema, round-trips through save/load, tampering is detected', async () => {
  const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
  const { k, s, id } = await fullRun();
  s.claim({ id: 'h', kind: 'hours', text: 'Open 10-18', supports: [id[OFFICIAL], id[GUIDE]] });
  assert.deepEqual(k.validateRun(s.state), []);
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '../kits/research/schemas/research-run.schema.json'), 'utf8'));
  assert.equal(schema.$id === undefined || typeof schema.$id === 'string', true);
  assert.deepEqual(Object.keys(schema.$defs.ledgerEntry.properties).sort(), Object.keys(s.state.ledger[0]).sort());

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'research-kit-'));
  try {
    const file = path.join(dir, 'run.json');
    k.saveRun(file, s.state);
    assert.deepEqual(k.loadRun(file), s.state);
    const bad = JSON.parse(fs.readFileSync(file, 'utf8'));
    bad.ledger[2].injection_suspect = 'no';
    bad.budgets.searches = 999;
    bad.ledger[2].extra = 'x';
    fs.writeFileSync(file, JSON.stringify(bad));
    assert.throws(() => k.loadRun(file), (e) => e.exitCode === 1 && /schema/.test(e.message));
    fs.writeFileSync(file, '{not json');
    assert.throws(() => k.loadRun(file), (e) => e.exitCode === 1);
    assert.throws(() => k.loadRun(path.join(dir, 'missing.json')), (e) => e.exitCode === 2);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('summary lists refused, error and flagged entries', async () => {
  const { s } = await session({ fetches: 2 });
  await s.search(Q1);
  await s.fetch('https://reviews-hub.example/lantern-hall');
  await s.fetch('https://nowhere.example/x');
  await assert.rejects(s.fetch(OFFICIAL));
  const sum = s.finish();
  assert.equal(sum.refused.length, 1);
  assert.equal(sum.errors.length, 1);
  assert.deepEqual(sum.injection_flagged.map((f) => f.id), ['L001', 'L002']);
  assert.ok(sum.injection_flagged[1].rules.includes('ignore-instructions'));
  assert.equal(sum.status, 'finished');
});

// ---------------------------------------------------------------- visit durations

test('parseMinutes accepts "90", "60-120" and "60–120" only', async () => {
  const { parseMinutes } = await kit();
  assert.deepEqual(parseMinutes('90'), { min: 90, max: 90 });
  assert.deepEqual(parseMinutes('60-120'), { min: 60, max: 120 });
  assert.deepEqual(parseMinutes('120 – 60'), { min: 60, max: 120 });
  for (const bad of ['', 'two hours', '1.5h', '-5', '12345']) assert.equal(parseMinutes(bad), null, bad);
});

test('durationRange: confirmed, single-source, conflicting, outliers, flagged and invalid mentions', async () => {
  const { durationRange } = await kit();
  const ok = durationRange([{ min: 90, max: 120, source_key: 'a' }, { min: 90, max: 150, source_key: 'b' }]);
  assert.deepEqual(ok.range, { min: 90, max: 135 });
  assert.equal(ok.typical, 115);
  assert.equal(ok.label, 'confirmed');
  assert.equal(ok.independent_sources, 2);

  assert.equal(durationRange([{ min: 90, max: 120, source_key: 'a' }, { min: 100, max: 120, source_key: 'a' }]).label, 'single-source');
  assert.equal(durationRange([{ min: 30, max: 30, source_key: 'a' }, { min: 180, max: 180, source_key: 'b' }]).label, 'conflicting');

  const out = durationRange([
    { ref: 'L1', min: 90, max: 120, source_key: 'a' }, { ref: 'L2', min: 100, max: 120, source_key: 'b' },
    { ref: 'L3', min: 600, max: 600, source_key: 'c' }, { ref: 'L4', min: 1, max: 1, source_key: 'd', injection_suspect: true },
    { ref: 'L5', min: 0, max: 30, source_key: 'e' }, { ref: 'L6', min: 60, max: 90 }
  ]);
  assert.deepEqual(out.used, ['L1', 'L2']);
  assert.deepEqual(out.dropped.map((d) => `${d.ref}:${d.why}`).sort(),
    ['L3:outlier', 'L4:injection_suspect', 'L5:invalid minutes', 'L6:no source']);
  assert.equal(out.label, 'confirmed');

  const none = durationRange([]);
  assert.equal(none.label, 'unverified');
  assert.equal(none.range, null);
});

test('session.duration resolves refs: publishers from the ledger, flagged sources dropped', async () => {
  const { s, id, q1 } = await fullRun();
  const d = s.duration([`90-120@${id[OFFICIAL]}`, `90-120@${id[GUIDE]}`, `90-150@${id[TP_A]}`, `90-150@${id[TP_B]}`, `1440@${q1}.3`]);
  assert.equal(d.label, 'confirmed');
  assert.equal(d.independent_sources, 3, 'the two tripplanner domains are one publisher');
  assert.ok(d.dropped.some((x) => x.ref === `${q1}.3` && x.why === 'injection_suspect'));
  assert.throws(() => s.duration(['two hours@L002']), /60-120@L004/);
});

// Developed by: LightAISolutions
