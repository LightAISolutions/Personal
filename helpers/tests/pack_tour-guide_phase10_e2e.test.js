'use strict';
// Tour Guide pack — Phase 10 end to end (coordinator): a plan_digest carrying the Contract C10 fields goes through the
// mailbox into the core's day plans and comes back out as the day card, abroad on the trip's own day; a bookings envelope
// shows in /trip with both times and in the day card, a test reminder arrives, and reminders stop after ✅ Booked; the
// brochure's practical page opens with the trip's bookings.
// Invented data: home America/Denver, the trip "Port Sorrel" kept in Pacific/Auckland.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');

const HOME = 'America/Denver';
const AWAY = 'Pacific/Auckland';
const ON_TRIP = '2027-03-02T19:00:00Z';   // 08:00 Wed 3 Mar in Auckland (UTC+13) · 12:00 Tue 2 Mar in Denver (UTC-7)
const BEFORE = '2027-02-25T17:00:00Z';    // 06:00 Fri 26 Feb in Auckland · 10:00 Thu 25 Feb in Denver
const TRIP = 'port-sorrel';
const J = (v) => JSON.parse(JSON.stringify(v));
const maps = (id) => 'https://www.google.com/maps/search/?api=1&query=Fixture&query_place_id=' + id;

function fresh(now) {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now, tz: HOME });
  H.bootstrap(ctx, state);
  ['RESEARCH', 'PLAN', 'PREFS', 'NOTES', 'BROCHURE', 'PLACES'].forEach((n) => H.configureRoutine(ctx, state, n));
  return { ctx, state };
}
const post = (ctx, state, upd) => ctx.doPost(H.postEvent('tg', { k: state.props[ctx.PROP.WEBHOOK_SECRET] }, upd));
const say = (ctx, state, text) => post(ctx, state, H.tgUpdate({ text }));
const sent = (state) => state.fetch.telegram('sendMessage').map((r) => r.json);
/** Everything the bot sent after the command (one command can send several messages). */
function reply(ctx, state, text) { const n = sent(state).length; say(ctx, state, text); return sent(state).slice(n); }
const joined = (msgs) => msgs.map((m) => m.text).join('\n');
function deliver(ctx, state, type, payload) {
  H.putEnvelope(state, H.envelope(type, payload));
  return J(ctx.pollFromBrain());
}

/** The trip's middle day with every C10 field the planner now writes (the brain's digest builder passes them through). */
const harbourDay = () => ({ date: '2027-03-03', theme: 'Harbour', spare_minutes: 70, warnings: ['Transit times on this day are estimates.'],
  stops: [
    { n: 1, slug: 'rope-loft', name: 'Rope Loft', arrive: '11:50', depart: '12:55', minutes: 65, maps_url: maps('FixtureB'), time_style: 'about',
      note_line: 'Arrive at opening, before the tour groups. Cash only.', check_on_day: 'Opening days vary — check before you go' },
    { n: 2, slug: 'tide-tour', name: 'Tide Tour', arrive: '13:20', depart: '14:30', minutes: 70, maps_url: maps('FixtureC'), time_style: 'exact', note_line: 'A short harbour boat tour.' },
    { n: 3, slug: 'signal-hill-lookout', name: 'Signal Hill Lookout', arrive: '15:10', depart: '15:40', minutes: 30, maps_url: maps('FixtureD'), time_style: 'about', note_line: 'Views over the bay.' }],
  legs: [
    { from: 'lodging', to: 'rope-loft', mode: 'WALK', minutes: 22, distance_m: 1700, buffer_minutes: 3, maps_url: maps('FixtureLeg1') },
    { from: 'rope-loft', to: 'tide-tour', mode: 'WALK', minutes: 20, estimated: true, buffer_minutes: 5 },
    { from: 'tide-tour', to: 'signal-hill-lookout', mode: 'WALK', minutes: 31, distance_m: 1400, flags: ['footpath', 'uphill'], taxi_minutes: 11, buffer_minutes: 10 },
    { from: 'signal-hill-lookout', to: 'lodging', mode: 'WALK', minutes: 25, distance_m: 1500, flags: ['downhill'] }] });
const plainDay = (date, theme) => ({ date, theme, legs: [], warnings: [],
  stops: [{ n: 1, slug: 'quay-steps-' + date.slice(-2), name: theme + ' stop', arrive: '10:00', depart: '11:00', minutes: 60, maps_url: maps('FixtureA'), note_line: 'A note.' }] });
const digest = () => ({ v: 1, kind: 'plan_digest', trip: TRIP, build_id: 'build-p10-e2e', tz: AWAY, verified_on: '2027-02-20',
  days: [plainDay('2027-03-02', 'Arrival'), harbourDay(), plainDay('2027-03-04', 'Hills')], later: [],
  drive: { plan: 'fixtureDrivePlanFile01', brochure_html: null, brochure_pdf: null } });
function planned(ctx, state) {
  ctx.tgTripUpsert({ slug: TRIP, title: 'Port Sorrel', destination: 'Port Sorrel' });
  assert.equal(deliver(ctx, state, 'plan_digest', digest()).processed, 1);
  ctx.settingSet(ctx.TG_SETTINGS.CURRENT_TRIP, TRIP, 'test');
}

test('a plan_digest with the C10 fields goes through the mailbox and comes back as the day card, on the trip\'s own day', () => {
  const { ctx, state } = fresh(ON_TRIP);
  planned(ctx, state);
  const stored = J(ctx.tgDigestDays(TRIP))[1];
  assert.equal(stored.spare_minutes, 70);
  assert.deepEqual([stored.stops[0].time_style, stored.stops[0].check_on_day, stored.legs[1].estimated, stored.legs[2].flags, stored.legs[2].taxi_minutes, stored.legs[0].buffer_minutes],
    ['about', 'Opening days vary — check before you go', true, ['footpath', 'uphill'], 11, 3]);
  const t = joined(reply(ctx, state, '/today'));
  assert.match(t, /^📍 Today in Port Sorrel: Wed 3 Mar\n<b>Day 2 of 3 · Wed 3 Mar<\/b> — Harbour/);
  assert.match(t, /<i>↳ <a href="[^"]+FixtureLeg1">walk 22 min<\/a> · \+3 min spare<\/i>/);
  assert.match(t, /<i>↳ about 20 min walk \(estimate\) · \+5 min spare<\/i>/);
  assert.match(t, /<i>↳ walk 31 min · footpath · uphill · taxi about 11 min · \+10 min spare<\/i>/);
  assert.match(t, /<i>↳ walk 25 min back to your lodging · downhill<\/i>/);
  assert.match(t, /<b>1\.<\/b> about 11:45 <a href="[^"]+">Rope Loft<\/a>/);
  assert.match(t, /<b>2\.<\/b> 13:20–14:30 <a href="[^"]+">Tide Tour<\/a>/);
  assert.match(t, /🕑 <i>Opening days vary — check before you go<\/i>/);
  assert.match(t, /<i>Cash only\.<\/i>/);
  assert.doesNotMatch(t, /at opening/, 'a noon stop loses its "arrive at opening" advice');
  assert.match(t, /\nSpare time: 1 h 10 min\n/);
  const d1 = joined(reply(ctx, state, '/day 1'));
  assert.match(d1, /<b>1\.<\/b> 10:00–11:00 <a href="[^"]+">Arrival stop<\/a> · 1 h/, 'a day without the new fields keeps its exact times');
  assert.doesNotMatch(d1, /Spare time|about \d|estimate/);
});

test('a bookings envelope: /trip shows the rule and both times, the day card lists the day\'s bookings, a test reminder arrives and stops after ✅ Booked', () => {
  const { ctx, state } = fresh(BEFORE);
  planned(ctx, state);
  const bookings = [
    { id: 'tide-tour-seats', title: 'Tide Tour seats', kind: 'experience', rule: 'Seats sell out; book a day ahead', status: 'todo', place: 'tide-tour',
      for_date: '2027-03-03', book_by: '2027-03-03T12:00:00+13:00', how: 'the tour desk', url: 'https://tours.example.org/tide' },
    { id: 'harbour-lane-guesthouse', title: 'Harbour Lane Guesthouse', kind: 'lodging', rule: 'Booked for the whole stay', status: 'booked', for_date: '2027-03-02' },
    { id: 'lantern-supper', title: 'Lantern supper', kind: 'meal', rule: 'Walk-ins only on weekdays', status: 'not_needed', for_date: '2027-03-03' }];
  assert.equal(deliver(ctx, state, 'bookings', { v: 1, kind: 'bookings', trip: TRIP, tz: AWAY, bookings }).processed, 1);
  const trip = joined(reply(ctx, state, '/trip'));
  assert.match(trip, /🎟 <b>Bookings<\/b> — 1 to make/);
  assert.match(trip, /🎟 <b>Tide Tour seats<\/b>\n {3}Seats sell out; book a day ahead · the tour desk\n {3}book by Wed 3 Mar 12:00 in Port Sorrel · Tue 2 Mar 4:00 pm your time/);
  assert.match(trip, /✅ 1 booked · 1 not needed/);
  const card = joined(reply(ctx, state, '/day 2'));
  assert.match(card, /\n🎟 Tide Tour seats · ⏳ still to book — Seats sell out; book a day ahead/);
  assert.doesNotMatch(card, /Lantern supper/, 'a "not needed" booking stays off the day card');
  const reminder = reply(ctx, state, '/bookings now').find((m) => /^⏰/.test(m.text));
  assert.ok(reminder, 'the test reminder arrived');
  assert.match(reminder.text, /Tide Tour seats/);
  const booked = reminder.reply_markup.inline_keyboard.flat().find((b) => /Booked$/.test(b.text));
  post(ctx, state, H.tgUpdate({ callback: booked.callback_data, messageId: 5151, messageText: reminder.text.replace(/<[^>]+>/g, ''), replyMarkup: reminder.reply_markup }));
  const row = J(ctx.tgBkAll(TRIP)).find((b) => b.id === 'tide-tour-seats');
  assert.deepEqual([row.status, row.status_by], ['booked', 'owner']);
  const after = reply(ctx, state, '/bookings now');
  assert.ok(after.every((m) => !/^⏰/.test(m.text)), 'no reminder after ✅ Booked');
  assert.match(joined(after), /Nothing to book right now/);
  assert.match(joined(reply(ctx, state, '/day 2')), /\n🎟 Tide Tour seats · ✅ booked/);
});

test('the brochure\'s practical page carries the trip\'s bookings in both zones (toBrochureModel wiring)', async () => {
  const bm = await import('../packs/tour-guide/brochure-map/index.mjs');
  const kit = await import('../kits/brochure/index.mjs');
  const { sampleInput } = await import('../packs/tour-guide/brochure-map/brochure-map-sample.mjs');
  const input = sampleInput();
  assert.equal(bm.toBrochureModel(input).practical.some((s) => s.title === 'Bookings'), false, 'no bookings, no section');
  input.trip.bookings = [
    { id: 'quayside-rooms', title: 'Quayside Rooms', kind: 'lodging', rule: 'Booked for both nights', status: 'booked', for_date: '2027-05-13' },
    { id: 'slate-museum-tour', title: 'Slate Museum guided tour', kind: 'sight', rule: 'Tours sell out; book ahead', status: 'todo',
      for_date: '2027-05-13', book_by: '2027-05-10T18:00:00+01:00', url: 'https://tickets.example.org/slate' },
    { id: 'pier-supper', title: 'Pier supper', kind: 'meal', rule: 'Walk-ins welcome', status: 'not_needed', for_date: '2027-05-13' }];
  input.options = { ...input.options, owner_tz: 'America/Denver', now: '2027-04-20T12:00:00Z' };
  const m = bm.toBrochureModel(input);
  const sec = m.practical[0];
  assert.equal(sec.title, 'Bookings', 'the practical page opens with the bookings');
  assert.deepEqual(sec.items.map((i) => i.label), ['Slate Museum guided tour', 'Quayside Rooms'], 'still to book first, "not needed" left out');
  assert.match(sec.items[0].text, /Book by .+ local time \(.+ your time\)\./);
  assert.match(sec.items[0].text, /Still to book\.$/);
  assert.equal(sec.items[0].url, 'https://tickets.example.org/slate');
  assert.equal(sec.items[1].url, undefined, 'a booked record carries no booking link');
  assert.deepEqual(kit.validate(m), []);
  assert.deepEqual(kit.semanticErrors(m), []);
});

// Developed by: LightAISolutions
