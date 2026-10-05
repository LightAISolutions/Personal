'use strict';
// Tour Guide pack — gas/48_daybook.js (Contract C18 wave 3, WP-18e): /daybook <date> opens a request of kind `daybook`
// { trip, date, build_id } for the BROCHURE routine; usage, a date outside the plan and a free day get a plain reply and
// no request; bare /daybook is today's when today is a day of the plan; a reply to it never becomes the trip's brochure; the
// command guide and keywords list it. Trips, places and wording are invented ("Port Sorrel").
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');

const TRIP = 'port-sorrel';
const J = (v) => JSON.parse(JSON.stringify(v));
const maps = (id) => 'https://www.google.com/maps/search/?api=1&query=Fixture&query_place_id=' + id;

function fresh(now = '2027-05-01T16:00:00Z') {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now });
  H.bootstrap(ctx, state);
  ['PLAN', 'BROCHURE'].forEach((n) => H.configureRoutine(ctx, state, n));
  return { ctx, state };
}
const post = (ctx, state, upd) => ctx.doPost(H.postEvent('tg', { k: state.props[ctx.PROP.WEBHOOK_SECRET] }, upd));
const say = (ctx, state, text) => post(ctx, state, H.tgUpdate({ text }));
const texts = (state) => state.fetch.telegram('sendMessage').map((r) => r.json.text);
const last = (state) => texts(state).pop();
const reqEnvs = (state) => (state.drive.listFiles('TourGuide/mailbox/to-brain') || []).filter((n) => /^req_/.test(n))
  .map((n) => JSON.parse(state.drive.readFile('TourGuide/mailbox/to-brain', n)));
const daybooks = (state) => reqEnvs(state).filter((e) => e.payload.kind === 'daybook');
function deliver(ctx, state, type, payload, over) {
  H.putEnvelope(state, H.envelope(type, payload, over));
  return J(ctx.pollFromBrain());
}
const digest = () => ({ v: 1, kind: 'plan_digest', trip: TRIP, build_id: 'build-ps-1', verified_on: '2027-04-30',
  days: [{ date: '2027-05-12', theme: 'Harbour', stops: [{ n: 1, slug: 'lantern-museum', name: 'Lantern Museum', arrive: '10:00', depart: '11:00', minutes: 60, maps_url: maps('FixtureA'), note_line: 'Start upstairs.' }],
    legs: [], warnings: [] },
  { date: '2027-05-13', theme: 'Free', stops: [], legs: [], warnings: [] },
  { date: '2027-05-14', theme: 'Rope works', stops: [{ n: 1, slug: 'rope-loft', name: 'Rope Loft', arrive: '09:30', depart: '11:30', minutes: 120, maps_url: maps('FixtureB'), note_line: 'The long room first.' }],
    legs: [], warnings: [] }],
  later: [], drive: { plan: 'fixtureDrivePlanFile01', brochure_html: null, brochure_pdf: null } });
function planned(ctx, state) {
  ctx.tgTripUpsert({ slug: TRIP, title: 'Port Sorrel', destination: 'Port Sorrel', start: '2027-05-12', end: '2027-05-14' });
  const res = deliver(ctx, state, 'plan_digest', digest());
  assert.equal(res.processed, 1, JSON.stringify(res));
  ctx.settingSet(ctx.TG_SETTINGS.CURRENT_TRIP, TRIP, 'test');
}

test('/daybook <date> opens a daybook request { trip, date, build_id } routed to BROCHURE, by date, day N or N', () => {
  const { ctx, state } = fresh();
  planned(ctx, state);
  assert.equal(ctx.tgKindRoutine('daybook'), 'BROCHURE');
  say(ctx, state, '/daybook 2027-05-12');
  let r = daybooks(state);
  assert.equal(r.length, 1);
  assert.deepEqual(J(r[0].payload).trip, TRIP);
  assert.equal(r[0].payload.date, '2027-05-12');
  assert.equal(r[0].payload.build_id, 'build-ps-1');
  assert.equal(r[0].type, 'request');
  assert.equal(J(ctx.storeAll(ctx.SHEETS.REQUESTS)).find((x) => x.id === r[0].id).routine, 'BROCHURE');
  assert.ok(texts(state).some((t) => /^📘 Building the Day book for .*12.* of Port Sorrel…$/.test(t)), JSON.stringify(texts(state)));
  say(ctx, state, '/daybook day 3');
  say(ctx, state, '/daybook 1');
  r = daybooks(state);
  assert.deepEqual(r.map((e) => e.payload.date).sort(), ['2027-05-12', '2027-05-12', '2027-05-14']);
});

test('/daybook: usage, a date outside the plan and a free day get a reply and no request', () => {
  const { ctx, state } = fresh();
  planned(ctx, state);
  say(ctx, state, '/daybook');
  assert.match(last(state), /^Usage: <code>\/daybook &lt;date or day N&gt;<\/code>/, 'bare /daybook before the trip: the usage line');
  say(ctx, state, '/daybook please');
  assert.match(last(state), /^Usage: <code>\/daybook/);
  say(ctx, state, '/daybook 2027-06-01');
  assert.equal(last(state), 'That day is not in the plan of Port Sorrel, which covers Wed 12 May – Fri 14 May. /trip shows its days; to plan another place, send <code>/plan &lt;where&gt;</code>.');
  say(ctx, state, '/daybook 2027-05-13');
  assert.match(last(state), / is a free day with nothing planned, so there is no Day book for it\.$/);
  assert.equal(daybooks(state).length, 0);
});

test('bare /daybook during the trip is today\'s Day book; on a free day it says so', () => {
  const a = fresh('2027-05-14T09:00:00Z');
  planned(a.ctx, a.state);
  say(a.ctx, a.state, '/daybook');
  assert.deepEqual(daybooks(a.state).map((e) => e.payload.date), ['2027-05-14']);
  const b = fresh('2027-05-13T09:00:00Z');
  planned(b.ctx, b.state);
  say(b.ctx, b.state, '/daybook');
  assert.match(last(b.state), /^Thu 13 May is a free day with nothing planned/);
  assert.equal(daybooks(b.state).length, 0);
  say(b.ctx, b.state, '/daybook tomorrow');
  assert.deepEqual(daybooks(b.state).map((e) => e.payload.date), ['2027-05-14']);
});

test('a reply to a daybook request is answered and sent, and never becomes the trip\'s brochure', () => {
  const { ctx, state } = fresh();
  planned(ctx, state);
  say(ctx, state, '/daybook 2027-05-12');
  const [id] = daybooks(state).map((e) => e.id);
  const f = state.drive.putFile('TourGuide/Trips', 'port-sorrel-daybook-2027-05-12.pdf', '%PDF-fixture', 'application/pdf');
  const n0 = texts(state).length;
  assert.equal(deliver(ctx, state, 'reply', { text: 'Day book ready.', drive_file_ids: { brochure_pdf: f.getId() } }, { in_reply_to: id }).processed, 1);
  assert.ok(texts(state).slice(n0).some((t) => /Day book ready\./.test(t)), JSON.stringify(texts(state).slice(n0)));
  assert.equal(J(ctx.storeAll(ctx.SHEETS.REQUESTS)).find((x) => x.id === id).status, 'answered');
  assert.ok(!ctx.tgTripGet(TRIP).drive_brochure_pdf, 'the Day book is not stored as the trip\'s brochure');
});

test('the command guide and the keywords list /daybook; it registers with a help line', () => {
  const { ctx } = fresh();
  const g = J(ctx.TG_CMD_GUIDE).find((e) => e.cmd === '/daybook');
  assert.ok(g, 'a guide entry');
  assert.equal(g.group, 'trip');
  assert.ok(g.forms.length >= 1 && g.forms.every((f) => /^\/daybook /.test(f[0])));
  assert.equal(g.opens, undefined);
  assert.equal(g.wait, undefined);
  assert.match(ctx.TG_CMD_KEYWORDS['/daybook'], /day book/);
});
