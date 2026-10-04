'use strict';
// WP-13c shared test world: an invented trip "Fernhollow" (10–15 Jun 2027), its plan digest and chat helpers.
// Not a test file itself (no .test.js); the WP-13c tests require it. Everything here is invented.
const H = require('./harness/gas-mocks');

const NOW = '2027-05-01T16:00:00Z';
const TRIP = 'fernhollow';
const J = (v) => JSON.parse(JSON.stringify(v));
const maps = (id) => 'https://www.google.com/maps/search/?api=1&query=Fixture&query_place_id=' + id;

function fresh(now) {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: now || NOW });
  H.bootstrap(ctx, state);
  ['RESEARCH', 'PLAN', 'PREFS', 'NOTES', 'BROCHURE', 'PLACES', 'SCOUT'].forEach((n) => H.configureRoutine(ctx, state, n));
  return { ctx, state };
}
const post = (ctx, state, upd) => ctx.doPost(H.postEvent('tg', { k: state.props[ctx.PROP.WEBHOOK_SECRET] }, upd));
const say = (ctx, state, text) => post(ctx, state, H.tgUpdate({ text }));
const tap = (ctx, state, data, messageId) => post(ctx, state, H.tgUpdate({ callback: data, messageId: messageId || 91 }));
const sends = (state) => state.fetch.telegram('sendMessage').map((r) => r.json);
const texts = (state) => sends(state).map((m) => m.text);
const last = (state) => texts(state).pop();
const edits = (state) => state.fetch.telegram('editMessageText').map((r) => r.json.text);
const kbData = (m) => (m && m.reply_markup ? m.reply_markup.inline_keyboard.flat().map((b) => b.callback_data) : []);
const reqEnvs = (state) => (state.drive.listFiles('TourGuide/mailbox/to-brain') || []).filter((n) => /^req_/.test(n))
  .map((n) => JSON.parse(state.drive.readFile('TourGuide/mailbox/to-brain', n)));
const reqOf = (state, kind) => reqEnvs(state).filter((e) => e.payload.kind === kind).map((e) => e.payload);
const reqEnvOf = (state, kind) => reqEnvs(state).filter((e) => e.payload.kind === kind);
function deliver(ctx, state, type, payload, over) {
  H.putEnvelope(state, H.envelope(type, payload, over));
  return J(ctx.pollFromBrain());
}
const stop = (n, slug, name) => ({ n, slug, name, arrive: '10:00', depart: '11:00', minutes: 60, maps_url: maps('Fixture' + n), note_line: 'Look up.' });
const digest = (over = {}) => ({ v: 1, kind: 'plan_digest', trip: TRIP, build_id: 'build-fh-1', verified_on: '2027-04-30',
  days: [{ date: '2027-06-10', theme: 'Mill race', stops: [stop(1, 'reed-mill', 'Reed Mill')], legs: [], warnings: [] },
    { date: '2027-06-11', theme: 'Orchards', stops: [stop(1, 'pear-walk', 'Pear Walk')], legs: [], warnings: [] },
    { date: '2027-06-12', theme: 'Free', stops: [], legs: [], warnings: [] }],
  later: [], drive: { plan: 'fixtureDrivePlanFileFh', brochure_html: null, brochure_pdf: null }, ...over });
/** The trip with its dates (10–15 Jun) pinned as current; no plan yet. */
function trip(ctx) {
  ctx.tgTripUpsert({ slug: TRIP, title: 'Fernhollow', destination: 'Fernhollow', start: '2027-06-10', end: '2027-06-15' });
  ctx.settingSet(ctx.TG_SETTINGS.CURRENT_TRIP, TRIP, 'test');
}
/** The trip with its plan stored (digest answered without a request). */
function planned(ctx, state, over) {
  trip(ctx);
  const r = deliver(ctx, state, 'plan_digest', digest(over));
  if (r.processed !== 1) throw new Error('digest not processed: ' + JSON.stringify(r));
}

module.exports = { H, NOW, TRIP, J, maps, fresh, post, say, tap, sends, texts, last, edits, kbData, reqEnvs, reqOf, reqEnvOf,
  deliver, digest, stop, trip, planned };

// Developed by: LightAISolutions
