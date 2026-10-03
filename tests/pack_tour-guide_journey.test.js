'use strict';
// Tour Guide journey (Phase 11 wave 2, WP-11e) on the invented two-stays fixture: whole-journey outlines, the planner's
// `outline` input, versions of one day (each point pair asked once, the budget counted for the whole set before any
// request) and the one Plan for the chosen mix. Every DayPlan is checked with checkDayPlan, every Plan with the plan
// schema and checkPlan.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const loadAll = async () => ({
  fixtures: await import('../packs/tour-guide/fixtures/index.mjs'),
  maps: await import('../kits/maps/index.mjs'),
  planner: await import('../packs/tour-guide/planner/index.mjs'),
  journey: await import('../packs/tour-guide/journey/index.mjs'),
  schemas: await import('../packs/tour-guide/schemas/index.mjs'),
  checks: await import('../packs/tour-guide/schemas/tour-guide-checks.mjs'),
  geo: await import('../packs/tour-guide/planner/planner-geo.mjs'),
  time: await import('../packs/tour-guide/planner/planner-time.mjs')
});
const NOW = '2027-10-25T09:00:00Z';
const DATES = ['2027-11-08', '2027-11-09', '2027-11-10', '2027-11-11', '2027-11-12', '2027-11-13', '2027-11-14'];
const MOVING = ['2027-11-12', '2027-11-14'];
const LIMITS_ANCHORS = 3;   // an outline day holds at most three anchors

/** The fixture, a recording Maps client, the plan input and the default outline draft. */
function setup(L, { ceilings, mut } = {}) {
  const fx = L.fixtures.loadFixture('two-stays');
  if (mut) mut(fx);
  const transport = L.maps.createMockTransport(L.fixtures.createFixtureResponder(fx));
  const ledger = L.maps.createLedger(ceilings ? { ceilings } : {});
  const maps = L.maps.createMapsClient({ transport, ledger });
  const draft = L.journey.outlineDraft({ trip: fx.trip, places: fx.places, snapshots: fx.snapshots, dinners: fx.dinners, profile: fx.profile, build_id: 'outline-1' });
  return { fx, transport, ledger, maps, draft, input: { ...fx, maps, build_id: 'journey-1', now: NOW, seed: 7 } };
}

/** One key per point pair and travel mode (the body minus its points and clock). */
function pairKeys(req) {
  const u = new URL(req.url);
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  const { origins, destinations, origin, destination, departureTime, arrivalTime, ...mode } = body; // eslint-disable-line no-unused-vars
  const m = JSON.stringify(mode, Object.keys(mode).sort());
  if (u.pathname.endsWith(':computeRouteMatrix')) return origins.flatMap((o) => destinations.map((d) => `M ${JSON.stringify(o.waypoint)} ${JSON.stringify(d.waypoint)} ${m}`));
  if (u.pathname.endsWith(':computeRoutes')) return [`R ${JSON.stringify(origin)} ${JSON.stringify(destination)} ${JSON.stringify(mode)}`];
  return [`P ${u.pathname}`];
}

function soundPlan(L, plan) {
  assert.deepEqual(L.schemas.validate(plan, 'plan').errors, [], 'the plan schema accepts it');
  assert.deepEqual(L.checks.checkPlan(plan), [], 'checkPlan holds');
  for (const d of plan.days) assert.deepEqual(L.checks.checkDayPlan(d), [], `${d.date}: checkDayPlan holds`);
}

test('two-stays fixture: loads as a journey fixture, apart from the other lists, invented ids and example domains only', async () => {
  const L = await loadAll();
  assert.deepEqual([...L.fixtures.JOURNEY_FIXTURE_NAMES], ['two-stays']);
  assert.ok(!L.fixtures.listFixtures().includes('two-stays') && !L.fixtures.C11_FIXTURE_NAMES.includes('two-stays'));
  const fx = L.fixtures.loadFixture('two-stays');
  assert.equal(fx.trip.start_date, DATES[0]); assert.equal(fx.trip.end_date, DATES[DATES.length - 1]);
  assert.equal(fx.trip.lodging.length, 2, 'two stays');
  const text = JSON.stringify(fx);
  for (const id of text.match(/"place_id":"[^"]*"/g)) assert.match(id, /"place_id":"FixtureJy[A-Za-z]+"/);
  for (const url of text.match(/https?:\/\/[^"/]+/g)) assert.match(url, /\.example\.(com|org)$/, `${url} is an example domain`);
  assert.ok(!/@/.test(text), 'no e-mail addresses');
  for (const p of fx.places) assert.ok(fx.snapshots.some((s) => s.place_id === p.place_id), `${p.id} has a snapshot`);
});

test('outlineDraft: 2–3 options, each date once, moving days are travel, dated bookings anchored, checkOutline clean', async () => {
  const L = await loadAll();
  const { fx, draft } = setup(L);
  const o = draft.payload;
  assert.deepEqual(L.journey.checkOutline(o, fx.trip), []);
  assert.ok(o.options.length >= 2 && o.options.length <= 3);
  assert.deepEqual(o.options.map((x) => x.key), ['A', 'B', 'C'].slice(0, o.options.length));
  for (const opt of o.options) {
    assert.deepEqual(opt.days.map((d) => d.date), DATES, `${opt.key}: every date once, in order`);
    for (const date of MOVING) assert.equal(opt.days.find((d) => d.date === date).kind, 'travel', `${opt.key}: ${date} is a moving day`);
    const anchored = (date) => opt.days.find((d) => d.date === date).anchors.map((a) => a.slug);
    assert.ok(anchored('2027-11-13').includes('driftwood-kitchen'), `${opt.key}: the booked dinner is an anchor on its date`);
    assert.ok(anchored('2027-11-09').includes('harbour-aquarium'), `${opt.key}: the timed entry is an anchor on its date`);
    const all = opt.days.flatMap((d) => d.anchors.map((a) => a.slug));
    assert.equal(new Set(all).size, all.length, `${opt.key}: no place anchored twice`);
    for (const p of fx.places.filter((x) => x.status === 'chosen')) assert.ok(all.includes(p.id), `${opt.key}: the owner's pick ${p.id} is an anchor`);
    for (const d of opt.days) {
      if (d.kind === 'free') assert.equal(d.anchors.length, 0);
      assert.ok(d.area.length <= 60 && d.anchors.length <= 3 && (d.note === undefined || d.note.length <= 120));
    }
    assert.ok(opt.title.length <= 80 && opt.gains.length <= 200 && opt.gives_up.length <= 200);
    assert.ok(!/ in (around|day trip|in) /.test(opt.gains + ' ' + opt.gives_up), `${opt.key}: plain words — ${opt.gains} / ${opt.gives_up}`);
  }
});

test('outline areas: weekly closures and the season sheet\'s closures shut a place on its dates; a pick on a shut day moves', async () => {
  const L = await loadAll();
  const { fx } = setup(L);
  const cands = new Map(L.journey.journeyCandidates({ trip: fx.trip, places: fx.places, snapshots: fx.snapshots }).map((c) => [c.id, c]));
  assert.equal(cands.get('weavers-museum').open['2027-11-08'], false, 'shut on Mondays');
  assert.equal(cands.get('weavers-museum').open['2027-11-09'], true);
  const closure = fx.trip.season.events.find((e) => e.kind === 'closure');
  assert.equal(cands.get(closure.place).open[closure.date || closure.from], false, 'the season sheet\'s closure');
  const draft = L.journey.outlineDraft({ trip: fx.trip, places: fx.places.map((p) => (p.id === 'weavers-museum' ? { ...p, status: 'chosen' } : p)), snapshots: fx.snapshots, dinners: fx.dinners });
  for (const opt of draft.payload.options) {
    const at = opt.days.find((d) => d.anchors.some((a) => a.slug === 'weavers-museum'));
    assert.ok(at && at.date !== '2027-11-08', `${opt.key}: the picked museum is anchored on a day it is open`);
  }
});

test('outlineDraft: any two options differ on at least a third of the dates (kind or area)', async () => {
  const L = await loadAll();
  const { draft } = setup(L);
  const opts = draft.payload.options;
  const need = Math.ceil(DATES.length / 3);
  for (let i = 0; i < opts.length; i++) for (let j = i + 1; j < opts.length; j++) {
    const diff = DATES.filter((d, k) => opts[i].days[k].kind !== opts[j].days[k].kind || opts[i].days[k].area !== opts[j].days[k].area).length;
    assert.ok(diff >= need, `${opts[i].key} and ${opts[j].key} differ on ${diff} dates (need ${need})`);
  }
  assert.ok(new Set(opts.map((x) => x.title)).size === opts.length, 'each option has its own title');
});

test('outlineDraft: a trip with one shape that really differs comes as one outline that says why, and it plans', async () => {
  const L = await loadAll();
  const s = setup(L);
  assert.equal(s.draft.reason, undefined, 'a trip with real choices says nothing');
  // The owner kept fourteen sights near the two stays, none on the ridge and no day trip: every other style lands on
  // the same days.
  const picks = ['kestrel-hill-gardens', 'fernmoor-castle', 'weavers-museum', 'old-town-market', 'bellstone-temple', 'old-town-quarter', 'lantern-bridge',
    'harbour-aquarium', 'saltpan-lighthouse', 'harbourfront-park', 'moss-shrine', 'quillbay-maritime-museum', 'pier-market', 'seawall-promenade'];
  const choices = { picks, later: [], skip: [] };
  const draft = L.journey.outlineDraft({ trip: s.fx.trip, places: s.fx.places, snapshots: s.fx.snapshots, dinners: s.fx.dinners, profile: s.fx.profile, choices, build_id: 'outline-one' });
  const o = draft.payload;
  assert.deepEqual(o.options.map((x) => x.key), ['A'], 'one outline');
  assert.match(draft.reason, /^only one way to shape the trip: the other outlines differed on fewer than 3 of the 7 days$/);
  assert.deepEqual(L.journey.checkOutline(o, s.fx.trip), []);
  assert.deepEqual(L.schemas.validatePayload('outline', JSON.parse(JSON.stringify(o))).errors, [], 'the outline schema takes one option');
  assert.deepEqual(o.options[0].days.map((d) => d.date), DATES);
  const outline = L.journey.outlineInput(draft, { base: 'A' });
  assert.deepEqual(Object.keys(outline.by_date), DATES);
  const input = { ...s.input, choices };
  const cache = L.journey.cachedMaps(s.maps);
  const sets = {};
  for (const date of DATES) sets[date] = await L.journey.planVersions({ ...input, outline }, { date, count: 3, cache });
  for (const date of DATES) assert.deepEqual(L.journey.checkDayVersions(sets[date].payload), [], `${date}: a version set the core takes`);
  const { plan } = await L.journey.assembleChosen({ input, outline, choices: Object.fromEntries(DATES.map((d) => [d, { key: 'A', version: sets[d] }])) });
  soundPlan(L, plan);
  const stops = plan.days.flatMap((d) => d.stops.map((x) => x.place));
  assert.ok(stops.length > 0 && stops.every((p) => picks.includes(p)), `only the owner's picks are stops: ${stops}`);
});

test('outline anchors: a pick goes to a full day of its area first, a moving day takes one only when that day has no room, and an area no day visits gets the full day before the moving day\'s area', async () => {
  const L = await loadAll();
  const s = setup(L);
  const picks = ['kestrel-hill-gardens', 'upland-tea-fields', 'fernmoor-castle', 'weavers-museum', 'old-town-market', 'bellstone-temple', 'old-town-quarter', 'lantern-bridge',
    'harbour-aquarium', 'saltpan-lighthouse', 'harbourfront-park', 'moss-shrine', 'quillbay-maritime-museum', 'pier-market', 'seawall-promenade', 'cedar-ridge-temple'];
  const draftOf = (list, build_id) => L.journey.outlineDraft({ trip: s.fx.trip, places: s.fx.places, snapshots: s.fx.snapshots, dinners: s.fx.dinners, choices: { picks: list, later: [], skip: [] }, build_id });
  const many = draftOf(picks, 'outline-many');
  const ridge = ['cedar-ridge-temple', 'upland-tea-fields'];
  const fewer = draftOf(picks.filter((p) => !ridge.includes(p)), 'outline-fewer');
  const booked = new Set((s.fx.trip.bookings || []).map((b) => b.place));
  for (const opt of [...s.draft.payload.options, ...many.payload.options, ...fewer.payload.options]) {
    for (const d of opt.days.filter((x) => x.kind === 'travel')) {
      const picked = d.anchors.filter((a) => !booked.has(a.slug)).map((a) => a.slug);
      if (!picked.length) continue;
      for (const e of opt.days.filter((x) => x.area === d.area && (x.kind === 'full' || x.kind === 'light'))) assert.equal(e.anchors.length, LIMITS_ANCHORS, `${opt.key}: ${picked} on the moving day ${d.date} while ${e.date} has room`);
    }
  }
  const day = (draft, date) => draft.payload.options[0].days.find((d) => d.date === date);
  const slugs = (d) => d.anchors.map((a) => a.slug).sort();
  // The second stay has one full day. With two picks on the ridge, which no day visits, the full day goes there and
  // the arrival afternoon (already in the area by the lodging) holds that area's picks.
  assert.equal(day(many, '2027-11-13').area, 'around Cedar Ridge Temple', 'the full day goes to the area no day visits');
  assert.deepEqual(slugs(day(many, '2027-11-13')), ['cedar-ridge-temple', 'driftwood-kitchen', 'upland-tea-fields']);
  assert.deepEqual(slugs(day(many, '2027-11-12')), ['pier-market', 'quillbay-maritime-museum', 'seawall-promenade'], 'the arrival day holds the picks of its own area');
  assert.ok(many.payload.options.every((o) => !/Leaves out/.test(o.gives_up)), 'every pick has a day');
  // Without picks on the ridge, the area by the lodging keeps the full day: the booked dinner and two sights, and the
  // arrival day takes only the one that did not fit.
  assert.equal(day(fewer, '2027-11-13').area, 'around Quillbay Maritime Museum');
  assert.deepEqual(slugs(day(fewer, '2027-11-13')), ['driftwood-kitchen', 'pier-market', 'quillbay-maritime-museum'], 'the full day holds the booked dinner and two sights');
  assert.deepEqual(day(fewer, '2027-11-12').anchors.map((a) => a.slug), ['seawall-promenade'], 'the arrival day takes only the one that did not fit');
});

test('outlines: each option keeps every ✅ pick or names it first in its gives-up line (the same picks the planner leaves out), and a moving day goes to an area of picks no day visits', async () => {
  const L = await loadAll();
  const s = setup(L);
  const places = [...s.fx.places, ...s.fx.dinners];
  const left = async (draftPlaces, picks, dinners) => {
    const choices = { picks, later: [], skip: [] };
    const draft = L.journey.outlineDraft({ trip: s.fx.trip, places: draftPlaces, snapshots: s.fx.snapshots, dinners, profile: s.fx.profile, choices, build_id: 'outline-picks' });
    assert.deepEqual(L.journey.checkOutline(draft.payload, s.fx.trip), []);
    const out = [];
    for (const o of draft.payload.options) {
      const pools = await L.planner.outlinePools({ ...s.input, places: draftPlaces, dinners, choices, outline: L.journey.outlineInput(draft, { base: o.key }) });
      const dropped = pools.unplaced.filter((u) => picks.includes(u.cand.id)).map((u) => u.cand.name).sort();
      const m = /^Leaves out your picks? (.+?)\.(?: |$)/.exec(o.gives_up);
      const said = m ? m[1].split(/, | and /).sort() : [];
      assert.deepEqual(said, dropped, `${o.key}: "${o.gives_up}" names the picks the planner leaves out`);
      out.push({ key: o.key, said, days: o.days });
    }
    return out;
  };
  const sets = [
    ['kestrel-hill-gardens', 'upland-tea-fields', 'fernmoor-castle', 'weavers-museum', 'bellstone-temple', 'harbour-aquarium', 'hollin-falls', 'hollin-pottery-village',
      'quillbay-maritime-museum', 'cedar-ridge-temple', 'pier-market', 'old-town-quarter', 'ember-and-oak', 'salt-lantern', 'driftwood-kitchen'],
    ['hollin-falls', 'hollin-gorge-trail', 'hollin-pottery-village', 'harbour-aquarium', 'saltpan-lighthouse', 'netmenders-gallery', 'kestrel-hill-gardens', 'moss-shrine',
      'hilltop-observatory', 'cedar-ridge-temple', 'ridge-lookout', 'upland-tea-fields', 'seawall-promenade'],
    ['hollin-falls', 'cedar-ridge-temple', 'kestrel-hill-gardens']
  ];
  let named = 0;
  for (const picks of sets) {
    const opts = await left(places, picks, s.fx.dinners.filter((p) => picks.includes(p.id)));
    named += opts.reduce((t, o) => t + o.said.length, 0);
    assert.ok(opts.some((o) => !o.said.length), 'some option keeps every pick');
  }
  assert.ok(named > 0, 'an option without the day trip names the picks out there');
  // A sight booked by the second lodging holds its date there, so the arrival day, already in that area, goes to the
  // ridge, where two picks have no day: no option leaves them out.
  const booked = places.map((p) => (p.id === 'quillbay-maritime-museum' ? { ...p, booking: { date: '2027-11-13', time: '10:00' } } : p));
  const picks = ['kestrel-hill-gardens', 'fernmoor-castle', 'harbour-aquarium', 'quillbay-maritime-museum', 'cedar-ridge-temple', 'upland-tea-fields'];
  for (const o of await left(booked, picks, s.fx.dinners)) {
    assert.deepEqual(o.said, [], `${o.key}: no pick left out`);
    const day = (date) => o.days.find((d) => d.date === date);
    assert.equal(day('2027-11-13').area, 'around Quillbay Maritime Museum', `${o.key}: the booked day keeps its area`);
    assert.equal(day('2027-11-12').area, 'around Cedar Ridge Temple', `${o.key}: the arrival day goes to the ridge`);
    assert.deepEqual(day('2027-11-12').anchors.map((a) => a.slug).sort(), ['cedar-ridge-temple', 'upland-tea-fields']);
  }
});

test('outline: a meal place offered for dinner is an evening, not a sight; a booked one anchors its date', async () => {
  const L = await loadAll();
  const fx = L.fixtures.loadFixture('two-stays');
  // The routine's model: the shortlist pool holds the restaurants too, and the picked ones are the dinner pool.
  const places = [...fx.places, ...fx.dinners.map((d) => (d.id === 'pine-hearth' ? { ...d, booking: { date: '2027-11-12', time: '19:30' } } : { ...d }))];
  const picks = ['kestrel-hill-gardens', 'harbour-aquarium', 'old-town-quarter', 'quillbay-maritime-museum', 'ember-and-oak', 'pine-hearth', 'salt-lantern', 'driftwood-kitchen'];
  const dinners = places.filter((p) => p.category === 'restaurant' && picks.includes(p.id));
  const ids = (list) => list.map((c) => c.id);
  const cands = (pl, dn) => ids(L.journey.journeyCandidates({ trip: fx.trip, places: pl, snapshots: fx.snapshots, dinners: dn }));
  assert.ok(cands(places).includes('ember-and-oak'), 'without the dinner pool a restaurant is a candidate');
  assert.ok(!cands(places, dinners).some((id) => dinners.some((p) => p.id === id)), 'with it, no restaurant of the pool is');
  assert.ok(cands(places.map((p) => (p.id === 'salt-lantern' ? { ...p, activity: 'lunch' } : p)), dinners).includes('salt-lantern'), 'a lunch spot stays a daytime place, as in the planner');
  const draft = L.journey.outlineDraft({ trip: fx.trip, places, snapshots: fx.snapshots, dinners, choices: { picks, later: [], skip: [] }, build_id: 'outline-dinners' });
  assert.deepEqual(L.journey.checkOutline(draft.payload, fx.trip), []);
  for (const opt of draft.payload.options) {
    const at = (slug) => opt.days.filter((d) => d.anchors.some((a) => a.slug === slug)).map((d) => d.date);
    for (const id of ['ember-and-oak', 'salt-lantern']) assert.deepEqual(at(id), [], `${opt.key}: ${id} is no anchor`);
    assert.deepEqual(at('driftwood-kitchen'), ['2027-11-13'], `${opt.key}: the dinner booked on the trip is on its date`);
    assert.deepEqual(at('pine-hearth'), ['2027-11-12'], `${opt.key}: a dinner booked on the place is on its date`);
    assert.ok(!opt.days.some((d) => dinners.some((p) => d.area.includes(p.name))), `${opt.key}: no area is named after a restaurant`);
  }
});

test('checkOutline catches a moving day that is not travel, a missing booking anchor, a date twice, a free-day anchor and bounds', async () => {
  const L = await loadAll();
  const { fx, draft } = setup(L);
  const bad = (mut) => { const o = JSON.parse(JSON.stringify(draft.payload)); mut(o); return L.journey.checkOutline(o, fx.trip).map((x) => x.path + ' ' + x.message).join('\n'); };
  const day = (o, date, k = 0) => o.options[k].days.find((d) => d.date === date);
  assert.match(bad((o) => { day(o, '2027-11-12').kind = 'full'; }), /2027-11-12|travel/);
  assert.match(bad((o) => { const d = day(o, '2027-11-13'); d.anchors = d.anchors.filter((a) => a.slug !== 'driftwood-kitchen'); }), /driftwood-kitchen/);
  assert.match(bad((o) => { o.options[0].days[1] = { ...o.options[0].days[0] }; }), /date|order|once/);
  assert.match(bad((o) => { const d = day(o, '2027-11-10'); d.kind = 'free'; d.anchors = [{ slug: 'fernmoor-castle', name: 'Fernmoor Castle' }]; }), /free/);
  assert.match(bad((o) => { o.options[0].title = 'x'.repeat(81); }), /title/);
  assert.match(bad((o) => { o.options[0].gains = 'y'.repeat(201); }), /gains/);
  assert.match(bad((o) => { o.options = []; }), /options/);
  assert.match(bad((o) => { o.options[0].extra = 1; }), /unknown key/);
});

test('outlineInput: the base option with a per-date mix; a bad choice is refused', async () => {
  const L = await loadAll();
  const { draft } = setup(L);
  const [A, B] = draft.payload.options;
  const mixDate = DATES.find((d, k) => A.days[k].kind !== B.days[k].kind || A.days[k].area !== B.days[k].area);
  const out = L.journey.outlineInput(draft, { base: 'A', mix: { [mixDate]: 'B' } });
  assert.deepEqual(Object.keys(out.by_date), DATES);
  for (const [k, date] of DATES.entries()) assert.equal(out.by_date[date].kind, (date === mixDate ? B : A).days[k].kind);
  const all = Object.values(out.by_date).flatMap((d) => d.anchors || []);
  assert.equal(new Set(all).size, all.length, 'a mix never anchors one place on two dates');
  assert.throws(() => L.journey.outlineInput(draft, { base: 'Z' }), /base/);
  assert.throws(() => L.journey.outlineInput(draft, { base: 'A', mix: { '2027-12-01': 'B' } }), /not a trip date/);
  assert.throws(() => L.journey.outlineInput(draft, { base: 'A', mix: { [DATES[0]]: 'Q' } }), /does not exist/);
  assert.throws(() => L.journey.outlineInput(draft, { base: 'A', other: 1 }), /unknown key/);
});

test('normalizeOutline refuses a malformed outline with a planner: error', async () => {
  const L = await loadAll();
  const n = (raw) => () => L.planner.normalizeOutline(raw, DATES);
  assert.equal(L.planner.normalizeOutline(null, DATES), null);
  assert.throws(n({ by_date: {}, extra: 1 }), /planner: outline has unknown key/);
  assert.throws(n({ by_date: { '2027-12-01': { kind: 'full' } } }), /not a trip date/);
  assert.throws(n({ by_date: { [DATES[0]]: { kind: 'busy' } } }), /kind must be one of/);
  assert.throws(n({ by_date: { [DATES[0]]: { kind: 'free', anchors: ['moss-shrine'] } } }), /free day has no anchors/);
  assert.throws(n({ by_date: { [DATES[0]]: { kind: 'full', anchors: ['moss-shrine'] }, [DATES[1]]: { kind: 'full', anchors: ['moss-shrine'] } } }), /anchor on .* and/);
  assert.throws(n({ by_date: { [DATES[0]]: { kind: 'full', area: { name: 'x', lat: 1, lng: 2, radius_km: 500 } } } }), /radius_km/);
  assert.throws(n({ by_date: { [DATES[0]]: { kind: 'full', anchors: ['a', 'b', 'c', 'd'] } } }), /at most 3/);
});

const HAND_OUTLINE = {
  by_date: {
    '2027-11-08': { kind: 'full', area: { name: 'the hills', lat: 20.3307, lng: 135.2806, radius_km: 1.5 }, anchors: ['kestrel-hill-gardens'] },
    '2027-11-09': { kind: 'light', anchors: ['harbour-aquarium'] },
    '2027-11-10': { kind: 'full', area: { name: 'Old Town', lat: 20.3049, lng: 135.3026, radius_km: 1 } },
    '2027-11-11': { kind: 'rain_spare' },
    '2027-11-12': { kind: 'travel' },
    '2027-11-13': { kind: 'free' },
    '2027-11-14': { kind: 'travel' }
  }
};

test('planTrip with an outline: free day empty, light and rain-spare days small, areas and anchors kept, moving days intact', async () => {
  const L = await loadAll();
  const { fx, input } = setup(L);
  const plan = await L.planner.planTrip({ ...input, outline: HAND_OUTLINE });
  soundPlan(L, plan);
  const day = (date) => plan.days.find((d) => d.date === date);
  const loc = (slug) => { const p = fx.places.find((x) => x.id === slug); return fx.snapshots.find((s) => s.place_id === p.place_id).location; };
  assert.equal(day('2027-11-13').stops.length, 0, 'a free day has no stops');
  assert.ok(day('2027-11-13').free.some((f) => f.note === L.planner.FREE_DAY_NOTE));
  const light = day('2027-11-09').stops.map((s) => s.place);
  assert.ok(light.length <= L.planner.OUTLINE.LIGHT_STOPS && light.includes('harbour-aquarium'), `light day: ${light}`);
  assert.ok(day('2027-11-08').stops.some((s) => s.place === 'kestrel-hill-gardens'), 'the anchor is on its date');
  for (const date of ['2027-11-08', '2027-11-10']) {
    const area = HAND_OUTLINE.by_date[date].area;
    assert.ok(day(date).stops.length > 0, `${date} has stops`);
    for (const s of day(date).stops) assert.ok(L.geo.haversineKm(loc(s.place), area) <= area.radius_km, `${date}: ${s.place} inside ${area.name}`);
  }
  const rain = day('2027-11-11').stops;
  assert.ok(rain.length >= 1 && rain.length <= L.planner.OUTLINE.LIGHT_STOPS);
  for (const s of rain) { const p = fx.places.find((x) => x.id === s.place); assert.ok(L.planner.isIndoor(p) === true || L.planner.isCoveredSight(p), `${s.place} is covered`); }
  const arrive = fx.trip.day_overrides.find((o) => o.date === '2027-11-12'), leave = fx.trip.day_overrides.find((o) => o.date === '2027-11-14');
  assert.deepEqual(day('2027-11-12').start, { name: arrive.start.name, time: arrive.start.time });
  assert.equal(day('2027-11-12').bags.kind, 'hotel');
  assert.deepEqual(day('2027-11-14').end, { name: leave.end.name, time: leave.end.time });
  assert.equal(day('2027-11-14').bags.kind, 'carry');
  const swaps = new Set(plan.days.flatMap((d) => (d.rain_swaps || []).map((r) => r.place)));
  for (const s of rain) assert.ok(!swaps.has(s.place));
});

test('a place outside every area of the outline goes to Later with the outline as its reason, not a distance', async () => {
  const L = await loadAll();
  const { input } = setup(L);
  const near = (name, lat, lng) => ({ name, lat, lng, radius_km: 3 });
  const fern = near('near Fernmoor Lodge', 20.3, 135.3), quill = near('near Quillbay Inn', 20.6, 135.2);
  const by_date = Object.fromEntries(DATES.map((d) => [d, { kind: 'full', area: d < '2027-11-12' ? fern : quill }]));
  for (const d of MOVING) by_date[d].kind = 'travel';
  const plan = await L.planner.planTrip({ ...input, outline: { by_date } });
  soundPlan(L, plan);
  const items = plan.later.flatMap((l) => l.items);
  for (const slug of ['hollin-falls', 'hollin-gorge-trail', 'hollin-pottery-village']) {
    const it = items.find((x) => x.place === slug);
    assert.ok(it, `${slug} is in Later`);
    assert.equal(it.code, 'too_far');
    assert.match(it.reason, /lies outside the areas your outline gives the days near it$/);
    assert.ok(!plan.days.some((d) => d.stops.some((s) => s.place === slug)));
  }
});

test('a plan input without an outline (or with outline: null) plans byte for byte as before', async () => {
  const L = await loadAll();
  for (const name of ['two-stays', 'moving-day', 'transit-city']) {
    const run = async (extra) => {
      const fx = L.fixtures.loadFixture(name);
      const maps = L.maps.createMapsClient({ transport: L.maps.createMockTransport(L.fixtures.createFixtureResponder(fx)), ledger: L.maps.createLedger() });
      return JSON.stringify(await L.planner.planTrip({ ...fx, maps, build_id: 'same', now: '2027-09-01T09:00:00Z', seed: 7, ...extra }));
    };
    const base = await run({});
    assert.equal(await run({ outline: null }), base, `${name}: outline null`);
    assert.equal(await run({ outline: undefined }), base, `${name}: outline undefined`);
    assert.equal(await run({ outline: { by_date: {} } }), base, `${name}: an outline naming no date`);
  }
});

/** planVersions for every date under option A of the draft, one shared pair cache. */
async function allVersions(L, s, choice = { base: 'A' }) {
  const outline = L.journey.outlineInput(s.draft, choice);
  const cache = L.journey.cachedMaps(s.maps);
  const sets = {};
  for (const date of DATES) sets[date] = await L.journey.planVersions({ ...s.input, outline }, { date, count: 3, cache });
  return { outline, cache, sets };
}

test('planVersions: 2–3 versions on a day with room (one, with the reason, when the day has one way to go), place versions share at most half their other stops, a slower day after a busy one, payloads within bounds', async () => {
  const L = await loadAll();
  const s = setup(L);
  const { sets } = await allVersions(L, s);
  const multi = DATES.filter((d) => sets[d].versions.length >= 2);
  assert.ok(multi.length >= 2, `several days have versions: ${multi}`);
  assert.deepEqual(sets['2027-11-10'].versions.map((v) => !!v.pace), [false, true], 'the Old Town day: all that fits, then a slower day');
  assert.equal(sets['2027-11-11'].versions.length, 3, 'the rain-spare day has three versions');
  assert.match(sets['2027-11-10'].payload.versions[1].title, /^A slower day: /);
  const PACE = L.journey.PACE;
  for (const date of DATES) {
    const r = sets[date];
    for (const v of r.versions) {
      assert.equal(v.day.date, date);
      assert.deepEqual(L.checks.checkDayPlan(v.day), [], `${date} ${v.key}: checkDayPlan holds`);
      assert.deepEqual(L.schemas.validate(v.day, 'day-plan').errors, [], `${date} ${v.key}: the day-plan schema accepts it`);
      assert.equal(v.plan.days.length, 1);
      assert.deepEqual(L.schemas.validate(v.plan, 'plan').errors, [], `${date} ${v.key}: a one-day Plan the schema accepts`);
      assert.deepEqual(L.checks.checkPlan(v.plan), [], `${date} ${v.key}: checkPlan holds on it`);
      const o = s.fx.trip.day_overrides.find((x) => x.date === date);
      if (o && o.start) { assert.deepEqual(v.day.start, { name: o.start.name, time: o.start.time }); assert.equal(v.day.bags.kind, o.bags); }
      if (o && o.end) { assert.deepEqual(v.day.end, { name: o.end.name, time: o.end.time }); assert.equal(v.day.bags.kind, o.bags); }
    }
    // Place versions hold the anchors and are compared on their other stops; the slower day is A with less in it.
    const A = r.versions[0], aStops = A.day.stops.map((x) => x.place);
    const others = (v) => v.day.stops.map((x) => x.place).filter((x) => !r.anchors.includes(x));
    const placeVersions = r.versions.filter((v) => !v.pace);
    assert.ok(!A.pace && r.versions.slice(0, placeVersions.length).every((v) => !v.pace), `${date}: the slower day comes last`);
    for (let i = 0; i < placeVersions.length; i++) for (let j = i + 1; j < placeVersions.length; j++) {
      const a = others(placeVersions[i]), b = others(placeVersions[j]);
      const shared = a.filter((x) => b.includes(x)).length;
      assert.ok(2 * shared <= Math.min(a.length, b.length), `${date}: ${a} / ${b} share ${shared}`);
    }
    for (const v of placeVersions.slice(1)) assert.ok(others(v).length >= Math.ceil(others(A).length / 2), `${date} ${v.key}: no scrap of A's leftovers`);
    if (r.pool.every((id) => aStops.includes(id))) assert.equal(placeVersions.length, 1, `${date}: a day whose whole pool fits is one place version`);
    for (const v of r.versions.filter((x) => x.pace)) {
      const vs = v.day.stops.map((x) => x.place);
      assert.ok(A.day.spare_minutes < PACE.BUSY, `${date}: a slower day only after a busy one`);
      assert.ok(v.day.spare_minutes >= A.day.spare_minutes + PACE.GAIN, `${date}: the slower day frees at least ${PACE.GAIN} minutes`);
      assert.ok(vs.length >= 1 && vs.every((x) => aStops.includes(x)), `${date}: the slower day is A with less in it`);
      assert.ok(aStops.length - vs.length >= 1 && aStops.length - vs.length <= PACE.DROPS, `${date}: it drops one or two stops`);
      assert.ok(A.day.stops.filter((x) => x.booked).every((x) => vs.includes(x.place)), `${date}: it keeps every booking`);
    }
    const p = r.payload;
    assert.ok(p, `${date}: every date gets a payload`);
    assert.equal(p.versions.length, r.versions.length);
    if (r.versions.length === 1) assert.match(r.reason, /^(a free day: nothing to compare|only one way to plan this day)$/, `${date}: one version says why`);
    else assert.equal(r.reason, undefined);
    assert.deepEqual(L.journey.checkDayVersions(p), [], `${date}: checkDayVersions holds`);
    assert.equal(p.kind, 'day_versions'); assert.equal(p.date, date); assert.equal(p.trip, s.fx.trip.id);
    for (const v of p.versions) {
      assert.ok(v.title.length <= 80 && v.summary.length <= 160 && v.stops.length <= 12 && v.bookings.length <= 5 && v.leaves_out.length <= 10 && v.warnings.length <= 5);
      assert.ok(v.warnings.every((w) => w.length <= 160) && v.stops.every((x) => x.name.length <= 120));
      const day = r.versions.find((x) => x.key === v.key).day;
      assert.deepEqual(v.stops.map((x) => x.slug), day.stops.map((x) => x.place));
      assert.ok(v.leaves_out.every((x) => r.pool.includes(x.slug) && !day.stops.some((st) => st.place === x.slug)));
    }
  }
  const free = DATES.find((d) => s.draft.payload.options[0].days.find((x) => x.date === d).kind === 'free');
  if (free) assert.equal(sets[free].versions[0].day.stops.length, 0);
});

test('planVersions on picked days: only picks, a busy day of picks gets a slower day that drops the lowest-value picks and never a booking, and Later says where they went', async () => {
  const L = await loadAll();
  const fx = L.fixtures.loadFixture('two-stays');
  // The routine's model: the shortlist pool holds the restaurants too, and the picked ones are the dinner pool.
  const places = [...fx.places, ...fx.dinners];
  const picks = ['kestrel-hill-gardens', 'fernmoor-castle', 'weavers-museum', 'bellstone-temple', 'old-town-quarter', 'harbour-aquarium', 'saltpan-lighthouse',
    'netmenders-gallery', 'harbourfront-park', 'quillbay-maritime-museum', 'pier-market', 'ember-and-oak', 'driftwood-kitchen'];
  const choices = { picks, later: [], skip: [] };
  const dinners = places.filter((p) => p.category === 'restaurant' && picks.includes(p.id));
  const maps = L.maps.createMapsClient({ transport: L.maps.createMockTransport(L.fixtures.createFixtureResponder(fx)), ledger: L.maps.createLedger() });
  const draft = L.journey.outlineDraft({ trip: fx.trip, places, snapshots: fx.snapshots, dinners, choices, build_id: 'outline-picked' });
  const outline = L.journey.outlineInput(draft, { base: 'A' });
  const input = { trip: fx.trip, places, snapshots: fx.snapshots, estimates: fx.estimates, notes: fx.notes, profile: fx.profile, calibration: fx.calibration, dinners, choices, maps, build_id: 'picked-1', now: NOW, seed: 7 };
  const cache = L.journey.cachedMaps(maps);
  const sets = {};
  for (const date of DATES) sets[date] = await L.journey.planVersions({ ...input, outline }, { date, count: 3, cache });
  for (const date of DATES) {
    const r = sets[date];
    assert.ok(r.pool.every((id) => picks.includes(id)), `${date}: only picks are planned`);
    assert.deepEqual(L.journey.checkDayVersions(r.payload), [], `${date}: checkDayVersions holds`);
    assert.deepEqual(L.schemas.validatePayload('day_versions', JSON.parse(JSON.stringify(r.payload))).errors, [], `${date}: the schema accepts it`);
  }
  const without = (a, b) => a.day.stops.map((x) => x.place).filter((x) => !b.day.stops.some((y) => y.place === x));
  // The harbour day: the booked aquarium and three picks, busy; its slower day keeps the booking.
  const harbour = sets['2027-11-09'];
  assert.deepEqual(harbour.versions.map((v) => !!v.pace), [false, true], 'the harbour day: all four, then a slower day');
  const [full, slow] = harbour.versions;
  assert.ok(full.day.stops.some((x) => x.place === 'harbour-aquarium' && x.booked), 'the aquarium is booked');
  assert.ok(slow.day.stops.some((x) => x.place === 'harbour-aquarium'), 'the slower day keeps the booking');
  const dropped = without(full, slow);
  assert.ok(dropped.length >= 1 && dropped.length <= L.journey.PACE.DROPS);
  assert.deepEqual(slow.summary.leaves_out.slice(0, dropped.length).map((x) => x.slug).sort(), dropped.slice().sort(), 'its card names the picks it leaves out first');
  assert.match(slow.summary.title, /^A slower day: Harbour Aquarium/);
  // The Old Town day: four picks, three of them the outline's anchors; the slower day drops the lowest-priority one.
  const town = sets['2027-11-10'];
  assert.deepEqual(town.versions.map((v) => !!v.pace), [false, true]);
  assert.deepEqual(without(town.versions[0], town.versions[1]), ['old-town-quarter']);
  // A day of picks that fits with room to spare has nothing to compare.
  assert.equal(sets['2027-11-08'].versions.length, 1);
  assert.equal(sets['2027-11-08'].reason, 'only one way to plan this day');
  // Choosing the slower days: the picks they leave out are in Later, in the versions not chosen.
  const choose = Object.fromEntries(DATES.map((d) => [d, { key: sets[d].versions[sets[d].versions.length - 1].key, version: sets[d] }]));
  const { plan, alternatives } = await L.journey.assembleChosen({ input, outline, choices: choose });
  soundPlan(L, plan);
  const later = new Map(plan.later.flatMap((l) => l.items.map((it) => [it.place, it.reason])));
  for (const id of dropped) assert.match(later.get(id) || '', /another version of Tue 9 Nov that you did not choose/, `${id} is in Later`);
  assert.match(later.get('old-town-quarter') || '', /another version of Wed 10 Nov that you did not choose/);
  assert.deepEqual(alternatives['2027-11-09'].map((a) => a.key), ['A'], 'the full day stays as the alternative');
});

test('planVersions: a picked restaurant whose evening is a day in its own area gets it, a short ride out from the lodging; without an outline the 1.5 km rule stands', async () => {
  const L = await loadAll();
  const fx = L.fixtures.loadFixture('two-stays');
  const places = [...fx.places, ...fx.dinners];
  const picks = ['kestrel-hill-gardens', 'upland-tea-fields', 'fernmoor-castle', 'weavers-museum', 'bellstone-temple', 'harbour-aquarium', 'saltpan-lighthouse',
    'quillbay-maritime-museum', 'cedar-ridge-temple', 'pier-market', 'salt-lantern', 'driftwood-kitchen'];
  const choices = { picks, later: [], skip: [] };
  const dinners = places.filter((p) => p.category === 'restaurant' && picks.includes(p.id));
  const maps = L.maps.createMapsClient({ transport: L.maps.createMockTransport(L.fixtures.createFixtureResponder(fx)), ledger: L.maps.createLedger() });
  const draft = L.journey.outlineDraft({ trip: fx.trip, places, snapshots: fx.snapshots, dinners, choices, build_id: 'outline-dinner' });
  const outline = L.journey.outlineInput(draft, { base: 'A' });
  const input = { trip: fx.trip, places, snapshots: fx.snapshots, estimates: fx.estimates, notes: fx.notes, profile: fx.profile, calibration: fx.calibration, dinners, choices, maps, build_id: 'dinner-1', now: NOW, seed: 7 };
  const at = (id) => fx.snapshots.find((s) => s.place_id === places.find((p) => p.id === id).place_id).location;
  // Salt Lantern is in the harbour day's area: beyond 1.5 km of the lodging, within the 5 km of a ride back out.
  const km = L.geo.haversineKm(at('salt-lantern'), fx.trip.lodging.find((l) => l.id === 'fernmoor-lodge'));
  assert.ok(km > L.planner.DINNER.RADIUS_KM && km <= L.planner.DINNER.HOME_KM, `${km} km from the lodging`);
  assert.deepEqual((await L.planner.outlinePools({ ...input, outline })).dinners['2027-11-09'], ['salt-lantern'], 'its evening is the harbour day');
  const r = await L.journey.planVersions({ ...input, outline }, { date: '2027-11-09', count: 3 });
  const day = r.versions[0].day;
  assert.deepEqual(day.stops.map((s) => s.place), ['harbour-aquarium', 'saltpan-lighthouse']);
  assert.deepEqual([day.legs[2].from, day.legs[2].to], ['saltpan-lighthouse', 'lodging'], 'the sights end early, back at the lodging');
  const dinner = day.meals.find((m) => m.kind === 'dinner');
  assert.equal(dinner.at, 'salt-lantern');
  assert.deepEqual(day.legs.slice(-2).map((l) => [l.from, l.to]), [['lodging', 'salt-lantern'], ['salt-lantern', 'lodging']], 'out from the lodging and back');
  assert.ok(day.legs.at(-2).arrive_at <= dinner.start && day.legs.at(-1).depart_at >= dinner.end);
  assert.deepEqual(L.checks.checkDayPlan(day), []);
  assert.match(r.versions[0].summary.summary, /dinner at Salt Lantern$/);
  // The same day planned without an outline keeps dinner near the lodging: the plain rule is 1.5 km.
  const plain = await L.planner.planDates({ ...input, dinners: dinners.filter((d) => d.id === 'salt-lantern') }, ['2027-11-09'], { only: new Set(['harbour-aquarium', 'saltpan-lighthouse']) });
  assert.deepEqual(plain.days[0].stops.map((s) => s.place), ['harbour-aquarium', 'saltpan-lighthouse']);
  assert.equal(plain.days[0].meals.find((m) => m.kind === 'dinner').at, 'lodging');
});

test('planVersions: no place is fetched again and every point pair is asked once across all version sets', async () => {
  const L = await loadAll();
  const s = setup(L);
  const { cache, sets } = await allVersions(L, s);
  const calls = s.transport.calls;
  assert.ok(calls.length > 0 && calls.every((c) => typeof c.url === 'string'));
  assert.ok(!calls.some((c) => new URL(c.url).hostname === 'places.googleapis.com'), 'no Place Details call: the snapshots are input');
  const keys = calls.flatMap(pairKeys);
  const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
  assert.deepEqual(dup, [], 'each pair asked once');
  const st = cache.stats();
  assert.ok(st.pair_hits > 0 && st.route_hits > 0, 'later versions reuse earlier answers');
  const sent = Object.values(sets).reduce((t, r) => ({ m: t.m + r.usage.matrix_elements, r: t.r + r.usage.route_calls }), { m: 0, r: 0 });
  assert.equal(sent.m, st.matrix_units, 'the sets count exactly the matrix elements sent');
  assert.equal(sent.r, st.route_requests, 'and exactly the route requests sent');
  assert.equal(calls.length, st.matrix_requests + st.route_requests);
  for (const [date, r] of Object.entries(sets)) {
    assert.ok(r.usage.matrix_elements <= r.budget.skus['routes.route_matrix.essentials'], `${date}: the counted budget covers the matrix sent`);
    assert.ok(r.usage.route_calls <= r.budget.skus['routes.compute_routes.essentials'], `${date}: and the routes sent`);
  }
});

test('assembleChosen: one valid Plan for the chosen mix; Later holds what the chosen versions left out', async () => {
  const L = await loadAll();
  const s = setup(L);
  const { outline, sets } = await allVersions(L, s);
  const pick = (date) => sets[date].versions[sets[date].versions.length - 1].key;   // the last version of each day
  const choices = Object.fromEntries(DATES.map((d) => [d, { key: pick(d), version: sets[d] }]));
  const before = s.transport.calls.length;
  const { plan, alternatives, notes } = await L.journey.assembleChosen({ input: s.input, outline, choices });
  assert.equal(s.transport.calls.length, before, 'assembling sends nothing');
  soundPlan(L, plan);
  assert.equal(plan.build_id, s.input.build_id);
  assert.deepEqual(plan.days.map((d) => d.date), DATES);
  for (const date of DATES) {
    const chosen = sets[date].versions.find((v) => v.key === pick(date));
    assert.deepEqual(plan.days.find((d) => d.date === date).stops.map((x) => x.place), chosen.day.stops.map((x) => x.place), `${date}: the chosen stops`);
    const others = sets[date].versions.filter((v) => v !== chosen);
    assert.equal((alternatives[date] || []).length, others.length);
  }
  assert.deepEqual(notes, []);
  const items = new Map(plan.later.flatMap((l) => l.items.map((it) => [it.place, it])));
  const scheduled = new Set(plan.days.flatMap((d) => d.stops.map((x) => x.place)));
  for (const date of DATES) for (const slug of sets[date].pool) {
    if (scheduled.has(slug)) continue;
    assert.ok(items.has(slug), `${slug} (left out on ${date}) is in Later`);
    const inOther = sets[date].versions.some((v) => v.key !== pick(date) && v.day.stops.some((x) => x.place === slug));
    if (inOther) assert.match(items.get(slug).reason, new RegExp(`another version of ${L.time.dayDate(date)} that you did not choose`));
  }
  const dinnerDays = new Map();
  for (const d of plan.days) for (const m of d.meals) if (m.kind === 'dinner' && m.at && m.at !== 'lodging') {
    assert.ok(!dinnerDays.has(m.at), `${m.at} has dinner on one day only`); dinnerDays.set(m.at, d.date);
    assert.ok(!scheduled.has(m.at));
  }
  const total = Object.values(sets).reduce((t, r) => t + r.usage.matrix_elements, 0);
  assert.equal(plan.usage.matrix_elements, total, 'usage counts every request the version sets sent');
});

test('assembleChosen: a dinner place chosen for two evenings stays with the earlier date; a stop on two days is refused', async () => {
  const L = await loadAll();
  const s = setup(L);
  const { outline, sets } = await allVersions(L, s);
  const first = (date) => sets[date].versions[0];
  const dinnerOf = (d) => (d.meals.find((m) => m.kind === 'dinner' && m.at && m.at !== 'lodging') || {}).at;
  const [early, late] = ['2027-11-12', '2027-11-13'];
  const place = dinnerOf(first(early).day);
  assert.ok(place && dinnerOf(first(late).day) && dinnerOf(first(late).day) !== place, 'two evenings with their own dinners');
  const clash = JSON.parse(JSON.stringify(sets[late]));
  clash.versions[0].day.meals.find((m) => m.kind === 'dinner').at = place;   // the owner's mix gives both evenings one place
  const choices = Object.fromEntries(DATES.map((d) => [d, { key: 'A', version: d === late ? clash : sets[d] }]));
  const { plan, notes } = await L.journey.assembleChosen({ input: s.input, outline, choices });
  soundPlan(L, plan);
  const day = (date) => plan.days.find((d) => d.date === date);
  assert.equal(dinnerOf(day(early)), place, 'the earlier date keeps the place');
  assert.notEqual(dinnerOf(day(late)), place);
  assert.deepEqual(day(late).meals.filter((m) => m.kind === 'dinner'), first(late).undo.meals.filter((m) => m.kind === 'dinner'), 'the later evening goes back to its plan before dinner');
  assert.ok(day(late).warnings.some((w) => w.severity === 'info' && w.text.includes(early)));
  assert.equal(notes.length, 1);
  const twice = JSON.parse(JSON.stringify(sets['2027-11-10']));
  twice.versions[0].day.stops.push({ ...twice.versions[0].day.stops[0], place: first('2027-11-11').day.stops[0].place });
  const bad = Object.fromEntries(DATES.map((d) => [d, { key: 'A', version: d === '2027-11-10' ? twice : sets[d] }]));
  await assert.rejects(L.journey.assembleChosen({ input: s.input, outline, choices: bad }), /is a stop on .* and/);
  await assert.rejects(L.journey.assembleChosen({ input: s.input, outline, choices: { [DATES[0]]: choices[DATES[0]] } }), /no chosen version/);
});

test('every outline option, and a mix of two, plans and assembles into a valid Plan', async () => {
  const L = await loadAll();
  const probe = setup(L);
  const opts = probe.draft.payload.options;
  const choicesToTry = [...opts.map((o) => ({ base: o.key })), { base: 'A', mix: { '2027-11-08': 'B', '2027-11-09': 'B' } }];
  for (const choice of choicesToTry) {
    const s = setup(L);
    const { outline, sets } = await allVersions(L, s, choice);
    const choices = Object.fromEntries(DATES.map((d) => [d, { key: 'A', version: sets[d] }]));
    const { plan } = await L.journey.assembleChosen({ input: s.input, outline, choices });
    soundPlan(L, plan);
    for (const [date, o] of Object.entries(outline.by_date)) {
      const d = plan.days.find((x) => x.date === date);
      for (const a of o.anchors || []) assert.ok(d.stops.some((x) => x.place === a) || d.meals.some((m) => m.at === a), `${JSON.stringify(choice)}: ${a} is on ${date}`);
      if (o.kind === 'free') assert.equal(d.stops.length, 0);
    }
  }
});

test('planVersions: the budget guard counts the whole version set and refuses it before any request', async () => {
  const L = await loadAll();
  const SKU = 'routes.route_matrix.essentials', date = '2027-11-10';
  const probe = setup(L);
  const outline = L.journey.outlineInput(probe.draft, { base: 'A' });
  const P = await L.planner.outlinePools({ ...probe.input, outline });
  const one = L.planner.versionSetBudget({ day: P.days[date], pool: P.pools[date], capacity: P.capacity[date], count: 1, dinner: P.dinner }).skus[SKU];
  assert.ok(one > 0);
  const s = setup(L, { ceilings: { [SKU]: one } });   // room for one day, not for a set of versions
  await assert.rejects(L.journey.planVersions({ ...s.input, outline }, { date, count: 3 }),
    (e) => e instanceof L.planner.PlanBudgetError && e.code === 'PLAN_BUDGET' && e.budget.skus[SKU] >= 3 * one && !e.budget.within_ceiling);
  assert.equal(s.transport.calls.length, 0, 'nothing was sent');
  const single = await L.planner.planDates({ ...s.input, outline }, [date], { only: new Set(P.pools[date].map((c) => c.id)) });
  assert.equal(single.days[0].date, date, 'one plan of the same day fits under that ceiling');
  assert.ok(s.transport.calls.length > 0);
});

// Developed by: LightAISolutions
