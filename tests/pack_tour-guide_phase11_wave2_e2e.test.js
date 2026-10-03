'use strict';
// Tour Guide pack — Phase 11 wave 2 end to end (coordinator). The invented two-stays trip (packs/tour-guide/fixtures/
// two-stays: a week split between two towns, a morning train between them with the bags going to the new lodging, a last
// day that ends at a station, a booked dinner and a waterfall a day trip away) goes the whole way through the journey:
//   the owner picks from a shortlist → the outline routine (WP-11e outlineDraft) offers three ways to shape the week and
//   the core (WP-11f) shows them → the owner takes A with two days from B → planVersions drafts up to three versions of
//   each day → the owner chooses one in the chat and one in the app → assembleChosen builds the one plan from the chosen
//   mix and puts what the versions not chosen had on the Later list → its digest becomes the day cards and the app's
//   trip.digest, and the same plan renders as one brochure (WP-11d).
// Every outline and day_versions payload passes both validators: WP-11f's node schemas and the core's.
// The brain's side is computed once from the choices this test makes; the first test checks that the core asks for
// exactly those. Invented data only ("Fernmoor", "Quillbay" and "Hollin" in the "Fictional Isles", November 2027).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');
const shared = require('./harness/tour-guide-digest');

const NOW = '2027-10-25T09:00:00Z';
const DIET = 'vegetarian';
const TRIP = 'fernmoor-quillbay-2027';
const DATES = ['2027-11-08', '2027-11-09', '2027-11-10', '2027-11-11', '2027-11-12', '2027-11-13', '2027-11-14'];
const OUTLINE_BUILD = 'ol-e2e', VERSIONS_BUILD = 'dv-e2e', PLAN_BUILD = 'build-e2e';
const J = (v) => JSON.parse(JSON.stringify(v));

/* ---------------- the owner's choices ---------------- */
// The shortlist as shown (activities, then food). The owner taps every item: 🔖 for LATER, ❌ for SKIP, ✅ for the rest.
const ACTIVITIES = ['kestrel-hill-gardens', 'upland-tea-fields', 'fernmoor-castle', 'weavers-museum', 'bellstone-temple', 'harbour-aquarium',
  'hollin-falls', 'hollin-pottery-village', 'quillbay-maritime-museum', 'cedar-ridge-temple', 'pier-market', 'old-town-quarter', 'clockmakers-row',
  'lantern-bridge', 'tidewater-baths', 'printworks-gallery', 'saltpan-lighthouse', 'seawall-promenade', 'old-town-market', 'ridge-lookout'];
const FOOD = ['ember-and-oak', 'salt-lantern', 'driftwood-kitchen', 'pine-hearth'];
const LATER = ['old-town-market', 'pine-hearth'];
const SKIP = ['ridge-lookout'];
const PICKS = [...ACTIVITIES, ...FOOD].filter((s) => !LATER.includes(s) && !SKIP.includes(s));
// Outline A, with the day trip and the garden day from B; then version B of the first day and C of the third.
const BASE = 'A';
const MIX = { '2027-11-08': 'B', '2027-11-11': 'B' };
const KEYS = { '2027-11-08': 'B', '2027-11-10': 'C' };
const keyOf = (date) => KEYS[date] || 'A';

/* ---------------- the brain's side (WP-11e), as the plan routine runs it ---------------- */
let cached = null;
/**
 * The choices above → outlineDraft; outlineInput for A with the mix; planVersions for every date (one Maps cache for the
 * whole set); assembleChosen with the chosen keys; the plan's digest (the shared stand-in for the private repo's
 * builder). The picked restaurants are the dinner pool. Computed once; the tests only read it.
 */
function brain() {
  if (!cached) cached = (async () => {
    const fixtures = await import('../packs/tour-guide/fixtures/index.mjs');
    const maps = await import('../kits/maps/index.mjs');
    const journey = await import('../packs/tour-guide/journey/index.mjs');
    const fx = fixtures.loadFixture('two-stays');
    const places = [...fx.places, ...fx.dinners];
    const choices = { picks: PICKS, later: LATER, skip: SKIP };
    const dinners = fx.dinners.filter((p) => PICKS.includes(p.id));
    const draft = journey.outlineDraft({ trip: fx.trip, places, snapshots: fx.snapshots, dinners, profile: fx.profile, choices, build_id: OUTLINE_BUILD });
    const client = maps.createMapsClient({ transport: maps.createMockTransport(fixtures.createFixtureResponder(fx)), ledger: maps.createLedger() });
    const input = { trip: fx.trip, places, snapshots: fx.snapshots, estimates: fx.estimates, notes: fx.notes, profile: fx.profile,
      calibration: fx.calibration, dinners, choices, maps: client, now: NOW, seed: 7 };
    const outline = journey.outlineInput(draft, { base: BASE, mix: MIX });
    const cache = journey.cachedMaps(client);
    const sets = {};
    for (const date of DATES) sets[date] = await journey.planVersions({ ...input, build_id: VERSIONS_BUILD, outline }, { date, count: 3, cache });
    const chosen = Object.fromEntries(DATES.map((date) => [date, { key: keyOf(date), version: sets[date] }]));
    const built = await journey.assembleChosen({ input: { ...input, build_id: PLAN_BUILD }, outline, choices: chosen });
    const digest = await shared.digestOf(built.plan, fx.trip, { now: NOW, diet: DIET });
    return { fx, input, draft, outline, sets, plan: built.plan, alternatives: built.alternatives, notes: built.notes, digest };
  })();
  return cached;
}
const dinnerOf = (d) => (d.meals || []).find((m) => m.kind === 'dinner') || null;
const stopsOf = (d) => d.stops.map((s) => s.place);

/* ---------------- the core (WP-11f), as the owner's chat and app reach it ---------------- */
function core() {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: NOW });
  H.bootstrap(ctx, state);
  ['RESEARCH', 'PLAN'].forEach((n) => H.configureRoutine(ctx, state, n));
  ctx.settingSet('tg_journey', 'on', 'test');   // the owner's /journey switch
  ctx.tgTripUpsert({ slug: TRIP, title: 'A week in two towns', destination: 'Fernmoor and Quillbay', start: DATES[0], end: DATES[6] });
  return { ctx, state };
}
const post = (ctx, state, upd) => ctx.doPost(H.postEvent('tg', { k: state.props[ctx.PROP.WEBHOOK_SECRET] }, upd));
const say = (ctx, state, text) => post(ctx, state, H.tgUpdate({ text }));
const sends = (state) => state.fetch.telegram('sendMessage').map((r) => r.json);
const texts = (state) => sends(state).map((m) => m.text);
const answers = (state) => state.fetch.telegram('answerCallbackQuery').map((r) => r.json.text);
const buttons = (m) => (m && m.reply_markup ? m.reply_markup.inline_keyboard.flat() : []);
const allData = (state) => sends(state).flatMap(buttons).map((b) => b.callback_data).filter(Boolean);
const reqOf = (state, kind) => (state.drive.listFiles('TourGuide/mailbox/to-brain') || []).filter((n) => /^req_/.test(n))
  .map((n) => JSON.parse(state.drive.readFile('TourGuide/mailbox/to-brain', n))).filter((r) => r.payload.kind === kind).map((r) => ({ id: r.id, ...r.payload }));
const app = (ctx, state, op, args) => H.appPost(ctx, state, 'app', { op, args });
const stage = (ctx) => ctx.flowActive('777') && ctx.flowActive('777').state.stage;
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
function gasErrors(ctx, type, payload) {
  const raw = JSON.stringify(H.envelope(type, payload));
  return J(ctx.validateEnvelope(raw, Buffer.byteLength(raw))).errors || [];
}
/** The research routine's shortlist: every item from the fixture, its town for an area, a Maps link from its place id. */
function shortlist(fx) {
  const byId = new Map([...fx.places, ...fx.dinners].map((p) => [p.id, p]));
  const snap = new Map(fx.snapshots.map((s) => [s.place_id, s.location]));
  const [home, away] = fx.trip.lodging, far = (a, b) => Math.hypot(a.lat - b.lat, a.lng - b.lng);
  const town = (at) => (Math.min(far(at, home), far(at, away)) > 0.1 ? 'Hollin' : far(at, home) <= far(at, away) ? 'Fernmoor' : 'Quillbay');
  const item = (slug, i) => {
    const p = byId.get(slug);
    return { n: i + 1, slug, name: p.name, why_you: 'Fits your pace and what you like to see.', fit: 0.8, est_minutes: 60, area: town(snap.get(p.place_id)),
      maps_url: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.name) + '&query_place_id=' + p.place_id, labels: ['verified'] };
  };
  return { v: 1, kind: 'shortlist', trip: TRIP, run_id: 'r1', round: 1, more: false, decided: [],
    groups: [{ id: 'activities', items: ACTIVITIES.map(item) }, { id: 'food', items: FOOD.map(item) }] };
}
/** One tap per shortlist item, in the order shown. */
function chooseAll(ctx, state) {
  const v = (slug) => (LATER.includes(slug) ? 'l' : SKIP.includes(slug) ? 's' : 'w');
  ACTIVITIES.forEach((slug, i) => tap(ctx, state, 'sl:r1:a' + (i + 1) + ':' + v(slug)));
  FOOD.forEach((slug, i) => tap(ctx, state, 'sl:r1:f' + (i + 1) + ':' + v(slug)));
}
/** The day card for day n of the trip, links reduced to <a>, one line per element. */
function card(ctx, state, n) {
  const before = texts(state).length;
  say(ctx, state, '/day ' + n);
  return texts(state).slice(before).join('\n').replace(/<a href="[^"]*">/g, '<a>').split('\n');
}
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ---------------- the journey through the core ---------------- */
test('the journey through the core: shortlist → three outlines → A with two days from B → versions chosen in the chat and the app → one plan request → the digest, the day cards and trip.digest', async () => {
  const schemas = await import('../packs/tour-guide/schemas/index.mjs');
  const b = await brain();
  const { ctx, state } = core();

  // The shortlist, Continue choosing, a tap on every item.
  const sl = shortlist(b.fx);
  assert.deepEqual(schemas.validatePayload('shortlist', sl).errors, []);
  assert.equal(deliver(ctx, state, 'shortlist', sl).processed, 1);
  tap(ctx, state, ctx.cbEncode('pl', 'sc', ctx.tgCmdTripKey(TRIP), 'r1', '0'));
  chooseAll(ctx, state);
  assert.equal(stage(ctx), 'choose');

  // ✅ Done choosing: a week asks for outlines, with every choice in the order it was made.
  press(ctx, state, '✅ Done choosing');
  assert.equal(stage(ctx), 'outline');
  assert.match(texts(state).pop(), /Sketching two or three outlines/);
  const [oq] = reqOf(state, 'outline');
  assert.deepEqual({ trip: oq.trip, dates: oq.dates, picks: oq.picks, later: oq.later, skip: oq.skip }, { trip: TRIP, dates: DATES, picks: PICKS, later: LATER, skip: SKIP });

  // The outline routine's answer: three ways to shape the week, each with what it gains and gives up, day by day.
  assert.equal(deliver(ctx, state, 'outline', b.draft.payload, { in_reply_to: oq.id }).processed, 1);
  const om = sends(state).pop();
  assert.match(om.text, /^🧭 <b>A week in two towns — 3 ways to shape the trip<\/b> · 7 days\n/);
  for (const o of b.draft.payload.options) assert.ok(om.text.includes('<b>' + o.key + ' · ' + o.title + '</b>\n➕ ' + o.gains + '\n➖ ' + o.gives_up), o.key);
  assert.match(om.text, /\n<b>1<\/b> Mon 8 Nov · A ● around Kestrel Hill Gardens · B ● day trip around Hollin Falls · C ● around Kestrel Hill Gardens\n/);
  assert.match(om.text, /\n<b>4<\/b> Thu 11 Nov · A ☔ indoors near Fernmoor Lodge · B ● around Kestrel Hill Gardens · C ☔ indoors near Fernmoor Lodge\n/);
  const tag = ctx.tgCmdTag(OUTLINE_BUILD);
  assert.deepEqual(buttons(om).map((x) => x.callback_data), [...['A', 'B', 'C'].map((k) => 'ol:' + TRIP + ':' + tag + ':' + k), 'ol:' + TRIP + ':d']);

  // ✅ A in the chat, then the app mixes in two days from B: the second versions request replaces the first.
  tap(ctx, state, 'ol:' + TRIP + ':' + tag + ':A', om.reply_markup);
  assert.equal(answers(state).pop(), '✅ Outline A');
  assert.equal(stage(ctx), 'versions');
  const [first] = reqOf(state, 'day_versions');
  assert.deepEqual(first.outline, { build_id: OUTLINE_BUILD, base: BASE });
  const c = app(ctx, state, 'outline.choose', { slug: TRIP, build_id: OUTLINE_BUILD, base: BASE, mix: MIX });
  assert.deepEqual([c.ok, c.via, c.choice], [true, 'flow', { base: BASE, mix: MIX }]);
  assert.match(texts(state).pop(), /^✅ Outline <b>A<\/b> · day 1 from B, day 4 from B\.\n🔀 Drafting two or three versions of each day/);
  const vq = reqOf(state, 'day_versions');
  assert.equal(vq.length, 2);
  assert.deepEqual({ id: vq[1].id, dates: vq[1].dates, outline: vq[1].outline, picks: vq[1].picks, later: vq[1].later, skip: vq[1].skip },
    { id: c.request_id, dates: DATES, outline: { build_id: OUTLINE_BUILD, base: BASE, mix: MIX }, picks: PICKS, later: LATER, skip: SKIP });
  assert.deepEqual(J(ctx.flowActive('777').state.dropped), [first.id], 'the first versions request counts as dropped');

  // The versions, one envelope per date in reply to that request: each date's card (buttons only where there is a
  // choice, version A marked •), then the offer to build.
  for (const date of DATES) assert.equal(deliver(ctx, state, 'day_versions', b.sets[date].payload, { in_reply_to: c.request_id }).processed, 1, date);
  const vm = sends(state).slice(-8);
  const dvtag = ctx.tgCmdTag(VERSIONS_BUILD);
  vm.slice(0, 7).forEach((m, i) => {
    const date = DATES[i], vs = b.sets[date].payload.versions;
    const head = vs.length === 1 ? 'one way to go, nothing to choose' : vs.length + ' versions';
    assert.ok(m.text.startsWith('🔀 <b>Day ' + (i + 1) + ' of 7 · ' + ['Mon 8', 'Tue 9', 'Wed 10', 'Thu 11', 'Fri 12', 'Sat 13', 'Sun 14'][i] + ' Nov</b> — ' + head + '\n'), date);
    assert.deepEqual(buttons(m).map((x) => x.callback_data), vs.length === 1 ? [] : vs.map((v) => 'dv:' + TRIP + ':' + dvtag + ':' + date.slice(5).replace('-', '') + ':' + v.key), date);
  });
  assert.match(vm[0].text, /<b>B · A slower day: Hollin Falls<\/b> — 1 stop, .*, dinner at Ember and Oak\n[\s\S]*<i>Leaves out: Hollin Pottery Village<\/i>/);
  assert.match(vm[1].text, /<b>A · Harbour Aquarium and Saltpan Lighthouse<\/b> — 2 stops, .*, dinner at Salt Lantern\n/);
  assert.match(vm[7].text, /^🧱 <b>A week in two towns<\/b> — every day has its versions\./);

  // Version C of the third day in the chat, B of the first in the app; the app sees both.
  tap(ctx, state, 'dv:' + TRIP + ':' + dvtag + ':1110:C');
  assert.equal(answers(state).pop(), "✅ C — Weavers' Museum, Old Town Quarter and 2 more");
  const ch = app(ctx, state, 'versions.choose', { slug: TRIP, build_id: VERSIONS_BUILD, date: '2027-11-08', key: 'B' });
  assert.deepEqual([ch.ok, ch.key, ch.have, ch.missing, ch.can_build], [true, 'B', 7, [], true]);
  const j = app(ctx, state, 'journey.get', { slug: TRIP });
  assert.deepEqual([j.stage, j.can_build, j.outline.choice, j.days.map((d) => d.versions && d.versions.key)], ['versions', true, { base: BASE, mix: MIX }, DATES.map(keyOf)]);

  // 🧱 Build my plan: one plan request with the choices, the outline and the version of every day.
  press(ctx, state, '🧱 Build my plan');
  assert.equal(answers(state).pop(), '🧱 Building your plan');
  assert.equal(stage(ctx), 'planning');
  assert.match(texts(state).pop(), /^🧭 Building the days from 21 picks and the version you chose for 7 days… One brochure follows\./);
  const pq = reqOf(state, 'plan');
  assert.equal(pq.length, 1);
  assert.deepEqual({ p: pq[0].picks, l: pq[0].later, s: pq[0].skip, d: pq[0].deliverables, o: pq[0].outline, v: pq[0].versions },
    { p: PICKS, l: LATER, s: SKIP, d: ['plan', 'notes', 'brochure'], o: { build_id: OUTLINE_BUILD, base: BASE, mix: MIX },
      v: DATES.map((date) => ({ date, build_id: VERSIONS_BUILD, key: keyOf(date) })) });

  // The plan routine answers with the digest of the plan it assembled: one envelope for the week, both validators. The
  // flow ends; the announcement lists the days and the Later list, the versions not chosen first.
  const dg = b.digest;
  assert.deepEqual(schemas.validatePayload('plan_digest', dg).errors, []);
  assert.deepEqual(gasErrors(ctx, 'plan_digest', dg), []);
  assert.ok(Buffer.byteLength(JSON.stringify(dg)) < 64 * 1024, 'one envelope carries the week');
  assert.equal(deliver(ctx, state, 'plan_digest', dg, { in_reply_to: pq[0].id }).processed, 1);
  assert.equal(ctx.flowActive('777'), null, 'the digest ends the flow');
  const ann = texts(state).pop();
  assert.match(ann, /^🗓 <b>A week in two towns<\/b> — 7 days · checked on 2027-10-25\n<b>1\.<\/b> Mon 8 Nov — Viewpoint <i>\(1 stop\)<\/i>\n/);
  assert.match(ann, /\n<b>7\.<\/b> Sun 14 Nov <i>\(0 stops\)<\/i>\n/, 'the free last day has no theme');
  const listed = ann.split('🔖 <b>Later</b>\n')[1].split('\n').map((l) => /^• (.+?) — <i>(.+)<\/i>$/.exec(l).slice(1));
  assert.deepEqual(listed, dg.later.map((l) => [l.name, l.reason]));
  assert.deepEqual(listed[0], ['Hollin Pottery Village', 'Hollin Pottery Village is in another version of 2027-11-08 that you did not choose']);

  // The day cards: the slower first day, dinner a short ride out on the second, the station start with the bags, the
  // station end of a free last day.
  ctx.settingSet(ctx.TG_SETTINGS.CURRENT_TRIP, TRIP, 'test');
  const c1 = card(ctx, state, 1);
  assert.equal(c1[0], '<b>Day 1 of 7 · Mon 8 Nov</b> — Viewpoint');
  assert.deepEqual(c1.filter((l) => /^<b>\d+\.<\/b>/.test(l)).map((l) => /<a>([^<]+)<\/a>/.exec(l)[1]), ['Hollin Falls']);
  assert.ok(c1.includes('🍽 ' + dg.days[0].dinner.start + ' Dinner at <a>Ember and Oak</a>'));
  const c2 = card(ctx, state, 2), [toDinner, back] = dg.days[1].legs.slice(-2);
  const at = c2.indexOf('🍽 18:30 Dinner at <a>Salt Lantern</a>');
  assert.ok(at > 0, 'dinner at Salt Lantern');
  assert.deepEqual([toDinner.from, toDinner.to, back.from, back.to], ['lodging', 'salt-lantern', 'salt-lantern', 'lodging']);
  assert.match(c2[at - 1], new RegExp('^   <i>↳ <a>walk ' + toDinner.minutes + ' min</a>'));
  assert.match(c2[at + 1], new RegExp('^   <i>↳ <a>walk ' + back.minutes + ' min</a> back to your lodging</i>$'));
  const c5 = card(ctx, state, 5);
  assert.deepEqual(c5.slice(0, 3), ['<b>Day 5 of 7 · Fri 12 Nov</b> — Market · Museum · Viewpoint',
    '🚩 Starts 12:30 at <a>Quillbay Station</a> · Leave your bags at Quillbay Inn before the first sight', '   <i>↳ <a>walk ' + dg.days[4].legs[0].minutes + ' min</a> to your lodging</i>']);
  assert.deepEqual(c5.filter((l) => /^<b>\d+\.<\/b>/.test(l)).map((l) => /<a>([^<]+)<\/a>/.exec(l)[1]), ['Pier Market', 'Quillbay Maritime Museum', 'Seawall Promenade']);
  assert.ok(c5.includes('⚠️ Pier Market closes at 14:00, only 7 min after your visit ends'));
  const c7 = card(ctx, state, 7);
  assert.deepEqual(c7.slice(0, 5), ['<b>Day 7 of 7 · Sun 14 Nov</b>', '🧳 Carry your bags today · Check out by 10:00', '   <i>↳ <a>walk ' + dg.days[6].legs[0].minutes + ' min</a></i>',
    '🏁 Ends 15:30 at <a>Quillbay Station</a>', '<i>A free day.</i>']);

  // The app reads the same stored week.
  const t = app(ctx, state, 'trip.digest', { slug: TRIP });
  assert.deepEqual([t.ok, t.trip.start, t.trip.end, t.trip.build_id, t.days.length], [true, DATES[0], DATES[6], PLAN_BUILD, 7]);
  assert.deepEqual(t.days.map((d) => d.stops.map((s) => s.slug)), dg.days.map((d) => d.stops.map((s) => s.slug)));
  assert.deepEqual([t.days[1].dinner, t.days[4].start, t.days[4].bags, t.days[6].end], [dg.days[1].dinner, dg.days[4].start, dg.days[4].bags, dg.days[6].end]);
  assert.deepEqual(t.later.map((l) => l.slug), dg.later.map((l) => l.slug));
  assert.ok(allData(state).every((d) => Buffer.byteLength(d) <= 64), 'every button fits Telegram');
});

/* ---------------- the brain's side (WP-11e), against WP-11f's schemas ---------------- */
test("the brain: three outlines that place every pick or name the ones left out, A with B's two days keeping their areas and anchors, versions that hold the anchors or are the slower day, one plan from the chosen keys with the rest on Later", async () => {
  const schemas = await import('../packs/tour-guide/schemas/index.mjs');
  const journey = await import('../packs/tour-guide/journey/index.mjs');
  const planner = await import('../packs/tour-guide/planner/index.mjs');
  const b = await brain();
  const { ctx } = core();
  /** One payload through the three checks: WP-11f's node schema (with its checks), the journey's own and the core's. */
  const sound = (type, payload, own) => {
    assert.deepEqual(schemas.validatePayload(type, J(payload)).errors, [], type + ': node schema');
    assert.deepEqual(own, [], type + ': journey checks');
    assert.deepEqual(gasErrors(ctx, type, J(payload)), [], type + ': the core');
  };

  // Three outlines over the same seven dates; the moving day and the last day are travel days in each.
  const ol = b.draft.payload;
  sound('outline', ol, journey.checkOutline(ol, b.fx.trip));
  assert.deepEqual(ol.options.map((o) => o.key), ['A', 'B', 'C']);
  const kinds = (o) => o.days.map((d) => d.kind);
  for (const o of ol.options) assert.deepEqual(o.days.map((d) => d.date), DATES);
  assert.deepEqual(ol.options.map(kinds), [
    ['full', 'full', 'full', 'rain_spare', 'travel', 'full', 'travel'],
    ['full', 'full', 'full', 'full', 'travel', 'full', 'travel'],
    ['full', 'full', 'full', 'rain_spare', 'travel', 'full', 'travel']]);
  // A and C keep a spare day for rain and leave out the day trip, and say which picks that leaves out; B places them all.
  const left = {};
  for (const o of ol.options) {
    const pools = await planner.outlinePools({ ...b.input, build_id: VERSIONS_BUILD, outline: journey.outlineInput(b.draft, { base: o.key }) });
    left[o.key] = pools.unplaced.map((u) => u.cand.id).sort();
  }
  assert.deepEqual(left, { A: ['hollin-falls', 'hollin-pottery-village'], B: [], C: ['hollin-falls', 'hollin-pottery-village'] });
  const [A, B, C] = ol.options;
  for (const o of [A, C]) assert.match(o.gives_up, /^Leaves out your picks Hollin Falls and Hollin Pottery Village\./);
  assert.doesNotMatch(B.gives_up, /Leaves out/);
  assert.deepEqual([B.days[0].area, B.days[0].anchors.map((a) => a.slug)], ['day trip around Hollin Falls', ['hollin-falls', 'hollin-pottery-village']]);

  // The mix: A's week with B's first and fourth days, their areas and anchors; no place is anchored twice; the booked
  // dinner anchors its own date.
  const by = b.outline.by_date;
  assert.deepEqual(DATES.map((d) => by[d].kind), ['full', 'full', 'full', 'full', 'travel', 'full', 'travel']);
  assert.deepEqual([by['2027-11-08'].area.name, by['2027-11-08'].anchors], ['day trip around Hollin Falls', ['hollin-falls', 'hollin-pottery-village']]);
  assert.deepEqual([by['2027-11-11'].area.name, by['2027-11-11'].anchors], ['around Kestrel Hill Gardens', ['kestrel-hill-gardens']]);
  const anchored = DATES.flatMap((d) => by[d].anchors || []);
  assert.equal(new Set(anchored).size, anchored.length, 'each anchor on one date');
  assert.ok(by['2027-11-13'].anchors.includes('driftwood-kitchen'));

  // Versions: two or three where the day has room for a real choice, else one with the reason. Each card shows its own
  // stops and the day's other picks it leaves out; each version is a sound day that holds the day's anchors, or is the
  // slower day (fewer stops, at least an hour more spare, naming what it drops).
  assert.deepEqual(DATES.map((d) => b.sets[d].versions.length), [2, 1, 3, 1, 2, 1, 1]);
  const whole = (card) => [...card.stops.map((s) => s.slug), ...card.leaves_out.map((x) => x.slug)].sort();
  for (const date of DATES) {
    const set = b.sets[date], p = set.payload, first = set.versions[0];
    sound('day_versions', p, journey.checkDayVersions(p));
    assert.deepEqual([p.date, first.key, !!first.pace], [date, 'A', false]);
    assert.equal(set.reason === 'only one way to plan this day', set.versions.length === 1, date + ': the reason goes with a single version');
    for (const v of set.versions) {
      const card = p.versions.find((x) => x.key === v.key), what = date + ' ' + v.key;
      assert.deepEqual(schemas.validate(v.day, 'day-plan').errors, [], what + ': a sound day');
      assert.deepEqual(card.stops.map((s) => s.slug), stopsOf(v.day), what + ': the card shows its own stops');
      assert.deepEqual(whole(card), whole(p.versions[0]), what + ': the same picks, placed or left out');
      if (v.pace) {
        assert.match(card.title, /^A slower day: /);
        assert.ok(card.spare_minutes >= p.versions[0].spare_minutes + journey.PACE.GAIN, what + ': at least PACE.GAIN more spare');
        assert.deepEqual(card.leaves_out.map((x) => x.slug).sort(), stopsOf(first.day).filter((s) => !stopsOf(v.day).includes(s)).sort());
      } else assert.ok(set.anchors.every((s) => stopsOf(v.day).includes(s)), what + ': holds the anchors');
    }
  }
  assert.deepEqual(DATES.flatMap((d) => b.sets[d].versions.filter((v) => v.pace).map((v) => d + ' ' + v.key)), ['2027-11-08 B', '2027-11-12 B']);

  // The plan: each day is the chosen version's day; the dinners where the versions put them; the moving day starts at the
  // station with the bags going ahead, the last day ends there with the bags carried.
  const plan = b.plan;
  assert.deepEqual(schemas.validate(plan, 'plan').errors, []);
  assert.equal(plan.build_id, PLAN_BUILD);
  for (const d of plan.days) assert.deepEqual(stopsOf(d), stopsOf(b.sets[d.date].versions.find((v) => v.key === keyOf(d.date)).day), d.date);
  assert.deepEqual(plan.days.map((d) => (dinnerOf(d) || {}).at || null), ['ember-and-oak', 'salt-lantern', 'lodging', 'lodging', 'lodging', 'driftwood-kitchen', null]);
  const d12 = plan.days[4], d14 = plan.days[6];
  assert.deepEqual([d12.start, d12.bags.kind, d12.legs[0].from, d12.legs[0].to], [{ name: 'Quillbay Station', time: '12:30' }, 'hotel', 'day-start', 'lodging']);
  assert.deepEqual([d14.stops.length, d14.end, d14.bags.kind, d14.legs.at(-1).to], [0, { name: 'Quillbay Station', time: '15:30' }, 'carry', 'day-end']);

  // Later: what the versions not chosen had, by date; then the owner's own lists. Every pick is on a day or on Later; the
  // skipped place is nowhere.
  assert.deepEqual(plan.later.map((l) => l.name), ["Didn't fit", 'Next time', 'Saved by you']);
  assert.deepEqual(plan.later[0].items.map((i) => [i.place, i.reason]), [
    ['hollin-pottery-village', 'Hollin Pottery Village is in another version of 2027-11-08 that you did not choose'],
    ['clockmakers-row', "Clockmakers' Row is in another version of 2027-11-10 that you did not choose"],
    ['printworks-gallery', 'Printworks Gallery is in another version of 2027-11-10 that you did not choose'],
    ['tidewater-baths', 'Tidewater Baths is in another version of 2027-11-10 that you did not choose'],
    ['lantern-bridge', 'Lantern Bridge is in another version of 2027-11-10 that you did not choose']]);
  assert.deepEqual(plan.later[2].items.map((i) => i.place), LATER);
  const placed = new Set(plan.days.flatMap((d) => [...stopsOf(d), ...(d.meals || []).map((x) => x.at)]));
  const saved = new Set(plan.later.flatMap((l) => l.items.map((i) => i.place)));
  assert.deepEqual(PICKS.filter((s) => !placed.has(s) && !saved.has(s)), [], 'every pick is on a day or on Later');
  assert.ok(SKIP.every((s) => !placed.has(s) && !saved.has(s)));
  assert.deepEqual(plan.choices, { picks: [...PICKS].sort(), later: [...LATER].sort(), skip: [...SKIP].sort() });

  // The versions not chosen stay as alternatives, ready for a later switch; nothing needed a note.
  assert.deepEqual(Object.fromEntries(Object.entries(b.alternatives).map(([d, xs]) => [d, xs.map((x) => x.key)])), { '2027-11-08': ['A'], '2027-11-10': ['A', 'B'], '2027-11-12': ['B'] });
  for (const [d, xs] of Object.entries(b.alternatives)) for (const x of xs) {
    const v = b.sets[d].versions.find((y) => y.key === x.key);
    assert.deepEqual([x.summary.title, stopsOf(x.day)], [b.sets[d].payload.versions.find((y) => y.key === x.key).title, stopsOf(v.day)], d + ' ' + x.key);
  }
  assert.deepEqual(b.notes, []);
});

/* ---------------- one brochure for the chosen mix (WP-11d) ---------------- */
test('one brochure for the chosen mix: the chosen days, the moving day\'s start and bag step, the dinners, the last day on the Free days line with its end, and the versions not chosen on Later', async () => {
  const bm = await import('../packs/tour-guide/brochure-map/index.mjs');
  const kit = await import('../kits/brochure/index.mjs');
  const { fx, plan } = await brain();
  const args = () => ({ trip: J(fx.trip), plan: J(plan), notes: fx.notes, snapshots: fx.snapshots, estimates: fx.estimates, options: { now: NOW, diet: DIET } });
  const m = bm.toBrochureModel(args());
  assert.deepEqual(kit.validate(m), []);
  assert.deepEqual(kit.semanticErrors(m), []);
  // A page for every day with a stop, each with the chosen version's stops.
  const busy = plan.days.filter((d) => d.stops.length);
  assert.deepEqual(m.days.map((d) => d.date), DATES.slice(0, 6));
  m.days.forEach((d, i) => assert.deepEqual(d.stops.map((s) => s.place), stopsOf(busy[i]), d.date));
  assert.deepEqual(m.days.map((d) => ((d.meals || []).find((x) => x.kind === 'dinner') || {}).place || null), ['ember-and-oak', 'salt-lantern', null, null, null, 'driftwood-kitchen']);
  const d5 = m.days[4];
  assert.deepEqual([d5.start.name, d5.start.time, d5.start.note, d5.bags.kind, d5.legs[0].from], ['Quillbay Station', '12:30', 'Morning train from Fernmoor.', 'hotel', 'day-start']);
  // The last day has no stop, so it is a Free days line — with its bag step, its free time and where and when it ends.
  const [free] = m.practical.find((s) => s.title === 'Free days').items;
  assert.deepEqual([free.label, free.text], ['2027-11-14', 'Carry your bags today · Check out by 10:00. Free time before lunch; time to spare near Quillbay Station before 15:30. Ends 15:30 at Quillbay Station.']);
  assert.match(free.url, /^https:\/\/www\.google\.com\/maps\/.*query_place_id=FixtureJyQuillbayStation/);
  // Later: the versions not chosen, then the owner's own lists.
  assert.deepEqual(m.later.map((l) => [l.name, l.items.map((i) => i.place)]), [
    ["Didn't fit", ['hollin-pottery-village', 'clockmakers-row', 'printworks-gallery', 'tidewater-baths', 'lantern-bridge']],
    ['Next time', ['lamplighters-workshop']], ['Saved by you', ['old-town-market', 'pine-hearth']]]);
  const { html, warnings } = bm.renderPlan(args(), { embedFonts: false });
  assert.deepEqual(warnings, []);
  for (const s of ['Start</span> · Quillbay Station', 'Leave your bags at Quillbay Inn', 'Dinner</span> · Ember and Oak', 'Dinner</span> · Salt Lantern',
    'Dinner</span> · Driftwood Kitchen', 'Carry your bags today', 'Ends 15:30 at Quillbay Station', 'Hollin Pottery Village is in another version of 2027-11-08 that you did not choose']) assert.ok(html.includes(s), s);
  assert.doesNotMatch(html, /<script|href="http:/i);
});

// Developed by: LightAISolutions
