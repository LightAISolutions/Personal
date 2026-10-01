'use strict';
// packs/tour-guide/brochure-map — a Plan (with Trip, Places, PlaceNotes, snapshots, estimates) maps onto the brochure
// kit's model: it passes the kit's schema and semantic checks, renders to self-contained HTML, every stop has a card,
// legs/meals/warnings land on their day, Later lists keep their reasons, and Google content can be hidden.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const loadAll = async () => {
  const bm = await import('../packs/tour-guide/brochure-map/index.mjs');
  const kit = await import('../kits/brochure/index.mjs');
  const { sampleInput } = await import('../packs/tour-guide/brochure-map/brochure-map-sample.mjs');
  return { bm, kit, sampleInput };
};

test('sample plan → model that passes validate() and the semantic checks, and renders without warnings', async () => {
  const { bm, kit, sampleInput } = await loadAll();
  const input = sampleInput();
  const before = JSON.stringify(input);
  const model = bm.toBrochureModel(input);
  assert.equal(JSON.stringify(input), before, 'input is not mutated');
  assert.deepEqual(kit.validate(model), []);
  assert.deepEqual(kit.semanticErrors(model), []);
  const { html, model: out, warnings } = bm.renderPlan(sampleInput());
  assert.deepEqual(out, model, 'renderPlan returns the same brochure model');
  assert.deepEqual(warnings, []);
  assert.doesNotMatch(html, /<script/i);
  assert.equal((html.match(/class="sec sec-day/g) || []).length, 2);
  for (const s of ['Harrowmere in two days', 'Tram 3', 'Bus 12', 'Saved for later', 'Closed on Fridays.', 'Getting around']) assert.ok(html.includes(s), s);
  for (const [, u] of html.matchAll(/\s(?:src|href)="([^"]*)"/g)) assert.match(u, /^(data:|#|https?:\/\/|mailto:)/, u);
});

test('trip, days, stops and legs follow the DayPlans: modes mapped, lines kept, booked text, lodging names', async () => {
  const { bm, sampleInput } = await loadAll();
  const input = sampleInput();
  const m = bm.toBrochureModel(input);
  assert.equal(m.version, 1);
  assert.deepEqual([m.trip.start_date, m.trip.end_date, m.trip.build_id, m.trip.built_on, m.trip.verified_on], ['2027-05-13', '2027-05-14', 'fixture-build-0001', '2027-04-20', '2027-04-20']);
  assert.equal(m.trip.lodging[0].name, 'Quayside Rooms');
  assert.match(m.trip.lodging[0].maps_url, /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=Quayside/);
  assert.deepEqual(m.days.map((d) => d.date), ['2027-05-13', '2027-05-14']);
  const [d1, d2] = m.days;
  assert.equal(d1.theme, 'Quarry stone and the copper market');
  assert.equal(d2.theme, 'Lark Hill', 'default theme from the stops');
  assert.equal(d1.lodging, 'Quayside Rooms');
  assert.deepEqual(d1.legs.map((l) => [l.from, l.to, l.mode, l.line, l.minutes]), [['lodging', 'slate-museum', 'transit', 'Tram 3', 23], ['slate-museum', 'copper-market', 'transit', 'Bus 12', 23], ['copper-market', 'lodging', 'transit', 'Tram 3', 25]]);
  assert.deepEqual(d2.legs.map((l) => [l.mode, l.line]), [['walk', undefined], ['walk', undefined]]);
  const src = input.plan.days[0];
  d1.stops.forEach((s, i) => assert.deepEqual([s.place, s.arrive, s.depart, s.minutes, s.activity], [src.stops[i].place, src.stops[i].arrive, src.stops[i].depart, src.stops[i].minutes, src.stops[i].activity]));
  assert.equal(d1.stops[0].booked, 'Timed entry 10:00, booked');
  assert.equal(d1.legs[0].maps_url, src.legs[0].maps_url);
  assert.deepEqual(d1.meals, [{ kind: 'lunch', start: '13:00', end: '13:45', note: 'Eat at the stalls.', place: 'copper-market' }]);
  assert.deepEqual(d2.meals, [{ kind: 'breakfast', start: '08:00', end: '08:45', name: 'Quayside Rooms' }], 'a meal at "lodging" names the lodging');
  assert.deepEqual(d1.free, [{ start: '14:15', end: '19:00', note: 'Rest, or wander the old quay.' }]);
  assert.equal(d1.verified_on, '2027-04-20');
});

test('warnings: alert and warn on the day (most severe first); info attached to its stop as a note', async () => {
  const { bm, sampleInput } = await loadAll();
  const [d1, d2] = bm.toBrochureModel(sampleInput()).days;
  assert.deepEqual(d1.warnings, [{ severity: 'alert', text: 'Only 5 minutes from the museum to the bus stop.', place: 'slate-museum' }]);
  assert.deepEqual(d2.warnings, [{ severity: 'warn', text: 'Ember Hall is closed on Fridays; saved for later.', place: 'ember-hall' }]);
  assert.equal(d2.stops[0].note, 'Opening hours unknown; it is an open hillside.');
  const input = sampleInput();
  input.plan.days[1].warnings.push({ severity: 'info', code: 'other', text: 'Market day in the next town.' }, { severity: 'alert', code: 'budget', text: 'Close to the Maps budget.' });
  const w = bm.toBrochureModel(input).days[1].warnings;
  assert.deepEqual(w.map((x) => x.severity), ['alert', 'warn', 'info'], 'an info warning naming no stop stays as an info line');
});

test('every stop, meal and Later place has a card; cards carry the Place, PlaceNote and snapshot content', async () => {
  const { bm, sampleInput } = await loadAll();
  const m = bm.toBrochureModel(sampleInput());
  for (const d of m.days) for (const s of d.stops) assert.ok(m.places[s.place], s.place);
  for (const l of m.later) for (const it of l.items) assert.ok(m.places[it.place], it.place);
  assert.deepEqual(Object.keys(m.places), ['slate-museum', 'copper-market', 'lark-hill', 'ember-hall', 'fennel-park']);
  const museum = m.places['slate-museum'];
  assert.equal(museum.name, 'Slate Museum');
  assert.equal(museum.category, 'Museum');
  assert.equal(museum.place_id, 'FixtureSlateMuseum001');
  assert.equal(museum.hours.length, 7);
  assert.equal(museum.hours_today, '9:00 AM – 5:00 PM', 'Thursday line');
  assert.deepEqual(museum.closed_days, ['Monday']);
  assert.deepEqual([museum.rating, museum.review_count, museum.website, museum.business_status, museum.fetched_on], [4.6, 812, 'https://slate-museum.example.com/', 'OPERATIONAL', '2027-04-20']);
  assert.equal(museum.maps_url, 'https://maps.example.com/place/slate-museum', 'maps_uri from the snapshot');
  assert.equal(museum.address, '1 Slate Museum Lane, Harrowmere');
  assert.deepEqual([museum.lat, museum.lng], [41.5062, 12.3188]);
  assert.deepEqual(museum.note, { why_you: 'You like museums with working machines.', what_to_do: 'Start with the splitting shed.', tickets: 'Timed entry, booked for 10:00.', pairings: ['copper-market'] });
  assert.deepEqual(m.places['copper-market'].closed_days, ['Monday', 'Sunday']);
  assert.equal(m.places['ember-hall'].hours_today, undefined, 'not visited: no single line for the day');
  assert.deepEqual(m.places['ember-hall'].closed_days, ['Friday']);
  const hill = m.places['lark-hill'];
  assert.equal(hill.hours, undefined, 'hours unknown → no hours'); assert.equal(hill.rating, 4.8);
  const park = m.places['fennel-park'];
  assert.match(park.maps_url, /query_place_id=FixtureFennelPark001/, 'content purged → our own Maps link');
  assert.equal(park.rating, undefined);
});

test('Later lists keep names and reasons; an empty list is dropped; a missing reason falls back by code', async () => {
  const { bm, sampleInput } = await loadAll();
  const m = bm.toBrochureModel(sampleInput());
  assert.deepEqual(m.later, [{ name: "Didn't fit", items: [
    { place: 'ember-hall', reason: 'Closed on Fridays.', note: 'Taken off the plan for 2027-05-14.' },
    { place: 'fennel-park', reason: 'The days were full' }] }]);
});

test('attribution: union of note and estimate sources, deduplicated by URL, latest access date, supports merged', async () => {
  const { bm, sampleInput } = await loadAll();
  const a = bm.toBrochureModel(sampleInput()).attribution;
  assert.equal(a.generator, 'Tour Guide · brochure-map (fixture)');
  assert.equal(a.google, undefined, 'kit default: on because cards carry Google fields');
  const urls = a.sources.map((s) => s.url);
  assert.equal(urls.length, 3, urls.join(' '));
  assert.equal(new Set(urls.map(bm.sourceKey)).size, 3);
  const guide = a.sources.find((s) => s.url.startsWith('https://guide.example.com/'));
  assert.deepEqual(guide, { title: 'Harrowmere city guide', url: 'https://guide.example.com/harrowmere', accessed: '2027-04-19', supports: 'best time; visit length' });
  const museum = a.sources.find((s) => s.url.includes('slate-museum'));
  assert.equal(museum.accessed, '2027-04-18');
  assert.ok(a.sources.every((s) => s.title && s.accessed), 'every source has a title and an access date');
  const input = sampleInput();
  input.estimates.push({ ...input.estimates[0], place_id: 'FixtureNotInPlan0001', sources: [{ url: 'https://other.example.com/x', accessed: '2027-04-01' }] });
  assert.ok(!bm.toBrochureModel(input).attribution.sources.some((s) => s.url.includes('other.example.com')), 'only places in the brochure');
});

test('show_google_content=false: no Google fields on any card, Google block off, dated "verify before you go" with Maps links', async () => {
  const { bm, kit, sampleInput } = await loadAll();
  const input = sampleInput(); input.options.show_google_content = false;
  const m = bm.toBrochureModel(input);
  assert.deepEqual(kit.validate(m), []);
  assert.deepEqual(kit.semanticErrors(m), []);
  for (const [k, p] of Object.entries(m.places)) {
    for (const f of ['hours', 'hours_today', 'closed_days', 'rating', 'review_count', 'website', 'business_status', 'address', 'fetched_on', 'editorial', 'reviews']) assert.equal(p[f], undefined, `${k}.${f}`);
    assert.match(p.maps_url, /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=.*&query_place_id=Fixture/);
  }
  assert.equal(m.attribution.google, false);
  const v = m.practical.find((s) => s.title === 'Verify before you go');
  assert.ok(v, 'verify section present');
  assert.match(v.text, /2027-04-20/);
  assert.equal(v.items.length, Object.keys(m.places).length);
  for (const it of v.items) { assert.match(it.text, /last checked 2027-04-20/); assert.match(it.url, /query_place_id=/); }
  const { html } = bm.renderPlan(input);
  assert.ok(!html.includes('class="attr-google"'));
  assert.ok(!html.includes('812 reviews'));
  assert.ok(bm.renderPlan(sampleInput()).html.includes('812 reviews'), 'the default mode prints it');
  assert.ok(html.includes('Verify before you go'));
  assert.ok(!bm.toBrochureModel(sampleInput()).practical.some((s) => s.title === 'Verify before you go'), 'not in the default mode');
});

test('day routes section from day_url; trip practical sections pass through', async () => {
  const { bm, sampleInput } = await loadAll();
  const p = bm.toBrochureModel(sampleInput()).practical;
  assert.deepEqual(p.map((s) => s.title), ['Getting around', 'Day routes']);
  assert.deepEqual(p[0].items[1], 'Carry coins for the river ferry.');
  assert.equal(p[1].items.length, 1, 'day 1 has no day_url (transit)');
  assert.match(p[1].items[0].label, /^Day 2 · 2027-05-14$/);
});

// Developed by: LightAISolutions
