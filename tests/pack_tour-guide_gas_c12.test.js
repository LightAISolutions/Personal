'use strict';
// Tour Guide pack — WP-12b (Contract C12): the C12 digest fields in both validators (the pack's schema + checks and the
// core's GAS mirror), their storage in Trips (country_code) and DayPlans (leave_by, areas in meta_json; stop and leg
// fields inside stops_json / legs_json), the parts top line, and an old digest reading exactly as before.
// Invented world: helpers/tests/pack_tour-guide_phase12_world.js.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const W = require('./pack_tour-guide_phase12_world');
const { H, J, TRIP, DATES } = W;

const S = () => import('../packs/tour-guide/schemas/index.mjs');
function gasErrors(ctx, type, payload) {
  const raw = JSON.stringify(H.envelope(type, payload));
  return J(ctx.validateEnvelope(raw, Buffer.byteLength(raw))).errors || [];
}
const L = (n) => 'x'.repeat(n);
const s1 = (x) => x.days[1].stops[0];
const BAD = {
  'country_code lower case': (x) => { x.country_code = 'zz'; },
  'country_code three letters': (x) => { x.country_code = 'ZZZ'; },
  'country_code number': (x) => { x.country_code = 12; },
  'leave_by 8:45': (x) => { x.days[1].leave_by = '8:45'; },
  'leave_by 24:00': (x) => { x.days[1].leave_by = '24:00'; },
  'areas empty': (x) => { x.days[1].areas = []; },
  'areas 3': (x) => { x.days[1].areas = ['A', 'B', 'C']; },
  'area empty string': (x) => { x.days[1].areas = ['']; },
  'area 61': (x) => { x.days[1].areas = [L(61)]; },
  'areas a string': (x) => { x.days[1].areas = 'Lark Bay'; },
  'stop visited false': (x) => { s1(x).visited = false; },
  'stop visited "true"': (x) => { s1(x).visited = 'true'; },
  'stop local_name empty': (x) => { s1(x).local_name = ''; },
  'stop local_name 81': (x) => { s1(x).local_name = L(81); },
  'stop address 161': (x) => { s1(x).address = L(161); },
  'stop payment 81': (x) => { s1(x).payment = L(81); },
  'stop close 25:00': (x) => { s1(x).close = '25:00'; },
  'stop unknown key': (x) => { s1(x).opening = '09:00'; },
  'stations on a WALK leg': (x) => { x.days[1].legs[1].stations = { from: 'A', to: 'B' }; },
  'stations without to': (x) => { delete x.days[1].legs[2].stations.to; },
  'stations from empty': (x) => { x.days[1].legs[2].stations.from = ''; },
  'stations from 61': (x) => { x.days[1].legs[2].stations.from = L(61); },
  'stations line 61': (x) => { x.days[1].legs[2].stations.to_line = L(61); },
  'stations unknown key': (x) => { x.days[1].legs[2].stations.exit = 'A3'; },
  'stations a string': (x) => { x.days[1].legs[2].stations = 'Lark Bay → Old Pier'; },
  'dinner local_name 81': (x) => { x.days[1].dinner.local_name = L(81); },
  'dinner address empty': (x) => { x.days[1].dinner.address = ''; },
  'dinner payment 81': (x) => { x.days[1].dinner.payment = L(81); },
  'dinner price_line 161': (x) => { x.days[1].dinner.price_line = L(161); },
  'dinner close (not a dinner field)': (x) => { x.days[1].dinner.close = '22:00'; }
};

test('both validators accept a full C12 digest at its bounds, an old digest, a visited stop and the reserved slug "here"', async () => {
  const s = await S();
  const { ctx } = W.fresh(null, { digest: false, bookings: false });
  const full = W.digest();
  assert.deepEqual(s.validatePayload('plan_digest', J(full)).errors, []);
  assert.deepEqual(gasErrors(ctx, 'plan_digest', J(full)), []);
  const edge = J(full), st = s1(edge), dn = edge.days[1].dinner, lg = edge.days[1].legs[2];
  Object.assign(st, { local_name: L(80), address: L(160), payment: L(80), close: '23:59', visited: true });
  Object.assign(dn, { local_name: 'x', address: L(160), payment: L(80), price_line: L(160) });
  lg.stations = { from: L(60), to: 'y', from_line: L(60), to_line: 'z' };
  edge.days[1].areas = [L(60), 'y'];
  edge.days[1].leave_by = '00:00';
  edge.days[1].legs[0].from = 'here';   // a re-plan from a shared location starts at "here"
  assert.deepEqual(s.validatePayload('plan_digest', J(edge)).errors, []);
  assert.deepEqual(gasErrors(ctx, 'plan_digest', J(edge)), []);
  const old = J(full);
  delete old.country_code;
  old.days.forEach((d) => {
    ['leave_by', 'areas'].forEach((k) => delete d[k]);
    d.stops.forEach((x) => ['local_name', 'address', 'payment', 'close', 'visited'].forEach((k) => delete x[k]));
    d.legs.forEach((x) => delete x.stations);
    if (d.dinner) ['local_name', 'address', 'payment', 'price_line'].forEach((k) => delete d.dinner[k]);
  });
  assert.deepEqual(s.validatePayload('plan_digest', J(old)).errors, []);
  assert.deepEqual(gasErrors(ctx, 'plan_digest', J(old)), []);
  for (const [name, mutate] of Object.entries(BAD)) {
    const x = J(full);
    mutate(x);
    assert.equal(s.validatePayload('plan_digest', J(x)).ok, false, 'node schema + checks: ' + name);
    assert.ok(gasErrors(ctx, 'plan_digest', J(x)).length > 0, 'GAS validator: ' + name);
  }
});

test('storage keeps every C12 field: country on the trip, leave_by and areas on the day, stop, leg and dinner fields', () => {
  const { ctx } = W.fresh();
  assert.equal(ctx.tgTripGet(TRIP).country_code, 'ZZ');
  const d2 = J(ctx.tgDigestDay(TRIP, DATES[1])), want = W.day2();
  assert.equal(d2.leave_by, '08:45');
  assert.deepEqual(d2.areas, ['Lark Bay']);
  assert.deepEqual(d2.stops, want.stops, 'stop fields pass through unchanged');
  assert.deepEqual(d2.legs, want.legs, 'leg stations pass through unchanged');
  assert.deepEqual(d2.dinner, want.dinner);
  assert.deepEqual(J(ctx.tgDigestDay(TRIP, DATES[2])).areas, ['Lark Bay', 'Fernmoor']);
});

test('an old digest stores and reads exactly as before: no C12 keys appear, an earlier country is kept', () => {
  const { ctx, state } = W.fresh();
  const old = W.digest({ build_id: 'build-lb-old' });
  delete old.country_code;
  old.days.forEach((d) => { delete d.leave_by; delete d.areas; });
  W.deliver(ctx, state, 'plan_digest', old);
  const d2 = J(ctx.tgDigestDay(TRIP, DATES[1]));
  assert.equal('leave_by' in d2, false);
  assert.equal('areas' in d2, false);
  assert.equal(ctx.tgTripGet(TRIP).country_code, 'ZZ', 'a digest without the field leaves the stored country alone');
  const meta = J(ctx.storeAll('DayPlans')).filter((r) => r.date === DATES[0] || String(r.date).startsWith(DATES[0]))[0].meta_json;
  assert.ok(!/leave_by|areas/.test(meta), 'meta_json holds no C12 key for an old day');
});

test('plans in parts: country_code is a top field every part repeats; a part that changes it drops the build', () => {
  const { ctx, state } = W.fresh(null, { digest: false, bookings: false });
  const all = W.digest({ build_id: 'build-lb-parts' });
  const part = (k, over = {}) => ({ ...all, ...over, part: k, parts: 2, days: k === 1 ? all.days.slice(0, 2) : all.days.slice(2), later: [] });
  W.deliver(ctx, state, 'plan_digest', part(1));
  W.deliver(ctx, state, 'plan_digest', part(2));
  assert.equal(ctx.tgTripGet(TRIP).country_code, 'ZZ');
  assert.deepEqual(J(ctx.tgDigestDays(TRIP)).map((d) => d.date), DATES);
  const b = W.digest({ build_id: 'build-lb-parts-2' });
  W.deliver(ctx, state, 'plan_digest', { ...b, part: 1, parts: 2, days: b.days.slice(0, 2), later: [] });
  W.deliver(ctx, state, 'plan_digest', { ...b, country_code: 'ZY', part: 2, parts: 2, days: b.days.slice(2), later: [] });
  assert.equal(W.audits(ctx, 'tg_parts_dropped').length, 1, 'different top fields drop the build');
  assert.equal(ctx.tgTripGet(TRIP).build_id, 'build-lb-parts');
});

// Developed by: LightAISolutions
