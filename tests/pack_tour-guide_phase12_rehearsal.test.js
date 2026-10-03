'use strict';
// Tour Guide — the Phase 12 rehearsal (WP-12r, TG-PHASE-12 coordinator step 2, row R): one trip day played through the bot
// on invented data in a zone far from UTC. The rehearsal-day fixture (WP-12a: "Rehearsal Isles", Etc/GMT+10, country ZZ)
// is planned by the planner, turned into the private repo's digest shape by the shared harness (stations from own access
// notes only), passed through the core's envelope handler, and then lived through on its moving day: the morning message
// at 06:59 with a recorded weather answer, running late at 13:00 (a drop with its reason, Undo, again), a re-plan from the
// current stop and from a shared location fed back through replanDays, the 21:00 check-in, and the review after the trip.
// The owner's home zone is Etc/GMT-3, thirteen hours away: during the trip every alarm follows the trip's zone.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const W = require('./pack_tour-guide_phase12_world');
const WX = require('./pack_tour-guide_phase12_rehearsal_weather');
const shared = require('./harness/tour-guide-digest');
const { H, J } = W;

const HOME = 'Etc/GMT-3';                    // the owner's home zone (UTC+3)
const TZ = 'Etc/GMT+10';                     // the trip's zone (UTC-10)
const [D1, D2, D3] = ['2027-11-08', '2027-11-09', '2027-11-10'];
const NOW_PLAN = '2027-10-30T09:00:00Z';
/** The UTC instant (ISO) of a trip-local wall time: Etc/GMT+10 is UTC-10 all year. */
function at(date, hhmm) {
  const [y, m, d] = date.split('-').map(Number), [h, mi] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, h, mi) + 10 * 3600e3).toISOString();
}

/* ---------------- the plan ---------------- */
let mods = null;
async function libs() {
  if (!mods) {
    mods = {
      fixtures: await import('../packs/tour-guide/fixtures/index.mjs'),
      maps: await import('../kits/maps/index.mjs'),
      planner: await import('../packs/tour-guide/planner/index.mjs'),
      schemas: await import('../packs/tour-guide/schemas/index.mjs'),
      time: await import('../packs/tour-guide/planner/planner-time.mjs')
    };
  }
  return mods;
}
/**
 * The rehearsal-day fixture as the owner would have it for this rehearsal (decisions WP-12r §2): no day-2 start at the
 * station (the owner leaves the Quillmere lodging on foot), the moving day by train (modes.by_date), the two museums
 * pencilled in for that day (scheduled_hint), the print gallery booked for 15:45, and Google's TRANSIT answers between
 * the two towns on the Coastal Line (the routes table the fixture responder reads). The fixture files are not changed.
 */
async function rehearsalInput(over = {}) {
  const { fixtures, maps } = await libs();
  const fx = fixtures.loadFixture('rehearsal-day');
  fx.trip.day_overrides = [];
  fx.trip.modes = { ...fx.trip.modes, by_date: { [D2]: 'TRANSIT' } };
  const town = (pid) => (/Quillmere/.test(pid) ? 'Q' : /Tarnwick/.test(pid) ? 'T' : '?');
  const transit = {};
  for (const a of fx.snapshots) for (const b of fx.snapshots) {
    if (a.place_id < b.place_id && town(a.place_id) !== town(b.place_id)) {
      const t = fixtures.fixtureTravel(fx, 'TRANSIT', a.place_id, b.place_id);
      transit[a.place_id + '|' + b.place_id] = { duration_sec: t.durationSec, distance_m: t.distanceMeters, line: 'Coastal Line' };
    }
  }
  fx.routes = { ...fx.routes, modes: { ...(fx.routes.modes || {}), TRANSIT: transit } };
  for (const p of fx.places) {
    if (p.id === 'quillmere-tide-museum' || p.id === 'tarnwick-clock-museum') p.scheduled_hint = { date: D2 };
    if (p.id === 'tarnwick-print-gallery') p.booking = { date: D2, time: '15:45', minutes: 60 };
  }
  const client = () => maps.createMapsClient({ transport: maps.createMockTransport(fixtures.createFixtureResponder(fx)), ledger: maps.createLedger() });
  return { fx, input: { ...fx, maps: client(), build_id: 'rh-1', now: NOW_PLAN, seed: 7, ...over }, client };
}
async function rehearsalPlan() {
  const { planner } = await libs();
  const r = await rehearsalInput();
  return { ...r, plan: await planner.planTrip(r.input) };
}
/** Re-plan day 2 the way the private routine answers the core's `replan` request: its from, visited and rain. */
async function replanFrom(r, plan, req, build_id) {
  const { planner } = await libs();
  const extra = { from: req.from, visited: req.visited };
  if (req.rain) extra.rain = true;
  return planner.replanDays(plan, req.dates, { ...r.input, maps: r.client(), build_id, ...extra, places: plan.places });
}
const digestOf = (plan, trip) => shared.digestOf(plan, trip, { now: NOW_PLAN.slice(0, 10) });

/* ---------------- the core ---------------- */
const TRIP = 'rehearsal-isles-2027';
const bookings = () => ({ v: 1, kind: 'bookings', trip: TRIP, tz: TZ, bookings: [
  { id: 'print-gallery-slot', title: 'Print Gallery slot', kind: 'sight', rule: 'timed entry, booked by the owner', status: 'booked', place: 'tarnwick-print-gallery', for_date: D2 },
  { id: 'ember-bowl-table', title: 'Ember Bowl table', kind: 'meal', rule: 'call a day ahead', status: 'todo', place: 'tarnwick-ember-bowl', for_date: D3,
    book_by: '2027-11-09T18:00:00-10:00' }
] });
/** A core in the owner's home zone, the routines configured, the trip known by name only (the digest fills the rest). */
function core(now) {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now, tz: HOME });
  H.bootstrap(ctx, state);
  ['RESEARCH', 'PLAN', 'PREFS', 'NOTES', 'BROCHURE', 'PLACES'].forEach((n) => H.configureRoutine(ctx, state, n));
  ctx.tgTripUpsert({ slug: TRIP, title: 'Rehearsal Isles', destination: 'Rehearsal Isles' });
  return { ctx, state };
}
const fire = (ctx, state) => H.fireTriggers(ctx, state, 'alarmTrigger');
const morningOf = (state) => W.sends(state).filter((m) => /^☀️ <b>/.test(m.text));
const hm = (ms, tz) => new Date(ms).toLocaleString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
/** The whole set-up: plan, digest through the envelope handler, bookings; the clock at 20:00 trip time the evening before. */
async function rehearsal() {
  const r = await rehearsalPlan();
  const dg = await digestOf(r.plan, r.fx.trip);
  const { ctx, state } = core(at(D1, '20:00'));
  const stats = W.deliver(ctx, state, 'plan_digest', dg);
  W.deliver(ctx, state, 'bookings', bookings());
  state.fetch.requests.length = 0;
  return { ...r, dg, stats, ctx, state };
}

/* ---------------- 1. the plan and its digest ---------------- */
test('the digest: C12 fields from the plan, train stations from own access notes only, valid for the private schema', async () => {
  const { schemas } = await libs();
  const { plan, fx } = await rehearsalPlan();
  const dg = await digestOf(plan, fx.trip);
  assert.deepEqual(schemas.validatePayload('plan_digest', dg).errors, []);
  assert.equal(dg.country_code, 'ZZ');
  assert.equal(dg.tz, TZ);
  const d = dg.days.find((x) => x.date === D2);
  assert.equal(d.leave_by, plan.days[1].leave_by);
  assert.equal(d.leave_by, '09:35');
  assert.deepEqual(d.areas, ['Quillmere', 'Tarnwick']);
  assert.deepEqual(d.stops.map((s) => [s.slug, s.arrive, s.depart, s.time_style]), [
    ['quillmere-tide-museum', '10:00', '11:55', 'about'], ['tarnwick-clock-museum', '13:45', '15:25', 'about'],
    ['tarnwick-print-gallery', '15:45', '16:45', 'exact']]);
  const [tide, clock, gallery] = d.stops;
  assert.deepEqual([tide.local_name, tide.address, tide.payment, tide.close],
    ['潮見記念館', '4 Tide Row, Quillmere, Fictional Isles', 'Cash only at the door', '17:00']);
  assert.equal(clock.local_name, 'Ρολόγια Τάρνγουικ');
  assert.equal(clock.payment, undefined, 'only what its own facts say');
  assert.equal(gallery.local_name, undefined);
  assert.ok(d.stops.every((s) => s.visited === undefined), 'nothing is visited in a first plan');
  // The train leg names its stations from the two museums' own access notes, on the line they share.
  const train = d.legs.filter((l) => l.mode === 'TRANSIT');
  assert.equal(train.length, 1);
  assert.deepEqual(train[0].stations, { from: 'Quillmere Central', from_line: 'Coastal Line', to: 'Tarnwick', to_line: 'Coastal Line' });
  assert.ok(d.legs.filter((l) => l.mode !== 'TRANSIT').every((l) => l.stations === undefined), 'a walk has no stations');
  assert.ok(dg.days.every((x) => x.warnings.length <= 20 && x.warnings.every((w) => w.length <= 200)));
  assert.equal(d.dinner.slug, 'tarnwick-terrace-grill');

  // Google's route line is not a station source: another line name there changes nothing; without the museums' own
  // notes the leg has no stations at all.
  const r2 = await rehearsalInput();
  for (const k of Object.keys(r2.input.routes.modes.TRANSIT)) r2.input.routes.modes.TRANSIT[k].line = 'Invented Express';
  const dgLine = await digestOf(await (await libs()).planner.planTrip(r2.input), fx.trip);
  assert.deepEqual(dgLine.days[1].legs.find((l) => l.mode === 'TRANSIT').stations, train[0].stations);
  const r3 = await rehearsalInput();
  r3.input.places.forEach((p) => { if (p.id === 'tarnwick-clock-museum') delete p.facts.access; });
  const dgBare = await digestOf(await (await libs()).planner.planTrip(r3.input), fx.trip);
  const bare = dgBare.days[1].legs.find((l) => l.mode === 'TRANSIT');
  assert.ok(bare, 'still a train leg');
  assert.equal(bare.stations, undefined, 'no own note at one end: no stations, never a guess');
});

test('stationsOf: own notes only — one shared line first, an owner-named day start, a moving day\'s lodging is ambiguous', () => {
  const T = (from, to) => ({ from, to, mode: 'TRANSIT' });
  const byId = new Map([
    ['a', { facts: { access: [{ station: 'North Halt', line: 'Red' }, { station: 'Market', line: 'Blue' }] } }],
    ['b', { facts: { access: [{ station: 'Pier', line: 'Blue' }] } }],
    ['c', { facts: { access: [{ station: 'Pier', line: 'Green' }] } }],
    ['n', { facts: {} }]]);
  const lodgings = new Map([['inn-1', { id: 'inn-1', access: [{ station: 'Inn Stop', line: 'Red' }] }], ['inn-2', { id: 'inn-2', access: [{ station: 'Far Stop' }] }]]);
  const day = (o = {}) => ({ lodging_start: 'inn-1', lodging_end: 'inn-1', ...o });
  const S = (legs, i, d = day()) => shared.stationsOf(legs[i], i, legs, d, byId, lodgings);
  assert.deepEqual(S([T('a', 'b')], 0), { from: 'Market', from_line: 'Blue', to: 'Pier', to_line: 'Blue' }, 'the pair on one line');
  assert.deepEqual(S([T('a', 'c')], 0), { from: 'North Halt', from_line: 'Red', to: 'Pier', to_line: 'Green' }, 'else the first of each');
  assert.equal(S([T('a', 'n')], 0), undefined, 'no note at one end');
  assert.equal(S([T('b', 'c')], 0), undefined, 'the same station at both ends');
  assert.equal(S([{ ...T('a', 'b'), mode: 'WALK' }], 0), undefined, 'walks have none');
  assert.equal(S([T('here', 'b')], 0), undefined, 'a shared location has no station');
  assert.deepEqual(S([T('day-start', 'b')], 0, day({ start: { name: 'Harbour Ferry Pier', time: '09:00' } })), { from: 'Harbour Ferry Pier', to: 'Pier', to_line: 'Blue' },
    'the owner named the day start: its name is the station');
  assert.deepEqual(S([T('lodging', 'a')], 0), { from: 'Inn Stop', from_line: 'Red', to: 'North Halt', to_line: 'Red' }, 'one lodging all day');
  const move = day({ lodging_end: 'inn-2' }), legs = [T('lodging', 'a'), T('a', 'lodging'), T('b', 'lodging')];
  assert.deepEqual(S(legs, 0, move), { from: 'Inn Stop', from_line: 'Red', to: 'North Halt', to_line: 'Red' }, 'moving day, first leg: the morning lodging');
  assert.equal(S(legs, 1, move), undefined, 'moving day, mid-day: which lodging is ambiguous');
  assert.deepEqual(S(legs, 2, move), { from: 'Pier', from_line: 'Blue', to: 'Far Stop' }, 'moving day, last leg: the night lodging');
});

test('compatibility: a digest without any C12 field still validates, stores and shows; old fixtures digest as before plus C12 keys', async () => {
  const { schemas, fixtures, maps, planner } = await libs();
  const { plan, fx } = await rehearsalPlan();
  const dg = await digestOf(plan, fx.trip);
  delete dg.country_code;
  for (const d of dg.days) {
    delete d.leave_by; delete d.areas;
    if (d.dinner) ['local_name', 'address', 'payment', 'price_line'].forEach((k) => delete d.dinner[k]);
    d.stops.forEach((s) => ['visited', 'local_name', 'address', 'payment', 'close'].forEach((k) => delete s[k]));
    d.legs.forEach((l) => { delete l.stations; });
  }
  assert.deepEqual(schemas.validatePayload('plan_digest', dg).errors, []);
  const { ctx, state } = core(at(D2, '08:00'));
  assert.equal(W.deliver(ctx, state, 'plan_digest', dg).processed, 1);
  W.say(ctx, state, '/today');
  assert.match(W.last(state), /<b>Day 2 of 3 · Tue 9 Nov<\/b>/);
  assert.match(W.last(state), /Quillmere Tide Museum/);
  for (const name of ['moving-day', 'two-stays', 'transit-city']) {
    const f = fixtures.loadFixture(name);
    const client = maps.createMapsClient({ transport: maps.createMockTransport(fixtures.createFixtureResponder(f)), ledger: maps.createLedger() });
    const p = await planner.planTrip({ ...f, maps: client, build_id: 'b1', now: NOW_PLAN, seed: 7 });
    assert.deepEqual(schemas.validatePayload('plan_digest', await digestOf(p, f.trip)).errors, [], name);
  }
});

/* ---------------- 2. the moving day through the bot ---------------- */
/** The rehearsal up to the 06:59 morning message of day 2 (recorded weather); → { ...rehearsal, morning }. */
async function toMorning() {
  const R = await rehearsal();
  const { ctx, state } = R;
  W.say(ctx, state, '/morning at 06:59');
  state.fetch.responder = WX.responder();
  W.setNow(ctx, at(D2, '06:57')); fire(ctx, state);
  assert.equal(morningOf(state).length, 0, 'not before its time');
  W.setNow(ctx, at(D2, '06:59')); fire(ctx, state);
  const m = morningOf(state);
  assert.equal(m.length, 1);
  return { ...R, morning: m[0] };
}

test('core: the digest goes through the envelope handler; the trip record spans the journey in the trip zone', async () => {
  const R = await rehearsal();
  assert.deepEqual(R.stats, { processed: 1, rejected: 0, failed: 0, duplicate: 0 });
  const t = J(R.ctx.tgTripGet(TRIP));
  assert.deepEqual([t.start, t.end, t.tz, t.country_code, t.build_id], [D1, D3, TZ, 'ZZ', 'rh-1']);
  const day = J(R.ctx.tgDigestDay(TRIP, D2));
  assert.equal(day.leave_by, '09:35');
  assert.deepEqual(day.areas, ['Quillmere', 'Tarnwick']);
  assert.deepEqual(day.legs.find((l) => l.mode === 'TRANSIT').stations, { from: 'Quillmere Central', from_line: 'Coastal Line', to: 'Tarnwick', to_line: 'Coastal Line' });
});

test('06:59 trip time on the moving day: leave by, both towns with recorded weather and its credit, paying, trains', async () => {
  const { morning: m, state } = await toMorning();
  const t = m.text;
  assert.match(t, /^☀️ <b>Tue 9 Nov · Day 2 of 3<\/b> · Quillmere → Tarnwick\n/);
  assert.match(t, /\n🚪 <b>Leave by 09:35<\/b>\n/);
  assert.match(t, /\n<b>Quillmere<\/b>: ⛅ Partly cloudy, 21–27 °C \(70–81 °F\) · rain 20%\n/);
  assert.match(t, /\n<b>Tarnwick<\/b>: 🌧 Rain likely from 16:00, 21–27 °C \(69–80 °F\) · rain 70%\n/);
  assert.match(t, /open-meteo\.com/, 'the weather credit');
  assert.match(t, /\n💴 <b>Paying<\/b>\n• Quillmere Tide Museum: Cash only at the door\n/);
  assert.doesNotMatch(t, /Cash only at the door · Cash only at the door/, 'the price line repeats no payment word');
  assert.match(t, /潮見記念館/);
  assert.match(t, /\n🚆 <b>Trains<\/b>\n• from Quillmere Central \(Coastal Line\) to Tarnwick \(Coastal Line\) — for Tarnwick Clock Museum/);
  assert.match(t, /🎟 Print Gallery slot · ✅ booked/);
  assert.match(t, /🍽 18:39 Dinner at <b>Tarnwick Terrace Grill<\/b>/);
  assert.deepEqual(W.cbData(m), ['rl:' + TRIP + ':20271109:15', 'rl:' + TRIP + ':20271109:30', 'rl:' + TRIP + ':20271109:60', 'rp:' + TRIP + ':20271109']);
  // Two towns, one forecast each, both asked for the moving day in the trip's zone.
  const wx = state.fetch.requests.filter((r) => /^https:\/\/api\.open-meteo\.com\//.test(r.url));
  assert.equal(wx.length, 2);
  assert.ok(wx.every((r) => /start_date=2027-11-09/.test(r.url) && /timezone=Etc%2FGMT%2B10|timezone=Etc\/GMT\+10/.test(r.url)), wx.map((r) => r.url).join('\n'));
});

test('13:00 running late 30: a stop drops with its reason, Undo restores the plan, late 30 again drops it again', async () => {
  const { ctx, state } = await toMorning();
  const late = 'rl:' + TRIP + ':20271109:30';
  const lateCards = () => W.sends(state).filter((x) => /Running 30 min late/.test(x.text));
  W.setNow(ctx, at(D2, '13:00'));
  W.tap(ctx, state, late, { messageId: 900 });
  const c = lateCards().pop();
  assert.match(c.text, /^⏰ <b>Running 30 min late<\/b> · Tue 9 Nov · from 13:00/);
  assert.match(c.text, /<b>3\.<\/b> 15:45–16:45 Tarnwick Print Gallery · stays/, 'the booking keeps its time');
  assert.match(c.text, /🍽 19:09 Dinner at Tarnwick Terrace Grill/);
  assert.match(c.text, /✖️ <b>Tarnwick Clock Museum<\/b> dropped — your 15:45 Tarnwick Print Gallery booking/);
  assert.deepEqual(W.cbData(c), ['rl:' + TRIP + ':20271109:u', 'rp:' + TRIP + ':20271109']);
  assert.ok(J(JSON.parse(ctx.settingGet('tg_late', '{}')))[TRIP + '|' + D2], 'the overlay is kept');
  W.setNow(ctx, at(D2, '13:02'));
  W.tap(ctx, state, W.cbData(c)[0], { messageId: 901 });
  assert.equal(W.last(state), '↩️ Tue 9 Nov is back to the plan. /today shows it.');
  assert.equal(state.fetch.telegram('answerCallbackQuery').map((r) => r.json.text).pop(), 'Undone');
  assert.deepEqual(JSON.parse(ctx.settingGet('tg_late', '{}')), {});
  W.setNow(ctx, at(D2, '13:05'));
  W.tap(ctx, state, late, { messageId: 900 });
  assert.equal(lateCards().length, 2);
  assert.match(lateCards().pop().text, /✖️ <b>Tarnwick Clock Museum<\/b> dropped — your 15:45 Tarnwick Print Gallery booking/);
  W.say(ctx, state, '/today');
  assert.match(W.last(state), /↳ transit · travel time not recalculated/, 'a train joined with a walk is still a train');
});

/* ---------------- 3. re-plan from the current stop, the evening, the review ---------------- */
/** Late 30 at 13:00, then at 14:30 "re-plan from the current stop" → the request, the private re-plan, the new digest. */
async function toReplan() {
  const R = await toMorning();
  const { ctx, state } = R;
  W.setNow(ctx, at(D2, '13:00'));
  W.tap(ctx, state, 'rl:' + TRIP + ':20271109:30', { messageId: 900 });
  W.setNow(ctx, at(D2, '14:30'));
  W.tap(ctx, state, 'rp:' + TRIP + ':20271109', { messageId: 900 });
  const q = W.sends(state).pop();
  W.setNow(ctx, at(D2, '14:31'));
  W.say(ctx, state, q.reply_markup.keyboard[0][0].text);
  const [req] = W.reqOf(state, 'replan');
  const re = await replanFrom(R, R.plan, req, 'rh-2');
  const dg2 = await digestOf(re, R.fx.trip);
  return { ...R, q, req, re, dg2 };
}

test('14:30 re-plan from the current stop: the request, replanDays keeps what was done, the new digest clears the overlay', async () => {
  const { schemas, time } = await libs();
  const { ctx, state, q, req, re, dg2, plan } = await toReplan();
  // The clock museum was dropped by running late, so the current stop is the tide museum.
  assert.match(q.text, /From <b>Quillmere Tide Museum<\/b>/);
  assert.equal(q.reply_markup.keyboard[0][0].text, '📍 From Quillmere Tide Museum');
  assert.deepEqual([req.trip, req.dates, req.from, req.visited, req.rain], [TRIP, [D2], { time: '14:31', place: 'quillmere-tide-museum' }, ['quillmere-tide-museum'], undefined]);
  assert.deepEqual(req.trip_update, { start_date: D1, end_date: D3 });
  const d2 = re.days.find((d) => d.date === D2);
  assert.deepEqual(d2.stops[0], { ...d2.stops[0], place: 'quillmere-tide-museum', arrive: '10:00', depart: '11:55', visited: true }, 'the visited stop is kept as it was');
  const rest = d2.stops.slice(1);
  assert.ok(rest.length && rest.every((s) => s.arrive >= '14:31' && !s.visited), 'the rest starts from 14:31');
  assert.ok(re.days.filter((d) => d.date !== D2).every((d) => JSON.stringify(d) === JSON.stringify(plan.days.find((x) => x.date === d.date))), 'other days untouched');
  const later = re.later.flatMap((g) => g.items || []);
  later.filter((i) => /re-planned/.test(i.reason || '')).forEach((i) => assert.match(i.reason, new RegExp(time.dayDate(D2)), 'dates as the day card writes them'));
  assert.deepEqual(schemas.validatePayload('plan_digest', dg2).errors, []);
  const s2 = dg2.days.find((d) => d.date === D2).stops;
  assert.deepEqual(s2.filter((s) => s.visited).map((s) => s.slug), ['quillmere-tide-museum']);
  W.setNow(ctx, at(D2, '14:40'));
  assert.equal(W.deliver(ctx, state, 'plan_digest', dg2).processed, 1);
  assert.deepEqual(JSON.parse(ctx.settingGet('tg_late', '{}')), {}, 'a new plan clears the running-late overlay');
  assert.equal(J(ctx.tgDigestDay(TRIP, D2)).stops[0].visited, true);
  W.say(ctx, state, '/today');
  const today = W.last(state);
  assert.match(today, /<b>Day 2 of 3 · Tue 9 Nov<\/b>/);
  assert.match(today, /⚠️ Re-planned at 14:31/);
  assert.doesNotMatch(today, /Running 30 min late|not recalculated/, 'the re-planned day, not the overlay');
  assert.equal(J(ctx.tgTripGet(TRIP)).build_id, 'rh-2');
});

test('21:00 trip time: the check-in lists the re-planned day; taps go to Choices; Done summarises', async () => {
  const R = await toReplan();
  const { ctx, state, dg2 } = R;
  W.setNow(ctx, at(D2, '14:40'));
  W.deliver(ctx, state, 'plan_digest', dg2);
  assert.equal(ctx.alarmNextAll(ctx.nowMs()).tg_checkin, Date.parse(at(D2, '21:00')), '21:00 in the trip zone');
  W.setNow(ctx, at(D2, '20:58')); fire(ctx, state);   // the core's alarms may run up to a minute early (ALARM_EARLY_SEC)
  const checkins = () => W.sends(state).filter((m) => /How was today\?/.test(m.text));
  assert.equal(checkins().length, 0);
  W.setNow(ctx, at(D2, '21:00')); fire(ctx, state);
  const ci = checkins().pop();
  assert.ok(ci, 'sent at 21:00');
  const listed = (ci.text.match(/<b>\d+\.<\/b> [^\n]+/g) || []).map((l) => l.replace(/^<b>\d+\.<\/b> /, '').split(' · ')[0]);
  const planned = J(ctx.tgDigestDay(TRIP, D2)).stops.map((s) => s.name);
  assert.deepEqual(listed, planned, 'the stops of the re-planned day');
  assert.match(ci.text, /Quillmere Tide Museum · 潮見記念館/);
  let kb = ci.reply_markup;
  const press = (k, code) => {
    const data = kb.inline_keyboard[k - 1].find((b) => b.callback_data.endsWith(':' + code)).callback_data;
    W.tap(ctx, state, data, { messageId: 501, replyMarkup: kb });
    kb = state.fetch.telegram('editMessageReplyMarkup').map((r) => r.json).pop().reply_markup;
  };
  press(1, 'u'); press(1, 'r'); press(2, 'd'); press(2, 'l');
  assert.deepEqual(J(ctx.tgChoiceList(TRIP, 'checkin', 'review')).map((c) => [c.key, c.value, c.text]), [
    [D2 + '|quillmere-tide-museum', 'up', 'right'], [D2 + '|' + J(ctx.tgDigestDay(TRIP, D2)).stops[1].slug, 'down', 'longer']]);
  W.tap(ctx, state, kb.inline_keyboard[kb.inline_keyboard.length - 1][0].callback_data, { messageId: 501, replyMarkup: kb });
  const done = state.fetch.telegram('editMessageText').map((r) => r.json.text).pop();
  assert.match(done, /^🌙 <b>Check-in saved<\/b> · Tue 9 Nov\n<b>1\.<\/b> Quillmere Tide Museum — 👍 · 👌 about right\n/);
  assert.equal(W.reqOf(state, 'prefs').length, 0, 'nothing is sent from a check-in');
});

test('after the trip, /review skips the stops the check-in rated and sends one valid prefs request', async () => {
  const R = await toReplan();
  const { ctx, state, dg2 } = R;
  W.setNow(ctx, at(D2, '14:40'));
  W.deliver(ctx, state, 'plan_digest', dg2);
  W.setNow(ctx, at(D2, '21:00')); fire(ctx, state);
  let kb = W.sends(state).filter((m) => /How was today\?/.test(m.text)).pop().reply_markup;
  const press = (k, code) => {
    const data = kb.inline_keyboard[k - 1].find((b) => b.callback_data.endsWith(':' + code)).callback_data;
    W.tap(ctx, state, data, { messageId: 501, replyMarkup: kb });
    kb = state.fetch.telegram('editMessageReplyMarkup').map((r) => r.json).pop().reply_markup;
  };
  press(1, 'u'); press(1, 'r'); press(2, 'd'); press(2, 'l');
  const items = J(ctx.tgRvItems(TRIP)), slugs = items.map((i) => i.slug);
  assert.equal(slugs.length, 10);
  assert.deepEqual(slugs.slice(6, 8), ['quillmere-tide-museum', 'tarnwick-print-gallery'],
    'the review asks about the stored plan: the re-planned day kept its booked gallery');
  W.setNow(ctx, at('2027-11-11', '12:00'));
  W.say(ctx, state, '/review');
  assert.match(W.last(state), /^<i>1 of 8 · Rehearsal Isles<\/i>\n<b>Quillmere Reed Gardens<\/b> — Mon 8 Nov/, 'the two rated stops are skipped');
  const lastKb = () => W.sends(state).filter((j) => j.reply_markup && j.reply_markup.inline_keyboard).pop();
  const choose = (label) => {
    const b = lastKb().reply_markup.inline_keyboard.flat().find((x) => x.text === label || x.text.endsWith(label));
    assert.ok(b, label);
    W.tap(ctx, state, b.callback_data, { messageId: 91 });
  };
  choose('Worth it'); choose('About right');
  for (let i = 1; i < 8; i++) {
    assert.doesNotMatch(W.last(state), /Quillmere Tide Museum|Tarnwick Print Gallery/, 'never asked again');
    choose('Skipped it');
  }
  assert.match(W.last(state), /Noted — this will shape the next plan/);
  const prefs = W.reqOf(state, 'prefs');
  assert.equal(prefs.length, 1);
  assert.deepEqual(W.checkPrefsReview(J(prefs[0]), TRIP, slugs), []);
  const its = prefs[0].review.items;
  assert.equal(its.length, 10);
  assert.deepEqual(its[0], { slug: 'quillmere-reed-gardens', rating: 'up', calibration: 'right' });
  assert.deepEqual(its.filter((i) => i.slug === 'quillmere-tide-museum' || i.slug === 'tarnwick-print-gallery'),
    [{ slug: 'quillmere-tide-museum', rating: 'up', calibration: 'right' }, { slug: 'tarnwick-print-gallery', rating: 'down', calibration: 'longer' }]);
});

/* ---------------- 4. re-plan from a shared location ---------------- */
test('re-plan from a shared location: from.point to 5 decimals, a "here" leg, the coordinates kept nowhere', async () => {
  const R = await rehearsal();
  const { ctx, state } = R;
  W.setNow(ctx, at(D2, '14:30'));
  W.tap(ctx, state, 'rp:' + TRIP + ':20271109', { messageId: 900 });
  assert.match(W.last(state), /From <b>Tarnwick Clock Museum<\/b>, from where you are/);
  W.setNow(ctx, at(D2, '14:31'));
  W.post(ctx, state, H.tgUpdate({ location: { latitude: 18.648213456, longitude: -148.369132987 } }));
  const [req] = W.reqOf(state, 'replan');
  assert.deepEqual(req.from, { time: '14:31', point: { lat: 18.64821, lng: -148.36913 } });
  assert.deepEqual(req.visited, ['quillmere-tide-museum'], 'only what has ended');
  const re = await replanFrom(R, R.plan, req, 'rh-3');
  const d2 = re.days.find((d) => d.date === D2);
  const here = d2.legs.filter((l) => l.from === 'here');
  assert.equal(here.length, 1);
  assert.equal(here[0].depart_at, '14:31');
  assert.equal(d2.stops[0].visited, true);
  const dg2 = await digestOf(re, R.fx.trip);
  const leg = dg2.days[1].legs.find((l) => l.from === 'here');
  assert.ok(leg && !/origin=/.test(leg.maps_url || ''), 'the leg from here has no origin in its link');
  assert.equal(leg.stations, undefined);
  const needles = ['18.648', '148.369'];
  for (const [what, v] of [['plan', re], ['digest', dg2]]) assert.ok(needles.every((n) => !JSON.stringify(v).includes(n)), 'no coordinates in the ' + what);
  W.setNow(ctx, at(D2, '14:40'));
  assert.equal(W.deliver(ctx, state, 'plan_digest', dg2).processed, 1);
  W.say(ctx, state, '/today');
  assert.match(W.last(state), /Re-planned at 14:31 from where you were/);
  assert.deepEqual(W.keptAnywhere(state, needles), [], 'not in a sheet, a property, a log, a reply or a Drive file');
});

/* ---------------- 5. the zones ---------------- */
test('zones: before and after the trip reminders follow home; during it the booking, morning and check-in alarms follow the trip', async () => {
  const { ctx, state } = core('2027-10-30T09:00:00Z');
  W.deliver(ctx, state, 'bookings', bookings());
  assert.equal(ctx.tgOwnerTz(), HOME);
  assert.equal(hm(ctx.alarmNextAll(ctx.nowMs()).tg_bookings, HOME), '09:00', '09:00 at home');
  const R = await rehearsal();
  assert.equal(R.ctx.tgOwnerTz(), TZ, 'the trip is in progress at 20:00 on day 1, trip time');
  W.say(R.ctx, R.state, '/morning at 06:59');
  const nx = R.ctx.alarmNextAll(R.ctx.nowMs());
  assert.equal(nx.tg_bookings, Date.parse(at(D2, '09:00')));
  assert.equal(nx.tg_morning, Date.parse(at(D2, '06:59')));
  assert.equal(nx.tg_checkin, Date.parse(at(D1, '21:00')));
  assert.equal(hm(nx.tg_bookings, HOME), '22:00', 'which is 22:00 at home: not a home-zone 09:00');
  W.setNow(R.ctx, at('2027-11-11', '12:00'));
  assert.equal(R.ctx.tgOwnerTz(), HOME, 'the trip is over');
  const after = R.ctx.alarmNextAll(R.ctx.nowMs());
  assert.equal(after.tg_morning, undefined);
  assert.equal(after.tg_checkin, undefined);
});

/* ---------------- 6. what the rehearsal found in the planner (WP-12r REQUESTs 1 and 2, fixed by the coordinator) ---------------- */
test('re-plan: a booked stop keeps its slot (it is a must, like an outline anchor)', async () => {
  const { re } = await toReplan();
  const g = re.days.find((d) => d.date === D2).stops.find((s) => s.place === 'tarnwick-print-gallery');
  assert.ok(g, 'the 15:45 booking is still on the day');
  assert.equal(g.arrive, '15:45');
});
test('re-plan: the chosen dinner stays (plan.places says scheduled; the owner said chosen)', async () => {
  const { dg2 } = await toReplan();
  assert.equal(dg2.days.find((d) => d.date === D2).dinner.slug, 'tarnwick-terrace-grill');
});

/* ---------------- 7. a lodging change offers to re-plan the days it touches (task 2) ---------------- */
const lgEdits = (state) => state.fetch.telegram('editMessageText').map((r) => r.json);
const lgAnswers = (state) => state.fetch.telegram('answerCallbackQuery').map((r) => r.json.text);

test('/lodging mid-trip: an offer to re-plan the days left; the tap opens one replan request, the message closes', async () => {
  const { ctx, state } = await rehearsal();
  const tk = ctx.tgCmdTripKey(TRIP);
  W.setNow(ctx, at(D2, '10:00'));
  W.say(ctx, state, '/lodging Tarnwick Lamp Lodge, 2 nights');
  const m = W.sends(state).pop();
  assert.equal(m.text, '🏨 Saved for Rehearsal Isles: Tarnwick Lamp Lodge, 2 nights\nIt goes with the next research round.\n' +
    '🔁 The plan still starts and ends those days at the old lodging: re-plan 2 days from Tue 9 Nov?');
  assert.deepEqual(m.reply_markup.inline_keyboard.map((row) => row.map((b) => [b.text, b.callback_data])), [
    [['🔁 Re-plan 2 days from Tue 9 Nov', 'lg:' + tk + ':20271109']], [['Keep the plan', 'lg:' + tk + ':k']]]);
  assert.deepEqual(J(ctx.tgTripGet(TRIP).lodging), { text: 'Tarnwick Lamp Lodge, 2 nights', nights: 2 }, 'saved as before');
  assert.equal(W.reqOf(state, 'replan').length, 0, 'nothing is sent before the tap');
  W.tap(ctx, state, 'lg:' + tk + ':20271109', { messageId: 700 });
  const reqs = W.reqOf(state, 'replan');
  assert.equal(reqs.length, 1);
  assert.deepEqual([reqs[0].trip, reqs[0].dates, reqs[0].deliverables, reqs[0].trip_update], [TRIP, [D2, D3], ['plan'], { start_date: D1, end_date: D3 }]);
  assert.equal(reqs[0].reason, 'The lodging changed: Tarnwick Lamp Lodge, 2 nights. Re-plan these days to start and end there.');
  assert.equal(reqs[0].from, undefined, 'whole days, not the rest of one');
  assert.equal(lgAnswers(state).pop(), 'Re-planning');
  const e = lgEdits(state).pop();
  assert.equal(e.message_id, 700);
  assert.equal(e.text, '🏨 Rehearsal Isles: Tarnwick Lamp Lodge, 2 nights\n🔁 Re-planning 2 days from Tue 9 Nov for the new lodging. ' +
    'It runs in the background; the day cards update when the new plan is ready.');
  assert.ok(!e.reply_markup || !(e.reply_markup.inline_keyboard || []).length, 'the buttons are gone');
});

test('/lodging: before the trip every planned day; Keep sends nothing; after the trip or without a plan, the reply as before', async () => {
  const R = await rehearsal();
  const { ctx, state } = R;
  const tk = ctx.tgCmdTripKey(TRIP);
  W.setNow(ctx, '2027-10-30T09:00:00Z');
  W.say(ctx, state, '/lodging Quillmere <Reed> House');
  assert.match(W.last(state), /^🏨 Saved for Rehearsal Isles: Quillmere &lt;Reed&gt; House\n.*\n🔁 .*re-plan 3 days from Mon 8 Nov\?$/);
  assert.equal(W.cbData(W.sends(state).pop())[0], 'lg:' + tk + ':20271108');
  W.tap(ctx, state, 'lg:' + tk + ':k', { messageId: 701 });
  assert.equal(lgAnswers(state).pop(), 'Kept');
  assert.equal(lgEdits(state).pop().text, '🏨 Rehearsal Isles: Quillmere &lt;Reed&gt; House\nThe plan stays as it is; /replan changes one day.');
  assert.equal(W.reqOf(state, 'replan').length, 0);
  // A button from before the trip, tapped on its last day: only the days not over.
  W.setNow(ctx, at(D3, '08:00'));
  W.tap(ctx, state, 'lg:' + tk + ':20271108', { messageId: 701 });
  assert.deepEqual(W.reqOf(state, 'replan').map((r) => r.dates), [[D3]]);
  // After the trip (it is no longer the current trip, so /lodging does not reach it): no offer, and an old button says so.
  W.setNow(ctx, at('2027-11-11', '09:00'));
  assert.equal(ctx.tgLgOffer(ctx.tgTripGet(TRIP)), null);
  W.tap(ctx, state, 'lg:' + tk + ':20271110', { messageId: 701 });
  assert.equal(lgAnswers(state).pop(), 'Those days are over.');
  assert.equal(W.reqOf(state, 'replan').length, 1);
  // A trip without a plan: the reply as before.
  const c = core(at(D1, '20:00'));
  W.say(c.ctx, c.state, '/lodging Tarnwick Lamp Lodge');
  assert.equal(W.sends(c.state).pop().reply_markup, undefined);
});

test('lg buttons: only their own shapes; a gone trip or a forged date does nothing; the data fits Telegram\'s 64 bytes', async () => {
  const { ctx, state } = await rehearsal();
  const tk = ctx.tgCmdTripKey(TRIP);
  W.setNow(ctx, at(D2, '10:00'));
  for (const [data, word] of [['lg:' + tk, 'Unknown button'], ['lg:' + tk + ':x', 'Unknown button'], ['lg:' + tk + ':2027110', 'Unknown button'],
    ['lg:' + tk + ':20271399', 'Unknown button'], ['lg:' + tk + ':20271109:k', 'Unknown button'], ['lg:no-such-trip:20271109', 'That trip is gone.']]) {
    W.tap(ctx, state, data, { messageId: 702 });
    assert.equal(lgAnswers(state).pop(), word, data);
  }
  W.tap(ctx, state, 'lg:' + tk + ':20271109', { messageId: 702 });
  assert.equal(lgAnswers(state).pop(), 'No lodging is saved — /lodging <where>.', 'nothing to re-plan for');
  assert.equal(W.reqOf(state, 'replan').length, 0);
  const longKey = ctx.tgCmdTripKey('a-very-long-trip-slug-'.repeat(4));
  assert.ok(Buffer.byteLength('lg:' + longKey + ':20271109') <= 64);
  assert.ok(Buffer.byteLength('lg:' + 'a'.repeat(40) + ':20271109') <= 64);
});

// Developed by: LightAISolutions
