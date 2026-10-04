'use strict';
// TG-PHASE-14 WP-14c, core side: /vegcard and /vegcard rebuild, the `veg_card` envelope (the core validator and its
// parity with the pack's, the VegCards tab, the send-or-silent rule, an unknown trip refused), the morning line, the app
// ops vegcard.get and brochure.pdf (its three cases and its once-a-minute limit), has_vegcard on the trip row, and the
// old pin (no veg_card in helper.json) still loading. Invented data (Fernhollow, Quillmoor); no network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./harness/gas-mocks');

const NOW = '2027-05-01T12:00:00Z';
const TRIP = 'fernhollow-2027';
const SHELL = 'https://app.example.invalid/helper-app.html';
const J = (v) => JSON.parse(JSON.stringify(v));
const clone = J;
const V = () => import('../packs/tour-guide/vegcard/index.mjs');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(H.HELPERS_ROOT, 'packs', 'tour-guide', 'helper.json'), 'utf8'));
const OLD_PIN = { ...MANIFEST, envelope_types: MANIFEST.envelope_types.filter((t) => t !== 'veg_card') };

function fresh(o = {}) {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: NOW, manifest: o.manifest || MANIFEST });
  H.bootstrap(ctx, state);
  H.configureRoutine(ctx, state, 'RESEARCH');
  H.configureRoutine(ctx, state, 'BROCHURE');
  state.props[ctx.PROP.APP_SHELL_URL] = SHELL;
  ctx.tgTripUpsert({ slug: TRIP, title: 'Fernhollow', destination: 'Fernhollow', start: '2027-05-12', end: '2027-05-14', status: 'planned' });
  return { ctx, state };
}
const post = (ctx, state, upd) => ctx.doPost(H.postEvent('tg', { k: state.props[ctx.PROP.WEBHOOK_SECRET] }, upd));
const say = (ctx, state, text) => post(ctx, state, H.tgUpdate({ text }));
const texts = (state) => state.fetch.telegram('sendMessage').map((r) => r.json.text);
const app = (ctx, state, op, args) => J(H.appPost(ctx, state, 'app', args === undefined ? { op } : { op, args }));
const requests = (state) => (state.drive.listFiles('TourGuide/mailbox/to-brain') || []).filter((n) => /^req_/.test(n))
  .map((n) => JSON.parse(state.drive.readFile('TourGuide/mailbox/to-brain', n)));
const vegReqs = (state) => requests(state).filter((r) => r.payload.kind === 'vegcard');
const audits = (ctx, ev) => J(ctx.storeAll(ctx.SHEETS.AUDIT)).filter((r) => r.event === ev);
function deliver(ctx, state, payload, over) {
  H.putEnvelope(state, H.envelope('veg_card', payload, over));
  return J(ctx.pollFromBrain());
}
async function card(dietary = ['meat and fish', 'nuts'], size = 2, trip = TRIP, country = 'JP') {
  const { vegCard } = await V();
  return vegCard({ party: { dietary, size }, country, trip });
}

test('/vegcard with no card opens a vegcard request (routed to RESEARCH); /vegcard rebuild always does', async () => {
  const { ctx, state } = fresh();
  say(ctx, state, '/vegcard');
  const r = vegReqs(state);
  assert.equal(r.length, 1);
  assert.equal(r[0].payload.trip, TRIP);
  assert.equal(r[0].payload.rebuild, undefined);
  assert.equal(ctx.tgKindRoutine('vegcard'), 'RESEARCH');
  assert.equal(J(ctx.storeAll(ctx.SHEETS.REQUESTS)).find((x) => x.id === r[0].id).routine, 'RESEARCH');
  assert.ok(texts(state).some((t) => t === '🥗 Making the veg card for Fernhollow…'));
  deliver(ctx, state, await card(), { in_reply_to: r[0].id });
  say(ctx, state, '/vegcard rebuild');
  const again = vegReqs(state).filter((x) => x.payload.rebuild === true);
  assert.equal(again.length, 1, 'rebuild asks even with a card stored');
  say(ctx, state, '/vegcard please');
  assert.match(texts(state).pop(), /Usage: \/vegcard/);
});

test('the answer to an open request is stored and sent; /vegcard then shows it from storage, rendered as the pack renders it', async () => {
  const { ctx, state } = fresh();
  say(ctx, state, '/vegcard');
  const id = vegReqs(state)[0].id;
  const c = await card();
  const n0 = texts(state).length;
  assert.equal(deliver(ctx, state, c, { in_reply_to: id, dedupe_key: `vegcard:${TRIP}:${c.fp}` }).processed, 1);
  const sent = texts(state).slice(n0);
  const { vegCardTelegram } = await V();
  assert.deepEqual(sent, [vegCardTelegram(c)], 'one message, the same HTML as the pack renderer');
  assert.match(sent[0], /<b>私たちはベジタリアンです。肉・魚・魚介類は食べられません。<\/b>\n<i>We are vegetarian\./);
  const row = J(ctx.storeAll('VegCards'))[0];
  assert.equal(row.id, TRIP);
  assert.equal(row.fp, c.fp);
  assert.equal(J(ctx.storeAll(ctx.SHEETS.REQUESTS)).find((x) => x.id === id).status, 'answered');
  const n1 = texts(state).length;
  say(ctx, state, '/vegcard');
  assert.deepEqual(texts(state).slice(n1), [vegCardTelegram(c)]);
  assert.equal(vegReqs(state).length, 0, 'the answered request was archived and no new one opened');
});

test('send-or-silent: an unprompted card with the stored fp is stored silently; a changed fp is sent; a new trip card is sent', async () => {
  const { ctx, state } = fresh();
  const c = await card();
  let n = texts(state).length;
  deliver(ctx, state, c);
  assert.equal(texts(state).length, n + 1, 'nothing stored before: sent');
  n = texts(state).length;
  assert.equal(deliver(ctx, state, clone(c)).processed, 1);
  assert.equal(texts(state).length, n, 'same fp, no request: silent');
  assert.equal(J(ctx.storeAll('VegCards')).length, 1);
  const c2 = await card(['meat and fish', 'nuts', 'alcohol']);
  assert.notEqual(c2.fp, c.fp);
  deliver(ctx, state, c2);
  assert.equal(texts(state).length, n + 1, 'changed fp: sent');
  assert.equal(J(ctx.storeAll('VegCards'))[0].fp, c2.fp);
  // an answer to a request of another kind does not count as asked
  say(ctx, state, '/brochure');
  const br = requests(state).find((r) => r.payload.kind === 'brochure');
  n = texts(state).length;
  deliver(ctx, state, clone(c2), { in_reply_to: br.id });
  assert.equal(texts(state).length, n, 'not a vegcard request: silent');
});

test('a card for a trip the core does not know is refused and audited; nothing is stored', async () => {
  const { ctx, state } = fresh();
  const r = deliver(ctx, state, await card(undefined, 2, 'quillmoor-2099'));
  assert.equal(r.rejected, 1);
  assert.ok(audits(ctx, 'envelope_rejected').some((a) => /unknown trip/.test(JSON.stringify(a))));
  assert.equal(J(ctx.storeAll('VegCards')).length, 0);
  const bad = await card(); bad.sections.reverse();
  assert.equal(deliver(ctx, state, bad).rejected, 1, 'out of order: refused');
});

test('parity: the core validator and the pack validator agree, including every text bound in kanji, emoji and combining marks', async () => {
  const { validateVegCardPayload } = await V();
  const { ctx } = fresh();
  const core = (p) => J(ctx.tgEnvCleaned(ctx.tgEnvValidateVegCard)(clone(p)));
  const base = await card(['meat and fish', 'nuts', 'lupin beans']);
  const plain = await card(['vegan'], 1, TRIP, 'NZ');
  const differ = [];
  const check = (label, p) => {
    const a = validateVegCardPayload(clone(p)).length === 0, b = core(p).length === 0;
    if (a !== b) differ.push(`${label}: pack ${a ? 'accepts' : 'refuses'}, core ${b ? 'accepts' : 'refuses'} (${core(p).join('; ')})`);
    return a;
  };
  assert.equal(check('base', base), true);
  assert.equal(check('plain', plain), true);
  const mutations = {
    reversed: (p) => p.sections.reverse(), twice: (p) => p.sections.push(clone(p.sections[0])), lang_null: (p) => { p.lang = null; },
    local_null: (p) => { p.sections[0].lines[0].local = null; }, fp_upper: (p) => { p.fp = 'vcf1:ABCDEF12'; }, fp_short: (p) => { p.fp = 'vcf1:abc'; },
    party_0: (p) => { p.party = 0; }, party_13: (p) => { p.party = 13; }, party_float: (p) => { p.party = 1.5; }, lang_fr: (p) => { p.lang = 'fr'; },
    diet_x: (p) => { p.diet = 'pescatarian'; }, country_lower: (p) => { p.country = 'jp'; },
    country_long: (p) => { p.country = 'JPN'; }, section_id: (p) => { p.sections[0].id = 'menu'; }, extra_key: (p) => { p.extra = 1; },
    line_key: (p) => { p.sections[0].lines[0].x = 1; }, no_lines: (p) => { p.sections[0].lines = []; }, no_sections: (p) => { p.sections = []; },
    seven: (p) => { p.sections = Array.from({ length: 7 }, () => clone(p.sections[0])); }, v2: (p) => { p.v = 2; }, no_v: (p) => { delete p.v; },
    no_trip: (p) => { delete p.trip; }, bad_trip: (p) => { p.trip = 'Fern Hollow'; }, eo_13: (p) => { p.english_only = Array.from({ length: 13 }, (_, i) => 'x' + i); },
    eo_num: (p) => { p.english_only = [3]; }, lines_13: (p) => { p.sections[0].lines = Array.from({ length: 13 }, () => clone(p.sections[0].lines[0])); },
    big: (p) => { p.sections = ['intro', 'avoid', 'ok', 'ask', 'thanks'].map((id) => ({ id, lines: Array.from({ length: 12 }, () => ({ local: '漢'.repeat(150), en: 'e'.repeat(150) })) })); },
    kind: (p) => { p.kind = 'veg_card'; }, sections_obj: (p) => { p.sections = {}; }
  };
  for (const [name, m] of Object.entries(mutations)) { const p = clone(base); m(p); assert.equal(check(name, p), false, name + ' must be refused'); }
  { const p = clone(base); p.country = null; assert.equal(check('country_null', p), true, 'a null country is accepted'); }
  const units = { kanji: '漢', emoji: '😀', combining: 'é' };
  const fill = (u, n) => u.repeat(Math.floor(n / u.length)) + 'a'.repeat(n % u.length);
  const probes = [['local', 200, (p, s) => { p.sections[0].lines[0].local = s; }], ['en', 200, (p, s) => { p.sections[1].lines[0].en = s; }],
    ['english_only', 60, (p, s) => { p.english_only[0] = s; }]];
  for (const [field, max, set] of probes) {
    for (const [kind, u] of Object.entries(units)) {
      for (const n of [max, max + 1, 0]) { const p = clone(base); set(p, fill(u, n)); const ok = check(`${field} ${kind} × ${n}`, p); if (n !== max) assert.equal(ok, false, `${field} ${n}`); }
    }
  }
  assert.deepEqual(differ, []);
});

test('the morning message links the card near its end when the trip has one, on a full day and on a free day', async () => {
  const { ctx, state } = fresh();
  const trip = () => ctx.tgTripGet(TRIP);
  const full = { date: '2027-05-12', n: 1, stops: [{ n: 1, name: 'Reed Mill', slug: 'reed-mill' }], sunset: '19:42' };
  const free = { date: '2027-05-13', n: 2, stops: [] };
  const all = (msgs) => J(msgs).map((m) => m.html).join('\n');
  assert.doesNotMatch(all(ctx.tgMorningMessages(trip(), full, 3, null, false)), /Veg card/);
  assert.doesNotMatch(all(ctx.tgMorningMessages(trip(), free, 3, null, false)), /Veg card/);
  deliver(ctx, state, await card());
  const f = all(ctx.tgMorningMessages(trip(), full, 3, null, false));
  assert.match(f, /🌅 Sunset 19:42\n🥗 Veg card — \/vegcard$/);
  assert.match(all(ctx.tgMorningMessages(trip(), free, 3, null, false)), /<b>Free day\.<\/b>\n🥗 Veg card — \/vegcard$/);
  ctx.tgTripUpsert({ slug: 'quillmoor-2027', title: 'Quillmoor', destination: 'Quillmoor', start: '2027-06-01', end: '2027-06-02', status: 'planned' });
  assert.doesNotMatch(all(ctx.tgMorningMessages(ctx.tgTripGet('quillmoor-2027'), free, 2, null, false)), /Veg card/, 'another trip has no card');
});

test('app: vegcard.get answers the stored card or 404; has_vegcard on the trip row', async () => {
  const { ctx, state } = fresh();
  assert.deepEqual(app(ctx, state, 'vegcard.get', { slug: TRIP }), { ok: false, reason: 'no_vegcard', status: 404 });
  assert.equal(app(ctx, state, 'vegcard.get', { slug: 'quillmoor-2099' }).reason, 'no_trip');
  assert.equal(app(ctx, state, 'vegcard.get', { slug: 'Not A Slug' }).status, 400);
  assert.equal(J(ctx.tgAppTripOut(ctx.tgTripGet(TRIP))).has_vegcard, false);
  const c = await card(['meat and fish', '<b>lupin</b>']);
  deliver(ctx, state, c);
  const r = app(ctx, state, 'vegcard.get', { slug: TRIP });
  assert.equal(r.ok, true);
  assert.equal(r.trip, TRIP);
  assert.equal(r.fp, c.fp);
  assert.deepEqual(r.card, c);
  assert.equal(J(ctx.tgAppTripOut(ctx.tgTripGet(TRIP))).has_vegcard, true);
  const home = app(ctx, state, 'home');
  if (Array.isArray(home.trips) && home.trips.length) assert.equal(home.trips.find((t) => t.slug === TRIP).has_vegcard, true);
});

test('app brochure.pdf: the stored PDF is sent, no PDF builds, an id outside the folder is refused and audited, once a minute', () => {
  const { ctx, state } = fresh();
  const docs = () => state.fetch.telegram('sendDocument').length;
  // no PDF → a brochure request, { building: true }
  assert.deepEqual(app(ctx, state, 'brochure.pdf', { slug: TRIP }), { ok: true, building: true });
  assert.equal(requests(state).filter((r) => r.payload.kind === 'brochure').length, 1);
  // once a minute per trip
  assert.deepEqual(app(ctx, state, 'brochure.pdf', { slug: TRIP }), { ok: false, reason: 'too_soon', retry_after: 60, status: 409 });
  ctx.__TEST_NOW = new Date(Date.parse(NOW) + 61000).toISOString();
  // a PDF inside the helper's folder → sent as a document
  const f = state.drive.putFile('TourGuide/Trips', 'fernhollow-brochure.pdf', '%PDF-fixture', 'application/pdf');
  ctx.tgTripUpsert({ slug: TRIP, drive_brochure_pdf: f.getId() });
  const d0 = docs();
  assert.deepEqual(app(ctx, state, 'brochure.pdf', { slug: TRIP }), { ok: true, sent: true });
  assert.equal(docs(), d0 + 1);
  assert.equal(app(ctx, state, 'brochure.pdf', { slug: TRIP }).reason, 'too_soon');
  assert.equal(docs(), d0 + 1);
  // an id outside the folder → refused and audited, nothing sent, no request
  ctx.__TEST_NOW = new Date(Date.parse(NOW) + 200000).toISOString();
  const out = state.drive.putFile('Elsewhere', 'other.pdf', '%PDF', 'application/pdf');
  ctx.tgTripUpsert({ slug: TRIP, drive_brochure_pdf: out.getId() });
  const nReq = requests(state).length;
  assert.deepEqual(app(ctx, state, 'brochure.pdf', { slug: TRIP }), { ok: false, reason: 'no_brochure', status: 404 });
  assert.ok(audits(ctx, 'tg_app_brochure_outside_root').some((a) => a.ref === out.getId()));
  assert.equal(docs(), d0 + 1);
  assert.equal(requests(state).length, nReq);
  assert.equal(app(ctx, state, 'brochure.pdf', { slug: 'quillmoor-2099' }).reason, 'no_trip');
  // no owner chat: the app's auth already answers 403 before any op runs, so the op's own guard is called directly
  ctx.__TEST_NOW = new Date(Date.parse(NOW) + 400000).toISOString();
  delete state.props[ctx.PROP.OWNER_CHAT_ID];
  ctx.tgTripUpsert({ slug: TRIP, drive_brochure_pdf: f.getId() });
  assert.equal(app(ctx, state, 'brochure.pdf', { slug: TRIP }).status, 403);
  const r = ctx.tgAppOpBrochurePdf({ slug: TRIP });
  assert.equal(r.status, 409);
  assert.equal(r.body.reason, 'no_chat');
  assert.equal(docs(), d0 + 1);
});

test('the old pin: without veg_card in helper.json the core loads, registers no handler, and still accepts the old types', async () => {
  const { ctx, state } = fresh({ manifest: OLD_PIN });
  assert.equal(ctx.getEnvelopeHandler('veg_card'), null);
  assert.equal(deliver(ctx, state, await card()).rejected, 1, 'veg_card is an unknown type there');
  assert.ok(ctx.getEnvelopeHandler('scout') && ctx.getEnvelopeHandler('plan_digest'));
  say(ctx, state, '/vegcard');
  assert.equal(vegReqs(state).length, 1, 'the command still asks; the card waits for the new pin');
});

// Developed by: LightAISolutions
