'use strict';
// TG-PHASE-16 WP-16b (Contract C16), core side: the menu branch registered; the parse, the counting rule and the caveat
// mirrors in step with the pack; the core validator, the pack validator and the schema agree on every fixture; /menu and
// /menu alone; the envelope stored in the Menus tab and the card for each fits; the re-plan offer and its button; the veg
// card button; the 🍽 row and the hooks that carry it; state.json menu_checks; the five app ops. Invented data only (the
// Lark Bay world and invented menus on the reserved .example domain); no network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const W = require('./pack_tour-guide_phase12_world');
const { H, TRIP, DATES, J, at, say, tap, sends, texts, audits, reqOf, cbData } = W;

const PACK_DIR = path.join(H.HELPERS_ROOT, 'packs', 'tour-guide');
const FIX = JSON.parse(fs.readFileSync(path.join(PACK_DIR, 'menu', 'fixtures', 'menu-sample.json'), 'utf8'));
const CASES = JSON.parse(fs.readFileSync(path.join(PACK_DIR, 'menu', 'fixtures', 'menu-parse-cases.json'), 'utf8'));
const MANIFEST = JSON.parse(fs.readFileSync(path.join(PACK_DIR, 'helper.json'), 'utf8'));
const SHELL = 'https://app.example.invalid/helper-app.html';
const D1 = DATES[0], D2 = DATES[1];
const pack = () => import('../packs/tour-guide/menu/index.mjs');

/** The Lark Bay digest with Salt House as dinner on days 1 and 2, each with `note` as its note_line (no note: none). */
function digestWith(note = 'Menu not checked for vegetarian', over = {}) {
  const d2 = W.day2(), dinner = { ...d2.dinner, ...(note === null ? {} : { note_line: note }), ...over };
  const d1 = { ...W.day1(), dinner: { ...dinner, start: '19:30', end: '21:00' } };
  return W.digest({ days: [d1, { ...d2, dinner }, W.day3()] });
}
/** A fresh core at `now` (default day 2, 09:00 at Lark Bay) with that digest stored and the app shell set. */
function fresh(now, o = {}) {
  const w = W.fresh(now || at(D2, '09:00'), { digest: o.digest || digestWith(o.note === undefined ? 'Menu not checked for vegetarian' : o.note) });
  if (o.shell !== false) w.state.props[w.ctx.PROP.APP_SHELL_URL] = SHELL;
  return w;
}
/** A Salt House check for the Lark Bay trip; fits picks invented dishes to match. */
function check(fits = 'yes', over = {}) {
  const p = { v: 1, id: 'mn-20270601-salt-house', trip: TRIP, created_on: '2027-06-01', date: D2,
    place: { name: 'Salt House', slug: 'salt-house', local_name: 'Saltu Hus' }, checked: '2027-06-01', fits, note: '', diet: 'vegetarian',
    dishes: [], sources: [{ title: 'Salt House — dinner menu', url: 'https://salt-house.example/menu' }] };
  if (fits === 'yes') {
    p.note = 'Fits: Kelp and barley stew, Pickled radish plate; ask: Harbour noodle broth';
    p.dishes = [{ name: 'Kelp and barley stew', course: 'main', fits: 'yes', price: '16.00' },
      { name: 'Harbour noodle broth', local: 'Hama Nudla', course: 'main', fits: 'ask', ask: 'without the fish-stock broth?', price: '14.50' },
      { name: 'Pickled radish plate', course: 'starter', fits: 'yes', price: '6.00' }];
    p.others = 9;
  } else if (fits === 'partly') {
    p.note = 'Fits: Smoked tofu skewers, Charred leeks; ask: Five-grain bowl';
    p.dishes = J(FIX.valid[3].dishes);
    p.others = 1;
  } else if (fits === 'no') {
    p.note = 'Nothing on the menu fits vegetarian';
    p.dishes = [{ name: 'Lemon sorbet', course: 'dessert', fits: 'yes', price: '5.00' }];
    p.others = 14;
  } else {
    p.note = 'No menu found to check';
    p.sources = [];
  }
  return Object.assign(p, over);
}
const deliver = (ctx, state, payload, over) => W.deliver(ctx, state, 'menu', payload, over);
const app = (ctx, state, op, args) => J(H.appPost(ctx, state, 'app', args === undefined ? { op } : { op, args }));
const answers = (state) => state.fetch.telegram('answerCallbackQuery').map((r) => r.json.text);
const lastMsg = (state) => sends(state).pop();
const btnTexts = (m) => ((m && m.reply_markup && m.reply_markup.inline_keyboard) || []).flat().map((b) => b.text);
const key = (ctx, id) => ctx.tgMenuKey(id);
const menuReqs = (state) => reqOf(state, 'menu');

test('menu: the command, the kind\'s routing (a discovery kind), the tab and its columns, the handler, the snapshot and the five app ops', () => {
  const { ctx, state } = fresh();
  assert.equal(typeof ctx.getCommand('/menu'), 'function');
  assert.ok(J(ctx.HB_REGISTRY.help).some((l) => l.indexOf('/menu — ') === 0), 'a help line');
  assert.equal(ctx.TG_KIND_ROUTINE['menu'], 'RESEARCH');
  assert.equal(ctx.tgKindRoutine('menu'), 'RESEARCH');
  assert.equal(ctx.TG_DISCOVER_KINDS.filter((k) => k === 'menu').length, 1);
  assert.deepEqual(J(ctx.allSheetSchemas()).Menus, ['id', 'trip', 'place_slug', 'place_name', 'checked', 'fits', 'payload_json', 'received_at']);
  assert.ok(MANIFEST.envelope_types.includes('menu'));
  assert.ok(ctx.getEnvelopeHandler('menu'));
  assert.equal(typeof ctx.HB_REGISTRY.snapshot.menu_checks, 'function');
  assert.deepEqual(Object.keys(ctx.TG_APP_OPS).filter((op) => /^menu\./.test(op)).sort(), ['menu.day', 'menu.get', 'menu.list', 'menu.new', 'menu.replan']);
  assert.deepEqual(['menu.new', 'menu.replan'].map((op) => !!ctx.TG_APP_OPS[op].write), [true, true]);
  assert.deepEqual(['menu.list', 'menu.get', 'menu.day'].map((op) => !!ctx.TG_APP_OPS[op].write), [false, false, false]);
  H.configureRoutine(ctx, state, 'DISCOVER');
  assert.equal(ctx.tgKindRoutine('menu'), 'DISCOVER');
});

test('parse parity: tgMenuParse and parseMenuText give one answer on every shared case', async () => {
  const { ctx } = fresh();
  const { parseMenuText } = await pack();
  for (const c of CASES.cases) {
    assert.deepEqual(J(ctx.tgMenuParse(c.text, CASES.today)), c.want, 'core: ' + JSON.stringify(c.text));
    assert.deepEqual(parseMenuText(c.text, { today: CASES.today }), J(ctx.tgMenuParse(c.text, CASES.today)), 'pack: ' + JSON.stringify(c.text));
  }
});

test('counting parity: TG_MENU.MAX_AGE_DAYS is the facts pack\'s, the caveat pattern is the pack\'s, and the core counts as menuCounts', async () => {
  const { ctx } = fresh();
  const P = await pack(), facts = await import('../packs/tour-guide/facts/index.mjs');
  assert.equal(ctx.TG_MENU.MAX_AGE_DAYS, facts.MENU_MAX_AGE_DAYS);
  assert.equal(ctx.TG_MENU.MAX_AGE_DAYS, P.MAX_AGE_DAYS);
  assert.equal(ctx.TG_MENU.CAVEAT_RE.source, P.CAVEAT_RE.source);
  assert.equal(ctx.TG_MENU.CAVEAT_RE.flags, P.CAVEAT_RE.flags);
  for (const date of ['2027-05-13', '2027-03-02', '2028-03-01', '2027-01-15']) {
    assert.equal(ctx.tgMenuCountsFrom(date), P.menuCountsFrom(date), date);
    for (const back of [-3, 0, 29, 30, 31, 45]) {
      const checked = new Date(Date.parse(date + 'T00:00:00Z') - back * 864e5).toISOString().slice(0, 10);
      assert.equal(ctx.tgMenuCounts(checked, date), P.menuCounts(checked, date), checked + ' for ' + date);
    }
  }
  for (const note of ['Menu not checked for vegetarian', 'Salt House · menu last checked 2027-03-01', 'Booked for 2 · Menu not checked for your diet',
    'The menu partly fits your diet', 'Salt House', 'A menu not checked for anyone']) {
    assert.equal(ctx.TG_MENU.CAVEAT_RE.test(note), P.menuCaveat(note) !== null, note);
  }
});

test('menu parity: the core validator, the pack validator and the schema agree on every fixture', async () => {
  const { ctx } = fresh();
  const P = await pack();
  const schemas = await import('../packs/tour-guide/schemas/index.mjs');
  for (const p of FIX.valid) {
    assert.deepEqual(J(ctx.tgEnvValidateMenu(J(p))), [], JSON.stringify(p));
    assert.deepEqual(P.validateMenuPayload(J(p)), [], JSON.stringify(p));
    assert.deepEqual(schemas.validatePayload('menu', J(p)).errors, [], JSON.stringify(p));
  }
  for (const p of FIX.invalid) {
    const core = J(ctx.tgEnvValidateMenu(J(p)));
    assert.ok(core.length > 0, 'core accepts ' + JSON.stringify(p));
    assert.deepEqual(P.validateMenuPayload(J(p)), core, 'the same words for ' + JSON.stringify(p));
    // The schema subset cannot say the validators' own rules (ask, sources, real dates); checkMenu says them for
    // schemas/index.mjs (REQUEST: KINDS.menu = checkMenu). Until then the two together refuse every invalid fixture.
    const s = schemas.validatePayload('menu', J(p));
    assert.ok(!s.ok || P.checkMenu(J(p)).length > 0, 'schema accepts ' + JSON.stringify(p));
  }
  // The core's own extras: a Google field anywhere, an oversize payload, the 12 000 limit after the envelope's 60 000.
  const g = check('yes'); g.dishes[0].photos = ['x'];
  assert.deepEqual(J(ctx.tgEnvValidateMenu(J(g))), P.validateMenuPayload(J(g)));
  assert.ok(J(ctx.tgEnvValidateMenu(J(g))).includes('dishes[0].photos: Google field refused (own data only)'));
  const big = check('yes', { note: 'O'.repeat(160), diet: 'D'.repeat(80) });
  big.place = { name: 'N'.repeat(120), slug: 'salt-house', place_id: 'F'.repeat(300), local_name: 'B'.repeat(80) };
  big.dishes = Array.from({ length: 12 }, (_, i) => ({ name: ('Dish ' + i + ' ').padEnd(80, 'n'), local: 'L'.repeat(80), course: 'main', fits: 'ask', ask: 'A'.repeat(120), price: 'P'.repeat(40) }));
  big.sources = Array.from({ length: 3 }, (_, i) => ({ title: 'T'.repeat(120), url: ('https://long.example/' + i + '/').padEnd(2000, 'u') }));
  big.others = 200;
  const n = JSON.stringify(big).length;
  assert.ok(n > 12000);
  assert.deepEqual(J(ctx.tgEnvValidateMenu(J(big))), ['payload is ' + n + ' chars (max 12000)']);
  assert.deepEqual(P.validateMenuPayload(J(big)), ['payload is ' + n + ' chars (max 12000)']);
});

test('/menu <restaurant> [on <date>]: a `menu` request { trip, place, date } and the acknowledgement; the words that ask nothing', () => {
  const { ctx, state } = fresh();
  say(ctx, state, '/menu Brindle Lantern on tomorrow');
  let r = menuReqs(state);
  assert.equal(r.length, 1);
  assert.deepEqual({ trip: r[0].trip, place: r[0].place, slug: r[0].slug, date: r[0].date }, { trip: TRIP, place: 'Brindle Lantern', slug: undefined, date: DATES[2] });
  assert.equal(r[0].text, '/menu Brindle Lantern on tomorrow', 'the owner\'s words as typed');
  assert.equal(J(ctx.storeAll('Requests')).pop().routine, 'RESEARCH');
  assert.ok(texts(state).includes('🍽 Reading the menu of <b>Brindle Lantern</b>…'));
  say(ctx, state, '/menu Kettle on the Quay');
  r = menuReqs(state);
  assert.equal(r.length, 2);
  assert.equal(r[1].place, 'Kettle on the Quay');
  assert.equal(r[1].date, undefined);
  for (const [words, want] of [['/menu ' + 'x'.repeat(81), /under 80 characters/], ['/menu Brindle Lantern on 2027-02-30', /could not read that date/],
    ['/menu Brindle Lantern on 2027-06-10', /already passed/], ['/menu on tomorrow', /Which restaurant\?/]]) {
    say(ctx, state, words);
    assert.match(texts(state).pop(), want, words);
  }
  assert.equal(menuReqs(state).length, 2, 'nothing more was asked');
  // Without a trip the request carries no trip.
  const w = H.loadGas({ pack: 'tour-guide', now: at(D2, '09:00') });
  H.bootstrap(w.ctx, w.state);
  H.configureRoutine(w.ctx, w.state, 'RESEARCH');
  say(w.ctx, w.state, '/menu Brindle Lantern');
  r = menuReqs(w.state);
  assert.equal(r.length, 1);
  assert.equal(r[0].trip, undefined);
  assert.equal(r[0].place, 'Brindle Lantern');
});

test('/menu alone: the planned dinners from today on that get a 🍽 button, then the last 5 checks, then the how-to; with neither, only the how-to', () => {
  let { ctx, state } = fresh(at(D2, '09:00'), { note: null });
  say(ctx, state, '/menu');
  assert.equal(texts(state).pop(), ctx.TG_MENU_USAGE, 'no caveat, no check: the how-to alone');
  assert.equal(menuReqs(state).length, 0);
  ({ ctx, state } = fresh());
  say(ctx, state, '/menu');
  let m = lastMsg(state);
  assert.match(m.text, /Planned dinners/);
  assert.match(m.text, /Day 2 · .* — .*Salt House.*: menu to check/);
  assert.doesNotMatch(m.text, /Day 1 ·/, 'day 1 has passed');
  assert.ok(m.text.endsWith(ctx.TG_MENU_USAGE));
  assert.deepEqual(btnTexts(m), ['🍽 2 · Salt House']);
  assert.deepEqual(cbData(m), ['mn:' + TRIP + ':20270611:' + ctx.tgCmdTag('salt-house')]);
  // Six checks of other places: the last 5, newest first, as resend buttons after the dinner.
  for (let i = 1; i <= 6; i++) {
    deliver(ctx, state, check('yes', { id: 'mn-2027060' + i + '-gull-' + i, place: { name: 'Gull ' + i, slug: 'gull-' + i }, checked: '2027-06-0' + i }));
  }
  say(ctx, state, '/menu');
  m = lastMsg(state);
  assert.deepEqual(btnTexts(m), ['🍽 2 · Salt House', '🍽 Gull 6', '🍽 Gull 5', '🍽 Gull 4', '🍽 Gull 3', '🍽 Gull 2']);
  assert.equal(cbData(m)[1], 'mn:' + key(ctx, 'mn-20270606-gull-6') + ':s');
  assert.match(m.text, /Your last checks[\s\S]*• Gull 6 — fits · checked/);
});

test('the envelope and the card, fits yes: the head with the local name, the fits line, For, the dishes, the others, the source, 🔁 Re-plan and 📱; a re-delivery replaces the row', () => {
  const { ctx, state } = fresh();
  assert.equal(deliver(ctx, state, check('yes')).processed, 1);
  let rows = J(ctx.storeAll('Menus'));
  assert.equal(rows.length, 1);
  assert.deepEqual({ id: rows[0].id, trip: rows[0].trip, place_slug: rows[0].place_slug, place_name: rows[0].place_name, fits: rows[0].fits },
    { id: 'mn-20270601-salt-house', trip: TRIP, place_slug: 'salt-house', place_name: 'Salt House', fits: 'yes' });
  assert.equal(JSON.parse(rows[0].payload_json).note, check('yes').note);
  const m = lastMsg(state), lines = m.text.split('\n');
  assert.match(lines[0], /^🍽 <b>Menu check: Salt House \(Saltu Hus\)<\/b> · checked \w{3} 1 Jun$/);
  assert.deepEqual(lines.slice(1), ['✅ Fits your party', 'For: vegetarian', '✅ Kelp and barley stew · 16.00',
    '❓ Harbour noodle broth (Hama Nudla) · 14.50 — ask: without the fish-stock broth?', '✅ Pickled radish plate · 6.00',
    '+ 9 other dishes that do not fit', 'Source: <a href="https://salt-house.example/menu">Salt House — dinner menu</a>']);
  assert.deepEqual(btnTexts(m), ['🔁 Re-plan day 2', '📱 Open in the app'], 'day 1 has passed: only day 2 is offered; no veg card');
  assert.deepEqual(cbData(m)[0], 'mn:' + key(ctx, 'mn-20270601-salt-house') + ':r20270611');
  const web = m.reply_markup.inline_keyboard.flat().pop().web_app.url;
  assert.ok(web.startsWith(SHELL + '?core=') && /&screen=menu&trip=lark-bay&menu=mn-20270601-salt-house$/.test(web), web);
  // A re-delivered id replaces its row and sends the card again.
  assert.equal(deliver(ctx, state, check('yes', { others: 1 })).processed, 1);
  rows = J(ctx.storeAll('Menus'));
  assert.equal(rows.length, 1);
  assert.equal(JSON.parse(rows[0].payload_json).others, 1);
  assert.match(lastMsg(state).text, /\+ 1 other dish that does not fit/);
  // A check of a trip the core does not know is refused; one without a trip is stored, with no offer.
  assert.equal(deliver(ctx, state, check('yes', { id: 'mn-20270601-salt-house-2', trip: 'no-such-trip' })).rejected, 1);
  assert.equal(deliver(ctx, state, check('yes', { id: 'mn-20270601-salt-house-3', trip: null })).processed, 1);
  assert.deepEqual(btnTexts(lastMsg(state)), ['📱 Open in the app']);
  assert.equal(deliver(ctx, state, FIX.invalid[13]).rejected, 1, 'the ask rule');
});

test('the card for partly (an old check: from when a check counts), no (the line and the button even when old) and unknown (nothing offered)', () => {
  const { ctx, state } = fresh();
  deliver(ctx, state, check('partly', { id: 'mn-20270501-salt-house', created_on: '2027-05-01', checked: '2027-05-01' }));
  let m = lastMsg(state), lines = m.text.split('\n');
  assert.equal(lines[1], '🟡 Partly fits — ask first');
  assert.deepEqual(lines.slice(3, 6), ['❓ Five-grain bowl · 12.00 — ask: is the dressing made with anchovy?', '✅ Smoked tofu skewers · 4.00', '✅ Charred leeks · 4.50']);
  assert.equal(lines[6], '+ 1 other dish that does not fit');
  // Today (11 Jun) is past from (12 May): the card says to check again rather than naming a date that has come.
  assert.match(lines.pop(), /^For day 2 \(\w{3} 11 Jun\) this check is too old to count; send 🍽 to check again\.$/);
  assert.deepEqual(btnTexts(m), ['📱 Open in the app'], 'a check that does not count yet has no re-plan button');
  assert.deepEqual(J(ctx.tgMenuOffer(ctx.tgMenuGet('mn-20270501-salt-house'))).map((o) => [o.replan, o.from, o.again]), [[false, '2027-05-12', true]]);

  deliver(ctx, state, check('no', { id: 'mn-20270502-salt-house', created_on: '2027-05-02', checked: '2027-05-02' }));
  m = lastMsg(state); lines = m.text.split('\n');
  assert.equal(lines[1], '⛔ Nothing on the menu fits');
  assert.equal(lines[3], '✅ Lemon sorbet · 5.00');
  assert.equal(lines[4], '+ 14 other dishes that do not fit');
  assert.match(lines.pop(), /^This dinner does not fit; re-plan day 2 \(\w{3} 11 Jun\) to replace it\.$/);
  assert.deepEqual(btnTexts(m), ['🔁 Re-plan day 2', '📱 Open in the app']);

  deliver(ctx, state, check('unknown', { id: 'mn-20270603-salt-house', created_on: '2027-06-03', checked: '2027-06-03' }));
  m = lastMsg(state); lines = m.text.split('\n');
  assert.deepEqual(lines.slice(1), ['❔ No menu found to check', 'For: vegetarian']);
  assert.deepEqual(btnTexts(m), ['📱 Open in the app']);
  // Without APP_SHELL_URL there is no app button: a card with nothing to tap has no keyboard.
  delete state.props[ctx.PROP.APP_SHELL_URL];
  deliver(ctx, state, check('unknown', { id: 'mn-20270604-salt-house', created_on: '2027-06-04', checked: '2027-06-04' }));
  assert.equal(lastMsg(state).reply_markup, undefined);
});

test('🔁 Re-plan: a `replan` { trip, dates, reason, deliverables } and the acknowledgement; a changed dinner, a check that does not count, a resend', () => {
  let { ctx, state } = fresh();
  deliver(ctx, state, check('yes'));
  const k = key(ctx, 'mn-20270601-salt-house');
  tap(ctx, state, 'mn:' + k + ':r20270611');
  const r = reqOf(state, 'replan');
  assert.equal(r.length, 1);
  assert.deepEqual({ trip: r[0].trip, dates: r[0].dates, reason: r[0].reason, deliverables: r[0].deliverables },
    { trip: TRIP, dates: [D2], reason: 'menu checked at Salt House', deliverables: ['plan'] });
  assert.match(texts(state).pop(), /^🔁 Re-planning day 2 \(\w{3} 11 Jun\) with the checked menu…$/);
  assert.equal(answers(state).pop(), 'Re-planning day 2');
  tap(ctx, state, 'mn:' + k + ':r20270610');
  assert.equal(answers(state).pop(), 'That day is no longer offered — send /menu.', 'day 1 has passed');
  tap(ctx, state, 'mn:' + k + ':s');
  assert.match(lastMsg(state).text, /^🍽 <b>Menu check: Salt House/);
  tap(ctx, state, 'mn:k000000000000:s');
  assert.equal(answers(state).pop(), 'That check is gone — send /menu.');
  // The dinner of day 2 changed since the card was sent.
  W.deliver(ctx, state, 'plan_digest', digestWith('Menu not checked for vegetarian', { name: 'Reed Table', slug: 'reed-table' }));
  tap(ctx, state, 'mn:' + k + ':r20270611');
  assert.equal(answers(state).pop(), 'That day\'s dinner has changed — send /day again.');
  assert.equal(reqOf(state, 'replan').length, 1);
  // An old partly check: no button on the card, and a forged tap is refused.
  ({ ctx, state } = fresh());
  deliver(ctx, state, check('partly', { id: 'mn-20270501-salt-house', created_on: '2027-05-01', checked: '2027-05-01' }));
  tap(ctx, state, 'mn:' + key(ctx, 'mn-20270501-salt-house') + ':r20270611');
  assert.equal(answers(state).pop(), 'That day is no longer offered — send /menu.');
  assert.equal(reqOf(state, 'replan').length, 0);
});

test('🥗 Veg card: the button only when the trip has a card; mn:<key>:v sends it', async () => {
  const { ctx, state } = fresh();
  deliver(ctx, state, check('yes'));
  assert.ok(!btnTexts(lastMsg(state)).includes('🥗 Veg card'));
  const k = key(ctx, 'mn-20270601-salt-house');
  tap(ctx, state, 'mn:' + k + ':v');
  assert.equal(answers(state).pop(), 'No veg card for that trip — send /vegcard.');
  const { vegCard } = await import('../packs/tour-guide/vegcard/index.mjs');
  W.deliver(ctx, state, 'veg_card', vegCard({ party: { dietary: ['meat and fish'], size: 2 }, country: 'JP', trip: TRIP }));
  const n = sends(state).length;
  tap(ctx, state, 'mn:' + k + ':s');
  const m = lastMsg(state);
  assert.deepEqual(btnTexts(m), ['🔁 Re-plan day 2', '🥗 Veg card', '📱 Open in the app']);
  assert.equal(cbData(m)[1], 'mn:' + k + ':v');
  const before = sends(state).length;
  tap(ctx, state, 'mn:' + k + ':v');
  assert.ok(sends(state).length > before && sends(state).length > n);
  assert.deepEqual(sends(state).slice(before).map((x) => x.text), J(ctx.tgVegCardMessages(ctx.tgVegCardGet(TRIP))).map((x) => x.html));
});

const rowsOf = (ctx, date) => J(ctx.tgMenuDayRows(ctx.tgTripGet(TRIP), ctx.tgDigestDay(TRIP, date)));

test('the 🍽 row: no check, a check that counts, an old check before from, an old check after from; no caveat, no slug, a past day', () => {
  let { ctx, state } = fresh();
  const ask = 'mn:' + TRIP + ':20270611:' + ctx.tgCmdTag('salt-house');
  assert.deepEqual(rowsOf(ctx, D2), [[{ text: '🍽 Check the menu', data: ask }]], 'no check');
  assert.deepEqual(rowsOf(ctx, D1), [], 'a past day');
  deliver(ctx, state, check('partly', { id: 'mn-20270420-salt-house', created_on: '2027-04-20', checked: '2027-04-20' }));
  assert.deepEqual(rowsOf(ctx, D2), [[{ text: '🍽 Check the menu', data: ask }]], 'an old check once from has come: ask again');
  deliver(ctx, state, check('yes'));
  assert.deepEqual(rowsOf(ctx, D2), [[{ text: '🍽 Menu: fits', data: 'mn:' + key(ctx, 'mn-20270601-salt-house') + ':s' }]], 'a check that counts');
  deliver(ctx, state, check('no', { id: 'mn-20270605-salt-house', created_on: '2027-06-05', checked: '2027-06-05' }));
  assert.equal(rowsOf(ctx, D2)[0][0].text, '🍽 Menu: does not fit', 'the newest check decides');
  deliver(ctx, state, check('unknown', { id: 'mn-20270606-salt-house', created_on: '2027-06-06', checked: '2027-06-06' }));
  assert.equal(rowsOf(ctx, D2)[0][0].text, '🍽 Menu: no menu found');

  // Before from (2027-05-12 for day 2): an old check is resent, since a new one would not count yet.
  ({ ctx, state } = fresh(at('2027-05-01', '12:00')));
  deliver(ctx, state, check('partly', { id: 'mn-20270420-salt-house', created_on: '2027-04-20', checked: '2027-04-20' }));
  assert.deepEqual(rowsOf(ctx, D2), [[{ text: '🍽 Menu: partly fits', data: 'mn:' + key(ctx, 'mn-20270420-salt-house') + ':s' }]]);
  assert.match(J(ctx.tgMenuMessages(ctx.tgMenuGet('mn-20270420-salt-house')))[0].html, /For day 2 \(\w{3} 11 Jun\) a menu check counts from \w{3} 12 May; send 🍽 again then\./);
  assert.equal(J(ctx.tgMenuOffer(ctx.tgMenuGet('mn-20270420-salt-house')))[0].again, undefined, 'from is still ahead');
  assert.equal(rowsOf(ctx, D1)[0][0].text, '🍽 Menu: partly fits', 'day 1 (from 2027-05-11) is still ahead');

  for (const [note, why] of [[null, 'no note'], ['The menu partly fits your diet', 'a check that counts gave no caveat'], ['Booked for 2 at 19:00.', 'no caveat']]) {
    ({ ctx } = fresh(at(D2, '09:00'), { note }));
    assert.deepEqual(rowsOf(ctx, D2), [], why);
  }
  ({ ctx } = fresh(at(D2, '09:00'), { digest: digestWith('Menu last checked 2027-03-01', { slug: undefined }) }));
  assert.equal(ctx.tgDigestDay(TRIP, D2).dinner.slug, undefined);
  assert.deepEqual(rowsOf(ctx, D2), [], 'no slug');
  ({ ctx } = fresh(at(D2, '09:00'), { note: 'Menu last checked 2027-03-01' }));
  assert.equal(rowsOf(ctx, D2)[0][0].text, '🍽 Check the menu', 'the "last checked" caveat');
});

test('🍽 Check the menu: the request { trip, place, slug, date } and its acknowledgement; a changed day and a passed day ask nothing', () => {
  const { ctx, state } = fresh();
  const ask = 'mn:' + TRIP + ':20270611:' + ctx.tgCmdTag('salt-house');
  tap(ctx, state, ask);
  const r = menuReqs(state);
  assert.equal(r.length, 1);
  assert.deepEqual({ trip: r[0].trip, place: r[0].place, slug: r[0].slug, date: r[0].date }, { trip: TRIP, place: 'Salt House', slug: 'salt-house', date: D2 });
  assert.equal(r[0].text, '/menu Salt House on ' + D2);
  assert.equal(texts(state).pop(), '🍽 Reading the menu of <b>Salt House</b>…');
  assert.equal(answers(state).pop(), 'Reading the menu');
  tap(ctx, state, 'mn:' + TRIP + ':20270611:' + ctx.tgCmdTag('reed-table'));
  assert.equal(answers(state).pop(), 'That day has changed — send /day again.');
  tap(ctx, state, 'mn:' + TRIP + ':20270612:' + ctx.tgCmdTag('salt-house'));
  assert.equal(answers(state).pop(), 'That day has changed — send /day again.', 'day 3 has no dinner');
  tap(ctx, state, 'mn:' + TRIP + ':20270610:' + ctx.tgCmdTag('salt-house'));
  assert.equal(answers(state).pop(), 'That day has passed.');
  tap(ctx, state, 'mn:no-such-trip:20270611:' + ctx.tgCmdTag('salt-house'));
  assert.equal(answers(state).pop(), 'That day has changed — send /day again.');
  assert.equal(menuReqs(state).length, 1);
});

test('the day card and the morning message carry the 🍽 row through the skeleton\'s hooks', () => {
  const { ctx, state } = fresh();
  const trip = ctx.tgTripGet(TRIP), day = ctx.tgDigestDay(TRIP, D2);
  const kb = (msgs) => J(msgs).filter((m) => m.keyboard).pop().keyboard.inline_keyboard.map((r) => r.map((b) => b.text));
  assert.deepEqual(kb(ctx.tgCmdDayMessages(trip, day, 3)), [['🍽 Check the menu'], ['◀ Day 1', 'Day 3 ▶']]);
  assert.deepEqual(kb(ctx.tgMorningMessages(trip, day, 3, null, false)), [['⏰ Late 15 min', '30 min', '60 min'], ['📍 Re-plan from here'], ['🍽 Check the menu']]);
  say(ctx, state, '/day 2');
  assert.ok(sends(state).some((m) => btnTexts(m).includes('🍽 Check the menu')), '/day 2 shows it');
  deliver(ctx, state, check('yes'));
  assert.deepEqual(kb(ctx.tgCmdDayMessages(trip, ctx.tgDigestDay(TRIP, D2), 3))[0], ['🍽 Menu: fits']);
  assert.equal(audits(ctx, 'tg_day_rows_error').length, 0);
});

test('state.json menu_checks: the checks of the last 30 days, newest first, at most 50, { id, trip, place_slug, checked, fits, note }', () => {
  const { ctx, state } = fresh();
  deliver(ctx, state, check('yes'));
  deliver(ctx, state, check('no', { id: 'mn-20270605-salt-house', created_on: '2027-06-05', checked: '2027-06-05' }));
  deliver(ctx, state, check('partly', { id: 'mn-20270420-salt-house', created_on: '2027-04-20', checked: '2027-04-20' }));
  deliver(ctx, state, check('unknown', { id: 'mn-20270602-copper-kettle', trip: null, created_on: '2027-06-02', checked: '2027-06-02', place: { name: 'Copper Kettle', slug: 'copper-kettle' } }));
  const snap = J(ctx.HB_REGISTRY.snapshot.menu_checks());
  assert.deepEqual(snap, [
    { id: 'mn-20270605-salt-house', trip: TRIP, place_slug: 'salt-house', checked: '2027-06-05', fits: 'no', note: 'Nothing on the menu fits vegetarian' },
    { id: 'mn-20270602-copper-kettle', trip: null, place_slug: 'copper-kettle', checked: '2027-06-02', fits: 'unknown', note: 'No menu found to check' },
    { id: 'mn-20270601-salt-house', trip: TRIP, place_slug: 'salt-house', checked: '2027-06-01', fits: 'yes', note: check('yes').note }]);
  for (let i = 0; i < 52; i++) {
    const s = 'gull-' + i;
    ctx.tgMenuStore(check('yes', { id: 'mn-20270603-' + s, place: { name: 'Gull ' + i, slug: s }, checked: '2027-06-03' }));
  }
  assert.equal(J(ctx.HB_REGISTRY.snapshot.menu_checks()).length, 50);
  ctx.writeSnapshot();
  const st = JSON.parse(state.drive.readFile('TourGuide/mailbox/to-brain', 'state.json'));
  assert.equal(st.menu_checks.length, 50);
  assert.equal(st.menu_checks[0].id, 'mn-20270605-salt-house');
});

test('app: menu.list, menu.get, menu.new, menu.replan and menu.day', () => {
  const { ctx, state } = fresh();
  deliver(ctx, state, check('yes'));
  deliver(ctx, state, check('partly', { id: 'mn-20270420-salt-house', created_on: '2027-04-20', checked: '2027-04-20' }));
  const list = app(ctx, state, 'menu.list');
  assert.equal(list.ok, true);
  assert.equal(list.total, 2);
  assert.deepEqual(list.items.map((x) => x.id), ['mn-20270420-salt-house', 'mn-20270601-salt-house']);
  assert.deepEqual(Object.keys(list.items[0]).sort(), ['checked', 'date', 'fits', 'id', 'place_name', 'place_slug', 'received_at', 'trip']);
  const got = app(ctx, state, 'menu.get', { id: 'mn-20270601-salt-house' }).item;
  assert.equal(got.fits_line, '✅ Fits your party');
  assert.equal(got.local_name, 'Saltu Hus');
  assert.deepEqual(got.dishes[1], { name: 'Harbour noodle broth', course: 'main', fits: 'ask', local: 'Hama Nudla', ask: 'without the fish-stock broth?', price: '14.50' });
  assert.equal(got.others, 9);
  assert.deepEqual(got.sources, [{ title: 'Salt House — dinner menu', url: 'https://salt-house.example/menu' }]);
  assert.deepEqual(got.offer, [{ n: 2, date: D2, replan: true }]);
  assert.equal(got.has_vegcard, false);
  assert.deepEqual(app(ctx, state, 'menu.get', { id: 'mn-20270420-salt-house' }).item.offer, [{ n: 2, date: D2, replan: false, from: '2027-05-12', again: true }], 'from has come: check again');
  assert.equal(app(ctx, state, 'menu.get', { id: 'mn-20990101-nowhere' }).reason, 'no_menu');
  assert.equal(app(ctx, state, 'menu.get', { id: 'Salt House' }).reason, 'bad_args');

  assert.deepEqual(app(ctx, state, 'menu.day', { trip: TRIP, date: D2 }).button, { check: 'mn-20270601-salt-house', fits: 'yes' });
  assert.equal(app(ctx, state, 'menu.day', { trip: TRIP, date: D1 }).button, null, 'a past day');
  assert.equal(app(ctx, state, 'menu.day', { trip: TRIP, date: DATES[2] }).button, null, 'no dinner');
  assert.equal(app(ctx, state, 'menu.day', { trip: 'no-such-trip', date: D2 }).reason, 'no_trip');
  assert.equal(app(ctx, state, 'menu.day', { trip: TRIP, date: '2027-02-30' }).reason, 'bad_args');
  const none = fresh();
  assert.deepEqual(app(none.ctx, none.state, 'menu.day', { trip: TRIP, date: D2 }).button, { check: null, fits: null }, 'no check yet: ask for one');

  const nw = app(ctx, state, 'menu.new', { place: 'Salt House', slug: 'salt-house', date: 'today' });
  assert.equal(nw.ok, true);
  assert.deepEqual({ trip: nw.trip, place: nw.place, slug: nw.slug, date: nw.date }, { trip: TRIP, place: 'Salt House', slug: 'salt-house', date: D2 });
  assert.deepEqual(menuReqs(state).map((r) => [r.place, r.slug, r.date]), [['Salt House', 'salt-house', D2]]);
  assert.equal(app(ctx, state, 'menu.new', { place: 'Salt House', date: '2027-02-30' }).reason, 'bad_date');
  assert.equal(app(ctx, state, 'menu.new', { place: 'Salt House', date: '2027-06-01' }).reason, 'past_date');
  assert.equal(app(ctx, state, 'menu.new', { place: 'x'.repeat(81) }).reason, 'too_long');
  assert.equal(app(ctx, state, 'menu.new', { place: 'Salt House', slug: 'Salt House' }).reason, 'bad_args');
  assert.equal(app(ctx, state, 'menu.new', {}).reason, 'missing_arg');
  assert.equal(menuReqs(state).length, 1);

  const rp = app(ctx, state, 'menu.replan', { id: 'mn-20270601-salt-house', date: D2 });
  assert.equal(rp.ok, true);
  assert.equal(rp.day, 2);
  assert.deepEqual(reqOf(state, 'replan').map((r) => [r.dates, r.reason]), [[[D2], 'menu checked at Salt House']]);
  assert.equal(app(ctx, state, 'menu.replan', { id: 'mn-20270420-salt-house', date: D2 }).reason, 'not_offered');
  assert.equal(app(ctx, state, 'menu.replan', { id: 'mn-20270601-salt-house', date: DATES[2] }).reason, 'changed');
  assert.equal(app(ctx, state, 'menu.replan', { id: 'mn-20270601-salt-house' }).reason, 'missing_arg');
  assert.equal(reqOf(state, 'replan').length, 1);
});

// Developed by: LightAISolutions
