'use strict';
// packs/tour-guide — payload schemas of the pack's ten envelope types (helper.json envelope_types): valid examples
// round-trip, the obvious invalid ones are refused with pointer paths, the prefs kit's real review output validates,
// tools/envelope.mjs --pack tour-guide checks a payload against its schema, and the core mocks accept the ten types.
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
const TYPES = ['prefs_review', 'shortlist', 'trip_facts', 'plan_digest', 'profile_summary', 'places_digest', 'bookings', 'scout', 'outline', 'day_versions'];
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
        item(2, 'signal-hill-lookout', { labels: ['single source'], gem: true, gem_line: 'exceptionally well rated by far fewer reviewers than its peers; named by two local-language guides.',
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
      last_trip: null, last_researched: null, last_verified: null, note_line: '', maps_url: MAPS, history_summary: '' }] }),
  bookings: () => ({ v: 1, kind: 'bookings', trip: 'port-sorrel-spring-2027', tz: 'Pacific/Auckland',
    bookings: [{ id: 'clock-tower-climb', title: 'Clock tower climb', kind: 'sight', rule: 'Two people; tickets open 14 days ahead at 10:00 on the tower site.', status: 'todo',
      place: 'clock-tower', for_date: '2027-05-13', opens_at: '2027-04-29T10:00:00+12:00', book_by: '2027-05-12T18:00:00+12:00', how: 'tower website',
      party_min: 2, url: 'https://tickets.example.org/clock-tower', note: 'Morning slots go first.', source: 'tower site', updated: '2027-04-20' },
    { id: 'harbour-lane-guesthouse', title: 'Harbour Lane Guesthouse', kind: 'lodging', rule: 'Three nights.', status: 'booked' }] }),
  scout: () => ({ v: 1, kind: 'scout', scout_id: 'sc-20270501-matcha', query: 'matcha', destination: 'port-sorrel', place_label: 'Port Sorrel',
    trip: 'port-sorrel-spring-2027', group: 'food', created_on: '2027-05-01', from: 'your guesthouse', diet: 'vegetarian',
    items: [{ n: 1, slug: 'tidewater-tea-room', name: 'Tidewater Tea Room', area: 'Old harbour', category: 'cafe', score: 81,
      parts: { topic: 90, quality: 74, fit: 60, reach: 88 }, why_you: 'Named for matcha; very well rated; about 9 min walk.', try: 'Matcha parfait (vegetarian)',
      labels: ['gem', 'veg_verified'], rated: 'very well rated', reach: { minutes: 9, mode: 'WALK', estimated: false }, maps_url: MAPS, place_id: 'FixtureTcTidewaterTea' }],
    left_out: [{ name: 'Harbour Burger Bar', reason: 'off_topic' }], more: 2, drive: { board_html: 'fixtureDriveScoutBoard01', board_pdf: null } }),
  outline: () => ({ v: 1, kind: 'outline', trip: 'port-sorrel-spring-2027', build_id: 'ol-port-sorrel-1', notes: 'Both keep the booked tower on day 2.',
    options: ['A', 'B'].map((key) => ({ key, title: key === 'A' ? 'Harbour first' : 'Hills first', gains: 'A calm last day.', gives_up: 'No day trip.',
      days: [{ date: '2027-05-12', area: 'Old harbour', kind: 'travel', note: 'Arrive by noon.' },
        { date: '2027-05-13', area: 'Clock hill', kind: 'full', anchors: [{ slug: 'clock-tower', name: 'Clock Tower' }] },
        { date: '2027-05-14', area: '', kind: 'free' }] })) }),
  day_versions: () => ({ v: 1, kind: 'day_versions', trip: 'port-sorrel-spring-2027', build_id: 'dv-port-sorrel-1', date: '2027-05-13', chosen: 'A',
    versions: ['A', 'B'].map((key) => ({ key, title: key === 'A' ? 'Museums and the tower' : 'Markets and the shore', summary: 'Two big sights, a long lunch.',
      stops: [{ slug: key === 'A' ? 'lantern-museum' : 'saffron-row-market', name: key === 'A' ? 'Lantern Museum' : 'Saffron Row Market', time: '10:00' },
        { slug: 'clock-tower', name: 'Clock Tower' }],
      walk_minutes: 35, transit_minutes: 20, spare_minutes: 50, bookings: ['Clock Tower 14:00'], leaves_out: [{ slug: 'tide-gallery', name: 'Tide Gallery' }],
      warnings: ['Steep lane to the tower.'] })) })
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

test('valid examples of the brain payloads round-trip through JSON and validatePayload', async () => {
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
  const c10 = EXAMPLES.plan_digest(); c10.tz = 'Pacific/Auckland'; c10.days[0].spare_minutes = 45;
  Object.assign(c10.days[0].stops[0], { time_style: 'about', check_on_day: 'Check the lantern hall is open; it closes for events.' });
  Object.assign(c10.days[0].legs[0], { estimated: true, distance_m: 2400, flags: ['footpath', 'uphill'], taxi_minutes: 7, buffer_minutes: 10 });
  assert.deepEqual(s.validatePayload('plan_digest', c10).errors, [], 'every C10 field is accepted');
  const bare2 = EXAMPLES.bookings(); delete bare2.v; delete bare2.kind; bare2.bookings = [];
  assert.ok(s.validatePayload('bookings', bare2).ok, 'an empty list clears the trip; v and kind are optional');
  const z = EXAMPLES.bookings(); z.bookings[0].opens_at = '2027-04-28T22:00Z'; z.bookings[0].book_by = '2027-05-12T06:00:00-00:00';
  assert.ok(s.validatePayload('bookings', z).ok, 'Z, minute precision and -00:00 are explicit offsets');
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
  refuse('bookings', (x) => { x.tz = 'Mars/Olympus'; }, '/tz');
  refuse('bookings', (x) => { delete x.tz; }, '/', /missing required "tz"/);
  refuse('bookings', (x) => { x.bookings[0].opens_at = '2027-04-29T10:00:00'; }, '/bookings/0/opens_at');
  refuse('bookings', (x) => { x.bookings[0].url = 'http://tickets.example.org/x'; }, '/bookings/0/url');
  refuse('bookings', (x) => { x.bookings[1].id = 'clock-tower-climb'; }, '/bookings/1/id', /duplicate booking id/);
  refuse('bookings', (x) => { x.bookings = Array.from({ length: 41 }, (_, i) => ({ id: `b-${i}`, title: 'T', kind: 'other', rule: 'r', status: 'todo' })); }, '/bookings');
  refuse('bookings', (x) => { x.bookings[0].extra = 1; }, '/bookings/0/extra');
  refuse('bookings', (x) => { x.bookings[0].book_by = '2027-04-29T09:00:00+12:00'; }, '/bookings/0/book_by', /before opens_at/);
  refuse('bookings', (x) => { x.bookings[0].status = 'maybe'; }, '/bookings/0/status');
  refuse('bookings', (x) => { x.bookings[0].party_min = 21; }, '/bookings/0/party_min');
  refuse('bookings', (x) => { x.bookings[0].for_date = '2027-02-30'; }, '/bookings/0/for_date');
  refuse('plan_digest', (x) => { x.tz = 'Nowhere/Land'; }, '/tz');
  refuse('plan_digest', (x) => { x.days[0].spare_minutes = 1441; }, '/days/0/spare_minutes');
  refuse('plan_digest', (x) => { x.days[0].stops[0].time_style = 'roughly'; }, '/days/0/stops/0/time_style');
  refuse('plan_digest', (x) => { x.days[0].stops[0].check_on_day = ''; }, '/days/0/stops/0/check_on_day');
  refuse('plan_digest', (x) => { x.days[0].legs[0].estimated = false; }, '/days/0/legs/0/estimated');
  refuse('plan_digest', (x) => { x.days[0].legs[0].distance_m = 500001; }, '/days/0/legs/0/distance_m');
  refuse('plan_digest', (x) => { x.days[0].legs[0].flags = ['trail', 'trail']; }, '/days/0/legs/0/flags', /duplicate flag/);
  refuse('plan_digest', (x) => { x.days[0].legs[0].flags = ['scenic']; }, '/days/0/legs/0/flags/0');
  refuse('plan_digest', (x) => { x.days[0].legs[0].flags = ['footpath', 'trail', 'uphill', 'downhill', 'trail']; }, '/days/0/legs/0/flags');
  refuse('plan_digest', (x) => { x.days[0].legs[0].taxi_minutes = -1; }, '/days/0/legs/0/taxi_minutes');
  refuse('plan_digest', (x) => { x.days[0].legs[0].buffer_minutes = 121; }, '/days/0/legs/0/buffer_minutes');
  refuse('plan_digest', (x) => { x.days[0].legs[0].wiggle = 1; }, '/days/0/legs/0/wiggle');
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
  // WP-2f: the payload is just { text } — the prefs kit's plain-text summary (a count line, then one line per dimension).
  const kitText = 'Travel preferences: 3 confirmed preferences.\nPace: relaxed\nFood: likes street food, noodles; avoids formal dining\nMuseums: likes small museums';
  assert.deepEqual(s.validatePayload('profile_summary', { text: kitText }).errors, []);
  assert.deepEqual(s.validatePayload('profile_summary', { text: 'x'.repeat(1200) }).errors, []);
  refuse('profile_summary', (x) => { delete x.text; }, '/', /missing required "text"/);
  refuse('profile_summary', (x) => { x.html = '<b>no</b>'; }, '/html', /unknown field/);
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

test('core mocks: the manifest\'s eight types are accepted by registerEnvelopeHandler and validateEnvelope', async () => {
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
    if (!ctx.getEnvelopeHandler(t)) ctx.registerEnvelopeHandler(t, { validate: () => [], handle: () => 'ok' });
    const env = E.makeEnvelope({ type: t, producer: 'tg-skill', payload: payloads[t], now, types: E.typesFor('tour-guide') });
    assert.deepEqual(env.errors, [], t);
    const raw = JSON.stringify(env.envelope);
    assert.ok(ctx.validateEnvelope(raw, raw.length).ok, `${t}: core validateEnvelope`);
  }
  assert.throws(() => ctx.registerEnvelopeHandler('shortlist', () => 1), /duplicate "shortlist"/);
  assert.throws(() => ctx.registerEnvelopeHandler('places_summary', () => 1), /unknown envelope type/);
});

// Developed by: LightAISolutions
