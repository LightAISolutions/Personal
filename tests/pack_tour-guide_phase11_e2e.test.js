'use strict';
// Tour Guide pack — Phase 11 end to end (coordinator). The invented moving-day trip (packs/tour-guide/fixtures/moving-day:
// a slow first morning, a day that starts at a station with the bags going to the hotel, a day that ends at a station, a
// dinner pool, a season sheet and places with researched facts) goes through the planner (WP-11a) and passes the plan
// checks; the same plan renders as a brochure (WP-11d) with the start and end points, the bag step, dinner, sunset, the
// evening extras, the facts and the season page; and the same plan as a C11 plan_digest in two parts goes through the
// mailbox (WP-11c): staged, then stored once exactly as one envelope would be, and back out as the day card and the app's
// trip.digest. Both validators take a day of 30 legs and refuse 31.
// Invented data only ("Brindlecombe" and "Ashvale" in the "Fictional Isles", October 2027).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');

const NOW = '2027-10-01T09:00:00Z';
const DIET = 'vegetarian';
const J = (v) => JSON.parse(JSON.stringify(v));
const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''));

let cached = null;
/** The moving-day fixture planned once (Maps answered from the fixture); one place carries the C11 local_favourite flag. */
async function planned() {
  if (!cached) {
    const fixtures = await import('../packs/tour-guide/fixtures/index.mjs');
    const maps = await import('../kits/maps/index.mjs');
    const planner = await import('../packs/tour-guide/planner/index.mjs');
    const fx = fixtures.loadFixture('moving-day');
    fx.places = fx.places.map((p) => (p.id === 'mistral-shrine' ? { ...p, flags: ['local_favourite'] } : p));
    const client = maps.createMapsClient({ transport: maps.createMockTransport(fixtures.createFixtureResponder(fx)), ledger: maps.createLedger() });
    const plan = await planner.planTrip({ ...fx, maps: client, build_id: 'build-md-e2e', now: NOW, seed: 7 });
    cached = { fx, plan };
  }
  return J(cached);
}
const dinnerOf = (d) => (d.meals || []).find((m) => m.kind === 'dinner') || null;

/* ---------------- the planner (WP-11a) and the plan checks ---------------- */
test('the planner plans the moving days with the C11 fields, and the plan passes the checks', async () => {
  const schemas = await import('../packs/tour-guide/schemas/index.mjs');
  const { plan } = await planned();
  assert.deepEqual(schemas.validate(plan, 'plan').errors, []);
  assert.deepEqual(plan.days.map((d) => d.date), ['2027-10-18', '2027-10-19', '2027-10-20']);
  const [d1, d2, d3] = plan.days;

  // A plain day from the lodging and back; the slow first morning holds everything until 10:00.
  assert.equal(d1.start, undefined);
  assert.equal(d1.end, undefined);
  assert.equal(d1.legs[0].from, 'lodging');
  assert.ok(d1.legs[0].depart_at >= '10:00', 'the per-day start time holds');
  // Facts: the temple's own last entry and visit length; its own closing time wins over Google's, with a warning.
  const temple = d1.stops.find((s) => s.place === 'ninefold-temple');
  assert.deepEqual([temple.last_entry, temple.minutes_source], ['15:30', 'official']);
  assert.ok(temple.minutes >= 45 && temple.minutes <= 60, 'the visit length comes from its own site');
  assert.ok(d1.warnings.some((w) => w.place === 'ninefold-temple' && /own site says it closes at 16:00; Google says 17:00/.test(w.text)));
  // Crowd timing: the crowd magnet goes late, because the profile asks to avoid crowds.
  assert.equal(d1.stops.find((s) => s.place === 'copperleaf-garden').crowd_slot, 'late');
  // Dinner from the pool: near, fitting the diet (the grill that does not fit is never picked), with its booking rule.
  assert.deepEqual([dinnerOf(d1).at, dinnerOf(d1).booking], ['juniper-table', 'Walk-ins welcome; book for 6 or more']);
  assert.ok(plan.days.every((d) => (dinnerOf(d) || {}).at !== 'quayside-grill'));
  assert.deepEqual(d1.legs.slice(-2).map((l) => [l.from, l.to]), [['lodging', 'juniper-table'], ['juniper-table', 'lodging']]);
  // Evening extras: the light-up running that evening at the garden; the far fireworks are left out.
  assert.deepEqual(d1.extras.map((x) => [x.kind, x.name, x.time]), [['event', 'Copperleaf Garden evening light-up', '18:00']]);
  assert.ok(plan.days.every((d) => (d.extras || []).every((x) => !/Far Cape/.test(x.name))));
  assert.ok(plan.days.every((d) => /^1[78]:[0-5]\d$/.test(d.sunset)), 'an autumn sunset on each day');
  // Its own site closes the craft museum on Mondays (Google says open): no Monday rainy-day idea, and the Later list
  // says it is closed on the day the trip is near it, not that it is 36 km from the lodging of the days it is open.
  assert.ok(!(d1.rain_swaps || []).some((r) => r.place === 'saltmarsh-craft-museum'));
  const museum = plan.later.flatMap((l) => l.items).find((it) => it.place === 'saltmarsh-craft-museum');
  assert.deepEqual([museum.code, museum.reason], ['closed_day', 'Saltmarsh Craft Museum is closed on 2027-10-18, the day you are near it']);

  // The station start: the walk to the hotel with the bags first, then the sights.
  assert.deepEqual(d2.start, { name: 'Ashvale Station', time: '12:10' });
  assert.deepEqual([d2.legs[0].from, d2.legs[0].to, d2.legs[0].depart_at], ['day-start', 'lodging', '12:10']);
  assert.equal(d2.bags.kind, 'hotel');
  assert.match(d2.bags.text, /^Leave your bags at Ashvale Lantern Hotel/);
  assert.ok(d2.stops[0].arrive > d2.bags.end, 'the sights start after the bags are left');
  assert.equal(dinnerOf(d2).at, 'hearth-and-barley');
  assert.deepEqual(d2.extras.map((x) => [x.kind, x.name]), [['event', 'Ashvale harvest fair'], ['saved', "Glassblowers' Yard"]]);
  assert.deepEqual([d2.lodging_start, d2.lodging_end], ['brindle-quay-inn', 'ashvale-lantern-hotel']);

  // The station end: carry the bags, the last leg to the station, in time for the train, and no dinner out after it.
  assert.deepEqual(d3.end, { name: 'Ashvale Station', time: '17:00' });
  assert.equal(d3.legs.at(-1).to, 'day-end');
  assert.ok(d3.legs.at(-1).arrive_at <= '17:00');
  assert.equal(d3.bags.kind, 'carry');
  assert.equal(dinnerOf(d3), null);
  // The plan names each dinner place among its places: the brochure and the digest need them.
  assert.ok(['juniper-table', 'hearth-and-barley'].every((id) => plan.places.some((p) => p.id === id)));
});

/* ---------------- the brochure (WP-11d, bound to facts/ and season/ from WP-11b) ---------------- */
test('the same plan renders as a brochure: start and end points, the bag step, dinner, sunset, extras, facts and the season', async () => {
  const bm = await import('../packs/tour-guide/brochure-map/index.mjs');
  const kit = await import('../kits/brochure/index.mjs');
  const { fx, plan } = await planned();
  const args = () => ({ trip: J(fx.trip), plan: J(plan), notes: fx.notes, snapshots: fx.snapshots, estimates: fx.estimates, options: { now: NOW, diet: DIET } });
  const m = bm.toBrochureModel(args());
  assert.deepEqual(kit.validate(m), []);
  assert.deepEqual(kit.semanticErrors(m), []);
  const [b1, b2, b3] = m.days;
  assert.equal(b2.start.name, 'Ashvale Station');
  assert.match(b2.start.maps_url, /^https:\/\/www\.google\.com\/maps\/.*query_place_id=FixtureMdAshvaleStation/);
  assert.equal(b2.start.note, 'Morning train from Brindlecombe.', "the day's own note rides on its start");
  assert.deepEqual([b2.legs[0].from, b2.legs[0].to], ['day-start', 'lodging'], 'the station leg keeps its start point');
  assert.equal(b2.bags.kind, 'hotel');
  assert.deepEqual([b3.end.name, b3.legs.at(-1).to, b3.bags.kind], ['Ashvale Station', 'day-end', 'carry']);
  const din = b1.meals.find((x) => x.kind === 'dinner');
  assert.deepEqual([din.place, din.booking], ['juniper-table', 'Walk-ins welcome; book for 6 or more']);
  assert.ok(b1.legs.some((l) => l.to === 'juniper-table'), 'the walk to dinner is on the day');
  assert.deepEqual([m.places['juniper-table'].facts.menu_fits, m.places['juniper-table'].facts.menu], ['yes', 'Fits vegetarian — Vegetarian set menu']);
  assert.deepEqual([b1.stops[0].place, b1.stops[0].last_entry, b1.stops[0].minutes_source], ['ninefold-temple', '15:30', 'official']);
  assert.equal(b1.stops.find((s) => s.place === 'copperleaf-garden').crowd_slot, 'late');
  assert.deepEqual(b1.extras.map((x) => x.name), ['Copperleaf Garden evening light-up']);
  assert.deepEqual(m.days.map((d) => d.sunset), plan.days.map((d) => d.sunset));
  assert.equal(m.season.weather.text, 'Mild days, cool evenings.');
  assert.ok(!m.season.events.some((e) => e.name === 'Gallery rehang'), 'a closure before the trip is left out');
  const { html, warnings } = bm.renderPlan(args(), { embedFonts: false });
  assert.deepEqual(warnings, []);
  for (const s of ['Start</span> · Ashvale Station', 'Leave your bags at Ashvale Lantern Hotel', 'Carry your bags today', 'Dinner</span> · Juniper Table',
    'Dinner</span> · Hearth and Barley', 'This evening · sunset', 'The season', 'Mild days, cool evenings.', 'local favourite', 'Walk-ins welcome']) assert.ok(html.includes(s), s);
  assert.doesNotMatch(html, /<script|href="http:/i);
});

/* ---------------- the digest in parts, through the core (WP-11c) ---------------- */
const TRIP = 'ashvale-moving-2027';
const keep = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null));
/**
 * A test-only stand-in for the private repo's plan_digest builder, with the C11 mapping WP-11g ports there: our names, the
 * plan's own times, Maps links from place ids, the facts lines from facts/, and day-start / day-end kept as leg ends.
 */
async function digestOf(plan, trip) {
  const { factsLines } = await import('../packs/tour-guide/facts/index.mjs');
  const byId = new Map(plan.places.map((p) => [p.id, p]));
  const name = (id) => (byId.get(id) || {}).name || id;
  const link = (placeId) => 'https://www.google.com/maps/place/?q=place_id:' + encodeURIComponent(placeId);
  const overrides = new Map((trip.day_overrides || []).map((o) => [o.date, o]));
  const anchor = (a, o) => (a ? keep({ name: a.name, time: a.time, maps_url: o && o.place_id ? link(o.place_id) : undefined }) : undefined);
  const days = plan.days.map((d) => {
    const o = overrides.get(d.date) || {};
    const dn = (d.meals || []).find((x) => x.kind === 'dinner' && byId.has(x.at));
    const note = dn ? String(dn.note || '').replace(name(dn.at), '').replace(/^\s*·\s*/, '') : '';
    return keep({
      date: d.date, theme: d.theme, spare_minutes: d.spare_minutes, sunset: d.sunset,
      start: anchor(d.start, o.start), end: anchor(d.end, o.end), bags: d.bags ? d.bags.text : undefined,
      dinner: dn ? keep({ name: name(dn.at), slug: dn.at, start: dn.start, end: dn.end, maps_url: link(byId.get(dn.at).place_id),
        note_line: note ? note[0].toUpperCase() + note.slice(1) : undefined, booking_line: dn.booking }) : undefined,
      extras: d.extras ? d.extras.map((x) => keep({ kind: x.kind, name: x.name, time: x.time, note_line: x.note,
        maps_url: x.kind === 'saved' && byId.has(x.ref) ? link(byId.get(x.ref).place_id) : undefined })) : undefined,
      stops: d.stops.map((s, i) => keep({ n: i + 1, slug: s.place, name: name(s.place), arrive: s.arrive, depart: s.depart, minutes: s.minutes,
        maps_url: link(s.place_id), note_line: '', time_style: s.time_style, last_entry: s.last_entry, minutes_source: s.minutes_source,
        crowd_slot: s.crowd_slot, ...factsLines((byId.get(s.place) || {}).facts, { now: NOW, diet: DIET }) })),
      legs: d.legs.slice(0, 30).map((l) => keep({ from: l.from, to: l.to, mode: l.mode, minutes: l.minutes, maps_url: l.maps_url,
        estimated: l.estimated === true ? true : undefined, distance_m: l.distance_m, flags: l.flags, taxi_minutes: l.taxi_minutes, buffer_minutes: l.buffer_minutes })),
      warnings: d.warnings.map((w) => w.text),
      rain: (d.rain_swaps || []).length ? d.rain_swaps.slice(0, 2).map((r) => ({ slug: r.place, name: name(r.place), instead_of: name(r.instead_of), km: r.km, maps_url: link(r.place_id) })) : undefined
    });
  });
  const later = [], seen = new Set();
  for (const l of plan.later || []) for (const it of l.items || []) if (!seen.has(it.place)) { seen.add(it.place); later.push({ slug: it.place, name: name(it.place), reason: it.reason }); }
  return { v: 1, kind: 'plan_digest', trip: plan.trip_id, build_id: plan.build_id, tz: trip.timezone, verified_on: plan.days[0].verified_on,
    days, later, drive: { plan: 'fixtureDrivePlanFile01', brochure_html: null, brochure_pdf: null } };
}
/** The digest in two parts of consecutive days; only part 1 carries the Later list. */
const inParts = (dg) => [{ ...dg, part: 1, parts: 2, days: dg.days.slice(0, 2) }, { ...dg, part: 2, parts: 2, days: dg.days.slice(2), later: [] }];

function core() {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: NOW });
  H.bootstrap(ctx, state);
  ['RESEARCH', 'PLAN', 'PREFS', 'NOTES', 'BROCHURE', 'PLACES'].forEach((n) => H.configureRoutine(ctx, state, n));
  ctx.tgTripUpsert({ slug: TRIP, title: 'Two towns', destination: 'Brindlecombe and Ashvale' });
  return { ctx, state };
}
const say = (ctx, state, text) => ctx.doPost(H.postEvent('tg', { k: state.props[ctx.PROP.WEBHOOK_SECRET] }, H.tgUpdate({ text })));
const texts = (state) => state.fetch.telegram('sendMessage').map((r) => r.json.text);
const staged = (ctx) => (ctx.tgPartsHasTab() ? J(ctx.storeAll('DigestParts')) : []);
function deliver(ctx, state, type, payload) {
  H.putEnvelope(state, H.envelope(type, payload));
  return J(ctx.pollFromBrain());
}
function gasErrors(ctx, type, payload) {
  const raw = JSON.stringify(H.envelope(type, payload));
  return J(ctx.validateEnvelope(raw, Buffer.byteLength(raw))).errors || [];
}

test('the same plan as a C11 digest in two parts passes both validators, waits for its last part, then stores what one envelope would', async () => {
  const schemas = await import('../packs/tour-guide/schemas/index.mjs');
  const { fx, plan } = await planned();
  const dg = await digestOf(plan, fx.trip);
  const parts = inParts(dg);
  const one = core();
  for (const p of [dg, ...parts]) {
    assert.deepEqual(schemas.validatePayload('plan_digest', p).errors, [], 'node, part ' + (p.part || 'none'));
    assert.deepEqual(gasErrors(one.ctx, 'plan_digest', p), [], 'core, part ' + (p.part || 'none'));
  }
  assert.equal(deliver(one.ctx, one.state, 'plan_digest', dg).processed, 1);
  const whole = J(one.ctx.tgDigestDays(TRIP));
  assert.equal(whole.length, 3);

  const { ctx, state } = core();
  assert.equal(deliver(ctx, state, 'plan_digest', parts[0]).processed, 1);
  assert.deepEqual(texts(state), [], 'nothing is sent while a part is missing');
  assert.deepEqual(J(ctx.tgDigestDays(TRIP)), [], 'and nothing is stored');
  assert.deepEqual(staged(ctx).map((r) => [r.trip, r.build_id, r.part, r.parts]), [[TRIP, 'build-md-e2e', 1, 2]]);
  assert.equal(deliver(ctx, state, 'plan_digest', parts[1]).processed, 1);
  assert.deepEqual(staged(ctx), [], 'the staged part is cleared');
  assert.deepEqual(J(ctx.tgDigestDays(TRIP)), whole, 'stored exactly as one envelope');
  assert.deepEqual(texts(state), texts(one.state), 'and announced once, the same way');
  assert.match(texts(state)[0], /🔖 <b>Later<\/b>\n• Saltmarsh Craft Museum — <i>Saltmarsh Craft Museum is closed on 2027-10-18, the day you are near it<\/i>/);

  // The C11 fields arrive as sent: the station start, the bag step, dinner, extras and sunset; the end; day-start and
  // day-end stay leg ends; the stop facts.
  const [s1, s2, s3] = whole;
  for (const k of ['sunset', 'start', 'bags', 'dinner', 'extras']) assert.deepEqual(s2[k], dg.days[1][k], k);
  assert.deepEqual(s3.end, dg.days[2].end);
  assert.deepEqual([s2.legs[0].from, s3.legs.at(-1).to], ['day-start', 'day-end']);
  assert.deepEqual([s1.stops[0].last_entry, s1.stops[0].minutes_source, s1.stops[0].facts_line],
    ['15:30', 'official', 'Last entry 15:30 · closes 16:00 · about 45–60 min · official site']);
  assert.equal(s1.stops[1].crowd_slot, 'late');
});

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A leg line on the day card; `tail` is what follows the link (by default nothing, or " · " and its details). */
const walk = (leg, tail = '(?: · .*)?') => new RegExp('^   <i>↳ <a>walk ' + leg.minutes + ' min</a>' + tail + '</i>$');
const stopLine = (n, name) => new RegExp('^<b>' + n + '\\.</b> about \\d\\d:\\d\\d <a>' + esc(name) + '</a>');
function expectLines(lines, from, want, label) {
  want.forEach((re, k) => assert.match(String(lines[from + k]), re, label + ', line ' + (from + k)));
}

test('the stored days come back as the day card, each walk before what it leads to, and in the app\'s trip.digest', async () => {
  const { fx, plan } = await planned();
  const dg = await digestOf(plan, fx.trip);
  const { ctx, state } = core();
  for (const p of inParts(dg)) assert.equal(deliver(ctx, state, 'plan_digest', p).processed, 1);
  ctx.settingSet(ctx.TG_SETTINGS.CURRENT_TRIP, TRIP, 'test');
  const card = (n) => { const b = texts(state).length; say(ctx, state, '/day ' + n); return texts(state).slice(b).join('\n').replace(/<a href="[^"]*">/g, '<a>').split('\n'); };
  const [d1, d2, d3] = dg.days;

  // A plain day: out from the lodging, the temple's own last entry, the quiet late slot, back, out to dinner and back.
  const c1 = card(1);
  expectLines(c1, 0, [/^<b>Day 1 of 3 · Mon 18 Oct<\/b> — Temple · Garden$/, walk(d1.legs[0]),
    /^<b>1\.<\/b> about \d\d:\d\d <a>Ninefold Temple<\/a> · \d+ min · last entry 15:30$/, walk(d1.legs[1]), stopLine(2, 'Copperleaf Garden'),
    /^   👥 <i>Late is quieter<\/i>$/, walk(d1.legs[2], ' back to your lodging'), walk(d1.legs[3]),
    new RegExp('^🍽 ' + d1.dinner.start + ' Dinner at <a>Juniper Table</a>$'), /^   🎟 <i>Walk-ins welcome; book for 6 or more<\/i>$/,
    walk(d1.legs[4], ' back to your lodging'), /^Spare time: /, /^<b>If you have energy<\/b>$/, /^✨ 18:00 Copperleaf Garden evening light-up$/,
    /^   <i>Separate evening ticket\.<\/i>$/, new RegExp('^🌅 Sunset ' + d1.sunset + '$')], 'day 1');
  assert.ok(c1.includes('⚠️ Ninefold Temple: its own site says it closes at 16:00; Google says 17:00. Planned on its own hours'));
  assert.ok(!c1.some((l) => /official site|If it rains/.test(l)), 'the facts line stays off the chat card; no closed museum on a rainy Monday');

  // The station day: the start and the bag step, the walk to the hotel, the sights, back to the hotel, out to dinner and back.
  const c2 = card(2);
  expectLines(c2, 1, [new RegExp('^🚩 Starts 12:10 at <a>Ashvale Station</a> · ' + esc(d2.bags) + '$'), walk(d2.legs[0], ' to your lodging'),
    walk(d2.legs[1]), stopLine(1, 'Ashvale Castle Ruins'), walk(d2.legs[2]), stopLine(2, 'Mistral Shrine'), walk(d2.legs[3], ' back to your lodging'),
    walk(d2.legs[4]), new RegExp('^🍽 ' + d2.dinner.start + ' Dinner at <a>Hearth and Barley</a>$'), /^   <i>The menu partly fits your diet<\/i>$/,
    new RegExp('^   🎟 <i>' + esc(d2.dinner.booking_line) + '</i>$'), walk(d2.legs[5], ' back to your lodging'), /^Spare time: /,
    /^<b>If you have energy<\/b>$/, /^✨ 17:30 Ashvale harvest fair$/, new RegExp("^🔖 " + d2.extras[1].time + " <a>Glassblowers' Yard</a>$"),
    new RegExp('^🌅 Sunset ' + d2.sunset + '$')], 'day 2');

  // The station end: carry the bags, the one sight, the walk to the station right before the end, no dinner out.
  const c3 = card(3);
  expectLines(c3, 0, [/^<b>Day 3 of 3 · Wed 20 Oct<\/b> — Museum$/, new RegExp('^🧳 ' + esc(d3.bags) + '$'), walk(d3.legs[0]),
    stopLine(1, 'Lantern Quay Gallery'), walk(d3.legs[1], ''), /^🏁 Ends 17:00 at <a>Ashvale Station<\/a>$/, /^Spare time: /,
    new RegExp('^🌅 Sunset ' + d3.sunset + '$')], 'day 3');
  assert.ok(!c3.some((l) => /🍽|back to your lodging/.test(l)));

  // The app reads the same stored days: the C11 day fields and the stop facts.
  const app = H.appPost(ctx, state, 'app', { op: 'trip.digest', args: { slug: TRIP } });
  assert.equal(app.ok, true);
  assert.deepEqual([app.trip.start, app.trip.end, app.trip.build_id], ['2027-10-18', '2027-10-20', 'build-md-e2e']);
  const [a1, a2, a3] = app.days;
  for (const k of ['start', 'bags', 'dinner', 'extras', 'sunset']) assert.deepEqual(a2[k], d2[k], k);
  assert.deepEqual([a3.end, a2.legs[0].from, a3.legs.at(-1).to], [d3.end, 'day-start', 'day-end']);
  assert.deepEqual([a1.stops[0].last_entry, a1.stops[0].minutes_source, a1.stops[0].facts_line, a1.stops[1].crowd_slot],
    ['15:30', 'official', d1.stops[0].facts_line, 'late']);
  assert.deepEqual(app.later.map((l) => l.slug), ['saltmarsh-craft-museum', 'glassblowers-yard']);
});

test('both validators take a day of 30 legs and refuse 31', async () => {
  const schemas = await import('../packs/tour-guide/schemas/index.mjs');
  assert.equal(schemas.loadSchema('day-plan').properties.legs.maxItems, 30, 'the planner may write as many as the digest carries');
  const { ctx } = core();
  const withLegs = (n) => ({ v: 1, kind: 'plan_digest', trip: TRIP, build_id: 'build-md-legs', tz: 'Etc/GMT-11', verified_on: '2027-10-01', later: [],
    drive: { plan: 'fixtureDrivePlanFile01', brochure_html: null, brochure_pdf: null },
    days: [{ date: '2027-10-18', theme: 'Loops', warnings: [],
      stops: [{ n: 1, slug: 'loop-stop', name: 'Loop stop', arrive: '10:00', depart: '11:00', minutes: 60, maps_url: 'https://www.google.com/maps/place/?q=place_id:FixtureMdLoop', note_line: '' }],
      legs: Array.from({ length: n }, () => ({ from: 'lodging', to: 'lodging', mode: 'WALK', minutes: 5 })) }] });
  assert.deepEqual(schemas.validatePayload('plan_digest', withLegs(30)).errors, []);
  assert.deepEqual(gasErrors(ctx, 'plan_digest', withLegs(30)), []);
  assert.ok(schemas.validatePayload('plan_digest', withLegs(31)).errors.some((e) => /legs/.test(e.path)), 'node refuses 31');
  assert.ok(gasErrors(ctx, 'plan_digest', withLegs(31)).some((e) => /legs/.test(JSON.stringify(e))), 'the core refuses 31');
});


// Developed by: LightAISolutions
