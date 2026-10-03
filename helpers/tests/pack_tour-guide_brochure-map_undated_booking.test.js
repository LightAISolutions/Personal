'use strict';
// Tour Guide — a booking with no date (WP-12d): a trip.bookings record that names a place but no `for_date` belongs to
// the day its place is planned on. The planner gives the dinner card its line; the brochure gives the stop its line and
// says "Planned for <day>." on the Bookings page. A dated record still wins on its own date and never moves. Invented
// data only (the brochure-map sample, the moving-day fixture).
const { test } = require('node:test');
const assert = require('node:assert/strict');

const planner = () => import('../packs/tour-guide/planner/index.mjs');
const loadBm = async () => ({
  bm: await import('../packs/tour-guide/brochure-map/index.mjs'),
  kit: await import('../kits/brochure/index.mjs'),
  ...(await import('../packs/tour-guide/brochure-map/brochure-map-sample.mjs'))
});
const rec = (o) => ({ id: o.id || 'rec-' + (o.place || 'x'), title: o.title || 'Fixture booking', kind: 'sight', rule: 'opens 7 days ahead', status: 'todo', ...o });

test('bookingFor: the dated record on its date first, else the undated one; another date never; firstDay keeps it to one day', async () => {
  const { bookingFor, bookingRecordLine } = await planner();
  const dated = rec({ id: 'a', place: 'kiln', for_date: '2027-05-14', rule: 'dated rule' }), undated = rec({ id: 'b', place: 'kiln' });
  assert.equal(bookingFor([undated, dated], 'kiln', '2027-05-14'), dated);
  assert.equal(bookingFor([undated, dated], 'kiln', '2027-05-13'), undated);
  assert.equal(bookingFor([dated], 'kiln', '2027-05-13'), null, 'a dated record never moves to another day');
  assert.equal(bookingFor([undated], 'loom', '2027-05-13'), null);
  assert.equal(bookingFor([rec({ id: 'c' })], undefined, '2027-05-13'), null, 'a record with no place is never on a day');
  const first = new Map([['kiln', '2027-05-14']]);
  assert.equal(bookingFor([undated], 'kiln', '2027-05-13', first), null);
  assert.equal(bookingFor([undated], 'kiln', '2027-05-14', first), undated);
  assert.equal(bookingFor(undefined, 'kiln', '2027-05-14'), null);
  assert.equal(bookingRecordLine(rec({ how: 'online', party_min: 2 })), 'To book: opens 7 days ahead · online · from 2 people');
  assert.equal(bookingRecordLine(rec({ status: 'booked', how: 'online' })), 'Booked');
  assert.ok(bookingRecordLine(rec({ rule: 'r'.repeat(200), how: 'h'.repeat(120) })).length <= 160);
});

test('planner: the dinner with an undated booking gets its line on the evening it is planned', async () => {
  const L = { fixtures: await import('../packs/tour-guide/fixtures/index.mjs'), maps: await import('../kits/maps/index.mjs'), planner: await planner() };
  const planOf = async (mut) => {
    const fx = L.fixtures.loadFixture('moving-day');
    mut(fx);
    const maps = L.maps.createMapsClient({ transport: L.maps.createMockTransport(L.fixtures.createFixtureResponder(fx)), ledger: L.maps.createLedger() });
    return L.planner.planTrip({ ...fx, maps, build_id: 'wp12d-undated', now: '2027-10-01T09:00:00Z', seed: 7 });
  };
  const dinners = (p) => p.days.flatMap((d) => (d.meals || []).filter((m) => m.kind === 'dinner' && m.at === 'hearth-and-barley').map((m) => [d.date, m.booking]));
  const LINE = 'To book: book a day ahead · by phone · from 2 people';
  assert.deepEqual(dinners(await planOf(() => {})), [['2027-10-19', LINE]], 'the dated record, as before');
  const undated = dinners(await planOf((fx) => { delete fx.trip.bookings[0].for_date; }));
  assert.equal(undated.length, 1, 'the place is still that evening\'s dinner');
  assert.deepEqual(undated[0][1], LINE, `its booking line on ${undated[0][0]}, the day it is planned on`);
  const other = dinners(await planOf((fx) => { fx.trip.bookings[0].for_date = '2027-10-20'; }));
  assert.ok(other.every(([date, line]) => date === '2027-10-20' || line !== LINE), 'a record for another date stays off this evening');
});

test('brochure: an undated booking shows on the stop of the day its place is planned on, and the Bookings page says which day', async () => {
  const { bm, kit, sampleInput } = await loadBm();
  const input = sampleInput();
  input.trip.bookings = [
    rec({ id: 'hill-walk', title: 'Guided walk on Lark Hill', place: 'lark-hill', how: 'online' }),   // no date: Lark Hill is on day 2
    rec({ id: 'market-tour', title: 'Copper market tour', place: 'copper-market', for_date: '2027-05-14' }),   // dated for a day it is not on
    rec({ id: 'ember', title: 'Ember Hall talk', place: 'ember-hall' })   // no date, and Ember Hall is only on the Later list
  ];
  const m = bm.toBrochureModel(input);
  assert.deepEqual(kit.validate(m), []);
  assert.deepEqual(kit.semanticErrors(m), []);
  const stopOf = (n, slug) => m.days[n].stops.find((s) => s.place === slug);
  assert.equal(stopOf(1, 'lark-hill').booking_line, 'To book: opens 7 days ahead · online');
  assert.equal(stopOf(0, 'copper-market').booking_line, undefined, 'a dated record is not shown on another day');
  assert.equal(stopOf(0, 'slate-museum').booking_line, undefined, 'a booked stop keeps its booked text');
  const items = m.practical.find((s) => s.title === 'Bookings').items;
  const text = (label) => items.find((i) => i.label === label).text;
  assert.match(text('Guided walk on Lark Hill'), / Planned for Fri 14 May\. /);
  assert.match(text('Copper market tour'), / For Fri 14 May\. /);
  assert.doesNotMatch(text('Copper market tour'), /Planned/);
  assert.doesNotMatch(text('Ember Hall talk'), /For |Planned/, 'a place that is on no day gets no day');
  const { html } = bm.renderPlan(input, { embedFonts: false });
  assert.ok(html.includes('To book: opens 7 days ahead · online'));
});

test('brochure: a trip without bookings maps as before; the Bookings page writes a day as the day card does', async () => {
  const { bm, sampleInput } = await loadBm();
  const m = bm.toBrochureModel(sampleInput());
  assert.ok(m.days.every((d) => d.stops.every((s) => s.booking_line === undefined)));
  const { bookingsSection } = await import('../packs/tour-guide/brochure-map/brochure-map-bookings.mjs');
  const sec = bookingsSection([rec({ title: 'September visit', place: 'kiln', for_date: '2027-09-03' })], { tripTz: 'UTC' });
  assert.match(sec.items[0].text, / For Fri 3 Sep\. /, '"Sep", as Apps Script prints it, not ICU\'s "Sept"');
});

// Developed by: LightAISolutions
