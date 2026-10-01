'use strict';
// Tour Guide pack — gas/13_flow_review.js: the post-trip /review flow, the rv:go button and the daily offer.
// Trips, places and wording are invented ("Port Sorrel").
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');

const NOW = '2027-05-01T12:00:00Z';
const TRIP = 'port-sorrel';
const J = (v) => JSON.parse(JSON.stringify(v));
const maps = (id) => 'https://www.google.com/maps/search/?api=1&query=Fixture&query_place_id=' + id;

function fresh() {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: NOW });
  H.bootstrap(ctx, state);
  ['RESEARCH', 'PLAN', 'PREFS'].forEach((n) => H.configureRoutine(ctx, state, n));
  return { ctx, state };
}
const post = (ctx, state, upd) => ctx.doPost(H.postEvent('tg', { k: state.props[ctx.PROP.WEBHOOK_SECRET] }, upd));
const say = (ctx, state, text) => post(ctx, state, H.tgUpdate({ text }));
const sends = (state) => state.fetch.telegram('sendMessage').map((r) => r.json);
const texts = (state) => sends(state).map((m) => m.text);
const answers = (state) => state.fetch.telegram('answerCallbackQuery').map((r) => r.json.text);
const lastKb = (state) => sends(state).filter((j) => j.reply_markup).pop();
const requests = (state) => (state.drive.listFiles('TourGuide/mailbox/to-brain') || []).filter((n) => /^req_/.test(n))
  .map((n) => JSON.parse(state.drive.readFile('TourGuide/mailbox/to-brain', n)).payload);
function deliver(ctx, state, type, payload) {
  H.putEnvelope(state, H.envelope(type, payload));
  return J(ctx.pollFromBrain());
}
function tap(ctx, state, data) { post(ctx, state, H.tgUpdate({ callback: data, messageId: 91 })); }
function press(ctx, state, label) {
  const b = lastKb(state).reply_markup.inline_keyboard.flat().find((x) => x.text === label || x.text.endsWith(label));
  assert.ok(b, 'button ' + label + ' among ' + lastKb(state).reply_markup.inline_keyboard.flat().map((x) => x.text).join(' | '));
  tap(ctx, state, b.callback_data);
}
const stop = (n, slug, name, minutes) => ({ n, slug, name, arrive: '10:00', depart: '11:00', minutes, maps_url: maps('Fixture' + slug.length), note_line: '' });
const digest = (over = {}) => ({ v: 1, kind: 'plan_digest', trip: TRIP, build_id: 'build-ps-1', verified_on: '2027-04-30',
  days: [{ date: '2027-05-12', theme: 'Harbour', stops: [stop(1, 'lantern-museum', 'Lantern <Museum>', 60), stop(2, 'signal-hill-lookout', 'Signal Hill Lookout', 90)], legs: [], warnings: [] },
    { date: '2027-05-13', theme: 'Market', stops: [stop(1, 'saffron-row-market', 'Saffron Row Market', 45), stop(2, 'lantern-museum', 'Lantern <Museum>', 30)], legs: [], warnings: [] }],
  later: [], drive: { plan: 'fixtureDrivePlanFile01', brochure_html: null, brochure_pdf: null }, ...over });
/** A planned trip 12–14 May with its digest stored. */
function planned(ctx, state, over = {}) {
  ctx.tgTripUpsert({ slug: TRIP, title: 'Port Sorrel', destination: 'Port Sorrel', start: '2027-05-12', end: '2027-05-14', ...over });
  assert.equal(deliver(ctx, state, 'plan_digest', digest()).processed, 1);
  assert.equal(ctx.tgTripGet(TRIP).status, 'planned');
}

test('items: digest stops in visit order, one per place', () => {
  const { ctx, state } = fresh();
  planned(ctx, state);
  assert.deepEqual(J(ctx.tgRvItems(TRIP)).map((i) => [i.slug, i.date, i.minutes]),
    [['lantern-museum', '2027-05-12', 60], ['signal-hill-lookout', '2027-05-12', 90], ['saffron-row-market', '2027-05-13', 45]]);
  assert.deepEqual(J(ctx.tgRvItems('nowhere')), []);
});

test('the review: rate, calibrate, skip, finish → one prefs request, trip done, taps kept', () => {
  const { ctx, state } = fresh();
  planned(ctx, state);
  say(ctx, state, '/review');
  let t = texts(state).pop();
  assert.match(t, /<i>1 of 3 · Port Sorrel<\/i>/);
  assert.match(t, /<b>Lantern &lt;Museum&gt;<\/b> — Wed 12 May · 1 h planned/);
  assert.match(t, /Worth it\?/);
  assert.equal(ctx.flowActive('777').flow, 'review');
  assert.ok(ctx.tgTripGet(TRIP).review_offered_at, 'starting a review counts as offered');
  const data = lastKb(state).reply_markup.inline_keyboard.flat().map((b) => b.callback_data);
  assert.ok(data.every((d) => Buffer.byteLength(d) <= 64 && /^fl:/.test(d)));

  press(ctx, state, 'Worth it');
  assert.match(texts(state).pop(), /And the time there\?/);
  press(ctx, state, 'Needed longer');
  t = texts(state).pop();
  assert.match(t, /2 of 3/);
  assert.match(t, /Signal Hill Lookout<\/b> — Wed 12 May · 1 h 30 planned/);
  press(ctx, state, 'Skipped it');
  assert.match(texts(state).pop(), /3 of 3 · Port Sorrel<\/i>\n<b>Saffron Row Market<\/b> — Thu 13 May · 45 min planned/);
  press(ctx, state, 'Not really');
  press(ctx, state, 'Not sure');
  assert.match(texts(state).pop(), /Noted — this will shape the next plan/);
  assert.equal(ctx.flowActive('777'), null);

  const prefs = requests(state).filter((r) => r.kind === 'prefs');
  assert.equal(prefs.length, 1);
  assert.deepEqual(prefs[0].review, { trip: TRIP, items: [
    { slug: 'lantern-museum', rating: 'up', calibration: 'longer' },
    { slug: 'signal-hill-lookout', rating: 'skipped' },
    { slug: 'saffron-row-market', rating: 'down' }] });
  assert.equal(ctx.tgTripGet(TRIP).status, 'done');
  assert.deepEqual(J(ctx.tgChoiceList(TRIP, 'review', 'review')).map((c) => [c.key, c.value, c.text]),
    [['lantern-museum', 'up', 'longer'], ['signal-hill-lookout', 'skipped', ''], ['saffron-row-market', 'down', '']]);
});

test('finish early: nothing rated records nothing; a partial review is sent', () => {
  const { ctx, state } = fresh();
  planned(ctx, state);
  say(ctx, state, '/review');
  press(ctx, state, 'Finish');
  assert.match(texts(state).pop(), /Nothing recorded/);
  assert.equal(requests(state).filter((r) => r.kind === 'prefs').length, 0);
  assert.equal(ctx.tgTripGet(TRIP).status, 'planned');

  say(ctx, state, '/review Port');
  press(ctx, state, 'Worth it');
  press(ctx, state, 'About right');
  press(ctx, state, 'Finish');
  const prefs = requests(state).filter((r) => r.kind === 'prefs');
  assert.equal(prefs.length, 1);
  assert.deepEqual(prefs[0].review.items, [{ slug: 'lantern-museum', rating: 'up', calibration: 'right' }]);
  assert.equal(ctx.tgTripGet(TRIP).status, 'done');
});

test('/review guards: no trip, unknown name, no stops, another flow, same review again', () => {
  const { ctx, state } = fresh();
  say(ctx, state, '/review');
  assert.match(texts(state).pop(), /No trip to review yet/);
  say(ctx, state, '/review <Nowhere>');
  assert.match(texts(state).pop(), /No trip matches “&lt;Nowhere&gt;”/);
  ctx.tgTripUpsert({ slug: TRIP, title: 'Port Sorrel', destination: 'Port Sorrel', start: '2027-05-12', end: '2027-05-14' });
  say(ctx, state, '/review');
  assert.match(texts(state).pop(), /No planned stops to review for <b>Port Sorrel<\/b>/);
  assert.equal(ctx.flowActive('777'), null);

  assert.equal(deliver(ctx, state, 'plan_digest', digest()).processed, 1);
  say(ctx, state, '/interview');
  say(ctx, state, '/review');
  assert.match(texts(state).pop(), /middle of \/interview/);
  assert.equal(ctx.flowActive('777').flow, 'interview');
  say(ctx, state, '/cancel');

  say(ctx, state, '/review');
  press(ctx, state, 'Worth it');
  const n = sends(state).length;
  say(ctx, state, '/review');
  assert.equal(sends(state).length, n + 1);
  assert.match(texts(state).pop(), /And the time there\?/, 'the same review re-asks where it stands');
});

test('daily offer: once, the day after the end, planned trips with stops, inside the window', () => {
  const { ctx, state } = fresh();
  assert.equal(typeof ctx.HB_REGISTRY.daily.tg_review_offer, 'function');
  planned(ctx, state);
  ctx.tgTripUpsert({ slug: 'old-harbour', title: 'Old Harbour', destination: 'Old Harbour', start: '2027-04-20', end: '2027-04-22', status: 'planned' });
  ctx.tgTripUpsert({ slug: 'still-choosing', title: 'Still Choosing', destination: 'Still Choosing', start: '2027-05-10', end: '2027-05-13', status: 'choosing' });
  ctx.tgTripUpsert({ slug: 'no-stops', title: 'No Stops', destination: 'No Stops', start: '2027-05-10', end: '2027-05-13', status: 'planned' });

  ctx.__TEST_NOW = '2027-05-14T12:00:00Z';
  assert.deepEqual(J(ctx.tgRvOffer()).offered, [], 'not while the trip is still on');
  ctx.__TEST_NOW = '2027-05-15T12:00:00Z';
  const n = sends(state).length;
  assert.deepEqual(J(ctx.tgRvOffer()).offered, [TRIP]);
  const m = sends(state)[n];
  assert.match(m.text, /Welcome back from <b>Port Sorrel<\/b>\. Rate the 3 places/);
  assert.deepEqual(m.reply_markup.inline_keyboard.flat().map((b) => b.callback_data), ['rv:go:port-sorrel']);
  assert.equal(sends(state).length, n + 1, 'old, choosing and stop-less trips are not offered');
  assert.ok(ctx.tgTripGet(TRIP).review_offered_at);
  ctx.__TEST_NOW = '2027-05-16T12:00:00Z';
  assert.deepEqual(J(ctx.tgRvOffer()).offered, [], 'offered once');

  tap(ctx, state, 'rv:go:port-sorrel');
  assert.match(texts(state).pop(), /1 of 3 · Port Sorrel/);
  assert.equal(ctx.flowActive('777').flow, 'review');
  tap(ctx, state, 'rv:go:gone-trip');
  assert.match(answers(state).pop(), /That trip is gone/);
  tap(ctx, state, 'rv:xx:port-sorrel');
  assert.match(answers(state).pop(), /Unknown button/);
});

test('/review with no name picks the latest ended trip that is not done', () => {
  const { ctx, state } = fresh();
  planned(ctx, state);
  ctx.tgTripUpsert({ slug: 'next-trip', title: 'Next Trip', destination: 'Next Trip', start: '2027-06-01', end: '2027-06-03', status: 'planned' });
  ctx.__TEST_NOW = '2027-05-20T12:00:00Z';
  assert.equal(ctx.tgRvPickTrip('').slug, TRIP);
  ctx.tgTripSetStatus(TRIP, 'done');
  assert.equal(ctx.tgRvPickTrip('').slug, 'next-trip', 'falls back to the current trip');
  assert.equal(ctx.tgRvPickTrip('port sorrel').slug, TRIP, 'a name still finds a done trip');
});

// Developed by: LightAISolutions
