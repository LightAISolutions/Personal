'use strict';
// WP-13c (B4, core half): dated stays from the chat — /lodging add, replace, remove, clear and list; every refusal;
// trip_update.lodging (C13) on every kind that carries a trip_update; the research line; old lodging as before.
// Invented data: the trip "Fernhollow" (10–15 Jun 2027, nights 10–14 Jun) and invented inns.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const W = require('./pack_tour-guide_p13c_world');

const NOTHING = 'nothing was saved';
const lodging = (ctx) => W.J(ctx.tgTripGet(W.TRIP).lodging);
const stays = (ctx) => (lodging(ctx) || {}).stays;

test('/lodging adds a dated stay, lists it with the nights no stay covers, and replaces a stay whose nights overlap', () => {
  const { ctx, state } = W.fresh();
  W.trip(ctx);
  W.say(ctx, state, '/lodging Reed <Inn> & Rooms 2027-06-10 to 2027-06-12');
  assert.equal(W.last(state), '🏨 Saved for Fernhollow: Reed &lt;Inn&gt; &amp; Rooms · Thu 10 Jun → Sat 12 Jun (2 nights).\n' +
    'It goes with the next research round. /lodging lists your stays.');
  assert.deepEqual(stays(ctx), [{ text: 'Reed <Inn> & Rooms', from: '2027-06-10', to: '2027-06-12' }]);
  const l = lodging(ctx);
  assert.equal(l.text, 'Reed <Inn> & Rooms: 2 nights, 2027-06-10 to 2027-06-12', 'text stays readable by old code');
  assert.equal(l.nights, 2);
  assert.equal(l.set_at, ctx.nowIso());

  W.say(ctx, state, '/lodging Gull House 2027-06-12 to 2027-06-14');
  W.say(ctx, state, '/lodging');
  assert.equal(W.last(state), '🏨 <b>Stays for Fernhollow</b>\n' +
    '• Reed &lt;Inn&gt; &amp; Rooms · Thu 10 Jun → Sat 12 Jun (2 nights)\n' +
    '• Gull House · Sat 12 Jun → Mon 14 Jun (2 nights)\n' +
    'No stay yet for the night of Mon 14 Jun.\n' +
    'Add a stay with <code>/lodging &lt;name&gt; &lt;first night&gt; to &lt;check-out&gt;</code> (e.g. <code>/lodging Reed Inn 2027-06-10 to 2027-06-12</code>) · ' +
    'remove one with <code>/lodging remove &lt;first night&gt;</code> · <code>/lodging clear</code> removes them all.');

  // One night of the new stay overlaps each stored stay: both are replaced, and the reply names them.
  W.say(ctx, state, '/lodging Weir Lodge 2027-06-11 to 2027-06-13');
  assert.equal(W.last(state), '🏨 Saved for Fernhollow: Weir Lodge · Fri 11 Jun → Sun 13 Jun (2 nights).\n' +
    'It replaces Reed &lt;Inn&gt; &amp; Rooms · Thu 10 Jun → Sat 12 Jun (2 nights); Gull House · Sat 12 Jun → Mon 14 Jun (2 nights).\n' +
    'It goes with the next research round. /lodging lists your stays.');
  assert.deepEqual(stays(ctx), [{ text: 'Weir Lodge', from: '2027-06-11', to: '2027-06-13' }]);
  // A check-out on another stay's first night is not an overlap.
  W.say(ctx, state, '/lodging Pear Barn 2027-06-13 to 2027-06-15');
  W.say(ctx, state, '/lodging Mill Cottage 2027-06-10 to 2027-06-11');
  assert.deepEqual(stays(ctx).map((s) => s.text), ['Mill Cottage', 'Weir Lodge', 'Pear Barn']);
  W.say(ctx, state, '/lodging');
  assert.match(W.last(state), /\nEvery night of the trip has a stay\.\n/);
});

test('/lodging date words: today, tomorrow (the trip\'s own day), day N from the trip\'s first day; arrows and dashes', () => {
  const { ctx, state } = W.fresh('2027-06-10T08:00:00Z');
  W.trip(ctx);
  W.say(ctx, state, '/lodging Reed Inn today to day 3');
  assert.deepEqual(stays(ctx), [{ text: 'Reed Inn', from: '2027-06-10', to: '2027-06-12' }]);
  W.say(ctx, state, '/lodging Gull House day 3 → Day 6');
  W.say(ctx, state, '/lodging remove day3');
  assert.match(W.last(state), /^🏨 Removed Gull House · Sat 12 Jun → Tue 15 Jun \(3 nights\)\./);
  W.say(ctx, state, '/lodging Weir Lodge tomorrow - 2027-06-13');
  assert.deepEqual(stays(ctx), [{ text: 'Weir Lodge', from: '2027-06-11', to: '2027-06-13' }], 'tomorrow overlaps Reed Inn → replaced');
});

test('/lodging remove and clear; refusals name what to do and save nothing', () => {
  const { ctx, state } = W.fresh();
  W.trip(ctx);
  W.say(ctx, state, '/lodging clear');
  assert.equal(W.last(state), '🏨 No lodging is saved for Fernhollow.');
  W.say(ctx, state, '/lodging Reed Inn 2027-06-10 to 2027-06-12');
  W.say(ctx, state, '/lodging Gull House 2027-06-12 to 2027-06-15');
  const before = JSON.stringify(lodging(ctx));
  const refused = [
    ['/lodging remove', '🏨 Which stay? <code>/lodging remove &lt;first night&gt;</code> — /lodging lists them.'],
    ['/lodging remove 2027-06-11', '🏨 No stay starts on Fri 11 Jun — nothing was removed. /lodging lists them.'],
    ['/lodging remove 2027-02-30', '🏨 <code>2027-02-30</code> is not a date I know: use YYYY-MM-DD, today, tomorrow or day N — nothing was removed.'],
    ['/lodging 2027-06-10 to 2027-06-12', '🏨 Which lodging? <code>/lodging &lt;name&gt; &lt;first night&gt; to &lt;check-out&gt;</code> — nothing was saved.'],
    ['/lodging Inn 2027-06-31 to 2027-07-02', '🏨 <code>2027-06-31</code> is not a date I know: use YYYY-MM-DD, today, tomorrow or day N — nothing was saved.'],
    ['/lodging Inn 2027-06-12 to 2027-06-12', '🏨 The check-out date must come after the first night (Sat 12 Jun → Sat 12 Jun) — nothing was saved.'],
    ['/lodging Inn 2027-06-13 to 2027-06-11', '🏨 The check-out date must come after the first night (Sun 13 Jun → Fri 11 Jun) — nothing was saved.'],
    ['/lodging Inn ' + 'x'.repeat(198) + ' 2027-06-10 to 2027-06-11', '🏨 Please keep a stay under 200 characters (that was 202) — nothing was saved.'],
    ['/lodging Quay Inn', '🏨 Fernhollow has dated stays, so a stay needs its nights: <code>/lodging &lt;name&gt; &lt;first night&gt; to &lt;check-out&gt;</code>. ' +
      'To start over, <code>/lodging clear</code> removes them all — nothing was saved.'],
  ];
  refused.forEach(([cmd, want]) => {
    W.say(ctx, state, cmd);
    assert.equal(W.last(state), want, cmd);
    assert.equal(JSON.stringify(lodging(ctx)), before, cmd + ': nothing saved');
  });
  W.say(ctx, state, '/lodging remove 2027-06-10');
  assert.equal(W.last(state), '🏨 Removed Reed Inn · Thu 10 Jun → Sat 12 Jun (2 nights).');
  assert.deepEqual(stays(ctx).map((s) => s.text), ['Gull House']);
  W.say(ctx, state, '/lodging clear');
  // Coordinator (WP-13c REQUEST 1): C13 never sends "no stays", so the reply says the old stays stay in use.
  assert.equal(W.last(state), '🏨 Cleared the lodging of Fernhollow. The plan keeps using the old stays until you add new ones. Add a stay with <code>/lodging &lt;name&gt; &lt;first night&gt; to &lt;check-out&gt;</code>.');
  assert.deepEqual([stays(ctx), lodging(ctx).text], [[], '']);
  assert.equal(ctx.tgLgFp(ctx.tgTripGet(W.TRIP)), '', 'no lodging → no fingerprint');
  // With every stay gone, the undated form works again.
  W.say(ctx, state, '/lodging Quay Inn');
  assert.match(W.last(state), /^🏨 Saved for Fernhollow: Quay Inn\n/);
});

test('/lodging day N without trip dates, a stay outside the trip, the 13th stay, a first stay replacing undated words', () => {
  const { ctx, state } = W.fresh();
  ctx.tgTripUpsert({ slug: W.TRIP, title: 'Fernhollow', destination: 'Fernhollow' });
  ctx.settingSet(ctx.TG_SETTINGS.CURRENT_TRIP, W.TRIP, 'test');
  W.say(ctx, state, '/lodging Reed Inn day 1 to day 3');
  assert.equal(W.last(state), '🏨 <code>day 1</code> needs the trip\'s dates first: <code>/dates 2027-05-12 2027-05-14</code> — nothing was saved.');
  W.say(ctx, state, '/lodging Old <Mill>, 3 nights');
  W.say(ctx, state, '/lodging Reed Inn 2027-06-08 to 2027-06-11');
  assert.equal(W.last(state), '🏨 Saved for Fernhollow: Reed Inn · Tue 8 Jun → Fri 11 Jun (3 nights).\nIt replaces “Old &lt;Mill&gt;, 3 nights”.\n' +
    'It goes with the next research round. /lodging lists your stays.');
  W.say(ctx, state, '/lodging');
  assert.doesNotMatch(W.last(state), /outside|No stay yet/, 'no trip dates → nothing to compare');
  W.trip(ctx);   // 10–15 Jun
  W.say(ctx, state, '/lodging');
  assert.match(W.last(state), /^• Reed Inn · Tue 8 Jun → Fri 11 Jun \(3 nights\) — ⚠️ outside the trip's dates$/m);
  assert.match(W.last(state), /^No stay yet for the nights of Fri 11 Jun–Mon 14 Jun\.$/m);

  for (let i = 0; i < 11; i++) W.say(ctx, state, `/lodging Inn ${i} 2027-07-${String(i + 1).padStart(2, '0')} to 2027-07-${String(i + 2).padStart(2, '0')}`);
  assert.equal(stays(ctx).length, 12);
  const before = JSON.stringify(lodging(ctx));
  W.say(ctx, state, '/lodging One Too Many 2027-08-01 to 2027-08-02');
  assert.equal(W.last(state), '🏨 A trip holds at most 12 stays — remove one with <code>/lodging remove &lt;first night&gt;</code> first. Nothing was saved.');
  assert.equal(JSON.stringify(lodging(ctx)), before);
  W.say(ctx, state, '/lodging Wide Inn 2027-07-01 to 2027-07-04');   // replaces three, so 10 remain: allowed
  assert.equal(stays(ctx).length, 10);
});

test('trip_update.lodging: the whole list on research, plan and replan once a stay is set; C13 checks it; the research line lists every stay', () => {
  const { ctx, state } = W.fresh();
  W.planned(ctx, state);
  W.say(ctx, state, '/replan 2027-06-11 more orchards');
  assert.equal(W.reqOf(state, 'replan').pop().trip_update.lodging, undefined, 'no stay yet → absent (the trip file is untouched)');
  W.say(ctx, state, '/lodging Old Mill');   // undated: still absent
  W.say(ctx, state, '/replan 2027-06-11 more orchards');
  assert.equal(W.reqOf(state, 'replan').pop().trip_update.lodging, undefined);

  W.say(ctx, state, '/lodging Gull House 2027-06-12 to 2027-06-15');
  W.say(ctx, state, '/lodging Reed Inn 2027-06-10 to 2027-06-12');
  const want = [{ text: 'Reed Inn', from: '2027-06-10', to: '2027-06-12' }, { text: 'Gull House', from: '2027-06-12', to: '2027-06-15' }];
  W.say(ctx, state, '/replan 2027-06-11 more orchards');
  const tu = W.reqOf(state, 'replan').pop().trip_update;
  assert.deepEqual(tu.lodging, want);
  assert.deepEqual(W.J(ctx.tgLgCheck(W.J(tu.lodging))), [], 'valid against C13');
  ['research', 'plan', 'replan', 'outline', 'day_versions'].forEach((k) => assert.ok(ctx.TG_TRIP_UPDATE_KINDS.includes(k), k));
  ctx.tgOpenKindRequest('research', { trip: W.TRIP, scope: 'more', destination: 'Fernhollow' }, { ack: false });
  assert.deepEqual(W.reqOf(state, 'research').pop().trip_update.lodging, want);
  ctx.tgOpenKindRequest('plan', { trip: W.TRIP, picks: [] }, { ack: false });
  assert.deepEqual(W.reqOf(state, 'plan').pop().trip_update.lodging, want);

  assert.equal(ctx.tgCmdLodgingText(ctx.tgTripGet(W.TRIP)), 'Reed Inn: 2 nights, 2027-06-10 to 2027-06-12; Gull House: 3 nights, 2027-06-12 to 2027-06-15');
  // The plan flow's research request keeps the stays (its own lodging words go with them, never over them).
  ctx.tgPlanResearchNew({ trip: W.TRIP, dest: 'Fernhollow', answers: { lodging: 'near the weir' }, facts: [], seeds_pending: [] });
  assert.equal(W.reqOf(state, 'research').pop().lodging, 'Reed Inn: 2 nights, 2027-06-10 to 2027-06-12; Gull House: 3 nights, 2027-06-12 to 2027-06-15; near the weir');
  assert.deepEqual(stays(ctx), want, 'the stays are not overwritten');
});

test('C13 lodging checks: bounds, order, overlap, unknown keys', () => {
  const { ctx } = W.fresh();
  const ok = [{ text: 'A', from: '2027-06-10', to: '2027-06-12' }, { text: 'B', from: '2027-06-12', to: '2027-06-13' }];
  assert.deepEqual(W.J(ctx.tgLgCheck(ok)), []);
  const bad = (f) => { const v = W.J(ok); f(v); return W.J(ctx.tgLgCheck(v)); };
  assert.match(ctx.tgLgCheck([]).join(), /1–12 stays/);
  assert.match(ctx.tgLgCheck(Array.from({ length: 13 }, (_, i) => ({ text: 'x', from: `2027-07-${String(i + 1).padStart(2, '0')}`, to: `2027-07-${String(i + 2).padStart(2, '0')}` }))).join(), /1–12 stays/);
  assert.match(ctx.tgLgCheck('stays').join(), /array required/);
  assert.match(bad((v) => { v[0].text = ''; }).join(), /lodging\[0\]\.text/);
  assert.match(bad((v) => { v[0].text = 't'.repeat(201); }).join(), /lodging\[0\]\.text/);
  assert.deepEqual(bad((v) => { v[0].text = 't'.repeat(200); }), []);
  assert.match(bad((v) => { v[0].from = '2027-6-10'; }).join(), /lodging\[0\]\.from/);
  assert.match(bad((v) => { v[0].to = '2027-06-10'; }).join(), /lodging\[0\]\.to: after from/);
  assert.match(bad((v) => { v[1].from = '2027-06-11'; }).join(), /lodging\[1\]: nights overlap/);
  assert.match(bad((v) => { v.reverse(); }).join(), /sorted by from/);
  assert.match(bad((v) => { v[0].nights = 2; }).join(), /lodging\[0\]\.nights: unknown key/);
  assert.match(bad((v) => { v[1] = 'B'; }).join(), /lodging\[1\]: object required/);
});

test('old lodging displays exactly as before: undated words, nights, a JSON string, and no lodging at all', () => {
  const { ctx, state } = W.fresh();
  W.trip(ctx);
  W.say(ctx, state, '/lodging');
  assert.equal(W.last(state), 'Where are you staying? <code>/lodging &lt;name, area or address&gt;</code>');
  ctx.tgTripUpsert({ slug: W.TRIP, lodging: { text: 'Old Mill <Hostel>, 3 nights', nights: 3 } });   // saved before this phase
  W.say(ctx, state, '/lodging');
  assert.equal(W.last(state), 'Staying: Old Mill &lt;Hostel&gt;, 3 nights\nChange it with <code>/lodging &lt;where&gt;</code>.');
  W.say(ctx, state, '/trip');
  assert.match(W.last(state), /\nStaying: Old Mill &lt;Hostel&gt;, 3 nights\n/);
  assert.equal(ctx.tgCmdLodgingText(ctx.tgTripGet(W.TRIP)), 'Old Mill <Hostel>, 3 nights');
  assert.equal(ctx.tgTripUpdateOf(W.TRIP).lodging, undefined);
  assert.equal(ctx.tgCmdLodgingText({ lodging: { text: 'Inn', nights: 2 } }), 'Inn (2 nights)');
  assert.deepEqual(W.J(ctx.tgLgStays({ lodging: '{"text":"Inn","stays":[{"text":"A","from":"2027-06-10","to":"2027-06-11"}]}' })), [{ text: 'A', from: '2027-06-10', to: '2027-06-11' }]);
  assert.deepEqual(W.J(ctx.tgLgStays({ lodging: { text: 'Inn', stays: [{ text: 'A', from: '2027-06-11', to: '2027-06-10' }, 'x'] } })), [], 'a broken stay is ignored');
  // With stays, /trip lists each one.
  W.say(ctx, state, '/lodging clear');
  W.say(ctx, state, '/lodging Reed Inn 2027-06-10 to 2027-06-12');
  W.say(ctx, state, '/trip');
  assert.match(W.last(state), /\nStaying:\n🏨 Reed Inn · Thu 10 Jun → Sat 12 Jun \(2 nights\)\n/);
});

test('a stay change still offers to re-plan the planned days it touches, from its first night', () => {
  const { ctx, state } = W.fresh();
  W.planned(ctx, state);   // days 10, 11, 12 Jun
  W.say(ctx, state, '/lodging Gull House 2027-06-11 to 2027-06-13');
  const m = W.sends(state).pop();
  assert.match(m.text, /\n🔁 The plan still starts and ends those days at the old lodging: re-plan 2 days from Fri 11 Jun\?$/);
  const tk = ctx.tgCmdTripKey(W.TRIP);
  assert.deepEqual(W.kbData(m), ['lg:' + tk + ':20270611', 'lg:' + tk + ':k']);
  W.say(ctx, state, '/lodging remove 2027-06-11');
  // Coordinator (WP-13c REQUEST 1): removing the last stay sends no stays, so a re-plan would use the old ones: no offer,
  // and the reply says the old stays stay in use. With a stay left, a removal still offers the re-plan.
  const gone = W.sends(state).pop();
  assert.equal(gone.text, '🏨 Removed Gull House · Fri 11 Jun → Sun 13 Jun (2 nights). The plan keeps using the old stays until you add new ones.');
  assert.deepEqual(W.kbData(gone), []);
  W.say(ctx, state, '/lodging Reed Inn 2027-06-10 to 2027-06-11');
  W.say(ctx, state, '/lodging Gull House 2027-06-11 to 2027-06-13');
  W.say(ctx, state, '/lodging remove 2027-06-11');
  // Coordinator (probe P): Reed Inn, added for the 10th, was never re-planned or kept, so the offer starts there.
  assert.match(W.last(state), /re-plan 3 days from Thu 10 Jun\?$/);
  W.tap(ctx, state, 'lg:' + tk + ':k');   // keep the plan: nothing is waiting any more
  W.say(ctx, state, '/lodging Gull House 2027-06-14 to 2027-06-15');
  assert.doesNotMatch(W.last(state), /re-plan/, 'no planned day from 14 Jun on');
});

test('red team: hostile stay text is stripped of hidden characters, escaped everywhere, and an oversized list is refused', () => {
  const { ctx, state } = W.fresh();
  W.planned(ctx, state);
  const hostile = '<a href="https://evil.example.invalid/">Inn</a>​‮ & <b>x</b>';
  W.say(ctx, state, '/lodging ' + hostile + ' 2027-06-10 to 2027-06-12');
  const saved = stays(ctx)[0].text;
  assert.equal(saved, '<a href="https://evil.example.invalid/">Inn</a> & <b>x</b>', 'hidden characters stripped, the words kept as data');
  const shown = [];
  W.say(ctx, state, '/lodging'); shown.push(W.last(state));
  W.say(ctx, state, '/trip'); shown.push(W.last(state));
  shown.push(W.sends(state).filter((m) => /Saved for/.test(m.text)).pop().text);
  shown.forEach((t) => {
    assert.doesNotMatch(t, /<a href="https:\/\/evil|<b>x<\/b>|​|‮/);
    assert.match(t, /&lt;a href=&quot;https:\/\/evil\.example\.invalid\/&quot;&gt;Inn&lt;\/a&gt; &amp; &lt;b&gt;x&lt;\/b&gt;|&lt;a href="https:\/\/evil\.example\.invalid\/"&gt;Inn&lt;\/a&gt; &amp; &lt;b&gt;x&lt;\/b&gt;/);
  });
  // A stored list that somehow grew past 12 (an old or hand-edited row) is never sent as trip_update.lodging.
  const big = Array.from({ length: 13 }, (_, i) => ({ text: 'Inn ' + i, from: `2027-07-${String(i + 1).padStart(2, '0')}`, to: `2027-07-${String(i + 2).padStart(2, '0')}` }));
  ctx.tgTripUpsert({ slug: W.TRIP, lodging: { text: 'x', stays: big, set_at: ctx.nowIso() } });
  assert.equal(ctx.tgTripUpdateOf(W.TRIP).lodging, undefined, 'an oversized list is not sent');
  W.say(ctx, state, '/lodging Inn 13 2027-08-01 to 2027-08-02');
  assert.match(W.last(state), /at most 12 stays/);
});

// Developed by: LightAISolutions
