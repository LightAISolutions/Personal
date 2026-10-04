'use strict';
// Tour Guide pack — gas/32_app_api.js: the Mini App route ?route=app (every operation, its refusals, the keyboard refresh),
// the setup step app_menu_button and the web_app buttons of 10/12/20. Trips, places and wording are invented ("Port Sorrel").
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./harness/gas-mocks');

const NOW = '2027-05-01T12:00:00Z';
const TRIP = 'port-sorrel';
const SHELL = 'https://app.example.invalid/helper-app.html';
const CORE = 'https://script.google.com/macros/s/TEST_DEPLOYMENT/exec';
const J = (v) => JSON.parse(JSON.stringify(v));
const maps = (id) => 'https://www.google.com/maps/search/?api=1&query=Fixture&query_place_id=' + id;
const appUrl = (screen, trip) => SHELL + '?core=' + encodeURIComponent(CORE) + '&screen=' + screen + (trip ? '&trip=' + trip : '');

function fresh(o = {}) {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: NOW });
  H.bootstrap(ctx, state);
  ['RESEARCH', 'PLAN', 'PREFS', 'PLACES', 'NOTES'].forEach((n) => H.configureRoutine(ctx, state, n));
  if (o.shell !== false) state.props[ctx.PROP.APP_SHELL_URL] = o.shell || SHELL;
  return { ctx, state };
}
const app = (ctx, state, op, args, o) => H.appPost(ctx, state, 'app', args === undefined ? { op } : { op, args }, o);
const post = (ctx, state, upd) => ctx.doPost(H.postEvent('tg', { k: state.props[ctx.PROP.WEBHOOK_SECRET] }, upd));
const say = (ctx, state, text) => post(ctx, state, H.tgUpdate({ text }));
const sends = (state) => state.fetch.telegram('sendMessage').map((r) => r.json);
const texts = (state) => sends(state).map((m) => m.text);
const edits = (state) => state.fetch.telegram('editMessageReplyMarkup').map((r) => r.json);
const buttons = (m) => (m.reply_markup ? m.reply_markup.inline_keyboard.flat() : []);
const webApps = (state) => sends(state).flatMap(buttons).filter((b) => b.web_app);
const requests = (state) => (state.drive.listFiles('TourGuide/mailbox/to-brain') || []).filter((n) => /^req_/.test(n))
  .map((n) => JSON.parse(state.drive.readFile('TourGuide/mailbox/to-brain', n)).payload);
const reqOf = (state, kind, scope) => requests(state).filter((r) => r.kind === kind && (!scope || r.scope === scope));
const choices = (ctx, run, kind) => J(ctx.tgChoiceList(TRIP, run, kind || 'shortlist')).map((c) => c.key + '=' + c.value);
function deliver(ctx, state, type, payload) {
  H.putEnvelope(state, H.envelope(type, payload));
  return J(ctx.pollFromBrain());
}

/* ---------------- fixtures ---------------- */
const item = (n, slug, over = {}) => ({ n, slug, name: slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '),
  why_you: 'Quiet in the morning.', fit: 0.8, est_minutes: 60, area: 'Old harbour', maps_url: maps('Fixture' + n), labels: ['verified'], ...over });
const facts = (over = {}) => ({ v: 1, kind: 'trip_facts', trip: TRIP,
  found: [{ n: 1, kind: 'dates', text: 'Wed 12 to Fri 14 May', start: '2027-05-12', end: '2027-05-14' },
    { n: 2, kind: 'lodging', text: 'Old Mill Hostel', start: '2027-05-12', end: '2027-05-15' }], missing: ['lodging', 'flight'], ...over });
const shortlist = (over = {}) => ({ v: 1, kind: 'shortlist', trip: TRIP, run_id: 'r1', round: 1, more: true, decided: [],
  groups: [{ id: 'activities', items: [item(1, 'lantern-museum'), item(2, 'signal-hill-lookout', { gem: true, gem_line: 'Small and loved by locals.' })] },
    { id: 'food', items: [item(1, 'saffron-row-market', { maps_url: 'https://evil.example.invalid/x' })] }], ...over });
const digest = (over = {}) => ({ v: 1, kind: 'plan_digest', trip: TRIP, build_id: 'build-ps-1', verified_on: '2027-04-30',
  days: [{ date: '2027-05-12', theme: 'Harbour', stops: [{ n: 1, slug: 'lantern-museum', name: 'Lantern Museum', arrive: '10:00', depart: '11:00',
    minutes: 60, maps_url: maps('FixtureA'), note_line: 'Start upstairs.' }], legs: [{ from: 'lodging', to: 'lantern-museum', mode: 'WALK', minutes: 9 }],
    warnings: ['Closes early on Wednesdays.'], rain: [{ slug: 'tide-gallery', name: 'Tide Gallery', instead_of: 'lantern-museum', km: 1.2, maps_url: maps('FixtureR') }] },
  { date: '2027-05-13', theme: 'Hill', stops: [], legs: [], warnings: [] }],
  later: [{ slug: 'signal-hill-lookout', name: 'Signal Hill Lookout', reason: 'owner_choice' }, { slug: 'old-ferry-bar', name: 'Old Ferry Bar', reason: 'not_shown' }],
  drive: { plan: 'fixtureDrivePlanFile01', brochure_html: null, brochure_pdf: null }, ...over });
const place = (slug, over = {}) => ({ slug, name: slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '), area: 'Old harbour',
  category: 'museum', tags: ['rainy day'], status: 'open', last_trip: '', last_researched: '2027-03-01', last_verified: '2027-03-02',
  note_line: 'Go early.', maps_url: maps('P' + slug), history_summary: '', ...over });

/* ---------------- tests ---------------- */

test('the route: a stranger is 403 before any op; bad op, bad args, unknown arg, missing arg and oversize args are 400', () => {
  const { ctx, state } = fresh();
  const s = app(ctx, state, 'home', {}, { userId: 1 });
  assert.deepEqual([s.ok, s.status, s.reason], [false, 403, 'forbidden']);
  const t = H.initData(ctx, state).replace('auth_date=', 'auth_date=1');
  assert.equal(app(ctx, state, 'home', {}, { initData: t }).status, 403, 'tampered initData');
  assert.deepEqual(J(app(ctx, state, 'nope', {})), { ok: false, reason: 'unknown_op', status: 400 });
  assert.equal(app(ctx, state, 'toString', {}).reason, 'unknown_op', 'no prototype lookups');
  assert.equal(app(ctx, state, '').reason, 'missing_arg');
  assert.equal(app(ctx, state, 7).reason, 'unknown_op');
  assert.deepEqual(J(app(ctx, state, 'home', [1])), { ok: false, reason: 'bad_args', field: 'args', status: 400 });
  assert.deepEqual(J(app(ctx, state, 'home', { extra: 1 })), { ok: false, reason: 'bad_args', field: 'extra', status: 400 });
  assert.deepEqual(J(app(ctx, state, 'trip.digest', {})), { ok: false, reason: 'missing_arg', field: 'slug', status: 400 });
  assert.equal(app(ctx, state, 'trip.digest', { slug: 'Not A Slug' }).reason, 'bad_args');
  assert.equal(app(ctx, state, 'trip.digest', { slug: 5 }).reason, 'bad_args');
  assert.deepEqual(J(app(ctx, state, 'places.search', { query: 'x'.repeat(2000) })), { ok: false, reason: 'too_long', field: 'query', max: 200, status: 400 });
  assert.equal(app(ctx, state, 'places.search', { tag: 'x'.repeat(65) }).reason, 'too_long');
  assert.equal(app(ctx, state, 'shortlist.choose_many', { run: 'r1', choices: Array.from({ length: 201 }, () => ({ n: 'a1', choice: 'w' })) }).reason, 'too_many');
  assert.equal(app(ctx, state, 'shortlist.choose', { run: 'r1', n: 'a1', choice: 'x' }).reason, 'bad_args');
  assert.equal(app(ctx, state, 'shortlist.choose', { run: 'r 1', n: 'a1', choice: 'w' }).reason, 'bad_args');
  assert.equal(app(ctx, state, 'trip.digest', { slug: 'nowhere' }).status, 404);
  assert.equal(state.fetch.telegram('sendMessage').length, 0, 'refusals send nothing to the chat');
  // the body must be an object with op; nothing reached a handler that writes
  assert.equal(J(ctx.tgChoiceList(TRIP, 'r1', 'shortlist')).length, 0);
});

test('setup step app_menu_button: without the property nothing happens; with it the menu button opens the shell', () => {
  const { ctx, state } = fresh({ shell: false });
  const step = ctx.HB_REGISTRY.setup.app_menu_button;
  assert.ok(step && step.label);
  assert.match(step.run(), /^skipped: APP_SHELL_URL is not set/);
  assert.equal(state.fetch.telegram('setChatMenuButton').length, 0);
  state.props[ctx.PROP.APP_SHELL_URL] = 'http://app.example.invalid/helper-app.html';
  assert.match(step.run(), /^skipped: APP_SHELL_URL must be an https URL/);
  assert.equal(state.fetch.telegram('setChatMenuButton').length, 0);
  state.props[ctx.PROP.APP_SHELL_URL] = SHELL;
  assert.match(step.run(), /menu button set/);
  const calls = state.fetch.telegram('setChatMenuButton').map((r) => r.json);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].menu_button, { type: 'web_app', text: 'Tour Guide', web_app: { url: SHELL + '?core=' + encodeURIComponent(CORE) } });
});

test('web_app buttons: only with APP_SHELL_URL (one per shortlist, plan_digest and /places message set); without it the messages are unchanged', () => {
  const run = (shell) => {
    const { ctx, state } = fresh({ shell });
    ctx.tgPlacesUpsert({ destination: TRIP, places: [place('lantern-museum')] });
    const out = {
      sl: J(ctx.tgPlanShortlistMessages(shortlist())),
      adopt: J(ctx.tgPlanShortlistMessages(shortlist(), { adopt: true })),
      dg: J(ctx.tgPlanDigestMessages(digest()))
    };
    say(ctx, state, '/places');
    say(ctx, state, '/places lantern');
    out.places = sends(state).slice(-2);
    return { ctx, state, out };
  };
  const off = run(false).out, on = run(SHELL);
  const wa = (msgs) => msgs.flatMap((m) => (m.keyboard || m.reply_markup ? (m.keyboard || m.reply_markup).inline_keyboard.flat() : [])).filter((b) => b.web_app);
  ['sl', 'adopt', 'dg', 'places'].forEach((k) => assert.equal(wa(off[k]).length, 0, k + ' without the property'));
  assert.deepEqual(J(wa(on.out.sl)), [{ text: '📱 Choose in the app', web_app: { url: appUrl('shortlist', TRIP) } }]);
  assert.deepEqual(J(wa(on.out.dg)), [{ text: '📱 Open in the app', web_app: { url: appUrl('brochure', TRIP) } }]);
  assert.deepEqual(J(wa(on.out.places)).map((b) => b.web_app.url), [appUrl('places', ''), appUrl('places', '')], '/places overview and search');
  // with the app row taken off, each message is exactly what the chat sent without the property
  const strip = (msgs) => J(msgs).map((m) => {
    const key = m.keyboard ? 'keyboard' : m.reply_markup ? 'reply_markup' : null;
    if (key) m[key].inline_keyboard = m[key].inline_keyboard.filter((r) => !r.some((b) => b.web_app));
    if (key && !m[key].inline_keyboard.length) delete m[key];
    return m;
  });
  assert.deepEqual(strip(on.out.sl), off.sl);
  assert.deepEqual(strip(on.out.adopt), off.adopt);
  assert.deepEqual(strip(on.out.dg), off.dg);
  assert.deepEqual(strip(on.out.places).map((m) => m.text), off.places.map((m) => m.text));
  // the adopt branch's re-map carries the web_app button through, before ▶️ Continue choosing
  const rows = on.out.adopt[on.out.adopt.length - 1].keyboard.inline_keyboard;
  assert.ok(rows[rows.length - 2][0].web_app, 'web_app row survives the adopt re-map');
  assert.match(rows[rows.length - 1][0].callback_data, /^pl:sc:/);
  // a shell URL that is not https gives no button (tgKeyboard would throw) and one audit
  const bad = run('http://app.example.invalid/helper-app.html');
  ['sl', 'adopt', 'dg', 'places'].forEach((k) => assert.equal(wa(bad.out[k]).length, 0, k + ' with an http shell'));
  assert.ok(J(bad.ctx.storeAll(bad.ctx.SHEETS.AUDIT)).some((r) => r.event === 'tg_app_shell_url_invalid'));
});

test('a round with no plan flow: home, shortlist.get, choose and choose_many in Choices with the chat keyboard re-marked, done adopts', () => {
  const { ctx, state } = fresh();
  assert.equal(deliver(ctx, state, 'shortlist', shortlist()).processed, 1);
  const slMsgs = sends(state).filter((m) => buttons(m).some((b) => /^sl:/.test(b.callback_data || '')));
  assert.equal(slMsgs.length, 2, 'activities and food');
  const stored = JSON.parse(ctx.settingGet(ctx.TG_APP_MSGS_KEY, '[]'));
  assert.equal(stored.length, 2, 'both message ids remembered by the renderer path');

  const h = J(app(ctx, state, 'home'));
  assert.equal(h.ok, true);
  assert.deepEqual(h.choice_round, { trip: TRIP, run: 'r1', round: 1, items: 3, want: 0, later: 0, skip: 0, stage: '' });
  assert.deepEqual(h.trips.map((t) => [t.slug, t.status, t.has_brochure]), [[TRIP, 'choosing', false]]);
  assert.equal(h.pending_facts, null);
  assert.equal(h.trips_total, 1);

  const g = J(app(ctx, state, 'shortlist.get', {}));
  assert.deepEqual([g.trip, g.run, g.round, g.more, g.flow, g.stage], [TRIP, 'r1', 1, false, false, '']);
  assert.deepEqual(g.groups.map((x) => [x.id, x.title, x.items.map((i) => i.key)]), [['activities', 'Activities', ['a1', 'a2']], ['food', 'Food', ['f1']]]);
  const a2 = g.groups[0].items[1];
  assert.deepEqual([a2.n, a2.slug, a2.gem, a2.gem_line, a2.est_minutes, a2.area, a2.choice, a2.labels], [2, 'signal-hill-lookout', true, 'Small and loved by locals.', 60, 'Old harbour', '', ['verified']]);
  assert.match(a2.maps_url, /^https:\/\/www\.google\.com\/maps/);
  assert.equal(g.groups[1].items[0].maps_url, '', 'a link that is not Google Maps is not shown (the chat rule)');
  assert.deepEqual(J(app(ctx, state, 'shortlist.get', { run: 'r1' })).groups, g.groups);
  assert.equal(app(ctx, state, 'shortlist.get', { run: 'r9' }).reason, 'no_round');

  const before = edits(state).length;
  const c = J(app(ctx, state, 'shortlist.choose', { run: 'r1', n: 'a1', choice: 'w' }));
  assert.deepEqual(c, { ok: true, n: 'a1', choice: 'w', slug: 'lantern-museum', refreshed: 1 });
  assert.deepEqual(choices(ctx, 'r1'), ['lantern-museum=w']);
  const e1 = edits(state).slice(before);
  assert.equal(e1.length, 1, 'only the activities message is edited');
  assert.equal(e1[0].message_id, stored.find((x) => x.kb.flat().some((b) => b.callback_data === 'sl:r1:a1:w')).mid);
  const marked = e1[0].reply_markup.inline_keyboard.flat().filter((b) => /^• /.test(b.text)).map((b) => b.callback_data);
  assert.deepEqual(marked, ['sl:r1:a1:w']);
  assert.equal(app(ctx, state, 'shortlist.choose', { run: 'r1', n: 'a9', choice: 'w' }).reason, 'no_item');

  const m = J(app(ctx, state, 'shortlist.choose_many', { run: 'r1', choices: [{ n: 'a2', choice: 'w' }, { n: 'f1', choice: 's' }, { n: 'z9', choice: 'w' }, { n: 'a2', choice: 'l' }] }));
  assert.deepEqual(m, { ok: true, applied: 2, refused: [{ n: 'z9', reason: 'no_item' }], refreshed: 2 });
  assert.deepEqual(choices(ctx, 'r1'), ['lantern-museum=w', 'signal-hill-lookout=l', 'saffron-row-market=s'], 'the last entry for a key wins');
  const last = edits(state).slice(-2).map((e) => e.reply_markup.inline_keyboard.flat().filter((b) => /^• /.test(b.text)).map((b) => b.callback_data));
  assert.deepEqual(last, [['sl:r1:a1:w', 'sl:r1:a2:l'], ['sl:r1:f1:s']]);
  assert.equal(app(ctx, state, 'shortlist.choose_many', { run: 'r1', choices: [{ n: 'a1', choice: 'w', x: 1 }] }).reason, 'bad_args');
  assert.deepEqual(J(app(ctx, state, 'shortlist.get', {})).groups.flatMap((x) => x.items.map((i) => i.choice)), ['w', 'l', 's']);
  assert.deepEqual(J(app(ctx, state, 'home')).choice_round.want, 1);

  // the chat's own tap still works and the app sees it
  post(ctx, state, H.tgUpdate({ callback: 'sl:r1:a2:w', messageId: 91 }));
  assert.equal(J(app(ctx, state, 'shortlist.get', {})).groups[0].items[1].choice, 'w');

  // no flow: more is refused; done adopts the round and builds
  assert.deepEqual(J(app(ctx, state, 'shortlist.more', { run: 'r1' })), { ok: false, reason: 'no_flow', status: 409 });
  const d = J(app(ctx, state, 'shortlist.done', { run: 'r1' }));
  assert.deepEqual(d, { ok: true, started: true, adopted: true });
  assert.equal(ctx.flowActive('777').state.stage, 'planning');
  const plan = reqOf(state, 'plan');
  assert.equal(plan.length, 1);
  assert.deepEqual([plan[0].picks, plan[0].skip], [['lantern-museum', 'signal-hill-lookout'], ['saffron-row-market']]);
  assert.match(texts(state).join('\n'), /Building the days from 2 picks/);
  assert.equal(app(ctx, state, 'shortlist.done', { run: 'r1' }).reason, 'no_flow', 'twice: the flow is planning now');
});

test('a round inside the plan flow: ids remembered, more and gems open research rounds, done needs a pick, the flow moves on', () => {
  const { ctx, state } = fresh();
  say(ctx, state, '/plan Port Sorrel');
  deliver(ctx, state, 'shortlist', shortlist());
  assert.equal(ctx.flowActive('777').state.stage, 'choose');
  assert.equal(JSON.parse(ctx.settingGet(ctx.TG_APP_MSGS_KEY, '[]')).length, 2, 'flow path remembers too');
  const g = J(app(ctx, state, 'shortlist.get', {}));
  assert.deepEqual([g.flow, g.more], [true, true]);
  assert.deepEqual(J(app(ctx, state, 'shortlist.done', { run: 'r1' })), { ok: false, reason: 'no_picks', status: 400 });
  assert.equal(ctx.flowActive('777').state.stage, 'choose', 'left as it was');

  const mo = J(app(ctx, state, 'shortlist.more', { run: 'r1' }));
  assert.deepEqual(mo, { ok: true, started: true, gems: false });
  assert.equal(ctx.flowActive('777').state.stage, 'research');
  assert.equal(reqOf(state, 'research', 'more').length, 1);
  assert.equal(app(ctx, state, 'shortlist.more', { run: 'r1' }).reason, 'no_flow', 'while researching');

  deliver(ctx, state, 'shortlist', shortlist({ round: 2, groups: [{ id: 'activities', items: [item(3, 'tide-gallery')] }] }));
  assert.equal(JSON.parse(ctx.settingGet(ctx.TG_APP_MSGS_KEY, '[]')).length, 3);
  const g2 = J(app(ctx, state, 'shortlist.get', { run: 'r1' }));
  assert.deepEqual([g2.round, g2.groups[0].items.map((i) => i.key + '@' + i.round)], [2, ['a1@1', 'a2@1', 'a3@2']]);
  assert.equal(J(app(ctx, state, 'shortlist.more', { run: 'r1', gems: true })).gems, true);
  assert.equal(reqOf(state, 'research', 'more').filter((r) => r.gems_only).length, 1);
  deliver(ctx, state, 'shortlist', shortlist({ round: 3, groups: [{ id: 'food', items: [item(2, 'net-loft-cafe')] }] }));
  app(ctx, state, 'shortlist.more', { run: 'r1' });
  deliver(ctx, state, 'shortlist', shortlist({ round: 4, groups: [{ id: 'food', items: [item(3, 'quay-bakery')] }] }));
  assert.equal(J(app(ctx, state, 'shortlist.get', {})).more, false, 'three more-rounds used');
  assert.equal(app(ctx, state, 'shortlist.more', { run: 'r1' }).reason, 'no_more');

  const before = edits(state).length;
  assert.equal(J(app(ctx, state, 'shortlist.choose', { run: 'r1', n: 'a3', choice: 'w' })).refreshed, 1);
  assert.equal(edits(state).length, before + 1, 'the round-2 message only');
  const d = J(app(ctx, state, 'shortlist.done', { run: 'r1' }));
  assert.deepEqual(d, { ok: true, started: true, adopted: false });
  assert.deepEqual(reqOf(state, 'plan')[0].picks, ['tide-gallery']);
});

test('shortlist.get all: every round of the open choose flow, newest first; each round saves to its own run (Phase 8)', () => {
  const { ctx, state } = fresh();
  say(ctx, state, '/plan Port Sorrel');
  deliver(ctx, state, 'shortlist', shortlist());
  assert.deepEqual(J(app(ctx, state, 'shortlist.get', { all: true })).earlier, [], 'one round: nothing earlier');
  app(ctx, state, 'shortlist.more', { run: 'r1' });
  deliver(ctx, state, 'shortlist', shortlist({ run_id: 'r2', round: 2, more: false, groups: [{ id: 'activities', items: [item(1, 'tide-gallery')] }] }));
  assert.deepEqual(J(ctx.flowActive('777').state.runs), ['r1', 'r2']);
  const plain = J(app(ctx, state, 'shortlist.get', {}));
  assert.deepEqual([plain.run, plain.round, plain.earlier], ['r2', 2, []], 'without all: the newest round only, as before');
  const g = J(app(ctx, state, 'shortlist.get', { all: true }));
  assert.equal(g.run, 'r2');
  assert.deepEqual(g.earlier.map((e) => [e.run, e.round, e.groups.map((x) => x.id + ':' + x.items.map((i) => i.key).join(','))]),
    [['r1', 1, ['activities:a1,a2', 'food:f1']]]);
  assert.equal(app(ctx, state, 'shortlist.get', { all: 'yes' }).reason, 'bad_args');
  assert.equal(J(app(ctx, state, 'shortlist.choose_many', { run: 'r1', choices: [{ n: 'a2', choice: 'w' }] })).applied, 1);
  assert.equal(J(app(ctx, state, 'shortlist.choose_many', { run: 'r2', choices: [{ n: 'a1', choice: 'l' }] })).applied, 1);
  assert.deepEqual([choices(ctx, 'r1'), choices(ctx, 'r2')], [['signal-hill-lookout=w'], ['tide-gallery=l']]);
  assert.equal(J(app(ctx, state, 'shortlist.get', { all: true })).earlier[0].groups[0].items[1].choice, 'w');
  assert.deepEqual(J(app(ctx, state, 'shortlist.done', { run: 'r2' })), { ok: true, started: true, adopted: false });
  assert.deepEqual(reqOf(state, 'plan')[0].picks, ['signal-hill-lookout'], 'the earlier round pick reaches the plan');
  assert.deepEqual(J(app(ctx, state, 'shortlist.get', { all: true })).earlier, [], 'past choose: read-only, nothing earlier');
});

test('home carries the helper display name for the masthead', () => {
  const { ctx, state } = fresh();
  assert.equal(J(app(ctx, state, 'home', {})).display_name, ctx.HELPER.display_name);
});

test('shortlist.done: another flow open is busy; a round that is not the latest is no_flow; a held lock is 503', () => {
  const { ctx, state } = fresh();
  deliver(ctx, state, 'shortlist', shortlist());
  deliver(ctx, state, 'shortlist', shortlist({ run_id: 'r2' }));
  app(ctx, state, 'shortlist.choose', { run: 'r1', n: 'a1', choice: 'w' });
  assert.equal(app(ctx, state, 'shortlist.done', { run: 'r1' }).reason, 'no_flow', 'r2 is the latest round');
  say(ctx, state, '/interview');
  assert.deepEqual(J(app(ctx, state, 'shortlist.done', { run: 'r2' })), { ok: false, reason: 'busy', flow: 'interview', status: 409 });
  state.lock.busy = true;
  assert.deepEqual(J(app(ctx, state, 'shortlist.choose', { run: 'r2', n: 'a1', choice: 'w' })), { ok: false, reason: 'busy', status: 503 });
  assert.equal(app(ctx, state, 'home').ok, true, 'reads do not wait for the lock');
  state.lock.busy = false;
  assert.equal(app(ctx, state, 'shortlist.choose', { run: 'r2', n: 'a1', choice: 'w' }).ok, true);
  assert.equal(state.lock.busy, false, 'released');
});

test('facts.get and facts.confirm: the trip facts of the plan flow, stored as the chat stores them; the batch moves the flow on', () => {
  const { ctx, state } = fresh();
  assert.equal(app(ctx, state, 'facts.get', { trip: TRIP }).reason, 'no_flow');
  say(ctx, state, '/plan Port Sorrel');
  assert.equal(app(ctx, state, 'facts.get', { trip: TRIP }).reason, 'no_flow', 'still at intake');
  deliver(ctx, state, 'trip_facts', facts());
  assert.deepEqual(J(app(ctx, state, 'home')).pending_facts, { trip: TRIP });
  const g = J(app(ctx, state, 'facts.get', { trip: TRIP }));
  assert.deepEqual(g.found.map((f) => [f.n, f.kind, f.text, f.start, f.end, f.choice]),
    [[1, 'dates', 'Wed 12 to Fri 14 May', '2027-05-12', '2027-05-14', ''], [2, 'lodging', 'Old Mill Hostel', '2027-05-12', '2027-05-15', '']]);
  assert.deepEqual(g.missing, ['lodging', 'flight']);

  // a refused entry: nothing advances, the good entries are stored
  const r1 = J(app(ctx, state, 'facts.confirm', { trip: TRIP, facts: [{ n: 2, choice: 'n' }, { n: 9, choice: 'y' }], edits: [{ n: 1, text: 'x'.repeat(301) }] }));
  assert.deepEqual(r1, { ok: true, applied: 1, refused: [{ n: '9', reason: 'no_fact' }, { n: '1', reason: 'too_long' }], done: false });
  assert.deepEqual(choices(ctx, 'intake', 'fact'), ['2=n']);
  assert.equal(ctx.flowActive('777').state.ask, null);
  assert.equal(app(ctx, state, 'facts.confirm', { trip: TRIP, facts: [{ n: 1, choice: 'e' }] }).reason, 'bad_args', 'edits go in edits');

  // ✏️ via the app, then the batch continues: the questions start in the chat
  const r2 = J(app(ctx, state, 'facts.confirm', { trip: TRIP, facts: [{ n: '2', choice: 'n' }], edits: [{ n: 1, text: '2027-05-20  to 2027-05-22' }] }));
  assert.deepEqual(r2, { ok: true, applied: 2, refused: [], done: true });
  assert.deepEqual(choices(ctx, 'intake', 'fact'), ['2=n', '1=e']);
  const st = ctx.flowActive('777').state;
  assert.deepEqual([st.stage, st.ask], ['confirm', 'lodging']);
  assert.match(texts(state).pop(), /Where are you staying|staying/i);
  assert.equal(app(ctx, state, 'facts.get', { trip: TRIP }).reason, 'no_flow', 'the facts stage is over');
  // the edited dates are what the research takes
  say(ctx, state, 'Harbour Inn');
  say(ctx, state, 'none');
  const rq = reqOf(state, 'research', 'new');
  assert.equal(rq.length, 1);
  assert.deepEqual([rq[0].start_date, rq[0].end_date], ['2027-05-20', '2027-05-22']);
});

test('facts.confirm with advance:false only stores; facts.get shows the edit', () => {
  const { ctx, state } = fresh();
  say(ctx, state, '/plan Port Sorrel');
  deliver(ctx, state, 'trip_facts', facts());
  const r = J(app(ctx, state, 'facts.confirm', { trip: TRIP, edits: [{ n: 2, text: 'Harbour Inn' }], advance: false }));
  assert.deepEqual(r, { ok: true, applied: 1, refused: [], done: false });
  const f2 = J(app(ctx, state, 'facts.get', { trip: TRIP })).found[1];
  assert.deepEqual([f2.text, f2.choice, f2.edited, f2.original], ['Harbour Inn', 'y', true, 'Old Mill Hostel']);
  assert.equal(app(ctx, state, 'facts.confirm', { trip: TRIP, edits: [{ n: 1, text: '2020-01-01' }] }).refused[0].reason, 'bad_dates');
});

test('trip.digest and brochure.get: the stored days and Later list; the brochure inline, as a link past the limit, refused outside the folder', () => {
  const { ctx, state } = fresh();
  assert.equal(deliver(ctx, state, 'plan_digest', digest()).processed, 1);
  const d = J(app(ctx, state, 'trip.digest', { slug: TRIP }));
  assert.deepEqual([d.trip.slug, d.trip.build_id, d.trip.verified_on, d.trip.has_brochure, d.trip.lodging], [TRIP, 'build-ps-1', '2027-04-30', false, null]);
  assert.equal(d.days.length, 2);
  assert.deepEqual(d.days[0].stops[0], { n: 1, slug: 'lantern-museum', name: 'Lantern Museum', arrive: '10:00', depart: '11:00', minutes: 60, maps_url: maps('FixtureA'), note_line: 'Start upstairs.' });
  assert.deepEqual(d.days[0].legs[0], { from: 'lodging', to: 'lantern-museum', mode: 'WALK', minutes: 9, maps_url: '' });
  assert.deepEqual(d.days[0].warnings, ['Closes early on Wednesdays.']);
  assert.deepEqual(d.days[0].rain[0], { slug: 'tide-gallery', name: 'Tide Gallery', instead_of: 'lantern-museum', km: 1.2, maps_url: maps('FixtureR') });
  assert.deepEqual(d.later, [{ slug: 'signal-hill-lookout', name: 'Signal Hill Lookout', reason: 'owner_choice', reason_text: 'saved by you' },
    { slug: 'old-ferry-bar', name: 'Old Ferry Bar', reason: 'not_shown', reason_text: 'gem not chosen' }]);

  assert.deepEqual(J(app(ctx, state, 'brochure.get', { slug: TRIP })), { ok: false, reason: 'no_brochure', status: 404 });
  const small = state.drive.putFile('TourGuide/Trips', 'brochure-small.html', '<html><body>Port Sorrel</body></html>', 'text/html');
  ctx.tgTripUpsert({ slug: TRIP, drive_brochure_html: small.getId() });
  const b = J(app(ctx, state, 'brochure.get', { slug: TRIP }));
  assert.deepEqual([b.ok, b.html, b.link, b.build_id], [true, '<html><body>Port Sorrel</body></html>', undefined, 'build-ps-1']);
  assert.equal(J(app(ctx, state, 'trip.digest', { slug: TRIP })).trip.has_brochure, true);
  assert.equal(J(app(ctx, state, 'home')).trips[0].has_brochure, true);

  const big = state.drive.putFile('TourGuide/Trips', 'brochure-big.html', '<p>' + 'x'.repeat(ctx.TG_APP_BROCHURE_MAX_CHARS) + '</p>', 'text/html');
  ctx.tgTripUpsert({ slug: TRIP, drive_brochure_html: big.getId() });
  const bl = J(app(ctx, state, 'brochure.get', { slug: TRIP }));
  assert.deepEqual([bl.ok, bl.html, bl.link], [true, undefined, big.getUrl()]);

  const out = state.drive.putFile('Elsewhere', 'other.html', '<p>not ours</p>', 'text/html');
  ctx.tgTripUpsert({ slug: TRIP, drive_brochure_html: out.getId() });
  assert.equal(app(ctx, state, 'brochure.get', { slug: TRIP }).reason, 'no_brochure');
  assert.ok(J(ctx.storeAll(ctx.SHEETS.AUDIT)).some((r) => r.event === 'tg_app_brochure_outside_root'));
  ctx.tgTripUpsert({ slug: TRIP, drive_brochure_html: 'fixtureMissingFile01' });
  assert.equal(app(ctx, state, 'brochure.get', { slug: TRIP }).reason, 'no_brochure');
});

test('places.search · places.get · places.note · places.check: own fields only, filters, the 24 cap, one request per call', () => {
  const { ctx, state } = fresh();
  ctx.tgPlacesUpsert({ destination: TRIP, places: [place('lantern-museum', { history_summary: 'Visited 2026, liked it.', last_trip: 'port-sorrel-2026' }),
    place('tide-gallery', { tags: ['art', 'rainy day'], last_verified: '2027-04-01' }), place('quay-bakery', { category: 'food', tags: ['breakfast'], status: 'closed' })] });
  ctx.tgPlacesUpsert({ destination: 'gull-point', places: Array.from({ length: 26 }, (_, i) => place('gull-stop-' + (i + 1), { last_verified: '2027-01-' + String(i + 1).padStart(2, '0') })) });

  const all = J(app(ctx, state, 'places.search', {}));
  assert.deepEqual([all.total, all.rows.length], [29, 24]);
  assert.equal(all.rows[0].slug, 'tide-gallery', 'newest first');
  assert.deepEqual(all.filters, { destinations: ['gull-point', TRIP], statuses: ['closed', 'open'], tags: ['art', 'breakfast', 'rainy day'], lists: [] });   // C14: the lists facet (WP-14d)
  assert.deepEqual(Object.keys(all.rows[0]).sort(), ['area', 'category', 'destination', 'history_summary', 'last_researched', 'last_trip', 'last_verified', 'maps_url', 'name', 'note_line', 'slug', 'status', 'tags']);

  assert.deepEqual(J(app(ctx, state, 'places.search', { query: 'Gallery' })).rows.map((r) => r.slug), ['tide-gallery']);
  assert.deepEqual(J(app(ctx, state, 'places.search', { query: 'RAINY', destination: TRIP })).rows.map((r) => r.slug).sort(), ['lantern-museum', 'tide-gallery']);
  assert.deepEqual(J(app(ctx, state, 'places.search', { tag: 'Rainy Day', destination: TRIP })).total, 2);
  assert.deepEqual(J(app(ctx, state, 'places.search', { status: 'closed' })).rows.map((r) => r.slug), ['quay-bakery']);
  assert.deepEqual(J(app(ctx, state, 'places.search', { query: 'nothing like it' })), { ok: true, rows: [], total: 0, filters: all.filters });

  const p = J(app(ctx, state, 'places.get', { slug: 'lantern-museum' }));
  assert.deepEqual([p.place.name, p.place.history], ['Lantern Museum', [{ trip: 'port-sorrel-2026', date: '2027-03-02', text: 'Visited 2026, liked it.' }]]);
  assert.deepEqual(J(app(ctx, state, 'places.get', { slug: 'tide-gallery' })).place.history, []);
  assert.deepEqual(J(app(ctx, state, 'places.get', { slug: 'nowhere' })), { ok: false, reason: 'no_place', slug: 'nowhere', status: 404 });

  const n = J(app(ctx, state, 'places.note', { slug: 'tide-gallery' }));
  assert.ok(n.ok && n.request_id);
  assert.deepEqual(reqOf(state, 'notes').map((r) => r.places), [['tide-gallery']]);
  const pn = J(app(ctx, state, 'places.get', { slug: 'quay-bakery', note: true }));
  assert.deepEqual([pn.place.slug, typeof pn.request_id], ['quay-bakery', 'string']);
  assert.equal(reqOf(state, 'notes').length, 2);
  assert.equal(app(ctx, state, 'places.get', { slug: 'quay-bakery', note: 'yes' }).reason, 'bad_args');

  assert.equal(app(ctx, state, 'places.check', { slugs: ['lantern-museum', 'gull-stop-1'] }).reason, 'mixed_destinations');
  assert.equal(app(ctx, state, 'places.check', { slugs: ['lantern-museum', 'nowhere'] }).reason, 'no_place');
  assert.equal(app(ctx, state, 'places.check', { slugs: [] }).reason, 'missing_arg');
  assert.equal(app(ctx, state, 'places.check', { slugs: Array.from({ length: 25 }, () => 'lantern-museum') }).reason, 'too_many');
  const c = J(app(ctx, state, 'places.check', { slugs: ['lantern-museum', 'tide-gallery', 'lantern-museum'] }));
  assert.deepEqual([c.ok, c.count, typeof c.request_id], [true, 2, 'string']);
  const pr = reqOf(state, 'places', 'check');
  assert.equal(pr.length, 1);
  assert.deepEqual([pr[0].destination, pr[0].slugs], [TRIP, ['lantern-museum', 'tide-gallery']]);
  assert.match(texts(state).pop(), /Checking <b>2 places<\/b>/);
});

test('interview.bank and interview.submit: the bank as is, answers mapped like the chat, one prefs request, the chat interview ends', () => {
  const { ctx, state } = fresh();
  const b = J(app(ctx, state, 'interview.bank'));
  assert.deepEqual([b.ok, b.answers, b.in_progress], [true, [], false]);
  assert.deepEqual(b.bank, J(ctx.TG_INTERVIEW_BANK));

  say(ctx, state, '/interview');
  post(ctx, state, H.tgUpdate({ callback: sends(state).pop().reply_markup.inline_keyboard[0][0].callback_data, messageId: 91 }));   // pace-01: Relaxed
  const b2 = J(app(ctx, state, 'interview.bank'));
  assert.equal(b2.in_progress, true);
  assert.deepEqual(b2.answers, [{ qid: 'pace-01', value: 'relaxed', polarity: '+', kind: 'scale' }]);

  const bad = (answers, reason) => assert.equal(app(ctx, state, 'interview.submit', { version: 1, answers }).reason, reason, reason);
  bad([], 'empty');
  bad([{ qid: 'pace-01', values: [] }], 'empty');
  bad([{ qid: 'no-such-q', values: ['x'] }], 'unknown_qid');
  bad([{ qid: 'pace-01', values: ['relaxed'] }, { qid: 'pace-01', values: ['packed'] }], 'duplicate_qid');
  bad([{ qid: 'pace-01', values: ['sideways'] }], 'bad_value');
  bad([{ qid: 'pace-01', values: ['relaxed', 'packed'] }], 'bad_value');
  bad([{ qid: 'food-05', values: ['typed words'] }], 'bad_value');
  bad([{ qid: 'favourites-01', values: ['y'.repeat(61)] }], 'too_long');
  bad([{ qid: 'favourites-01', values: ['a', 'b', 'c', 'd', 'e', 'f'] }], 'too_many');
  bad([{ qid: 'favourites-01', values: [3] }], 'bad_value');
  assert.equal(app(ctx, state, 'interview.submit', { answers: [] }).reason, 'missing_arg');
  assert.equal(app(ctx, state, 'interview.submit', { version: 2, answers: [] }).reason, 'bad_args');
  assert.equal(reqOf(state, 'prefs').length, 0);

  const s = J(app(ctx, state, 'interview.submit', { version: 1, answers: [
    { qid: 'favourites-01', values: [' Tea  rooms ', 'Old harbours'] },
    { qid: 'food-02', values: ['offal', 'shellfish', 'Durian', 'offal'] },
    { qid: 'pace-01', values: ['packed'] }] }));
  assert.deepEqual([s.ok, s.answers, typeof s.request_id], [true, 6, 'string']);
  const rq = reqOf(state, 'prefs');
  assert.equal(rq.length, 1);
  const q = (id) => ctx.tgIvFind(id).q;
  assert.deepEqual(rq[0].interview, { version: 1, answers: [
    { qid: 'pace-01', dimension: q('pace-01').dimension, value: 'packed', polarity: '+', kind: 'scale' },
    { qid: 'food-02', dimension: q('food-02').dimension, value: 'shellfish', polarity: '-', kind: 'multi' },
    { qid: 'food-02', dimension: q('food-02').dimension, value: 'offal', polarity: '-', kind: 'multi' },
    { qid: 'food-02', dimension: q('food-02').dimension, value: 'Durian', polarity: '-', kind: 'text' },
    { qid: 'favourites-01', dimension: q('favourites-01').dimension, value: 'Tea rooms', polarity: '+', kind: 'text' },
    { qid: 'favourites-01', dimension: q('favourites-01').dimension, value: 'Old harbours', polarity: '+', kind: 'text' }] }, 'bank order; options in option order');
  assert.equal(ctx.flowActive('777'), null, 'the chat interview ended');
  assert.match(texts(state).pop(), /6 answers from the app noted/);
});

test('interview.submit: a yes/no pair sharing one value is told apart by its key, and the bare value is refused (app v01.05w)', () => {
  const { ctx, state } = fresh();
  const q = (id) => ctx.tgIvFind(id).q;
  const keys = (id) => Array.from(q(id).options, (o, k) => String(ctx.tgIvOptionKey(q(id), k)));
  assert.deepEqual(keys('crowds-02'), ['peak hours|+', 'peak hours|-'], 'a pair: value|polarity');
  assert.deepEqual(keys('pace-01'), Array.from(q('pace-01').options, (o) => String(o.value)), 'unique values stay as they are');
  for (const [qid, value] of [['crowds-02', 'peak hours'], ['climate-01', 'heat'], ['budget-02', 'fine dining']]) {
    assert.equal(app(ctx, state, 'interview.submit', { version: 1, answers: [{ qid, values: [value] }] }).reason, 'ambiguous_value', qid + ': the bare value never guesses');
  }
  assert.equal(app(ctx, state, 'interview.submit', { version: 1, answers: [{ qid: 'crowds-02', values: ['peak hours|+', 'peak hours|-'] }] }).reason, 'bad_value', 'a pick takes one');
  assert.equal(reqOf(state, 'prefs').length, 0);
  const s = J(app(ctx, state, 'interview.submit', { version: 1, answers: [
    { qid: 'crowds-02', values: ['peak hours|-'] }, { qid: 'climate-01', values: ['heat|+'] }, { qid: 'climate-02', values: ['cold|-'] }, { qid: 'budget-02', values: ['fine dining|+'] }] }));
  assert.equal(s.answers, 4);
  const got = Array.from(reqOf(state, 'prefs')[0].interview.answers, (a) => a.qid + ' ' + a.value + ' ' + a.polarity);
  assert.deepEqual(got.sort(), ['budget-02 fine dining +', 'climate-01 heat +', 'climate-02 cold -', 'crowds-02 peak hours -'], '"Does not matter" stays "does not matter"; "Heat is fine" stays fine');
});

test('people.list · people.add · people.trip and a companion interview: their own prefs request, the chat interview untouched (Phase 8)', () => {
  const { ctx, state } = fresh();
  ctx.tgTripUpsert({ slug: TRIP, title: 'Port Sorrel', destination: 'Port Sorrel', start: '2027-05-12', end: '2027-05-14' });
  assert.deepEqual(J(app(ctx, state, 'people.list', {})), { ok: true, trip: TRIP, trip_title: 'Port Sorrel', people: [], max: 8 });
  assert.equal(app(ctx, state, 'people.add', { name: '<script>' }).reason, 'bad_name');
  assert.equal(app(ctx, state, 'people.add', {}).reason, 'missing_arg');
  assert.deepEqual(J(app(ctx, state, 'people.add', { name: 'Robin' })), { ok: true, slug: 'robin', name: 'Robin' });
  assert.equal(app(ctx, state, 'people.trip', { people: ['robin', 'kim'] }).reason, 'no_person');
  assert.equal(app(ctx, state, 'people.trip', { people: ['Robin!'] }).reason, 'bad_args');
  assert.equal(app(ctx, state, 'people.trip', { trip: 'nowhere', people: [] }).reason, 'no_trip');
  assert.deepEqual(J(app(ctx, state, 'people.trip', { people: ['robin'] })).on_trip, ['robin']);
  assert.deepEqual(J(app(ctx, state, 'people.list', { trip: TRIP })).people, [{ slug: 'robin', name: 'Robin', interviewed: '', on_trip: true }]);
  assert.deepEqual(J(app(ctx, state, 'home', {})).people, { trip: TRIP, items: [{ slug: 'robin', name: 'Robin', interviewed: '', on_trip: true }], max: 8 });

  say(ctx, state, '/interview');
  post(ctx, state, H.tgUpdate({ callback: sends(state).pop().reply_markup.inline_keyboard[0][0].callback_data, messageId: 91 }));
  const b = J(app(ctx, state, 'interview.bank', { person: 'robin' }));
  assert.deepEqual([b.in_progress, b.answers, b.person], [false, [], { slug: 'robin', name: 'Robin' }], 'the owner\'s chat answers are not Robin\'s');
  assert.equal(app(ctx, state, 'interview.bank', { person: 'kim' }).reason, 'no_person');
  const r = J(app(ctx, state, 'interview.submit', { version: 1, person: 'robin', answers: [{ qid: 'pace-01', values: ['packed'] }] }));
  assert.deepEqual([r.ok, r.answers, r.person], [true, 1, 'robin']);
  const pr = requests(state).filter((x) => x.kind === 'prefs');
  assert.equal(pr.length, 1);
  assert.deepEqual(J(pr[0].person), { slug: 'robin', name: 'Robin' });
  assert.equal(ctx.flowActive('777').flow, 'interview', 'the owner\'s chat interview goes on');
  assert.match(texts(state).pop(), /Building Robin’s profile…/);
  assert.equal(J(app(ctx, state, 'people.list', {})).people[0].interviewed, '2027-05-01');
  say(ctx, state, '/cancel');
  say(ctx, state, '/plan Port Sorrel');
  assert.deepEqual(J(reqOf(state, 'research')[0].trip_update), { start_date: '2027-05-12', end_date: '2027-05-14', travelers: [{ slug: 'robin', name: 'Robin' }] });
});

test('no Google field is written: 32_app_api.js never names a photo, place id or the Maps key, and no write carries maps_', () => {
  const src = fs.readFileSync(path.join(H.HELPERS_ROOT, 'packs', 'tour-guide', 'gas', '32_app_api.js'), 'utf8');
  assert.doesNotMatch(src, /photo|place_id|MAPS_API_KEY/i);
  assert.doesNotMatch(src, /UrlFetchApp|storeAppend|storeUpdate|createFile|setContent|tgPlacesUpsert|tgTripUpsert/, 'writes go through Choices, Settings and requests only');
  const writes = /tgChoiceSet|settingSet|tgAppMsgsSave|tgOpenKindRequest|flowStart|flowResume|tgLaterAdd/;
  const bad = src.split('\n').filter((l) => writes.test(l) && /maps_/.test(l));
  assert.deepEqual(bad, []);
  // and in practice: the stored message ids and Choices rows hold no link
  const { ctx, state } = fresh();
  deliver(ctx, state, 'shortlist', shortlist());
  app(ctx, state, 'shortlist.choose_many', { run: 'r1', choices: [{ n: 'a1', choice: 'w' }, { n: 'f1', choice: 'l' }] });
  assert.doesNotMatch(ctx.settingGet(ctx.TG_APP_MSGS_KEY, ''), /maps/i);
  assert.doesNotMatch(JSON.stringify(J(ctx.storeAll(ctx.TG_SHEETS.CHOICES))), /maps/i);
});

// Developed by: LightAISolutions
