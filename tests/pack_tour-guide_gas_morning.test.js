'use strict';
// Tour Guide pack — WP-12b "the morning message" and "weather from Open-Meteo" (TG-PHASE-12 §2, §3): the tg_morning alarm
// fires once per date at the trip-local morning time, the message carries the whole day in the brief's order with the
// weather line and its credit, a failed or slow weather call drops only the line, the first chunk is pinned and the
// previous one unpinned, a free day is short, /morning on another date is a rehearsal. Trip-local clock in
// Pacific/Kiritimati (UTC+14). No real call: Open-Meteo answers come from helpers/tests/pack_tour-guide_phase12_world.js.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const W = require('./pack_tour-guide_phase12_world');
const { H, J, TRIP, DATES, at } = W;

const settings = (ctx, k) => JSON.parse(ctx.settingGet(k, '{}') || '{}');
const fire = (ctx, state) => H.fireTriggers(ctx, state, 'alarmTrigger');
const morningTexts = (state) => W.texts(state).filter((t) => /☀️ <b>/.test(t));
const sunny = () => W.weather({ 'lark bay': (d) => W.forecast(d, 0, 9.4, 17.2, 10) });

test('the alarm fires once per date at 07:00 trip time, earlier for an early leave-by, never before 05:00 or after noon', () => {
  const { ctx, state } = W.fresh(at(DATES[1], '05:00'));
  state.fetch.responder = sunny();
  ctx.alarmArm();
  assert.equal(ctx.alarmNextAll(ctx.nowMs()).tg_morning, Date.parse(at(DATES[1], '07:00')), '07:00 in a zone 14 hours from UTC');
  W.setNow(ctx, at(DATES[1], '06:30'));
  fire(ctx, state);
  assert.equal(morningTexts(state).length, 0, 'not yet');
  W.setNow(ctx, at(DATES[1], '07:01'));
  fire(ctx, state);
  assert.equal(morningTexts(state).length, 1);
  assert.ok(settings(ctx, 'tg_morning_sent')[TRIP + '|' + DATES[1]]);
  fire(ctx, state);
  W.setNow(ctx, at(DATES[1], '09:00'));
  fire(ctx, state);
  assert.equal(morningTexts(state).length, 1, 'once per date');
  assert.equal(ctx.alarmNextAll(ctx.nowMs()).tg_morning, Date.parse(at(DATES[2], '07:00')), 'the next is tomorrow morning');

  const early = W.digest({ build_id: 'build-lb-early' });
  early.days[1].leave_by = '07:10';
  early.days[2].leave_by = '05:15';
  const e = W.fresh(at(DATES[1], '05:00'), { digest: early });
  assert.equal(e.ctx.alarmNextAll(e.ctx.nowMs()).tg_morning, Date.parse(at(DATES[1], '06:40')), '30 min before leave by');
  e.ctx.tgMorningMark(TRIP, DATES[1]);
  assert.equal(e.ctx.alarmNextAll(e.ctx.nowMs()).tg_morning, Date.parse(at(DATES[2], '05:00')), 'never before 05:00');

  const noon = W.fresh(at(DATES[1], '12:05'));
  assert.equal(noon.ctx.alarmNextAll(noon.ctx.nowMs()).tg_morning, Date.parse(at(DATES[2], '07:00')), 'too late for today: skipped');
  noon.ctx.tgMorningMark(TRIP, DATES[2]);
  assert.equal(noon.ctx.alarmNextAll(noon.ctx.nowMs()).tg_morning, undefined, 'the last date sent: nothing pending');
});

test('/morning at, off and on change when it comes; bad times are refused', () => {
  const { ctx, state } = W.fresh(at(DATES[0], '20:00'));
  W.say(ctx, state, '/morning at 6:15');
  assert.match(W.last(state), /Saved: the morning message comes at 06:15/);
  assert.equal(ctx.alarmNextAll(ctx.nowMs()).tg_morning, Date.parse(at(DATES[1], '06:15')));
  for (const bad of ['/morning at 04:59', '/morning at 12:00', '/morning at 25:00']) {
    W.say(ctx, state, bad);
    assert.match(W.last(state), /Between 05:00 and 11:59/);
  }
  W.say(ctx, state, '/morning off');
  assert.match(W.last(state), /No morning message/);
  assert.equal(ctx.alarmNextAll(ctx.nowMs()).tg_morning, undefined);
  W.say(ctx, state, '/morning on');
  assert.match(W.last(state), /comes each trip day at 06:15/);
  assert.deepEqual(settings(ctx, 'tg_morning'), { at: '06:15', on: true });
  W.say(ctx, state, '/morning soon please');
  assert.match(W.last(state), /Usage/);
});

test('the morning message carries the whole day in order, with the weather line, its credit and the buttons; it is pinned', () => {
  const { ctx, state } = W.fresh(at(DATES[1], '07:00'));
  state.fetch.responder = sunny();
  ctx.alarmArm();
  fire(ctx, state);
  const msgs = W.sends(state).filter((m) => /☀️ <b>/.test(m.text));
  assert.equal(msgs.length, 1);
  const t = msgs[0].text;
  const order = ['☀️ <b>Fri 11 Jun · Day 2 of 3</b> · Lark Bay', '🚪 <b>Leave by 08:45</b>', '☀️ Clear, 9–17 °C (49–63 °F) · rain 10%',
    'Weather data by <a href="https://open-meteo.com/">Open-Meteo.com</a>', '💴 <b>Paying</b>', '• Tide Hall: Cash only at the gate · Adults 800 · children free',
    '• Kite Museum: Cards accepted', '• Salt House: Cash or card · Set menu 4 500', '🍽 Salt House dinner · ✅ booked',
    '<b>1.</b> about 09:00 <b>Tide Hall</b> · 潮見館 · last entry 16:00', '📍 1-2 Shore Row, Lark Bay · <a href="https://www.google.com/maps/', '🕑 <i>Check the tide table.</i>',
    '<b>2.</b> 11:00–12:30 <b>Glass Works</b> · ガラス工房', '<b>6.</b> 18:00–18:40 <b>Sea Steps</b>', '🚆 <b>Trains</b>',
    '• from Lark Bay (Shore Line) to Old Pier (Shore Line) — for The Ropewalk', '• from Old Pier to Tower Gate — for Harbour Tower',
    '🍽 19:00 Dinner at <b>Salt House</b> · 塩の家', '📍 3 Quay Steps, Lark Bay', '🎟 <i>Booked for 2 at 19:00.</i>', '🌅 Sunset 18:52'];
  let from = -1;
  for (const s of order) { const i = t.indexOf(s, from + 1); assert.ok(i > from, 'in order: ' + s + '\n' + t); from = i; }
  assert.deepEqual(W.cbData(msgs[0]), ['rl:lark-bay:20270611:15', 'rl:lark-bay:20270611:30', 'rl:lark-bay:20270611:60', 'rp:lark-bay:20270611']);
  const pins = state.fetch.telegram('pinChatMessage').map((r) => r.json);
  assert.equal(pins.length, 1);
  assert.equal(pins[0].disable_notification, true, 'pinned silently');
  assert.equal(state.fetch.telegram('unpinChatMessage').length, 0, 'nothing pinned before');
  assert.deepEqual(settings(ctx, 'tg_morning_pin'), { chat: String(pins[0].chat_id), id: pins[0].message_id });
  const [geo, fc] = W.wxCalls(state).map((r) => r.url);
  assert.equal(geo, 'https://geocoding-api.open-meteo.com/v1/search?name=Lark%20Bay&count=5&language=en&format=json&countryCode=ZZ');
  assert.equal(fc, 'https://api.open-meteo.com/v1/forecast?latitude=12.5&longitude=160.25&daily=weather_code,temperature_2m_max,temperature_2m_min,' +
    'precipitation_probability_max&hourly=precipitation_probability&timezone=Pacific%2FKiritimati&start_date=2027-06-11&end_date=2027-06-11');
  assert.equal(W.audits(ctx, 'tg_morning').length, 1);
  assert.deepEqual(JSON.parse(W.audits(ctx, 'tg_morning')[0].detail_json), { date: DATES[1], rehearsal: false, ok: true, messages: 1, pinned: true, weather: 1, calls: 2 });
});

test('weather: rain from an hour, two towns on a moving day, the owner\'s town, the 16-day window and the cache', () => {
  const hourly = Array.from({ length: 24 }, (_, h) => (h === 3 ? 90 : h >= 15 ? 80 : 20));   // 03:00 is before 06:00: ignored
  const { ctx, state } = W.fresh(at(DATES[1], '06:00'));
  state.fetch.responder = W.weather({ 'lark bay': (d) => W.forecast(d, 61, 7.6, 11.5, 80, hourly), fernmoor: (d) => W.forecast(d, 3, -2.4, 4, null) });
  const wx = (date) => J(ctx.tgWxDay(ctx.tgTripGet(TRIP), ctx.tgDigestDay(TRIP, date)));
  assert.deepEqual(wx(DATES[1]).lines, ['🌧 Rain likely from 15:00, 8–12 °C (46–53 °F) · rain 80%']);
  assert.deepEqual(wx(DATES[2]).lines, ['<b>Lark Bay</b>: 🌧 Rain likely from 15:00, 8–12 °C (46–53 °F) · rain 80%', '<b>Fernmoor</b>: ☁️ Overcast, -2–4 °C (28–39 °F)']);
  const n = W.wxCalls(state).length;
  assert.equal(n, 5, 'one geocode per town, one forecast per town and date');
  wx(DATES[1]); wx(DATES[2]);
  assert.equal(W.wxCalls(state).length, n, 'cached for the asking day');
  W.say(ctx, state, '/dates 2027-06-12 weather Fernmoor');
  assert.match(W.last(state), /Saved: Sat 12 Jun shows the weather for <b>Fernmoor<\/b>/);
  assert.deepEqual(wx(DATES[2]).lines, ['☁️ Overcast, -2–4 °C (28–39 °F)']);
  W.say(ctx, state, '/dates 2027-06-12 weather clear');
  assert.equal(wx(DATES[2]).lines.length, 2);
  assert.deepEqual(settings(ctx, 'tg_weather_town'), {}, 'kept in the core only, and cleared');
  W.say(ctx, state, '/dates 2027-06-12 weather ' + 'x'.repeat(61));
  assert.match(W.last(state), /At most 60 characters/);
  W.say(ctx, state, '/dates 2027-07-01 weather Fernmoor');
  assert.match(W.last(state), /not a date of Lark Bay/);
  assert.deepEqual(settings(ctx, 'tg_weather_town'), {});

  const far = W.fresh('2027-05-25T00:00:00.000Z');
  far.state.fetch.responder = sunny();
  assert.deepEqual(J(far.ctx.tgWxDay(far.ctx.tgTripGet(TRIP), far.ctx.tgDigestDay(TRIP, DATES[1]))).lines, ['🌤 <i>Forecast not available yet</i>']);
  assert.equal(W.wxCalls(far.state).length, 0, 'beyond 16 days: no call at all');
});

test('a failed or slow weather call drops the line, never the message; the backstop trigger survives a call that hangs', () => {
  const { ctx, state } = W.fresh(at(DATES[1], '07:00'));
  state.fetch.responder = W.weather({ 'lark bay': () => ({ code: 500, body: { error: true, reason: 'fixture outage' } }) });
  ctx.alarmArm();
  fire(ctx, state);
  const t = morningTexts(state).pop();
  assert.match(t, /Leave by 08:45/);
  assert.ok(!/°C|Open-Meteo/.test(t), 'no weather line and no credit');
  assert.ok(settings(ctx, 'tg_morning_sent')[TRIP + '|' + DATES[1]], 'still sent and marked');
  assert.equal(W.audits(ctx, 'tg_weather_forecast').length, 1);

  const w = W.fresh(at(DATES[1], '07:00'));
  let during = null;
  const base = sunny();
  w.state.fetch.responder = (url, rec) => {
    if (url.startsWith('https://api.open-meteo.com/')) {
      during = w.state.triggers.filter((x) => x.fn === 'alarmTrigger').map((x) => x.spec.at.getTime());
      throw new Error('Exceeded maximum execution time');   // a call that hangs until Apps Script gives up
    }
    return base(url, rec);
  };
  w.ctx.alarmArm();
  fire(w.ctx, w.state);
  assert.deepEqual(during, [Date.parse(at(DATES[1], '07:15'))], 'a trigger 15 minutes on exists while the call hangs');
  assert.equal(morningTexts(w.state).length, 1, 'the message still went out');
  assert.ok(!/°C/.test(morningTexts(w.state)[0]));
  const mark = Object.values(settings(w.ctx, 'tg_weather')).filter((e) => e.tries)[0];
  assert.equal(mark.tries, 1, 'the attempt was marked before the call');

  // Had the run been killed inside the call, the 07:15 trigger runs it again: one more try, then the message.
  w.ctx.settingSet('tg_morning_sent', '{}');
  w.state.fetch.responder = base;
  W.setNow(w.ctx, at(DATES[1], '07:15'));
  w.ctx.alarmArm();
  fire(w.ctx, w.state);
  assert.match(morningTexts(w.state).pop(), /☀️ Clear, 9–17 °C/);
  W.setNow(w.ctx, at(DATES[1], '08:00'));
  w.ctx.settingSet('tg_morning_sent', '{}');
  w.ctx.settingSet('tg_weather', '{}');
  w.state.fetch.responder = W.weather({ 'lark bay': () => ({ code: 200, body: { daily: { time: ['2027-06-11'], weather_code: ['sun'] } } }) });
  w.ctx.alarmArm();
  fire(w.ctx, w.state);
  assert.ok(!/°C/.test(morningTexts(w.state).pop()), 'an answer of another shape gives no line');
});

test('a long day splits like the day card: buttons on the last chunk, the first chunk pinned', () => {
  const d = W.digest({ build_id: 'build-lb-long' });
  const long = (c, n) => (c + ' ').repeat(Math.ceil(n / 2)).slice(0, n).trim();
  d.days[1].stops.forEach((s, i) => Object.assign(s, { name: long('N' + i, 120), local_name: long('L', 80), address: long('A' + i, 160),
    check_on_day: long('C', 160), payment: long('P', 80), price_line: long('R', 160) }));
  const { ctx, state } = W.fresh(at(DATES[1], '07:00'), { digest: d });
  state.fetch.responder = sunny();
  const firstId = state.fetch.tgMessageId + 1;
  W.say(ctx, state, '/morning');
  assert.ok(W.sends(state).filter((m) => /☀️ <b>|<b>\d\.<\/b>|Sunset/.test(m.text)).length >= 2, 'more than one message');
  const parts = W.sends(state).slice(W.sends(state).findIndex((m) => /☀️ <b>Fri 11 Jun/.test(m.text)));
  assert.ok(parts.length >= 2);
  parts.forEach((m, i) => {
    assert.ok(m.text.length <= ctx.LIMITS.TG_SPLIT_AT, 'each chunk within the split size');
    assert.equal(!!m.reply_markup, i === parts.length - 1, 'the keyboard rides on the last chunk only');
  });
  assert.match(parts[parts.length - 1].text, /Sunset 18:52/);
  assert.equal(state.fetch.telegram('pinChatMessage')[0].json.message_id, firstId, 'the first chunk is the one pinned');
  assert.ok(settings(ctx, 'tg_morning_sent')[TRIP + '|' + DATES[1]], '/morning on the day counts as sent');
});

test('the next morning unpins the previous message; a failed pin or unpin is audited and ignored', () => {
  const { ctx, state } = W.fresh(at(DATES[1], '07:00'));
  const base = sunny();
  let pinFails = false, unpinFails = false;
  state.fetch.responder = (url, rec) => {
    if (/\/pinChatMessage$/.test(url) && pinFails) return { code: 400, body: { ok: false, description: 'Bad Request: not enough rights to pin a message' } };
    if (/\/unpinChatMessage$/.test(url) && unpinFails) return { code: 400, body: { ok: false, description: 'Bad Request: message to unpin not found' } };
    return base(url, rec);
  };
  ctx.alarmArm();
  fire(ctx, state);
  const first = settings(ctx, 'tg_morning_pin').id;
  W.setNow(ctx, at(DATES[2], '07:00'));
  unpinFails = true;
  fire(ctx, state);
  assert.deepEqual(state.fetch.telegram('unpinChatMessage').map((r) => r.json.message_id), [first]);
  assert.equal(W.audits(ctx, 'tg_morning_unpin_fail').length, 1);
  const second = settings(ctx, 'tg_morning_pin').id;
  assert.ok(second > first, 'pinned anyway');
  assert.ok(settings(ctx, 'tg_morning_sent')[TRIP + '|' + DATES[2]]);

  const p = W.fresh(at(DATES[1], '07:00'));
  pinFails = true;
  p.state.fetch.responder = state.fetch.responder;
  p.ctx.alarmArm();
  fire(p.ctx, p.state);
  assert.equal(morningTexts(p.state).length, 1, 'the message went out');
  assert.equal(W.audits(p.ctx, 'tg_morning_pin_fail').length, 1);
  assert.ok(settings(p.ctx, 'tg_morning_sent')[TRIP + '|' + DATES[1]], 'a failed pin does not stop the date counting as sent');
  assert.deepEqual(settings(p.ctx, 'tg_morning_pin'), {});
});

test('a failed send leaves the date unmarked, so the alarm tries again', () => {
  const { ctx, state } = W.fresh(at(DATES[1], '07:00'));
  const base = sunny();
  state.fetch.responder = (url, rec) => (/\/sendMessage$/.test(url) ? { code: 502, body: 'Bad Gateway' } : base(url, rec));
  ctx.alarmArm();
  fire(ctx, state);
  assert.deepEqual(settings(ctx, 'tg_morning_sent'), {});
  assert.equal(state.fetch.telegram('pinChatMessage').length, 0);
  const next = ctx.alarmNextAll(ctx.nowMs()).tg_morning;
  assert.equal(next, Date.parse(at(DATES[1], '07:00')), 'still due');
  assert.equal(ctx.alarmPending().at, new Date(Date.parse(at(DATES[1], '07:15'))).toISOString(), 'held back ALARM_RETRY_MIN, not a loop');
  state.fetch.responder = base;
  W.setNow(ctx, at(DATES[1], '07:15'));
  fire(ctx, state);
  assert.ok(settings(ctx, 'tg_morning_sent')[TRIP + '|' + DATES[1]]);
});

test('a free day gets the date, the weather, its bookings and "Free day" — no leave-by, no buttons', () => {
  const bk = W.bookings();
  bk.bookings.push({ id: 'arrival-taxi', title: 'Airport taxi', kind: 'other', rule: 'book the day before', status: 'booked', place: 'lodging', for_date: DATES[0] });
  const { ctx, state } = W.fresh(at(DATES[0], '05:00'), { bookings: false });
  W.deliver(ctx, state, 'bookings', bk);
  state.fetch.responder = sunny();
  W.setNow(ctx, at(DATES[0], '07:00'));
  ctx.alarmArm();
  fire(ctx, state);
  const m = W.sends(state).filter((x) => /☀️ <b>/.test(x.text)).pop();
  assert.equal(m.text, '☀️ <b>Thu 10 Jun · Day 1 of 3</b> · Lark Bay\n<i>Arrival</i>\n☀️ Clear, 9–17 °C (49–63 °F) · rain 10%\n' + ctx.tgWxCredit() +
    '\n🎟 Airport taxi · ✅ booked\n<b>Free day.</b>');
  assert.equal(m.reply_markup, undefined);
});

test('/morning on another date is a rehearsal: headed so, never pinned or marked; the real one still comes', () => {
  const { ctx, state } = W.fresh(at(DATES[0], '13:00'));
  state.fetch.responder = sunny();
  W.say(ctx, state, '/morning day 2');
  const t = W.last(state);
  assert.match(t, /^🎭 <b>Rehearsal<\/b> — the morning message of Fri 11 Jun; not pinned, not counted as sent\n☀️ <b>Fri 11 Jun · Day 2 of 3/);
  W.say(ctx, state, '/morning tomorrow');
  assert.match(W.last(state), /^🎭 <b>Rehearsal/);
  assert.equal(state.fetch.telegram('pinChatMessage').length, 0);
  assert.deepEqual(settings(ctx, 'tg_morning_sent'), {});
  assert.equal(JSON.parse(W.audits(ctx, 'tg_morning')[0].detail_json).rehearsal, true);
  W.say(ctx, state, '/morning day 9');
  assert.match(W.last(state), /not in the plan/);
  ctx.alarmArm();
  assert.equal(ctx.alarmNextAll(ctx.nowMs()).tg_morning, Date.parse(at(DATES[1], '07:00')), 'the real one is still due');
  const noPlan = W.fresh('2027-06-01T00:00:00.000Z');
  W.say(noPlan.ctx, noPlan.state, '/morning');
  assert.match(W.last(noPlan.state), /No plan for today/);
});

test('hostile names, addresses and links stay text; only Google Maps links are links', () => {
  const d = W.digest({ build_id: 'build-lb-hostile-am' });
  const s = d.days[1].stops[0];
  Object.assign(s, { name: '<b>Tide</b> & "Hall"', local_name: '</i><script>alert(1)</script>', address: '<a href="https://evil.example">here</a>',
    payment: '<u>cash</u> & more', check_on_day: '<tg-spoiler>x</tg-spoiler>', maps_url: 'https://evil.example/maps/place' });
  d.days[1].dinner.name = '<i>Salt</i>';
  d.days[1].legs[2].stations = { from: '<b>Lark</b>', to: 'Old Pier', from_line: '<a href="https://evil.example">L</a>' };
  d.days[1].areas = ['<b>Lark Bay</b>'];
  d.days[1].theme = '<script>t</script>';
  const { ctx, state } = W.fresh(at(DATES[1], '07:00'), { digest: d });
  state.fetch.responder = sunny();
  W.say(ctx, state, '/morning');
  const t = W.sends(state).filter((m) => /☀️ <b>/.test(m.text)).map((m) => m.text).join('\n');
  assert.ok(t.includes('<b>&lt;b&gt;Tide&lt;/b&gt; &amp; "Hall"</b> · &lt;/i&gt;&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(t.includes('📍 &lt;a href="https://evil.example"&gt;here&lt;/a&gt;'));
  assert.ok(t.includes('• &lt;b&gt;Tide&lt;/b&gt; &amp; "Hall": &lt;u&gt;cash&lt;/u&gt; &amp; more'));
  assert.ok(t.includes('from &lt;b&gt;Lark&lt;/b&gt; (&lt;a href="https://evil.example"&gt;L&lt;/a&gt;) to Old Pier'));
  assert.ok(t.includes('Dinner at <b>&lt;i&gt;Salt&lt;/i&gt;</b>'));
  assert.ok(!/<script>|<tg-spoiler>|<u>|<a href="https:\/\/evil/.test(t), 'no live tag or foreign link reaches Telegram');
  const hrefs = t.match(/<a href="[^"]*"/g);
  assert.ok(hrefs.every((h) => /^<a href="https:\/\/(www\.google\.com\/maps\/|open-meteo\.com\/|www\.geonames\.org\/)/.test(h)), hrefs.join(' '));
  assert.deepEqual(W.wxCalls(state).map((r) => decodeURIComponent(/name=([^&]*)/.exec(r.url)[1])), ['<b>Lark Bay</b>'], 'the name travels encoded');
  assert.ok(!/°C/.test(t), 'an area the geocoder does not know gives no line');
});

test('compatibility: an old digest (no C12 fields, no country) gives the morning message without weather or new lines', () => {
  const d = W.digest({ build_id: 'build-lb-old' });
  delete d.country_code;
  d.days.forEach((day) => {
    delete day.leave_by; delete day.areas;
    day.stops.forEach((s) => ['local_name', 'address', 'payment', 'price_line', 'close'].forEach((k) => delete s[k]));
    day.legs.forEach((l) => delete l.stations);
    if (day.dinner) ['local_name', 'address', 'payment', 'price_line'].forEach((k) => delete day.dinner[k]);
  });
  const { ctx, state } = W.fresh(at(DATES[1], '07:00'), { digest: d });
  state.fetch.responder = sunny();
  ctx.alarmArm();
  assert.equal(ctx.alarmNextAll(ctx.nowMs()).tg_morning, Date.parse(at(DATES[1], '07:00')));
  fire(ctx, state);
  const t = morningTexts(state).pop();
  assert.match(t, /^☀️ <b>Fri 11 Jun · Day 2 of 3<\/b>\n/);
  assert.ok(!/Leave by|°C|💴|📍/.test(t));
  assert.match(t, /• To The Ropewalk: use the route link/);
  assert.match(t, /<b>1\.<\/b> about 09:00 <b>Tide Hall<\/b> · last entry 16:00/);
  assert.equal(W.wxCalls(state).length, 0, 'no country, no call');
});

// Developed by: LightAISolutions
