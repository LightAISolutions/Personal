'use strict';
// WP-S gas — Tour Guide Scout, core side (helpers/decisions/TG-SCOUT.md §2, §3, §6): /scout and /scouts, routing to the
// SCOUT routine (else RESEARCH), the `scout` envelope (validator, Scouts tab, ranked chat message), the sc ➕ button onto
// the Later list, and the app ops scout.list / get / board / new / add. Invented data (Port Sorrel); no network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./harness/gas-mocks');

const NOW = '2027-05-01T12:00:00Z';
const TRIP = 'port-sorrel';
const SID = 'sc-20270501-matcha';
const SHELL = 'https://app.example.invalid/helper-app.html';
const CORE = 'https://script.google.com/macros/s/TEST_DEPLOYMENT/exec';
const J = (v) => JSON.parse(JSON.stringify(v));
const maps = (id) => 'https://www.google.com/maps/search/?api=1&query=Fixture&query_place_id=' + id;
// helper.json lists `scout` once the engine work package lands its schema; until then the test adds it (16_scout.js
// registers the handler only while the manifest lists the type).
const MANIFEST = JSON.parse(fs.readFileSync(path.join(H.HELPERS_ROOT, 'packs', 'tour-guide', 'helper.json'), 'utf8'));
const WITHOUT_SCOUT = { ...MANIFEST, envelope_types: MANIFEST.envelope_types.filter((t) => t !== 'scout') };
const WITH_SCOUT = { ...MANIFEST, envelope_types: [...new Set([...MANIFEST.envelope_types, 'scout'])] };

function fresh(o = {}) {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: NOW, manifest: o.manifest || WITH_SCOUT });
  H.bootstrap(ctx, state);
  (o.routines || ['RESEARCH']).forEach((n) => H.configureRoutine(ctx, state, n));
  if (o.shell !== false) state.props[ctx.PROP.APP_SHELL_URL] = SHELL;
  if (o.trip !== false) ctx.tgTripUpsert({ slug: TRIP, title: 'Port Sorrel', destination: 'Port Sorrel', start: '2027-05-12', end: '2027-05-14', status: 'planned' });
  return { ctx, state };
}
const post = (ctx, state, upd) => ctx.doPost(H.postEvent('tg', { k: state.props[ctx.PROP.WEBHOOK_SECRET] }, upd));
const say = (ctx, state, text) => post(ctx, state, H.tgUpdate({ text }));
const tap = (ctx, state, data) => post(ctx, state, H.tgUpdate({ callback: data }));
const sends = (state) => state.fetch.telegram('sendMessage').map((r) => r.json);
const texts = (state) => sends(state).map((m) => m.text);
const answers = (state) => state.fetch.telegram('answerCallbackQuery').map((r) => r.json);
const buttons = (m) => (m && m.reply_markup ? m.reply_markup.inline_keyboard.flat() : []);
const app = (ctx, state, op, args) => J(H.appPost(ctx, state, 'app', args === undefined ? { op } : { op, args }));
const requests = (state) => (state.drive.listFiles('TourGuide/mailbox/to-brain') || []).filter((n) => /^req_/.test(n))
  .map((n) => JSON.parse(state.drive.readFile('TourGuide/mailbox/to-brain', n)));
const fires = (state) => state.fetch.routine().map((r) => r.url);
function deliver(ctx, state, payload, over) {
  H.putEnvelope(state, H.envelope('scout', payload, over));
  return J(ctx.pollFromBrain());
}

/* ---------------- fixtures ---------------- */
const pick = (n, slug, over = {}) => ({ n, slug, name: slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '), area: 'Old harbour',
  category: 'cafe', score: Math.max(0, 95 - n * 5), parts: { topic: 90, quality: 80, fit: 70, reach: 60 }, why_you: 'Ceremonial grade, a quiet room upstairs.',
  labels: [], maps_url: maps('FixtureM' + n), reach: { minutes: 6 + n, mode: 'WALK', estimated: false }, ...over });
const scout = (over = {}) => ({ v: 1, kind: 'scout', scout_id: SID, query: 'matcha', destination: TRIP, place_label: 'Port Sorrel, Fictland',
  trip: TRIP, group: 'food', created_on: '2027-05-01', diet: 'vegetarian',
  items: [pick(1, 'tide-tea-house', { labels: ['gem', 'veg_verified'], try: 'usucha with a yuzu sweet', rated: 'excellent' }),
    pick(2, 'kelp-and-whisk', { reach: { minutes: 14, mode: 'TRANSIT', estimated: true } }), pick(3, 'lantern-matcha-bar', { maps_url: 'https://evil.example.invalid/x' })],
  left_out: [{ name: 'Gull Cafe', reason: 'closed_on_trip' }, { name: 'Brine Bakery', reason: 'off_topic' }, { name: 'Pier Kiosk', reason: 'closed_on_trip' }],
  more: 4, drive: { board_html: 'fixtureBoardHtml01', board_pdf: 'fixtureBoardPdf01' }, ...over });
const digest = () => ({ v: 1, kind: 'plan_digest', trip: TRIP, build_id: 'build-sc-1', verified_on: '2027-04-30',
  days: [{ date: '2027-05-12', theme: 'Harbour', stops: [], legs: [], warnings: [] }, { date: '2027-05-13', theme: 'Hill', stops: [], legs: [], warnings: [] }],
  later: [], drive: { plan: 'fixtureDrivePlanFile01', brochure_html: null, brochure_pdf: null } });

/* ---------------- tests ---------------- */
test('routing: kind scout fires SCOUT when its URL and token are set, else RESEARCH (the trip-research routine)', () => {
  const a = fresh({ routines: ['RESEARCH'] });
  assert.equal(a.ctx.tgKindRoutine('scout'), 'RESEARCH');
  say(a.ctx, a.state, '/scout matcha');
  assert.deepEqual(fires(a.state), ['https://api.anthropic.com/v1/routines/test_research/fire']);
  assert.ok(J(a.ctx.storeAll(a.ctx.SHEETS.AUDIT)).some((r) => r.event === 'request_opened' && /"kind":"scout","routine":"RESEARCH"/.test(r.detail_json)));

  const b = fresh({ routines: ['RESEARCH', 'SCOUT'] });
  assert.equal(b.ctx.tgKindRoutine('scout'), 'SCOUT');
  say(b.ctx, b.state, '/scout matcha');
  assert.deepEqual(fires(b.state), ['https://api.anthropic.com/v1/routines/test_scout/fire']);
  // a URL without its token is not "configured": the RESEARCH routine still takes it
  b.state.props[b.ctx.routineProp('SCOUT', 'TOKEN')] = '';
  assert.equal(b.ctx.tgKindRoutine('scout'), 'RESEARCH');
  // the other kinds are unchanged
  assert.equal(b.ctx.tgKindRoutine('research'), 'RESEARCH');
  assert.equal(b.ctx.tgKindRoutine('plan'), 'PLAN');
});

test('/scout <what>: the current trip\'s destination; /scout <what> in <where>: that place (the trip only when it is the same place)', () => {
  const { ctx, state } = fresh();
  say(ctx, state, '/scout matcha');
  say(ctx, state, '/scout vegetarian ramen in Gull Bay');
  say(ctx, state, '/scout yuzu sweets in port sorrel old town');
  const rq = requests(state).map((r) => r.payload);
  assert.equal(rq.length, 3);
  assert.deepEqual(rq.map((p) => [p.kind, p.query, p.where, p.destination, p.trip]), [
    ['scout', 'matcha', 'Port Sorrel', TRIP, TRIP],
    ['scout', 'vegetarian ramen', 'Gull Bay', undefined, undefined],
    ['scout', 'yuzu sweets', 'port sorrel old town', TRIP, TRIP]]);
  assert.equal(rq[1].text, '/scout vegetarian ramen in Gull Bay');
  assert.deepEqual(texts(state), ['🔎 Scouting <b>matcha</b> in <b>Port Sorrel</b>…', '🔎 Scouting <b>vegetarian ramen</b> in <b>Gull Bay</b>…',
    '🔎 Scouting <b>yuzu sweets</b> in <b>port sorrel old town</b>…']);
  // "in" inside the query: the last " in " splits
  assert.deepEqual(J(ctx.tgScoutParse('dim sum in a garden in Gull Bay')), { what: 'dim sum in a garden', where: 'Gull Bay' });
  assert.deepEqual(J(ctx.tgScoutParse('matcha near Old Harbour, Port Sorrel')), { what: 'matcha', where: 'Old Harbour, Port Sorrel' });
  assert.deepEqual(J(ctx.tgScoutParse('matcha')), { what: 'matcha', where: '' });
  // markup in the owner's words is escaped in the acknowledgement
  say(ctx, state, '/scout <b>tea</b> in Gull & Bay');
  assert.equal(texts(state).pop(), '🔎 Scouting <b>&lt;b&gt;tea&lt;/b&gt;</b> in <b>Gull &amp; Bay</b>…');
});

test('/scout with no trip and no place, an empty /scout and an oversize query: a usage reply, no request', () => {
  const { ctx, state } = fresh({ trip: false });
  say(ctx, state, '/scout matcha');
  say(ctx, state, '/scout');
  say(ctx, state, '/scout ' + 'm'.repeat(81) + ' in Gull Bay');
  say(ctx, state, '/scout matcha in ' + 'g'.repeat(81));
  assert.equal(requests(state).length, 0);
  assert.equal(fires(state).length, 0);
  const t = texts(state);
  assert.match(t[0], /^🔎 Where should I look\? There is no current trip to search\. <code>\/scout matcha in &lt;city&gt;<\/code>$/);
  assert.match(t[1], /^🔎 What should I look for, and where\? <code>\/scout matcha in Kyoto<\/code>/);
  assert.match(t[2], /keep what to look for under 80 characters — nothing was asked/);
  assert.match(t[3], /keep the place under 80 characters — nothing was asked/);
  // with an explicit place it works without a trip
  say(ctx, state, '/scout matcha in Gull Bay');
  assert.deepEqual(requests(state).map((r) => [r.payload.query, r.payload.where, r.payload.trip]), [['matcha', 'Gull Bay', undefined]]);
});

test('a scout request with no routine configured: the request file is still written and the owner is told what is missing', () => {
  const { ctx, state } = fresh({ routines: [] });
  say(ctx, state, '/scout matcha');
  assert.equal(requests(state).length, 1);
  assert.equal(fires(state).length, 0);
  assert.doesNotMatch(texts(state).join('\n'), /Scouting/, 'the "scouting…" acknowledgement only follows a fired routine');
  assert.match(texts(state)[0], /no routine answers <code>scout<\/code> yet — set <code>ROUTINE_FIRE_URL_RESEARCH<\/code>/);
});

test('the scout envelope: stored in the Scouts tab (own fields only), the ranked message with ➕ buttons and the board button', () => {
  const { ctx, state } = fresh();
  const st = deliver(ctx, state, scout());
  assert.equal(st.processed, 1, JSON.stringify(st));
  const rows = J(ctx.storeAll('Scouts'));
  assert.equal(rows.length, 1);
  const r = rows[0];
  assert.deepEqual(Object.keys(r).filter((k) => k !== '_row').sort(), ['count', 'created_on', 'destination', 'drive_html', 'drive_pdf', 'group', 'id', 'items_json',
    'left_json', 'place_label', 'query', 'received_at', 'trip'].sort());
  assert.deepEqual([r.id, r.query, r.destination, r.place_label, r.trip, r.group, Number(r.count), r.drive_html, r.drive_pdf],
    [SID, 'matcha', TRIP, 'Port Sorrel, Fictland', TRIP, 'food', 3, 'fixtureBoardHtml01', 'fixtureBoardPdf01']);
  const items = JSON.parse(r.items_json);
  assert.deepEqual(items.map((i) => [i.n, i.slug, i.score]), [[1, 'tide-tea-house', 90], [2, 'kelp-and-whisk', 85], [3, 'lantern-matcha-bar', 80]]);
  assert.equal(items[2].maps_url, '', 'a link that is not Google Maps is not kept');
  assert.equal(items[0].try, 'usucha with a yuzu sweet');
  assert.deepEqual(JSON.parse(r.left_json), [{ name: 'Gull Cafe', reason: 'closed_on_trip' }, { name: 'Brine Bakery', reason: 'off_topic' }, { name: 'Pier Kiosk', reason: 'closed_on_trip' }]);

  const msgs = sends(state);
  assert.equal(msgs.length, 1);
  const m = msgs[0];
  const lines = m.text.split('\n');
  assert.equal(lines[0], '🔎 <b>Matcha in Port Sorrel</b> — 3 picks, ranked for you');
  assert.equal(lines[1], '<b>1.</b> <a href="' + maps('FixtureM1').replace(/&/g, '&amp;') + '">Tide Tea House</a> 💎 🌱 · Old harbour · 🚶 7 min — <i>Ceremonial grade, a quiet room upstairs.</i>');
  assert.match(lines[2], /^<b>2\.<\/b> <a href="[^"]+">Kelp And Whisk<\/a> · Old harbour · 🚇 ~14 min — <i>/);
  assert.match(lines[3], /^<b>3\.<\/b> Lantern Matcha Bar · Old harbour · 🚶 9 min — <i>/, 'no link without a Maps URL');
  assert.equal(lines[4], '<i>Left out: 2 closed on your days · 1 off topic</i>');
  assert.equal(lines[6], '➕ puts a pick on the Later list of Port Sorrel.');
  const bs = buttons(m);
  assert.deepEqual(bs.filter((b) => b.callback_data).map((b) => [b.text, b.callback_data]), [['➕ 1', 'sc:' + SID + ':1'], ['➕ 2', 'sc:' + SID + ':2'], ['➕ 3', 'sc:' + SID + ':3']]);
  const wa = bs.filter((b) => b.web_app);
  assert.equal(wa.length, 1);
  assert.equal(wa[0].text, '📱 Open the board');
  assert.equal(wa[0].web_app.url, SHELL + '?core=' + encodeURIComponent(CORE) + '&screen=scout&trip=' + TRIP + '&scout=' + SID);
  assert.doesNotMatch(m.text, /90|85|score|excellent|usucha/, 'scores, the rating band and "try" stay on the board');
});

test('the scout envelope: a re-delivered scout_id replaces its row; an empty scout says so; no shell → no app button; in reply to the request it closes it', () => {
  const { ctx, state } = fresh({ shell: false });
  say(ctx, state, '/scout matcha');
  const req = requests(state)[0];
  assert.equal(deliver(ctx, state, scout(), { in_reply_to: req.id }).processed, 1);
  assert.equal(requests(state).length, 0, 'the answered request file is archived');
  assert.equal(deliver(ctx, state, scout({ items: [], left_out: [{ name: 'Gull Cafe', reason: 'unproven' }], drive: undefined })).processed, 1);
  const rows = J(ctx.storeAll('Scouts'));
  assert.equal(rows.length, 1, 'same scout_id → same row');
  assert.equal(Number(rows[0].count), 0);
  assert.equal(rows[0].drive_html, '');
  const m = sends(state).pop();
  assert.equal(m.text, '🔎 <b>Matcha in Port Sorrel</b> — nothing worth the trip this time\n<i>Left out: 1 too little evidence</i>');
  assert.equal(buttons(m).length, 0, 'nothing to add and no shell: no keyboard');
  assert.equal(sends(state).flatMap(buttons).filter((b) => b.web_app).length, 0);
});

test('the scout envelope: without `scout` in helper.json the pack still loads, the handler is not registered and the core rejects the type', () => {
  const { ctx, state } = fresh({ manifest: WITHOUT_SCOUT });
  assert.equal(ctx.ENVELOPE_TYPES.indexOf('scout'), -1);
  const st = deliver(ctx, state, scout());
  assert.equal(st.processed, 0);
  assert.equal(st.rejected, 1);
  assert.equal(J(ctx.storeAll('Scouts')).length, 0);
  // the chat side works either way
  say(ctx, state, '/scout matcha');
  assert.equal(requests(state).length, 1);
});

test('tgEnvValidateScout: a valid payload passes; Google fields are refused anywhere, in any spelling', () => {
  const { ctx } = fresh();
  const ok = (p) => J(ctx.tgEnvValidateScout(p));
  assert.deepEqual(ok(scout()), []);
  assert.deepEqual(ok(scout({ v: undefined, kind: undefined, trip: undefined, diet: undefined, more: undefined, drive: undefined })), []);
  assert.deepEqual(ok(scout({ items: [], left_out: [] })), [], 'an empty scout is a valid answer');
  const withItem = (extra) => { const p = scout(); Object.assign(p.items[0], extra); return p; };
  for (const [k, v] of [['rating', 4.7], ['userRatingCount', 812], ['regularOpeningHours', { periods: [] }], ['priceLevel', 'PRICE_LEVEL_MODERATE'],
    ['user_ratings_total', 812], ['opening_hours', {}], ['price_level', 2], ['reviews', []], ['location', { lat: 1, lng: 2 }], ['photo', 'x']]) {
    const errs = ok(withItem({ [k]: v }));
    assert.ok(errs.some((e) => e === 'items[0].' + k + ': Google field refused (own data only)'), k + ' → ' + JSON.stringify(errs));
  }
  const nested = scout(); nested.items[1].reach.rating = 5;
  assert.ok(ok(nested).some((e) => /^items\[1\]\.reach\.rating: Google field refused/.test(e)));
  assert.ok(ok(scout({ rating: 4 })).some((e) => /^rating: Google field refused/.test(e)), 'top level too');
  assert.ok(ok(withItem({ rated: '4.7 stars' })).some((e) => /rated must be a band word/.test(e)), 'a number in the band word is a rating');
});

test('tgEnvValidateScout: bad ids, rank order, enums, sizes and oversize payloads are refused', () => {
  const { ctx } = fresh();
  const errs = (p) => J(ctx.tgEnvValidateScout(p));
  const has = (p, re, why) => assert.ok(errs(p).some((e) => re.test(e)), (why || re) + ' → ' + JSON.stringify(errs(p)));
  has(scout({ scout_id: 'matcha' }), /^scout_id/, 'no sc- prefix');
  has(scout({ scout_id: 'sc-2027051-matcha' }), /^scout_id/, '7-digit date');
  has(scout({ scout_id: 'sc-20270501-Matcha' }), /^scout_id/, 'capitals');
  has(scout({ scout_id: 'sc-20270501-' + 'm'.repeat(41) }), /^scout_id/, 'too long');
  has(scout({ destination: 'Port Sorrel' }), /^destination/);
  has(scout({ trip: '../x' }), /^trip/);
  has(scout({ group: 'shops' }), /^group/);
  has(scout({ created_on: '2027-13-01' }), /^created_on/);
  has(scout({ query: '' }), /^query/);
  has(scout({ query: 'q'.repeat(81) }), /^query/);
  has(scout({ extra: 1 }), /extra/, 'unknown key');
  has(scout({ kind: 'shortlist' }), /kind must be "scout"/);
  has(scout({ drive: { board_html: 'bad id!' } }), /^drive\.board_html/);
  const swapped = scout(); swapped.items.reverse();
  has(swapped, /items\[0\]\.n must be 1 \(rank order\)/);
  const dupe = scout(); dupe.items[1].slug = dupe.items[0].slug;
  has(dupe, /slug/, 'duplicate slugs');
  const p = scout(); p.items[0].labels = ['gem', 'gem'];
  has(p, /duplicate label/);
  const q = scout(); q.items[0].labels = ['five-star'];
  has(q, /items\[0\]\.labels\[0\]/);
  const r = scout(); r.items[0].reach = { minutes: 700, mode: 'BIKE', estimated: 'yes' };
  has(r, /reach\.minutes/); has(r, /reach\.mode/); has(r, /reach\.estimated/);
  const s = scout(); s.items[0].maps_url = 'http://maps.google.com/x';
  has(s, /items\[0\]\.maps_url/);
  const t = scout(); t.items[0].parts.fit = 101;
  has(t, /parts\.fit/);
  has(scout({ left_out: [{ name: 'x', reason: 'boring' }] }), /left_out\[0\]\.reason/);
  has(scout({ items: Array.from({ length: 21 }, (_, i) => pick(i + 1, 'cafe-' + (i + 1))) }), /^items/, 'more than 20 picks');
  has(scout({ left_out: Array.from({ length: 21 }, () => ({ name: 'x', reason: 'other' })) }), /^left_out/, 'more than 20 left out');
  const big = scout({ items: Array.from({ length: 20 }, (_, i) => pick(i + 1, 'cafe-' + (i + 1), { name: 'N'.repeat(120), why_you: 'W'.repeat(200), maps_url: maps('F'.repeat(1900)) })),
    left_out: Array.from({ length: 20 }, () => ({ name: 'L'.repeat(120), reason: 'other' })) });
  big.items.forEach((it) => { it.try = 'T'.repeat(120); it.area = 'A'.repeat(80); it.place_id = 'P'.repeat(300); });
  has(big, /payload is \d+ chars \(max 60000\)/, 'oversize');
  assert.ok(errs(big).every((e) => !/rank order/.test(e)));
  // and through the core: a refused envelope is archived, nothing is stored, the owner is not told
  const { ctx: c2, state: s2 } = fresh();
  const bad = scout(); bad.items[0].userRatingCount = 9;
  const st = deliver(c2, s2, bad);
  assert.equal(st.rejected, 1);
  assert.equal(J(c2.storeAll('Scouts')).length, 0);
  assert.equal(sends(s2).length, 0);
  assert.ok(J(c2.storeAll(c2.SHEETS.AUDIT)).some((a) => a.event === 'envelope_rejected' && /userRatingCount: Google field refused/.test(a.detail_json)));
});

test('sc ➕: the pick goes on the Later list of the scout\'s trip, with one button per planned day (the /places ➕ answer)', () => {
  const { ctx, state } = fresh();
  H.putEnvelope(state, H.envelope('plan_digest', digest()));
  assert.equal(J(ctx.pollFromBrain()).processed, 1);
  assert.equal(deliver(ctx, state, scout()).processed, 1);
  const before = sends(state).length;
  tap(ctx, state, 'sc:' + SID + ':2');
  assert.deepEqual(J(ctx.tgLaterList(TRIP)), [{ place_slug: 'kelp-and-whisk', name: 'Kelp And Whisk', reason: 'owner_choice' }]);
  assert.equal(answers(state).pop().text, 'Added');
  const m = sends(state)[before];
  assert.equal(m.text, '🔖 <b>Kelp And Whisk</b> is on the Later list of Port Sorrel. Put it on a day now?');
  assert.deepEqual(buttons(m).map((b) => b.callback_data.split(':')[0]), ['lt', 'lt'], 'the Later list\'s day buttons');
  // the same pick again: still one row
  tap(ctx, state, 'sc:' + SID + ':2');
  assert.equal(J(ctx.tgLaterList(TRIP)).length, 1);
  tap(ctx, state, 'sc:' + SID + ':1');
  assert.deepEqual(J(ctx.tgLaterList(TRIP)).map((l) => l.place_slug), ['kelp-and-whisk', 'tide-tea-house']);
});

test('sc: a pick that is not there, a stale or forged scout key, a bad part count; with no trip on file an alert', () => {
  const { ctx, state } = fresh();
  deliver(ctx, state, scout());
  tap(ctx, state, 'sc:' + SID + ':9');
  assert.equal(answers(state).pop().text, 'That pick is gone — send /scouts.');
  tap(ctx, state, 'sc:sc-20270501-nothing:1');
  assert.equal(answers(state).pop().text, 'That scout is gone — send /scouts.');
  tap(ctx, state, 'sc:k0123456789ab:1');
  assert.equal(answers(state).pop().text, 'That scout is gone — send /scouts.');
  tap(ctx, state, 'sc:' + SID + ':0');
  assert.equal(answers(state).pop().text, 'Unknown button');
  tap(ctx, state, 'sc:' + SID);
  assert.equal(answers(state).pop().text, 'Unknown button');
  assert.equal(J(ctx.tgLaterList(TRIP)).length, 0);

  const b = fresh({ trip: false });
  deliver(b.ctx, b.state, scout({ trip: undefined }));
  assert.equal(buttons(sends(b.state)[0]).filter((x) => x.callback_data).length, 0, 'no trip: no ➕ buttons on the message');
  tap(b.ctx, b.state, 'sc:' + SID + ':1');
  const a = answers(b.state).pop();
  assert.deepEqual([a.text, a.show_alert], ['No current trip — /plan one first.', true]);
});

test('sc ➕ on a scout run for a finished trip goes to the current trip; the longest scout id still fits a 64-byte button', () => {
  const { ctx, state } = fresh();
  ctx.tgTripUpsert({ slug: 'gull-bay-2026', title: 'Gull Bay', destination: 'Gull Bay', start: '2026-09-01', end: '2026-09-03', status: 'done' });
  deliver(ctx, state, scout({ trip: 'gull-bay-2026', destination: 'gull-bay', place_label: 'Gull Bay' }));
  assert.match(sends(state)[0].text, /Later list of Port Sorrel\./);
  tap(ctx, state, 'sc:' + SID + ':1');
  assert.deepEqual(J(ctx.tgLaterList(TRIP)).map((l) => l.place_slug), ['tide-tea-house']);
  assert.equal(J(ctx.tgLaterList('gull-bay-2026')).length, 0);

  const long = 'sc-20270501-' + 'a'.repeat(40);
  deliver(ctx, state, scout({ scout_id: long }));
  const data = buttons(sends(state).pop()).filter((x) => x.callback_data).map((x) => x.callback_data);
  assert.equal(data.length, 3);
  data.forEach((d, i) => { assert.equal(d, 'sc:' + long + ':' + (i + 1), 'the longest legal id still fits'); assert.ok(Buffer.byteLength(d) <= 64); });
  assert.equal(J(ctx.tgScoutByKey('k' + ctx.sha1Hex(long).slice(0, 12))).id, long, 'a hashed key resolves too');
  tap(ctx, state, data[2]);
  assert.ok(J(ctx.tgLaterList(TRIP)).some((l) => l.place_slug === 'lantern-matcha-bar'));
});

test('/scouts: the last 10, newest first, each with a button that sends its list again; none yet → a hint', () => {
  const { ctx, state } = fresh();
  say(ctx, state, '/scouts');
  assert.equal(texts(state).pop(), '🔎 No scouts yet — try <code>/scout matcha in Kyoto</code>.');
  for (let i = 1; i <= 12; i++) {
    state.advance && state.advance(1000);
    deliver(ctx, state, scout({ scout_id: 'sc-20270501-tea-' + i, query: 'tea ' + i }));
  }
  const n = sends(state).length;
  say(ctx, state, '/scouts');
  const m = sends(state)[n];
  const lines = m.text.split('\n');
  assert.equal(lines[0], '🔎 <b>Your last scouts</b>');
  assert.equal(lines.filter((l) => /^<b>\d+\.<\/b>/.test(l)).length, 10);
  assert.equal(lines[1], '<b>1.</b> Tea 12 in Port Sorrel · 3 picks · ' + ctx.tgCmdDate('2027-05-01'));
  const cb = buttons(m).filter((b) => b.callback_data);
  assert.deepEqual(cb.map((b) => b.text).slice(0, 3), ['🔎 1', '🔎 2', '🔎 3']);
  assert.equal(cb[0].callback_data, 'sc:sc-20270501-tea-12:s');
  assert.equal(buttons(m).filter((b) => b.web_app).length, 1);
  tap(ctx, state, cb[1].callback_data);
  assert.match(texts(state).pop(), /^🔎 <b>Tea 11 in Port Sorrel<\/b> — 3 picks/);
});

test('app scout.list and scout.get: head fields, newest first, last 20; the full record with its picks and where ➕ adds', () => {
  const { ctx, state } = fresh();
  assert.deepEqual(app(ctx, state, 'scout.list', {}), { ok: true, scouts: [], total: 0 });
  for (let i = 1; i <= 22; i++) deliver(ctx, state, scout({ scout_id: 'sc-20270501-tea-' + i, query: 'tea ' + i, drive: i === 22 ? scout().drive : undefined }));
  const l = app(ctx, state, 'scout.list');
  assert.equal(l.total, 22);
  assert.equal(l.scouts.length, 20);
  assert.deepEqual(Object.keys(l.scouts[0]).sort(), ['count', 'created_on', 'destination', 'group', 'has_board', 'has_pdf', 'id', 'place_label', 'query', 'received_at', 'trip']);
  assert.deepEqual([l.scouts[0].id, l.scouts[0].count, l.scouts[0].has_board, l.scouts[0].has_pdf], ['sc-20270501-tea-22', 3, true, true]);
  assert.deepEqual([l.scouts[1].id, l.scouts[1].has_board], ['sc-20270501-tea-21', false]);

  const g = app(ctx, state, 'scout.get', { id: 'sc-20270501-tea-22' });
  assert.equal(g.ok, true);
  assert.deepEqual(g.scout.items.map((i) => [i.n, i.slug, i.score, i.maps_url ? 'maps' : '']), [[1, 'tide-tea-house', 90, 'maps'], [2, 'kelp-and-whisk', 85, 'maps'], [3, 'lantern-matcha-bar', 80, '']]);
  assert.equal(g.scout.left_out.length, 3);
  assert.deepEqual(g.scout.add_to, { slug: TRIP, title: 'Port Sorrel' });
  assert.deepEqual(app(ctx, state, 'scout.get', { id: 'sc-20270501-nope' }), { ok: false, reason: 'no_scout', status: 404 });
  assert.equal(app(ctx, state, 'scout.get', { id: 'Not An Id' }).reason, 'bad_args');
  assert.equal(app(ctx, state, 'scout.get', {}).reason, 'missing_arg');
  assert.equal(app(ctx, state, 'scout.get', { id: SID, extra: 1 }).reason, 'bad_args');
  assert.equal(app(ctx, state, 'scout.list', { limit: 5 }).reason, 'bad_args', 'scout.list takes no arguments');
});

test('app scout.board: the board inline, as a Drive link past 900 000 chars or when not HTML, refused (and audited) outside the folder', () => {
  const { ctx, state } = fresh();
  const small = state.drive.putFile('TourGuide/Scouts', 'board-small.html', '<html><body>Matcha in Port Sorrel</body></html>', 'text/html');
  const pdf = state.drive.putFile('TourGuide/Scouts', 'board.pdf', '%PDF-fixture', 'application/pdf');
  deliver(ctx, state, scout({ drive: { board_html: small.getId(), board_pdf: pdf.getId() } }));
  const a = app(ctx, state, 'scout.board', { id: SID });
  assert.equal(a.ok, true);
  assert.equal(a.html, '<html><body>Matcha in Port Sorrel</body></html>');
  assert.equal(a.link, undefined);
  assert.match(a.pdf_link, /^https:\/\//);

  const big = state.drive.putFile('TourGuide/Scouts', 'board-big.html', '<p>' + 'x'.repeat(ctx.TG_APP_SCOUT_MAX_CHARS) + '</p>', 'text/html');
  deliver(ctx, state, scout({ drive: { board_html: big.getId() } }));
  const b = app(ctx, state, 'scout.board', { id: SID });
  assert.deepEqual([b.ok, b.html, typeof b.link, b.pdf_link], [true, undefined, 'string', undefined]);
  assert.equal(ctx.TG_APP_SCOUT_MAX_CHARS, 900000);
  // just under the limit still goes inline
  const edge = state.drive.putFile('TourGuide/Scouts', 'board-edge.html', 'y'.repeat(ctx.TG_APP_SCOUT_MAX_CHARS), 'text/html');
  deliver(ctx, state, scout({ drive: { board_html: edge.getId() } }));
  assert.equal(app(ctx, state, 'scout.board', { id: SID }).html.length, 900000);

  const txt = state.drive.putFile('TourGuide/Scouts', 'board.txt', '<p>plain</p>', 'text/plain');
  deliver(ctx, state, scout({ drive: { board_html: txt.getId() } }));
  const c = app(ctx, state, 'scout.board', { id: SID });
  assert.deepEqual([c.html, typeof c.link], [undefined, 'string'], 'only text/html goes inline');

  const out = state.drive.putFile('Elsewhere', 'other.html', '<p>not ours</p>', 'text/html');
  const outPdf = state.drive.putFile('Elsewhere', 'other.pdf', '%PDF', 'application/pdf');
  deliver(ctx, state, scout({ drive: { board_html: out.getId() } }));
  assert.deepEqual(app(ctx, state, 'scout.board', { id: SID }), { ok: false, reason: 'no_board', status: 404 });
  assert.ok(J(ctx.storeAll(ctx.SHEETS.AUDIT)).some((r) => r.event === 'tg_app_scout_outside_root' && r.ref === out.getId()));
  // a board inside, its PDF outside: the board shows, the PDF link is withheld (and audited)
  deliver(ctx, state, scout({ drive: { board_html: small.getId(), board_pdf: outPdf.getId() } }));
  const d = app(ctx, state, 'scout.board', { id: SID });
  assert.deepEqual([d.ok, typeof d.html, d.pdf_link], [true, 'string', undefined]);
  assert.ok(J(ctx.storeAll(ctx.SHEETS.AUDIT)).some((r) => r.event === 'tg_app_scout_outside_root' && r.ref === outPdf.getId()));

  deliver(ctx, state, scout({ drive: { board_html: 'fixtureMissingFile01' } }));
  assert.equal(app(ctx, state, 'scout.board', { id: SID }).reason, 'no_board');
  deliver(ctx, state, scout({ drive: undefined }));
  assert.equal(app(ctx, state, 'scout.board', { id: SID }).reason, 'no_board');
  assert.equal(app(ctx, state, 'scout.board', { id: 'sc-20270501-nope' }).reason, 'no_scout');
});

test('app scout.new and scout.add: write ops (under the lock), a request like /scout, a pick onto the Later list', () => {
  const { ctx, state } = fresh();
  ['scout.new', 'scout.add'].forEach((op) => assert.equal(ctx.TG_APP_OPS[op].write, true, op));
  ['scout.list', 'scout.get', 'scout.board'].forEach((op) => assert.ok(!ctx.TG_APP_OPS[op].write, op));
  assert.equal(ctx.tgAppNeedsLock({ body: { op: 'scout.new', args: {} } }), true);
  assert.equal(ctx.tgAppNeedsLock({ body: { op: 'scout.board', args: {} } }), false);

  const n = app(ctx, state, 'scout.new', { query: 'matcha' });
  assert.deepEqual([n.ok, n.routine, n.fired, n.query, n.where, n.trip], [true, 'RESEARCH', true, 'matcha', 'Port Sorrel', TRIP]);
  const w = app(ctx, state, 'scout.new', { query: 'ramen', where: 'Gull Bay' });
  assert.deepEqual([w.where, w.trip], ['Gull Bay', '']);
  const rq = requests(state);
  assert.deepEqual(rq.map((r) => [r.id === n.request_id || r.id === w.request_id, r.payload.kind, r.payload.query]).sort(), [[true, 'scout', 'matcha'], [true, 'scout', 'ramen']]);
  assert.deepEqual(app(ctx, state, 'scout.new', {}), { ok: false, reason: 'missing_arg', field: 'query', status: 400 });
  assert.equal(app(ctx, state, 'scout.new', { query: '   ' }).reason, 'missing_arg');
  assert.deepEqual(app(ctx, state, 'scout.new', { query: 'q'.repeat(81) }), { ok: false, reason: 'too_long', field: 'query', max: 80, status: 400 });
  assert.equal(app(ctx, state, 'scout.new', { query: 'tea', where: 'w'.repeat(81) }).reason, 'too_long');
  assert.equal(app(ctx, state, 'scout.new', { query: 7 }).reason, 'bad_args');
  assert.equal(requests(state).length, 2, 'refusals open nothing');

  deliver(ctx, state, scout());
  const a = app(ctx, state, 'scout.add', { id: SID, n: 1 });
  assert.deepEqual([a.ok, a.trip, a.slug, a.name, a.later], [true, TRIP, 'tide-tea-house', 'Tide Tea House', 1]);
  assert.deepEqual(J(ctx.tgLaterList(TRIP)).map((l) => l.place_slug), ['tide-tea-house']);
  assert.deepEqual(app(ctx, state, 'scout.add', { id: SID, n: 7 }), { ok: false, reason: 'no_pick', status: 404 });
  assert.equal(app(ctx, state, 'scout.add', { id: SID, n: 0 }).reason, 'bad_args');
  assert.equal(app(ctx, state, 'scout.add', { id: SID, n: 1.5 }).reason, 'bad_args');
  assert.equal(app(ctx, state, 'scout.add', { id: SID, n: '1' }).reason, 'bad_args');
  assert.equal(app(ctx, state, 'scout.add', { id: SID }).reason, 'missing_arg');
  assert.equal(app(ctx, state, 'scout.add', { id: 'sc-20270501-nope', n: 1 }).reason, 'no_scout');
  assert.equal(sends(state).filter((m) => /Later list/.test(m.text) && /🔖/.test(m.text)).length, 0, 'the app answers in the app, not the chat');

  const b = fresh({ trip: false });
  assert.deepEqual(app(b.ctx, b.state, 'scout.new', { query: 'matcha' }), { ok: false, reason: 'no_place', status: 400 });
  deliver(b.ctx, b.state, scout({ trip: undefined }));
  assert.deepEqual(app(b.ctx, b.state, 'scout.add', { id: SID, n: 1 }), { ok: false, reason: 'no_trip', status: 409 });
  assert.equal(app(b.ctx, b.state, 'scout.get', { id: SID }).scout.add_to, null);
});

test('a near-limit valid scout stores (place ids dropped only if the cell would overflow) and its message splits under Telegram\'s limit', () => {
  const { ctx, state } = fresh();
  const p = scout({ items: Array.from({ length: 20 }, (_, i) => pick(i + 1, 'cafe-' + (i + 1), { name: 'Cafe ' + 'N'.repeat(110), why_you: 'W'.repeat(200), place_id: 'P'.repeat(300), try: 'T'.repeat(120), area: 'A'.repeat(80) })) });
  assert.deepEqual(J(ctx.tgEnvValidateScout(J(p))), []);
  assert.equal(deliver(ctx, state, p).processed, 1);
  const rec = J(ctx.tgScoutGet(SID));
  assert.equal(rec.items.length, 20);
  assert.ok(JSON.stringify(rec.items).length <= ctx.TG_CELL_MAX);
  sends(state).forEach((m) => assert.ok(m.text.length <= 4096, 'each message fits'));
  assert.equal(sends(state).flatMap(buttons).filter((b) => b.callback_data).length, 20, 'one ➕ per pick');
});

// Developed by: LightAISolutions
