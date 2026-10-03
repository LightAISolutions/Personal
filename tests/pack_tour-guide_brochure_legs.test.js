'use strict';
// Tour Guide Phase 10 (WP-10b) — the brochure reads the honest-leg fields (Contract C10): walks count as walks in the
// day stats and the at-a-glance footer, estimates are marked, a leg shows its flags, taxi time and buffer, a stop its
// "about" time and check-on-the-day line, a day its spare time; an older DayPlan without the fields renders as before.
// Invented places and fixtures only, no network.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const load = async () => ({
  fixtures: await import('../packs/tour-guide/fixtures/index.mjs'),
  maps: await import('../kits/maps/index.mjs'),
  planner: await import('../packs/tour-guide/planner/index.mjs'),
  bm: await import('../packs/tour-guide/brochure-map/index.mjs'),
  sample: await import('../packs/tour-guide/brochure-map/brochure-map-sample.mjs'),
  brochure: await import('../kits/brochure/index.mjs'),
  prep: await import('../kits/brochure/lib/model.mjs')
});
const NOW = '2027-09-01T09:00:00Z';
const OPTIONS = { generator: 'legs test', built_on: '2027-09-01', verified_on: '2027-09-01' };
const failWalk = (c) => ({ ...c, computeRoutes: async (o) => { if (o.travelMode === 'WALK') throw new Error('fixture: WALK request failed'); return c.computeRoutes(o); } });

async function planHill(L, wrap = (c) => c) {
  const fx = L.fixtures.loadFixture('hill-town');
  const maps = wrap(L.maps.createMapsClient({ transport: L.maps.createMockTransport(L.fixtures.createFixtureResponder(fx)), ledger: L.maps.createLedger() }));
  const plan = await L.planner.planTrip({ ...fx, maps, build_id: 'brochure-legs', now: NOW, seed: 7 });
  return { fx, plan };
}
const glanceFoot = (html) => [...html.matchAll(/<p class="gday-foot">([^<]*)/g)].map((m) => m[1]);

test('the brochure counts walks as walks: hill-town legs (no Google transit) go to "On foot", none to "Transit"', async () => {
  const L = await load();
  const { fx, plan } = await planHill(L);
  const model = L.bm.toBrochureModel({ ...fx, plan, options: OPTIONS });
  assert.deepEqual(L.brochure.validate(model), []);
  const prepared = L.prep.prepare(model);
  plan.days.forEach((d, i) => {
    const walked = d.legs.reduce((a, l) => a + l.minutes, 0);
    assert.equal(prepared.days[i].stats.walkMin, walked, `${d.date}: every walked minute is on foot`);
    assert.equal(prepared.days[i].stats.transitMin, 0, `${d.date}: nothing in transit`);
    assert.equal(prepared.days[i].stats.spareMin, d.spare_minutes, 'the spare time comes through');
  });
  const html = L.bm.renderPlan({ ...fx, plan, options: OPTIONS }).html;
  const foot = glanceFoot(html);
  assert.equal(foot.length, plan.days.length);
  assert.ok(foot.every((f) => / on foot/.test(f) && !/in transit/.test(f) && !/estimated/.test(f)), foot.join(' | '));
  assert.match(html, /<dt>Spare<\/dt>/);
  assert.match(html, /<span class="line leg-extra">[^<]*\+\d+ min spare<\/span>/, 'a leg shows its buffer');
  assert.match(html, /<span class="line leg-extra">[^<]*uphill · taxi about \d+ min/, 'an uphill walk offers a taxi time');
  assert.equal((html.match(/class="aside-block muted walk-beta">Walking routes from Google are in beta and may be missing sidewalks or footpaths\.</g) || []).length, plan.days.length, 'the notice Google requires, once on every walking day');
});

test('the brochure marks estimates: a failed WALK request leaves estimated walks, shown as estimates in the rail, the stats and the footer', async () => {
  const L = await load();
  const { fx, plan } = await planHill(L, failWalk);
  assert.ok(plan.days.every((d) => d.legs.every((l) => l.estimated && l.mode === 'WALK')));
  const model = L.bm.toBrochureModel({ ...fx, plan, options: OPTIONS });
  assert.deepEqual(L.brochure.validate(model), []);
  assert.ok(model.days.every((d) => d.legs.every((l) => l.estimated === true && l.mode === 'walk')), 'the mark survives the mapping');
  const html = L.bm.renderPlan({ ...fx, plan, options: OPTIONS }).html;
  assert.match(html, /<b>Walk<\/b> about \d+ min \(estimate\)/);
  assert.match(html, /<dt>On foot<\/dt><dd>[^<]+, some estimated<\/dd>/);
  assert.ok(glanceFoot(html).every((f) => /on foot, some estimated/.test(f)));
  assert.doesNotMatch(html, /walk-beta/, 'estimated walks are not Google routes: no notice');
});

test('a C10 day in the brochure: about times rounded to the quarter hour, check-on-the-day line, legs with flags, taxi and buffer, spare time', async () => {
  const L = await load();
  const input = L.sample.sampleInput();
  const d = input.plan.days[0];
  d.spare_minutes = 70;
  d.stops[0].time_style = 'about'; d.stops[0].check_on_day = 'Opening days vary — check before you go';
  d.stops[1].time_style = 'exact';
  d.legs[0] = { ...d.legs[0], mode: 'WALK', line: undefined, flags: ['uphill', 'footpath', 'uphill', 'bogus'], taxi_minutes: 11, buffer_minutes: 5 };
  d.legs[1] = { ...d.legs[1], estimated: true, estimate_basis: 'distance' };
  const model = L.bm.toBrochureModel(input);
  assert.deepEqual(L.brochure.validate(model), []);
  const md = model.days[0];
  assert.deepEqual([md.spare_minutes, md.stops[0].time_style, md.stops[0].check_on_day, md.stops[1].time_style], [70, 'about', 'Opening days vary — check before you go', 'exact']);
  assert.deepEqual([md.legs[0].mode, md.legs[0].flags, md.legs[0].taxi_minutes, md.legs[0].buffer_minutes], ['walk', ['uphill', 'footpath'], 11, 5], 'flags: known ones, no repeats');
  assert.equal(md.legs[1].estimated, true);
  const html = L.bm.renderPlan(input).html;
  const arrive = d.stops[0].arrive, q = Math.round((Number(arrive.slice(0, 2)) * 60 + Number(arrive.slice(3))) / 15) * 15;
  const hh = Math.floor(q / 60), mm = String(q % 60).padStart(2, '0');
  const clock = input.trip.locale && !/^en-(US|CA|AU|NZ|PH)$/i.test(input.trip.locale) ? `${String(hh).padStart(2, '0')}:${mm}` : `${hh % 12 || 12}:${mm}<small>${hh < 12 ? 'am' : 'pm'}</small>`;
  assert.ok(html.includes(`<div class="ti-time"><span class="t2">about</span><span class="t">${clock}</span></div>`), `about ${clock}`);
  assert.match(html, /<p class="ti-meta ti-check">.*Opening days vary — check before you go<\/p>/);
  assert.match(html, /<span class="line leg-extra">footpath · uphill · taxi about 11 min · \+5 min spare<\/span>/);
  assert.match(html, /<b>Transit<\/b> about 23 min \(estimate\)/);
  assert.match(html, /<dt>Spare<\/dt><dd>1 h 10 min<\/dd>/);
  assert.match(html, /<dt>Transit<\/dt><dd>[^<]+, some estimated<\/dd>/);
});

test('an older DayPlan without the C10 fields maps and renders exactly as before', async () => {
  const L = await load();
  const input = L.sample.sampleInput();
  const model = L.bm.toBrochureModel(input);
  for (const d of model.days) {
    assert.equal(d.spare_minutes, undefined);
    for (const s of d.stops) assert.deepEqual([s.time_style, s.check_on_day], [undefined, undefined]);
    for (const l of d.legs) assert.deepEqual([l.estimated, l.flags, l.taxi_minutes, l.buffer_minutes], [undefined, undefined, undefined, undefined]);
  }
  const html = L.bm.renderPlan(input).html;
  assert.doesNotMatch(html, /<dt>Spare<\/dt>|leg-extra|ti-check|\(estimate\)|some estimated|class="t2">about</);
  assert.match(html, /<b>Transit<\/b> 23 min, 5\.2 km/, 'a leg reads as it did');
});

test('unit: roundQuarter, legExtras and estMark', async () => {
  const day = await import('../kits/brochure/lib/sections/day.mjs');
  assert.deepEqual([705, 707, 712, 713, 720].map(day.roundQuarter), [705, 705, 705, 720, 720]);
  assert.equal(day.legExtras({ flags: ['downhill', 'trail'], taxi_minutes: 0, buffer_minutes: 0 }), 'trail · downhill');
  assert.equal(day.legExtras({}), '');
  assert.equal(day.estMark('50 min', true), '50 min, some estimated');
  assert.equal(day.estMark('', true), '');
});

// Developed by: LightAISolutions
