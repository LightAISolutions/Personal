'use strict';
// Tour Guide pack — red-team B: forged, stale and malformed callback data (WP-6a; helpers/decisions/TG-PHASE-6.md §1.1 B).
// Each test taps invented callback data at the webhook and checks: the update returns 200 ("OK"), nothing crashes, the
// owner gets at most a short answerCallbackQuery toast, and no Sheet row and no request changes. Every trip, place and
// wording is invented ("Harbor Town"); no network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');

const START = '2027-05-12T08:00:00Z';
const TRIP = 'harbor-town';
const maps = (id) => 'https://www.google.com/maps/search/?api=1&query=Fixture&query_place_id=' + id;

/* ---------------- harness glue (as in pack_tour-guide_gas_e2e.test.js) ---------------- */
function fresh(now) {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: now || START });
  H.bootstrap(ctx, state);
  ['CHAT', 'RESEARCH', 'PLAN', 'NOTES', 'BROCHURE', 'PREFS', 'PLACES'].forEach((r) => H.configureRoutine(ctx, state, r));
  ctx.runDailyJobs();
  return { ctx, state, k: state.props[ctx.PROP.WEBHOOK_SECRET] };
}
const post = (t, upd) => t.ctx.doPost(H.postEvent('tg', { k: t.k }, upd));
const say = (t, text) => post(t, H.tgUpdate({ text }));
/** A callback update (built here when data is '' — H.tgUpdate treats an empty callback as a text message). */
function tap(t, data, o = {}) {
  const upd = H.tgUpdate({ callback: data || 'x', ...o });
  upd.callback_query.data = data;
  return post(t, upd);
}
const sends = (t) => t.state.fetch.telegram('sendMessage').map((r) => r.json);
const texts = (t) => sends(t).map((m) => m.text);
const toasts = (t) => t.state.fetch.telegram('answerCallbackQuery').map((r) => r.json.text || '');
const advance = (t, min) => { t.ctx.__TEST_NOW = new Date(new Date(t.ctx.__TEST_NOW).getTime() + min * 60000).toISOString(); };
function sheets(t) {
  const out = {};
  for (const ss of t.state.spreadsheets.values()) ss.sheets.filter((s) => s.name !== 'AuditLog').forEach((s) => { out[ss.name + '/' + s.name] = JSON.stringify(s.data); });
  return out;
}
const reqFiles = (t) => (t.state.drive.listFiles('TourGuide/mailbox/to-brain') || []).filter((n) => /^req_/.test(n));
/**
 * The refusal contract for one tap: 200, no crash, no chat message, no new request, no Sheet row changed; returns the
 * toast text (a short answerCallbackQuery, or '' when the router stayed silent).
 */
function inert(t, data, o = {}, why = data) {
  const n = sends(t).length, r = reqFiles(t).length, before = sheets(t), a = toasts(t).length;
  const out = tap(t, data, o);
  assert.equal(out.getContent(), 'OK', '200 for ' + why);
  assert.equal(sends(t).length, n, 'no chat message for ' + why + ': ' + JSON.stringify(texts(t).slice(n)));
  assert.equal(reqFiles(t).length, r, 'no request for ' + why);
  assert.deepEqual(sheets(t), before, 'no Sheet row changed for ' + why);
  assert.equal(t.ctx.storeAll('AuditLog').filter((x) => x.event === 'callback_error').length, 0, 'no handler threw for ' + why);
  return toasts(t).slice(a).join(' | ');
}

/* ---------------- fixtures (invented) ---------------- */
const title = (slug) => slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
const item = (n, slug) => ({ n, slug, name: title(slug), why_you: 'Quiet before noon.', fit: 0.8, est_minutes: 60, area: 'Old quay', maps_url: maps('FixtureHt' + n), labels: ['verified'] });
const stop = (n, slug) => ({ n, slug, name: title(slug), arrive: '10:00', depart: '11:00', minutes: 60, maps_url: maps('FixtureStop' + n), note_line: 'Go early.' });
const place = (slug) => ({ slug, name: title(slug), area: 'Old quay', category: 'museum', tags: ['history'], status: 'candidate', last_trip: null,
  last_researched: '2027-04-21', last_verified: null, note_line: 'Quiet before noon.', maps_url: maps('FixturePl' + slug.length), history_summary: '' });
const CID = 'c_0a1b2c3d4e';
/** A trip with a two-day digest, a Later entry, a shortlist run (no plan flow) and two repository places. */
function world(t) {
  const drop = (type, payload) => { H.putEnvelope(t.state, H.envelope(type, payload)); return t.ctx.pollFromBrain(); };
  drop('plan_digest', { trip: TRIP, build_id: 'build-ht-1', verified_on: '2027-04-21',
    days: [{ date: '2027-05-12', theme: 'Quay', stops: [stop(1, 'tide-clock-museum')], legs: [], warnings: [] },
      { date: '2027-05-13', theme: 'Marsh', stops: [stop(1, 'salt-marsh-boardwalk')], legs: [], warnings: [] }],
    later: [{ slug: 'gull-rock-lighthouse', name: 'Gull Rock Lighthouse', reason: 'owner_choice' }], drive: { plan: null, brochure_html: null, brochure_pdf: null } });
  drop('shortlist', { trip: TRIP, run_id: 'ht-r1-a', round: 1, more: false, groups: [{ id: 'activities', items: [item(1, 'net-loft-gallery'), item(2, 'rope-walk')] }] });
  drop('places_digest', { destination: TRIP, places: [place('tide-clock-museum'), place('net-loft-gallery')] });
  drop('prefs_review', { v: 1, kind: 'prefs_review', vocab: 'travel', batch_id: 'pfb_0123456789abcdef', more: 0, held_back: [],
    items: [{ cid: CID, dimension: 'pace', value: 'relaxed', stance: '+', statement: 'You like a relaxed pace', suspect: false, text: 'You like a relaxed pace',
      buttons: [[{ text: 'Yes', data: 'pf:' + CID + ':y' }, { text: 'Edit', data: 'pf:' + CID + ':e' }, { text: 'No', data: 'pf:' + CID + ':n' }]] }] });
  t.ctx.settingSet('tg_current_trip', TRIP);
  return t;
}

/* ---------------- tests ---------------- */
test('B1 pf:<cid>:y for a cid never offered (and malformed pf data) → "That review has ended" / "Unknown button", no prefs request', () => {
  const t = world(fresh());
  assert.match(inert(t, 'pf:c_ffffffffff:y'), /That review has ended/);
  assert.match(inert(t, 'pf:c_0a1b2c3d4e:z'), /Unknown button/);
  assert.match(inert(t, 'pf:' + CID.toUpperCase() + ':y'), /Unknown button/);
  assert.match(inert(t, 'pf::'), /Unknown button/);
  assert.equal(t.ctx.storeAll('Requests').filter((r) => r.kind === 'prefs').length, 0);
});

test('B2 pf ✏️ then the reply 31 minutes later (past the 30-minute TTL) → not captured as the edit, no prefs request; a ✅ tap after the TTL still decides (ACCEPTED: the TTL covers only the ✏️ capture)', () => {
  const t = world(fresh());
  tap(t, 'pf:' + CID + ':e');
  assert.match(texts(t).slice(-1)[0], /Send the new wording/);
  advance(t, 31);
  say(t, 'I start around 8');
  assert.ok(!texts(t).some((x) => /Noted: <b>I start around 8/.test(x)), 'the late text is not taken as the edit');
  assert.equal(t.ctx.settingGet('tg_pf_edit', ''), '', 'the expired edit is cleared');
  const reqs = t.ctx.storeAll('Requests');
  assert.equal(reqs.filter((r) => r.kind === 'prefs').length, 0, 'no prefs request from the late text');
  assert.equal(reqs.filter((r) => r.kind === 'message').length, 1, 'the late text went the normal way (a message request), as any free text does');
  tap(t, 'pf:' + CID + ':y');
  assert.equal(t.ctx.storeAll('Requests').filter((r) => r.kind === 'prefs').length, 1, 'a ✅ tap on a live batch still counts after 31 minutes (documented)');
  assert.match(inert(t, 'pf:' + CID + ':n'), /Already sent/, 'a closed batch refuses further taps');
});

test('B3 sl: a stale or unknown run key, a slot not in the run, a bad value → no choice written', () => {
  const t = world(fresh());
  assert.match(inert(t, 'sl:ht-r0-z:a1:w'), /That shortlist is gone/);
  assert.match(inert(t, 'sl:ht-r1-a:a9:w'), /gone from the list/);
  assert.match(inert(t, 'sl:ht-r1-a:f1:w'), /gone from the list/, 'the food group has no item 1');
  assert.match(inert(t, 'sl:ht-r1-a:a1:x'), /Unknown button/);
  assert.match(inert(t, 'sl:ht-r1-a:a-1:w'), /Unknown button/);
  assert.match(inert(t, 'sl:ht-r1-a:a1000:w'), /Unknown button/);
  assert.equal(t.ctx.tgChoiceList(TRIP, 'ht-r1-a', 'shortlist').length, 0);
});

test('B4 tf: with no active plan flow → told to /plan, no choice written; a bad value → Unknown button', () => {
  const t = world(fresh());
  assert.match(inert(t, 'tf:' + TRIP + ':1:y'), /Send \/plan /);
  assert.match(inert(t, 'tf:' + TRIP + ':1:e'), /Send \/plan /);
  assert.match(inert(t, 'tf:no-such-trip:1:n'), /Send \/plan &lt;destination&gt;|Send \/plan <destination>/);
  assert.match(inert(t, 'tf:' + TRIP + ':1:q'), /Unknown button/);
  assert.equal(t.ctx.tgChoiceList(TRIP, 'intake', 'fact').length, 0);
});

test('B5 ps: a stale index, a wrong tag, an unknown plain slug (FIXED), a hostile key → never acts on a place', () => {
  const t = world(fresh());
  say(t, '/places quay');                                        // remembers [tide-clock-museum, net-loft-gallery] for the ps buttons
  const later = () => t.ctx.tgLaterList(TRIP).map((e) => e.place_slug).sort().join(',');
  const was = later();
  assert.match(inert(t, 'ps:.7.abcd:a'), /That list has changed/, 'index past the list');
  assert.match(inert(t, 'ps:.0.0000:a'), /That list has changed/, 'wrong tag on a real index');
  assert.match(inert(t, 'ps:.x.abcd:n'), /That list has changed/);
  assert.match(inert(t, 'ps:invented-castle:n'), /That list has changed/, 'a slug the bot never offered (was: a notes request for it)');
  assert.match(inert(t, 'ps:invented-castle:a'), /That list has changed/, 'and never lands on the Later list');
  assert.match(inert(t, 'ps:Tide_Clock|x:c'), /That list has changed/);
  assert.match(inert(t, 'ps:tide-clock-museum:z'), /Unknown button/, 'a known place, an unknown action');
  assert.equal(later(), was);
  // The real buttons still work: a known repository place and a plan stop the last /place answer offered.
  const n = t.ctx.storeAll('Requests').length;
  tap(t, 'ps:tide-clock-museum:n');
  assert.equal(t.ctx.storeAll('Requests').length, n + 1);
  say(t, '/place salt marsh');
  tap(t, 'ps:salt-marsh-boardwalk:n');
  assert.equal(t.ctx.storeAll('Requests').length, n + 2, 'a stop offered by /place (no Places row) still opens its notes request');
});

test('B6 fl: a foreign step id, no flow at all, a paused flow → nothing moves', () => {
  const t = world(fresh());
  assert.match(inert(t, 'fl:3:o0'), /That conversation has ended/);
  say(t, '/interview pace');
  const step = t.ctx.flowActive('777').step;
  assert.match(inert(t, 'fl:' + (step + 5) + ':o0'), /moved on/);
  assert.match(inert(t, 'fl:-1:o0'), /moved on/);
  assert.match(inert(t, 'fl:abc:o0'), /moved on/);
  assert.equal(t.ctx.flowActive('777').step, step);
  // The right step with a value the question never offered re-asks the same question (no answer recorded).
  tap(t, 'fl:' + step + ':o99');
  assert.deepEqual(JSON.parse(JSON.stringify(t.ctx.flowActive('777').state.ans)), {});
});

test('B7 dy: / lt: with an index past the end, negative, non-numeric or missing → refused toasts, nothing sent', () => {
  const t = world(fresh());
  for (const d of ['dy:' + TRIP + ':3', 'dy:' + TRIP + ':-1', 'dy:' + TRIP + ':two', 'dy:' + TRIP + ':', 'dy:' + TRIP, 'dy:no-such-trip:1', 'dy::1']) {
    assert.match(inert(t, d), /No day|That trip is gone/, d);
  }
  for (const d of ['lt:' + TRIP + ':5.abcd', 'lt:' + TRIP + ':-1.abcd', 'lt:' + TRIP + ':x.abcd', 'lt:' + TRIP + ':0.zzzz', 'lt:' + TRIP, 'lt:no-such-trip:0.abcd']) {
    assert.match(inert(t, d), /That list has changed/, d);
  }
  const key = '0.' + t.ctx.tgCmdTag('gull-rock-lighthouse');
  for (const d of ['lt:' + TRIP + ':' + key + ':3', 'lt:' + TRIP + ':' + key + ':-2', 'lt:' + TRIP + ':' + key + ':x']) {
    assert.match(inert(t, d), /No such day/, d);
  }
});

test('B8 data over 64 bytes, an unknown prefix, extra ":" segments, empty data → no crash, no action', () => {
  const t = world(fresh());
  assert.match(inert(t, 'ps:' + 'a'.repeat(120) + ':n'), /That list has changed/, 'over 64 bytes');
  assert.match(inert(t, 'zz:' + TRIP + ':1'), /Unknown button/);
  assert.match(inert(t, ''), /Unknown button/);
  assert.match(inert(t, ':::'), /Unknown button/);
  assert.match(inert(t, 'pl:nope:' + TRIP), /Unknown button/);
  assert.match(inert(t, 'rv:stop:' + TRIP), /Unknown button/);
  for (const d of ['pf:' + CID + ':y:extra', 'sl:ht-r1-a:a1:w:x', 'tf:' + TRIP + ':1:y:x', 'ps:tide-clock-museum:a:x']) {
    assert.match(inert(t, d), /Unknown button/, 'state-changing buttons take their exact shape only (FIXED): ' + d);
  }
  // Extra segments after a valid day only re-send that day (the third part is the only one read): harmless.
  const n = sends(t).length;
  tap(t, 'dy:' + TRIP + ':1:x:y:z');
  assert.equal(sends(t).length, n + 1);
  assert.match(texts(t).slice(-1)[0], /Day 1 of 2/);
});

test('B9 a callback from a non-owner, or from the owner on a message in a foreign chat → ignored (200), audited once, no toast', () => {
  const t = world(fresh());
  const a = toasts(t).length;
  assert.equal(inert(t, 'ps:tide-clock-museum:a', { fromId: 4242 }, 'stranger'), '');
  assert.equal(inert(t, 'ps:tide-clock-museum:a', { fromId: 4242 }, 'stranger again'), '');
  assert.equal(inert(t, 'pl:br:' + TRIP, { callbackChat: { id: -100555, type: 'supergroup' } }, 'foreign chat'), '');
  assert.equal(toasts(t).length, a, 'no answerCallbackQuery at all');
  const un = t.ctx.storeAll('AuditLog').filter((x) => x.event === 'tg_callback_unauthorized');
  assert.equal(un.length, 2, 'the stranger is audited once (seenOnce), the foreign chat once');
});

// Developed by: LightAISolutions
