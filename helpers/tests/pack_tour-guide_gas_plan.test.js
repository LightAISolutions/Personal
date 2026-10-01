'use strict';
// Tour Guide pack — gas/12_flow_plan.js: the /plan journey (intake → facts → questions → research → shortlist rounds →
// plan → digest), its renderers and the no-flow paths. Trips, places and wording are invented ("Port Sorrel").
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');

const NOW = '2027-05-01T12:00:00Z';
const TRIP = 'port-sorrel';
const J = (v) => JSON.parse(JSON.stringify(v));
const maps = (id) => 'https://www.google.com/maps/search/?api=1&query=Fixture&query_place_id=' + id;

function fresh() {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: NOW });
  H.bootstrap(ctx, state);
  ['RESEARCH', 'PLAN', 'PREFS'].forEach((n) => H.configureRoutine(ctx, state, n));
  return { ctx, state };
}
const post = (ctx, state, upd) => ctx.doPost(H.postEvent('tg', { k: state.props[ctx.PROP.WEBHOOK_SECRET] }, upd));
const say = (ctx, state, text) => post(ctx, state, H.tgUpdate({ text }));
const sends = (state) => state.fetch.telegram('sendMessage').map((r) => r.json);
const texts = (state) => sends(state).map((m) => m.text);
const answers = (state) => state.fetch.telegram('answerCallbackQuery').map((r) => r.json.text);
const lastKb = (state) => sends(state).filter((j) => j.reply_markup).pop();
const allData = (state) => sends(state).flatMap((m) => (m.reply_markup ? m.reply_markup.inline_keyboard.flat().map((b) => b.callback_data).filter(Boolean) : []));
const requests = (state) => (state.drive.listFiles('TourGuide/mailbox/to-brain') || []).filter((n) => /^req_/.test(n))
  .map((n) => JSON.parse(state.drive.readFile('TourGuide/mailbox/to-brain', n)).payload);
const reqOf = (state, kind, scope) => requests(state).filter((r) => r.kind === kind && (!scope || r.scope === scope));
function deliver(ctx, state, type, payload) {
  H.putEnvelope(state, H.envelope(type, payload));
  return J(ctx.pollFromBrain());
}
/** Tap callback data; with markup, the tapped message carries that keyboard (as Telegram sends it). */
function tap(ctx, state, data, markup) {
  const upd = H.tgUpdate({ callback: data, messageId: 91 });
  if (markup) upd.callback_query.message.reply_markup = markup;
  post(ctx, state, upd);
}
/** Press the flow (fl:) button whose label matches on the last keyboard. */
function press(ctx, state, label) {
  const b = lastKb(state).reply_markup.inline_keyboard.flat().find((x) => x.text === label || x.text.endsWith(label));
  assert.ok(b, 'button ' + label + ' among ' + lastKb(state).reply_markup.inline_keyboard.flat().map((x) => x.text).join(' | '));
  tap(ctx, state, b.callback_data);
}

/* ---------------- fixtures ---------------- */
const item = (n, slug, over = {}) => ({ n, slug, name: slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '),
  why_you: 'Quiet in the morning.', fit: 0.8, est_minutes: 60, area: 'Old harbour', maps_url: maps('Fixture' + n), labels: ['verified'], ...over });
const facts = (over = {}) => ({ v: 1, kind: 'trip_facts', trip: TRIP,
  found: [{ n: 1, kind: 'dates', text: 'Wed 12 to Fri 14 May', start: '2027-05-12', end: '2027-05-14' },
    { n: 2, kind: 'lodging', text: 'Old Mill Hostel', start: '2027-05-12', end: '2027-05-15' }], missing: ['lodging', 'flight'], ...over });
const shortlist = (over = {}) => ({ v: 1, kind: 'shortlist', trip: TRIP, run_id: 'r1', round: 1, more: true, decided: [],
  groups: [{ id: 'activities', gems_wanted: 2, gems_shown: 1, items: [item(1, 'lantern-museum'), item(2, 'signal-hill-lookout', { gem: true, gem_line: 'Small and loved by locals.' })] },
    { id: 'food', items: [item(1, 'saffron-row-market')] }], ...over });
const digest = (over = {}) => ({ v: 1, kind: 'plan_digest', trip: TRIP, build_id: 'build-ps-1', verified_on: '2027-04-30',
  days: [{ date: '2027-05-12', theme: 'Harbour', stops: [{ n: 1, slug: 'lantern-museum', name: 'Lantern Museum', arrive: '10:00', depart: '11:00',
    minutes: 60, maps_url: maps('FixtureA'), note_line: 'Start upstairs.' }], legs: [{ from: 'lodging', to: 'lantern-museum', mode: 'WALK', minutes: 9 }], warnings: ['Closes early on Wednesdays.'] },
  { date: '2027-05-13', theme: 'Hill', stops: [], legs: [], warnings: [] }],
  later: [{ slug: 'signal-hill-lookout', name: 'Signal Hill Lookout', reason: 'owner_choice' }],
  drive: { plan: 'fixtureDrivePlanFile01', brochure_html: null, brochure_pdf: null }, ...over });

test('pure helpers: dates, seeds, slugs, the seed match', () => {
  const { ctx } = fresh();
  assert.deepEqual(J(ctx.tgPlanParseDates('from 2027-05-16 to 2027-05-12')), { start: '2027-05-12', end: '2027-05-16' });
  assert.deepEqual(J(ctx.tgPlanParseDates('2027-05-12')), { start: '2027-05-12', end: '2027-05-12' });
  assert.equal(ctx.tgPlanParseDates('next week'), null);
  assert.equal(ctx.tgPlanParseDates('2027-01-01 to 2027-06-01'), null, 'longer than the cap');
  assert.equal(ctx.tgPlanParseDates('2027-02-30'), null);
  assert.deepEqual(J(ctx.tgPlanSeedsFrom(' Tea  House ,\n/cancel; ' + 'y'.repeat(90))), ['Tea House', 'y'.repeat(80)]);
  assert.equal(ctx.tgPlanIsSeed({ name: 'The Lantern Museum' }, ['lantern museum']), true);
  assert.equal(ctx.tgPlanIsSeed({ name: 'Bar' }, ['ba']), false);
  assert.equal(ctx.tgPlanIsSeed({ name: 'Somewhere', labels: ['owner_seed'] }, []), true);
  assert.equal(ctx.tgPlanSlugFor('Port Sorrel'), TRIP);
  ctx.tgTripUpsert({ slug: TRIP, status: 'done' });
  assert.equal(ctx.tgPlanSlugFor('Port Sorrel'), TRIP + '-2');
  assert.match(ctx.tgPlanSlugFor('東京'), /^trip-[0-9a-f]{8}$/);
});

test('renderers: escaped text, callback data in bounds, the 💎 floor line, digest buttons', () => {
  const { ctx } = fresh();
  const fm = J(ctx.tgPlanFactsMessages(facts({ found: [{ n: 1, kind: 'booking', text: 'Ferry <b>&</b> bikes' }] })));
  assert.match(fm[0].html, /Ferry &lt;b&gt;&amp;&lt;\/b&gt; bikes/);
  assert.match(fm[0].html, /Still missing: staying, flight/);
  assert.deepEqual(fm[0].keyboard.inline_keyboard[0].map((b) => b.callback_data), ['tf:port-sorrel:1:y', 'tf:port-sorrel:1:e', 'tf:port-sorrel:1:n']);

  const sl = J(ctx.tgPlanShortlistMessages(shortlist({ groups: [{ id: 'activities', gems_wanted: 2, gems_shown: 1,
    items: [item(1, 'lantern-museum', { name: 'Lantern <Museum>', seen_before: { trip: 'port-sorrel-2026', on: '2026-06-02', outcome: 'visited' }, changes: ['New hours'] }),
      item(2, 'signal-hill-lookout', { gem: true, gem_line: 'Small and loved by locals.' })] }] }), { seeds: ['signal hill lookout'] }));
  const h = sl.map((m) => m.html).join('\n');
  assert.match(h, /Lantern &lt;Museum&gt;/);
  assert.match(h, /seen 2026-06-02 \(visited\)/);
  assert.match(h, /Changed: New hours/);
  assert.match(h, /💎 <b><a href="https:\/\/www\.google\.com\/maps[^"]*">Signal Hill Lookout<\/a><\/b> · ~1 h|💎 <b><a href=/);
  assert.match(h, /<b>your pick<\/b>/);
  assert.match(h, /Only 1 of the 2 hidden gems/);
  const data = sl.flatMap((m) => m.keyboard.inline_keyboard.flat().map((b) => b.callback_data));
  assert.deepEqual(data.slice(0, 3), ['sl:r1:a1:w', 'sl:r1:a1:l', 'sl:r1:a1:s']);
  assert.ok(data.every((d) => Buffer.byteLength(d) <= 64 && /^[a-z]+(:[A-Za-z0-9_.|-]+)+$/.test(d)));

  const long = J(ctx.tgPlanShortlistMessages(shortlist({ run_id: 'a-very-long-run-identifier-from-the-brain-2027' }), { adopt: true }));
  const ld = long.flatMap((m) => m.keyboard.inline_keyboard.flat().map((b) => b.callback_data));
  assert.ok(ld.every((d) => Buffer.byteLength(d) <= 64));
  assert.match(ld[0], /^sl:r[0-9a-f]{11}:a1:w$/);
  assert.match(ld[ld.length - 1], /^pl:sc:port-sorrel:r[0-9a-f]{11}:1$/);

  const many = J(ctx.tgPlanShortlistMessages(shortlist({ groups: [{ id: 'food', items: Array.from({ length: 19 }, (_, i) => item(i + 1, 'stall-' + (i + 1))) }] })));
  assert.equal(many.length, 3, '8 items per message');
  assert.ok(many.every((m) => m.html.length <= 3900));

  const dm = J(ctx.tgPlanDigestMessages(digest()));
  assert.match(dm[0].html, /2 days · checked on 2027-04-30/);
  assert.match(dm[0].html, /⚠️ 1 note/);
  assert.match(dm[0].html, /Signal Hill Lookout — <i>saved by you<\/i>/);
  assert.deepEqual(dm[0].keyboard.inline_keyboard.flat().map((b) => b.callback_data), ['dy:port-sorrel:1', 'dy:port-sorrel:2', 'pl:br:port-sorrel', 'pl:rp:port-sorrel', 'pl:lt:port-sorrel']);
});

test('the whole /plan journey: intake → facts (keep, edit, drop, add) → questions → research → rounds → plan → digest', () => {
  const { ctx, state } = fresh();
  say(ctx, state, '/plan Port Sorrel');
  let r = reqOf(state, 'research', 'intake');
  assert.equal(r.length, 1);
  assert.deepEqual({ trip: r[0].trip, destination: r[0].destination }, { trip: TRIP, destination: 'Port Sorrel' });
  assert.equal(ctx.tgTripGet(TRIP).status, 'intake');
  assert.equal(ctx.settingGet(ctx.TG_SETTINGS.CURRENT_TRIP, ''), TRIP);
  assert.match(texts(state).pop(), /Looking at what I already know about <b>Port Sorrel<\/b>/);
  assert.equal(ctx.flowActive('777').paused, true);

  // /plan again while paused: where we are; another destination is refused.
  say(ctx, state, '/plan');
  assert.match(texts(state).pop(), /Still working on what I already know/);
  say(ctx, state, '/plan Elsewhere');
  assert.match(texts(state).pop(), /middle of \/plan for <b>Port Sorrel<\/b>/);

  // trip_facts arrives → the facts with taps + the confirm step.
  assert.equal(deliver(ctx, state, 'trip_facts', facts()).processed, 1);
  const fm = sends(state).slice(-2);
  assert.match(fm[0].text, /What I found for Port Sorrel<\/b>/);
  assert.match(fm[0].text, /1\.<\/b> Dates: Wed 12 to Fri 14 May <i>\(Wed 12 May → Fri 14 May\)<\/i>/);
  assert.match(fm[1].text, /then <b>Continue<\/b>/);
  tap(ctx, state, 'tf:port-sorrel:2:n', fm[0].reply_markup);
  assert.equal(answers(state).pop(), '❌ Dropped');
  const remark = state.fetch.telegram('editMessageReplyMarkup').pop().json.reply_markup.inline_keyboard;
  assert.deepEqual(remark[1].map((b) => b.text), ['2 ✅', '2 ✏️', '• 2 ❌']);
  tap(ctx, state, 'tf:port-sorrel:1:e');
  assert.match(texts(state).pop(), /Send the corrected line for <b>1<\/b> — now: <i>Wed 12 to Fri 14 May<\/i>/);
  say(ctx, state, 'Actually 2027-05-12 to 2027-05-16');
  assert.match(texts(state).pop(), /Noted for 1/);
  say(ctx, state, 'We travel with a toddler & a stroller');
  assert.match(texts(state).pop(), /Added: <i>We travel with a toddler &amp; a stroller<\/i>/);
  press(ctx, state, '▶️ Continue');
  assert.match(texts(state).pop(), /Where are you staying/, 'lodging was dropped and is missing → asked');
  say(ctx, state, 'Harbour Lane Guesthouse');
  assert.match(texts(state).pop(), /Any flights/);
  press(ctx, state, '⏭ Skip');
  assert.match(texts(state).pop(), /Researching <b>Port Sorrel<\/b> for Wed 12 May → Sun 16 May/);
  r = reqOf(state, 'research', 'new')[0];
  assert.deepEqual({ s: r.start_date, e: r.end_date, l: r.lodging, b: r.booked, d: r.destination },
    { s: '2027-05-12', e: '2027-05-16', l: 'Harbour Lane Guesthouse', b: ['Also: We travel with a toddler & a stroller'], d: 'Port Sorrel' });
  const trip = ctx.tgTripGet(TRIP);
  assert.deepEqual([trip.start, trip.end, trip.lodging.text], ['2027-05-12', '2027-05-16', 'Harbour Lane Guesthouse']);
  assert.equal(ctx.tgChoiceList(TRIP, 'intake', 'fact').find((c) => c.key === '1').value, 'e');

  // Round 1.
  deliver(ctx, state, 'shortlist', shortlist());
  assert.equal(ctx.tgTripGet(TRIP).status, 'choosing');
  assert.match(texts(state).pop(), /So far: 0 ✅ · 0 🔖 · 0 ❌/);
  const round1 = sends(state).filter((m) => /round 1|<b>Food<\/b>/.test(m.text || ''));
  assert.ok(round1.length >= 2);
  say(ctx, state, 'Fixture Tea House, Lantern Museum');
  assert.match(texts(state).pop(), /Noted: Fixture Tea House, Lantern Museum — they go with the next round/);
  tap(ctx, state, 'sl:r1:a1:w', round1[0].reply_markup);
  assert.equal(answers(state).pop(), '✅ Want — Lantern Museum');
  assert.deepEqual(state.fetch.telegram('editMessageReplyMarkup').pop().json.reply_markup.inline_keyboard[0].map((b) => b.text), ['• 1 ✅', '1 🔖', '1 ❌']);
  tap(ctx, state, 'sl:r1:a2:l');
  tap(ctx, state, 'sl:r1:f1:s');
  tap(ctx, state, 'sl:r1:a9:w');
  assert.equal(answers(state).pop(), 'That place is gone from the list.');
  say(ctx, state, '/plan');
  assert.match(texts(state).pop(), /So far: 1 ✅ · 1 🔖 · 1 ❌/);
  press(ctx, state, '💎 More gems');
  r = reqOf(state, 'research', 'more')[0];
  assert.deepEqual({ d: r.decided.slice().sort(), g: r.gems_only, s: r.seeds }, { d: ['lantern-museum', 'saffron-row-market', 'signal-hill-lookout'], g: true, s: ['Fixture Tea House', 'Lantern Museum'] });

  // Round 2 (a new run) with the owner's seed found.
  deliver(ctx, state, 'shortlist', shortlist({ run_id: 'r2', round: 2, more: false, groups: [{ id: 'food', items: [item(1, 'fixture-tea-house', { labels: ['unverified'] })] }] }));
  assert.ok(sends(state).some((m) => /Fixture Tea House<\/a><\/b> · ~1 h · Old harbour · <b>your pick<\/b>/.test(m.text || '')));
  const kb = lastKb(state).reply_markup.inline_keyboard.flat().map((b) => b.text);
  assert.ok(!kb.includes('➕ More options'), 'no more rounds offered when more is false');
  tap(ctx, state, 'sl:r2:f1:w');
  press(ctx, state, '✅ Done choosing');
  r = reqOf(state, 'plan')[0];
  assert.deepEqual({ p: r.picks, l: r.later, s: r.skip, d: r.deliverables, t: r.trip },
    { p: ['lantern-museum', 'fixture-tea-house'], l: ['signal-hill-lookout'], s: ['saffron-row-market'], d: ['plan', 'notes', 'brochure'], t: TRIP });
  assert.match(texts(state).pop(), /Building the days from 2 picks \(1 for Later\)/);

  // The digest closes the flow.
  deliver(ctx, state, 'plan_digest', digest());
  assert.match(texts(state).filter(Boolean).pop(), /🗓 <b>Port Sorrel<\/b> — 2 days/);
  assert.equal(ctx.flowActive('777'), null);
  assert.ok(allData(state).every((d) => Buffer.byteLength(d) <= 64));
});

test('no plan flow: facts and digest go through the renderers; a shortlist offers Continue choosing, which adopts it', () => {
  const { ctx, state } = fresh();
  ctx.tgTripUpsert({ slug: TRIP, title: 'Port Sorrel', destination: 'Port Sorrel' });
  deliver(ctx, state, 'trip_facts', facts());
  assert.match(texts(state).pop(), /Send <code>\/plan Port Sorrel<\/code> to confirm these/);
  tap(ctx, state, 'tf:port-sorrel:1:y');
  assert.equal(answers(state).pop(), 'Send /plan Port Sorrel to confirm these.');
  assert.equal(ctx.tgChoiceList(TRIP, 'intake', 'fact').length, 0, 'no tap is stored outside the flow');

  deliver(ctx, state, 'shortlist', shortlist());
  const last = lastKb(state).reply_markup.inline_keyboard.flat();
  assert.equal(last[last.length - 1].callback_data, 'pl:sc:port-sorrel:r1:1');
  tap(ctx, state, 'sl:r1:a2:w');
  assert.equal(answers(state).pop(), '✅ Want — Signal Hill Lookout', 'taps work without a flow');
  tap(ctx, state, 'pl:sc:port-sorrel:r1:1');
  assert.equal(ctx.flowActive('777').flow, 'plan');
  assert.match(texts(state).pop(), /So far: 1 ✅ · 0 🔖 · 0 ❌/);
  press(ctx, state, '➕ More options');
  const r = reqOf(state, 'research', 'more')[0];
  assert.equal(r.destination, 'Port Sorrel');
  assert.equal(r.gems_only, undefined);
  deliver(ctx, state, 'plan_digest', digest());
  assert.equal(ctx.flowActive('777'), null, 'a digest for the trip lands in the flow and ends it');
  assert.ok(sends(state).some((m) => /🗓 <b>Port Sorrel<\/b> — 2 days/.test(m.text || '')));
});

test('guards: /plan usage, another flow, /seed without a plan, Done with no picks, three More rounds at most', () => {
  const { ctx, state } = fresh();
  say(ctx, state, '/plan');
  assert.match(texts(state).pop(), /Send <code>\/plan &lt;destination&gt;<\/code>/);
  say(ctx, state, '/seed Tea House');
  assert.match(texts(state).pop(), /Seeds go with a \/plan in progress/);
  say(ctx, state, '/interview');
  say(ctx, state, '/plan Port Sorrel');
  assert.match(texts(state).pop(), /middle of \/interview/);
  say(ctx, state, '/cancel');

  say(ctx, state, '/plan Port Sorrel');
  say(ctx, state, '/seed Tea House, Kite Beach');
  assert.match(texts(state).pop(), /Noted: Tea House, Kite Beach/);
  say(ctx, state, '/seed tea house');
  assert.match(texts(state).pop(), /Nothing new to add/);
  deliver(ctx, state, 'trip_facts', facts({ missing: [] }));
  press(ctx, state, '▶️ Continue');
  assert.deepEqual(reqOf(state, 'research', 'new')[0].seeds, ['Tea House', 'Kite Beach'], 'seeds given early ride on research new');
  for (let i = 1; i <= 4; i++) {
    deliver(ctx, state, 'shortlist', shortlist({ run_id: 'r' + i, round: i, groups: [{ id: 'activities', items: [item(1, 'spot-' + i)] }] }));
    if (i === 1) {
      press(ctx, state, '✅ Done choosing');
      assert.match(texts(state).pop(), /Tap ✅ on at least one place first/);
    }
    const labels = lastKb(state).reply_markup.inline_keyboard.flat().map((b) => b.text);
    if (i <= 3) press(ctx, state, '➕ More options');
    else assert.ok(!labels.includes('➕ More options'), 'the fourth round offers no More');
  }
  assert.equal(reqOf(state, 'research', 'more').length, 3);
  say(ctx, state, 'Rope Walk');
  press(ctx, state, '🔎 Look up my picks');
  const s = reqOf(state, 'research', 'more');
  assert.equal(s.length, 4);
  assert.ok(s.some((x) => JSON.stringify(x.seeds) === '["Rope Walk"]'));
  assert.equal(ctx.flowActive('777').state.more_rounds, 3, 'a seeds lookup does not count as a More round');
});

// Developed by: LightAISolutions
