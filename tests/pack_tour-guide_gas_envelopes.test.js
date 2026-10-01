'use strict';
// Tour Guide pack — 20_envelopes.js: the six from-brain envelope types (helpers/decisions/TG-PHASE-5.md §1.4, §1.5, §1.8).
// Valid + invalid payload per type, Google fields refused, store-then-hand-off (plan flow → renderer → plain line), the
// digest split through a real envelope, the pf review end to end (✏️ capture, decisions request to to-brain), places
// check lines and the tour_guide snapshot. All trips, places and wording are invented ("Port Sorrel"; reserved domains).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');

const NOW = '2027-05-01T12:00:00Z';
const TRIP = 'port-sorrel-spring-2027';
const J = (v) => JSON.parse(JSON.stringify(v));
const maps = (id) => 'https://www.google.com/maps/search/?api=1&query=Fixture&query_place_id=' + id;

function fresh(opts = {}) {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: opts.now || NOW });
  H.bootstrap(ctx, state);
  // The WP-5a renderers / plan flow may be registered once branches merge; every test starts from "none" and installs
  // the fakes it needs by direct assignment (never registerX, which would refuse a duplicate).
  ['tg_shortlist', 'tg_trip_facts', 'tg_plan_digest'].forEach((n) => { delete ctx.HB_REGISTRY.renderer[n]; });
  delete ctx.HB_REGISTRY.flow.plan;
  return { ctx, state };
}
const sends = (state) => state.fetch.telegram('sendMessage').map((r) => r.json);
const edits = (state) => state.fetch.telegram('editMessageText').map((r) => r.json);
const answers = (state) => state.fetch.telegram('answerCallbackQuery').map((r) => r.json.text);
const files = (state, p) => (state.drive.listFiles('TourGuide/mailbox/' + p) || []).sort();
function deliver(ctx, state, type, payload, over = {}) {
  const env = H.envelope(type, payload, over);
  H.putEnvelope(state, env);
  return { env, stats: J(ctx.pollFromBrain()) };
}
function validate(ctx, type, payload) {
  const raw = JSON.stringify(H.envelope(type, payload));
  return J(ctx.validateEnvelope(raw, Buffer.byteLength(raw)));
}
const post = (ctx, state, upd) => ctx.doPost(H.postEvent('tg', { k: state.props[ctx.PROP.WEBHOOK_SECRET] }, upd));
const tap = (ctx, state, data, messageId) => post(ctx, state, H.tgUpdate({ callback: data, messageId }));
const say = (ctx, state, text) => post(ctx, state, H.tgUpdate({ text }));

/* ---------------- fixtures ---------------- */
const item = (n, slug, over = {}) => ({ n, slug, name: slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '),
  why_you: 'Quiet in the morning.', fit: 0.8, est_minutes: 60, area: 'Old harbour', maps_url: maps('Fixture' + n), labels: ['verified'], ...over });
const P = {
  shortlist: (over = {}) => ({ v: 1, kind: 'shortlist', trip: TRIP, run_id: 'f20270430002', round: 1, more: false, decided: [],
    groups: [{ id: 'activities', gems_wanted: 1, gems_shown: 1, items: [item(1, 'lantern-museum'), item(2, 'signal-hill-lookout', { gem: true, gem_line: 'Small and loved by locals.' })] },
      { id: 'food', items: [item(3, 'saffron-row-market')] }], ...over }),
  trip_facts: (over = {}) => ({ v: 1, kind: 'trip_facts', trip: TRIP,
    found: [{ n: 1, kind: 'dates', text: 'Wed 12 to Fri 14 May', start: '2027-05-12', end: '2027-05-14' },
      { n: 2, kind: 'lodging', text: 'Harbour Lane Guesthouse', start: '2027-05-12', end: '2027-05-15' }], missing: ['flight'], ...over }),
  plan_digest: (over = {}) => ({ v: 1, kind: 'plan_digest', trip: TRIP, build_id: 'build-tc-1', verified_on: '2027-04-30',
    days: [{ date: '2027-05-12', theme: 'Harbour', stops: [{ n: 1, slug: 'lantern-museum', name: 'Lantern Museum', arrive: '10:00', depart: '11:00',
      minutes: 60, maps_url: maps('FixtureA'), note_line: 'Start upstairs.' }], legs: [{ from: 'lodging', to: 'lantern-museum', mode: 'WALK', minutes: 9 }], warnings: [] }],
    later: [{ slug: 'moonlight-night-market', name: 'Moonlight Night Market', reason: 'opens after your day ends' }],
    drive: { plan: 'fixtureDrivePlanFile01', brochure_html: null, brochure_pdf: null }, ...over }),
  profile_summary: (over = {}) => ({ v: 1, kind: 'profile_summary', text: 'Relaxed pace; small museums first.', dimensions_count: 9, updated: '2027-04-28T08:15:00Z', ...over }),
  places_digest: (over = {}) => ({ v: 1, kind: 'places_digest', destination: 'port-sorrel', places: [place('lantern-museum'), place('signal-hill-lookout', { category: 'viewpoint', status: 'saved-for-later' })], ...over })
};
function place(slug, over = {}) {
  return { slug, name: slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '), area: 'Old harbour', category: 'museum', tags: ['history'],
    status: 'candidate', last_trip: null, last_researched: '2027-04-28', last_verified: null, note_line: 'Quiet before noon.', maps_url: maps('Fixture' + slug.length),
    history_summary: '', ...over };
}
const CIDS = ['c_0a1b2c3d4e', 'c_1b2c3d4e5f', 'c_2c3d4e5f60'];
function review(over = {}) {
  const st = ['You prefer small museums', 'You avoid early starts', 'You like <b>street</b> food & markets'];
  return { v: 1, kind: 'prefs_review', vocab: 'travel', batch_id: 'pfb_00112233445566aa', more: 0, held_back: [],
    items: CIDS.map((cid, i) => ({ cid, dimension: 'interests', value: 'v' + i, stance: '+', statement: st[i], suspect: i === 2,
      text: st[i] + ' (seen 3 times)', buttons: [[{ text: 'Yes', data: 'pf:' + cid + ':y' }, { text: 'Edit', data: 'pf:' + cid + ':e' }, { text: 'No', data: 'pf:' + cid + ':n' }]] })),
    ...over };
}

/* ---------------- tests ---------------- */
test('validate: a valid payload per type passes; an invalid one is refused with a pointed message', () => {
  const { ctx } = fresh();
  const valid = { shortlist: P.shortlist(), trip_facts: P.trip_facts(), plan_digest: P.plan_digest(), profile_summary: P.profile_summary(),
    prefs_review: review(), places_digest: P.places_digest() };
  for (const [type, p] of Object.entries(valid)) assert.deepEqual(validate(ctx, type, p).errors, [], type);
  const bad = (type, p, re) => {
    const v = validate(ctx, type, p);
    assert.equal(v.ok, false, type);
    assert.ok(v.errors.some((e) => re.test(e)), type + ': ' + v.errors.join(' / '));
  };
  const sl = P.shortlist(); sl.groups[0].id = 'drinks'; bad('shortlist', sl, /groups\[0\]\.id must be one of activities \| food/);
  const sl2 = P.shortlist(); sl2.groups[1].items[0].slug = 'lantern-museum'; bad('shortlist', sl2, /slug lantern-museum is listed twice/);
  bad('shortlist', P.shortlist({ round: -1 }), /round out of range/);
  bad('trip_facts', P.trip_facts({ missing: ['boats'] }), /missing\[0\] must be one of/);
  const tf = P.trip_facts(); tf.found[0].end = '2027-05-01'; bad('trip_facts', tf, /found\[0\]\.end is before start/);
  const pd = P.plan_digest(); pd.days[0].stops[0].arrive = '25:00'; bad('plan_digest', pd, /stops\[0\]\.arrive has the wrong format/);
  const pd2 = P.plan_digest(); pd2.days.push({ ...pd2.days[0] }); bad('plan_digest', pd2, /days must be in date order/);
  const pr = P.plan_digest(); pr.days[0].rain = [{ slug: 'rope-loft', name: 'Rope Loft', instead_of: 'Harbour Walk', km: 0.8, maps_url: 'https://www.google.com/maps/place/?q=place_id:FixtureR' }];
  assert.deepEqual(validate(ctx, 'plan_digest', pr).errors, [], 'rain swaps are accepted');
  const pr2 = J(pr); pr2.days[0].rain[0].km = -1; pr2.days[0].rain.push(pr2.days[0].rain[0], pr2.days[0].rain[0]);
  bad('plan_digest', pr2, /rain\[0\]\.km must be a number from 0 to 100/);
  bad('plan_digest', pr2, /rain/);
  bad('plan_digest', P.plan_digest({ drive: { plan: 'x', brochure_html: null, brochure_pdf: null } }), /drive\.plan must be a Drive file id/);
  bad('profile_summary', P.profile_summary({ text: '' }), /text must not be empty/);
  bad('profile_summary', P.profile_summary({ updated: '2027-02-30T10:00:00Z' }), /updated is not a real date-time/);
  bad('profile_summary', P.profile_summary({ mood: 'sunny' }), /unknown key "mood"/);
  const rv = review(); rv.items[0].buttons[0][0].data = 'pf:' + CIDS[1] + ':y'; bad('prefs_review', rv, /data must name c_0a1b2c3d4e/);
  bad('prefs_review', review({ kind: 'prefs' }), /kind must be "prefs_review"/);
  bad('prefs_review', review({ batch_id: 'pfb_1' }), /batch_id/);
  const pl = P.places_digest(); pl.places[0].status = 'visited'; bad('places_digest', pl, /places\[0\]\.status must be one of/);
});

test('places_digest: a Google field is refused — the envelope is rejected and nothing is stored', () => {
  const { ctx, state } = fresh();
  const p = P.places_digest(); p.places[0].rating = 4.7; p.places[1].opening_hours = ['Mon 09:00–17:00'];
  const v = validate(ctx, 'places_digest', p);
  assert.ok(v.errors.includes('payload: places[0]: Google field "rating" refused (own data only)'), v.errors.join(' / '));
  assert.ok(v.errors.includes('payload: places[1]: Google field "opening_hours" refused (own data only)'));
  const { env, stats } = deliver(ctx, state, 'places_digest', p);
  assert.equal(stats.rejected, 1);
  assert.deepEqual(files(state, 'archive/rejected'), [env.id + '.json']);
  assert.equal(ctx.storeAll('Places').length, 0);
  assert.deepEqual(sends(state), []);
});

test('shortlist: stored first, then a plain line (no flow, no renderer); trip becomes choosing', () => {
  const { ctx, state } = fresh();
  const { stats } = deliver(ctx, state, 'shortlist', P.shortlist());
  assert.equal(stats.processed, 1);
  assert.equal(ctx.tgTripGet(TRIP).status, 'choosing');
  assert.equal(ctx.tgShortlistItems(TRIP, 'f20270430002').length, 3);
  const s = sends(state);
  assert.equal(s.length, 1);
  assert.equal(s[0].text, '🗂 Shortlist for <b>' + TRIP + '</b> (round 1): 3 options. Send /plan to choose.');
  assert.equal(s[0].parse_mode, 'HTML');
  // A done trip is not pulled back to choosing.
  ctx.tgTripSetStatus(TRIP, 'done');
  deliver(ctx, state, 'shortlist', P.shortlist({ round: 2 }));
  assert.equal(ctx.tgTripGet(TRIP).status, 'done');
});

test('shortlist: the WP-5a renderer tg_shortlist sends its messages with keyboards; a throwing renderer falls back to the plain line', () => {
  const { ctx, state } = fresh();
  const seen = [];
  ctx.HB_REGISTRY.renderer.tg_shortlist = (p) => {
    seen.push(J(p));
    return { messages: [{ html: '<b>Activities</b>', keyboard: ctx.tgKeyboard([[{ text: '1 ✅', data: ctx.cbEncode('sl', 'f20270430002', '1', 'w') }]]) }, { html: '<b>Food</b>' }] };
  };
  deliver(ctx, state, 'shortlist', P.shortlist());
  assert.equal(seen.length, 1); assert.equal(seen[0].run_id, 'f20270430002');
  const s = sends(state);
  assert.deepEqual(s.map((m) => m.text), ['<b>Activities</b>', '<b>Food</b>']);
  assert.equal(s[0].reply_markup.inline_keyboard[0][0].callback_data, 'sl:f20270430002:1:w');
  assert.equal(s[1].reply_markup, undefined);
  ctx.HB_REGISTRY.renderer.tg_shortlist = () => { throw new Error('boom'); };
  deliver(ctx, state, 'shortlist', P.shortlist({ round: 2 }));
  assert.match(sends(state).pop().text, /^🗂 Shortlist for <b>port-sorrel-spring-2027<\/b> \(round 2\): 3 options/);
  assert.ok(ctx.storeAll('AuditLog').some((r) => r.event === 'tg_render_error'), 'render error audited');
});

test('shortlist / trip_facts / plan_digest go to the active plan flow of the same trip (stored first); another trip is not handed over', () => {
  const { ctx, state } = fresh();
  const got = [];
  ctx.HB_REGISTRY.flow.plan = {
    start: (seed) => ({ pause: true, state: { trip: seed.trip } }),
    next: (st, input) => { got.push(J(input)); return { pause: true, state: st }; }
  };
  ctx.flowStart('777', 'plan', { trip: TRIP });
  const a = deliver(ctx, state, 'shortlist', P.shortlist());
  deliver(ctx, state, 'trip_facts', P.trip_facts(), { in_reply_to: 'req-fixture-0001' });
  deliver(ctx, state, 'plan_digest', P.plan_digest());
  assert.deepEqual(got.map((g) => g.event), ['shortlist', 'trip_facts', 'plan_digest']);
  assert.equal(got[0].type, 'resume'); assert.equal(got[0].env_id, a.env.id); assert.equal(got[0].in_reply_to, null);
  assert.equal(got[1].in_reply_to, 'req-fixture-0001');
  assert.equal(got[0].payload.groups.length, 2);
  assert.deepEqual(sends(state), [], 'the flow speaks, not the handler');
  assert.equal(ctx.tgShortlistItems(TRIP, 'f20270430002').length, 3, 'stored before the hand-off');
  assert.equal(ctx.tgDigestDays(TRIP).length, 1);
  deliver(ctx, state, 'trip_facts', P.trip_facts({ trip: 'other-trip-2027' }));
  assert.equal(got.length, 3);
  assert.equal(sends(state).pop().text, '📋 Trip facts for <b>other-trip-2027</b>: 2 found, 1 missing. Send /plan to confirm them.');
  assert.ok(ctx.tgTripGet('other-trip-2027'), 'trip_facts ensures the trip row');
});

test('plan_digest: a day over the 50 000-char cell limit is split across DayPlans rows and reads back whole; trip planned', () => {
  const { ctx, state } = fresh();
  const long = 'https://www.google.com/maps/dir/?api=1&travelmode=walking&waypoints=' + 'x'.repeat(1880);
  const stops = Array.from({ length: 25 }, (_, i) => ({ n: i + 1, slug: 'fixture-stop-' + (i + 1), name: 'Fixture Stop ' + (i + 1),
    arrive: '09:00', depart: '09:20', minutes: 20, maps_url: long, note_line: 'A short note.' }));
  const p = P.plan_digest(); p.days[0].stops = stops;
  assert.ok(JSON.stringify(p).length < 60000, 'within the payload limit');
  const { stats } = deliver(ctx, state, 'plan_digest', p);
  assert.equal(stats.processed, 1);
  const rows = ctx.storeAll('DayPlans');
  assert.ok(rows.length >= 2, 'split into ' + rows.length + ' rows');
  rows.forEach((r) => assert.ok(String(r.stops_json).length <= 50000));
  const days = J(ctx.tgDigestDays(TRIP));
  assert.equal(days.length, 1);
  assert.deepEqual(days[0].stops, stops);
  const t = ctx.tgTripGet(TRIP);
  assert.equal(t.status, 'planned'); assert.equal(t.build_id, 'build-tc-1'); assert.equal(t.drive_plan, 'fixtureDrivePlanFile01');
  assert.deepEqual(J(ctx.tgLaterList(TRIP)).map((l) => l.place_slug), ['moonlight-night-market']);
  assert.equal(sends(state).pop().text, '🗓 Plan for <b>' + TRIP + '</b> stored: 1 day(s), 1 saved for later. /trip shows it.');
});

test('profile_summary: stored in Settings and sent escaped', () => {
  const { ctx, state } = fresh();
  deliver(ctx, state, 'profile_summary', P.profile_summary({ text: 'Museums <script>x</script> & tea.' }));
  const s = J(ctx.tgProfileSummaryGet());
  assert.equal(s.text, 'Museums <script>x</script> & tea.'); assert.equal(s.dimensions_count, 9); assert.equal(s.updated, '2027-04-28T08:15:00Z');
  assert.ok(ctx.settingGet(ctx.TG_SETTINGS.PROFILE_SUMMARY, ''));
  assert.equal(sends(state).pop().text, '🧭 <b>Your travel profile</b>\nMuseums &lt;script&gt;x&lt;/script&gt; &amp; tea.');
});

test('prefs_review end to end: pf buttons, ✅ keep, ✏️ capture of the next text, ❌ drop → decisions request to to-brain (kind prefs)', async () => {
  const { ctx, state } = fresh();
  H.configureRoutine(ctx, state, 'PREFS');
  const { stats } = deliver(ctx, state, 'prefs_review', review());
  assert.equal(stats.processed, 1);
  let s = sends(state);
  assert.equal(s.length, 4);
  assert.match(s[0].text, /^🧭 <b>3 preferences to review<\/b>/);
  assert.equal(s[1].text, 'You prefer small museums (seen 3 times)');
  assert.match(s[3].text, /^You like &lt;b&gt;street&lt;\/b&gt; food &amp; markets \(seen 3 times\)\n⚠️ <i>Some of the evidence/);
  assert.deepEqual(s[1].reply_markup.inline_keyboard[0].map((b) => b.callback_data), ['pf:' + CIDS[0] + ':y', 'pf:' + CIDS[0] + ':e', 'pf:' + CIDS[0] + ':n']);
  assert.deepEqual(s[1].reply_markup.inline_keyboard[0].map((b) => b.text), ['✅ Confirm', '✏️ Edit', '❌ Reject']);
  const mids = J(ctx.tgPfLoad())[0].items.map((i) => i.mid);
  assert.ok(mids.every((m) => /^\d+$/.test(m)), 'message ids kept');
  const reqsBefore = ctx.storeAll('Requests').length;

  // ✅ keep item 1
  tap(ctx, state, 'pf:' + CIDS[0] + ':y', Number(mids[0]));
  assert.equal(answers(state).pop(), 'Kept');
  let e = edits(state).pop();
  assert.equal(String(e.message_id), mids[0]); assert.equal(e.text, 'You prefer small museums\n✅ Kept');

  // ✏️ item 2: prompt, a too-long answer is refused, the next text is captured (no message request opened)
  tap(ctx, state, 'pf:' + CIDS[1] + ':e', Number(mids[1]));
  assert.equal(answers(state).pop(), 'Send the new wording');
  assert.match(sends(state).pop().text, /^✏️ Send the new wording for: <i>You avoid early starts<\/i>/);
  assert.doesNotMatch(state.fetch.lastTelegramText(), /\/cancel/);
  say(ctx, state, 'y'.repeat(201));
  assert.match(state.fetch.lastTelegramText(), /under 200 characters/);
  say(ctx, state, '  Starts after   nine are fine ');
  e = edits(state).pop();
  assert.equal(String(e.message_id), mids[1]); assert.equal(e.text, 'You avoid early starts\n✏️ Changed to: <b>Starts after nine are fine</b>');
  assert.equal(state.fetch.lastTelegramText(), '✏️ Noted: <b>Starts after nine are fine</b>');
  assert.equal(ctx.storeAll('Requests').length, reqsBefore, 'captured text opened no request');
  assert.equal(ctx.settingGet('tg_pf_edit', ''), '', 'pending edit cleared');
  assert.deepEqual(files(state, 'to-brain').filter((n) => n.startsWith('req_')), [], 'nothing sent before the batch is decided');

  // ❌ item 3 completes the batch → one prefs request carrying the decisions document
  tap(ctx, state, 'pf:' + CIDS[2] + ':n', Number(mids[2]));
  assert.equal(answers(state).pop(), 'Dropped');
  const reqs = files(state, 'to-brain').filter((n) => n.startsWith('req_'));
  assert.equal(reqs.length, 1);
  const req = JSON.parse(state.drive.readFile('TourGuide/mailbox/to-brain', reqs[0]));
  assert.equal(req.type, 'request'); assert.equal(req.payload.kind, 'prefs');
  const doc = req.payload.decisions;
  assert.deepEqual(Object.keys(doc).sort(), ['batch_id', 'decisions', 'kind', 'source', 'v', 'via']);
  assert.equal(doc.source, 'owner'); assert.equal(doc.via, 'telegram'); assert.equal(doc.batch_id, 'pfb_00112233445566aa');
  assert.deepEqual(doc.decisions.map((d) => [d.cid, d.decision, d.value]), [[CIDS[0], 'confirm', undefined], [CIDS[1], 'edit', 'Starts after nine are fine'], [CIDS[2], 'reject', undefined]]);
  const { readDecisions } = await import('../kits/prefs/lib/decisions.mjs');
  const rd = readDecisions(doc);
  assert.deepEqual(rd.errors, []); assert.equal(rd.decisions.length, 3); assert.equal(rd.via, 'telegram');
  const row = ctx.storeAll('Requests').pop();
  assert.equal(row.kind, 'prefs'); assert.equal(row.routine, 'PREFS'); assert.equal(row.status, 'open');
  assert.equal(state.fetch.routine().length, 1, 'PREFS routine fired once');
  assert.match(state.fetch.lastTelegramText(), /^🧠 Updating your profile with 3 decision\(s\)/);

  // After close: taps answer "Already sent"; the same batch again is ignored; an unknown cid has ended
  tap(ctx, state, 'pf:' + CIDS[0] + ':n', Number(mids[0]));
  assert.equal(answers(state).pop(), 'Already sent — this review is closed.');
  const before = sends(state).length;
  deliver(ctx, state, 'prefs_review', review());
  assert.equal(sends(state).length, before, 'a decided batch is not shown again');
  tap(ctx, state, 'pf:c_ffffffffff:y', 1);
  assert.equal(answers(state).pop(), 'That review has ended.');
  assert.equal(files(state, 'to-brain').filter((n) => n.startsWith('req_')).length, 1, 'still one request');
});

test('prefs_review: ✏️ notes /cancel when a flow is active (the flow reads text first); a pending edit expires after 30 minutes', () => {
  const { ctx, state } = fresh();
  deliver(ctx, state, 'prefs_review', review());
  const got = [];
  ctx.HB_REGISTRY.flow.plan = { start: () => ({ prompt: 'Which trip?', expect: 'text', state: { trip: TRIP } }),
    next: (st, input) => { got.push(J(input)); return { prompt: 'ok', expect: 'text', state: st }; } };
  ctx.flowStart('777', 'plan', {});
  tap(ctx, state, 'pf:' + CIDS[1] + ':e', 60);
  assert.match(state.fetch.lastTelegramText(), /The <b>plan<\/b> conversation reads your messages first — finish it or send \/cancel/);
  say(ctx, state, 'Later starts');
  assert.deepEqual(got.map((g) => g.text), ['Later starts'], 'the active flow claimed the text');
  assert.ok(ctx.settingGet('tg_pf_edit', ''), 'edit still pending');
  ctx.flowCancel('777');
  // 31 minutes later the pending edit has lapsed: the text is not captured and the item stays undecided.
  ctx.__TEST_NOW = '2027-05-01T12:31:00Z';
  say(ctx, state, 'Later starts please');
  assert.equal(ctx.settingGet('tg_pf_edit', ''), '', 'expired edit cleared');
  assert.equal(J(ctx.tgPfLoad())[0].decisions[CIDS[1]], undefined);
  assert.match(state.fetch.lastTelegramText(), /No routine is configured to answer here yet/, 'fell through to the normal message path');
  // An empty review is silent.
  const n = sends(state).length;
  deliver(ctx, state, 'prefs_review', review({ batch_id: 'pfb_99887766554433aa', items: [] }));
  assert.equal(sends(state).length, n);
});

test('places_digest: unsolicited → one count line, then silence on a repeat; a places check → still open / changed lines; list → count line', () => {
  const { ctx, state } = fresh();
  deliver(ctx, state, 'places_digest', P.places_digest());
  assert.equal(sends(state).pop().text, '📍 Places for <b>port-sorrel</b> updated: 2 new, 0 changed — /places to look.');
  assert.deepEqual(J(ctx.tgPlacesCounts()), { 'port-sorrel': 2 });
  const n = sends(state).length;
  deliver(ctx, state, 'places_digest', P.places_digest());
  assert.equal(sends(state).length, n, 'nothing new → nothing said');

  // A fresh check the owner asked for: the answer names each place it checked.
  const chk = ctx.tgOpenKindRequest('places', { scope: 'check', destination: 'port-sorrel' }, { text: 'Fresh check', ack: false });
  assert.equal(ctx.getRequest(chk.id).routine, 'PLACES');
  const p = P.places_digest();
  p.places[0].last_verified = '2027-05-01';
  p.places[1].status = 'rejected'; p.places[1].note_line = 'Closed for repairs <until June>.';
  deliver(ctx, state, 'places_digest', p, { in_reply_to: chk.id });
  assert.equal(sends(state).pop().text, '🔁 <b>Fresh check — port-sorrel</b>\n✅ still open: <b>Lantern Museum</b> · checked 2027-05-01\n' +
    '❌ changed: <b>Signal Hill Lookout</b> (no longer suggested) — Closed for repairs &lt;until June&gt;.');
  assert.equal(ctx.getRequest(chk.id).status, 'answered');
  assert.equal(J(ctx.tgPlacesGet('signal-hill-lookout')).status, 'rejected');

  const lst = ctx.tgOpenKindRequest('places', { scope: 'list', destination: 'port-sorrel' }, { text: 'List', ack: false });
  deliver(ctx, state, 'places_digest', P.places_digest({ places: [place('saffron-row-market', { category: 'market' })] }), { in_reply_to: lst.id });
  assert.equal(sends(state).pop().text, '📍 <b>port-sorrel</b>: 3 places in the repository — /places to search.');
});

test('snapshot: state.json carries tour_guide — trips with status, the open choice round with counts, profile date, places counts', () => {
  const { ctx, state } = fresh();
  deliver(ctx, state, 'shortlist', P.shortlist());
  deliver(ctx, state, 'profile_summary', P.profile_summary());
  deliver(ctx, state, 'places_digest', P.places_digest());
  ctx.tgTripUpsert({ slug: 'old-trip-2026', destination: 'Old Town', start: '2026-03-01', end: '2026-03-03', status: 'done' });
  const run = ctx.tgShortlistRunKey(TRIP, 'f20270430002');
  ctx.tgChoiceSet(TRIP, run, 'shortlist', '1', 'w');
  ctx.tgChoiceSet(TRIP, run, 'shortlist', '2', 'l');
  ctx.tgChoiceSet(TRIP, run, 'shortlist', '3', 'w');
  ctx.writeSnapshot();
  const snap = JSON.parse(state.drive.readFile('TourGuide/mailbox/to-brain', 'state.json'));
  const tg = snap.tour_guide;
  assert.deepEqual(tg.trips.map((t) => [t.slug, t.status]), [[TRIP, 'choosing'], ['old-trip-2026', 'done']]);
  assert.equal(tg.trips_total, 2);
  assert.deepEqual(tg.choice_round, { trip: TRIP, run, round: 1, items: 3, want: 2, later: 1, skip: 0 });
  assert.deepEqual(tg.profile_summary, { updated: '2027-04-28' });
  assert.deepEqual(tg.places, { 'port-sorrel': 2 });
});

// Developed by: LightAISolutions
