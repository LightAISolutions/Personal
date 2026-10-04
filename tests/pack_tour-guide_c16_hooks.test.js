'use strict';
// TG-PHASE-16 skeleton (Contract C16): the planner's no-quiet-slot warning moved into noQuietSlotText without changing
// a character, and the day-rows hook (tgCmdDayRows) under the day card and the morning message, where Phase 16's
// 🕊 Quiet and 🍽 Menu check rows land. The row functions are stubbed here; their real rows are tested in each branch's
// own tests. Invented data only (the moving-day fixture and the Lark Bay world); no network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const W = require('./pack_tour-guide_phase12_world');
const { TRIP, DATES, J, at, fresh, say, sends, audits } = W;

const D2 = DATES[1];
const kb = (msgs) => J(msgs).filter((m) => m.keyboard).pop().keyboard.inline_keyboard;
const texts = (rows) => rows.map((r) => r.map((b) => b.text));

test('noQuietSlotText: the planner\'s warning, word for word, cut at 200 characters with the name first', async () => {
  const P = await import('../packs/tour-guide/planner/index.mjs');
  assert.equal(P.noQuietSlotText('Copperleaf Garden', '10:15'),
    'Copperleaf Garden: no quieter slot fitted (the first 60 min after opening or the last 90 before closing); planned at 10:15');
  const name = 'N'.repeat(180), cut = P.noQuietSlotText(name, '10:15');
  assert.equal(cut.length, 200);
  assert.ok(cut.startsWith(name + ': no quieter'));
  // The planner writes exactly this text: the C11 case of a visit too long for either quiet slot.
  const fixtures = await import('../packs/tour-guide/fixtures/index.mjs'), maps = await import('../kits/maps/index.mjs');
  const fx = fixtures.loadFixture('moving-day');
  fx.profile.interests = { garden: 'high' };
  const client = maps.createMapsClient({ transport: maps.createMockTransport(fixtures.createFixtureResponder(fx)), ledger: maps.createLedger() });
  const plan = await P.planTrip({ ...fx, maps: client, build_id: 'c16-no-quiet-slot', now: '2027-10-01T09:00:00Z', seed: 7 });
  const day = plan.days.find((d) => d.date === '2027-10-18'), stop = day.stops.find((s) => s.place === 'copperleaf-garden');
  assert.equal(stop.crowd_slot, undefined);
  const w = day.warnings.filter((x) => x.place === 'copperleaf-garden' && /no quieter slot/.test(x.text));
  assert.deepEqual(w.map((x) => x.text), [P.noQuietSlotText('Copperleaf Garden', stop.arrive)]);
});

/**
 * Stand-ins for the two row functions; `undefined` leaves one out, as on a core without its module (a branch module's
 * own function is replaced the same way). Returns the calls, as [which, trip slug, day date].
 */
function stub(ctx, quiet, menu) {
  const calls = [];
  const make = (which, rows) => (rows === undefined ? undefined : (trip, day) => { calls.push([which, trip.slug, day.date]); return typeof rows === 'function' ? rows() : rows; });
  ctx.tgQuietDayRows = make('quiet', quiet);
  ctx.tgMenuDayRows = make('menu', menu);
  return calls;
}
const Q1 = [{ text: '🕊 Quieter than Tide Hall', data: 'qt:lark-bay:20270611:aaaa' }];
const Q2 = [{ text: '🕊 Quieter than Glass Works', data: 'qt:lark-bay:20270611:bbbb' }];
const M1 = [{ text: '🍽 Check the menu', data: 'mn:lark-bay:20270611:cccc' }];
const NAV = ['◀ Day 1', 'Day 3 ▶'];
const LATE = ['⏰ Late 15 min', '30 min', '60 min'], REPLAN = ['📍 Re-plan from here'];
const views = (ctx) => {
  const trip = ctx.tgTripGet(TRIP), day = ctx.tgDigestDay(TRIP, D2);
  return { trip, day, card: () => kb(ctx.tgCmdDayMessages(trip, day, 3)), morning: () => kb(ctx.tgMorningMessages(trip, day, 3, null, false)) };
};

test('without the row functions, or with rows the keyboard cannot use, the day card and the morning message keep their keyboards', () => {
  const { ctx } = fresh(at(D2, '09:00'));
  const v = views(ctx);
  for (const [quiet, menu] of [[undefined, undefined], [[], [[], 'x', null]], [() => null, () => ({ rows: [M1] })]]) {
    const calls = stub(ctx, quiet, menu);
    assert.deepEqual(texts(v.card()), [NAV]);
    assert.deepEqual(texts(v.morning()), [LATE, REPLAN]);
    assert.deepEqual(J(ctx.tgMorningKeyboard(v.trip, D2, v.day)), J(ctx.tgMorningKeyboard(v.trip, D2)));
    assert.equal(calls.length, quiet === undefined ? 0 : 6, 'called for each card, morning message and keyboard asked for with its day');
  }
  assert.equal(audits(ctx, 'tg_day_rows_error').length, 0);
});

test('the rows go above the day buttons on the card and under the morning buttons, Quiet\'s first, data as given', () => {
  const { ctx } = fresh(at(D2, '09:00'));
  const v = views(ctx);
  const calls = stub(ctx, [Q1, Q2], [M1]);
  const ours = [[Q1[0].text], [Q2[0].text], [M1[0].text]], data = [Q1[0].data, Q2[0].data, M1[0].data];
  const card = v.card(), morning = v.morning();
  assert.deepEqual(texts(card), [...ours, NAV]);
  assert.deepEqual(texts(morning), [LATE, REPLAN, ...ours]);
  assert.deepEqual(card.slice(0, 3).map((r) => r[0].callback_data), data);
  assert.deepEqual(morning.slice(2).map((r) => r[0].callback_data), data);
  assert.deepEqual(calls, [['quiet', TRIP, D2], ['menu', TRIP, D2], ['quiet', TRIP, D2], ['menu', TRIP, D2]]);
  // One module alone adds only its own rows; a keyboard asked for without the day keeps the old two rows.
  stub(ctx, undefined, [M1]);
  assert.deepEqual(texts(v.card()), [[M1[0].text], NAV]);
  assert.deepEqual(texts(J(ctx.tgMorningKeyboard(v.trip, D2)).inline_keyboard), [LATE, REPLAN]);
  assert.equal(audits(ctx, 'tg_day_rows_error').length, 0);
});

test('a row function that throws, and each row the keyboard cannot carry, is audited once; the other rows still go out', () => {
  const { ctx } = fresh(at(D2, '09:00'));
  const v = views(ctx);
  const bad = [[{ text: '🍽 Too long', data: 'mn:' + 'x'.repeat(70) }], [null], [{ text: '🍽 No data' }], [{ data: 'mn:x' }], [M1[0], 'x']];
  stub(ctx, () => { throw new Error('quiet rows broke'); }, [M1, ...bad]);
  assert.deepEqual(texts(v.card()), [[M1[0].text], NAV]);
  assert.deepEqual(texts(v.morning()), [LATE, REPLAN, [M1[0].text]]);
  const a = audits(ctx, 'tg_day_rows_error');
  assert.equal(a.length, 2 * (1 + bad.length), 'per failure, on the card and in the morning message');
  assert.ok(a.every((x) => x.ref === TRIP && x.ok === 'false'));
  assert.equal(a.filter((x) => /quiet rows broke/.test(x.detail_json)).length, 2);
});

// Developed by: LightAISolutions
