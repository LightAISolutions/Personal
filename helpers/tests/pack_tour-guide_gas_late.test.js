'use strict';
// Tour Guide pack — WP-12b "running late" (TG-PHASE-12 §4): /late and the rl buttons move the rest of today later as an
// overlay next to the stored day; fixed items stay; each drop names its reason; Undo; a new digest clears the overlay;
// another date is a rehearsal that saves nothing. Trip-local clock in Pacific/Kiritimati (UTC+14). Invented world:
// helpers/tests/pack_tour-guide_phase12_world.js.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const W = require('./pack_tour-guide_phase12_world');
const { J, TRIP, DATES, at } = W;

const overlay = (ctx) => JSON.parse(ctx.settingGet('tg_late', '{}') || '{}');
const sentAfter = (state, n) => W.sends(state).slice(n);

test('running late 30 at 13:00 moves the rest of the day and drops three stops, each with its reason', () => {
  const { ctx, state } = W.fresh(at(DATES[1], '13:00'));
  W.say(ctx, state, '/late 30');
  const m = W.sends(state).pop(), t = m.text;
  assert.match(t, /Running 30 min late<\/b> · Fri 11 Jun · from 13:00/);
  assert.match(t, /<b>3\.<\/b> 14:00–15:00 The Ropewalk · <i>check the hours<\/i>/, 'a stop without its own hours keeps its slot, flagged');
  assert.match(t, /Kite Museum<\/b> dropped — last entry 15:15/);
  assert.match(t, /Harbour Tower<\/b> dropped — closes 17:45/);
  assert.match(t, /Sea Steps<\/b> dropped — your 19:00 dinner booking/);
  assert.match(t, /🍽 19:00 Dinner at Salt House · booked, stays/, 'the booked dinner does not move');
  assert.ok(!/Tide Hall|Glass Works/.test(t), 'stops that ended before 13:00 are not listed as moved');
  assert.match(t, /travel time to the next one was not recalculated/);
  assert.deepEqual(W.cbData(m), ['rl:lark-bay:20270611:u', 'rp:lark-bay:20270611']);
  const o = overlay(ctx)[TRIP + '|' + DATES[1]];
  assert.deepEqual(o.taps, [{ t: '13:00', m: 30 }]);

  // The stored day is untouched; the view carries the overlay.
  const raw = J(ctx.tgDigestDay(TRIP, DATES[1]));
  assert.deepEqual(raw.stops, W.day2().stops);
  const v = J(ctx.tgLateView(ctx.tgTripGet(TRIP), ctx.tgDigestDay(TRIP, DATES[1])));
  assert.deepEqual(v.stops.map((s) => s.slug), ['tide-hall', 'glass-works', 'ropewalk']);
  assert.deepEqual(v.stops.map((s) => s.arrive), ['09:00', '11:00', '14:00']);
  assert.deepEqual(v.late.dropped.map((d) => [d.slug, d.reason]), [['kite-museum', 'last entry 15:15'], ['harbour-tower', 'closes 17:45'],
    ['sea-steps', 'your 19:00 dinner booking']]);
  assert.equal(v.dinner.start, '19:00');
  const joined = v.legs.filter((l) => l.joined);
  assert.deepEqual(joined.map((l) => [l.from, l.to]), [['ropewalk', 'salt-house']], 'the legs around the dropped stops join into one');

  // /today shows the day with the overlay, the reasons and an Undo button.
  W.say(ctx, state, '/today');
  const card = W.sends(state).filter((x) => /Day 2 of 3/.test(x.text)).pop();
  assert.match(card.text, /⏰ <i>Running 30 min late since 13:00<\/i>/);
  assert.match(card.text, /14:00–15:00/);
  assert.match(card.text, /✖️ <i>Kite Museum dropped — last entry 15:15<\/i>/);
  // WP-12r: the joined Ropewalk → Salt House leg contains the Old Pier → Tower Gate train, so it stays a train (was "walk").
  assert.match(card.text, /↳ transit · travel time not recalculated/);
  assert.ok(W.cbData(card).includes('rl:lark-bay:20270611:u'));
});

test('taps add up: 15 now and 15 more give the same day as 30; a tap later in the day moves only what is left', () => {
  const a = W.fresh(at(DATES[1], '13:00'));
  W.say(a.ctx, a.state, '/late 15');
  W.tap(a.ctx, a.state, 'rl:lark-bay:20270611:15');
  const b = W.fresh(at(DATES[1], '13:00'));
  W.say(b.ctx, b.state, '/late 30');
  const view = (w) => J(w.ctx.tgLateView(w.ctx.tgTripGet(TRIP), w.ctx.tgDigestDay(TRIP, DATES[1])));
  const va = view(a), vb = view(b);
  assert.deepEqual(va.stops, vb.stops);
  assert.deepEqual(va.late.dropped, vb.late.dropped);
  assert.equal(va.late.taps, 2);
  assert.match(W.last(a.state), /Running 30 min late/);

  const c = W.fresh(at(DATES[1], '09:30'));
  W.say(c.ctx, c.state, '/late 15');
  W.setNow(c.ctx, at(DATES[1], '11:20'));
  W.say(c.ctx, c.state, '/late 10');
  const vc = view(c);
  assert.deepEqual(vc.stops.slice(0, 2).map((s) => [s.arrive, s.depart]), [['09:15', '10:45'], ['11:25', '12:55']],
    'Tide Hall had ended by 11:20, so only the first tap moved it; Glass Works took both');
});

test('fixed items stay: a departure and an exact-time stop; a stop that runs into them drops with that reason', () => {
  const { ctx, state } = W.fresh(at(DATES[2], '13:00'));
  W.say(ctx, state, '/late 45');
  const t = W.last(state);
  assert.match(t, /Lantern Hall<\/b> dropped — the 17:30 departure/);
  assert.match(t, /🏁 17:30 Fernmoor Station · stays/);
  const v = J(ctx.tgLateView(ctx.tgTripGet(TRIP), ctx.tgDigestDay(TRIP, DATES[2])));
  assert.deepEqual(v.legs.find((l) => l.joined), { from: 'cliff-gardens', to: 'day-end', mode: 'TRANSIT', joined: true });

  const d = W.digest({ build_id: 'build-lb-exact' });
  d.days[2].stops[1].time_style = 'exact';
  const w = W.fresh(at(DATES[2], '11:00'), { digest: d });
  W.say(w.ctx, w.state, '/late 60');
  assert.match(W.last(w.state), /<b>2\.<\/b> 14:00–16:30 Lantern Hall · stays/);
  assert.match(W.last(w.state), /<b>1\.<\/b> 11:00–13:00 Cliff Gardens/);
  W.say(w.ctx, w.state, '/late 60');
  assert.match(W.last(w.state), /Cliff Gardens<\/b> dropped — Lantern Hall at 14:00/);
});

test('Undo restores the day; a new digest that changes the day clears the overlay, an unchanged one keeps it', () => {
  const { ctx, state } = W.fresh(at(DATES[1], '13:00'));
  W.say(ctx, state, '/late 30');
  W.tap(ctx, state, 'rl:lark-bay:20270611:u');
  assert.deepEqual(overlay(ctx), {});
  assert.match(W.last(state), /back to the plan/);
  W.tap(ctx, state, 'rl:lark-bay:20270611:u');
  assert.equal(W.sends(state).filter((m) => /back to the plan/.test(m.text)).length, 1, 'a second Undo has nothing to undo');
  W.say(ctx, state, '/today');
  assert.ok(!/Running/.test(W.sends(state).filter((x) => /Day 2 of 3/.test(x.text)).pop().text));

  W.say(ctx, state, '/late 30');
  W.deliver(ctx, state, 'plan_digest', W.digest({ build_id: 'build-lb-same' }));
  assert.ok(overlay(ctx)[TRIP + '|' + DATES[1]], 'a digest that leaves today unchanged keeps the overlay');
  const changed = W.digest({ build_id: 'build-lb-replan' });
  changed.days[1].stops = changed.days[1].stops.slice(0, 3);
  changed.days[1].legs = changed.days[1].legs.slice(0, 3).concat([{ from: 'ropewalk', to: 'salt-house', mode: 'WALK', minutes: 25 }]);
  W.deliver(ctx, state, 'plan_digest', changed);
  assert.deepEqual(overlay(ctx), {}, 'the re-planned day clears it');
});

test('another date is a rehearsal: headed so, no buttons, nothing saved, the time now stands in for the tap', () => {
  const { ctx, state } = W.fresh(at(DATES[0], '13:00'));
  W.say(ctx, state, '/late 30 day 2');
  const m = W.sends(state).pop();
  assert.match(m.text, /^🎭 <b>Rehearsal<\/b> — nothing is saved/);
  assert.match(m.text, /from 13:00/);
  assert.match(m.text, /Kite Museum<\/b> dropped — last entry 15:15/);
  assert.equal(m.reply_markup, undefined);
  W.tap(ctx, state, 'rl:lark-bay:20270612:60');
  assert.match(W.last(state), /Rehearsal/);
  assert.deepEqual(overlay(ctx), {});
});

test('bounds and forged buttons: minutes outside 5–240, an unknown shape or trip change nothing', () => {
  const { ctx, state } = W.fresh(at(DATES[1], '13:00'));
  W.say(ctx, state, '/late 4');
  assert.match(W.last(state), /Between 5 and 240/);
  W.say(ctx, state, '/late 241');
  assert.match(W.last(state), /Between 5 and 240/);
  W.say(ctx, state, '/late soon');
  assert.match(W.last(state), /Usage/);
  const n = W.sends(state).length;
  for (const data of ['rl:lark-bay:2027061:30', 'rl:lark-bay:20270611:45', 'rl:lark-bay:20270611:30:x', 'rl:lark-bay:20271311:30', 'rl:no-trip:20270611:30', 'rl:' + 'x'.repeat(40) + ':20270611:30']) {
    W.tap(ctx, state, data);
  }
  assert.equal(W.sends(state).length, n, 'no message for a forged button');
  assert.deepEqual(overlay(ctx), {});
  const answers = state.fetch.telegram('answerCallbackQuery').map((r) => r.json.text);
  assert.ok(answers.every((a) => /Unknown button|That trip is gone/.test(a)), answers.join(' | '));
});

test('hostile names stay text in the running-late reply and on the day card', () => {
  const d = W.digest({ build_id: 'build-lb-hostile' });
  d.days[1].stops[2].name = '<b>Rope</b> & "walk" <a href="https://evil.example">x</a>';
  d.days[1].stops[3].name = '</i><script>alert(1)</script>';
  const { ctx, state } = W.fresh(at(DATES[1], '13:00'), { digest: d });
  W.say(ctx, state, '/late 30');
  const t = W.last(state);
  assert.ok(t.includes('&lt;b&gt;Rope&lt;/b&gt; &amp; "walk" &lt;a href="https://evil.example"&gt;x&lt;/a&gt;'));
  assert.ok(t.includes('&lt;/i&gt;&lt;script&gt;alert(1)&lt;/script&gt;</b> dropped'));
  assert.ok(!/<script>|<a href="https:\/\/evil/.test(t), "no live tag reaches Telegram");
});

// Developed by: LightAISolutions
