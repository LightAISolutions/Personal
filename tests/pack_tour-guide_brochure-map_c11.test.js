'use strict';
// packs/tour-guide/brochure-map — Contract C11 (WP-11d): a plan, trip and places carrying the C11 fields map onto the
// brochure kit's new model fields through one adapter (brochure-map-facts.mjs); links are https only; season events
// outside the trip are left out; the swap points can be rebound (WP-11b at merge); an old plan renders the same HTML.
// Invented data only (brochure-map-sample-c11.mjs).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
// The old sample's HTML before WP-11d (letter and A4, no fonts): it must not move by a byte.
const OLD_SAMPLE_HTML = '2a069b42594cc33a6a8ba170c0f7064da6f2b4055c090189e548be0cc8539bd2';
const OLD_SAMPLE_HTML_A4 = 'b5982dfff56039266f3141b62adb2dc638b841aed1c776e6eb1eb80d3e740c85';
const load = async () => ({
  bm: await import('../packs/tour-guide/brochure-map/index.mjs'),
  facts: await import('../packs/tour-guide/brochure-map/brochure-map-facts.mjs'),
  kit: await import('../kits/brochure/index.mjs'),
  ...(await import('../packs/tour-guide/brochure-map/brochure-map-sample.mjs')),
  ...(await import('../packs/tour-guide/brochure-map/brochure-map-sample-c11.mjs'))
});

test('the C11 sample maps to a model that validates, renders without warnings and leaves the input untouched', async () => {
  const { bm, kit, sampleInputC11 } = await load();
  const input = sampleInputC11();
  const before = JSON.stringify(input);
  const model = bm.toBrochureModel(input);
  assert.equal(JSON.stringify(input), before, 'input is not mutated');
  assert.deepEqual(kit.validate(model), []);
  assert.deepEqual(kit.semanticErrors(model), []);
  const { html, warnings } = bm.renderPlan(sampleInputC11(), { embedFonts: false });
  assert.deepEqual(warnings, []);
  assert.doesNotMatch(html, /<script|http:\/\/insecure/i);
  for (const s of ['Start</span> · Harrowmere Central Station', 'Leave your bags at Quayside Rooms', 'This evening · sunset', 'Dinner</span> · Juniper Table', 'local favourite', 'The season', 'Founders Day']) assert.ok(html.includes(s), s);
});

test('each day field maps: start and end points, bags, sunset, extras, stop facts, dinner booking, reserved legs', async () => {
  const { bm, sampleInputC11 } = await load();
  const m = bm.toBrochureModel(sampleInputC11());
  const [d1, d2] = m.days;
  assert.equal(d1.start.name, 'Harrowmere Central Station');
  assert.equal(d1.start.time, '08:55');
  assert.equal(d1.start.note, 'Arriving on the early train from the coast.', 'the override note goes on the start');
  assert.match(d1.start.maps_url, /^https:\/\/www\.google\.com\/maps\/search\/.*query_place_id=FixtureStationCentral1/);
  assert.deepEqual(d1.bags, { kind: 'hotel', text: 'Leave your bags at Quayside Rooms', start: '09:15', end: '09:30', where: 'Quayside Rooms' });
  assert.equal(d1.sunset, '20:12');
  const [ev, saved] = d1.extras;
  assert.equal(ev.url, 'https://events.example.org/harrowmere/lanterns', 'an event extra links to its season event');
  assert.equal(ev.km, 0.6);
  assert.equal(saved.place, 'fennel-park', 'a saved extra keeps its place key');
  assert.deepEqual([d1.stops[0].last_entry, d1.stops[0].minutes_source, d1.stops[0].crowd_slot], ['16:30', 'official', 'opening']);
  assert.equal(d1.stops[0].booking_line, undefined, 'a booked stop carries no booking rule');
  assert.equal(d1.stops[1].minutes_source, 'research');
  const dinner = d1.meals.find((x) => x.kind === 'dinner');
  assert.deepEqual([dinner.place, dinner.booking], ['juniper-table', 'Book 2 days ahead by phone · 2 people or more']);
  assert.equal(d1.legs[0].from, 'day-start');
  assert.equal(d2.end.time, '17:30');
  assert.equal(d2.bags.kind, 'carry');
  assert.equal(d2.bags.start, undefined);
  assert.equal(d2.legs[d2.legs.length - 1].to, 'day-end');
  assert.equal(d2.sunset, '20:13', 'the model keeps the sunset; the kit hides it after the departure');
});

test('an unbooked stop with a booking rule in its facts gets the booking line', async () => {
  const { bm, sampleInputC11 } = await load();
  const input = sampleInputC11();
  delete input.plan.days[0].stops[0].booked;
  const slate = input.places.find((p) => p.id === 'slate-museum');
  delete slate.booking;
  const s0 = bm.toBrochureModel(input).days[0].stops[0];
  assert.equal(s0.booked, undefined);
  assert.equal(s0.booking_line, 'Book 1 day ahead online');
  assert.match(bm.renderPlan(input, { embedFonts: false }).html, /<p class="ti-meta ti-book">.*?Book 1 day ahead online<\/p>/);
});

test('place facts, flags and sources map; stale facts and menus are marked against options.now; http links are dropped', async () => {
  const { bm, sampleInputC11 } = await load();
  const m = bm.toBrochureModel(sampleInputC11());
  const slate = m.places['slate-museum'];
  assert.deepEqual(slate.facts, {
    checked: '2027-04-18', visit: 'about 90 min – 2.5 h', last_entry: '4:30 pm (30 min before closing) · closes 5:00 pm', closed: 'Mondays',
    booking: 'Book 1 day ahead online', price: '€14 adult · includes the splitting-shed demonstration', payment: 'Card only', gate: 'Quarry Gate, on Ropewalk',
    sources: [{ title: 'Slate Museum — hours and tickets', url: 'https://visit.example.org/harrowmere/slate-museum/hours', accessed: '2027-04-20' }]
  });
  assert.deepEqual(slate.flags, ['crowd_magnet']);
  assert.equal(m.places['copper-market'].facts.stale, true, 'checked 2026-12-01, more than 90 days before 2027-04-21');
  assert.deepEqual(m.places['copper-market'].flags, ['local_favourite']);
  const jt = m.places['juniper-table'].facts;
  assert.equal(jt.menu, 'Partly fits vegetarian — two meat-free courses on request');
  assert.deepEqual([jt.menu_fits, jt.menu_checked, jt.menu_stale], ['partly', '2027-03-01', true]);
  assert.deepEqual(jt.sources.map((s) => s.url), ['https://juniper-table.example.com/visit'], 'the http source is dropped');
  assert.equal(jt.stale, undefined);
  const supports = m.attribution.sources.filter((s) => s.supports === 'place facts' || s.supports === 'season').map((s) => s.url);
  assert.ok(supports.length === 5 && supports.every((u) => u.startsWith('https://')), JSON.stringify(supports));
});

test('without options.now nothing is marked stale; without a diet the menu line still reads', async () => {
  const { bm, sampleInputC11 } = await load();
  const input = sampleInputC11();
  input.options = { ...input.options, now: undefined, diet: undefined };
  input.plan.built_at = undefined; input.plan.built_on = undefined;
  const m = bm.toBrochureModel(input);
  assert.match(m.places['juniper-table'].facts.menu, /^Partly fits the diet — /);
  assert.equal(m.places['copper-market'].facts.stale, undefined);
  assert.equal(m.places['juniper-table'].facts.menu_stale, undefined);
});

test('the season keeps only events on the trip dates, https links, card places, and a bloom lead for those dates', async () => {
  const { bm, sampleInputC11 } = await load();
  const s = bm.toBrochureModel(sampleInputC11()).season;
  assert.deepEqual(s.events.map((e) => e.name), ['River lantern walk', 'Founders Day', 'Slate Museum late opening'], 'the spring fair (after the trip) is left out');
  const late = s.events[2];
  assert.equal(late.url, undefined, 'an http event link is dropped');
  assert.equal(late.place, 'slate-museum', 'the event keeps its place: it has a card');
  assert.deepEqual(s.sources.map((x) => x.url), ['https://weather.example.org/harrowmere/may', 'https://events.example.org/harrowmere/2027']);
  assert.equal(s.lead, 'Roses starting · Wisteria past their best.');
  assert.deepEqual(s.weather, { text: 'Mild days and cool evenings; showers pass quickly, so carry a light layer.', high_c: 21, low_c: 11, rain_days: 8 });
  const input = sampleInputC11(); delete input.trip.season.checked;
  assert.equal(bm.toBrochureModel(input).season, undefined, 'a season sheet without a checked date is skipped');
});

test('the formatter: visit length, closed days, booking rule, price, diet and last entry', async () => {
  const { facts: f } = await load();
  assert.equal(f.visitText({ min: 60, max: 90 }), 'about 60–90 min');
  assert.equal(f.visitText({ min: 45, max: 45 }), 'about 45 min');
  assert.equal(f.visitText({ min: 120, max: 180 }), 'about 2–3 h');
  assert.equal(f.visitText({ min: 90, max: 150 }), 'about 90 min – 2.5 h');
  assert.equal(f.visitText({ min: 90, max: 60 }), undefined);
  assert.equal(f.closedText([1]), 'Mondays');
  assert.equal(f.closedText([0, 6, 3]), 'Wednesdays, Saturdays and Sundays', 'Monday first');
  assert.equal(f.closedText([9, 'x']), undefined);
  assert.equal(f.bookingText({ required: true, lead: '2 days ahead', how: 'by phone', party_min: 2 }), 'Book 2 days ahead by phone · 2 people or more');
  assert.equal(f.bookingText({ required: false }), 'No booking needed');
  assert.equal(f.bookingText({ text: 'Walk-ins only' }), 'Walk-ins only');
  assert.equal(f.bookingText(null), undefined);
  assert.equal(f.priceText({ text: '€25 set lunch', includes: 'garden entry' }), '€25 set lunch · includes garden entry');
  assert.equal(f.priceText({ text: '€9', includes: 'with a drink' }), '€9 · with a drink');
  assert.equal(f.dietText(['vegetarian', 'no nuts', 'no shellfish']), 'vegetarian, no nuts and no shellfish');
  assert.equal(f.lastEntryText({ last_entry: '16:30', close: '17:00' }, 'en-US').replace(/\s/g, ' '), '4:30 pm · closes 5:00 pm');
  assert.equal(f.https('http://x.example.com'), undefined);
  assert.equal(f.https('javascript:alert(1)'), undefined);
  assert.equal(f.https('https://ok.example.com/a b'), undefined);
  assert.equal(f.https(' https://ok.example.com/a '), 'https://ok.example.com/a');
});

test('the swap points are bound to WP-11b\'s facts/ and season/, and the brochure shows their wording', async () => {
  const { bm, facts: f, sampleInputC11, C11_FACTS, c11Season } = await load();
  const factsMod = await import('../packs/tour-guide/facts/index.mjs');
  const seasonMod = await import('../packs/tour-guide/season/index.mjs');
  assert.equal(f.IMPL.factsLines, factsMod.factsLines);
  assert.equal(f.IMPL.menuLine, factsMod.menuLine);
  assert.equal(f.IMPL.factsStale, factsMod.factsStale);
  assert.equal(f.IMPL.eventsOn, seasonMod.eventsOn);
  assert.equal(f.IMPL.bloomOn, seasonMod.bloomOn);
  const m = bm.toBrochureModel(sampleInputC11());
  const sm = C11_FACTS['slate-museum'];
  assert.equal(m.places['slate-museum'].facts.booking, factsMod.factsLines(sm, {}).booking_line);
  const season = c11Season();
  const lead = seasonMod.bloomOn(season, '2027-05-13');
  assert.ok(lead && m.season.lead.startsWith(lead), 'the season lead opens with bloomOn\'s line');
  // Events: each trip date's eventsOn list in turn, each event once.
  const want = [...new Set(['2027-05-13', '2027-05-14'].flatMap((d) => seasonMod.eventsOn(season, d).map((e) => e.name)))];
  assert.deepEqual(m.season.events.map((e) => e.name), want);
});

test('the swap works: rebinding IMPL changes what the brochure shows, and only through the adapter', async () => {
  const { bm, facts: f, sampleInputC11 } = await load();
  const saved = { ...f.IMPL };
  try {
    f.IMPL.factsLines = () => ({ booking_line: 'Swapped booking line' });
    f.IMPL.menuLine = () => 'Menu checked 2 Apr 2027: fits vegetarian';
    f.IMPL.factsStale = () => ({ facts: true, menu: false });
    f.IMPL.eventsOn = (season, date) => (date === '2027-05-13' ? [{ id: 'swap', name: 'Swapped event', kind: 'market', from: date, to: date }] : []);
    f.IMPL.bloomOn = () => 'Autumn leaves at their peak';
    const m = bm.toBrochureModel(sampleInputC11());
    assert.equal(m.places['slate-museum'].facts.booking, 'Swapped booking line');
    assert.equal(m.places['slate-museum'].facts.stale, true);
    assert.equal(m.places['juniper-table'].facts.menu, 'Fits vegetarian');
    assert.equal(m.places['juniper-table'].facts.menu_stale, undefined);
    assert.deepEqual(m.season.events.map((e) => e.name), ['Swapped event']);
    assert.equal(m.season.lead, 'Autumn leaves at their peak.');
    f.IMPL.menuLine = () => 'Fits vegetarian (checked last spring)';
    const other = bm.toBrochureModel(sampleInputC11()).places['juniper-table'].facts;
    assert.equal(other.menu, 'Fits vegetarian (checked last spring)', 'a menu line in another shape is kept whole');
    assert.equal(other.menu_checked, undefined, 'and the separate date is left out so it is not said twice');
  } finally {
    Object.assign(f.IMPL, saved);
  }
  assert.equal(bm.toBrochureModel(sampleInputC11()).places['slate-museum'].facts.booking, 'Book 1 day ahead online');
});

test('red team at the adapter: hostile fact and season text renders inert; long lines are clipped', async () => {
  const { bm, sampleInputC11 } = await load();
  const X = '<script>alert(1)</script>';
  const input = sampleInputC11();
  const jt = input.places.find((p) => p.id === 'juniper-table');
  jt.facts.booking = { text: X + 'B'.repeat(400) };
  jt.facts.menu.note = X;
  jt.facts.sources.push({ url: 'javascript:alert(2)', title: X });
  input.trip.season.events[0].name = X + 'N'.repeat(300);
  input.trip.season.events[0].url = 'data:text/html,hi';
  input.trip.season.weather.text = X;
  const m = bm.toBrochureModel(input);
  assert.ok(m.places['juniper-table'].facts.booking.length <= 160);
  assert.ok(m.season.events[0].name.length <= 120);
  assert.equal(m.season.events[0].url, undefined);
  assert.equal(m.places['juniper-table'].facts.sources.length, 1);
  const { html, warnings } = bm.renderPlan(input, { embedFonts: false });
  assert.deepEqual(warnings, []);
  assert.doesNotMatch(html, /<script|javascript:|data:text/i);
  assert.ok(html.includes('&lt;script&gt;'));
});

test('an old plan renders the same HTML byte for byte and carries no C11 field', async () => {
  const { bm, sampleInput } = await load();
  const { usesC11 } = await import('../kits/brochure/lib/model.mjs');
  assert.equal(sha(bm.renderPlan(sampleInput(), { embedFonts: false }).html), OLD_SAMPLE_HTML);
  assert.equal(sha(bm.renderPlan(sampleInput(), { embedFonts: false, page: 'a4' }).html), OLD_SAMPLE_HTML_A4);
  const m = bm.toBrochureModel(sampleInput());
  assert.equal(usesC11(m), false);
  assert.equal(m.season, undefined);
});

// Developed by: LightAISolutions
