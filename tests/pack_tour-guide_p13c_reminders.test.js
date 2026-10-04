'use strict';
// WP-13c (A10): the owner's zone becomes the trip's when the trip's first day starts, not at midnight, and a daily
// booking reminder never goes out within 12 hours of the previous one, so the travel day gets one reminder.
// Invented: home Etc/GMT+8 (UTC-8), the trip "Fernhollow" in Etc/GMT-5 (UTC+5) from 10 Jun 2027.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');

const HOME = 'Etc/GMT+8';
const AWAY = 'Etc/GMT-5';
const TRIP = 'fernhollow';
const J = (v) => JSON.parse(JSON.stringify(v));

function fresh(now, o = {}) {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now, tz: HOME });
  H.bootstrap(ctx, state);
  ctx.settingSet('whatson_auto', 'off', 'test');   // C15 (WP-15b): the weekly What's on check is one more alarm on the one trigger; these tests watch the reminders alone
  ctx.tgTripUpsert({ slug: TRIP, title: 'Fernhollow', destination: 'Fernhollow', status: 'planned', start: '2027-06-10', end: '2027-06-14', tz: o.tz || AWAY });
  H.putEnvelope(state, H.envelope('bookings', { v: 1, kind: 'bookings', trip: TRIP, tz: o.tz || AWAY, bookings: [
    { id: 'weir-boat', title: 'Weir boat', kind: 'experience', rule: 'Seats go fast', status: 'todo', for_date: '2027-06-13',
      opens_at: '2027-05-01T09:00:00+05:00', book_by: '2027-06-12T18:00:00+05:00' }] }));
  ctx.pollFromBrain();
  return { ctx, state };
}
const armed = (state) => state.triggers.filter((t) => t.fn === 'alarmTrigger').map((t) => t.spec.at.getTime());
const dailies = (state) => state.fetch.telegram('sendMessage').map((r) => r.json.text).filter((t) => /^⏰ <b>Bookings to make/.test(t));

/** Play the one alarm trigger from `from` to `to`: the clock moves to the next armed time or the next hour, whichever is
 *  first; every hour something re-arms the alarm (as any poll or tap does). → the instants a daily reminder went. */
function play(ctx, state, from, to) {
  const at = [], end = Date.parse(to);
  let now = Date.parse(from);
  for (let i = 0; i < 400 && now <= end; i++) {
    ctx.__TEST_NOW = new Date(now).toISOString();
    ctx.alarmArm();
    const next = armed(state)[0];
    if (next && next <= now + 61000) {   // the alarm is never armed less than a minute out
      const n = dailies(state).length;
      H.fireTriggers(ctx, state, 'alarmTrigger');
      if (dailies(state).length > n) at.push(ctx.__TEST_NOW);
    }
    const hour = (Math.floor(now / 3600000) + 1) * 3600000, nx = armed(state)[0];
    now = nx && nx > now + 61000 && nx < hour ? nx : hour;
  }
  return at;
}
const homeDate = (iso) => new Date(Date.parse(iso) - 8 * 3600000).toISOString().slice(0, 10);

test('A10 repro: the travel day gets one daily reminder, not two (the trip midnight falls after 09:00 at home)', () => {
  const { ctx, state } = fresh('2027-06-08T20:00:00Z');   // 12:00 Tue 8 Jun at home: today's reminder already went
  ctx.settingSet('tg_bk_daily', '2027-06-08', 'test');
  const sent = play(ctx, state, '2027-06-08T20:00:00Z', '2027-06-11T12:00:00Z');
  const onTravelDay = sent.filter((t) => homeDate(t) === '2027-06-09');
  assert.equal(onTravelDay.length, 1, 'one reminder on the home day of the flight: ' + sent.join(', '));
  assert.equal(onTravelDay[0], '2027-06-09T17:00:00.000Z', '09:00 at home, before the trip has begun');
  for (let i = 1; i < sent.length; i++) assert.ok(Date.parse(sent[i]) - Date.parse(sent[i - 1]) >= 12 * 3600000, 'never within 12 h: ' + sent.join(', '));
  assert.ok(sent.some((t) => t === '2027-06-11T04:00:00.000Z'), 'then 09:00 where the trip is: ' + sent.join(', '));
});

test('A10: the owner\'s zone turns to the trip\'s when the first day starts (its own start, its hours, else 09:00)', () => {
  const { ctx } = fresh('2027-06-09T19:30:00Z');   // 00:30 Thu 10 Jun where the trip is: its date has begun, its day has not
  assert.equal(ctx.tgTripToday(TRIP), '2027-06-10');
  assert.equal(ctx.tgOwnerTz(), HOME, 'midnight is not the start');
  ctx.__TEST_NOW = '2027-06-10T03:59:00Z';
  assert.equal(ctx.tgOwnerTz(), HOME);
  ctx.__TEST_NOW = '2027-06-10T04:00:00Z';   // 09:00 there
  assert.equal(ctx.tgOwnerTz(), AWAY);
  ctx.tgTripHoursSet(TRIP, '07:30', '18:00');
  ctx.__TEST_NOW = '2027-06-10T02:29:00Z';
  assert.equal(ctx.tgOwnerTz(), HOME);
  ctx.__TEST_NOW = '2027-06-10T02:30:00Z';   // 07:30 there: the trip's hours
  assert.equal(ctx.tgOwnerTz(), AWAY);
  ctx.tgTripDaySet(TRIP, '2027-06-10', { day_start: '11:00', day_end: '20:00' });
  assert.equal(ctx.tgOwnerTz(), HOME, 'the first day\'s own hours win over the trip\'s');
  ctx.tgTripDaySet(TRIP, '2027-06-10', { start: { text: 'Fern Station', time: '06:10' } });
  ctx.__TEST_NOW = '2027-06-10T01:10:00Z';   // 06:10 there: the day's own start point
  assert.equal(ctx.tgOwnerTz(), AWAY);
  ctx.__TEST_NOW = '2027-06-14T18:59:00Z';   // 23:59 on the last day
  assert.equal(ctx.tgOwnerTz(), AWAY);
  ctx.__TEST_NOW = '2027-06-14T19:00:00Z';   // the day after the trip
  assert.equal(ctx.tgOwnerTz(), HOME);
});

test('A10: /bookings now still sends at once, and a reminder within 12 h of it waits for the next day', () => {
  const { ctx, state } = fresh('2027-06-02T05:00:00Z');   // 21:00 Tue 1 Jun at home
  const post = (text) => ctx.doPost(H.postEvent('tg', { k: state.props[ctx.PROP.WEBHOOK_SECRET] }, H.tgUpdate({ text })));
  post('/bookings now');
  assert.equal(dailies(state).length, 1, 'forced: sent now');
  assert.equal(ctx.settingGet('tg_bk_daily_at', ''), '2027-06-02T05:00:00.000Z');
  // 09:00 Wed 2 Jun at home is 12 h after → it goes; had the forced one been at 22:00, the 09:00 one would wait a day.
  assert.deepEqual(J(armed(state).map((t) => new Date(t).toISOString())), ['2027-06-02T17:00:00.000Z']);
  ctx.settingSet('tg_bk_daily_at', '2027-06-02T06:00:00.000Z', 'test');   // as if forced at 22:00
  ctx.alarmArm();
  assert.deepEqual(J(armed(state).map((t) => new Date(t).toISOString())), ['2027-06-03T17:00:00.000Z'], '11 h is too soon: Thursday');
});

// Developed by: LightAISolutions
