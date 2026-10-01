'use strict';
// Tour Guide pack — gas/10_commands.js: core_start, /profile, /trip, /today, /day, /later, /place, /places, /replan,
// /notes, /brochure, /lodging and the dy · lt · ps · pl callbacks. Trips, places and wording are invented ("Port Sorrel").
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');

const NOW = '2027-05-01T16:00:00Z';
const TRIP = 'port-sorrel';
const J = (v) => JSON.parse(JSON.stringify(v));
const maps = (id) => 'https://www.google.com/maps/search/?api=1&query=Fixture&query_place_id=' + id;

function fresh() {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: NOW });
  H.bootstrap(ctx, state);
  ['RESEARCH', 'PLAN', 'PREFS', 'NOTES', 'BROCHURE', 'PLACES'].forEach((n) => H.configureRoutine(ctx, state, n));
  return { ctx, state };
}
const post = (ctx, state, upd) => ctx.doPost(H.postEvent('tg', { k: state.props[ctx.PROP.WEBHOOK_SECRET] }, upd));
const say = (ctx, state, text) => post(ctx, state, H.tgUpdate({ text }));
const sends = (state) => state.fetch.telegram('sendMessage').map((r) => r.json);
const texts = (state) => sends(state).map((m) => m.text);
const last = (state) => texts(state).pop();
const answers = (state) => state.fetch.telegram('answerCallbackQuery').map((r) => r.json.text);
const kbData = (m) => (m && m.reply_markup ? m.reply_markup.inline_keyboard.flat().map((b) => b.callback_data) : []);
const lastKbData = (state) => kbData(sends(state).filter((j) => j.reply_markup).pop());
const allData = (state) => sends(state).flatMap(kbData);
const requests = (state) => (state.drive.listFiles('TourGuide/mailbox/to-brain') || []).filter((n) => /^req_/.test(n))
  .map((n) => JSON.parse(state.drive.readFile('TourGuide/mailbox/to-brain', n)).payload);
const reqOf = (state, kind) => requests(state).filter((r) => r.kind === kind);
function deliver(ctx, state, type, payload) {
  H.putEnvelope(state, H.envelope(type, payload));
  return J(ctx.pollFromBrain());
}
function tap(ctx, state, data, messageId) { post(ctx, state, H.tgUpdate({ callback: data, messageId: messageId || 91 })); }

const digest = (over = {}) => ({ v: 1, kind: 'plan_digest', trip: TRIP, build_id: 'build-ps-1', verified_on: '2027-04-30',
  days: [{ date: '2027-05-12', theme: 'Harbour', stops: [{ n: 1, slug: 'lantern-museum', name: 'Lantern <Museum>', arrive: '10:00', depart: '11:00',
    minutes: 60, maps_url: maps('FixtureA'), note_line: 'Start upstairs & look down.' }],
  legs: [{ from: 'lodging', to: 'lantern-museum', mode: 'WALK', minutes: 9, maps_url: maps('FixtureLeg') }, { from: 'lantern-museum', to: 'lodging', mode: 'TRANSIT', minutes: 20 }],
  warnings: ['Closes <early> on Wednesdays.'] },
  { date: '2027-05-13', theme: 'Free', stops: [], legs: [], warnings: [] }],
  later: [{ slug: 'signal-hill-lookout', name: 'Signal Hill Lookout', reason: 'owner_choice' }],
  drive: { plan: 'fixtureDrivePlanFile01', brochure_html: null, brochure_pdf: null }, ...over });
/** The planned Port Sorrel trip (12–13 May) with its digest stored and pinned as current. */
function planned(ctx, state) {
  ctx.tgTripUpsert({ slug: TRIP, title: 'Port Sorrel', destination: 'Port Sorrel' });
  assert.equal(deliver(ctx, state, 'plan_digest', digest()).processed, 1);
  ctx.settingSet(ctx.TG_SETTINGS.CURRENT_TRIP, TRIP, 'test');
}
const CB_OK = (d) => Buffer.byteLength(d) <= 64 && /^[a-z]+(:[A-Za-z0-9_.|-]+)+$/.test(d);

test('core_start offers the interview until a profile exists; /profile shows it with redo buttons', () => {
  const { ctx, state } = fresh();
  say(ctx, state, '/start');
  const n = ctx.tgIvQids('').length;
  assert.ok(n > 0);
  assert.match(last(state), new RegExp('short interview — ' + n + ' quick questions'));
  assert.deepEqual(lastKbData(state), ['pl:iv']);

  say(ctx, state, '/profile');
  assert.match(last(state), /No profile yet/);
  assert.deepEqual(lastKbData(state), ['pl:iv']);

  ctx.tgProfileSummaryStore({ text: 'Likes <quiet> mornings\nWalks a lot', updated: '2027-04-30' });
  const before = sends(state).length;
  say(ctx, state, '/start');
  assert.equal(sends(state).length, before + 1, 'only the greeting once a profile exists');

  say(ctx, state, '/profile');
  const t = last(state);
  assert.match(t, /<b>Your travel profile<\/b> <i>\(2027-04-30\)<\/i>/);
  assert.match(t, /Likes &lt;quiet&gt; mornings\nWalks a lot/);
  const data = lastKbData(state);
  const sections = J(ctx.tgIvSections()).map((s) => 'pl:ivs:' + s.id);
  assert.deepEqual(data, sections.concat(['pl:iv']));
  assert.ok(data.every(CB_OK));

  const first = ctx.tgIvSections()[0];
  tap(ctx, state, 'pl:ivs:' + first.id);
  assert.equal(ctx.flowActive('777').flow, 'interview');
  assert.equal(ctx.flowActive('777').state.section, first.id);
  tap(ctx, state, 'pl:ivs:no-such-section');
  assert.match(answers(state).pop(), /That section is gone/);
  tap(ctx, state, 'pl:zz');
  assert.match(answers(state).pop(), /Unknown button/);
  say(ctx, state, '/cancel');
  tap(ctx, state, 'pl:iv');
  assert.equal(ctx.flowActive('777').flow, 'interview');
  assert.equal(ctx.flowActive('777').state.section, null);
});

test('/trip, /day, /today and the dy buttons', () => {
  const { ctx, state } = fresh();
  for (const c of ['/trip', '/today', '/day 1', '/later', '/replan day 1', '/notes', '/brochure', '/lodging']) {
    say(ctx, state, c);
    assert.match(last(state), /No trip yet — start one with <code>\/plan &lt;destination&gt;<\/code>/, c);
  }
  planned(ctx, state);
  say(ctx, state, '/trip');
  let t = last(state);
  assert.match(t, /🧳 <b>Port Sorrel<\/b> · planned/);
  assert.match(t, /Wed 12 May → Thu 13 May \(2 days\)/);
  assert.match(t, /<i>Checked on 2027-04-30<\/i>/);
  assert.match(t, /<b>1\.<\/b> Wed 12 May — Harbour <i>\(1 stop\)<\/i>/);
  assert.match(t, /<b>2\.<\/b> Thu 13 May — Free <i>\(0 stops\)<\/i>/);
  assert.match(t, /🔖 1 on the Later list — \/later/);
  assert.deepEqual(lastKbData(state), ['dy:port-sorrel:1', 'dy:port-sorrel:2', 'pl:br:port-sorrel', 'pl:lt:port-sorrel']);

  ctx.tgTripUpsert({ slug: 'old-harbour', title: 'Old Harbour', destination: 'Old Harbour' });
  say(ctx, state, '/trip');
  assert.match(last(state), /Other trips: old-harbour — \/trip &lt;name&gt; to switch/);
  say(ctx, state, '/trip <Nowhere>');
  assert.match(last(state), /No trip matches “&lt;Nowhere&gt;”/);
  say(ctx, state, '/trip old');
  assert.match(last(state), /🧳 <b>Old Harbour<\/b> · intake[\s\S]*No day plan yet\./);
  assert.equal(ctx.settingGet(ctx.TG_SETTINGS.CURRENT_TRIP, ''), 'old-harbour');
  say(ctx, state, '/trip port sorrel');
  assert.equal(ctx.settingGet(ctx.TG_SETTINGS.CURRENT_TRIP, ''), TRIP);

  say(ctx, state, '/day 1');
  t = last(state);
  assert.match(t, /<b>Day 1 of 2 · Wed 12 May<\/b> — Harbour/);
  assert.match(t, /<i>↳ <a href="https:\/\/www\.google\.com\/maps\/search\/\?api=1&amp;query=Fixture&amp;query_place_id=FixtureLeg">9 min walk<\/a><\/i>/);
  assert.match(t, /<b>1\.<\/b> 10:00–11:00 <a href="[^"]+">Lantern &lt;Museum&gt;<\/a> · 1 h/);
  assert.match(t, /<i>Start upstairs &amp; look down\.<\/i>/);
  assert.match(t, /<i>↳ 20 min transit back to your lodging<\/i>/);
  assert.match(t, /⚠️ Closes &lt;early&gt; on Wednesdays\./);
  assert.deepEqual(lastKbData(state), ['dy:port-sorrel:2:e']);
  say(ctx, state, '/day 2027-05-13');
  assert.match(last(state), /Day 2 of 2 · Thu 13 May<\/b> — Free\n<i>A free day\.<\/i>/);
  assert.deepEqual(lastKbData(state), ['dy:port-sorrel:1:e']);
  say(ctx, state, '/day 9');
  assert.match(last(state), /No day 9 in Port Sorrel — it has days 1–2\./);
  say(ctx, state, '/day soon');
  assert.match(last(state), /Which day\?/);

  // dy buttons: send, edit in place, replan prompt, stale.
  tap(ctx, state, 'dy:port-sorrel:2');
  assert.match(last(state), /Day 2 of 2/);
  tap(ctx, state, 'dy:port-sorrel:1:e', 55);
  const ed = state.fetch.telegram('editMessageText').map((r) => r.json).pop();
  assert.match(ed.text, /Day 1 of 2/);
  assert.equal(String(ed.message_id), '55');
  tap(ctx, state, 'dy:port-sorrel:2:r');
  assert.match(last(state), /What should change on day 2 \(Thu 13 May\)\? Send <code>\/replan 2027-05-13 &lt;what to change&gt;<\/code>/);
  tap(ctx, state, 'dy:port-sorrel:7');
  assert.match(answers(state).pop(), /No day 7 any more/);
  tap(ctx, state, 'dy:gone-trip:1');
  assert.match(answers(state).pop(), /That trip is gone/);

  // /today before, during and after the trip (owner's time zone).
  say(ctx, state, '/today');
  assert.match(last(state), /Port Sorrel starts Wed 12 May \(in 11 days\) — \/day 1/);
  ctx.__TEST_NOW = '2027-05-12T15:00:00Z';
  say(ctx, state, '/today');
  assert.match(last(state), /Day 1 of 2 · Wed 12 May/);
  ctx.__TEST_NOW = '2027-05-20T15:00:00Z';
  say(ctx, state, '/today');
  assert.match(last(state), /Port Sorrel ended Thu 13 May\. How was it\? \/review/);
});

test('/later and the lt buttons: pick a day, promote through a replan request, stale lists refused', () => {
  const { ctx, state } = fresh();
  planned(ctx, state);
  say(ctx, state, '/later');
  assert.match(last(state), /🔖 <b>Later — Port Sorrel<\/b>\n<b>1\.<\/b> Signal Hill Lookout — <i>saved by you<\/i>/);
  const tag = ctx.tgCmdTag('signal-hill-lookout');
  assert.deepEqual(lastKbData(state), ['lt:port-sorrel:0.' + tag]);
  tap(ctx, state, 'pl:lt:port-sorrel');
  assert.match(last(state), /Later — Port Sorrel/);

  tap(ctx, state, 'lt:port-sorrel:0.' + tag);
  assert.match(last(state), /Move <b>Signal Hill Lookout<\/b> onto which day\?/);
  assert.deepEqual(lastKbData(state), ['lt:port-sorrel:0.' + tag + ':1', 'lt:port-sorrel:0.' + tag + ':2']);
  tap(ctx, state, 'lt:port-sorrel:0.' + tag + ':2', 66);
  const r = reqOf(state, 'replan');
  assert.equal(r.length, 1);
  assert.deepEqual({ trip: r[0].trip, dates: r[0].dates, promote: r[0].promote, reason: r[0].reason },
    { trip: TRIP, dates: ['2027-05-13'], promote: ['signal-hill-lookout'], reason: 'promoted from the Later list' });
  assert.match(answers(state).pop(), /Replanning day 2/);
  assert.deepEqual(J(state.fetch.telegram('editMessageReplyMarkup').map((x) => x.json).pop().reply_markup), { inline_keyboard: [] });

  tap(ctx, state, 'lt:port-sorrel:0.ffff');
  assert.match(answers(state).pop(), /That list has changed/);
  tap(ctx, state, 'lt:port-sorrel:0.' + tag + ':9');
  assert.match(answers(state).pop(), /No such day/);

  ctx.tgTripUpsert({ slug: 'old-harbour', title: 'Old Harbour', destination: 'Old Harbour' });
  say(ctx, state, '/trip old');
  say(ctx, state, '/later');
  assert.match(last(state), /The Later list of Old Harbour is empty\./);
});

test('/places, /place and the ps buttons (note · add · check); long slugs travel as list indexes', () => {
  const { ctx, state } = fresh();
  say(ctx, state, '/places');
  assert.match(last(state), /No places yet/);
  planned(ctx, state);
  ctx.tgPlacesUpsert({ destination: 'port-sorrel', places: [
    { slug: 'lantern-museum', name: 'Lantern <Museum>', area: 'Old harbour', tags: ['museum'], status: 'open', note_line: 'Start upstairs.', maps_url: maps('FixtureA') },
    { slug: 'tea-house', name: 'Tea House', area: 'Hill', tags: ['tea'], status: 'open', last_trip: 'port-sorrel-2026', note_line: 'Pot of the day.', maps_url: maps('FixtureT') }] });
  say(ctx, state, '/places');
  assert.match(last(state), /📚 <b>Places I know<\/b>\nport-sorrel — 2/);
  say(ctx, state, '/places museum');
  let t = last(state);
  assert.match(t, /1 match<\/b>/);
  assert.match(t, /<b>1\.<\/b> <a href="[^"]+">Lantern &lt;Museum&gt;<\/a> · open · Old harbour\n   <i>Start upstairs\.<\/i>/);
  assert.deepEqual(lastKbData(state), ['ps:lantern-museum:n', 'ps:lantern-museum:a', 'ps:lantern-museum:c']);
  say(ctx, state, '/places <zzz>');
  assert.match(last(state), /No place matches “&lt;zzz&gt;”/);

  say(ctx, state, '/place');
  assert.match(last(state), /Which place\?/);
  say(ctx, state, '/place lantern');
  t = last(state);
  assert.match(t, /📍 <b><a href="[^"]+">Lantern &lt;Museum&gt;<\/a><\/b>\nDay 1 · Wed 12 May\nStart upstairs &amp; look down\./);
  assert.deepEqual(lastKbData(state), ['ps:lantern-museum:n']);
  say(ctx, state, '/place signal');
  assert.match(last(state), /🔖 Later — <i>saved by you<\/i>\n<i>No note line yet\.<\/i>/);
  say(ctx, state, '/place tea');
  assert.match(last(state), /Tea House<\/a><\/b>\n<i>open<\/i>\nPot of the day\./);
  say(ctx, state, '/place <nothing>');
  assert.match(last(state), /Nothing called “&lt;nothing&gt;”/);

  tap(ctx, state, 'ps:lantern-museum:n');
  assert.deepEqual(J(reqOf(state, 'notes').map((r) => [r.trip, r.places])), [[TRIP, ['lantern-museum']]]);
  tap(ctx, state, 'ps:tea-house:a');
  assert.match(answers(state).pop(), /Added/);
  assert.match(last(state), /🔖 <b>Tea House<\/b> is on the Later list of Port Sorrel\. Put it on a day now\?/);
  const tag = ctx.tgCmdTag('tea-house');
  assert.deepEqual(lastKbData(state), ['lt:port-sorrel:1.' + tag + ':1', 'lt:port-sorrel:1.' + tag + ':2']);
  assert.deepEqual(J(ctx.tgLaterList(TRIP)).map((e) => e.place_slug), ['signal-hill-lookout', 'tea-house']);
  tap(ctx, state, 'ps:tea-house:c');
  const ck = reqOf(state, 'places');
  assert.deepEqual(J(ck.map((r) => [r.scope, r.destination, r.slugs])), [['check', 'port-sorrel', ['tea-house']]]);
  tap(ctx, state, 'ps:tea-house:x');
  assert.match(answers(state).pop(), /Unknown button/);

  const long = 'a-place-with-a-really-long-slug-that-does-not-fit-in-callback-data';
  const keys = J(ctx.tgCmdPlaceKeys(['tea-house', long]));
  assert.deepEqual(keys, ['tea-house', '.1']);
  assert.equal(ctx.tgCmdPlaceByKey('.1').slug, long);
  assert.equal(ctx.tgCmdPlaceByKey('.7'), null);
  tap(ctx, state, 'ps:.7:n');
  assert.match(answers(state).pop(), /That list has changed/);
});

test('requests: /replan, /notes, /brochure (resend or build), /lodging, pl:br and pl:rp', () => {
  const { ctx, state } = fresh();
  planned(ctx, state);
  say(ctx, state, '/replan');
  assert.match(last(state), /Usage: <code>\/replan &lt;date or day N&gt;/);
  say(ctx, state, '/replan day 7 later');
  assert.match(last(state), /That day is not in the plan of Port Sorrel/);
  say(ctx, state, '/replan day 2 more time at the <market>');
  let r = reqOf(state, 'replan');
  assert.deepEqual(J(r.map((x) => [x.trip, x.dates, x.reason])), [[TRIP, ['2027-05-13'], 'more time at the <market>']]);
  assert.match(last(state), /🔁 Replanning Thu 13 May…/);
  ctx.__TEST_NOW = '2027-05-12T15:00:00Z';
  say(ctx, state, '/replan tomorrow');
  r = reqOf(state, 'replan');
  assert.deepEqual(J(r[1].dates), ['2027-05-13']);
  assert.equal(r[1].reason, undefined);

  say(ctx, state, '/notes');
  say(ctx, state, '/notes Lantern, <Nowhere>');
  say(ctx, state, '/notes Nowhere');
  assert.match(last(state), /None of those is in the plan of Port Sorrel/);
  const notes = reqOf(state, 'notes');
  assert.deepEqual(J(notes.map((x) => [x.trip, x.places || null])), [[TRIP, null], [TRIP, ['lantern-museum']]]);
  assert.ok(texts(state).some((x) => /📝 Writing 1 note… \(not in the plan: &lt;Nowhere&gt;\)/.test(x)));

  say(ctx, state, '/brochure');
  assert.deepEqual(J(reqOf(state, 'brochure').map((x) => [x.trip, x.build_id])), [[TRIP, 'build-ps-1']]);
  const f = state.drive.putFile('TourGuide/Trips', 'port-sorrel-brochure.pdf', '%PDF-fixture', 'application/pdf');
  ctx.tgTripUpsert({ slug: TRIP, drive_brochure_pdf: f.getId() });
  say(ctx, state, '/brochure');
  const doc = state.fetch.telegram('sendDocument').pop();
  assert.ok(doc, 'the stored PDF is resent');
  assert.equal(reqOf(state, 'brochure').length, 1, 'no new request when the PDF is there');
  ctx.tgTripUpsert({ slug: TRIP, drive_brochure_pdf: 'fixtureMissingFile' });
  tap(ctx, state, 'pl:br:port-sorrel');
  assert.equal(reqOf(state, 'brochure').length, 2, 'a missing PDF falls back to a build request');
  tap(ctx, state, 'pl:br:gone-trip');
  assert.match(answers(state).pop(), /That trip is gone/);

  tap(ctx, state, 'pl:rp:port-sorrel');
  assert.match(last(state), /Which day should change\?/);
  assert.deepEqual(lastKbData(state), ['dy:port-sorrel:1:r', 'dy:port-sorrel:2:r']);
  tap(ctx, state, 'pl:rp:gone-trip');
  assert.match(answers(state).pop(), /No day plan to change/);

  say(ctx, state, '/lodging');
  assert.match(last(state), /Where are you staying\?/);
  say(ctx, state, '/lodging Old Mill <Hostel>, 3 nights');
  assert.match(last(state), /🏨 Saved for Port Sorrel: Old Mill &lt;Hostel&gt;, 3 nights/);
  assert.deepEqual(J(ctx.tgTripGet(TRIP).lodging), { text: 'Old Mill <Hostel>, 3 nights', nights: 3 });
  say(ctx, state, '/lodging');
  assert.match(last(state), /Staying: Old Mill &lt;Hostel&gt;, 3 nights/);
  say(ctx, state, '/trip');
  assert.match(last(state), /Staying: Old Mill &lt;Hostel&gt;, 3 nights/);
  assert.equal(ctx.tgCmdLodgingText(ctx.tgTripGet(TRIP)), 'Old Mill <Hostel>, 3 nights');
  assert.equal(ctx.tgCmdLodgingText({ lodging: { text: 'Inn', nights: 2 } }), 'Inn (2 nights)');
  assert.equal(ctx.tgCmdLodgingText({}), '');
});

test('limits: long trip slugs use a hash key, every button fits 64 bytes, long views split', () => {
  const { ctx, state } = fresh();
  const slug = 'a-very-long-trip-slug-for-the-north-coast-2027';
  ctx.tgTripUpsert({ slug, title: 'North Coast', destination: 'North Coast' });
  const days = Array.from({ length: 9 }, (_, i) => ({ date: '2027-06-' + String(i + 1).padStart(2, '0'), theme: 'Day ' + (i + 1),
    stops: Array.from({ length: 12 }, (_, j) => ({ n: j + 1, slug: 'stop-' + i + '-' + j, name: 'Stop ' + j + ' ' + 'x'.repeat(100), arrive: '09:00', depart: '09:30',
      minutes: 30, maps_url: maps('Fixture' + i + j), note_line: 'n'.repeat(150) })), legs: [], warnings: [] }));
  assert.equal(deliver(ctx, state, 'plan_digest', digest({ trip: slug, days, later: [] })).processed, 1);
  ctx.settingSet(ctx.TG_SETTINGS.CURRENT_TRIP, slug, 'test');
  const key = ctx.tgCmdTripKey(slug);
  assert.match(key, /^t[0-9a-f]{11}$/);
  assert.equal(ctx.tgCmdTripByKey(key).slug, slug);
  say(ctx, state, '/trip');
  assert.ok(lastKbData(state).includes('dy:' + key + ':9'));
  const n = sends(state).length;
  tap(ctx, state, 'dy:' + key + ':3:e');
  assert.ok(sends(state).length > n + 1, 'a day longer than one message is sent, not edited');
  assert.ok(sends(state).every((m) => m.text.length <= ctx.LIMITS.TG_SPLIT_AT));
  assert.ok(allData(state).every(CB_OK), allData(state).filter((d) => !CB_OK(d)).join(' '));
});

// Developed by: LightAISolutions
