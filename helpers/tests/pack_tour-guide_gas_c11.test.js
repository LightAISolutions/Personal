'use strict';
// Tour Guide pack — WP-11c (Contract C11): the C11 digest fields in the GAS validator and the DayPlans tab, plans in
// parts (23_plan_parts.js), the day card's moving-day lines, "local favourite", trip.digest and the /dates per-day forms.
// Every trip, place, date and id is invented ("Reed Harbour", June 2027).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');

const NOW = '2027-06-01T16:00:00Z';
const TRIP = 'reed-harbour';
const J = (v) => JSON.parse(JSON.stringify(v));
const maps = (id) => 'https://www.google.com/maps/search/?api=1&query=Fixture&query_place_id=' + id;

function fresh() {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: NOW });
  H.bootstrap(ctx, state);
  ['RESEARCH', 'PLAN', 'PREFS', 'NOTES', 'BROCHURE', 'PLACES'].forEach((n) => H.configureRoutine(ctx, state, n));
  ctx.tgTripUpsert({ slug: TRIP, title: 'Reed Harbour', destination: 'Reed Harbour' });
  return { ctx, state };
}
const post = (ctx, state, upd) => ctx.doPost(H.postEvent('tg', { k: state.props[ctx.PROP.WEBHOOK_SECRET] }, upd));
const say = (ctx, state, text) => post(ctx, state, H.tgUpdate({ text }));
const sends = (state) => state.fetch.telegram('sendMessage').map((r) => r.json);
const texts = (state) => sends(state).map((m) => m.text);
const last = (state) => texts(state).pop();
const audits = (ctx, ev) => J(ctx.storeAll('AuditLog')).filter((a) => a.event === ev);
const staged = (ctx) => (ctx.tgPartsHasTab() ? J(ctx.storeAll('DigestParts')) : []);
const reqEnvs = (state) => (state.drive.listFiles('TourGuide/mailbox/to-brain') || []).filter((n) => /^req_/.test(n))
  .map((n) => JSON.parse(state.drive.readFile('TourGuide/mailbox/to-brain', n)));
const reqOf = (state, kind) => reqEnvs(state).map((e) => e.payload).filter((r) => r.kind === kind);
function deliver(ctx, state, type, payload, over) {
  H.putEnvelope(state, H.envelope(type, payload, over));
  return J(ctx.pollFromBrain());
}

/** A plain day (no C11 fields), as an older build sends it. */
const oldDay = (date, slug) => ({ date, theme: 'Quiet ' + date.slice(-2), stops: [{ n: 1, slug, name: 'Old <Mill> ' + date.slice(-2),
  arrive: '10:00', depart: '11:00', minutes: 60, maps_url: maps('Old' + date.slice(-2)), note_line: '' }],
  legs: [{ from: 'lodging', to: slug, mode: 'WALK', minutes: 8 }], warnings: [] });
/** A moving day carrying every C11 day and stop field. */
const fullDay = (date) => ({ date, theme: 'Moving day', sunset: '17:05',
  start: { name: 'Reed <Central> Station', time: '12:10', maps_url: maps('Start') },
  end: { name: 'Gull Inn', time: '21:00', maps_url: 'https://evil.example/track' },
  bags: 'bags to the hotel',
  dinner: { name: 'Salt & <Smoke>', slug: 'salt-smoke', start: '19:00', end: '20:30', maps_url: maps('Dinner'), note_line: 'Ask for the window table.', booking_line: 'Booked for 2 at 19:00.' },
  extras: [{ kind: 'event', name: 'Lantern <parade>', time: '20:45', maps_url: maps('Parade'), note_line: 'Starts at the quay.' },
    { kind: 'saved', name: 'Rope Loft', maps_url: 'https://evil.example/x?a=<b>' }],
  stops: [{ n: 1, slug: 'tide-museum', name: 'Tide <b>Museum</b>', arrive: '13:00', depart: '14:30', minutes: 90, maps_url: maps('Tide'), note_line: 'Top floor first.',
    last_entry: '16:30', minutes_source: 'official', crowd_slot: 'opening', facts_line: 'Built 1871.', booking_line: 'Timed tickets online.', price_line: 'Adults 12.', menu_checked: '2027-05-20' },
  { n: 2, slug: 'net-lofts', name: 'Net Lofts', arrive: '15:00', depart: '16:00', minutes: 60, maps_url: maps('Nets'), note_line: '', crowd_slot: 'late', minutes_source: 'estimate' }],
  legs: [{ from: 'day-start', to: 'tide-museum', mode: 'WALK', minutes: 10 }, { from: 'tide-museum', to: 'net-lofts', mode: 'WALK', minutes: 12 },
    { from: 'net-lofts', to: 'day-end', mode: 'TRANSIT', minutes: 25 }], warnings: [] });

const DATES = ['2027-06-10', '2027-06-11', '2027-06-12', '2027-06-13', '2027-06-14', '2027-06-15'];
const allDays = () => [fullDay(DATES[0])].concat(DATES.slice(1).map((d, i) => oldDay(d, 'mill-' + (i + 2))));
const top = (over = {}) => ({ v: 1, kind: 'plan_digest', trip: TRIP, build_id: 'build-rh-1', verified_on: '2027-05-30', tz: 'Etc/UTC',
  drive: { plan: 'fixtureDrivePlanFile01', brochure_html: null, brochure_pdf: null }, ...over });
const whole = (over = {}) => ({ ...top(over), days: allDays(), later: [{ slug: 'cliff-path', name: 'Cliff Path', reason: 'Too far for one day.' }] });
/** The same plan split into `n` parts of consecutive days; later only on part 1. */
function split(n, over = {}) {
  const days = allDays(), per = Math.ceil(days.length / n), out = [];
  for (let k = 1; k <= n; k++) out.push({ ...top(over), part: k, parts: n, days: days.slice((k - 1) * per, k * per), later: k === 1 ? whole().later : [] });
  return out;
}

/* ---------------- the two validators, in step ---------------- */
const S = () => import('../packs/tour-guide/schemas/index.mjs');
function gasErrors(ctx, type, payload) {
  const raw = JSON.stringify(H.envelope(type, payload));
  return J(ctx.validateEnvelope(raw, Buffer.byteLength(raw))).errors || [];
}
const L = (n) => 'x'.repeat(n);
const DIGEST_BAD = {
  'day sunset 24:00': (x) => { x.days[0].sunset = '24:00'; },
  'start name empty': (x) => { x.days[0].start.name = ''; },
  'start name 121': (x) => { x.days[0].start.name = L(121); },
  'start without time': (x) => { delete x.days[0].start.time; },
  'start unknown key': (x) => { x.days[0].start.place_id = 'FixturePlace01'; },
  'start http link': (x) => { x.days[0].start.maps_url = 'http://maps.example/x'; },
  'end time 9:30': (x) => { x.days[0].end.time = '9:30'; },
  'bags empty': (x) => { x.days[0].bags = ''; },
  'bags 161': (x) => { x.days[0].bags = L(161); },
  'bags object': (x) => { x.days[0].bags = { kind: 'hotel' }; },
  'dinner name 121': (x) => { x.days[0].dinner.name = L(121); },
  'dinner without start': (x) => { delete x.days[0].dinner.start; },
  'dinner bad slug': (x) => { x.days[0].dinner.slug = 'Salt Smoke'; },
  'dinner note 161': (x) => { x.days[0].dinner.note_line = L(161); },
  'dinner booking empty': (x) => { x.days[0].dinner.booking_line = ''; },
  'dinner unknown key': (x) => { x.days[0].dinner.at = 'salt-smoke'; },
  'extras 4': (x) => { x.days[0].extras = [0, 1, 2, 3].map(() => ({ kind: 'saved', name: 'Rope Loft' })); },
  'extra kind show': (x) => { x.days[0].extras[0].kind = 'show'; },
  'extra name empty': (x) => { x.days[0].extras[0].name = ''; },
  'extra note 161': (x) => { x.days[0].extras[0].note_line = L(161); },
  'extra unknown key': (x) => { x.days[0].extras[0].km = 1; },
  'day unknown key': (x) => { x.days[0].lunch = { name: 'X' }; },
  'stop last_entry 7:00': (x) => { x.days[0].stops[0].last_entry = '7:00'; },
  'stop minutes_source guess': (x) => { x.days[0].stops[0].minutes_source = 'guess'; },
  'stop crowd_slot noon': (x) => { x.days[0].stops[0].crowd_slot = 'noon'; },
  'stop facts 161': (x) => { x.days[0].stops[0].facts_line = L(161); },
  'stop booking empty': (x) => { x.days[0].stops[0].booking_line = ''; },
  'stop price 161': (x) => { x.days[0].stops[0].price_line = L(161); },
  'stop menu_checked 2027-02-30': (x) => { x.days[0].stops[0].menu_checked = '2027-02-30'; },
  'stop unknown key': (x) => { x.days[0].stops[0].facts = {}; },
  'part 0': (x) => { x.part = 0; x.parts = 2; },
  'part 9': (x) => { x.part = 9; x.parts = 8; },
  'parts 9': (x) => { x.part = 1; x.parts = 9; },
  'part 1.5': (x) => { x.part = 1.5; x.parts = 2; },
  'part 3 of 2': (x) => { x.part = 3; x.parts = 2; },
  'part without parts': (x) => { x.part = 1; },
  'parts without part': (x) => { x.parts = 2; },
  'later in part 2': (x) => { x.part = 2; x.parts = 2; },
  'top unknown key': (x) => { x.chunk = 1; }
};
test('both validators accept a full C11 digest and an old one, and both reject every out-of-bounds value and unknown key', async () => {
  const s = await S();
  const { ctx } = fresh();
  const full = whole();
  assert.deepEqual(s.validatePayload('plan_digest', J(full)).errors, []);
  assert.deepEqual(gasErrors(ctx, 'plan_digest', J(full)), []);
  const parted = split(3)[1];
  assert.deepEqual(s.validatePayload('plan_digest', J(parted)).errors, []);
  assert.deepEqual(gasErrors(ctx, 'plan_digest', J(parted)), []);
  const old = { ...top(), days: DATES.map((d, i) => oldDay(d, 'mill-' + i)), later: [] };
  delete old.tz;
  assert.deepEqual(s.validatePayload('plan_digest', J(old)).errors, []);
  assert.deepEqual(gasErrors(ctx, 'plan_digest', J(old)), []);
  for (const [name, mutate] of Object.entries(DIGEST_BAD)) {
    const x = J(full);
    mutate(x);
    assert.equal(s.validatePayload('plan_digest', J(x)).ok, false, 'node schema: ' + name);
    assert.ok(gasErrors(ctx, 'plan_digest', J(x)).length > 0, 'GAS validator: ' + name);
  }
  const sl = shortlist();
  assert.deepEqual(s.validatePayload('shortlist', J(sl)).errors, []);
  assert.deepEqual(gasErrors(ctx, 'shortlist', J(sl)), []);
  for (const v of [false, 'yes', 1]) {
    const x = J(sl); x.groups[0].items[0].local_favourite = v;
    assert.equal(s.validatePayload('shortlist', x).ok, false, 'node: local_favourite ' + v);
    assert.ok(gasErrors(ctx, 'shortlist', x).length > 0, 'GAS: local_favourite ' + v);
  }
});

/* ---------------- plans in parts ---------------- */
test('a plan sent in parts stores the same days as the same plan in one envelope, with one notice', () => {
  const a = fresh();
  assert.equal(deliver(a.ctx, a.state, 'plan_digest', whole()).processed, 1);
  const one = J(a.ctx.tgDigestDays(TRIP)), oneLater = J(a.ctx.tgLaterList(TRIP)), oneMsgs = texts(a.state);

  const b = fresh();
  const parts = split(3);
  assert.equal(deliver(b.ctx, b.state, 'plan_digest', parts[0]).processed, 1);
  assert.equal(deliver(b.ctx, b.state, 'plan_digest', parts[1]).processed, 1);
  assert.equal(texts(b.state).length, 0, 'nothing reaches the owner before the last part');
  assert.deepEqual(J(b.ctx.tgDigestDays(TRIP)), [], 'nothing is stored before the last part');
  assert.equal(new Set(staged(b.ctx).map((r) => r.part)).size, 2);
  assert.ok(b.state.triggers.some((t) => t.fn === 'alarmTrigger'), 'the expiry alarm is armed');
  assert.equal(deliver(b.ctx, b.state, 'plan_digest', parts[2]).processed, 1);
  assert.deepEqual(J(b.ctx.tgDigestDays(TRIP)), one);
  assert.deepEqual(J(b.ctx.tgLaterList(TRIP)), oneLater);
  assert.deepEqual(texts(b.state), oneMsgs, 'delivered once, exactly as the whole plan is');
  assert.deepEqual(staged(b.ctx), [], 'the staging rows are gone');
  assert.equal(b.ctx.tgTripGet(TRIP).build_id, 'build-rh-1');
  assert.equal(audits(b.ctx, 'tg_parts_dropped').length, 0);
});

test('parts out of order join in part order; one plan-flow event carries the joined plan', () => {
  const { ctx, state } = fresh();
  const events = [];
  const real = ctx.tgEnvToFlow;
  ctx.tgEnvToFlow = (type, env) => { events.push({ type, env: J(env) }); return true; };
  const parts = split(3);
  deliver(ctx, state, 'plan_digest', parts[2], { in_reply_to: 'req-later-part' });
  deliver(ctx, state, 'plan_digest', parts[0], { in_reply_to: 'req-first-part' });
  assert.equal(events.length, 0);
  deliver(ctx, state, 'plan_digest', parts[1]);
  ctx.tgEnvToFlow = real;
  assert.equal(events.length, 1);
  const p = events[0].env.payload;
  assert.deepEqual(p.days.map((d) => d.date), DATES);
  assert.equal(p.part, undefined); assert.equal(p.parts, undefined);
  assert.deepEqual(p.later, whole().later);
  assert.equal(events[0].env.in_reply_to, 'req-first-part', "part 1's in_reply_to wins");
  assert.deepEqual(J(ctx.tgDigestDays(TRIP)).map((d) => d.date), DATES);
});

test('a re-sent part is idempotent; a part of an already stored build is ignored', () => {
  const { ctx, state } = fresh();
  const parts = split(2);
  deliver(ctx, state, 'plan_digest', parts[0]);
  ctx.__TEST_NOW = '2027-06-01T20:00:00Z';
  deliver(ctx, state, 'plan_digest', parts[0]);   // a new envelope id, same part
  const rows = staged(ctx);
  assert.equal(rows.length, 1, 'part 1 is staged once');
  assert.equal(rows[0].received_at, '2027-06-01T16:00:00.000Z', "the build's clock keeps its first part's time");
  deliver(ctx, state, 'plan_digest', parts[1]);
  assert.equal(J(ctx.tgDigestDays(TRIP)).length, DATES.length);
  const n = texts(state).length;
  deliver(ctx, state, 'plan_digest', parts[1]);
  assert.equal(texts(state).length, n, 'no second delivery');
  assert.deepEqual(staged(ctx), []);
  assert.equal(audits(ctx, 'tg_parts_duplicate').length, 1);
});

test('parts whose top fields differ drop the build: audited, the owner told once, later parts refused', () => {
  const { ctx, state } = fresh();
  const parts = split(3);
  deliver(ctx, state, 'plan_digest', parts[0]);
  deliver(ctx, state, 'plan_digest', { ...parts[1], verified_on: '2027-05-31' });
  assert.deepEqual(texts(state), ['⚠️ <b>Reed Harbour</b>: a plan arrived incomplete; /replan tries again.']);
  assert.equal(audits(ctx, 'tg_parts_dropped').length, 1);
  assert.deepEqual(staged(ctx), []);
  deliver(ctx, state, 'plan_digest', parts[2]);
  assert.equal(texts(state).length, 1, 'no new notice for a late part');
  assert.equal(audits(ctx, 'tg_parts_refused').length, 1);
  assert.deepEqual(staged(ctx), []);
  assert.deepEqual(J(ctx.tgDigestDays(TRIP)), []);
});

test('a part of a newer build discards the staged parts of the earlier build', () => {
  const { ctx, state } = fresh();
  deliver(ctx, state, 'plan_digest', split(3)[0]);
  deliver(ctx, state, 'plan_digest', split(3)[1]);
  const newer = split(2, { build_id: 'build-rh-2' });
  deliver(ctx, state, 'plan_digest', newer[0]);
  assert.deepEqual([...new Set(staged(ctx).map((r) => r.build_id))], ['build-rh-2']);
  assert.equal(audits(ctx, 'tg_parts_superseded').length, 1);
  deliver(ctx, state, 'plan_digest', newer[1]);
  assert.equal(ctx.tgTripGet(TRIP).build_id, 'build-rh-2');
  assert.equal(J(ctx.tgDigestDays(TRIP)).length, DATES.length);
  assert.equal(texts(state).filter((t) => /incomplete/.test(t)).length, 0);
});

test('a build still incomplete 24 h after its first part is dropped by the alarm, with exactly one notice', () => {
  const { ctx, state } = fresh();
  const parts = split(3);
  deliver(ctx, state, 'plan_digest', parts[0]);
  ctx.__TEST_NOW = '2027-06-02T10:00:00Z';
  deliver(ctx, state, 'plan_digest', parts[1]);
  assert.deepEqual(J(state.triggers.filter((t) => t.fn === 'alarmTrigger').map((t) => t.spec.at.toISOString())), ['2027-06-02T16:00:00.000Z']);
  ctx.__TEST_NOW = '2027-06-02T15:00:00Z';
  H.fireTriggers(ctx, state, 'alarmTrigger');   // early: nothing expires
  assert.equal(staged(ctx).length, 2);
  ctx.__TEST_NOW = '2027-06-02T16:03:00Z';
  H.fireTriggers(ctx, state, 'alarmTrigger');
  assert.deepEqual(texts(state), ['⚠️ <b>Reed Harbour</b>: a plan arrived incomplete; /replan tries again.']);
  assert.deepEqual(staged(ctx), []);
  assert.equal(audits(ctx, 'tg_parts_dropped').length, 1);
  assert.equal(state.triggers.filter((t) => t.fn === 'alarmTrigger').length, 0, 'nothing left to wait for');
  H.fireTriggers(ctx, state, 'alarmTrigger');
  deliver(ctx, state, 'plan_digest', parts[2]);
  assert.equal(texts(state).length, 1, 'still exactly one notice');
  assert.deepEqual(J(ctx.tgDigestDays(TRIP)), []);
});

test('the joined plan is checked as one plan: a date repeated across parts drops it', () => {
  const { ctx, state } = fresh();
  const parts = split(2);
  parts[1].days[0] = oldDay(DATES[1], 'mill-x');   // part 1 ends 2027-06-12; part 2 starts back at 06-11
  deliver(ctx, state, 'plan_digest', parts[0]);
  deliver(ctx, state, 'plan_digest', parts[1]);
  assert.deepEqual(J(ctx.tgDigestDays(TRIP)), []);
  assert.equal(audits(ctx, 'tg_parts_dropped').length, 1);
  assert.match(audits(ctx, 'tg_parts_dropped')[0].detail_json, /date order/);
  assert.equal(texts(state).length, 1);
});

test('a part over one cell is staged in several chunk rows, never whole in one cell, and joins back intact', () => {
  const { ctx, state } = fresh();
  const dates = Array.from({ length: 14 }, (_, i) => '2027-07-' + String(i + 1).padStart(2, '0'));
  const heavy = (d, i) => ({ ...oldDay(d, 'mill-' + i), warnings: Array.from({ length: 20 }, (_, k) => 'W' + k + ' ' + L(190)) });
  const p1 = { ...top(), part: 1, parts: 2, days: dates.slice(0, 13).map(heavy), later: [] };
  const p2 = { ...top(), part: 2, parts: 2, days: [heavy(dates[13], 13)], later: [] };
  const size = JSON.stringify(p1).length;
  assert.ok(size > 50000 && size <= 60000, 'part 1 is ' + size + ' chars');
  assert.equal(deliver(ctx, state, 'plan_digest', p1).processed, 1);
  const rows = staged(ctx);
  assert.equal(rows.length, 2, 'two chunk rows for part 1');
  assert.ok(rows.every((r) => r.json.length <= 45000));
  deliver(ctx, state, 'plan_digest', p2);
  const days = J(ctx.tgDigestDays(TRIP));
  assert.deepEqual(days.map((d) => d.date), dates);
  assert.deepEqual(days[0].warnings, p1.days[0].warnings);
  assert.deepEqual(staged(ctx), []);
});

test('a deployment without the DigestParts tab gets it on the first part', () => {
  const { ctx, state } = fresh();
  const ss = ctx.getSpreadsheet();
  ss.deleteSheet(ss.getSheetByName('DigestParts'));
  assert.equal(ctx.tgPartsHasTab(), false);
  deliver(ctx, state, 'plan_digest', whole());   // a whole plan never creates it
  assert.equal(ctx.tgPartsHasTab(), false);
  const parts = split(2, { build_id: 'build-rh-2' });
  deliver(ctx, state, 'plan_digest', parts[0]);
  assert.equal(ctx.tgPartsHasTab(), true);
  deliver(ctx, state, 'plan_digest', parts[1]);
  assert.equal(ctx.tgTripGet(TRIP).build_id, 'build-rh-2');
});

/* ---------------- the day card ---------------- */
const M = (id) => '<a href="https://www.google.com/maps/search/?api=1&amp;query=Fixture&amp;query_place_id=' + id + '">';
function planned() {
  const t = fresh();
  deliver(t.ctx, t.state, 'plan_digest', whole());
  t.ctx.settingSet(t.ctx.TG_SETTINGS.CURRENT_TRIP, TRIP, 'test');
  return t;
}
test('the day card shows every C11 field; facts and price stay off; markup is text and only Maps links are links', () => {
  const { ctx, state } = planned();
  const n = texts(state).length;
  say(ctx, state, '/day 1');
  const card = texts(state).slice(n);
  assert.equal(card.length, 1);
  assert.deepEqual(card[0].split('\n'), [
    '<b>Day 1 of 6 · Thu 10 Jun</b> — Moving day',
    '🚩 Starts 12:10 at ' + M('Start') + 'Reed &lt;Central&gt; Station</a> · bags to the hotel',
    '   <i>↳ 10 min walk</i>',
    '<b>1.</b> 13:00–14:30 ' + M('Tide') + 'Tide &lt;b&gt;Museum&lt;/b&gt;</a> · 1 h 30 · last entry 16:30',
    '   <i>Top floor first.</i>',
    '   🎟 <i>Timed tickets online.</i>',
    '   👥 <i>Go at opening; it gets busy later</i>',
    '   <i>↳ 12 min walk</i>',
    '<b>2.</b> 15:00–16:00 ' + M('Nets') + 'Net Lofts</a> · 1 h',
    '   👥 <i>Late is quieter</i>',
    '🍽 19:00 Dinner at ' + M('Dinner') + 'Salt &amp; &lt;Smoke&gt;</a>',
    '   <i>Ask for the window table.</i>',
    '   🎟 <i>Booked for 2 at 19:00.</i>',
    '   <i>↳ 25 min transit</i>',
    '🏁 Ends 21:00 at Gull Inn',
    '<b>If you have energy</b>',
    '✨ 20:45 ' + M('Parade') + 'Lantern &lt;parade&gt;</a>',
    '   <i>Starts at the quay.</i>',
    '🔖 Rope Loft',
    '🌅 Sunset 17:05',
    '<i>Walking routes from Google are in beta and may be missing sidewalks or footpaths.</i>'
  ]);
  assert.doesNotMatch(card[0], /Built 1871|Adults 12|evil\.example|<b>Museum/);
});

test('an older day (no C11 fields) shows exactly as before', () => {
  const { ctx, state } = planned();
  const n = texts(state).length;
  say(ctx, state, '/day 2');
  assert.deepEqual(texts(state).slice(n)[0].split('\n'), [
    '<b>Day 2 of 6 · Fri 11 Jun</b> — Quiet 11',
    '   <i>↳ 8 min walk</i>',
    '<b>1.</b> 10:00–11:00 ' + M('Old11') + 'Old &lt;Mill&gt; 11</a> · 1 h',
    '<i>Walking routes from Google are in beta and may be missing sidewalks or footpaths.</i>'
  ]);
  const day = J(ctx.tgDigestDay(TRIP, 2));
  assert.deepEqual(Object.keys(day).sort(), ['date', 'legs', 'n', 'rain', 'spare_minutes', 'stops', 'theme', 'warnings']);
});

test('the C11 day and stop fields round-trip through the DayPlans tab', () => {
  const { ctx } = planned();
  const d = J(ctx.tgDigestDay(TRIP, 1)), sent = fullDay(DATES[0]);
  ['sunset', 'start', 'end', 'bags', 'dinner', 'extras'].forEach((k) => assert.deepEqual(d[k], sent[k], k));
  assert.deepEqual(d.stops, sent.stops);
  assert.equal(d.spare_minutes, null);
});

/* ---------------- "local favourite" and the app ---------------- */
const app = (ctx, state, op, args) => H.appPost(ctx, state, 'app', { op, args });
const slItem = (n, slug, over = {}) => ({ n, slug, name: 'Item <' + n + '>', why_you: 'Fits a slow morning.', fit: 0.8, est_minutes: 45,
  area: 'Quay', maps_url: maps('Sl' + n), labels: ['verified'], ...over });
const shortlist = () => ({ v: 1, kind: 'shortlist', trip: TRIP, run_id: 'r1', round: 1, more: false, decided: [],
  groups: [{ id: 'activities', items: [slItem(1, 'tide-museum', { local_favourite: true }), slItem(2, 'net-lofts')] }] });

test('a local favourite is marked in the chat shortlist and in shortlist.get', () => {
  const { ctx, state } = fresh();
  assert.equal(deliver(ctx, state, 'shortlist', shortlist()).processed, 1);
  const all = texts(state).join('\n');
  assert.match(all, /<b>1\.<\/b> <b><a [^>]+>Item &lt;1&gt;<\/a><\/b> · ~45 min · Quay · local favourite/);
  assert.doesNotMatch(all.split('\n').filter((l) => /Item &lt;2&gt;/.test(l)).join(''), /local favourite/);
  const g = J(app(ctx, state, 'shortlist.get', {}));
  assert.deepEqual(g.groups[0].items.map((i) => i.local_favourite), [true, false]);
  assert.equal(deliver(ctx, state, 'shortlist', { ...shortlist(), run_id: 'r2', groups: [{ id: 'activities', items: [slItem(1, 'tide-museum', { local_favourite: false })] }] }).rejected, 1,
    'local_favourite is true or absent');
});

test('trip.digest returns the C11 day and stop fields, Maps links only; an older day keeps its old shape', () => {
  const { ctx, state } = planned();
  const r = J(app(ctx, state, 'trip.digest', { slug: TRIP }));
  assert.equal(r.ok, true);
  const d = r.days[0];
  assert.equal(d.sunset, '17:05');
  assert.equal(d.bags, 'bags to the hotel');
  assert.deepEqual(d.start, { name: 'Reed <Central> Station', time: '12:10', maps_url: maps('Start') });
  assert.deepEqual(d.end, { name: 'Gull Inn', time: '21:00', maps_url: '' }, 'a link that is not Google Maps is dropped');
  assert.deepEqual(d.dinner, { name: 'Salt & <Smoke>', slug: 'salt-smoke', start: '19:00', end: '20:30', maps_url: maps('Dinner'),
    note_line: 'Ask for the window table.', booking_line: 'Booked for 2 at 19:00.' });
  assert.deepEqual(d.extras, [{ name: 'Lantern <parade>', kind: 'event', time: '20:45', maps_url: maps('Parade'), note_line: 'Starts at the quay.' },
    { name: 'Rope Loft', kind: 'saved', maps_url: '' }]);
  const s = d.stops[0];
  assert.deepEqual([s.last_entry, s.minutes_source, s.crowd_slot, s.facts_line, s.booking_line, s.price_line, s.menu_checked],
    ['16:30', 'official', 'opening', 'Built 1871.', 'Timed tickets online.', 'Adults 12.', '2027-05-20']);
  assert.deepEqual(Object.keys(d.stops[1]).filter((k) => /_/.test(k) && k !== 'maps_url' && k !== 'note_line').sort(), ['crowd_slot', 'minutes_source']);
  assert.deepEqual(Object.keys(r.days[1]).sort(), ['date', 'legs', 'n', 'rain', 'stops', 'theme', 'warnings']);
  assert.deepEqual(Object.keys(r.days[1].stops[0]).sort(), ['arrive', 'depart', 'maps_url', 'minutes', 'n', 'name', 'note_line', 'slug']);
});

// C15 (WP-15b): a chosen evening event reaches the app with `chosen: true` (⭐ there); an extra that was not chosen gains no key.
test('trip.digest keeps chosen: true on a chosen evening extra and adds nothing to the others', () => {
  const t = fresh();
  const p = whole(); p.days[0].extras[0].chosen = true;
  deliver(t.ctx, t.state, 'plan_digest', p);
  const d = J(app(t.ctx, t.state, 'trip.digest', { slug: TRIP })).days[0];
  assert.deepEqual(d.extras.map((x) => x.chosen), [true, undefined]);
  assert.equal(Object.prototype.hasOwnProperty.call(d.extras[1], 'chosen'), false);
});

/* ---------------- /dates per day ---------------- */
const NEXT = ' The next plan or <code>/replan</code> uses it.';
test('/dates <date> start|end|hours|bags save one day, list it, and every research, plan and replan request carries day_overrides', () => {
  const { ctx, state } = planned();
  say(ctx, state, '/dates 2027-06-10 start Reed <Central>   Station 12:10');
  assert.equal(last(state), '🚩 Saved for Thu 10 Jun: the day starts at Reed &lt;Central&gt; Station at 12:10.' + NEXT);
  say(ctx, state, '/dates 2027-06-10 END Gull Inn 9:30');
  assert.match(last(state), /two hours after it starts \(12:10–09:30 on Thu 10 Jun\) — nothing was saved/);
  say(ctx, state, '/dates 2027-06-10 end Gull Inn 21:00');
  assert.equal(last(state), '🏁 Saved for Thu 10 Jun: the day ends at Gull Inn at 21:00.' + NEXT);
  say(ctx, state, '/dates 2027-06-11 hours 9:30 - 18:00');
  assert.equal(last(state), '🕘 Saved for Fri 11 Jun: the day runs 09:30–18:00.' + NEXT);
  say(ctx, state, '/dates 2027-06-10 bags forward to the <next> inn');
  assert.equal(last(state), '🧳 Saved for Thu 10 Jun: bags sent ahead (to the &lt;next&gt; inn).' + NEXT);
  say(ctx, state, '/dates 2027-06-11 bags hotel');
  assert.equal(last(state), '🧳 Saved for Fri 11 Jun: bags to the hotel.' + NEXT);

  say(ctx, state, '/dates');
  const lines = last(state).split('\n');
  assert.deepEqual(lines.slice(0, 3), ['📅 Reed Harbour: Thu 10 Jun → Tue 15 Jun',
    '· Thu 10 Jun: start Reed &lt;Central&gt; Station 12:10 · end Gull Inn 21:00 · bags sent ahead (to the &lt;next&gt; inn)',
    '· Fri 11 Jun: 09:30–18:00 · bags to the hotel']);
  assert.match(lines[3], /^Change them with/);

  const want = [{ date: '2027-06-10', start: { text: 'Reed <Central> Station', time: '12:10' }, end: { text: 'Gull Inn', time: '21:00' }, bags: 'forward', bags_note: 'to the <next> inn' },
    { date: '2027-06-11', day_start: '09:30', day_end: '18:00', bags: 'hotel' }];
  say(ctx, state, '/replan day 1 slower');
  assert.deepEqual(J(reqOf(state, 'replan').pop().trip_update.day_overrides), want);
  ctx.tgOpenKindRequest('research', { trip: TRIP, scope: 'refresh' }, { text: 'test', ack: false });
  ctx.tgOpenKindRequest('plan', { trip: TRIP }, { text: 'test', ack: false });
  assert.deepEqual(J(reqOf(state, 'research').pop().trip_update.day_overrides), want);
  assert.deepEqual(J(reqOf(state, 'plan').pop().trip_update.day_overrides), want);
  say(ctx, state, '/notes');
  assert.equal(reqOf(state, 'notes').pop().trip_update, undefined);

  say(ctx, state, '/dates 2027-06-10 clear');
  assert.match(last(state), /^🧹 Cleared what was set for Thu 10 Jun\./);
  say(ctx, state, '/dates 2027-06-10 clear');
  assert.equal(last(state), 'Nothing was set for Thu 10 Jun.');
  say(ctx, state, '/dates 2027-06-11 clear');
  say(ctx, state, '/replan day 1 again');
  assert.deepEqual(J(reqOf(state, 'replan').pop().trip_update.day_overrides), [], 'all cleared: the trip file is cleared too');
  say(ctx, state, '/dates');
  assert.match(last(state), /^📅 Reed Harbour: Thu 10 Jun → Tue 15 Jun\nChange them with/);
});

test('/dates per-day forms refuse a bad date, a date outside the trip, a short day and a missing place; nothing is saved', () => {
  const { ctx, state } = planned();
  say(ctx, state, '/dates 2027-02-30 start Quay 10:00');
  assert.equal(last(state), '2027-02-30 is not a real date (YYYY-MM-DD). Nothing was saved.');
  say(ctx, state, '/dates 2027-06-20 start Quay 10:00');
  assert.equal(last(state), 'Sun 20 Jun is not inside the trip (Thu 10 Jun → Tue 15 Jun). Nothing was saved.');
  say(ctx, state, '/dates 2027-06-12 hours 10:00 11:30');
  assert.match(last(state), /at least two hours after it starts \(10:00–11:30 on Sat 12 Jun\)/);
  say(ctx, state, '/dates hours 09:00 19:00');
  say(ctx, state, '/dates 2027-06-12 start Quay 18:00');
  assert.match(last(state), /\(18:00–19:00 on Sat 12 Jun\)/, "the trip's hours count when the day has none");
  say(ctx, state, '/dates 2027-06-12 start 10:00');
  assert.match(last(state), /^Send the place and the time/);
  say(ctx, state, '/dates 2027-06-12 start Quay 25:00');
  assert.match(last(state), /^Send the place and the time/);
  say(ctx, state, '/dates 2027-06-12 bags sideways');
  assert.match(last(state), /^Bags go one of four ways/);
  say(ctx, state, '/dates 2027-06-12 start ' + 'x'.repeat(121) + ' 10:00');
  assert.match(last(state), /longer than 120 characters/);
  say(ctx, state, '/dates 2027-06-12 clear now');
  assert.match(last(state), /^Change them with/);
  assert.deepEqual(J(ctx.tgTripDays(TRIP)), []);
  say(ctx, state, '/dates 2027-06-12 to 2027-06-13');
  assert.match(last(state), /📅 Saved\. Reed Harbour: Sat 12 Jun → Sun 13 Jun/, 'the two-date form still works');

  const t = fresh();   // a trip with no dates yet
  t.ctx.settingSet(t.ctx.TG_SETTINGS.CURRENT_TRIP, TRIP, 'test');
  say(t.ctx, t.state, '/dates 2027-06-12 start Quay 10:00');
  assert.match(last(t.state), /^Set the trip's dates first/);
});

test('a hidden-character or markup place name is stored as text and shown escaped', () => {
  const { ctx, state } = planned();
  say(ctx, state, '/dates 2027-06-13 start <a href="https://evil.example">Pier</a>​ 10:00');
  assert.equal(last(state), '🚩 Saved for Sun 13 Jun: the day starts at &lt;a href="https://evil.example"&gt;Pier&lt;/a&gt; at 10:00.' + NEXT);
  assert.equal(J(ctx.tgTripDay(TRIP, '2027-06-13')).start.text, '<a href="https://evil.example">Pier</a>');
});

test('a digest without parts stores as before and stages nothing', () => {
  const { ctx, state } = fresh();
  deliver(ctx, state, 'plan_digest', whole());
  assert.deepEqual(staged(ctx), [], 'nothing staged');
  assert.equal(J(ctx.tgDigestDays(TRIP)).length, DATES.length);
});

// Developed by: LightAISolutions
