'use strict';
// Tour Guide pack — 21_sheets.js: the pack tabs and the storage API of helpers/decisions/TG-PHASE-5.md §1.3.
// All trips, places and names are invented (fixture town "Port Sorrel", reserved domains only).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');

const NOW = '2027-05-01T12:00:00Z';
function fresh(opts = {}) {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: opts.now || NOW });
  H.bootstrap(ctx, state);
  return { ctx, state };
}
const J = (v) => JSON.parse(JSON.stringify(v));
const sheet = (ctx, name) => ctx.getSheet(name);
const maps = (id) => 'https://www.google.com/maps/place/?q=place_id:' + id;

function digest(over = {}) {
  return {
    v: 1, kind: 'plan_digest', trip: 'port-sorrel-spring-2027', build_id: 'build-tc-1', verified_on: '2027-04-30',
    days: [
      { date: '2027-05-12', theme: 'Harbour', stops: [{ n: 1, slug: 'signal-hill-lookout', name: 'Signal Hill Lookout', arrive: '09:50', depart: '10:30', minutes: 40, maps_url: maps('FixtureA'), note_line: '' }],
        legs: [{ from: 'lodging', to: 'signal-hill-lookout', mode: 'WALK', minutes: 12 }], warnings: [] },
      { date: '2027-05-13', theme: 'Museums · Tea', stops: [{ n: 1, slug: 'sorrel-tea-house', name: 'Sorrel Tea House', arrive: '13:58', depart: '14:38', minutes: 40, maps_url: maps('FixtureB'), note_line: 'A quiet tea room.' }],
        legs: [], warnings: ['Closes early on Thursdays'] }
    ],
    later: [{ slug: 'tidewater-botanic-garden', name: 'Tidewater Botanic Garden', reason: 'kept for later' }],
    drive: { plan: '1PlanFixtureId000000aa', brochure_html: '1HtmlFixtureId00000bb', brochure_pdf: null },
    ...over
  };
}
function place(slug, over = {}) {
  return { slug, name: slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '), area: 'Port Sorrel', category: 'museum',
    tags: ['art'], status: 'candidate', last_trip: null, last_researched: '2027-04-28', last_verified: null, note_line: 'Small and quiet.',
    maps_url: maps('Fixture' + slug.length), history_summary: '', ...over };
}

test('ensureSheets creates the six pack tabs with the contract columns', () => {
  const { ctx } = fresh();
  const head = (n) => sheet(ctx, n).getRange(1, 1, 1, sheet(ctx, n).getLastColumn()).getValues()[0];
  assert.deepEqual(head('Trips'), ['slug', 'title', 'destination', 'start', 'end', 'status', 'build_id', 'verified_on', 'drive_plan',
    'drive_brochure_html', 'drive_brochure_pdf', 'updated_at', 'lodging', 'review_offered_at', 'tz', 'country_code']);
  assert.deepEqual(head('DayPlans'), ['slug', 'date', 'theme', 'stops_json', 'legs_json', 'warnings_json', 'part', 'rain_json', 'meta_json']);
  assert.deepEqual(head('Later'), ['slug', 'place_slug', 'name', 'reason']);
  assert.deepEqual(head('Places'), ['slug', 'name', 'destination', 'area', 'category', 'tags', 'status', 'last_trip', 'last_researched',
    'last_verified', 'note_line', 'maps_url', 'history_json', 'scouted']);   // scouted: WP-13c item 8 (C13), the new last column
  assert.deepEqual(head('Choices'), ['trip', 'run', 'kind', 'key', 'value', 'text', 'updated_at']);
  assert.deepEqual(head('Shortlist'), ['trip', 'run', 'round', 'group', 'n', 'slug', 'name', 'gem', 'payload_json']);
});

test('trips: upsert merges by slug, lodging round-trips, status is validated, Date cells read back as dates', () => {
  const { ctx } = fresh();
  const t = ctx.tgTripUpsert({ slug: 'port-sorrel-spring-2027', title: 'Port Sorrel', destination: 'Port Sorrel', lodging: { text: 'Harbourside Rooms', nights: 3 } });
  assert.equal(t.status, 'intake');
  assert.deepEqual(J(t.lodging), { text: 'Harbourside Rooms', nights: 3 });
  ctx.tgTripUpsert({ slug: 'port-sorrel-spring-2027', start: '2027-05-12', end: '2027-05-14', bogus: 'ignored' });
  const g = ctx.tgTripGet('port-sorrel-spring-2027');
  assert.equal(g.title, 'Port Sorrel'); assert.equal(g.start, '2027-05-12'); assert.equal(g.end, '2027-05-14');
  assert.equal(g.bogus, undefined); assert.equal(g.lodging.nights, 3);
  assert.equal(ctx.storeAll('Trips').length, 1);
  assert.throws(() => ctx.tgTripUpsert({ slug: 'Bad Slug' }), /trip slug/);
  assert.throws(() => ctx.tgTripUpsert({ slug: 'x', status: 'drafting' }), /status must be/);
  assert.throws(() => ctx.tgTripSetStatus('port-sorrel-spring-2027', 'draft'), /status must be/);
  assert.equal(ctx.tgTripSetStatus('port-sorrel-spring-2027', 'choosing').status, 'choosing');
  assert.equal(ctx.tgTripSetStatus('nowhere', 'done'), null);
  // A real Sheet turns "2027-05-12" into a Date cell: it still reads back as YYYY-MM-DD.
  const row = ctx.storeAll('Trips')[0];
  sheet(ctx, 'Trips').getRange(row._row, 4, 1, 1).setValue(new Date('2027-05-12T00:00:00Z'));
  assert.equal(ctx.tgTripGet('port-sorrel-spring-2027').start, '2027-05-12');
  assert.equal(ctx.tgTripGet('nowhere'), null);
});

test('trips: list order and the current trip (pinned → in progress → next upcoming; done never)', () => {
  const { ctx } = fresh();
  ctx.tgTripUpsert({ slug: 'later-trip', start: '2027-09-01', end: '2027-09-05' });
  ctx.tgTripUpsert({ slug: 'soon-trip', start: '2027-06-01', end: '2027-06-03' });
  ctx.tgTripUpsert({ slug: 'undated' });
  ctx.tgTripUpsert({ slug: 'past-trip', start: '2027-01-01', end: '2027-01-03', status: 'done' });
  assert.deepEqual(J(ctx.tgTripList().map((t) => t.slug)), ['past-trip', 'soon-trip', 'later-trip', 'undated']);
  assert.equal(ctx.tgTripCurrent().slug, 'soon-trip');
  ctx.tgTripUpsert({ slug: 'now-trip', start: '2027-04-29', end: '2027-05-03' });
  assert.equal(ctx.tgTripCurrent().slug, 'now-trip');
  ctx.settingSet('tg_current_trip', 'later-trip');
  assert.equal(ctx.tgTripCurrent().slug, 'later-trip');
  ctx.settingSet('tg_current_trip', 'past-trip');
  assert.equal(ctx.tgTripCurrent().slug, 'now-trip');
  ctx.tgTripSetStatus('now-trip', 'done'); ctx.tgTripSetStatus('soon-trip', 'done'); ctx.tgTripSetStatus('later-trip', 'done');
  assert.equal(ctx.tgTripCurrent(), null);
});

test('plan digest: days, day lookup, Trips fields, Later replaced but owner additions kept', () => {
  const { ctx } = fresh();
  ctx.tgTripUpsert({ slug: 'port-sorrel-spring-2027', destination: 'Port Sorrel', status: 'choosing' });
  ctx.tgLaterAdd('port-sorrel-spring-2027', { place_slug: 'rope-loft-studio', name: 'Rope Loft Studio', reason: 'owner_choice' });
  ctx.tgLaterAdd('port-sorrel-spring-2027', { place_slug: 'sorrel-tea-house', name: 'Sorrel Tea House', reason: 'owner_choice' });
  ctx.tgLaterAdd('port-sorrel-spring-2027', { place_slug: 'old-entry', name: 'Old Entry', reason: 'too far' });
  const r = ctx.tgDigestStore(digest());
  assert.deepEqual(J(r), { trip: 'port-sorrel-spring-2027', days: 2, rows: 2, later: 1, kept_owner_later: 1 });
  const t = ctx.tgTripGet('port-sorrel-spring-2027');
  assert.equal(t.status, 'planned'); assert.equal(t.build_id, 'build-tc-1'); assert.equal(t.verified_on, '2027-04-30');
  assert.equal(t.drive_plan, '1PlanFixtureId000000aa'); assert.equal(t.drive_brochure_pdf, '');
  assert.equal(t.start, '2027-05-12'); assert.equal(t.end, '2027-05-13');
  const days = ctx.tgDigestDays('port-sorrel-spring-2027');
  assert.deepEqual(J(days.map((d) => [d.n, d.date, d.theme])), [[1, '2027-05-12', 'Harbour'], [2, '2027-05-13', 'Museums · Tea']]);
  assert.equal(days[1].stops[0].note_line, 'A quiet tea room.');
  assert.deepEqual(J(days[1].warnings), ['Closes early on Thursdays']);
  assert.equal(ctx.tgDigestDay('port-sorrel-spring-2027', 2).date, '2027-05-13');
  assert.equal(ctx.tgDigestDay('port-sorrel-spring-2027', '1').date, '2027-05-12');
  assert.equal(ctx.tgDigestDay('port-sorrel-spring-2027', '2027-05-13').n, 2);
  assert.equal(ctx.tgDigestDay('port-sorrel-spring-2027', 3), null);
  assert.equal(ctx.tgDigestDay('port-sorrel-spring-2027', '2027-06-01'), null);
  // Owner's Rope Loft kept (not in the digest); Sorrel Tea House dropped (now scheduled); 'too far' replaced.
  assert.deepEqual(J(ctx.tgLaterList('port-sorrel-spring-2027')), [
    { place_slug: 'tidewater-botanic-garden', name: 'Tidewater Botanic Garden', reason: 'kept for later' },
    { place_slug: 'rope-loft-studio', name: 'Rope Loft Studio', reason: 'owner_choice' }]);
  // A second build replaces the days; a done trip keeps its status.
  ctx.tgTripSetStatus('port-sorrel-spring-2027', 'done');
  ctx.tgDigestStore(digest({ build_id: 'build-tc-2', days: [digest().days[1]] }));
  assert.equal(ctx.tgDigestDays('port-sorrel-spring-2027').length, 1);
  assert.equal(ctx.tgTripGet('port-sorrel-spring-2027').status, 'done');
  assert.equal(ctx.tgTripGet('port-sorrel-spring-2027').start, '2027-05-12');
  // Later add updates by place_slug.
  ctx.tgLaterAdd('port-sorrel-spring-2027', { place_slug: 'rope-loft-studio', name: 'Rope Loft Studio', reason: 'rainy day' });
  assert.equal(ctx.tgLaterList('port-sorrel-spring-2027').filter((l) => l.place_slug === 'rope-loft-studio')[0].reason, 'rainy day');
  assert.throws(() => ctx.tgLaterAdd('port-sorrel-spring-2027', { place_slug: 'Not A Slug' }), /place_slug/);
});

test('plan digest: rain swaps round-trip; a DayPlans tab made before rain_json gets the column on the next store', () => {
  const { ctx } = fresh();
  const tab = sheet(ctx, 'DayPlans');
  tab.getRange(1, 8, 1, 1).setValues([['']]);
  const rain = [{ slug: 'lantern-museum', name: 'Lantern Museum', instead_of: 'Signal Hill Lookout', km: 1.1, maps_url: maps('FixtureC') }];
  const d = digest();
  d.days[0].rain = rain;
  ctx.tgDigestStore(d);
  assert.ok(tab.getRange(1, 1, 1, tab.getLastColumn()).getValues()[0].includes('rain_json'));
  const days = ctx.tgDigestDays('port-sorrel-spring-2027');
  assert.deepEqual(J(days[0].rain), rain);
  assert.deepEqual(J(days[1].rain), []);
});

test('plan digest: a day over the 50 000-character cell limit is split across part rows and read back whole', () => {
  const { ctx } = fresh();
  const longUrl = 'https://maps.example.com/' + 'x'.repeat(1900);
  const stops = Array.from({ length: 25 }, (_, i) => ({ n: i + 1, slug: 'stop-' + (i + 1), name: 'Stop ' + (i + 1), arrive: '09:00', depart: '09:30', minutes: 30, maps_url: longUrl, note_line: 'n'.repeat(160) }));
  const big = digest({ days: [{ date: '2027-05-12', theme: 'Long day', stops, legs: [], warnings: [] }, digest().days[1]] });
  assert.ok(JSON.stringify(stops).length > 50000);
  const r = ctx.tgDigestStore(big);
  assert.equal(r.rows, 3);
  const rows = ctx.storeAll('DayPlans');
  rows.forEach((row) => ['stops_json', 'legs_json', 'warnings_json'].forEach((c) => assert.ok(String(row[c]).length <= 50000)));
  assert.deepEqual(J(rows.map((x) => [x.date, x.part])), [['2027-05-12', 0], ['2027-05-12', 1], ['2027-05-13', 0]]);
  const day = ctx.tgDigestDay('port-sorrel-spring-2027', 1);
  assert.deepEqual(J(day.stops), stops);
  assert.equal(day.theme, 'Long day');
  assert.equal(ctx.tgDigestDays('port-sorrel-spring-2027').length, 2);
});

test('places: upsert by slug classifies new / changed / verified / same and never stores a Google field', () => {
  const { ctx } = fresh();
  const r1 = ctx.tgPlacesUpsert({ destination: 'port-sorrel', places: [place('harbour-signal-museum'), place('fig-tree-courtyard', { category: 'restaurant', tags: ['seafood', 'courtyard'] })] });
  assert.equal(r1.added, 2);
  const r2 = ctx.tgPlacesUpsert({ destination: 'port-sorrel', places: [
    place('harbour-signal-museum', { note_line: 'Closed Mondays now.' }),
    place('fig-tree-courtyard', { category: 'restaurant', tags: ['seafood', 'courtyard'], last_verified: '2027-04-30', rating: 4.7, hours: 'Mon-Sun', user_rating_count: 120 }),
    place('quay-steps')] });
  assert.deepEqual(J([r2.added, r2.changed, r2.verified, r2.same]), [1, 1, 1, 0]);
  assert.deepEqual(J(r2.places.map((p) => [p.slug, p.kind])), [['harbour-signal-museum', 'changed'], ['fig-tree-courtyard', 'verified'], ['quay-steps', 'new']]);
  assert.deepEqual(J(r2.places[0].changed_fields), ['note_line']);
  assert.deepEqual(J(r2.refused.map((x) => x.field).sort()), ['hours', 'rating', 'user_rating_count']);
  const cells = JSON.stringify(sheet(ctx, 'Places').rows());
  assert.ok(!/4\.7|Mon-Sun|rating|hours/.test(cells), 'no Google value or key reaches the Places tab');
  const r3 = ctx.tgPlacesUpsert({ destination: 'port-sorrel', places: [place('quay-steps')] });
  assert.equal(r3.same, 1);
  assert.equal(ctx.storeAll('Places').length, 3);
  const g = ctx.tgPlacesGet('fig-tree-courtyard');
  assert.deepEqual(J(g.tags), ['seafood', 'courtyard']); assert.equal(g.last_verified, '2027-04-30'); assert.equal(g.destination, 'port-sorrel');
  assert.equal(g.rating, undefined); assert.equal(g.history_summary, '');
  assert.equal(ctx.tgPlacesGet('nope'), null);
  assert.throws(() => ctx.tgPlacesUpsert({ destination: 'Port Sorrel', places: [] }), /destination/);
});

test('places: search on name, tags and area — destination first, name prefix before contains, limit 8, accents folded', () => {
  const { ctx } = fresh();
  ctx.tgPlacesUpsert({ destination: 'carrow-coast', places: [place('gallery-of-tides', { area: 'Carrow' }), place('old-gallery-loft', { area: 'Carrow' })] });
  ctx.tgPlacesUpsert({ destination: 'port-sorrel', places: [
    place('tidewater-boathouse-gallery'), place('gallery-cafe', { name: 'Gallery Café', category: 'cafe', tags: ['coffee'] }),
    place('saltmarsh-reading-room', { tags: ['books', 'quiet'] }), place('mill-quarter-gin-room', { area: 'Mill Quarter', tags: ['bar'] })] });
  ctx.tgTripUpsert({ slug: 'port-sorrel-spring-2027', destination: 'Port Sorrel', start: '2027-05-12', end: '2027-05-14' });
  const names = (q, o) => J(ctx.tgPlacesSearch(q, o).map((p) => p.slug));
  assert.deepEqual(names('gallery'), ['gallery-cafe', 'tidewater-boathouse-gallery', 'gallery-of-tides', 'old-gallery-loft']);
  assert.deepEqual(names('gallery', { destination: 'carrow-coast' }), ['gallery-of-tides', 'old-gallery-loft', 'gallery-cafe', 'tidewater-boathouse-gallery']);
  assert.deepEqual(names('CAFE'), ['gallery-cafe']);
  assert.deepEqual(names('café'), ['gallery-cafe']);
  assert.deepEqual(names('quiet'), ['saltmarsh-reading-room']);
  assert.deepEqual(names('mill quarter'), ['mill-quarter-gin-room']);
  assert.deepEqual(names('gallery', { limit: 2 }), ['gallery-cafe', 'tidewater-boathouse-gallery']);
  assert.deepEqual(names('   '), []);
  assert.deepEqual(names('zzz'), []);
  ctx.tgPlacesUpsert({ destination: 'port-sorrel', places: Array.from({ length: 12 }, (_, i) => place('art-stop-' + i, { tags: ['art'] })) });
  assert.equal(ctx.tgPlacesSearch('art').length, 8);
  assert.deepEqual(J(ctx.tgPlacesCounts()), { 'carrow-coast': 2, 'port-sorrel': 16 });
});

test('choices: a tap overwrites the same key; list keeps first-tap order; clear removes one run only', () => {
  const { ctx } = fresh();
  ctx.tgChoiceSet('port-sorrel-spring-2027', 'f20270430002', 'shortlist', '1', 'w');
  ctx.tgChoiceSet('port-sorrel-spring-2027', 'f20270430002', 'shortlist', '9', 's');
  ctx.tgChoiceSet('port-sorrel-spring-2027', 'f20270430002', 'shortlist', '1', 'l');
  ctx.tgChoiceSet('port-sorrel-spring-2027', 'intake', 'fact', '2', 'e', 'Harbourside Rooms, 4 nights');
  const list = ctx.tgChoiceList('port-sorrel-spring-2027', 'f20270430002', 'shortlist');
  assert.deepEqual(J(list.map((c) => [c.key, c.value])), [['1', 'l'], ['9', 's']]);
  assert.equal(ctx.tgChoiceList('port-sorrel-spring-2027', 'intake', 'fact')[0].text, 'Harbourside Rooms, 4 nights');
  assert.throws(() => ctx.tgChoiceSet('t', 'r', 'vote', '1', 'y'), /kind must be/);
  assert.throws(() => ctx.tgChoiceSet('t', '', 'fact', '1', 'y'), /required/);
  assert.equal(ctx.tgChoiceClear('port-sorrel-spring-2027', 'f20270430002', 'shortlist'), 2);
  assert.equal(ctx.tgChoiceList('port-sorrel-spring-2027', 'intake', 'fact').length, 1);
});

test('profile summary: cached in Settings, null when absent or unreadable', () => {
  const { ctx } = fresh();
  assert.equal(ctx.tgProfileSummaryGet(), null);
  ctx.tgProfileSummaryStore({ text: 'Pace: relaxed.\nFood: street food.', dimensions_count: 7, updated: '2027-04-30T10:00:00Z' });
  const p = ctx.tgProfileSummaryGet();
  assert.equal(p.text, 'Pace: relaxed.\nFood: street food.'); assert.equal(p.dimensions_count, 7); assert.equal(p.received_at, NOW.replace('Z', '.000Z'));
  ctx.settingSet('tg_profile_summary', 'not json');
  assert.equal(ctx.tgProfileSummaryGet(), null);
});

function shortlist(over = {}) {
  const it = (n, slug, gem) => ({ n, slug, name: slug.replace(/-/g, ' '), why_you: 'You like quiet rooms.', fit: 0.8, est_minutes: 60, area: 'Port Sorrel', maps_url: maps('F' + n), labels: ['verified'], ...(gem ? { gem: true, gem_line: 'Locals name it first.' } : {}) });
  return { v: 1, kind: 'shortlist', trip: 'port-sorrel-spring-2027', run_id: 'f20270430002', round: 1, more: true,
    groups: [{ id: 'activities', gems_wanted: 1, gems_shown: 1, items: [it(1, 'tidewater-boathouse-gallery', true), it(2, 'saltmarsh-reading-room')] },
      { id: 'food', items: [it(3, 'fig-tree-courtyard', true)] }], ...over };
}

test('shortlist: one row per item, n resolves to slug, re-delivery replaces its round, long run ids get a short key', () => {
  const { ctx } = fresh();
  const r = ctx.tgShortlistStore(shortlist());
  assert.deepEqual(J(r), { trip: 'port-sorrel-spring-2027', run: 'f20270430002', run_id: 'f20270430002', round: 1, count: 3 });
  ctx.tgShortlistStore(shortlist());
  ctx.tgShortlistStore(shortlist({ round: 2, groups: [{ id: 'food', items: [{ ...shortlist().groups[1].items[0], n: 4, slug: 'three-lanterns-tasca', gem: false }] }] }));
  const items = ctx.tgShortlistItems('port-sorrel-spring-2027', 'f20270430002');
  assert.deepEqual(J(items.map((i) => [i.round, i.group, i.n, i.slug, i.gem])), [
    [1, 'activities', 1, 'tidewater-boathouse-gallery', true], [1, 'activities', 2, 'saltmarsh-reading-room', false],
    [1, 'food', 3, 'fig-tree-courtyard', true], [2, 'food', 4, 'three-lanterns-tasca', false]]);
  assert.equal(items[0].item.gem_line, 'Locals name it first.');
  const long = 'research-run-2027-04-30T10:00:00Z-round-3';
  const key = ctx.tgShortlistRunKey('port-sorrel-spring-2027', long);
  assert.match(key, /^r[0-9a-f]{11}$/);
  ctx.tgShortlistStore(shortlist({ run_id: long, round: 3 }));
  assert.equal(ctx.tgShortlistItems('port-sorrel-spring-2027', long).length, 3);
  assert.equal(ctx.tgShortlistItems('port-sorrel-spring-2027', key).length, 3);
  assert.ok(ctx.cbEncode('sl', key, '12', 'w').length <= 64);
  assert.deepEqual(J(ctx.tgShortlistLatest()), { trip: 'port-sorrel-spring-2027', run: key, round: 3 });
  assert.equal(ctx.tgShortlistLatest('other-trip'), null);
});

test('snapshot tour_guide: trips, the open choice round with tap counts, profile date, places per destination', () => {
  const { ctx } = fresh();
  assert.deepEqual(J(ctx.buildSnapshot().tour_guide), { trips: [], trips_total: 0, choice_round: null, profile_summary: null, places: {}, bookings: {} });
  ctx.tgTripUpsert({ slug: 'port-sorrel-spring-2027', destination: 'Port Sorrel', start: '2027-05-12', end: '2027-05-14', status: 'choosing' });
  ctx.tgTripUpsert({ slug: 'past-trip', status: 'done', start: '2026-01-01' });
  ctx.tgShortlistStore(shortlist());
  ctx.tgChoiceSet('port-sorrel-spring-2027', 'f20270430002', 'shortlist', '1', 'w');
  ctx.tgChoiceSet('port-sorrel-spring-2027', 'f20270430002', 'shortlist', '2', 'l');
  ctx.tgChoiceSet('port-sorrel-spring-2027', 'f20270430002', 'shortlist', '3', 'w');
  ctx.tgProfileSummaryStore({ text: 'Pace: relaxed.', updated: '2027-04-30T10:00:00Z' });
  ctx.tgPlacesUpsert({ destination: 'port-sorrel', places: [place('quay-steps')] });
  const s = J(ctx.buildSnapshot().tour_guide);
  assert.deepEqual(s.trips.map((t) => [t.slug, t.status]), [['port-sorrel-spring-2027', 'choosing'], ['past-trip', 'done']]);
  assert.deepEqual(s.choice_round, { trip: 'port-sorrel-spring-2027', run: 'f20270430002', round: 1, items: 3, want: 2, later: 1, skip: 0 });
  assert.deepEqual(s.profile_summary, { updated: '2027-04-30' });
  assert.deepEqual(s.places, { 'port-sorrel': 1 });
  ctx.tgTripSetStatus('port-sorrel-spring-2027', 'planned');
  assert.equal(J(ctx.buildSnapshot().tour_guide).choice_round, null);
});
