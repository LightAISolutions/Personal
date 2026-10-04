'use strict';
// TG-PHASE-13 coordinator, probe P: one invented trip through the planner, the shared digest harness and the core. Four
// days with two stays and a departure on the last day too early to fit; day 2 has a booking at its edge; the trip also has
// a place whose opening days vary and a dinner place whose menu was never checked. Then the second stay changes: the stale
// line, the re-plan offer, a one-day re-plan that leaves the line, and the offer's re-plan that clears it. Last, Scout's
// request text from the chat and from the app. Everything is invented: the "two-stays" fixture trimmed to four days, with
// an airport and its train line added here; the fixture files are not changed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');
const { digestOf, inParts } = require('./harness/tour-guide-digest');

const J = (v) => JSON.parse(JSON.stringify(v));
const NOW = '2027-10-20T01:00:00Z';                     // before the trip: every stored day is still to come
const [D1, D2, D3, D4] = ['2027-11-11', '2027-11-12', '2027-11-13', '2027-11-14'];
const AIRPORT = { name: 'Quillbay Airport', place_id: 'FixtureP13Airport', lat: 20.766, lng: 135.2 };
const CLOSED_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((d) => d + ': Closed');

let mods = null;
async function libs() {
  if (!mods) {
    mods = {
      fixtures: await import('../packs/tour-guide/fixtures/index.mjs'),
      maps: await import('../kits/maps/index.mjs'),
      planner: await import('../packs/tour-guide/planner/index.mjs'),
      schemas: await import('../packs/tour-guide/schemas/index.mjs'),
      scout: await import('../packs/tour-guide/scout/index.mjs'),
      subset: await import('../kits/brochure/lib/validate.mjs')
    };
  }
  return mods;
}

/* ---------------- The planner ---------------- */
/**
 * The probe's trip: "two-stays" cut to 11–14 Nov (Fernmoor one night, then Quillbay to check-out on the 14th); the last
 * day ends at an airport at 11:30 that a 110-minute train reaches five minutes too late; no season events before the
 * trip; Seawall Promenade booked on day 2 at 17:30, after the day's usual end; a museum whose own site says its opening
 * days vary while Google lists it as closed every day; a dinner place whose menu was never checked; a vegetarian party.
 */
async function probeInput() {
  const { fixtures, maps } = await libs();
  const fx = fixtures.loadFixture('two-stays');
  const t = fx.trip;
  t.start_date = D1; t.end_date = D4;
  t.lodging[0].from = D1; t.lodging[0].to = D2; t.lodging[1].to = D4;
  t.day_overrides = t.day_overrides.map((o) => (o.date === D4 ? { ...o, end: { ...AIRPORT, time: '11:30' } } : o));
  const station = fx.snapshots.find((s) => s.place_id === 'FixtureJyQuillbayStation');
  fx.snapshots.push({ ...J(station), place_id: AIRPORT.place_id, location: { lat: AIRPORT.lat, lng: AIRPORT.lng } });
  fx.routes.modes.TRANSIT['FixtureJyQuillbayInn|FixtureP13Airport'] = { duration_sec: 6600, distance_m: 24000, line: 'Quillbay Airport Line' };
  t.season.events = t.season.events.filter((e) => e.to >= t.start_date);
  const place = (id) => fx.places.find((p) => p.id === id);
  delete place('harbour-aquarium').booking;
  place('seawall-promenade').booking = { date: D2, time: '17:30', ref: 'FIXTURE-P13-1112' };
  const museum = place('quillbay-maritime-museum');
  museum.facts = { checked: '2027-10-15', sources: [{ url: 'https://maritime.example.org/visit', title: 'Visit', accessed: '2027-10-15' }],
    irregular: true, irregular_note: 'Opening days are posted each month' };
  const ms = fx.snapshots.find((s) => s.place_id === museum.place_id);
  ms.content = { ...ms.content, hours: { periods: [], weekday_descriptions: CLOSED_WEEK }, current_hours: null };
  delete fx.dinners.find((d) => d.id === 'pine-hearth').facts.menu;
  fx.profile.diet = 'vegetarian';
  const client = maps.createMapsClient({ transport: maps.createMockTransport(fixtures.createFixtureResponder(fx)), ledger: maps.createLedger() });
  return { fx, client };
}
let planned = null;
/** The probe's plan, built once and shared by every test: { fx, plan }. */
async function probePlan() {
  if (!planned) {
    const { planner } = await libs();
    const { fx, client } = await probeInput();
    planned = { fx, plan: await planner.planTrip({ ...fx, maps: client, build_id: 'p13-probe-1', now: NOW, seed: 7 }) };
  }
  return planned;
}

test('probe P, planner: the departure day builds empty with its fix, the edge booking holds, the varying place and the unchecked menu are named', async () => {
  const L = await libs();
  const { plan } = await probePlan();
  assert.deepEqual(plan.days.map((d) => d.date), [D1, D2, D3, D4]);
  for (const d of plan.days) {
    assert.deepEqual(L.subset.validate(d, L.schemas.loadSchema('day-plan')), [], `${d.date}: the day-plan schema accepts it`);
    assert.deepEqual(L.planner.checkDayChain(d), [], `${d.date}: chain and timeline hold`);
    assert.ok(!d.warnings.some((w) => /facts are old/.test(w.text)), `${d.date}: facts checked five days before the build are not old`);
  }
  // Day 4: even an empty day cannot reach the airport by 11:20 — the plan says so and names the fix.
  const d4 = plan.days[3];
  assert.deepEqual(d4.stops, []);
  assert.deepEqual(d4.legs.map((l) => [l.from, l.to, l.mode, l.minutes, l.line]), [['lodging', 'day-end', 'TRANSIT', 110, 'Quillbay Airport Line']]);
  assert.deepEqual(d4.warnings, [{ severity: 'alert', code: 'over_long_day',
    text: 'Reaches Quillbay Airport at 11:25, 5 min after the 11:20 needed for 11:30. Start earlier: /dates 2027-11-14 hours 08:55 11:30' }]);
  assert.deepEqual([d4.leave_by, d4.end.name, d4.end.time], ['09:35', 'Quillbay Airport', '11:30']);
  assert.deepEqual(['kind', 'text'].map((k) => d4.bags[k]), ['carry', 'Carry your bags today · Check out by 10:00']);
  // Day 2: the moving day starts at the station; the 17:30 booking widens the day; the museum and the dinner carry notes.
  const d2 = plan.days[1];
  const stop = (id) => d2.stops.find((s) => s.place === id);
  assert.deepEqual(['arrive', 'depart', 'booked', 'time_style'].map((k) => stop('seawall-promenade')[k]), ['17:30', '18:10', 'FIXTURE-P13-1112 (17:30)', 'exact']);
  assert.deepEqual(['time_style', 'check_on_day'].map((k) => stop('quillbay-maritime-museum')[k]), ['about', 'Opening days are posted each month']);
  const dinner = [].concat(d2.meals).find((m) => m.kind === 'dinner');
  assert.deepEqual(['start', 'end', 'at', 'note'].map((k) => dinner[k]), ['18:30', '19:30', 'pine-hearth', 'Pine Hearth · menu not checked for vegetarian']);
  const has = (code, text) => d2.warnings.some((w) => w.severity === 'info' && w.code === code && w.text === text);
  assert.ok(has('other', 'Day hours widened to 12:30–18:22 to hold your booking at Seawall Promenade'), JSON.stringify(d2.warnings));
  assert.ok(has('hours_unknown', 'Quillbay Maritime Museum: opening days vary, check before you go'), JSON.stringify(d2.warnings));
  assert.deepEqual([d2.leave_by, d2.start.name, d2.start.time], ['12:30', 'Quillbay Station', '12:30']);
  assert.deepEqual(['kind', 'text'].map((k) => d2.bags[k]), ['hotel', 'Leave your bags at Quillbay Inn before the first sight']);
});

/* ---------------- The core: the stored plan, its cards and mornings, then a stay change ---------------- */
const TRIP = 'fernmoor-quillbay-2027';
const STALE = '⚠️ This plan was built for different lodging. <code>/lodging</code> offers to re-plan the days that changed or to keep the plan.';
/** An independent FNV-1a 32 over Node's own UTF-8, as C13's fingerprint. */
function refFp(str) {
  let h = 0x811c9dc5n;
  for (const b of Buffer.from(str, 'utf8')) h = ((h ^ BigInt(b)) * 0x01000193n) & 0xffffffffn;
  return 'lfp1:' + h.toString(16).padStart(8, '0');
}
const kb = (m) => (m && m.reply_markup ? m.reply_markup.inline_keyboard.flat().map((b) => b.callback_data) : []);
/** A fresh core with the trip pinned (zone UTC+9) and chat helpers. */
function core() {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: NOW });
  H.bootstrap(ctx, state);
  ['RESEARCH', 'PLAN', 'PREFS', 'NOTES', 'BROCHURE', 'PLACES', 'SCOUT'].forEach((n) => H.configureRoutine(ctx, state, n));
  ctx.tgTripUpsert({ slug: TRIP, title: 'Fernmoor and Quillbay', destination: 'Quillbay', start: D1, end: D4, tz: 'Etc/GMT-9' });
  ctx.settingSet(ctx.TG_SETTINGS.CURRENT_TRIP, TRIP, 'test');
  const post = (upd) => ctx.doPost(H.postEvent('tg', { k: state.props[ctx.PROP.WEBHOOK_SECRET] }, upd));
  const reqs = (kind) => (state.drive.listFiles('TourGuide/mailbox/to-brain') || []).filter((n) => /^req_/.test(n))
    .map((n) => JSON.parse(state.drive.readFile('TourGuide/mailbox/to-brain', n))).filter((e) => e.payload.kind === kind);
  return {
    ctx, state, reqs,
    /** Send a chat message; the core's newest message back. */
    say: (text) => { post(H.tgUpdate({ text })); return state.fetch.telegram('sendMessage').map((r) => r.json).pop(); },
    tap: (data) => post(H.tgUpdate({ callback: data, messageId: 91 })),
    lastEdit: () => state.fetch.telegram('editMessageText').map((r) => r.json.text).pop(),
    /** Run `fn` and return the one `kind` request it opened. */
    opened: (kind, fn) => {
      const before = new Set(reqs(kind).map((e) => e.id));
      fn();
      const added = reqs(kind).filter((e) => !before.has(e.id));
      assert.equal(added.length, 1, 'one ' + kind + ' request');
      return added[0];
    },
    deliver: (payload, inReplyTo) => { H.putEnvelope(state, { ...H.envelope('plan_digest', payload), in_reply_to: inReplyTo }); return J(ctx.pollFromBrain()); },
    morning: (date) => J(ctx.tgMorningMessages(ctx.tgTripGet(TRIP), ctx.tgDigestDay(TRIP, date), 4, null, false)),
    planRecord: () => JSON.parse(ctx.settingGet('tg_plan_lodging', '{}'))[TRIP]
  };
}
/** A core holding the two stays and the probe's plan, delivered in two parts that answer its plan request. */
async function storedPlan() {
  const { schemas } = await libs();
  const { fx, plan } = await probePlan();
  assert.equal(fx.trip.id, TRIP);
  const c = core();
  c.say('/lodging Fernmoor Lodge 2027-11-11 to 2027-11-12');
  c.say('/lodging Quillbay Inn 2027-11-12 to 2027-11-14');
  const fp1 = c.ctx.tgLgFp(c.ctx.tgTripGet(TRIP));
  const req = c.opened('plan', () => c.ctx.tgOpenKindRequest('plan', { trip: TRIP }, { ack: false }));
  const base = await digestOf(plan, fx.trip, { now: NOW, diet: 'vegetarian' });
  const parts = inParts({ ...base, lodging_fp: req.payload.lodging_fp }, 2);
  const results = parts.map((p) => {
    const raw = JSON.stringify(H.envelope('plan_digest', p));
    return { node: schemas.validatePayload('plan_digest', p).errors, gas: J(c.ctx.validateEnvelope(raw, Buffer.byteLength(raw))).errors || [],
      poll: c.deliver(p, req.id) };
  });
  return { c, fp1, req, base, parts, results };
}

test('probe P, core: the plan arrives in two parts for the stays it was built for; the cards and mornings show the start, the edge booking, the departure and both notes', async () => {
  const { c, fp1, req, parts, results } = await storedPlan();
  assert.equal(fp1, refFp('2027-11-11|2027-11-12|fernmoor lodge\n2027-11-12|2027-11-14|quillbay inn'));
  assert.equal(fp1, 'lfp1:fa250055');
  assert.equal(req.payload.lodging_fp, fp1);
  assert.deepEqual(req.payload.trip_update.lodging, [{ text: 'Fernmoor Lodge', from: D1, to: D2 }, { text: 'Quillbay Inn', from: D2, to: D4 }]);
  assert.equal(parts.length, 2);
  results.forEach((r, i) => {
    assert.deepEqual([r.node, r.gas], [[], []], 'part ' + (i + 1) + ' passes both validators');
    assert.equal(r.poll.processed, 1, JSON.stringify(r.poll));
  });
  assert.equal(J(c.ctx.tgDigestDays(TRIP)).length, 4);
  assert.equal(c.planRecord().fp, fp1);
  assert.ok(!c.say('/trip').text.includes(STALE), 'built for the stays as they are');

  const card2 = c.say('/day 2').text.split('\n');
  assert.equal(card2[1], '🚩 Starts 12:30 at <a href="https://www.google.com/maps/place/?q=place_id:FixtureJyQuillbayStation">Quillbay Station</a> · Leave your bags at Quillbay Inn before the first sight');
  assert.ok(card2.includes('   🕑 <i>Opening days are posted each month</i>'), card2.join('\n'));
  assert.ok(card2.some((l) => /^<b>2\.<\/b> 17:30–18:10 <a [^>]+>Seawall Promenade<\/a> · 40 min/.test(l)), 'the booking keeps its exact time');
  assert.ok(card2.includes('   <i>Menu not checked for vegetarian</i>'));
  const card4 = c.say('/day 4').text;
  for (const s of ['🧳 Carry your bags today · Check out by 10:00', 'transit 1 h 50 min', '<i>A free day.</i>']) assert.ok(card4.includes(s), s + '\n' + card4);
  assert.match(card4, /🏁 Ends 11:30 at <a [^>]+>Quillbay Airport<\/a>/);
  assert.match(card4, /⚠️[^\n]*Reaches Quillbay Airport at 11:25, 5 min after the 11:20 needed for 11:30\. Start earlier: \/dates 2027-11-14 hours 08:55 11:30/);

  const m2 = c.morning(D2).map((m) => m.html).join('\n').split('\n');
  for (const s of ['☀️ <b>Fri 12 Nov · Day 2 of 4</b>', '<i>Museum · Viewpoint</i>', '<b>Today</b>', '<b>1.</b> about 14:15 <b>Quillbay Maritime Museum</b>',
    '   🕑 <i>Opening days are posted each month</i>', '<b>2.</b> 17:30–18:10 <b>Seawall Promenade</b>', '🍽 18:30 Dinner at <b>Pine Hearth</b>',
    '   <i>Menu not checked for vegetarian</i>', '🌅 Sunset 17:20']) assert.ok(m2.includes(s), s + '\n' + m2.join('\n'));
  assert.ok(m2.some((l) => /^🚩 Starts 12:30 at /.test(l)), 'a moving day names its start');
  assert.ok(!m2.some((l) => /Leave by/.test(l)), 'not "Leave by" when the day starts somewhere else');
  const m4 = c.morning(D4);
  const m4lines = m4.map((m) => m.html).join('\n').split('\n');
  for (const s of ['☀️ <b>Sun 14 Nov · Day 4 of 4</b>', '🚪 <b>Leave by 09:35</b>', '🧳 Carry your bags today · Check out by 10:00', '🚆 <b>Trains</b>',
    '• To Quillbay Airport: use the <a href="https://www.google.com/maps/dir/?api=1&amp;origin=Quillbay%20Inn&amp;origin_place_id=FixtureJyQuillbayInn&amp;destination=Quillbay%20Airport&amp;destination_place_id=FixtureP13Airport&amp;travelmode=transit">route link</a>',
    '<b>Free day.</b>']) assert.ok(m4lines.includes(s), s + '\n' + m4lines.join('\n'));
  assert.ok(m4lines.some((l) => /^🏁 Ends 11:30 at /.test(l)) && m4lines.some((l) => /Reaches Quillbay Airport at 11:25/.test(l)));
  assert.ok(m4lines.indexOf('<b>Free day.</b>') > m4lines.indexOf('🚆 <b>Trains</b>'), 'the departure facts come before "Free day."');
  assert.ok(m4.every((m) => !m.keyboard), 'no stop buttons on a day without stops');
});

test('probe P, core: a changed stay shows the line and the offer; a one-day re-plan leaves the line, the offer\'s re-plan of every touched day clears it', async () => {
  const { c, fp1, base } = await storedPlan();
  const tk = c.ctx.tgCmdTripKey(TRIP);
  const offer = c.say('/lodging Tidewater House 2027-11-12 to 2027-11-14');
  const fp2 = c.ctx.tgLgFp(c.ctx.tgTripGet(TRIP));
  assert.equal(fp2, refFp('2027-11-11|2027-11-12|fernmoor lodge\n2027-11-12|2027-11-14|tidewater house'));
  assert.match(offer.text, /re-plan 3 days from Fri 12 Nov\?$/);
  assert.deepEqual(kb(offer), ['lg:' + tk + ':20271112', 'lg:' + tk + ':k']);
  // The line in /trip, on the day card right under its header and in the morning message; /lodging alone repeats the offer.
  assert.ok(c.say('/trip').text.includes(STALE));
  assert.equal(c.say('/day 2').text.split('\n')[1], STALE);
  assert.ok(c.morning(D2).map((m) => m.html).join('\n').includes(STALE));
  const again = c.say('/lodging');
  assert.match(again.text, /^🏨 <b>Stays for Fernmoor and Quillbay<\/b>\n[\s\S]*re-plan 3 days from Fri 12 Nov\?$/);
  assert.deepEqual(kb(again), kb(offer));
  // A one-day /replan carries the stored plan's own fingerprint: 13 and 14 Nov still start or end at the old stay.
  const one = c.opened('replan', () => c.say('/replan 2027-11-12 the new stay'));
  assert.deepEqual([one.payload.dates, one.payload.lodging_fp], [[D2], fp1]);
  assert.equal(c.deliver({ ...base, build_id: 'p13-probe-2', lodging_fp: one.payload.lodging_fp }, one.id).processed, 1);
  assert.ok(c.say('/day 2').text.includes(STALE), 'the line stays until every touched day is rebuilt or the plan is kept');
  // The offer's re-plan: every stored day from the 12th, for the new stays; its digest clears the line.
  const all = c.opened('replan', () => c.tap('lg:' + tk + ':20271112'));
  assert.deepEqual([all.payload.dates, all.payload.lodging_fp], [[D2, D3, D4], fp2]);
  assert.match(c.lastEdit(), /\n🔁 Re-planning 3 days from Fri 12 Nov for the new lodging\./);
  assert.equal(c.deliver({ ...base, build_id: 'p13-probe-3', lodging_fp: all.payload.lodging_fp }, all.id).processed, 1);
  assert.ok(!c.say('/trip').text.includes(STALE));
  assert.ok(!c.say('/day 2').text.includes(STALE));
  assert.ok(!c.morning(D2).map((m) => m.html).join('\n').includes(STALE));
  assert.equal(c.planRecord().fp, fp2);
  assert.deepEqual(kb(c.say('/lodging')), [], 'nothing waits any more');
});

/* ---------------- Scout: the owner's words go out as typed; the routine's parser reads the town from them ---------------- */
test('probe P, Scout: the chat and the app request texts, and the town, area and queries the routine reads from them', async () => {
  const { scout } = await libs();
  const c = core();
  const chatText = '/scout tea houses near Old Pier, Quillbay';
  c.say(chatText);
  const app = J(H.appPost(c.ctx, c.state, 'app', { op: 'scout.new', args: { query: 'tea houses' } }));
  assert.equal(app.ok, true, JSON.stringify(app));
  assert.deepEqual(c.reqs('scout').map((e) => e.payload.text).sort(), ['/scout tea houses in Quillbay', chatText],
    'the chat words as typed; the app\'s blank where resolved to the trip');
  const chat = scout.parseScoutText(chatText);
  assert.deepEqual(chat, { what: 'tea houses', where: 'Old Pier, Quillbay', city: 'Quillbay', area: 'Old Pier' });
  const fromApp = scout.parseScoutText('/scout tea houses in Quillbay');
  assert.deepEqual(fromApp, { what: 'tea houses', where: 'Quillbay', city: 'Quillbay', area: '' });
  assert.deepEqual(scout.scoutQueries({ what: chat.what, where: chat.where, diet: 'vegetarian' }),
    ['tea houses in Old Pier, Quillbay', 'tea houses cafe Old Pier, Quillbay', 'vegetarian tea houses Old Pier, Quillbay']);
  assert.deepEqual(scout.scoutQueries({ what: fromApp.what, where: fromApp.where, diet: 'vegetarian' }),
    ['tea houses in Quillbay', 'tea houses cafe Quillbay', 'vegetarian tea houses Quillbay']);
});

// Developed by: LightAISolutions
