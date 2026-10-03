'use strict';
// Tour Guide pack — gas/17_journey.js and gas/36_journey_app.js (TG-PHASE-11 WP-11f): outlines compared, day versions, the
// plan built from the choices, /versions replacing a planned day, the direct path, and the app's Compare operations.
// Trips, places and wording are invented ("Port Sorrel", reserved example domains).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');

const NOW = '2027-05-01T12:00:00Z';
const TRIP = 'port-sorrel';
const SHELL = 'https://app.example.invalid/helper-app.html';
const D1 = '2027-05-12', D2 = '2027-05-13', D3 = '2027-05-14';
const J = (v) => JSON.parse(JSON.stringify(v));
const maps = (id) => 'https://www.google.com/maps/search/?api=1&query=Fixture&query_place_id=' + id;

function fresh(o = {}) {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: NOW });
  H.bootstrap(ctx, state);
  ['RESEARCH', 'PLAN'].forEach((n) => H.configureRoutine(ctx, state, n));
  if (o.shell) state.props[ctx.PROP.APP_SHELL_URL] = SHELL;
  if (o.journey !== null) ctx.settingSet('tg_journey', o.journey || 'on', 'test');   // the owner's /journey switch (off when unset)
  const trip = { slug: o.slug || TRIP, title: 'Port Sorrel', destination: 'Port Sorrel' };
  if (o.days !== 0) { trip.start = D1; trip.end = o.days === 2 ? D2 : o.days === 1 ? D1 : D3; }
  ctx.tgTripUpsert(trip);
  return { ctx, state };
}
const post = (ctx, state, upd) => ctx.doPost(H.postEvent('tg', { k: state.props[ctx.PROP.WEBHOOK_SECRET] }, upd));
const say = (ctx, state, text) => post(ctx, state, H.tgUpdate({ text }));
const sends = (state) => state.fetch.telegram('sendMessage').map((r) => r.json);
const texts = (state) => sends(state).map((m) => m.text);
const answers = (state) => state.fetch.telegram('answerCallbackQuery').map((r) => r.json.text);
const buttons = (m) => (m && m.reply_markup ? m.reply_markup.inline_keyboard.flat() : []);
const lastKb = (state) => sends(state).filter((j) => j.reply_markup).pop();
const allData = (state) => sends(state).flatMap(buttons).map((b) => b.callback_data).filter(Boolean);
const requests = (state) => (state.drive.listFiles('TourGuide/mailbox/to-brain') || []).filter((n) => /^req_/.test(n))
  .map((n) => JSON.parse(state.drive.readFile('TourGuide/mailbox/to-brain', n)));
const reqOf = (state, kind) => requests(state).filter((r) => r.payload.kind === kind).map((r) => ({ id: r.id, ...r.payload }));
const app = (ctx, state, op, args, o) => H.appPost(ctx, state, 'app', args === undefined ? { op } : { op, args }, o);
function deliver(ctx, state, type, payload, over = {}) {
  H.putEnvelope(state, { ...H.envelope(type, payload), ...over });
  return J(ctx.pollFromBrain());
}
function tap(ctx, state, data, markup) {
  const upd = H.tgUpdate({ callback: data, messageId: 91 });
  if (markup) upd.callback_query.message.reply_markup = markup;
  post(ctx, state, upd);
}
/** Tap the button whose label ends with `label` on the newest message carrying one. */
function press(ctx, state, label) {
  const m = sends(state).filter((x) => buttons(x).some((b) => b.text.endsWith(label))).pop();
  assert.ok(m, 'no button ' + label);
  tap(ctx, state, buttons(m).find((b) => b.text.endsWith(label)).callback_data, m.reply_markup);
}

/* ---------------- fixtures ---------------- */
const item = (n, slug) => ({ n, slug, name: slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '),
  why_you: 'Quiet in the morning.', fit: 0.8, est_minutes: 60, area: 'Old harbour', maps_url: maps('F' + n), labels: ['verified'] });
const shortlist = (trip = TRIP) => ({ v: 1, kind: 'shortlist', trip, run_id: 'r1', round: 1, more: false, decided: [],
  groups: [{ id: 'activities', items: [item(1, 'lantern-museum'), item(2, 'signal-hill-lookout')] }, { id: 'food', items: [item(1, 'saffron-row-market')] }] });
const oday = (date, kind = 'full', area = 'Old harbour') => ({ date, area, kind, anchors: [{ slug: 'lantern-museum', name: 'Lantern Museum' }] });
const option = (key, over = {}) => ({ key, title: 'Harbour first ' + key, gains: 'A calm last day.', gives_up: 'No day trip.',
  days: [oday(D1), oday(D2, key === 'B' ? 'travel' : 'light', key === 'B' ? 'Cliff villages' : 'Old harbour'), oday(D3, 'free', '')], ...over });
const outline = (over = {}) => ({ v: 1, kind: 'outline', trip: TRIP, build_id: 'ol-1', options: [option('A'), option('B')], ...over });
const version = (key, over = {}) => ({ key, title: 'Museums ' + key, summary: 'An indoor day.', stops: [{ slug: 'lantern-museum', name: 'Lantern Museum', time: '10:00' }],
  walk_minutes: 35, transit_minutes: 20, spare_minutes: 90, bookings: ['Lantern Museum 10:00 slot'], leaves_out: [{ slug: 'signal-hill-lookout', name: 'Signal Hill Lookout' }],
  warnings: ['Closes early on Wednesdays.'], ...over });
const dayv = (date, over = {}) => ({ v: 1, kind: 'day_versions', trip: TRIP, build_id: 'dv-1', date, versions: [version('A'), version('B')], ...over });
const digest = (days = [D1, D2, D3]) => ({ v: 1, kind: 'plan_digest', trip: TRIP, build_id: 'build-ps-1', verified_on: '2027-04-30',
  days: days.map((date) => ({ date, theme: 'Harbour', stops: [{ n: 1, slug: 'lantern-museum', name: 'Lantern Museum', arrive: '10:00', depart: '11:00',
    minutes: 60, maps_url: maps('A'), note_line: 'Start upstairs.' }], legs: [], warnings: [] })),
  later: [], drive: { plan: 'fixtureDrivePlanFile01', brochure_html: null, brochure_pdf: null } });
/** A shortlist with no flow → Continue choosing → one ✅ and one 🔖: the plan flow at choose. */
function toChoose(ctx, state, trip = TRIP) {
  deliver(ctx, state, 'shortlist', shortlist(trip));
  tap(ctx, state, ctx.cbEncode('pl', 'sc', ctx.tgCmdTripKey(trip), 'r1', '0'));
  tap(ctx, state, 'sl:r1:a1:w');
  tap(ctx, state, 'sl:r1:f1:l');
  assert.equal(ctx.flowActive('777').state.stage, 'choose');
}
const stage = (ctx) => ctx.flowActive('777') && ctx.flowActive('777').state.stage;

/* ---------------- validators ---------------- */
test('validators: both envelopes accept the bounds and refuse what is outside them, unknown keys included', () => {
  const { ctx } = fresh();
  assert.deepEqual(J(ctx.tgEnvValidateOutline(outline())), []);
  assert.deepEqual(J(ctx.tgEnvValidateDayVersions(dayv(D1, { chosen: 'B' }))), []);
  const bad = (p) => J(ctx.tgEnvValidateOutline(p)).join(' | ');
  assert.match(bad(outline({ extra: 1 })), /extra/);
  assert.deepEqual(J(ctx.tgEnvValidateOutline(outline({ options: [option('A')] }))), [], 'one option: a trip with only one shape');
  assert.match(bad(outline({ options: [] })), /options/);
  assert.match(bad(outline({ options: [option('A'), option('B'), option('C'), option('A')] })), /options/);
  assert.match(bad(outline({ options: [option('A'), option('D')] })), /key/);
  assert.match(bad(outline({ options: [option('A'), option('A')] })), /option key/);
  assert.match(bad(outline({ options: [option('A'), option('B', { title: 'x'.repeat(81) })] })), /title/);
  assert.match(bad(outline({ options: [option('A'), option('B', { gains: 'x'.repeat(201) })] })), /gains/);
  assert.match(bad(outline({ options: [option('A'), option('B', { days: [oday(D1), oday(D3), oday(D2)] })] })), /in order|same dates/);
  assert.match(bad(outline({ options: [option('A'), option('B', { days: [oday(D1), oday(D2)] })] })), /same dates/);
  assert.match(bad(outline({ options: [option('A'), option('B', { days: [oday(D1, 'party'), oday(D2), oday(D3)] })] })), /kind/);
  assert.match(bad(outline({ options: [option('A'), option('B', { days: [{ ...oday(D1), anchors: [1, 2, 3, 4].map((i) => ({ slug: 'p-' + i, name: 'P' })) }, oday(D2), oday(D3)] })] })), /anchors/);
  assert.match(bad(outline({ notes: 'x'.repeat(301) })), /notes/);
  const vbad = (p) => J(ctx.tgEnvValidateDayVersions(p)).join(' | ');
  assert.match(vbad(dayv(D1, { chosen: 'C' })), /chosen/);
  assert.match(vbad(dayv(D1, { date: '2027-02-30' })), /date/);
  assert.deepEqual(J(ctx.tgEnvValidateDayVersions(dayv(D1, { versions: [version('A', { stops: [] })] }))), [], 'one version: a day with one way to go');
  assert.match(vbad(dayv(D1, { versions: [] })), /versions/);
  assert.match(vbad(dayv(D1, { versions: ['A', 'B', 'C', 'A'].map((k) => version(k)) })), /versions/);
  assert.match(vbad(dayv(D1, { versions: [version('A'), version('B', { stops: Array.from({ length: 13 }, (_, i) => ({ slug: 's-' + i, name: 'S' })) })] })), /stops/);
  assert.match(vbad(dayv(D1, { versions: [version('A'), version('B', { walk_minutes: 1441 })] })), /walk_minutes/);
  assert.match(vbad(dayv(D1, { versions: [version('A'), version('B', { bookings: ['a', 'b', 'c', 'd', 'e', 'f'] })] })), /bookings/);
  assert.match(vbad(dayv(D1, { versions: [version('A'), version('B', { warnings: ['x'.repeat(161)] })] })), /warnings/);
  assert.match(vbad(dayv(D1, { versions: [version('A'), version('B', { stops: [{ slug: 'a', name: 'A', time: '9am' }] })] })), /time/);
  assert.match(vbad(dayv(D1, { versions: [version('A'), version('B', { surprise: true })] })), /surprise/);
});

test('envelopes: a valid outline and day_versions are stored and shown; a bad one is rejected and nothing is stored', () => {
  const { ctx, state } = fresh();
  assert.equal(deliver(ctx, state, 'outline', outline({ options: [] })).rejected, 1);
  assert.equal(deliver(ctx, state, 'day_versions', dayv(D1, { chosen: 'C' })).rejected, 1);
  assert.equal(ctx.tgJyOutlines(TRIP).length, 0);
  assert.equal(deliver(ctx, state, 'outline', outline()).processed, 1);
  assert.match(texts(state).pop(), /2 ways to shape the trip/);
  assert.equal(deliver(ctx, state, 'day_versions', dayv(D1)).processed, 1);
  assert.match(texts(state).pop(), /Day 1 of 3 · .* — 2 versions/);
  const o = ctx.tgJyOutlines(TRIP)[0];
  assert.deepEqual([o.build_id, J(o.keys), J(o.dates)], ['ol-1', ['A', 'B'], [D1, D2, D3]]);
});

/* ---------------- the Telegram journey ---------------- */
test('three days or more: Done → outlines → ✅ / mix → day versions → Build my plan → one plan request with the choices', () => {
  const { ctx, state } = fresh();
  toChoose(ctx, state);
  const kb = buttons(lastKb(state)).map((b) => b.text);
  assert.ok(kb.includes('✅ Done choosing') && kb.includes('⏩ Plan straight away'), kb.join(' | '));
  press(ctx, state, '✅ Done choosing');
  assert.equal(stage(ctx), 'outline');
  const oq = reqOf(state, 'outline');
  assert.equal(oq.length, 1);
  assert.deepEqual({ t: oq[0].trip, d: oq[0].dates, p: oq[0].picks, l: oq[0].later, s: oq[0].skip }, { t: TRIP, d: [D1, D2, D3], p: ['lantern-museum'], l: ['saffron-row-market'], s: [] });
  assert.equal(reqOf(state, 'plan').length, 0, 'no plan request yet');
  assert.match(texts(state).pop(), /Sketching two or three outlines/);

  deliver(ctx, state, 'outline', outline(), { in_reply_to: oq[0].id });
  const om = sends(state).pop();
  assert.match(om.text, /<b>A · Harbour first A<\/b>\n➕ A calm last day\.\n➖ No day trip\./);
  assert.match(om.text, /<b>2<\/b> .* · A ◐ Old harbour · B 🧳 Cliff villages/);
  assert.match(om.text, /<b>3<\/b> .* · all ○ free day/);
  const tag = ctx.tgCmdTag('ol-1');
  assert.deepEqual(buttons(om).map((b) => b.callback_data), ['ol:' + TRIP + ':' + tag + ':A', 'ol:' + TRIP + ':' + tag + ':B', 'ol:' + TRIP + ':d']);
  tap(ctx, state, 'ol:' + TRIP + ':' + tag + ':A', om.reply_markup);
  assert.equal(answers(state).pop(), '✅ Outline A');
  assert.equal(stage(ctx), 'versions');
  let vq = reqOf(state, 'day_versions');
  assert.deepEqual(vq.map((r) => r.outline), [{ build_id: 'ol-1', base: 'A' }]);
  assert.deepEqual(vq[0].dates, [D1, D2, D3]);
  assert.match(texts(state).pop(), /Outline <b>A<\/b>[\s\S]*Drafting two or three versions/);

  say(ctx, state, '/outline A 2B');
  vq = reqOf(state, 'day_versions');
  assert.equal(vq.length, 2);
  assert.deepEqual(vq[1].outline, { build_id: 'ol-1', base: 'A', mix: { [D2]: 'B' } });
  assert.deepEqual(J(ctx.flowActive('777').state.dropped), [vq[0].id], 'the first versions request counts as dropped');
  assert.match(texts(state).pop(), /Outline <b>A<\/b> · day 2 from B/);

  [D1, D2, D3].forEach((d, i) => deliver(ctx, state, 'day_versions', dayv(d), { in_reply_to: vq[1].id }));
  const out = texts(state).slice(-4);
  assert.match(out[0], /Day 1 of 3/);
  assert.match(out[2], /Day 3 of 3/);
  assert.match(out[3], /every day has its versions/);
  const vm = sends(state).slice(-2)[0];
  assert.match(vm.text, /10:00 Lantern Museum[\s\S]*🚶 35 min · 🚆 20 min · spare 1 h 30 min[\s\S]*🎟 Lantern Museum 10:00 slot[\s\S]*Leaves out: Signal Hill Lookout[\s\S]*⚠️ Closes early/);
  const dvtag = ctx.tgCmdTag('dv-1');
  tap(ctx, state, 'dv:' + TRIP + ':' + dvtag + ':0513:B');
  assert.equal(answers(state).pop(), '✅ B — Museums B');
  press(ctx, state, '🧱 Build my plan');
  assert.equal(answers(state).pop(), '🧱 Building your plan');
  assert.equal(stage(ctx), 'planning');
  const pq = reqOf(state, 'plan');
  assert.equal(pq.length, 1);
  assert.deepEqual({ p: pq[0].picks, l: pq[0].later, d: pq[0].deliverables, o: pq[0].outline, v: pq[0].versions },
    { p: ['lantern-museum'], l: ['saffron-row-market'], d: ['plan', 'notes', 'brochure'], o: { build_id: 'ol-1', base: 'A', mix: { [D2]: 'B' } },
      v: [{ date: D1, build_id: 'dv-1', key: 'A' }, { date: D2, build_id: 'dv-1', key: 'B' }, { date: D3, build_id: 'dv-1', key: 'A' }] });
  assert.match(texts(state).pop(), /Building the days from 1 pick and the version you chose for 3 days… One brochure follows/);
  deliver(ctx, state, 'plan_digest', digest(), { in_reply_to: pq[0].id });
  assert.equal(ctx.flowActive('777'), null, 'the digest ends the flow');
  assert.ok(allData(state).every((d) => Buffer.byteLength(d) <= 64));
});

test('one or two days skip the outlines: Done asks for the day versions straight away', () => {
  const { ctx, state } = fresh({ days: 2 });
  toChoose(ctx, state);
  assert.match(lastKb(state).text, /versions of each day/);
  press(ctx, state, '✅ Done choosing');
  assert.equal(stage(ctx), 'versions');
  assert.equal(reqOf(state, 'outline').length, 0);
  const vq = reqOf(state, 'day_versions');
  assert.deepEqual([vq.length, vq[0].dates, vq[0].outline], [1, [D1, D2], undefined]);
  deliver(ctx, state, 'day_versions', dayv(D1), { in_reply_to: vq[0].id });
  assert.doesNotMatch(texts(state).pop(), /every day has its versions/, 'one of two days: no build offer yet');
  deliver(ctx, state, 'day_versions', dayv(D2), { in_reply_to: vq[0].id });
  assert.match(texts(state).pop(), /every day has its versions/);
  press(ctx, state, '🧱 Build my plan');
  const pq = reqOf(state, 'plan');
  assert.deepEqual([pq.length, pq[0].outline, pq[0].versions.length], [1, undefined, 2]);
});

test('a day with one way to go comes as one version: no buttons, and when it is the last day to arrive the build offer follows', () => {
  const { ctx, state } = fresh({ days: 2 });
  toChoose(ctx, state);
  press(ctx, state, '✅ Done choosing');
  const vq = reqOf(state, 'day_versions');
  deliver(ctx, state, 'day_versions', dayv(D1), { in_reply_to: vq[0].id });
  assert.doesNotMatch(texts(state).pop(), /every day has its versions/);
  const free = version('A', { title: 'A free day', summary: '0 stops, 0 min walking, 8 h spare', stops: [], walk_minutes: 0, transit_minutes: 0,
    spare_minutes: 480, bookings: [], leaves_out: [], warnings: [] });
  assert.equal(deliver(ctx, state, 'day_versions', dayv(D2, { versions: [free] }), { in_reply_to: vq[0].id }).processed, 1);
  const [one, offer] = sends(state).slice(-2);
  assert.match(one.text, /^🔀 <b>Day 2 of 2 · .*<\/b> — one way to go, nothing to choose\n\n<b>A · A free day<\/b> — 0 stops[\s\S]*No stops: a free day\./);
  assert.doesNotMatch(one.text, /✅/, 'nothing was chosen: no tick');
  assert.deepEqual(buttons(one), [], 'nothing to choose: no buttons');
  assert.match(offer.text, /every day has its versions/);
  say(ctx, state, '/versions');
  const list = texts(state).pop();
  assert.match(list, /<b>1<\/b> .* · 2 versions · A — Museums A/);
  assert.match(list, /<b>2<\/b> .* · one way to go — A free day/);
  press(ctx, state, '🧱 Build my plan');
  assert.equal(stage(ctx), 'planning');
  assert.deepEqual(J(reqOf(state, 'plan')[0].versions), [{ date: D1, build_id: 'dv-1', key: 'A' }, { date: D2, build_id: 'dv-1', key: 'A' }]);
});

test('one outline: taken as it is while the flow waits for outlines, the day versions asked at once, then built as usual', () => {
  const { ctx, state } = fresh({ shell: true });
  toChoose(ctx, state);
  press(ctx, state, '✅ Done choosing');
  const oq = reqOf(state, 'outline')[0];
  const before = sends(state).length;
  assert.equal(deliver(ctx, state, 'outline', outline({ options: [option('A')] }), { in_reply_to: oq.id }).processed, 1);
  assert.equal(stage(ctx), 'versions');
  assert.deepEqual(J(ctx.tgJyOutlines(TRIP)[0].choice), { base: 'A' });
  const vq = reqOf(state, 'day_versions');
  assert.deepEqual(vq.map((r) => [r.outline, r.dates, r.picks]), [[{ build_id: 'ol-1', base: 'A' }, [D1, D2, D3], ['lantern-museum']]]);
  assert.equal(ctx.flowActive('777').state.jy.vreq, vq[0].id);
  assert.equal(sends(state).length, before + 2, 'the outline, then the wait for the versions');
  const [om, wait] = sends(state).slice(before);
  assert.match(om.text, /^🧭 <b>.+ — one way to shape the trip<\/b> · 3 days\n\n<b>A · Harbour first A<\/b>/);
  assert.match(om.text, /<b>2<\/b> .* · ◐ Old harbour\n<b>3<\/b> .* · ○ free day\n/, 'one column: no key, no "all"');
  assert.doesNotMatch(om.text, /\/outline|undefined/);
  assert.match(om.text, /✅ Taken as it is: only one way to shape these days came out\.$/);
  assert.deepEqual(buttons(om).map((b) => b.text), ['📱 Open in the app'], 'nothing to choose; the wait below carries ⏩');
  assert.match(wait.text, /Drafting two or three versions of each day/);
  assert.deepEqual(buttons(wait).map((b) => b.callback_data), ['ol:' + TRIP + ':d']);
  const j = app(ctx, state, 'journey.get', { slug: TRIP });
  assert.deepEqual([j.stage, j.outline.keys, j.outline.choice], ['versions', ['A'], { base: 'A', mix: {} }]);

  [D1, D2, D3].forEach((d) => deliver(ctx, state, 'day_versions', dayv(d), { in_reply_to: vq[0].id }));
  assert.match(texts(state).pop(), /every day has its versions/);
  press(ctx, state, '🧱 Build my plan');
  assert.equal(stage(ctx), 'planning');
  const pq = reqOf(state, 'plan');
  assert.deepEqual([pq.length, pq[0].outline, pq[0].versions.length], [1, { build_id: 'ol-1', base: 'A' }, 3]);
  say(ctx, state, '/outline');
  assert.match(texts(state).pop(), /one way to shape the trip[\s\S]*✅ Taken as it is/);
  assert.ok(allData(state).every((d) => Buffer.byteLength(d) <= 64));
});

test('one outline outside the flow: ✅ A takes it (no mix hint), /outline explains itself, and a stray day from another outline is refused', () => {
  const { ctx, state } = fresh({ shell: true });
  deliver(ctx, state, 'shortlist', shortlist());
  tap(ctx, state, 'sl:r1:a1:w');
  assert.equal(ctx.flowActive('777'), null);
  assert.equal(deliver(ctx, state, 'outline', outline({ options: [option('A')] })).processed, 1);
  const m = sends(state).pop();
  assert.match(m.text, /one way to shape the trip[\s\S]*Only one way to shape these days came out: ✅ takes it, then the versions of each day follow\.$/);
  assert.doesNotMatch(m.text, /undefined|\/outline A/);
  assert.deepEqual(buttons(m).map((b) => b.text), ['✅ A', '📱 Open in the app', '⏩ Plan straight away']);
  say(ctx, state, '/outline A 2B');
  assert.equal(texts(state).pop(), 'That mix does not fit the outline.');
  say(ctx, state, '/outline please');
  assert.equal(texts(state).pop(), 'Send <code>/outline A</code> to take the outline as it is.');
  assert.equal(reqOf(state, 'day_versions').length, 0);
  press(ctx, state, '✅ A');
  assert.equal(answers(state).pop(), '✅ Outline A');
  const vq = reqOf(state, 'day_versions');
  assert.deepEqual(vq.map((r) => [r.outline, r.picks]), [[{ build_id: 'ol-1', base: 'A' }, ['lantern-museum']]]);
  assert.match(texts(state).pop(), /Outline <b>A<\/b>\.[\s\S]*Drafting two or three versions/);
  say(ctx, state, '/outline');
  const after = sends(state).pop();
  assert.match(after.text, /✅ Taken as it is: only one way to shape these days came out\.$/);
  assert.deepEqual(buttons(after).map((b) => b.text), ['📱 Open in the app']);
});

test('the direct path: ⏩ in choose, ⏩ while outlines are drafted, tg_journey off and an undated trip all send the plan request as before', () => {
  const asBefore = (r) => assert.deepEqual(Object.keys(r).filter((k) => ['outline', 'versions', 'dates'].includes(k)), [], 'no journey fields');
  // ⏩ Plan straight away in choose.
  let { ctx, state } = fresh();
  toChoose(ctx, state);
  press(ctx, state, '⏩ Plan straight away');
  assert.equal(stage(ctx), 'planning');
  let pq = reqOf(state, 'plan');
  assert.deepEqual({ p: pq[0].picks, l: pq[0].later, s: pq[0].skip, d: pq[0].deliverables }, { p: ['lantern-museum'], l: ['saffron-row-market'], s: [], d: ['plan', 'notes', 'brochure'] });
  asBefore(pq[0]);
  assert.equal(reqOf(state, 'outline').length, 0);

  // ⏩ from the wait message while the outlines are drafted; the outlines arriving later do not reopen the choice.
  ({ ctx, state } = fresh());
  toChoose(ctx, state);
  press(ctx, state, '✅ Done choosing');
  const oq = reqOf(state, 'outline')[0];
  press(ctx, state, '⏩ Plan straight away instead');
  assert.equal(answers(state).pop(), '⏩ Planning straight away');
  assert.equal(stage(ctx), 'planning');
  pq = reqOf(state, 'plan');
  assert.equal(pq.length, 1);
  asBefore(pq[0]);
  assert.ok(J(ctx.flowActive('777').state.dropped).includes(oq.id));
  deliver(ctx, state, 'outline', outline(), { in_reply_to: oq.id });
  assert.match(texts(state).pop(), /Outlines of the trip came in — \/outline shows them\.\n⏳ Still working on the plan/);
  assert.equal(stage(ctx), 'planning');
  tap(ctx, state, 'ol:' + TRIP + ':' + ctx.tgCmdTag('ol-1') + ':A');
  assert.equal(answers(state).pop(), 'The plan is being built — /repick changes the picks.');

  // Settings tg_journey = off.
  ({ ctx, state } = fresh());
  ctx.settingSet('tg_journey', 'off', 'test');
  toChoose(ctx, state);
  assert.deepEqual(buttons(lastKb(state)).map((b) => b.text), ['✅ Done choosing']);
  press(ctx, state, '✅ Done choosing');
  assert.equal(stage(ctx), 'planning');
  asBefore(reqOf(state, 'plan')[0]);

  // An undated trip.
  ({ ctx, state } = fresh({ days: 0 }));
  toChoose(ctx, state);
  assert.deepEqual(buttons(lastKb(state)).map((b) => b.text), ['✅ Done choosing']);
  press(ctx, state, '✅ Done choosing');
  asBefore(reqOf(state, 'plan')[0]);
  assert.equal(ctx.tgJyMode(TRIP), '');
});

test('the journey is off until /journey on: Done choosing plans as before, /outline, /versions, the buttons and the app say so and send nothing', () => {
  const offLine = 'Outlines and day versions are off — /journey on turns them on.';
  const { ctx, state } = fresh({ journey: null, shell: true });
  assert.equal(ctx.tgJyOn(), false, 'unset is off');
  ['off', 'yes', 'ON '].forEach((v) => { ctx.settingSet('tg_journey', v, 'test'); assert.equal(ctx.tgJyOn(), v === 'ON ', JSON.stringify(v)); });
  ctx.settingSet('tg_journey', '', 'test');

  // /journey with no argument: one line and how to switch.
  say(ctx, state, '/journey');
  assert.equal(texts(state).pop(), 'Outlines and day versions: off (plans go straight out)\n/journey on · /journey off');
  say(ctx, state, '/journey maybe');
  assert.equal(texts(state).pop(), 'Usage: /journey on · /journey off · /journey (show the mode)');
  assert.equal(ctx.settingGet('tg_journey', ''), '');

  // A stranger cannot switch it.
  post(ctx, state, H.tgUpdate({ text: '/journey on', fromId: 999 }));
  assert.equal(ctx.tgJyOn(), false);

  // Stored outlines and versions (from an earlier time on) cannot be acted on while off.
  deliver(ctx, state, 'outline', outline());
  deliver(ctx, state, 'day_versions', dayv(D1));
  const before = requests(state).length;
  say(ctx, state, '/outline');
  assert.equal(texts(state).pop(), offLine);
  say(ctx, state, '/outline A');
  assert.equal(texts(state).pop(), offLine);
  say(ctx, state, '/versions 1');
  assert.equal(texts(state).pop(), offLine);
  tap(ctx, state, 'ol:' + TRIP + ':' + ctx.tgCmdTag('ol-1') + ':A');
  assert.equal(answers(state).pop(), offLine);
  tap(ctx, state, 'dv:' + TRIP + ':' + ctx.tgCmdTag('dv-1') + ':' + D1.slice(5, 7) + D1.slice(8) + ':A');
  assert.equal(answers(state).pop(), offLine);
  tap(ctx, state, 'dv:' + TRIP + ':b');
  assert.equal(answers(state).pop(), offLine);
  const j = app(ctx, state, 'journey.get', { slug: TRIP });
  assert.deepEqual({ ok: j.ok, on: j.on, text: j.text, mode: j.mode, o: j.outline, d: j.days },
    { ok: true, on: false, text: offLine, mode: '', o: null, d: [] });
  for (const [op, args] of [['outline.choose', { slug: TRIP, build_id: 'ol-1', base: 'A' }], ['versions.get', { slug: TRIP, date: D1 }],
    ['versions.choose', { slug: TRIP, build_id: 'dv-1', date: D1, key: 'A' }], ['versions.done', { slug: TRIP }]]) {
    const r = app(ctx, state, op, args);
    assert.deepEqual([r.status, r.reason, r.text], [409, 'off', offLine], op);
  }
  assert.equal(requests(state).length, before, 'no request while off');
  assert.equal(ctx.tgJyVersionsGet(TRIP, 'dv-1', D1).key, 'A', 'no choice stored');

  // ✅ Done choosing on a dated trip sends the plan request exactly as before (no ⏩ button, no outline request).
  toChoose(ctx, state);
  assert.deepEqual(buttons(lastKb(state)).map((b) => b.text), ['✅ Done choosing']);
  press(ctx, state, '✅ Done choosing');
  assert.equal(stage(ctx), 'planning');
  assert.equal(reqOf(state, 'outline').length, 0);
  assert.deepEqual(Object.keys(reqOf(state, 'plan')[0]).filter((k) => ['outline', 'versions'].includes(k)), []);

  // /journey on: stored, audited, and the reply names the private routine's Phase 11 update; /journey off back.
  say(ctx, state, '/journey on');
  assert.equal(ctx.settingGet('tg_journey', ''), 'on');
  assert.match(texts(state).pop(), /^🧭 Outlines and day versions on: .*needs the private routine's Phase 11 update.*\/journey off to switch back\.$/);
  say(ctx, state, '/journey');
  assert.equal(texts(state).pop(), 'Outlines and day versions: on\n/journey on · /journey off');
  assert.equal(app(ctx, state, 'journey.get', { slug: TRIP }).on, true);
  say(ctx, state, '/journey off');
  assert.equal(ctx.settingGet('tg_journey', ''), 'off');
  assert.match(texts(state).pop(), /^⏩ Outlines and day versions off: ✅ Done choosing plans straight away, as before\./);
  assert.deepEqual(J(ctx.storeAll('AuditLog')).filter((a) => a.event === 'tg_journey').map((a) => a.ref), ['on', 'off'], 'each switch audited');
});

test('/versions on a planned day lists and replaces it: a replan for that date carrying the alternative', () => {
  const { ctx, state } = fresh();
  deliver(ctx, state, 'plan_digest', digest());
  say(ctx, state, '/versions');
  assert.match(texts(state).pop(), /No day versions/);
  deliver(ctx, state, 'day_versions', dayv(D2, { chosen: 'A' }));
  const shown = sends(state).pop();
  assert.match(shown.text, /Day 2 of 3 .* — 2 versions · this day is planned with A/, 'no flow, a planned day: replace mode');
  say(ctx, state, '/versions');
  assert.match(texts(state).pop(), /<b>2<\/b> .* · 2 versions · A — Museums A · planned/);
  say(ctx, state, '/versions day 9');
  assert.match(texts(state).pop(), /Send <code>\/versions<\/code> with a day number/);
  say(ctx, state, '/versions 2');
  const m = sends(state).pop();
  const tag = ctx.tgCmdTag('dv-1');
  assert.deepEqual(buttons(m).map((b) => b.callback_data), ['dv:' + TRIP + ':' + tag + ':0513:rA', 'dv:' + TRIP + ':' + tag + ':0513:rB']);
  assert.deepEqual(buttons(m).map((b) => b.text), ['🔁 Use A · Museums A', '🔁 Use B · Museums B']);
  tap(ctx, state, 'dv:' + TRIP + ':' + tag + ':0513:rB');
  assert.equal(answers(state).pop(), '🔁 Replacing with B — Museums B');
  const rq = reqOf(state, 'replan');
  assert.equal(rq.length, 1);
  assert.deepEqual({ d: rq[0].dates, a: rq[0].alternative, t: rq[0].trip }, { d: [D2], a: { date: D2, build_id: 'dv-1', key: 'B' }, t: TRIP });
  assert.match(rq[0].reason, /owner chose version B \(Museums B\) of this day/);
  assert.match(texts(state).pop(), /Replacing .* with version B — <b>Museums B<\/b>/);
  assert.equal(ctx.tgJyVersionsGet(TRIP, 'dv-1', D2).key, 'B');
  // A day without a plan: no replacement.
  deliver(ctx, state, 'day_versions', dayv(D1, { build_id: 'dv-2' }));
  assert.equal(ctx.tgJyDoReplace(TRIP, 'dv-2', '2027-05-20', 'A').why, 'no_versions');
});

test('buttons stay within 64 bytes: a 36-character slug as is, a 64-character slug as a short key', () => {
  [36, 64].forEach((len) => {
    const slug = ('fixture-trip-' + 'x'.repeat(80)).slice(0, len);
    const { ctx, state } = fresh({ slug, shell: true });
    const st = ctx.tgJyStoreOutline({ ...outline({ trip: slug, build_id: 'b'.repeat(120), options: [option('A'), option('B'), option('C')] }) });
    const vr = ctx.tgJyStoreVersions(dayv(D3, { trip: slug, build_id: 'v'.repeat(120), versions: [version('A'), version('B'), version('C')] }));
    const msgs = [].concat(J(ctx.tgJyOutlineMessages(st.rec)), J(ctx.tgJyVersionsMessages(vr.rec)), J(ctx.tgJyVersionsMessages(vr.rec, { replace: true })),
      J(ctx.tgJyBuildMessages(slug)), J(ctx.tgJyWaitMessages(slug, 'outline')));
    const data = msgs.flatMap((m) => (m.keyboard ? m.keyboard.inline_keyboard.flat() : [])).map((b) => b.callback_data).filter(Boolean);
    assert.ok(data.length >= 10);
    const worst = Math.max(...data.map((d) => Buffer.byteLength(d)));
    assert.ok(worst <= 64, len + ': ' + worst);
    assert.ok(data.every((d) => d.startsWith('ol:' + ctx.tgCmdTripKey(slug) + ':') || d.startsWith('dv:' + ctx.tgCmdTripKey(slug) + ':')));
    if (len === 64) assert.match(ctx.tgCmdTripKey(slug), /^t[0-9a-f]{11}$/);
    // The tapped buttons find the trip back from the key.
    tap(ctx, state, data.find((d) => /:rC$/.test(d)));
    assert.equal(answers(state).pop(), 'That day is not planned yet — choose a version, then 🧱 Build my plan.');
    tap(ctx, state, data.find((d) => /:C$/.test(d) && d.startsWith('dv:')));
    assert.equal(answers(state).pop(), '✅ C — Museums C');
  });
});

test('escaping: titles, areas, notes, stops, bookings and warnings reach the chat escaped; the app gets them plain', () => {
  const { ctx, state } = fresh();
  const evil = '<b>Tom & "Jerry"</b><script>x</script>';
  deliver(ctx, state, 'outline', outline({ notes: evil, options: [option('A', { title: evil, gains: evil, gives_up: evil,
    days: [oday(D1, 'full', evil.slice(0, 60)), oday(D2), oday(D3)] }), option('B')] }));
  deliver(ctx, state, 'day_versions', dayv(D1, { versions: [version('A', { title: evil, summary: evil, bookings: [evil], warnings: [evil],
    stops: [{ slug: 'x-y', name: evil }], leaves_out: [{ slug: 'z', name: evil }] }), version('B')] }));
  say(ctx, state, '/versions 1');
  say(ctx, state, '/outline');
  const all = sends(state).map((m) => m.text).join('\n');
  assert.doesNotMatch(all, /<script>|<b>Tom/);
  assert.match(all, /&lt;b&gt;Tom &amp; "Jerry"&lt;\/b&gt;&lt;script&gt;/);
  const btns = sends(state).flatMap(buttons).map((b) => b.text).join('\n');
  assert.doesNotMatch(btns, /&lt;/, 'button labels are plain text');
  const j = app(ctx, state, 'journey.get', { slug: TRIP });
  assert.equal(j.outline.options[0].title, evil);
  assert.equal(j.days[0].versions.versions[0].bookings[0], evil);
});

/* ---------------- the app's Compare operations ---------------- */
const OPS = [['journey.get', { slug: TRIP }], ['outline.choose', { slug: TRIP, build_id: 'ol-1', base: 'A' }], ['versions.get', { slug: TRIP, date: D1 }],
  ['versions.choose', { slug: TRIP, build_id: 'dv-1', date: D1, key: 'B' }], ['versions.done', { slug: TRIP }]];

test('app: every journey operation refuses a call without valid init data (403) and changes nothing', () => {
  const { ctx, state } = fresh();
  toChoose(ctx, state);
  press(ctx, state, '✅ Done choosing');
  deliver(ctx, state, 'outline', outline());
  const before = requests(state).length;
  OPS.forEach(([op, args]) => {
    assert.deepEqual([app(ctx, state, op, args, { userId: 999 }).status], [403], op + ' stranger');
    assert.equal(app(ctx, state, op, args, { initData: H.initData(ctx, state).replace('auth_date=', 'auth_date=1') }).status, 403, op + ' tampered');
    assert.equal(app(ctx, state, op, args, { initData: '' }).status, 403, op + ' none');
  });
  assert.equal(requests(state).length, before);
  assert.equal(ctx.tgJyOutlines(TRIP)[0].choice, null);
});

test('app: journey.get → outline.choose with a mix → versions.get / versions.choose → versions.done, through the same flow as the chat', () => {
  const { ctx, state } = fresh();
  assert.deepEqual([app(ctx, state, 'journey.get', { slug: 'nowhere' }).reason, app(ctx, state, 'journey.get', {}).reason], ['no_trip', 'missing_arg']);
  let j = app(ctx, state, 'journey.get', { slug: TRIP });
  assert.deepEqual([j.ok, j.mode, j.stage, j.outline, j.have, j.can_build, j.days.length], [true, 'outline', '', null, 0, false, 3]);
  toChoose(ctx, state);
  press(ctx, state, '✅ Done choosing');
  deliver(ctx, state, 'outline', outline());
  j = app(ctx, state, 'journey.get', { slug: TRIP });
  assert.deepEqual([j.stage, j.outline.build_id, j.outline.keys, j.outline.options[1].days[1].kind, j.outline.choice], ['outline', 'ol-1', ['A', 'B'], 'travel', null]);
  assert.equal(app(ctx, state, 'versions.done', { slug: TRIP }).reason, 'no_versions');

  // Refusals: a key the outline lacks, a day it lacks, a bad mix shape, a missing build.
  assert.deepEqual(J(app(ctx, state, 'outline.choose', { slug: TRIP, build_id: 'ol-1', base: 'C' })).reason, 'bad_base');
  assert.deepEqual([app(ctx, state, 'outline.choose', { slug: TRIP, build_id: 'ol-1', base: 'A', mix: { '2027-06-01': 'B' } }).reason], ['bad_date']);
  assert.equal(app(ctx, state, 'outline.choose', { slug: TRIP, build_id: 'ol-1', base: 'A', mix: [] }).reason, 'bad_args');
  assert.equal(app(ctx, state, 'outline.choose', { slug: TRIP, build_id: 'ol-9', base: 'A' }).status, 404);
  assert.equal(app(ctx, state, 'outline.choose', { slug: TRIP, build_id: 'ol-1', base: 'a' }).reason, 'bad_args');
  assert.equal(reqOf(state, 'day_versions').length, 0);

  const c = app(ctx, state, 'outline.choose', { slug: TRIP, build_id: 'ol-1', base: 'B', mix: { [D1]: 'A', [D3]: 'B' } });
  assert.deepEqual([c.ok, c.via, c.choice], [true, 'flow', { base: 'B', mix: { [D1]: 'A' } }], 'a mix entry equal to base is dropped');
  assert.equal(stage(ctx), 'versions');
  const vq = reqOf(state, 'day_versions');
  assert.deepEqual([vq.length, vq[0].id, vq[0].outline], [1, c.request_id, { build_id: 'ol-1', base: 'B', mix: { [D1]: 'A' } }]);

  deliver(ctx, state, 'day_versions', dayv(D1), { in_reply_to: c.request_id });
  const g = app(ctx, state, 'versions.get', { slug: TRIP, date: D1 });
  assert.deepEqual([g.planned, g.replace, g.current, g.versions.key, g.versions.versions[0].stops[0].time], [false, false, true, 'A', '10:00']);
  assert.equal(app(ctx, state, 'versions.get', { slug: TRIP, date: D2 }).reason, 'no_versions');
  assert.equal(app(ctx, state, 'versions.get', { slug: TRIP, date: '2027-07-01' }).reason, 'no_day');
  assert.equal(app(ctx, state, 'versions.choose', { slug: TRIP, build_id: 'dv-1', date: D1, key: 'C' }).reason, 'bad_key');
  const ch = app(ctx, state, 'versions.choose', { slug: TRIP, build_id: 'dv-1', date: D1, key: 'B' });
  assert.deepEqual([ch.ok, ch.key, ch.have, ch.missing, ch.can_build], [true, 'B', 1, [D2, D3], true]);
  assert.equal(app(ctx, state, 'versions.choose', { slug: TRIP, build_id: 'dv-1', date: D1, key: 'A', replace: true }).reason, 'not_planned');

  // A newer outline choice makes the earlier versions stale.
  j = app(ctx, state, 'journey.get', { slug: TRIP });
  assert.deepEqual([j.days[0].versions.key, j.days[1].versions, j.can_build, j.outline.choice], ['B', null, true, { base: 'B', mix: { [D1]: 'A' } }]);

  const d = app(ctx, state, 'versions.done', { slug: TRIP });
  assert.deepEqual([d.ok, d.via, d.missing], [true, 'flow', 2]);
  assert.equal(stage(ctx), 'planning');
  const pq = reqOf(state, 'plan');
  assert.deepEqual([pq.length, pq[0].id, pq[0].versions, pq[0].outline.base], [1, d.request_id, [{ date: D1, build_id: 'dv-1', key: 'B' }], 'B']);
  assert.equal(app(ctx, state, 'versions.done', { slug: TRIP }).reason, 'planning');
  assert.equal(app(ctx, state, 'outline.choose', { slug: TRIP, build_id: 'ol-1', base: 'A' }).reason, 'planning');
});

test('app: with no plan flow the choices go straight to requests (the taps of every round); shortlist.done names the journey stage', () => {
  const { ctx, state } = fresh({ days: 2 });
  deliver(ctx, state, 'shortlist', shortlist());
  tap(ctx, state, 'sl:r1:a2:w');
  const done = app(ctx, state, 'shortlist.done', { run: 'r1' });
  assert.deepEqual([done.ok, done.adopted, done.stage], [true, true, 'versions']);
  say(ctx, state, '/cancel');
  assert.equal(ctx.flowActive('777'), null);
  deliver(ctx, state, 'day_versions', dayv(D1));
  deliver(ctx, state, 'day_versions', dayv(D2));
  assert.match(texts(state).pop(), /every day has its versions/, 'the renderer offers the build when every date has versions');
  const ch = app(ctx, state, 'versions.choose', { slug: TRIP, build_id: 'dv-1', date: D2, key: 'B' });
  assert.equal(ch.can_build, true);
  const d = app(ctx, state, 'versions.done', { slug: TRIP });
  assert.deepEqual([d.ok, d.via, d.missing], [true, 'direct', 0]);
  const pq = reqOf(state, 'plan');
  assert.deepEqual([pq[0].picks, pq[0].versions.map((v) => v.key)], [['signal-hill-lookout'], ['A', 'B']]);
  assert.match(texts(state).pop(), /Building the days from 1 pick and the version you chose for 2 days/);
});

test('re-delivery and repick: a re-sent outline keeps a choice that still fits; /repick from the journey drops its requests', () => {
  const { ctx, state } = fresh();
  toChoose(ctx, state);
  press(ctx, state, '✅ Done choosing');
  deliver(ctx, state, 'outline', outline());
  say(ctx, state, '/outline B 1A');
  deliver(ctx, state, 'outline', outline());
  assert.deepEqual(J(ctx.tgJyOutlines(TRIP)[0].choice), { base: 'B', mix: { [D1]: 'A' } });
  assert.equal(ctx.tgJyOutlines(TRIP).length, 1, 'the build replaced its rows');
  deliver(ctx, state, 'outline', outline({ options: [option('A'), option('C')] }));
  assert.equal(ctx.tgJyOutlines(TRIP)[0].choice, null, 'a choice that no longer fits is dropped');
  const vreq = ctx.flowActive('777').state.jy.vreq;
  say(ctx, state, '/repick');
  assert.equal(stage(ctx), 'choose');
  assert.equal(ctx.flowActive('777').state.jy, null);
  assert.ok(J(ctx.flowActive('777').state.dropped).includes(vreq));
  say(ctx, state, '/outline Z');
  assert.match(texts(state).pop(), /Send <code>\/outline A<\/code>/);
  say(ctx, state, '/outline A');
  assert.match(texts(state).pop(), /earlier round — send \/plan/);
});

test('app trip.digest: the Phase 10 fields pass through when stored, links stay Google Maps https; an old digest keeps its shape', () => {
  const { ctx, state } = fresh();
  const old = digest([D1]);
  deliver(ctx, state, 'plan_digest', old);
  const before = app(ctx, state, 'trip.digest', { slug: TRIP });
  assert.deepEqual(Object.keys(before.days[0]).sort(), ['date', 'legs', 'n', 'rain', 'stops', 'theme', 'warnings']);
  assert.deepEqual(Object.keys(before.days[0].stops[0]).sort(), ['arrive', 'depart', 'maps_url', 'minutes', 'n', 'name', 'note_line', 'slug']);
  const c10 = digest([D1]);
  c10.days[0].spare_minutes = 45;
  c10.days[0].stops[0].time_style = 'about';
  c10.days[0].stops[0].check_on_day = 'Check the tide table.';
  c10.days[0].stops[0].arrive = '10:52';
  c10.days[0].legs = [{ from: 'lodging', to: 'lantern-museum', mode: 'WALK', minutes: 22, maps_url: 'https://maps.example.invalid/dir/x',
    estimated: true, distance_m: 1800, flags: ['downhill', 'footpath'], taxi_minutes: 8, buffer_minutes: 5 }];
  deliver(ctx, state, 'plan_digest', { ...c10, build_id: 'build-ps-2' });
  const day = app(ctx, state, 'trip.digest', { slug: TRIP }).days[0];
  assert.equal(day.spare_minutes, 45);
  assert.deepEqual([day.stops[0].time_style, day.stops[0].check_on_day], ['about', 'Check the tide table.']);
  assert.deepEqual(day.legs[0], { from: 'lodging', to: 'lantern-museum', mode: 'WALK', minutes: 22, maps_url: '', estimated: true, distance_m: 1800,
    taxi_minutes: 8, buffer_minutes: 5, flags: ['footpath', 'downhill'] });
});

test('app trip.digest: a note sentence the stop time contradicts is dropped as on the chat card; other notes are unchanged', () => {
  const { ctx, state } = fresh();
  const d = digest([D1]);
  d.days[0].stops[0].arrive = '15:00';
  d.days[0].stops[0].depart = '16:00';
  d.days[0].stops[0].note_line = 'Go right at opening. The café upstairs has a harbour view.';
  deliver(ctx, state, 'plan_digest', d);
  const stop = app(ctx, state, 'trip.digest', { slug: TRIP }).days[0].stops[0];
  assert.equal(stop.note_line, 'The café upstairs has a harbour view.');
  const chat = ctx.tgCmdDayMessages(ctx.tgTripGet(TRIP), ctx.tgDigestDay(TRIP, D1), 1).map((m) => m.html).join('\n');
  assert.ok(chat.includes('The café upstairs has a harbour view.') && !chat.includes('opening'), chat);
  const keep = digest([D1]);
  keep.days[0].stops[0].arrive = '09:30';
  keep.days[0].stops[0].note_line = 'Go right at opening. Bring cash.';   // 09:30 is before 10:00: nothing contradicts it
  deliver(ctx, state, 'plan_digest', { ...keep, build_id: 'build-ps-3' });
  assert.equal(app(ctx, state, 'trip.digest', { slug: TRIP }).days[0].stops[0].note_line, 'Go right at opening. Bring cash.');
});

// Developed by: LightAISolutions
