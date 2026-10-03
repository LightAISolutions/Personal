'use strict';
// Tour Guide pack — WP-10a suggestion 6: booking deadlines and reminders (bookings envelope, Bookings tab, /trip,
// /bookings, the one alarm trigger, ✅ Booked · Not needed · Tomorrow). Invented data: home America/New_York, the trip
// "Port Sorrel" in Pacific/Auckland, starting two weeks after the test clock.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');

const HOME = 'America/New_York';
const AWAY = 'Pacific/Auckland';
const NOW = '2027-03-01T12:00:00Z';   // 07:00 Mon 1 Mar in New York (UTC-5) · 01:00 Tue 2 Mar in Auckland (UTC+13)
const TRIP = 'port-sorrel';
const J = (v) => JSON.parse(JSON.stringify(v));

function fresh(o = {}) {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: o.now || NOW, tz: HOME });
  H.bootstrap(ctx, state);
  ctx.tgTripUpsert({ slug: TRIP, title: 'Port Sorrel', destination: 'Port Sorrel', status: 'planned', start: o.start || '2027-03-15', end: o.end || '2027-03-18' });
  return { ctx, state };
}
const post = (ctx, state, upd) => ctx.doPost(H.postEvent('tg', { k: state.props[ctx.PROP.WEBHOOK_SECRET] }, upd));
const say = (ctx, state, text) => post(ctx, state, H.tgUpdate({ text }));
const sent = (state) => state.fetch.telegram('sendMessage').map((r) => r.json);
const texts = (state) => sent(state).map((m) => m.text);
const edits = (state) => state.fetch.telegram('editMessageText').map((r) => r.json);
const alarms = (state) => state.triggers.filter((t) => t.fn === 'alarmTrigger');
const armedAt = (state) => alarms(state).map((t) => t.spec.at.toISOString());
function deliver(ctx, state, payload) {
  H.putEnvelope(state, H.envelope('bookings', payload));
  return J(ctx.pollFromBrain());
}
const tower = (over = {}) => ({ id: 'clock-tower-climb', title: 'Clock tower climb', kind: 'sight', rule: 'Tickets release 14 days ahead at 10:00',
  status: 'todo', place: 'clock-tower', for_date: '2027-03-16', opens_at: '2027-03-02T10:00:00+13:00', book_by: '2027-03-10T20:00:00+13:00',
  how: 'Online only', party_min: 2, url: 'https://tickets.example.org/clock-tower', ...over });
const ferry = (over = {}) => ({ id: 'harbour-ferry', title: 'Harbour ferry', kind: 'train', rule: 'Seats sell out a week before',
  status: 'todo', for_date: '2027-03-15', opens_at: '2027-02-20T09:00:00+13:00', book_by: '2027-03-05T12:00:00+13:00', ...over });
const guesthouse = (over = {}) => ({ id: 'harbour-lane-guesthouse', title: 'Harbour Lane guesthouse', kind: 'lodging', rule: 'Pay the deposit',
  status: 'booked', ...over });
const payload = (bookings, over = {}) => ({ v: 1, kind: 'bookings', trip: TRIP, tz: AWAY, bookings, ...over });
const row = (ctx, id) => J(ctx.tgBkAll(TRIP).find((b) => b.id === id) || null);

test('bookings envelope: stored in the Bookings tab, the trip zone set, one silent notice for new to-book records, the alarm armed', () => {
  const { ctx, state } = fresh();
  const stats = deliver(ctx, state, payload([tower(), ferry(), guesthouse()]));
  assert.equal(stats.processed, 1);
  assert.equal(ctx.tgTripGet(TRIP).tz, AWAY);
  const rows = J(ctx.storeAll('Bookings'));
  assert.deepEqual(rows.map((r) => [r.trip, r.id, r.status, r.status_by]), [
    [TRIP, 'clock-tower-climb', 'todo', 'brain'], [TRIP, 'harbour-ferry', 'todo', 'brain'], [TRIP, 'harbour-lane-guesthouse', 'booked', 'brain']]);
  assert.deepEqual(JSON.parse(rows[0].record_json), tower(), 'the record is kept as sent');
  assert.equal(row(ctx, 'harbour-ferry').alerted_at, NOW.replace('Z', '.000Z'), 'opened weeks ago: no "opens soon" alert for it');
  assert.equal(row(ctx, 'clock-tower-climb').alerted_at, '');
  const notice = sent(state).pop();
  assert.equal(notice.text, '🎟 2 new bookings to make for <b>Port Sorrel</b> — /bookings');
  assert.equal(notice.disable_notification, true);
  assert.deepEqual(armedAt(state), ['2027-03-01T14:00:00.000Z'], '09:00 in New York — earlier than the opening alert at 20:30Z');
  // The same list again: nothing new, no notice.
  const before = sent(state).length;
  assert.equal(deliver(ctx, state, payload([tower(), ferry(), guesthouse()])).processed, 1);
  assert.equal(sent(state).length, before);
  assert.equal(alarms(state).length, 1);
});

test('bookings envelope: refused for a bad zone, a time without offset, an http link, a duplicate id, 41 records, an unknown key', () => {
  const { ctx, state } = fresh();
  const many = Array.from({ length: 41 }, (_, i) => ferry({ id: 'ferry-' + i }));
  const cases = [
    ['bad zone', payload([tower()], { tz: 'Mars/Olympus' })],
    ['no offset', payload([tower({ opens_at: '2027-03-02T10:00:00' })])],
    ['http link', payload([tower({ url: 'http://tickets.example.org/x' })])],
    ['javascript link', payload([tower({ url: 'javascript:alert(1)' })])],
    ['duplicate id', payload([tower(), tower({ title: 'Again' })])],
    ['41 records', payload(many)],
    ['unknown key in a record', payload([tower({ price: 12 })])],
    ['unknown key in the payload', { ...payload([tower()]), extra: 1 }],
    ['book_by before opens_at', payload([tower({ book_by: '2027-03-01T10:00:00+13:00' })])],
    ['bad status', payload([tower({ status: 'maybe' })])],
    ['fractional seconds', payload([tower({ opens_at: '2027-03-02T10:00:00.5+13:00' })])]
  ];
  cases.forEach(([name, p]) => {
    const st = deliver(ctx, state, p);
    assert.equal(st.rejected, 1, name);
    assert.equal(st.processed, 0, name);
  });
  assert.equal(ctx.tgBkAll().length, 0, 'nothing stored');
  assert.equal(ctx.tgTripGet(TRIP).tz, '', 'the trip zone is untouched');
  assert.equal(deliver(ctx, state, payload(many.slice(0, 40))).processed, 1, '40 records is the limit');
  assert.equal(deliver(ctx, state, payload([])).processed, 1, 'an empty list clears the trip');
  assert.equal(ctx.tgBkAll(TRIP).length, 0);
});

test('replace semantics: owner taps win over a brain todo / not needed, the brain may move a record to booked, missing records go', () => {
  const { ctx, state } = fresh();
  deliver(ctx, state, payload([tower(), ferry(), guesthouse()]));
  const key = (id) => row(ctx, id).key;
  post(ctx, state, H.tgUpdate({ callback: 'bk:' + key('harbour-ferry') + ':b' }));
  post(ctx, state, H.tgUpdate({ callback: 'bk:' + key('clock-tower-climb') + ':n' }));
  assert.deepEqual([row(ctx, 'harbour-ferry').status, row(ctx, 'harbour-ferry').status_by], ['booked', 'owner']);
  const st = deliver(ctx, state, payload([ferry(), tower({ status: 'not_needed' })]));
  assert.equal(st.processed, 1);
  assert.deepEqual([row(ctx, 'harbour-ferry').status, row(ctx, 'harbour-ferry').status_by], ['booked', 'owner'], 'the brain\'s todo does not undo the tap');
  assert.deepEqual([row(ctx, 'clock-tower-climb').status, row(ctx, 'clock-tower-climb').status_by], ['not_needed', 'owner'], 'same status: still the owner\'s');
  assert.equal(row(ctx, 'harbour-lane-guesthouse'), null, 'missing from the list → removed');
  deliver(ctx, state, payload([ferry(), tower({ status: 'booked', title: 'Clock tower climb (evening)' })]));
  assert.deepEqual([row(ctx, 'clock-tower-climb').status, row(ctx, 'clock-tower-climb').status_by], ['booked', 'brain'], 'the brain may move it to booked');
  assert.equal(row(ctx, 'clock-tower-climb').rec.title, 'Clock tower climb (evening)', 'the brain\'s record text is updated');
  assert.deepEqual(J(ctx.tgBkSnapshot())[TRIP].map((b) => [b.id, b.status, b.status_by]), [['clock-tower-climb', 'booked', 'brain'], ['harbour-ferry', 'booked', 'owner']]);
  assert.deepEqual(J(ctx.buildSnapshot()).tour_guide.bookings[TRIP].length, 2, 'state.json carries tour_guide.bookings');
});

test('a deployment set up before the Bookings tab: reads are empty, the first bookings envelope creates the tab', () => {
  const { ctx, state } = fresh();
  const ss = ctx.getSpreadsheet();
  ss.deleteSheet(ss.getSheetByName('Bookings'));
  assert.deepEqual(J(ctx.tgBkAll()), []);
  say(ctx, state, '/bookings');
  assert.equal(texts(state).pop(), '🎟 No bookings left to make.');
  say(ctx, state, '/trip');
  assert.doesNotMatch(texts(state).pop(), /Bookings/);
  assert.deepEqual(J(ctx.buildSnapshot()).tour_guide.bookings, {});
  assert.equal(deliver(ctx, state, payload([tower()])).processed, 1);
  assert.ok(ss.getSheetByName('Bookings'), 'created on first use');
  assert.equal(ctx.tgBkAll(TRIP).length, 1);
});

test('/trip lists the open bookings with the rule and both times (trip zone, then "your time"); done ones fold into a count', () => {
  const { ctx, state } = fresh();
  deliver(ctx, state, payload([tower(), ferry(), guesthouse(), tower({ id: 'quay-lunch', title: 'Quay lunch', kind: 'meal', status: 'not_needed' })]));
  say(ctx, state, '/trip');
  const t = texts(state).pop();
  const block = t.slice(t.indexOf('🎟 <b>Bookings</b>'));
  assert.equal(block.split('\n').slice(0, 13).join('\n'), [
    '🎟 <b>Bookings</b> — 2 to make',
    '🚆 <b>Harbour ferry</b>',
    '   Seats sell out a week before',
    '   open since Sat 20 Feb 09:00 in Port Sorrel · Fri 19 Feb 3:00 pm your time',
    '   book by Fri 5 Mar 12:00 in Port Sorrel · Thu 4 Mar 6:00 pm your time',
    '   for Mon 15 Mar',
    '🎟 <b>Clock tower climb</b>',
    '   Tickets release 14 days ahead at 10:00 · Online only',
    '   opens Tue 2 Mar 10:00 in Port Sorrel · Mon 1 Mar 4:00 pm your time',
    '   book by Wed 10 Mar 20:00 in Port Sorrel · Wed 10 Mar 2:00 am your time',
    '   for Tue 16 Mar',
    '   <a href="https://tickets.example.org/clock-tower">book here</a>',
    '<i>✅ 1 booked · 1 not needed</i>'
  ].join('\n'), 'nearest deadline first');
  assert.ok(t.indexOf('🎟 <b>Bookings</b>') > t.indexOf('Port Sorrel'), 'after the trip header');
});

test('/bookings: every open booking, nearest deadline first, across trips; overdue marked; /bookings now sends the reminder', () => {
  const { ctx, state } = fresh();
  ctx.tgTripUpsert({ slug: 'cedar-flats', title: 'Cedar Flats', destination: 'Cedar Flats', status: 'planned', start: '2027-04-01', end: '2027-04-03' });
  deliver(ctx, state, payload([tower(), ferry(), guesthouse()]));
  deliver(ctx, state, { v: 1, kind: 'bookings', trip: 'cedar-flats', tz: HOME, bookings: [
    { id: 'canyon-permit', title: 'Canyon permit', kind: 'other', rule: 'Permits go fast', status: 'todo', book_by: '2027-02-28T17:00:00-05:00' }] });
  say(ctx, state, '/bookings');
  const t = texts(state).pop();
  assert.match(t, /^🎟 <b>Bookings to make<\/b> \(3\) — nearest deadline first\n<b>1\.<\/b> 🎟 <b>Canyon permit<\/b> <i>· Cedar Flats<\/i>\n   Permits go fast\n   ⚠️ <b>overdue<\/b> — was due Sun 28 Feb 17:00\n<b>2\.<\/b> 🚆 <b>Harbour ferry<\/b> <i>· Port Sorrel<\/i>/);
  assert.match(t, /<b>3\.<\/b> 🎟 <b>Clock tower climb<\/b>/);
  assert.doesNotMatch(t, /guesthouse/, 'booked records are not listed');
  assert.match(t, /book by Fri 5 Mar 12:00 in Port Sorrel · Thu 4 Mar 6:00 pm your time/);
  const n = sent(state).length;
  say(ctx, state, '/bookings now');
  const m = sent(state).slice(n);
  assert.equal(m.length, 1);
  assert.match(m[0].text, /^⏰ <b>Bookings to make<\/b>\n<b>1\.<\/b> 🎟 <b>Canyon permit<\/b>/);
  assert.doesNotMatch(m[0].text, /Clock tower/, 'not open yet → not in today\'s reminder');
  const kb = m[0].reply_markup.inline_keyboard;
  assert.deepEqual(kb.map((r) => r.map((b) => b.text)), [['1 ✅ Booked', '1 Not needed', '1 Tomorrow'], ['2 ✅ Booked', '2 Not needed', '2 Tomorrow']]);
  kb.flat().forEach((b) => { assert.match(b.callback_data, /^bk:[0-9a-f]{10}:[bnt]$/); assert.ok(Buffer.byteLength(b.callback_data) <= 64); });
  assert.equal(ctx.settingGet('tg_bk_daily', ''), '2027-03-01', '/bookings now counts as today\'s reminder');
  assert.equal(alarms(state).length, 1);
  say(ctx, state, '/bookings later');
  assert.match(texts(state).pop(), /^Use <code>\/bookings<\/code>/);
});

test('/bookings now with nothing open yet names the next one to open, in both zones', () => {
  const { ctx, state } = fresh();
  deliver(ctx, state, payload([tower(), guesthouse()]));
  say(ctx, state, '/bookings now');
  assert.equal(texts(state).pop(), '🎟 Nothing to book right now. Next to open: <b>Clock tower climb</b>, Tue 2 Mar 10:00 in Port Sorrel · Mon 1 Mar 4:00 pm your time.');
});

test('the alarm: one trigger, armed at 09:00 for the daily reminder and at opens_at − 30 min for the opening alert; late runs still send', () => {
  const { ctx, state } = fresh();
  deliver(ctx, state, payload([tower(), ferry(), guesthouse()]));
  assert.deepEqual(armedAt(state), ['2027-03-01T14:00:00.000Z']);
  ctx.__TEST_NOW = '2027-03-01T14:04:00Z';   // the trigger runs four minutes late
  let n = sent(state).length;
  H.fireTriggers(ctx, state, 'alarmTrigger');
  let m = sent(state).slice(n);
  assert.equal(m.length, 1, 'the daily reminder');
  assert.match(m[0].text, /^⏰ <b>Bookings to make<\/b>\n🚆 <b>Harbour ferry<\/b> <i>· Port Sorrel<\/i>/);
  assert.deepEqual(m[0].reply_markup.inline_keyboard.map((r) => r.map((b) => b.text)), [['✅ Booked', 'Not needed', 'Tomorrow']], 'one record: unnumbered');
  assert.equal(row(ctx, 'harbour-ferry').last_reminded, '2027-03-01T14:04:00.000Z');
  assert.deepEqual(armedAt(state), ['2027-03-01T20:30:00.000Z'], 'next: 30 min before the clock tower opens (21:00Z)');
  ctx.__TEST_NOW = '2027-03-01T20:31:00Z';
  n = sent(state).length;
  H.fireTriggers(ctx, state, 'alarmTrigger');
  m = sent(state).slice(n);
  assert.equal(m.length, 1, 'the opening alert only — the daily one was sent today');
  assert.match(m[0].text, /^🔔 <b>Booking opens in about 29 min<\/b>\n🎟 <b>Clock tower climb<\/b> <i>· Port Sorrel<\/i>\n/);
  assert.match(m[0].text, /opens Tue 2 Mar 10:00 in Port Sorrel · Mon 1 Mar 4:00 pm your time/);
  assert.ok(row(ctx, 'clock-tower-climb').alerted_at);
  assert.deepEqual(armedAt(state), ['2027-03-02T14:00:00.000Z'], 'next: tomorrow\'s 09:00 reminder');
  ctx.__TEST_NOW = '2027-03-02T14:00:30Z';
  n = sent(state).length;
  H.fireTriggers(ctx, state, 'alarmTrigger');
  m = sent(state).slice(n);
  assert.equal(m.length, 1);
  assert.match(m[0].text, /<b>1\.<\/b> 🚆 <b>Harbour ferry<\/b>[\s\S]*<b>2\.<\/b> 🎟 <b>Clock tower climb<\/b>[\s\S]*open since/, 'both open now, nearest deadline first');
  assert.equal(alarms(state).length, 1, 'never more than one alarm trigger');
});

test('a booking opening soon when it arrives is alerted right away; a failed send is retried, not lost', () => {
  const { ctx, state } = fresh({ now: '2027-03-01T20:45:00Z' });   // 15 min before the clock tower opens
  ctx.settingSet('tg_bk_daily', '2027-03-01', 'test');
  deliver(ctx, state, payload([tower()]));
  assert.deepEqual(armedAt(state), ['2027-03-01T20:46:00.000Z'], 'a minute out (the alarm floor)');
  state.fetch.responder = (url) => (/sendMessage$/.test(url) ? { code: 500, body: { ok: false, description: 'Internal' } } : null);
  ctx.__TEST_NOW = '2027-03-01T20:46:10Z';
  H.fireTriggers(ctx, state, 'alarmTrigger');
  assert.equal(row(ctx, 'clock-tower-climb').alerted_at, '', 'not marked: the send failed');
  assert.equal(alarms(state).length, 1, 're-armed (held back after a run that left it due)');
  state.fetch.responder = null;
  ctx.__TEST_NOW = armedAt(state)[0];
  const n = sent(state).length;
  H.fireTriggers(ctx, state, 'alarmTrigger');
  assert.match(sent(state).slice(n)[0].text, /^🔔 <b>Booking (opens in about \d+ min|is open now)<\/b>/);
  assert.ok(row(ctx, 'clock-tower-climb').alerted_at);
});

test('the daily reminder follows the owner\'s current zone: 09:00 where the trip is while it is in progress', () => {
  // The trip runs now: the owner is in Auckland, so "09:00" is 09:00 there (20:00Z the day before), and one time is shown.
  const { ctx, state } = fresh({ start: '2027-03-01', end: '2027-03-05' });
  deliver(ctx, state, payload([ferry({ for_date: '2027-03-04' })]));
  assert.equal(ctx.tgOwnerTz(), AWAY);
  assert.deepEqual(armedAt(state), ['2027-03-01T20:00:00.000Z'], '09:00 Wed 3 Mar in Auckland');
  ctx.__TEST_NOW = '2027-03-01T20:01:00Z';
  const n = sent(state).length;
  H.fireTriggers(ctx, state, 'alarmTrigger');
  const t = sent(state).slice(n)[0].text;
  assert.match(t, /book by Fri 5 Mar 12:00\n/, 'owner on the trip: a single time');
  assert.doesNotMatch(t, /your time/);
  assert.equal(ctx.settingGet('tg_bk_daily', ''), '2027-03-02', 'the local (Auckland) date');
});

test('buttons: ✅ Booked and Not needed stop the reminders, Tomorrow snoozes to the next local day; each tap edits in place and re-arms', () => {
  const { ctx, state } = fresh({ now: '2027-03-02T14:00:00Z' });   // both records open, daily reminder due
  ctx.settingSet('tg_bk_daily', '', 'test');
  deliver(ctx, state, payload([tower(), ferry()]));
  ctx.__TEST_NOW = '2027-03-02T14:01:00Z';
  H.fireTriggers(ctx, state, 'alarmTrigger');
  const card = sent(state).pop();
  assert.match(card.text, /^⏰ <b>Bookings to make<\/b>\n<b>1\.<\/b> 🚆 <b>Harbour ferry/);
  const markup = card.reply_markup;
  const [ferryRow, towerRow] = markup.inline_keyboard;
  const tap = (btn) => post(ctx, state, H.tgUpdate({ callback: btn.callback_data, messageId: 4242, messageText: card.text.replace(/<[^>]+>/g, ''), replyMarkup: markup }));

  tap(towerRow[2]);   // Tomorrow on the clock tower
  assert.equal(row(ctx, 'clock-tower-climb').snooze_until, '2027-03-03T05:00:00.000Z', 'until midnight in New York');
  assert.equal(row(ctx, 'clock-tower-climb').status, 'todo');
  let e = edits(state).pop();
  assert.equal(e.message_id, 4242, 'the tapped message is edited');
  assert.match(e.text, /^<b>⏰ Bookings to make<\/b>\n<b>1\.<\/b> 🚆 <b>Harbour ferry[\s\S]*<b>2\.<\/b> 🎟 <b>Clock tower climb[\s\S]*💤 snoozed until Wed 3 Mar/);
  assert.deepEqual(e.reply_markup.inline_keyboard.map((r) => r.map((b) => b.text)), [['1 ✅ Booked', '1 Not needed', '1 Tomorrow']], 'no buttons on a snoozed record');
  assert.equal(state.fetch.telegram('answerCallbackQuery').pop().json.text, '💤 Again tomorrow');

  tap(ferryRow[0]);   // ✅ Booked on the ferry
  assert.deepEqual([row(ctx, 'harbour-ferry').status, row(ctx, 'harbour-ferry').status_by], ['booked', 'owner']);
  e = edits(state).pop();
  assert.match(e.text, /Harbour ferry[\s\S]*✅ booked/);
  assert.deepEqual(J(e.reply_markup), { inline_keyboard: [] }, 'nothing left to tap');
  assert.equal(state.fetch.telegram('answerCallbackQuery').pop().json.text, '✅ Marked booked');
  assert.deepEqual(armedAt(state), ['2027-03-03T14:00:00.000Z'], 're-armed: tomorrow\'s reminder (the snoozed tower is due again then)');

  // Next day: only the snoozed clock tower is reminded; Not needed then stops everything.
  ctx.__TEST_NOW = '2027-03-03T14:00:00Z';
  const n = sent(state).length;
  H.fireTriggers(ctx, state, 'alarmTrigger');
  const next = sent(state).slice(n);
  assert.equal(next.length, 1);
  assert.match(next[0].text, /Clock tower climb/);
  assert.doesNotMatch(next[0].text, /Harbour ferry/);
  post(ctx, state, H.tgUpdate({ callback: next[0].reply_markup.inline_keyboard[0][1].callback_data, messageId: 4343, replyMarkup: next[0].reply_markup }));
  assert.deepEqual([row(ctx, 'clock-tower-climb').status, row(ctx, 'clock-tower-climb').status_by], ['not_needed', 'owner']);
  assert.match(edits(state).pop().text, /^🎟 <b>Bookings<\/b>\n🎟 <b>Clock tower climb[\s\S]*➖ not needed/, 'no ⏰/🔔 first line → a plain header');
  assert.equal(alarms(state).length, 0, 'nothing open → no alarm trigger left');
  ctx.__TEST_NOW = '2027-03-04T14:00:00Z';
  const m = sent(state).length;
  ctx.alarmArm();
  H.fireTriggers(ctx, state, 'alarmTrigger');
  assert.equal(sent(state).length, m, 'no reminder for booked / not needed records');
});

test('buttons: a malformed or stale callback is answered and changes nothing', () => {
  const { ctx, state } = fresh();
  deliver(ctx, state, payload([ferry()]));
  const key = row(ctx, 'harbour-ferry').key;
  ['bk:' + key + ':x', 'bk:' + key, 'bk:' + key + ':b:extra', 'bk:ZZZZZZZZZZ:b', 'bk:0000000000:b'].forEach((data) => {
    post(ctx, state, H.tgUpdate({ callback: data }));
  });
  const answers = state.fetch.telegram('answerCallbackQuery').map((r) => r.json.text);
  assert.deepEqual(answers, ['Unknown button', 'Unknown button', 'Unknown button', 'Unknown button', 'That booking is no longer on the list.']);
  assert.equal(row(ctx, 'harbour-ferry').status, 'todo');
  assert.equal(edits(state).length, 0);
});

test('tgBkDayLines(trip, day): the day card lines — booked and still-to-book records for that day, not the "not needed" ones', () => {
  const { ctx, state } = fresh();
  assert.deepEqual(J(ctx.tgBkDayLines(TRIP, '2027-03-16')), [], 'no tab content yet');
  deliver(ctx, state, payload([tower(), ferry(), guesthouse({ for_date: '2027-03-16' }), tower({ id: 'quay-lunch', title: 'Quay lunch', kind: 'meal', status: 'not_needed' })]));
  assert.deepEqual(J(ctx.tgBkDayLines(TRIP, '2027-03-16')), [
    '🎟 Clock tower climb · ⏳ still to book — Tickets release 14 days ahead at 10:00',
    '🛏 Harbour Lane guesthouse · ✅ booked'
  ], 'nearest deadline first (book_by 10 Mar before the day itself)');
  assert.deepEqual(J(ctx.tgBkDayLines(ctx.tgTripGet(TRIP), '2027-03-15')), ['🚆 Harbour ferry · ⏳ still to book — Seats sell out a week before'], 'a trip object works too');
  assert.deepEqual(J(ctx.tgBkDayLines(ctx.tgTripGet(TRIP), { n: 1, date: '2027-03-15', stops: [] })), ['🚆 Harbour ferry · ⏳ still to book — Seats sell out a week before'], 'the day card passes the stored day object');
  assert.deepEqual(J(ctx.tgBkDayLines('no-such-trip', '2027-03-15')), []);
});

test('tgBkDayLines: a booking with a place but no date shows on the first stored day that plans its place, never written into for_date', () => {
  const { ctx, state } = fresh();
  const undated = tower({ id: 'tower-undated', for_date: undefined, place: 'clock-tower' });
  delete undated.for_date;
  const supper = guesthouse({ id: 'quay-supper', title: 'Quay supper', kind: 'meal', status: 'todo', rule: 'Call two days ahead', place: 'quay-kitchen' });
  deliver(ctx, state, payload([undated, supper, ferry({ place: 'clock-tower' })]));
  assert.deepEqual(J(ctx.tgBkDayLines(TRIP, '2027-03-16')), [], 'no stored plan yet: an undated booking has no day');
  const stop = (slug, n) => ({ n, slug, name: slug, arrive: '10:00', depart: '11:00', minutes: 60 });
  ctx.tgDigestStore({ v: 1, kind: 'plan_digest', trip: TRIP, build_id: 'b1', tz: AWAY, verified_on: '2027-03-01', later: [],
    drive: { plan: 'fixtureDrivePlanFile01', brochure_html: null, brochure_pdf: null }, days: [
      { date: '2027-03-15', theme: 'Harbour', stops: [stop('old-quay', 1)], legs: [], warnings: [] },
      { date: '2027-03-16', theme: 'Tower', stops: [stop('market', 1), stop('clock-tower', 2)], legs: [], warnings: [],
        dinner: { name: 'Quay Kitchen', slug: 'quay-kitchen', start: '19:00', end: '20:30' } },
      { date: '2027-03-17', theme: 'Tower again', stops: [stop('clock-tower', 1)], legs: [], warnings: [] }] });
  const day = (d) => J(ctx.tgBkDayLines(TRIP, d));
  assert.deepEqual(day('2027-03-16'), ['🎟 Clock tower climb · ⏳ still to book — Tickets release 14 days ahead at 10:00',
    '🍽 Quay supper · ⏳ still to book — Call two days ahead'], 'day 2 plans the tower (a stop) and the kitchen (the dinner)');
  assert.deepEqual(day('2027-03-17'), [], 'the first day that plans the place wins, not every day');
  assert.deepEqual(day('2027-03-15'), ['🚆 Harbour ferry · ⏳ still to book — Seats sell out a week before'],
    'a dated booking stays on its own date even when its place is planned elsewhere');
  assert.equal(row(ctx, 'tower-undated').rec.for_date, undefined, 'the date is never written into for_date');
  assert.equal(JSON.parse(ctx.storeAll('Bookings').find((r) => r.id === 'tower-undated').record_json).for_date, undefined);
  say(ctx, state, '/trip');
  const trip = texts(state).pop();
  assert.match(trip, /<b>Clock tower climb<\/b>[\s\S]*?planned for Tue 16 Mar/, '/trip says which day it is planned for');
  assert.doesNotMatch(trip, /Harbour ferry<\/b>[^🎟🍽🚆🛏]*planned for/, 'a dated booking says "for", not "planned for"');
});

test('red team: HTML in a title or rule is escaped everywhere; a javascript: link that reached the tab is never shown', () => {
  const { ctx, state } = fresh({ now: '2027-03-02T14:00:00Z' });
  const evil = ferry({ title: '<b>Ferry</b> & <a href="javascript:x">co</a>', rule: 'Book <script>alert(1)</script> now', how: '<i>app</i>' });
  deliver(ctx, state, payload([evil]));
  // A tampered sheet row (the validator never lets one in): the link must still not be shown.
  const r = ctx.storeAll('Bookings')[0];
  ctx.storeUpdate('Bookings', r._row, { record_json: JSON.stringify({ ...evil, url: 'javascript:alert(1)' }) });
  say(ctx, state, '/trip');
  say(ctx, state, '/bookings');
  say(ctx, state, '/bookings now');
  const all = texts(state).slice(-3).concat(ctx.tgBkDayLines(TRIP, '2027-03-15'));
  all.forEach((t) => {
    assert.doesNotMatch(t, /<script|<a\b|<i>app/i, 'no live tag from the record: ' + t);
    assert.doesNotMatch(t, /<b>Ferry<\/b>|book here/);
  });
  assert.match(all[0], /🚆 <b>&lt;b&gt;Ferry&lt;\/b&gt; &amp; &lt;a href="javascript:x"&gt;co&lt;\/a&gt;<\/b>\n   Book &lt;script&gt;alert\(1\)&lt;\/script&gt; now · &lt;i&gt;app&lt;\/i&gt;/);
});

// Developed by: LightAISolutions

// Developed by: LightAISolutions
