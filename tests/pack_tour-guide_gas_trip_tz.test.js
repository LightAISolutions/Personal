'use strict';
// Tour Guide pack — WP-10a: each trip's own time zone (Trips.tz) and Contract C10 acceptance (plan_digest extras).
// Invented data: home America/New_York, the trip "Port Sorrel" kept in Pacific/Auckland.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');

const HOME = 'America/New_York';
const AWAY = 'Pacific/Auckland';
const NOW = '2027-03-02T19:00:00Z';   // 08:00 Wed 3 Mar in Auckland (UTC+13) · 14:00 Tue 2 Mar in New York (UTC-5)
const TRIP = 'port-sorrel';
const J = (v) => JSON.parse(JSON.stringify(v));
const maps = (id) => 'https://www.google.com/maps/search/?api=1&query=Fixture&query_place_id=' + id;

function fresh(o = {}) {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: o.now || NOW, tz: HOME });
  H.bootstrap(ctx, state);
  ['RESEARCH', 'PLAN', 'PREFS', 'NOTES', 'BROCHURE', 'PLACES'].forEach((n) => H.configureRoutine(ctx, state, n));
  return { ctx, state };
}
const post = (ctx, state, upd) => ctx.doPost(H.postEvent('tg', { k: state.props[ctx.PROP.WEBHOOK_SECRET] }, upd));
const say = (ctx, state, text) => post(ctx, state, H.tgUpdate({ text }));
const texts = (state) => state.fetch.telegram('sendMessage').map((r) => r.json.text);
const requests = (state) => (state.drive.listFiles('TourGuide/mailbox/to-brain') || []).filter((n) => /^req_/.test(n))
  .map((n) => JSON.parse(state.drive.readFile('TourGuide/mailbox/to-brain', n)).payload);
function deliver(ctx, state, type, payload) {
  H.putEnvelope(state, H.envelope(type, payload));
  return J(ctx.pollFromBrain());
}
const stop = (n, slug, name, over = {}) => ({ n, slug, name, arrive: '10:00', depart: '11:00', minutes: 60, maps_url: maps('F' + n), note_line: 'A note.', ...over });
const day = (date, theme, over = {}) => ({ date, theme, stops: [stop(1, 'quay-steps-' + date.slice(-2), theme + ' stop')], legs: [], warnings: [], ...over });
const digest = (over = {}) => ({ v: 1, kind: 'plan_digest', trip: TRIP, build_id: 'build-tz-1', verified_on: '2027-02-20',
  days: [day('2027-03-02', 'Arrival'), day('2027-03-03', 'Harbour'), day('2027-03-04', 'Hills')], later: [],
  drive: { plan: 'fixtureDrivePlanFile01', brochure_html: null, brochure_pdf: null }, ...over });
function planned(ctx, state, over) {
  ctx.tgTripUpsert({ slug: TRIP, title: 'Port Sorrel', destination: 'Port Sorrel' });
  assert.equal(deliver(ctx, state, 'plan_digest', digest(over)).processed, 1);
  ctx.settingSet(ctx.TG_SETTINGS.CURRENT_TRIP, TRIP, 'test');
}

test('core zone helpers: isoDateIn, isValidTz, isoDateAdd, msAtLocal across a date line and a DST change', () => {
  const { ctx } = fresh();
  assert.equal(ctx.isoDateIn(AWAY), '2027-03-03');
  assert.equal(ctx.isoDateIn(HOME), '2027-03-02');
  assert.equal(ctx.isoDateIn('Not/AZone'), '2027-03-02', 'an unknown zone falls back to home');
  assert.equal(ctx.isValidTz(AWAY), true);
  assert.equal(ctx.isValidTz('UTC'), true);
  ['Mars/Olympus', 'Pacific', '', 'Europe/../x', '+13:00', null].forEach((z) => assert.equal(ctx.isValidTz(z), false, String(z)));
  assert.equal(ctx.isoDateAdd('2027-02-28', 1), '2027-03-01');
  assert.equal(ctx.isoDateAdd('2027-03-01', -1), '2027-02-28');
  assert.equal(ctx.isoDateAdd('bad', 1), '');
  assert.equal(new Date(ctx.msAtLocal(AWAY, '2027-03-03', 8, 0)).toISOString(), '2027-03-02T19:00:00.000Z');
  assert.equal(new Date(ctx.msAtLocal(HOME, '2027-03-15', 9, 0)).toISOString(), '2027-03-15T13:00:00.000Z', 'after the US DST change');
  assert.equal(new Date(ctx.msAtLocal(HOME, '2027-03-12', 9, 0)).toISOString(), '2027-03-12T14:00:00.000Z', 'before it');
  assert.ok(Number.isNaN(ctx.msAtLocal(HOME, '2027-02-30', 9, 0)));
});

test('/today shows the day where the trip is, with a "Today in" line; /replan today and tomorrow use the trip day', () => {
  const { ctx, state } = fresh();
  planned(ctx, state, { tz: AWAY });
  assert.equal(ctx.tgTripGet(TRIP).tz, AWAY, 'the digest set the trip zone');
  say(ctx, state, '/today');
  const t = texts(state).pop();
  assert.match(t, /^📍 Today in Port Sorrel: Wed 3 Mar\n<b>Day 2 of 3 · Wed 3 Mar<\/b> — Harbour/);
  say(ctx, state, '/replan today slower start');
  say(ctx, state, '/replan tomorrow');
  assert.deepEqual(requests(state).map((r) => [r.kind, r.dates[0]]), [['replan', '2027-03-03'], ['replan', '2027-03-04']]);
});

test('a trip without its own zone keeps the home day and no extra line; the same zone as home adds no line either', () => {
  const { ctx, state } = fresh();
  planned(ctx, state);
  assert.equal(ctx.tgTripGet(TRIP).tz, '');
  say(ctx, state, '/today');
  assert.match(texts(state).pop(), /^<b>Day 1 of 3 · Tue 2 Mar<\/b> — Arrival/);
  say(ctx, state, '/replan today');
  assert.equal(requests(state).pop().dates[0], '2027-03-02');
  ctx.tgTripSetTz(TRIP, 'America/Toronto');   // same offset as home right now
  say(ctx, state, '/today');
  assert.match(texts(state).pop(), /^<b>Day 1 of 3/);
});

test('trip zone bookkeeping: tgTripSetTz refuses bad zones, tgTripUpsert throws on one, tgTripCurrent and tgOwnerTz use each trip zone', () => {
  const { ctx } = fresh();
  ctx.tgTripUpsert({ slug: TRIP, destination: 'Port Sorrel', start: '2027-03-03', end: '2027-03-05', status: 'planned' });
  assert.equal(ctx.tgTripCurrent().slug, TRIP, 'upcoming at home, so still current');
  assert.equal(ctx.tgTripInProgress(ctx.tgTripGet(TRIP)), false, 'home day 2 Mar is before the start');
  assert.equal(ctx.tgOwnerTz(), HOME);
  assert.equal(ctx.tgTripSetTz(TRIP, 'Mars/Olympus'), false);
  assert.equal(ctx.tgTripSetTz('no-such-trip', AWAY), false);
  assert.throws(() => ctx.tgTripUpsert({ slug: TRIP, tz: 'Mars/Olympus' }), /IANA/);
  assert.equal(ctx.tgTripSetTz(TRIP, AWAY), true);
  assert.equal(ctx.tgTripSetTz(TRIP, AWAY), false, 'unchanged');
  assert.equal(ctx.tgTripInProgress(ctx.tgTripGet(TRIP)), true, 'already 3 Mar in Auckland');
  assert.equal(ctx.tgTripToday(TRIP), '2027-03-03');
  // A10: the owner is taken to be there once the first day starts (09:00 by default), not at the trip's midnight.
  assert.equal(ctx.tgOwnerTz(), HOME, 'A10: 08:00 on the first day is before it starts');
  ctx.__TEST_NOW = '2027-03-02T20:00:00Z';   // 09:00 Wed 3 Mar in Auckland
  assert.equal(ctx.tgOwnerTz(), AWAY);
  ctx.tgTripUpsert({ slug: 'other-trip', destination: 'Elsewhere', start: '2027-03-02', end: '2027-03-02', status: 'planned' });
  assert.equal(ctx.tgTripCurrent().slug, 'other-trip', 'start order: the home-zone trip in progress today comes first');
  assert.equal(J(ctx.buildSnapshot().tour_guide).trips.find((x) => x.slug === TRIP).tz, AWAY, 'the snapshot carries tz');
});

test('a Trips tab made before tz gets the column on first use; old rows read back with tz ""', () => {
  const { ctx, state } = fresh();
  ctx.tgTripUpsert({ slug: TRIP, destination: 'Port Sorrel' });
  const tab = ctx.getSheet('Trips');
  const head = () => tab.getRange(1, 1, 1, tab.getLastColumn()).getValues()[0];
  tab.getRange(1, head().indexOf('tz') + 1, 1, 1).setValues([['']]);
  assert.ok(!head().includes('tz'));
  assert.equal(ctx.tgTripGet(TRIP).tz, '');
  planned(ctx, state, { tz: AWAY });
  assert.ok(head().includes('tz'));
  assert.equal(ctx.tgTripGet(TRIP).tz, AWAY);
});

test('/review and the daily offer judge "ended" in the trip zone', () => {
  const { ctx } = fresh({ now: '2027-03-05T12:00:00Z' });   // 6 Mar 01:00 in Auckland · 5 Mar 07:00 in New York
  ctx.tgTripUpsert({ slug: TRIP, destination: 'Port Sorrel', start: '2027-03-02', end: '2027-03-05', status: 'planned' });
  assert.equal(ctx.tgRvPickTrip('').slug, TRIP, 'falls back to the current trip');
  ctx.tgTripUpsert({ slug: 'other-trip', destination: 'Elsewhere', start: '2027-03-09', end: '2027-03-10', status: 'planned' });
  ctx.settingSet(ctx.TG_SETTINGS.CURRENT_TRIP, 'other-trip', 'test');
  assert.equal(ctx.tgRvPickTrip('').slug, 'other-trip', 'at home 5 Mar the trip has not ended');
  ctx.tgTripSetTz(TRIP, AWAY);
  assert.equal(ctx.tgRvPickTrip('').slug, TRIP, 'in Auckland it is 6 Mar: the trip has ended');
});

/* ---------------- Contract C10 acceptance ---------------- */
const c10 = () => digest({ tz: AWAY, days: [
  day('2027-03-02', 'Arrival', { spare_minutes: 45,
    stops: [stop(1, 'quay-steps', 'Quay Steps', { time_style: 'about', check_on_day: 'Ferry runs only at low tide — check the board.' }),
      stop(2, 'lantern-museum', 'Lantern Museum', { time_style: 'exact' })],
    legs: [{ from: 'quay-steps', to: 'lantern-museum', mode: 'WALK', minutes: 25, estimated: true, distance_m: 1800, flags: ['footpath', 'uphill'], taxi_minutes: 7, buffer_minutes: 10 }] }),
  day('2027-03-03', 'Harbour', { spare_minutes: 0 }), day('2027-03-04', 'Hills')] });

test('C10: every new field is accepted, stored and read back (spare_minutes on the day, stop and leg extras pass through)', () => {
  const { ctx, state } = fresh();
  assert.deepEqual(J(ctx.tgEnvValidatePlanDigest(c10())), []);
  planned(ctx, state, c10());
  const days = J(ctx.tgDigestDays(TRIP));
  assert.deepEqual(days.map((d) => d.spare_minutes), [45, 0, null]);
  assert.deepEqual(days[0].stops.map((s) => [s.time_style, s.check_on_day]), [['about', 'Ferry runs only at low tide — check the board.'], ['exact', undefined]]);
  assert.deepEqual(days[0].legs[0], c10().days[0].legs[0]);
  assert.equal(ctx.tgTripGet(TRIP).tz, AWAY);
});

test('C10: each out-of-bounds value and each unknown key is refused', () => {
  const { ctx } = fresh();
  const cases = {
    'tz pattern': (d) => { d.tz = '+13:00'; },
    'tz unknown zone': (d) => { d.tz = 'Mars/Olympus'; },
    'tz not a string': (d) => { d.tz = 13; },
    'spare below 0': (d) => { d.days[0].spare_minutes = -1; },
    'spare above 1440': (d) => { d.days[0].spare_minutes = 1441; },
    'spare not integer': (d) => { d.days[0].spare_minutes = 4.5; },
    'time_style': (d) => { d.days[0].stops[0].time_style = 'roughly'; },
    'check_on_day empty': (d) => { d.days[0].stops[0].check_on_day = ''; },
    'check_on_day 161': (d) => { d.days[0].stops[0].check_on_day = 'x'.repeat(161); },
    'estimated false': (d) => { d.days[0].legs[0].estimated = false; },
    'estimated string': (d) => { d.days[0].legs[0].estimated = 'true'; },
    'distance_m below 0': (d) => { d.days[0].legs[0].distance_m = -1; },
    'distance_m above 500000': (d) => { d.days[0].legs[0].distance_m = 500001; },
    'flags unknown': (d) => { d.days[0].legs[0].flags = ['stairs']; },
    'flags duplicate': (d) => { d.days[0].legs[0].flags = ['uphill', 'uphill']; },
    'flags five': (d) => { d.days[0].legs[0].flags = ['footpath', 'trail', 'uphill', 'downhill', 'footpath']; },
    'flags not array': (d) => { d.days[0].legs[0].flags = 'uphill'; },
    'taxi above 1440': (d) => { d.days[0].legs[0].taxi_minutes = 1441; },
    'buffer above 120': (d) => { d.days[0].legs[0].buffer_minutes = 121; },
    'buffer below 0': (d) => { d.days[0].legs[0].buffer_minutes = -5; },
    'unknown top key': (d) => { d.timezone = AWAY; },
    'unknown day key': (d) => { d.days[0].spare = 5; },
    'unknown stop key': (d) => { d.days[0].stops[0].booking = 'x'; },
    'unknown leg key': (d) => { d.days[0].legs[0].steps = 2; }
  };
  Object.entries(cases).forEach(([name, mutate]) => {
    const d = c10();
    mutate(d);
    assert.ok(ctx.tgEnvValidatePlanDigest(d).length > 0, name + ' must be refused');
  });
});

test('C10: an old digest (no new fields) still validates, stores and shows; old DayPlans rows read back with spare_minutes null', () => {
  const { ctx, state } = fresh();
  const old = digest();
  assert.deepEqual(J(ctx.tgEnvValidatePlanDigest(old)), []);
  const tab = ctx.getSheet('DayPlans');
  const head = () => tab.getRange(1, 1, 1, tab.getLastColumn()).getValues()[0];
  tab.getRange(1, head().indexOf('meta_json') + 1, 1, 1).setValues([['']]);   // a tab made before meta_json
  planned(ctx, state);
  assert.ok(head().includes('meta_json'), 'the column is added on first store');
  assert.deepEqual(J(ctx.tgDigestDays(TRIP)).map((d) => d.spare_minutes), [null, null, null]);
  say(ctx, state, '/day 2');
  assert.match(texts(state).pop(), /<b>Day 2 of 3 · Wed 3 Mar<\/b> — Harbour/);
});

// Developed by: LightAISolutions
