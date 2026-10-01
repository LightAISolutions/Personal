'use strict';
// packs/tour-guide — payload schemas of the pack's six envelope types (helper.json envelope_types): valid examples
// round-trip, the obvious invalid ones are refused with pointer paths, the prefs kit's real review output validates,
// tools/envelope.mjs --pack tour-guide checks a payload against its schema, and the core mocks accept the six types.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const H = require('./harness/gas-mocks');
const S = () => import('../packs/tour-guide/schemas/index.mjs');
const clone = (x) => JSON.parse(JSON.stringify(x));
const TOOL = path.join(H.HELPERS_ROOT, 'tools', 'envelope.mjs');
const TYPES = ['prefs_review', 'shortlist', 'trip_facts', 'plan_digest', 'profile_summary', 'places_digest'];
const made = [];
after(() => { for (const d of made) fs.rmSync(d, { recursive: true, force: true }); });
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tg-payload-')); made.push(d); return d; };
const MAPS = 'https://www.google.com/maps/search/?api=1&query=Lantern%20Museum&query_place_id=FixtureTcLanternMuseum';

const item = (n, slug, over = {}) => ({ n, slug, name: slug.replace(/-/g, ' '), why_you: 'You rated small museums highly; this one is quiet in the morning.', fit: 0.82,
  est_minutes: 90, area: 'Old harbour', maps_url: MAPS, labels: ['verified'], ...over });
const EXAMPLES = {
  shortlist: () => ({ v: 1, kind: 'shortlist', trip: 'port-sorrel-spring-2027', run_id: 'r-2027-05-01-a', round: 1, more: true, decided: [],
    groups: [
      { id: 'activities', gems_wanted: 2, gems_shown: 1, items: [
        item(1, 'lantern-museum', { place_id: 'FixtureTcLanternMuseum', new: true, dims: [{ dimension: 'interests', value: 'museums' }] }),
        item(2, 'signal-hill-lookout', { labels: ['single source'], gem: true, gem_line: '4.7 from 180 ratings where peers average 1,900; named by two local-language guides.',
          seen_before: { trip: 'port-sorrel-autumn-2026', on: '2026-10-04', outcome: 'skipped' }, changes: ['New evening opening on Fridays, per its own site.'] })] },
      { id: 'food', items: [item(3, 'saffron-row-market', { why_you: '', fit: 0.5, labels: ['conflicting', 'unverified'] })] }
    ] }),
  trip_facts: () => ({ v: 1, kind: 'trip_facts', trip: 'port-sorrel-spring-2027',
    found: [{ n: 1, kind: 'dates', text: 'Trip runs Wed 12 to Fri 14 May', start: '2027-05-12', end: '2027-05-14' },
      { n: 2, kind: 'lodging', text: 'Harbour Lane Guesthouse, three nights', start: '2027-05-12', end: '2027-05-15' },
      { n: 3, kind: 'booking', text: 'Clock tower climb, Thu 11:00', start: '2027-05-13', end: null },
      { n: 4, kind: 'companions', text: 'Travelling with one friend' }],
    missing: ['flight'] }),
  plan_digest: () => ({ v: 1, kind: 'plan_digest', trip: 'port-sorrel-spring-2027', build_id: 'build-2027-04-30', verified_on: '2027-04-30',
    days: [{ date: '2027-05-12', theme: 'Harbour and lanterns',
      stops: [{ n: 1, slug: 'lantern-museum', name: 'Lantern Museum', arrive: '10:00', depart: '11:30', minutes: 90, maps_url: MAPS, note_line: 'Start upstairs; the lantern hall is quietest before noon.' }],
      legs: [{ from: 'lodging', to: 'lantern-museum', mode: 'TRANSIT', minutes: 12, maps_url: 'https://www.google.com/maps/dir/?api=1&travelmode=transit' },
        { from: 'lantern-museum', to: 'lodging', mode: 'WALK', minutes: 9 }],
      warnings: ['Lunch window is tight on this day.'] }],
    later: [{ slug: 'moonlight-night-market', name: 'Moonlight Night Market', reason: 'opens only after your planning day ends' }],
    drive: { plan: 'fixtureDrivePlanFile01', brochure_html: 'fixtureDriveBrochure01', brochure_pdf: null } }),
  profile_summary: () => ({ v: 1, kind: 'profile_summary', text: 'Relaxed pace; small museums and viewpoints first; street food over formal dining.', dimensions_count: 9, updated: '2027-04-28T08:15:00Z' }),
  places_digest: () => ({ v: 1, kind: 'places_digest', destination: 'port-sorrel',
    places: [{ slug: 'lantern-museum', name: 'Lantern Museum', area: 'Old harbour', category: 'museum', tags: ['indoor', 'history'], status: 'scheduled',
      last_trip: 'port-sorrel-spring-2027', last_researched: '2027-05-01', last_verified: null, note_line: 'Quiet before noon; the lantern hall is the highlight.',
      maps_url: MAPS, history_summary: 'shortlisted, chosen and visited in spring 2027 (rated up)' },
    { slug: 'signal-hill-lookout', name: 'Signal Hill Lookout', area: '', category: 'viewpoint', tags: [], status: 'saved-for-later',
      last_trip: null, last_researched: null, last_verified: null, note_line: '', maps_url: MAPS, history_summary: '' }] })
};

async function realReview() {
  const m = await import('../kits/prefs/index.mjs');
  const dir = tmp();
  const evidence = JSON.parse(fs.readFileSync(path.join(H.HELPERS_ROOT, 'kits', 'prefs', 'fixtures', 'evidence-sample.json'), 'utf8'));
  m.ingest({ vocab: 'travel', held: path.join(dir, 'held'), evidence });
  return { normal: m.review({ vocab: 'travel', held: path.join(dir, 'held'), ledger: path.join(dir, 'ledger.json') }),
    suspect: m.review({ vocab: 'travel', held: path.join(dir, 'held'), ledger: path.join(dir, 'ledger.json'), max: 20, includeSuspect: true }) };
}

test('PAYLOAD_KINDS maps exactly the manifest envelope_types; each kind has a strict schema', async () => {
  const s = await S();
  const manifest = JSON.parse(fs.readFileSync(path.join(H.HELPERS_ROOT, 'packs', 'tour-guide', 'helper.json'), 'utf8'));
  assert.deepEqual(manifest.envelope_types, TYPES);
  assert.deepEqual(manifest.action_allowlist, []);
  assert.deepEqual(Object.keys(s.PAYLOAD_KINDS).sort(), [...TYPES].sort());
  for (const kind of Object.values(s.PAYLOAD_KINDS)) assert.equal(s.loadSchema(kind).additionalProperties, false, kind);
  assert.deepEqual(s.validatePayload('notice', { text: 'x' }).kind, null);
  assert.match(s.validatePayload('notice', { text: 'x' }).errors[0].message, /no payload schema for envelope type "notice"/);
});

test('valid examples of the five brain payloads round-trip through JSON and validatePayload', async () => {
  const s = await S();
  for (const [type, make] of Object.entries(EXAMPLES)) {
    const r = s.validatePayload(type, JSON.parse(JSON.stringify(make())));
    assert.deepEqual(r.errors, [], type);
    assert.equal(r.ok, true);
    assert.equal(r.kind, s.PAYLOAD_KINDS[type]);
  }
  const bare = EXAMPLES.shortlist(); delete bare.v; delete bare.kind; delete bare.decided;
  assert.ok(s.validatePayload('shortlist', bare).ok, 'v, kind and decided are optional');
  const gemless = EXAMPLES.shortlist(); gemless.groups[0].items = gemless.groups[0].items.map(({ gem, gem_line, seen_before, changes, dims, place_id, ...rest }) => rest);
  assert.ok(s.validatePayload('shortlist', gemless).ok, 'Phase 4 items (no gem, history or dims fields) still validate');
  const count = EXAMPLES.shortlist(); count.more = 3;
  assert.ok(s.validatePayload('shortlist', count).ok, 'more may be a count');
});

test('invalid payloads are refused with pointer paths', async () => {
  const s = await S();
  const refuse = (type, mutate, pathPrefix, re) => {
    const x = EXAMPLES[type]();
    mutate(x);
    const r = s.validatePayload(type, x);
    assert.equal(r.ok, false, `${type}: ${pathPrefix}`);
    assert.ok(r.errors.some((e) => e.path.startsWith(pathPrefix) && (!re || re.test(e.message))), `${type} ${pathPrefix}: ${JSON.stringify(r.errors)}`);
  };
  refuse('shortlist', (x) => { x.kind = 'short_list'; }, '/kind');
  refuse('shortlist', (x) => { delete x.run_id; }, '/', /missing required "run_id"/);
  refuse('shortlist', (x) => { x.groups[0].id = 'sights'; }, '/groups/0/id');
  refuse('shortlist', (x) => { x.groups[0].items[0].why_you = 'w'.repeat(161); }, '/groups/0/items/0/why_you', /longer than 160/);
  refuse('shortlist', (x) => { x.groups[0].items[0].fit = 1.2; }, '/groups/0/items/0/fit');
  refuse('shortlist', (x) => { x.groups[0].items[0].labels = ['💎']; }, '/groups/0/items/0/labels/0');
  refuse('shortlist', (x) => { x.groups[0].items[0].n = 0; }, '/groups/0/items/0/n');
  refuse('shortlist', (x) => { x.groups[0].items[1].gem_line = 'g'.repeat(201); }, '/groups/0/items/1/gem_line');
  refuse('shortlist', (x) => { x.groups[0].gems_shown = 9; }, '/groups/0/gems_shown');
  refuse('shortlist', (x) => { x.groups[0].items[1].seen_before.outcome = 'loved'; }, '/groups/0/items/1/seen_before/outcome');
  refuse('shortlist', (x) => { x.groups[0].items[1].changes = ['c'.repeat(121)]; }, '/groups/0/items/1/changes/0');
  refuse('shortlist', (x) => { x.groups[0].items[0].dims = [{ dimension: 'Interests', value: 'museums' }]; }, '/groups/0/items/0/dims/0/dimension');
  refuse('shortlist', (x) => { x.groups[0].items[0].rating = 4.6; }, '/groups/0/items/0/rating', /unknown field/);
  refuse('shortlist', (x) => { x.groups[1].items[0].slug = 'lantern-museum'; }, '/groups/1/items/0/slug', /already listed/);
  refuse('shortlist', (x) => { x.groups[0].items[1].n = 1; }, '/groups/0/items/1/n', /duplicate number/);
  refuse('shortlist', (x) => { x.groups.push(clone(x.groups[1])); }, '/groups', /more than 2/);
  refuse('trip_facts', (x) => { x.found[0].kind = 'tour'; }, '/found/0/kind');
  refuse('trip_facts', (x) => { x.found[1].kind = 'companion'; }, '/found/1/kind');
  refuse('trip_facts', (x) => { x.found[0].text = 't'.repeat(201); }, '/found/0/text', /longer than 200/);
  refuse('trip_facts', (x) => { x.found[0].end = '2027-05-10'; }, '/found/0/end', /before start/);
  refuse('trip_facts', (x) => { x.found[0].start = '2027-02-30'; }, '/found/0/start', /calendar/);
  refuse('trip_facts', (x) => { x.missing = ['flight', 'flight']; }, '/missing', /duplicate/);
  refuse('trip_facts', (x) => { x.missing = ['weather']; }, '/missing/0');
  refuse('trip_facts', (x) => { delete x.missing; }, '/', /missing required "missing"/);
  refuse('plan_digest', (x) => { x.days[0].stops[0].note_line = 'n'.repeat(161); }, '/days/0/stops/0/note_line');
  refuse('plan_digest', (x) => { x.days[0].theme = 't'.repeat(81); }, '/days/0/theme');
  refuse('plan_digest', (x) => { x.days[0].legs[0].mode = 'TAXI'; }, '/days/0/legs/0/mode');
  refuse('plan_digest', (x) => { x.days[0].warnings = ['w'.repeat(201)]; }, '/days/0/warnings/0');
  refuse('plan_digest', (x) => { x.later[0].reason = 'r'.repeat(301); }, '/later/0/reason');
  refuse('plan_digest', (x) => { x.drive.plan = 'short'; }, '/drive/plan');
  refuse('plan_digest', (x) => { delete x.drive.brochure_pdf; }, '/drive', /brochure_pdf/);
  refuse('plan_digest', (x) => { x.days.push(clone(x.days[0])); }, '/days/1/date', /date order/);
  refuse('plan_digest', (x) => { x.days[0].stops.push({ ...x.days[0].stops[0], slug: 'other-stop' }); }, '/days/0/stops/1/n', /duplicate/);
  refuse('plan_digest', (x) => {
    x.days = Array.from({ length: 20 }, (_, i) => ({ ...clone(x.days[0]), date: `2027-05-${String(i + 1).padStart(2, '0')}`,
      stops: Array.from({ length: 20 }, (__, j) => ({ ...x.days[0].stops[0], n: j + 1, note_line: 'n'.repeat(160) })) }));
  }, '/', /at most 60000/);
  refuse('profile_summary', (x) => { x.text = 't'.repeat(1201); }, '/text');
  refuse('profile_summary', (x) => { x.updated = '2027-04-28'; }, '/updated');
  refuse('profile_summary', (x) => { x.updated = '2027-02-30T08:00:00Z'; }, '/updated', /real date-time/);
  refuse('profile_summary', (x) => { x.dimensions_count = -1; }, '/dimensions_count');
  refuse('places_digest', (x) => { x.places[0].hours = ['Mon: 09:00–17:00']; }, '/places/0/hours', /unknown field/);
  refuse('places_digest', (x) => { x.places[0].rating = 4.6; }, '/places/0/rating', /unknown field/);
  for (const field of ['address', 'website', 'business_status', 'user_rating_count']) refuse('places_digest', (x) => { x.places[0][field] = 'x'; }, `/places/0/${field}`, /unknown field/);
  refuse('places_digest', (x) => { x.places[0].history_summary = 'h'.repeat(121); }, '/places/0/history_summary');
  refuse('places_digest', (x) => { x.places[0].note_line = 'n'.repeat(161); }, '/places/0/note_line');
  refuse('places_digest', (x) => { x.places[1].slug = 'lantern-museum'; }, '/places/1/slug', /duplicate/);
  refuse('places_digest', (x) => { x.places[0].status = 'visited'; }, '/places/0/status');
  refuse('places_digest', (x) => { x.places = Array.from({ length: 300 }, (_, i) => ({ ...x.places[0], slug: `p-${i}`, note_line: 'n'.repeat(160) })); }, '/', /at most 60000/);
});

test('prefs_review: the kit\'s real buildReview output validates (normal and with suspects); tampering is refused', async () => {
  const s = await S();
  const { normal, suspect } = await realReview();
  assert.ok(normal.items.length > 0 && suspect.held_back.length + suspect.items.length >= normal.items.length);
  assert.deepEqual(s.validatePayload('prefs_review', normal).errors, []);
  assert.deepEqual(s.validatePayload('prefs_review', clone(suspect)).errors, []);
  const bad = (mutate, pathPrefix) => { const x = clone(normal); mutate(x); assert.ok(s.validatePayload('prefs_review', x).errors.some((e) => e.path.startsWith(pathPrefix)), pathPrefix); };
  bad((x) => { x.kind = 'prefs_decisions'; }, '/kind');
  bad((x) => { x.items[0].stance = '?'; }, '/items/0/stance');
  bad((x) => { x.items[0].text = 't'.repeat(1201); }, '/items/0/text');
  bad((x) => { x.items[0].buttons[0][0].data = 'pf:c_0000000000:y'; }, '/items/0/buttons/0/0/data');
  bad((x) => { x.items[0].buttons[0][0].data = 'xx:' + x.items[0].cid + ':y'; }, '/items/0/buttons/0/0/data');
  bad((x) => { x.items.push(clone(x.items[0])); }, `/items/${normal.items.length}/cid`);
  bad((x) => { x.items[0].excerpt = 'raw'; }, '/items/0/excerpt');
  bad((x) => { delete x.batch_id; }, '/');
  bad((x) => { x.more = -1; }, '/more');
});

test('tools/envelope.mjs --pack tour-guide validates a pack payload against its schema; other packs are unchanged', async () => {
  const E = await import('../tools/envelope.mjs');
  assert.deepEqual(await E.packPayloadErrors('tour-guide', 'shortlist', EXAMPLES.shortlist()), []);
  const bad = EXAMPLES.shortlist(); bad.groups[0].items[0].fit = 2;
  assert.deepEqual(await E.packPayloadErrors('tour-guide', 'shortlist', bad), ['payload/groups/0/items/0/fit: above maximum 1']);
  assert.deepEqual(await E.packPayloadErrors('tour-guide', 'notice', { text: 'x' }), [], 'core types are not pack payloads');
  assert.deepEqual(await E.packPayloadErrors('hello', 'greeting', { anything: 1 }), [], 'a pack without schemas/ is only type-checked');
  assert.deepEqual(await E.packPayloadErrors(undefined, 'shortlist', bad), []);
  const dir = tmp();
  const write = (name, obj) => { const f = path.join(dir, name); fs.writeFileSync(f, JSON.stringify(obj)); return f; };
  const run = (...args) => spawnSync(process.execPath, [TOOL, ...args], { encoding: 'utf8' });
  const ok = run('shortlist', 'trip-research', write('ok.json', EXAMPLES.shortlist()), '--pack', 'tour-guide', '--out', dir);
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  const r = JSON.parse(ok.stdout);
  assert.deepEqual(r.errors, []);
  assert.match(r.file_name, /^\d{8}T\d{6}_shortlist_[0-9a-f-]{36}\.json$/);
  assert.ok(fs.existsSync(path.join(dir, r.file_name)));
  const no = run('shortlist', 'trip-research', write('bad.json', bad), '--pack', 'tour-guide', '--out', dir);
  assert.equal(no.status, 1);
  assert.match(JSON.parse(no.stdout).errors.join('\n'), /payload\/groups\/0\/items\/0\/fit: above maximum 1/);
  assert.equal(fs.readdirSync(dir).filter((f) => f.includes('_shortlist_')).length, 1, 'nothing written for the invalid payload');
  for (const type of TYPES.filter((t) => t !== 'prefs_review')) {
    const each = run(type, 'tg-skill', write(`${type}.json`, EXAMPLES[type]()), '--pack', 'tour-guide');
    assert.equal(each.status, 0, `${type}: ${each.stdout}`);
  }
  const noPack = run('shortlist', 'trip-research', write('np.json', EXAMPLES.shortlist()));
  assert.equal(noPack.status, 1);
  assert.match(JSON.parse(noPack.stdout).errors.join(), /unknown type: shortlist/);
});

test('core mocks: the manifest\'s six types are accepted by registerEnvelopeHandler and validateEnvelope', async () => {
  const E = await import('../tools/envelope.mjs');
  const { ctx } = H.loadGas({ pack: 'tour-guide' });
  for (const t of TYPES) assert.ok(ctx.ENVELOPE_TYPES.includes(t), t);
  assert.deepEqual(E.typesFor('tour-guide'), [...ctx.ENVELOPE_TYPES]);
  const { normal } = await realReview();
  const payloads = { ...Object.fromEntries(Object.entries(EXAMPLES).map(([k, f]) => [k, f()])), prefs_review: normal };
  // Real clock on both sides: every test file shares one process (tests/index.js), and the harness's envelope()
  // reads the most recent loadGas() clock, so a pinned future clock here would leak into later files.
  const now = new Date();
  for (const t of TYPES) {
    ctx.registerEnvelopeHandler(t, { validate: () => [], handle: () => 'ok' });
    const env = E.makeEnvelope({ type: t, producer: 'tg-skill', payload: payloads[t], now, types: E.typesFor('tour-guide') });
    assert.deepEqual(env.errors, [], t);
    const raw = JSON.stringify(env.envelope);
    assert.ok(ctx.validateEnvelope(raw, raw.length).ok, `${t}: core validateEnvelope`);
  }
  assert.throws(() => ctx.registerEnvelopeHandler('shortlist', () => 1), /duplicate "shortlist"/);
  assert.throws(() => ctx.registerEnvelopeHandler('places_summary', () => 1), /unknown envelope type/);
});

// Developed by: LightAISolutions
