'use strict';
// WP-13c (A2): every /dates refusal about a day's length says how to make the day valid, with its date filled in.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const W = require('./pack_tour-guide_p13c_world');

const NOTHING = ' — nothing was saved.';

test('A2 repro: a per-day end that leaves under two hours names the command that makes it valid', () => {
  const { ctx, state } = W.fresh();
  W.trip(ctx);
  W.say(ctx, state, '/dates hours 09:00 19:00');
  // The end the owner typed is kept; the hint moves the start earlier (three hours before the end).
  W.say(ctx, state, '/dates 2027-06-15 end Fern <Airport> 10:30');
  assert.equal(W.last(state), 'The day must end at least two hours after it starts (09:00–10:30 on Tue 15 Jun)' + NOTHING +
    ' To keep the end at 10:30, start earlier: <code>/dates 2027-06-15 hours 07:30 10:30</code>.');
  W.say(ctx, state, '/dates 2027-06-15 hours 07:30 10:30');
  assert.equal(W.last(state), '🕘 Saved for Tue 15 Jun: the day runs 07:30–10:30. The next plan or <code>/replan</code> uses it.');
  W.say(ctx, state, '/dates 2027-06-15 end Fern <Airport> 10:30');
  assert.match(W.last(state), /^🏁 Saved for Tue 15 Jun: the day ends at Fern &lt;Airport&gt; at 10:30\./, 'the hint really makes the day valid');
});

test('A2: hours, start and a day with a start point each get a hint that is valid when sent', () => {
  const { ctx, state } = W.fresh();
  W.trip(ctx);
  W.say(ctx, state, '/dates 2027-06-12 hours 10:00 11:30');
  assert.equal(W.last(state), 'The day must end at least two hours after it starts (10:00–11:30 on Sat 12 Jun)' + NOTHING +
    ' To keep the end at 11:30, start earlier: <code>/dates 2027-06-12 hours 08:30 11:30</code>.');
  // A start the owner typed is kept; the end moves later.
  W.say(ctx, state, '/dates hours 09:00 19:00');
  W.say(ctx, state, '/dates 2027-06-13 start Quay & <Steps> 18:00');
  assert.equal(W.last(state), 'The day must end at least two hours after it starts (18:00–19:00 on Sun 13 Jun)' + NOTHING +
    ' To keep the start at 18:00, end later: <code>/dates 2027-06-13 hours 18:00 21:00</code>.');
  W.say(ctx, state, '/dates 2027-06-13 hours 18:00 21:00');
  W.say(ctx, state, '/dates 2027-06-13 start Quay & <Steps> 18:00');
  assert.match(W.last(state), /^🚩 Saved for Sun 13 Jun/);
  // When a start point governs the start, the hint moves that point (its own words, escaped).
  W.say(ctx, state, '/dates 2027-06-14 start Reed <Central> Station 12:10');
  W.say(ctx, state, '/dates 2027-06-14 end Gull Inn 13:00');
  assert.equal(W.last(state), 'The day must end at least two hours after it starts (12:10–13:00 on Mon 14 Jun)' + NOTHING +
    ' To keep the end at 13:00, start earlier: <code>/dates 2027-06-14 start Reed &lt;Central&gt; Station 10:00</code>.');
  // An end too early to move the start before it (before 02:00) moves the end instead.
  W.say(ctx, state, '/dates 2027-06-11 hours 00:30 01:30');
  assert.equal(W.last(state), 'The day must end at least two hours after it starts (00:30–01:30 on Fri 11 Jun)' + NOTHING +
    ' To keep the start at 00:30, end later: <code>/dates 2027-06-11 hours 00:30 03:30</code>.');
  // A start too late to end three hours on moves the start instead (the owner's own start point, as typed).
  W.say(ctx, state, '/dates 2027-06-10 end Mill <Gate> 23:30');
  W.say(ctx, state, '/dates 2027-06-10 start Ferry 22:30');
  assert.equal(W.last(state), 'The day must end at least two hours after it starts (22:30–23:30 on Thu 10 Jun)' + NOTHING +
    ' To keep the end at 23:30, start earlier: <code>/dates 2027-06-10 start Ferry 20:30</code>.');
  W.say(ctx, state, '/dates 2027-06-10 start Ferry 20:30');
  assert.match(W.last(state), /^🚩 Saved for Thu 10 Jun: the day starts at Ferry at 20:30\./);
});

test('A2: the trip-wide /dates hours refusal names valid hours too', () => {
  const { ctx, state } = W.fresh();
  W.trip(ctx);
  W.say(ctx, state, '/dates hours 11:30 12:30');
  assert.equal(W.last(state), 'The day must end at least two hours after it starts' + NOTHING +
    ' To keep the end at 12:30, start earlier: <code>/dates hours 09:30 12:30</code>.');
  W.say(ctx, state, '/dates hours 00:10 01:00');
  assert.equal(W.last(state), 'The day must end at least two hours after it starts' + NOTHING +
    ' To keep the start at 00:10, end later: <code>/dates hours 00:10 03:10</code>.');
  W.say(ctx, state, '/dates hours 09:30 12:30');
  assert.match(W.last(state), /🕘 Saved: days of Fernhollow run 09:30–12:30/);
});

// Developed by: LightAISolutions
