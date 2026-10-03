'use strict';
// Tour Guide pack — gas/25_checkin.js (the evening check-in) and its use by gas/13_flow_review.js (WP-12b, TG-PHASE-12
// §6–§7). The invented trip "Lark Bay" in UTC+14 (pack_tour-guide_phase12_world.js); nothing here is real.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const W = require('./pack_tour-guide_phase12_world');
const { H, TRIP, DATES, J, at, fresh, say, tap, sends, texts, setNow, cbData, reqOf, audits } = W;

const D2 = DATES[1], D3 = DATES[2];
const d8 = (d) => d.replace(/-/g, '');
const checkins = (state) => sends(state).filter((m) => /How was today\?|, continued</.test(m.text));
const answers = (state) => state.fetch.telegram('answerCallbackQuery').map((r) => r.json.text);
const remarks = (state) => state.fetch.telegram('editMessageReplyMarkup').map((r) => r.json);
const edits = (state) => state.fetch.telegram('editMessageText').map((r) => r.json);
const choices = (ctx) => J(ctx.tgChoiceList(TRIP, 'checkin', 'review'));
const buttons = (m) => m.reply_markup.inline_keyboard.flat();
/** The callback_data of stop row k (1-based) for a code, in a sent or re-ticked keyboard. */
const btn = (kb, k, code) => kb.inline_keyboard[k - 1].find((b) => b.callback_data.endsWith(':' + code)).callback_data;
/** Tap a button of a message whose keyboard is `kb` (Telegram sends the keyboard back with the callback). */
const press = (ctx, state, kb, data) => tap(ctx, state, data, { messageId: 501, replyMarkup: kb });
const ticked = (kb) => kb.inline_keyboard.map((row) => row.filter((b) => b.text.startsWith('✓')).map((b) => b.text).join(''));

test('alarm: 21:00 trip-local, or 15 min after a late planned end, never after 22:30; once per date; no stops, no check-in', () => {
  const { ctx, state } = fresh(at(DATES[0], '12:00'));
  assert.equal(ctx.alarmNextAll(ctx.nowMs()).tg_checkin, Date.parse(at(D2, '21:00')), 'day 1 has no stops: day 2 is next');
  setNow(ctx, at(D2, '20:58'));
  H.fireTriggers(ctx, state, 'alarmTrigger');
  assert.equal(checkins(state).length, 0, 'not before its time');
  setNow(ctx, at(D2, '21:00'));
  H.fireTriggers(ctx, state, 'alarmTrigger');
  assert.equal(checkins(state).length, 1);
  assert.match(checkins(state)[0].text, /🌙 <b>How was today\?<\/b> · .*11 Jun/);
  setNow(ctx, at(D2, '21:30'));
  H.fireTriggers(ctx, state, 'alarmTrigger');
  assert.equal(checkins(state).length, 1, 'once per date');
  assert.equal(ctx.alarmNextAll(ctx.nowMs()).tg_checkin, Date.parse(at(D3, '21:00')), 'the moving day: its 17:30 end is early, so 21:00');
  assert.equal(audits(ctx, 'tg_checkin').length, 1);

  const v = (stops, dinner, end) => ({ stops, dinner, end });
  const hm = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  assert.equal(hm(ctx.tgCheckinDueMin(v([{ arrive: '20:00', depart: '21:30' }]))), '21:45', '15 min after a late last stop');
  assert.equal(hm(ctx.tgCheckinDueMin(v([], { name: 'X', start: '21:00' }))), '22:15', 'a dinner without an end counts 60 min');
  assert.equal(hm(ctx.tgCheckinDueMin(v([], null, { name: 'Y', time: '23:10' }))), '22:30', 'never after 22:30');
  assert.equal(hm(ctx.tgCheckinDueMin(v([{ arrive: '09:00', depart: '10:00' }]))), '21:00');
});

test('alarm: a late dinner and the running-late overlay move it; a run after 23:30 skips the date; /checkin today counts as sent', () => {
  const late = W.digest();
  late.days[1].dinner = { ...late.days[1].dinner, start: '20:00', end: '21:20' };
  const { ctx, state } = fresh(at(D2, '12:00'), { digest: late, bookings: false });
  assert.equal(ctx.alarmNextAll(ctx.nowMs()).tg_checkin, Date.parse(at(D2, '21:35')));
  setNow(ctx, at(D2, '13:00'));
  say(ctx, state, '/late 30');
  assert.equal(ctx.alarmNextAll(ctx.nowMs()).tg_checkin, Date.parse(at(D2, '22:05')), 'the unbooked dinner moved 30 min later');
  setNow(ctx, at(D2, '23:31'));
  H.fireTriggers(ctx, state, 'alarmTrigger');
  assert.equal(checkins(state).length, 0, 'too late in the evening: skipped');

  const b = fresh(at(D2, '19:00'));
  say(b.ctx, b.state, '/checkin');
  assert.equal(checkins(b.state).length, 1);
  assert.doesNotMatch(checkins(b.state)[0].text, /Rehearsal/);
  assert.ok(b.ctx.tgCheckinSent(TRIP, D2));
  setNow(b.ctx, at(D2, '21:00'));
  H.fireTriggers(b.ctx, b.state, 'alarmTrigger');
  assert.equal(checkins(b.state).length, 1, 'already sent by /checkin');
});

test('the message: running late applied, dropped stops left out, numbered, one row per stop, buttons ≤ 64 bytes', () => {
  const { ctx, state } = fresh(at(D2, '13:00'));
  say(ctx, state, '/late 30');
  setNow(ctx, at(D2, '21:00'));
  H.fireTriggers(ctx, state, 'alarmTrigger');
  const [m] = checkins(state);
  assert.match(m.text, /with running late/);
  assert.match(m.text, /<b>1\.<\/b> Tide Hall · 潮見館\n<b>2\.<\/b> Glass Works · ガラス工房\n<b>3\.<\/b> The Ropewalk$/);
  assert.doesNotMatch(m.text, /Kite Museum|Harbour Tower|Sea Steps/, 'the stops running late dropped are not asked about');
  const kb = m.reply_markup.inline_keyboard;
  assert.equal(kb.length, 4);
  assert.deepEqual(kb[0].map((b) => b.text), ['1', '👍', '👎', '⏭', '⏩', '👌', '⏪']);
  assert.deepEqual(kb[3].map((b) => b.text), ['✅ Done']);
  assert.equal(kb[0][1].callback_data, 'ci:' + TRIP + ':' + d8(D2) + ':0.' + ctx.tgCmdTag('tide-hall') + ':u');
  assert.equal(kb[2][0].callback_data, 'ci:' + TRIP + ':' + d8(D2) + ':2.' + ctx.tgCmdTag('ropewalk') + ':i');
  assert.ok(cbData(m).every((d) => Buffer.byteLength(d) <= 64));
});

test('taps: stored in Choices (one row per stop, the latest wins), the keyboard re-ticked in place; Done summarises; no request', () => {
  const { ctx, state } = fresh(at(D2, '21:05'));
  say(ctx, state, '/checkin');
  let kb = checkins(state)[0].reply_markup;
  const t = (k, code) => { press(ctx, state, kb, btn(kb, k, code)); const r = remarks(state).pop(); if (r) kb = r.reply_markup; return r; };

  let r = t(1, 'u');
  assert.equal(r.message_id, 501);
  assert.deepEqual(choices(ctx).map((c) => [c.key, c.value, c.text]), [[D2 + '|tide-hall', 'up', '']]);
  assert.equal(ticked(kb)[0], '✓👍');
  t(1, 'l');
  assert.deepEqual(choices(ctx).map((c) => [c.value, c.text]), [['up', 'longer']]);
  assert.equal(ticked(kb)[0], '✓👍✓⏩');
  t(1, 'd');
  assert.deepEqual(choices(ctx).map((c) => [c.value, c.text]), [['down', 'longer']], 'the latest rating wins, the time stays');
  assert.equal(ticked(kb)[0], '✓👎✓⏩');
  t(2, 'r');
  assert.deepEqual(choices(ctx).map((c) => [c.key, c.value, c.text]), [[D2 + '|tide-hall', 'down', 'longer'], [D2 + '|glass-works', '', 'right']]);
  t(3, 's');
  const before = remarks(state).length;
  press(ctx, state, kb, btn(kb, 3, 'h'));
  assert.equal(answers(state).pop(), 'Marked skipped — tap 👍 or 👎 first.');
  assert.equal(remarks(state).length, before, 'no time on a skipped stop');
  assert.equal(choices(ctx).length, 3, 'one row per stop');
  assert.deepEqual(ticked(kb).slice(0, 3), ['✓👎✓⏩', '✓👌', '✓⏭']);
  assert.ok(kb.inline_keyboard.flat().filter((b) => /:i$/.test(b.callback_data)).every((b) => /^\d+$/.test(b.text)), 'numbers untouched');

  press(ctx, state, kb, btn(kb, 2, 'i'));
  assert.equal(answers(state).pop(), 'Glass Works');

  // A fresh /checkin shows the saved ticks.
  say(ctx, state, '/checkin');
  assert.deepEqual(ticked(checkins(state).pop().reply_markup).slice(0, 3), ['✓👎✓⏩', '✓👌', '✓⏭']);

  press(ctx, state, kb, kb.inline_keyboard[6][0].callback_data);
  const e = edits(state).pop();
  assert.equal(e.message_id, 501);
  assert.deepEqual(e.reply_markup, { inline_keyboard: [] }, 'Done removes the buttons');
  assert.match(e.text, /^🌙 <b>Check-in saved<\/b> · .*11 Jun\n<b>1\.<\/b> Tide Hall — 👎 · ⏩ needed longer\n<b>2\.<\/b> Glass Works — 👌 about right\n<b>3\.<\/b> The Ropewalk — ⏭ skipped\n<b>4\.<\/b> Kite Museum — <i>not rated<\/i>/);
  assert.equal(answers(state).pop(), 'Saved');
  assert.equal(reqOf(state, 'prefs').length + reqOf(state, 'replan').length, 0, 'a check-in sends no request');
  assert.equal(ctx.tgTripGet(TRIP).status, 'planned', 'and never marks the trip done');
});

test('a rehearsal: headed so, ticks only in its own keyboard, nothing saved, not marked sent', () => {
  const { ctx, state } = fresh(at(D2, '10:00'));
  say(ctx, state, '/checkin day 3');
  const m = checkins(state)[0];
  assert.match(m.text, /^🎭 <b>Rehearsal<\/b> — taps are not saved\n🌙 <b>How was today\?<\/b> · .*12 Jun/);
  assert.ok(cbData(m).every((d) => d.startsWith('ci:' + TRIP + ':' + d8(D3) + 'r:')));
  let kb = m.reply_markup;
  press(ctx, state, kb, btn(kb, 1, 'u')); kb = remarks(state).pop().reply_markup;
  press(ctx, state, kb, btn(kb, 1, 'l')); kb = remarks(state).pop().reply_markup;
  press(ctx, state, kb, btn(kb, 2, 's')); kb = remarks(state).pop().reply_markup;
  assert.deepEqual(ticked(kb), ['✓👍✓⏩', '✓⏭', '']);
  assert.equal(answers(state).pop(), 'Rehearsal — not saved');
  press(ctx, state, kb, kb.inline_keyboard[2][0].callback_data);
  assert.match(edits(state).pop().text, /^🎭 <b>Rehearsal<\/b> — nothing was saved · .*12 Jun\n<b>1\.<\/b> Cliff Gardens — 👍 · ⏩ needed longer\n<b>2\.<\/b> Lantern Hall — ⏭ skipped$/);
  assert.deepEqual(choices(ctx), [], 'no Choices rows');
  assert.equal(ctx.tgCheckinSent(TRIP, D3), false);
  assert.equal(ctx.tgCheckinSent(TRIP, D2), false);
  // Without the keyboard Telegram sends back, a rehearsal tap still saves nothing.
  tap(ctx, state, btn(m.reply_markup, 1, 'd'));
  assert.deepEqual(choices(ctx), []);
});

test('red team: forged, stale or oversized ci buttons change nothing; hostile names stay escaped', () => {
  const hostile = W.digest();
  hostile.days[2].stops[0] = { ...hostile.days[2].stops[0], name: '<b>Cliff</b> & "Gardens"', local_name: '<script>x</script>' };
  const { ctx, state } = fresh(at(D3, '21:00'), { digest: hostile });
  say(ctx, state, '/checkin');
  const m = checkins(state)[0];
  assert.match(m.text, /<b>1\.<\/b> &lt;b&gt;Cliff&lt;\/b&gt; &amp; "Gardens" · &lt;script&gt;x&lt;\/script&gt;/);
  const tag = ctx.tgCmdTag('cliff-gardens'), base = 'ci:' + TRIP + ':' + d8(D3);
  const bad = [
    [base + ':0.0000:u', 'This list changed — /checkin sends a fresh one.'],          // wrong tag
    [base + ':7.' + tag + ':u', 'This list changed — /checkin sends a fresh one.'],   // no such stop
    [base + ':0.' + tag + ':x', 'Unknown button'],
    [base + ':0.' + tag + ':u:extra', 'Unknown button'],
    [base + ':0.' + tag, 'Unknown button'],
    [base + 'x:0.' + tag + ':u', 'Unknown button'],
    [base + ':100.' + tag + ':u', 'Unknown button'],
    [base + ':ab:ok', 'Unknown button'],
    ['ci:' + TRIP + ':20271399:0.' + tag + ':u', 'That trip is gone.'],
    ['ci:no-such-trip:' + d8(D3) + ':0.' + tag + ':u', 'That trip is gone.'],
    ['ci:' + 'a'.repeat(200) + ':' + d8(D3) + ':0.' + tag + ':u', 'That trip is gone.']
  ];
  bad.forEach(([data, want]) => {
    tap(ctx, state, data, { messageId: 501, replyMarkup: m.reply_markup });
    assert.equal(answers(state).pop(), want, data.slice(0, 80));
  });
  assert.deepEqual(choices(ctx), []);
  assert.equal(remarks(state).length + edits(state).length, 0);
  // A forged keyboard sent back with a real tap: only this check-in's own buttons are redrawn, the rest kept as they were.
  const forged = { inline_keyboard: [[{ text: '✓evil', callback_data: 'ci:other:' + d8(D3) + ':0.' + tag + ':u' }], m.reply_markup.inline_keyboard[0]] };
  tap(ctx, state, base + ':0.' + tag + ':u', { messageId: 501, replyMarkup: forged });
  const kb = remarks(state).pop().reply_markup.inline_keyboard;
  assert.deepEqual(kb[0], [{ text: '✓evil', callback_data: 'ci:other:' + d8(D3) + ':0.' + tag + ':u' }]);
  assert.equal(kb[1][1].text, '✓👍');
  assert.deepEqual(choices(ctx).map((c) => [c.key, c.value]), [[D3 + '|cliff-gardens', 'up']]);
});

test('64 bytes: rl, rp and ci at the longest trip key, a two-digit stop and chunk, a rehearsal date', () => {
  const { ctx } = fresh(at(D2, '09:00'), { digest: false, bookings: false });
  const slug36 = 'a-' + 'z'.repeat(34), slug37 = slug36 + 'q';
  assert.equal(ctx.tgCmdTripKey(slug36), slug36, '36 characters travel as they are');
  assert.equal(ctx.tgCmdTripKey(slug37).length, 12, 'a longer slug travels as a 12-character hash key');
  const tk = ctx.tgCmdTripKey(slug36);
  const morning = J(ctx.tgMorningKeyboard({ slug: slug36 }, D2)).inline_keyboard.flat().map((b) => b.callback_data);
  const ci = J(ctx.tgCheckinKeyboard(tk, ctx.tgCheckinD8(D2, true), [{ k: 40, i: 39, tag: 'ffff' }], 99, () => ({ rating: 'up', calibration: 'longer' })))
    .inline_keyboard.flat().map((b) => b.callback_data);
  const all = morning.concat(ci, [ctx.cbEncode('rl', tk, d8(D2), 'u'), ctx.cbEncode('rp', tk, d8(D2)), ctx.cbEncode('rv', 'send', tk)]);
  assert.ok(all.some((d) => d === 'ci:' + slug36 + ':' + d8(D2) + 'r:39.ffff:u'));
  const longest = Math.max(...all.map((d) => Buffer.byteLength(d)));
  assert.ok(longest <= 64, 'longest ' + longest);
  assert.equal(longest, Buffer.byteLength('ci:' + slug36 + ':' + d8(D2) + 'r:39.ffff:u'));
});

/* ---------------- the review uses the check-ins ---------------- */
const lastKb = (state) => sends(state).filter((j) => j.reply_markup && j.reply_markup.inline_keyboard).pop();
function choose(ctx, state, label) {
  const b = buttons(lastKb(state)).find((x) => x.text === label || x.text.endsWith(label));
  assert.ok(b, label + ' among ' + buttons(lastKb(state)).map((x) => x.text).join(' | '));
  tap(ctx, state, b.callback_data, { messageId: 91 });
}
/** Today's prefs request shape, exactly as /review has sent it since WP-5a: { review: { trip, items } }. */
function checkPrefsReview(p, trip, slugs) {
  const errs = [];
  if (p.kind !== 'prefs' || !p.review || p.decisions !== undefined) errs.push('not a review prefs request');
  const r = p.review || {};
  if (Object.keys(r).sort().join() !== 'items,trip') errs.push('review keys ' + Object.keys(r));
  if (r.trip !== trip) errs.push('trip');
  if (!Array.isArray(r.items) || !r.items.length || r.items.length > 40) errs.push('items');
  const seen = new Set();
  (r.items || []).forEach((it, i) => {
    if (Object.keys(it).some((k) => !['slug', 'rating', 'calibration'].includes(k))) errs.push(i + ' keys');
    if (!slugs.includes(it.slug) || seen.has(it.slug)) errs.push(i + ' slug');
    seen.add(it.slug);
    if (!['up', 'down', 'skipped'].includes(it.rating)) errs.push(i + ' rating');
    if (it.calibration !== undefined && (!['longer', 'shorter', 'right'].includes(it.calibration) || it.rating === 'skipped')) errs.push(i + ' calibration');
  });
  const order = (r.items || []).map((it) => slugs.indexOf(it.slug));
  if (order.some((x, i) => i && x < order[i - 1])) errs.push('order');
  return errs;
}
/** Rate stops in the check-in of a date (real taps, saved). */
function rateDay(ctx, state, date, taps) {
  setNow(ctx, at(date, '21:05'));
  say(ctx, state, '/checkin');
  let kb = checkins(state).pop().reply_markup;
  taps.forEach(([k, code]) => { press(ctx, state, kb, btn(kb, k, code)); kb = remarks(state).pop().reply_markup; });
}

test('the review skips stops rated in a check-in, keeps their answers, and merges both into one prefs request', () => {
  const { ctx, state } = fresh(at(D2, '21:00'));
  rateDay(ctx, state, D2, [[1, 'd'], [1, 'l'], [2, 'u'], [2, 'r'], [3, 's'], [4, 'u'], [5, 'r']]);   // 5: a time but no rating
  rateDay(ctx, state, D3, [[1, 'u'], [1, 'h']]);
  const slugs = J(ctx.tgRvItems(TRIP)).map((i) => i.slug);
  setNow(ctx, at('2027-06-13', '12:00'));
  say(ctx, state, '/review');
  assert.match(texts(state).pop(), /<i>1 of 3 · Lark Bay<\/i>\n<b>Harbour Tower<\/b>/, 'only the stops no check-in rated');
  assert.equal(choices(ctx).length, 6, 'starting a review keeps the check-in taps');
  choose(ctx, state, 'Worth it'); choose(ctx, state, 'About right');          // harbour-tower
  choose(ctx, state, 'Not really'); choose(ctx, state, 'Needed longer');      // sea-steps
  choose(ctx, state, 'Skipped it');                                           // lantern-hall
  assert.match(texts(state).pop(), /Noted — this will shape the next plan/);
  const [pr] = reqOf(state, 'prefs');
  assert.deepEqual(J(pr.review), { trip: TRIP, items: [
    { slug: 'tide-hall', rating: 'down', calibration: 'longer' },
    { slug: 'glass-works', rating: 'up', calibration: 'right' },
    { slug: 'ropewalk', rating: 'skipped' },
    { slug: 'kite-museum', rating: 'up' },
    { slug: 'harbour-tower', rating: 'up', calibration: 'right' },
    { slug: 'sea-steps', rating: 'down', calibration: 'longer' },
    { slug: 'cliff-gardens', rating: 'up', calibration: 'shorter' },
    { slug: 'lantern-hall', rating: 'skipped' }
  ] });
  assert.deepEqual(checkPrefsReview(J(pr), TRIP, slugs), []);
  assert.equal(ctx.tgTripGet(TRIP).status, 'done');
});

test('every stop rated: the offer sends in one tap; Review again asks every stop and the review wins', () => {
  const { ctx, state } = fresh(at(D2, '21:00'));
  rateDay(ctx, state, D2, [[1, 'u'], [1, 'l'], [2, 'd'], [3, 's'], [4, 'u'], [5, 'u'], [6, 'd']]);
  rateDay(ctx, state, D3, [[1, 'u'], [2, 'u'], [2, 'r']]);
  const slugs = J(ctx.tgRvItems(TRIP)).map((i) => i.slug);

  // The daily offer the day after the trip: one tap sends the check-in ratings.
  setNow(ctx, at('2027-06-13', '09:00'));
  assert.deepEqual(J(ctx.tgRvOffer()).offered, [TRIP]);
  const offer = lastKb(state);
  assert.match(offer.text, /Your evening check-ins rated all 8 places — send them in one tap\?/);
  assert.deepEqual(buttons(offer).map((b) => [b.text, b.callback_data]), [['📨 Send my ratings', 'rv:send:' + TRIP]]);
  tap(ctx, state, 'rv:send:' + TRIP);
  assert.match(texts(state).pop(), /Noted — this will shape the next plan/);
  let prefs = reqOf(state, 'prefs');
  assert.equal(prefs.length, 1);
  assert.equal(prefs[0].review.items.length, 8);
  assert.deepEqual(prefs[0].review.items[0], { slug: 'tide-hall', rating: 'up', calibration: 'longer' });
  assert.deepEqual(checkPrefsReview(J(prefs[0]), TRIP, slugs), []);
  assert.equal(ctx.tgTripGet(TRIP).status, 'done');
  tap(ctx, state, 'rv:send:' + TRIP);
  assert.equal(answers(state).pop(), 'Already sent — /review rates the trip again.');
  assert.equal(reqOf(state, 'prefs').length, 1, 'a second tap sends nothing');

  // /review later: every stop rated, so Send or Review again; again asks all 8, check-in answers shown and kept.
  say(ctx, state, '/review Lark Bay');
  assert.match(texts(state).pop(), /all 8 places are rated from your evening check-ins/);
  choose(ctx, state, 'Review again');
  assert.match(texts(state).pop(), /<i>1 of 8 · Lark Bay<\/i>\n<b>Tide Hall<\/b>.*\n<i>Evening check-in: 👍 ⏩ — kept unless you change it<\/i>\nWorth it\?/);
  choose(ctx, state, 'Not really'); choose(ctx, state, 'Not sure');   // tide-hall: the review's rating, the check-in's time
  choose(ctx, state, 'Worth it'); choose(ctx, state, 'Less was fine'); // glass-works
  choose(ctx, state, 'Finish');
  prefs = reqOf(state, 'prefs');
  assert.equal(prefs.length, 2);
  const items = prefs[1].review.items;
  assert.equal(items.length, 8, 'stops not reached keep their check-in answers');
  assert.deepEqual(items.slice(0, 3), [{ slug: 'tide-hall', rating: 'down', calibration: 'longer' },
    { slug: 'glass-works', rating: 'up', calibration: 'shorter' }, { slug: 'ropewalk', rating: 'skipped' }]);
  assert.deepEqual(checkPrefsReview(J(prefs[1]), TRIP, slugs), []);
});

test('compatibility: no check-ins → the review asks every stop as before; an old digest gets a check-in', () => {
  const old = W.digest();
  old.days.forEach((d) => { delete d.areas; delete d.leave_by; d.stops.forEach((s) => { delete s.local_name; delete s.address; delete s.payment; delete s.price_line; }); });
  delete old.country_code;
  const { ctx, state } = fresh(at(D2, '21:00'), { digest: old });
  H.fireTriggers(ctx, state, 'alarmTrigger');
  const m = checkins(state).pop();
  assert.match(m.text, /<b>1\.<\/b> Tide Hall\n<b>2\.<\/b> Glass Works\n/);
  setNow(ctx, at('2027-06-13', '09:00'));
  ctx.tgRvOffer();
  assert.match(lastKb(state).text, /Rate the 8 places in two minutes\?/);
  assert.equal(buttons(lastKb(state))[0].callback_data, 'rv:go:' + TRIP);
  say(ctx, state, '/review');
  assert.match(texts(state).pop(), /<i>1 of 8 · Lark Bay<\/i>\n<b>Tide Hall<\/b> — [^\n]*\nWorth it\?$/);
});

// Developed by: LightAISolutions
