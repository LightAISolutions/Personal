'use strict';
// Tour Guide pack — red-team A: hostile from-brain envelopes (WP-6a; helpers/decisions/TG-PHASE-6.md §1.1 A). Each test
// drops an invented envelope into from-brain, lets the core pick it up (pollFromBrain or the wake route) and checks the
// refusal or the neutralisation: refused → archived to rejected, no chat message, no Sheet row changed; accepted →
// every brain string reaches the chat escaped. Every trip, place and wording is invented ("Harbor Town"); no network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');

const START = '2027-04-20T09:00:00Z';
const TRIP = 'harbor-town';
const J = (v) => JSON.parse(JSON.stringify(v));
const maps = (id) => 'https://www.google.com/maps/search/?api=1&query=Fixture&query_place_id=' + id;
const GOOGLE_FIELDS = ['rating', 'user_ratings_total', 'hours', 'opening_hours', 'photos', 'reviews', 'price_level', 'formatted_address', 'phone'];

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
const sends = (t) => t.state.fetch.telegram('sendMessage').map((r) => r.json);
const texts = (t) => sends(t).map((m) => m.text);
const files = (t, p) => (t.state.drive.listFiles('TourGuide/mailbox/' + p) || []).sort();
const audits = (t, event) => t.ctx.storeAll('AuditLog').filter((r) => r.event === event);
/** Every row of every sheet except the AuditLog, as JSON — a refused envelope must leave it byte-identical. */
function sheets(t) {
  const out = {};
  for (const ss of t.state.spreadsheets.values()) ss.sheets.filter((s) => s.name !== 'AuditLog').forEach((s) => { out[ss.name + '/' + s.name] = JSON.stringify(s.data); });
  return out;
}
/** Drop one envelope (object or raw string) and sweep it with pollFromBrain. */
function drop(t, env) { H.putEnvelope(t.state, env, typeof env === 'string' ? 'raw-' + Math.random().toString(36).slice(2) + '.json' : undefined); return J(t.ctx.pollFromBrain()); }
/** The refusal contract: rejected by the sweep, archived to rejected, no chat message, no Sheet row changed. */
function refused(t, env, why) {
  const n = sends(t).length, before = sheets(t), rej = files(t, 'archive/rejected').length;
  const out = drop(t, env);
  assert.equal(out.rejected, 1, 'rejected: ' + why + ' ' + JSON.stringify(out));
  assert.equal(out.processed, 0, why);
  assert.equal(files(t, 'archive/rejected').length, rej + 1, 'archived to rejected: ' + why);
  assert.equal(sends(t).length, n, 'no chat message: ' + why + ' → ' + JSON.stringify(texts(t).slice(n)));
  assert.deepEqual(sheets(t), before, 'no Sheet row changed: ' + why);
  return audits(t, 'envelope_rejected').slice(-1)[0];
}

/* ---------------- fixtures (invented) ---------------- */
const title = (slug) => slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
const item = (n, slug, over = {}) => ({ n, slug, name: title(slug), why_you: 'Quiet before noon.', fit: 0.8, est_minutes: 60,
  area: 'Old quay', maps_url: maps('FixtureHt' + n), labels: ['verified'], ...over });
const shortlist = (over = {}, itemOver = {}) => ({ trip: TRIP, run_id: 'ht-r1-a', round: 1, more: false, decided: [],
  groups: [{ id: 'activities', items: [item(1, 'tide-clock-museum', itemOver)] }], ...over });
const stop = (n, slug, over = {}) => ({ n, slug, name: title(slug), arrive: '10:00', depart: '11:00', minutes: 60, maps_url: maps('FixtureStop' + n), note_line: 'Go early.', ...over });
const digest = (over = {}, dayOver = {}, stopOver = {}) => ({ trip: TRIP, build_id: 'build-ht-1', verified_on: '2027-04-21',
  days: [{ date: '2027-05-12', theme: 'Quay and clocks', stops: [stop(1, 'tide-clock-museum', stopOver)], legs: [{ from: 'lodging', to: 'tide-clock-museum', mode: 'WALK', minutes: 8 }], warnings: [], ...dayOver }],
  later: [{ slug: 'gull-rock-lighthouse', name: 'Gull Rock Lighthouse', reason: 'owner_choice' }],
  drive: { plan: null, brochure_html: null, brochure_pdf: null }, ...over });
const place = (slug, over = {}) => ({ slug, name: title(slug), area: 'Old quay', category: 'museum', tags: ['history'], status: 'candidate',
  last_trip: null, last_researched: '2027-04-21', last_verified: null, note_line: 'Quiet before noon.', maps_url: maps('FixturePl' + slug.length), history_summary: '', ...over });
const places = (over = {}) => ({ destination: TRIP, places: [place('tide-clock-museum', over)] });
const CID = 'c_0a1b2c3d4e', CID2 = 'c_1b2c3d4e5f';
const pfItem = (cid, over = {}) => ({ cid, dimension: 'pace', value: 'relaxed', stance: '+', statement: 'You like a relaxed pace', suspect: false,
  text: 'You like a relaxed pace (from the interview)', buttons: [[{ text: 'Yes', data: 'pf:' + cid + ':y' }, { text: 'No', data: 'pf:' + cid + ':n' }]], ...over });
const prefsReview = (items) => ({ v: 1, kind: 'prefs_review', vocab: 'travel', batch_id: 'pfb_0123456789abcdef', more: 0, held_back: [], items: items || [pfItem(CID)] });
const env = (type, payload, over) => H.envelope(type, payload, over);

/* ---------------- tests ---------------- */
test('A1 plan_digest over the pack cap (60 000 chars, under the core cap) → refused: rejected, no chat message, no Sheet row', () => {
  const t = fresh();
  const p = digest({ later: [] });
  for (let i = 0; JSON.stringify(p).length <= 61000; i++) p.later.push({ slug: 'later-' + i, name: 'Later place ' + i, reason: 'r'.repeat(300) });
  assert.ok(JSON.stringify(p).length < 65536, 'stays under ENVELOPE_MAX_PAYLOAD_CHARS so the pack cap is what refuses it');
  const a = refused(t, env('plan_digest', p), 'pack cap');
  assert.match(a.detail_json, /payload is \d+ chars \(max 60000\)/);
  assert.equal(t.ctx.tgTripGet(TRIP), null, 'no trip row written');
});

test('A2 payload over ENVELOPE_MAX_PAYLOAD_CHARS and one string over ENVELOPE_MAX_TEXT_CHARS → refused by the core before the pack sees them', () => {
  const t = fresh();
  const big = digest({ later: [] });
  for (let i = 0; JSON.stringify(big).length <= 66000; i++) big.later.push({ slug: 'later-' + i, name: 'Later place ' + i, reason: 'r'.repeat(300) });
  assert.match(refused(t, env('plan_digest', big), 'core payload cap').detail_json, /payload too large/);
  assert.match(refused(t, env('profile_summary', { text: 'x'.repeat(16001) }), 'core string cap').detail_json, /a payload string exceeds 16000 chars/);
  assert.match(refused(t, env('notice', { text: 'y'.repeat(16001) }), 'core string cap on a core type').detail_json, /exceeds 16000/);
});

test('A3 wrong types (items not an array, name a number, days a string, dates not YYYY-MM-DD or not real) → refused', () => {
  const t = fresh();
  const s1 = shortlist(); s1.groups[0].items = 'tide-clock-museum';
  assert.match(refused(t, env('shortlist', s1), 'items not an array').detail_json, /items must be an array/);
  assert.match(refused(t, env('shortlist', shortlist({}, { name: 42 })), 'name a number').detail_json, /name must be a string/);
  assert.match(refused(t, env('plan_digest', digest({ days: 'Monday' })), 'days a string').detail_json, /days must be an array/);
  assert.match(refused(t, env('plan_digest', digest({}, { date: '12/05/2027' })), 'date not ISO').detail_json, /calendar date/);
  assert.match(refused(t, env('trip_facts', { trip: TRIP, found: [{ n: 1, kind: 'dates', text: 'Feb', start: '2027-02-30', end: null }], missing: [] }), 'not a real date').detail_json, /calendar date/);
  assert.match(refused(t, env('places_digest', places({ tags: 'history' })), 'tags a string').detail_json, /tags must be an array/);
  assert.match(refused(t, env('prefs_review', { ...prefsReview(), items: { 0: pfItem(CID) } }), 'items an object').detail_json, /items must be an array/);
});

test('A4 Google fields (rating, hours, photos, reviews, phone …) in shortlist, places_digest and plan_digest → refused, own data only', () => {
  const t = fresh();
  for (const f of GOOGLE_FIELDS) {
    const v = /photos|reviews/.test(f) ? [{ text: 'fixture' }] : /hours/.test(f) ? { open_now: true } : f === 'phone' || f === 'formatted_address' ? '+00 fixture' : 4.5;
    refused(t, env('shortlist', shortlist({}, { [f]: v })), 'shortlist item ' + f);
    assert.match(refused(t, env('places_digest', places({ [f]: v })), 'places_digest ' + f).detail_json, new RegExp('(Google field|unknown key) \\\\"' + f + '\\\\"'));
    refused(t, env('plan_digest', digest({}, {}, { [f]: v })), 'plan_digest stop ' + f);
  }
  assert.equal(t.ctx.tgPlacesSearch('tide', { limit: 5 }).length, 0, 'nothing reached the Places tab');
});

const INJ = '<u>U</u><script>S</script><s>&amp;</s>';
/** No brain tag reached Telegram raw; the escaped form did. */
function escapedOnly(list, why) {
  const all = list.join('\n');
  assert.ok(!/<u>|<script|<s>|<\/u>|<\/s>/i.test(all), 'raw brain HTML reached the chat (' + why + '): ' + all.slice(0, 400));
  assert.ok(all.includes('&lt;u&gt;U&lt;/u&gt;&lt;script&gt;S&lt;/script&gt;&lt;s&gt;&amp;amp;&lt;/s&gt;'), 'escaped form present (' + why + ')');
}
test('A5 HTML in every free-text field (name, why_you, gem_line, note_line, theme, warnings, later, statement, text) arrives escaped — and again when read back from the Sheet', () => {
  const t = fresh('2027-05-12T08:00:00Z');
  let n = sends(t).length;
  drop(t, env('shortlist', shortlist({}, { name: 'Tide ' + INJ, why_you: 'Why ' + INJ, area: 'Area ' + INJ, gem: true, gem_line: 'Gem ' + INJ, changes: ['Ch ' + INJ] })));
  escapedOnly(texts(t).slice(n), 'shortlist renderer');
  n = sends(t).length;
  drop(t, env('trip_facts', { trip: TRIP, found: [{ n: 1, kind: 'booking', text: 'Ferry ' + INJ }], missing: [] }));
  escapedOnly(texts(t).slice(n), 'trip_facts renderer');
  n = sends(t).length;
  drop(t, env('plan_digest', digest({ later: [{ slug: 'gull-rock-lighthouse', name: 'Gull ' + INJ, reason: 'Why ' + INJ }] },
    { theme: 'Theme ' + INJ, warnings: ['Warn ' + INJ] }, { name: 'Stop ' + INJ, note_line: 'Note ' + INJ })));
  escapedOnly(texts(t).slice(n), 'plan_digest renderer');
  n = sends(t).length;
  drop(t, env('places_digest', places({ name: 'Place ' + INJ, area: 'Quay ' + INJ, note_line: 'Note ' + INJ })));
  n = sends(t).length;
  drop(t, env('prefs_review', prefsReview([pfItem(CID, { statement: 'St ' + INJ, text: 'Tx ' + INJ, suspect: true })])));
  escapedOnly(texts(t).slice(n), 'prefs_review items');
  n = sends(t).length;
  drop(t, env('profile_summary', { text: 'Profile ' + INJ }));
  escapedOnly(texts(t).slice(n), 'profile_summary');
  // Read back from the Sheet: the commands render what the handlers stored.
  t.ctx.settingSet('tg_current_trip', TRIP);
  for (const cmd of ['/trip', '/today', '/day 1', '/later', '/places tide', '/place stop', '/profile']) {
    n = sends(t).length;
    say(t, cmd);
    escapedOnly(texts(t).slice(n), cmd + ' (Sheet read-back)');
  }
});

test('A6 maps_url that is not https (javascript:, data:, http:) → refused; a https link to a non-Google host is shown unlinked (FIXED)', () => {
  const t = fresh();
  for (const u of ['javascript:alert(1)', 'data:text/html,<b>x</b>', 'http://www.google.com/maps/x', 'https://exa mple.org/x', ' https://www.google.com/maps']) {
    refused(t, env('shortlist', shortlist({}, { maps_url: u })), 'shortlist maps_url ' + u);
    refused(t, env('plan_digest', digest({}, {}, { maps_url: u })), 'stop maps_url ' + u);
    refused(t, env('places_digest', places({ maps_url: u })), 'place maps_url ' + u);
  }
  // Accepted by the schema (https), but a lookalike or foreign host must not become a tappable link behind a place name.
  const hosts = ['https://login.example.net/maps?q=tide', 'https://www.google.com.example.net/maps/x', 'https://www.google.com@example.net/maps/x', 'https://example.net/www.google.com/maps'];
  hosts.forEach((u, i) => {
    const n = sends(t).length;
    const out = drop(t, env('shortlist', shortlist({ run_id: 'ht-host-' + i }, { name: 'Tide Host ' + i, maps_url: u })));
    assert.equal(out.processed, 1);
    const all = texts(t).slice(n).join('\n');
    assert.match(all, new RegExp('Tide Host ' + i), 'the name is still shown');
    assert.ok(!/<a href="https:\/\/(login|example|www\.google\.com\.example|www\.google\.com@)/.test(all), 'no link to ' + u + ': ' + all.slice(0, 300));
  });
  const n = sends(t).length;
  drop(t, env('shortlist', shortlist({ run_id: 'ht-ok' }, { name: 'Tide Google', maps_url: 'https://maps.google.com/?cid=1234567890' })));
  assert.match(texts(t).slice(n).join('\n'), /<a href="https:\/\/maps\.google\.com\/\?cid=1234567890">Tide Google<\/a>/, 'a Google Maps link is still linked');
});

test('A7 invisible and bidi unicode (U+200B, U+202E, U+FEFF, U+2066, U+0007) in brain text never reaches the chat (FIXED: stripped)', () => {
  const t = fresh();
  const HID = 'Tide​‮esuoh‬﻿⁦x⁩\u0007';
  drop(t, env('shortlist', shortlist({}, { name: HID, why_you: 'Quiet' + HID })));
  drop(t, env('profile_summary', { text: 'Pace' + HID + '\nMornings: early' }));
  drop(t, env('places_digest', places({ name: 'Clock' + HID, note_line: 'Note' + HID })));
  const all = texts(t).join('\n');
  assert.ok(!/[​‎‏‪-‮⁠⁦-⁩﻿\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(all), 'hidden characters stripped: ' + JSON.stringify(all.slice(0, 300)));
  assert.match(all, /Tideesuohx/, 'the visible letters stay');
  assert.match(all, /PaceTideesuohx\nMornings: early/, 'newlines in brain text stay');
  assert.ok(!/[‮​]/.test(JSON.stringify(t.ctx.tgPlacesSearch('clock', { limit: 3 }))), 'and the Places tab stores the clean text');
});

test('A8 reply with html:true and hostile HTML (<script>, an unknown tag, an unbalanced <b>) → the core allow-lists the tags (tgSafeHtml): script and blink become visible text; the unbalanced <b> still trips Telegram and is resent plain (FIXED by R1)', () => {
  const t = fresh();
  say(t, 'what is on tomorrow?');
  const reqId = t.ctx.storeAll('Requests').slice(-1)[0].id;
  t.state.fetch.responder = (url, rec) => (/\/sendMessage$/.test(url) && rec.json && rec.json.parse_mode === 'HTML' && /<script|<blink|<b>[^<]*$/.test(rec.json.text)
    ? { code: 400, body: { ok: false, error_code: 400, description: 'Bad Request: can\'t parse entities: Unsupported start tag "script" at byte offset 0' } } : null);
  const n = sends(t).length;
  const out = drop(t, env('reply', { text: '<script>alert(1)</script><blink>Ferry</blink> <b>leaves at 10', html: true }, { in_reply_to: reqId }));
  assert.equal(out.processed, 1);
  const sent = sends(t).slice(n);
  assert.equal(sent.length, 2, 'one refused HTML send, one plain resend');
  assert.equal(sent[0].parse_mode, 'HTML');
  assert.equal(sent[0].text, '&lt;script&gt;alert(1)&lt;/script&gt;&lt;blink&gt;Ferry&lt;/blink&gt; <b>leaves at 10', 'only the allow-listed tag survives as a tag');
  assert.equal(sent[1].parse_mode, undefined, 'the resend has no parse_mode');
  assert.equal(sent[1].text, '<script>alert(1)</script><blink>Ferry</blink> leaves at 10', 'the owner sees the brain\'s literal text, no tag executes');
  assert.equal(J(t.ctx.getRequest(reqId)).status, 'answered');
  // Without the html flag the same text is escaped and Telegram never sees a tag.
  t.state.fetch.responder = null;
  drop(t, env('reply', { text: '<script>alert(1)</script>' }, { in_reply_to: reqId }));
  assert.equal(sends(t).slice(-1)[0].text, '&lt;script&gt;alert(1)&lt;/script&gt;');
});

test('A9 reply.drive_file_ids with an HTML label or an id containing "/" → refused by _driveFileIdsErrors; no document, no message', () => {
  const t = fresh();
  say(t, 'send me the plan');
  const reqId = t.ctx.storeAll('Requests').slice(-1)[0].id;
  refused(t, env('reply', { text: 'Here it is', drive_file_ids: { '<b>Plan</b>': 'fixtureDriveFile0001' } }, { in_reply_to: reqId }), 'HTML label');
  refused(t, env('reply', { text: 'Here it is', drive_file_ids: { Plan: '../fixture/DriveFile01' } }, { in_reply_to: reqId }), 'id with /');
  refused(t, env('reply', { text: 'Here it is', drive_file_ids: { Plan: 'short' } }, { in_reply_to: reqId }), 'id too short');
  assert.equal(t.state.fetch.telegram('sendDocument').length, 0);
});

test('A10 profile_summary.text of 1200 chars accepted, 1201 refused (nothing stored, no message)', () => {
  const t = fresh();
  refused(t, env('profile_summary', { text: 'p'.repeat(1201) }), '1201 chars');
  assert.equal(t.ctx.settingGet('tg_profile_summary', ''), '');
  const n = sends(t).length;
  assert.equal(drop(t, env('profile_summary', { text: 'p'.repeat(1200) })).processed, 1);
  assert.equal(sends(t).length, n + 1);
  assert.equal(JSON.parse(t.ctx.settingGet('tg_profile_summary', '{}')).text.length, 1200);
});

test('A11 prefs_review: button data not pf:<cid>:[yen], a cid not the item\'s own, more than 40 items → refused, no buttons sent', () => {
  const t = fresh();
  for (const data of ['pf:' + CID + ':x', 'ps:' + CID + ':n', 'pl:br:harbor-town', 'pf:' + CID + ':y:extra', 'pf:c_ZZZZZZZZZZ:y']) {
    refused(t, env('prefs_review', prefsReview([pfItem(CID, { buttons: [[{ text: 'Go', data }]] })])), 'button data ' + data);
  }
  refused(t, env('prefs_review', prefsReview([pfItem(CID, { buttons: [[{ text: 'Yes', data: 'pf:' + CID2 + ':y' }]] })])), 'a cid not the item\'s own');
  const many = Array.from({ length: 41 }, (_, i) => pfItem('c_' + (0x1000000000 + i).toString(16).slice(-10)));
  refused(t, env('prefs_review', prefsReview(many)), '41 items');
  assert.equal(t.ctx.settingGet('tg_pf_batches', ''), '', 'no batch stored');
});

test('A12 created_at 15 days old or 2 days ahead → refused; in_reply_to naming no request → processed without error (ACCEPTED)', () => {
  const t = fresh();
  const old = new Date(Date.parse(START) - 15 * 86400000).toISOString(), ahead = new Date(Date.parse(START) + 2 * 86400000).toISOString();
  assert.match(refused(t, env('profile_summary', { text: 'Pace: relaxed' }, { created_at: old }), '15 days old').detail_json, /older than 14 days/);
  assert.match(refused(t, env('profile_summary', { text: 'Pace: relaxed' }, { created_at: ahead }), 'in the future').detail_json, /in the future/);
  const n = sends(t).length;
  const out = drop(t, env('profile_summary', { text: 'Pace: relaxed' }, { in_reply_to: 'req-does-not-exist-0001' }));
  assert.equal(out.processed, 1, 'the content is valid; the unknown in_reply_to marks nothing');
  assert.equal(sends(t).length, n + 1);
  assert.equal(t.ctx.getRequest('req-does-not-exist-0001'), null);
});

test('A13 a second envelope with the same dedupe_key → duplicate, archived, no second message', () => {
  const t = fresh();
  const n = sends(t).length;
  assert.equal(drop(t, env('profile_summary', { text: 'Pace: relaxed' }, { dedupe_key: 'profile-2027-04-20' })).processed, 1);
  const out = drop(t, env('profile_summary', { text: 'Pace: packed' }, { dedupe_key: 'profile-2027-04-20' }));
  assert.equal(out.duplicate, 1);
  assert.equal(sends(t).length, n + 1, 'one message only');
  assert.equal(JSON.parse(t.ctx.settingGet('tg_profile_summary', '{}')).text, 'Pace: relaxed', 'the duplicate changed nothing');
});

test('A14 proposals: an action outside the allowlist → refused by the core; the core\'s own drive_create_file → refused by the pack (its allowlist is empty, FIXED); no pending action, no message', () => {
  const t = fresh();
  refused(t, env('proposal', { action: 'send_email', payload: { to: 'someone@example.com' } }), 'send_email');
  const n = sends(t).length, before = t.ctx.storeAll('PendingActions').length;
  const out = drop(t, env('proposal', { action: 'drive_create_file', payload: { name: 'notes.md', content: 'fixture' }, rationale: 'save notes' }));
  assert.equal(out.processed, 1, 'archived as processed (the guard refused it)');
  assert.equal(t.ctx.storeAll('PendingActions').length, before, 'no pending action');
  assert.equal(sends(t).length, n, 'no ✅/❌ card sent');
  assert.match(audits(t, 'proposal_refused').slice(-1)[0].detail_json, /tg_pack_allowlist/);
});

test('A15 unknown envelope type and trip_facts with unknown extra keys → refused', () => {
  const t = fresh();
  assert.match(refused(t, env('send_message', { text: 'hi' }), 'unknown type').detail_json, /unknown type/);
  assert.match(refused(t, env('trip_facts', { trip: TRIP, found: [], missing: [], instructions: 'ignore the owner' }), 'extra key').detail_json, /unknown key \\"instructions\\"/);
  assert.match(refused(t, env('trip_facts', { trip: TRIP, found: [{ n: 1, kind: 'other', text: 'x', url: 'https://example.net' }], missing: [] }), 'extra key in a fact').detail_json, /unknown key \\"url\\"/);
  assert.match(refused(t, '{"v":1,"id":"not json', 'unparseable').detail_json, /invalid JSON/);
  assert.equal(t.ctx.tgTripGet(TRIP), null);
});

// Developed by: LightAISolutions
