'use strict';
// TG-PHASE-14 WP-14e — the Discover routing (item 16's core half): the discovery kinds (scout, compare, lists, vegcard)
// go to one DISCOVER routine when it is configured, and exactly where they go today when it is not (Scout to SCOUT when
// that routine is set, every other kind by TG_KIND_ROUTINE, else RESEARCH). Invented data only; no network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./harness/gas-mocks');

const KINDS = ['scout', 'compare', 'lists', 'vegcard'];
function fresh(routines) {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: '2027-05-01T12:00:00Z' });
  H.bootstrap(ctx, state);
  for (const n of routines) H.configureRoutine(ctx, state, n);
  return { ctx, state };
}
/** Every kind's routine, as an object. */
const table = (ctx, kinds) => Object.fromEntries(kinds.map((k) => [k, ctx.tgKindRoutine(k)]));

test('TG_DISCOVER_KINDS is declared once in 00_common.js and lists the four discovery kinds', () => {
  const GAS = path.join(H.HELPERS_ROOT, 'packs', 'tour-guide', 'gas');
  const files = fs.readdirSync(GAS).filter((f) => f.endsWith('.js'));
  const decl = files.filter((f) => /^var TG_DISCOVER_KINDS\b/m.test(fs.readFileSync(path.join(GAS, f), 'utf8')));
  assert.deepEqual(decl, ['00_common.js']);
  const lit = /^var TG_DISCOVER_KINDS = (\[[^\]]*\]);/m.exec(fs.readFileSync(path.join(GAS, '00_common.js'), 'utf8'));
  assert.deepEqual(JSON.parse(lit[1].replace(/'/g, '"')), KINDS);
  // at run time: the four, in order, then only kinds a module adds from its own file (new-branch.mjs --discover), once each
  const { ctx } = fresh([]);
  const live = JSON.parse(JSON.stringify(ctx.TG_DISCOVER_KINDS));
  assert.deepEqual(live.slice(0, KINDS.length), KINDS);
  const pushed = files.flatMap((f) => [...fs.readFileSync(path.join(GAS, f), 'utf8').matchAll(/TG_DISCOVER_KINDS\.push\('([a-z][a-z0-9_]*)'\)/g)].map((m) => m[1]));
  for (const k of live.slice(KINDS.length)) assert.ok(pushed.includes(k), k + ' is pushed by a module of its own');
  assert.equal(new Set(live).size, live.length, 'no kind twice');
});

test('routing table: without DISCOVER (with and without SCOUT) every kind routes as before', () => {
  const others = ['research', 'plan', 'replan', 'notes', 'brochure', 'prefs', 'places', 'message', 'ask', 'outline', 'day_versions'];
  const none = fresh(['RESEARCH']).ctx;
  // lists is routed by WP-14d's own file (to RESEARCH); before that merges it falls to the inbound routine, as today.
  const listsToday = Object.prototype.hasOwnProperty.call(none.TG_KIND_ROUTINE, 'lists') ? none.TG_KIND_ROUTINE.lists : none.HELPER.inbound_routine;
  assert.deepEqual(table(none, KINDS), { scout: 'RESEARCH', compare: 'RESEARCH', lists: listsToday, vegcard: 'RESEARCH' });
  const scout = fresh(['RESEARCH', 'SCOUT']).ctx;
  assert.deepEqual(table(scout, KINDS), { scout: 'SCOUT', compare: 'RESEARCH', lists: listsToday, vegcard: 'RESEARCH' });
  // Other kinds never move, with or without DISCOVER.
  const before = table(none, others);
  assert.deepEqual(table(fresh(['RESEARCH', 'DISCOVER', 'SCOUT']).ctx, others), before);
  assert.equal(before.plan, 'PLAN');
});

test('routing table: with DISCOVER configured the four kinds go to DISCOVER, even when SCOUT is set too', () => {
  for (const routines of [['RESEARCH', 'DISCOVER'], ['RESEARCH', 'DISCOVER', 'SCOUT']]) {
    const { ctx } = fresh(routines);
    assert.deepEqual(table(ctx, KINDS), { scout: 'DISCOVER', compare: 'DISCOVER', lists: 'DISCOVER', vegcard: 'DISCOVER' }, routines.join('+'));
  }
  // A URL without its token is not "configured": today's rule takes over again.
  const { ctx, state } = fresh(['RESEARCH', 'DISCOVER', 'SCOUT']);
  state.props[ctx.routineProp('DISCOVER', 'TOKEN')] = '';
  assert.equal(ctx.tgKindRoutine('scout'), 'SCOUT');
  assert.equal(ctx.tgKindRoutine('vegcard'), 'RESEARCH');
});

test('a kind a later branch adds to TG_DISCOVER_KINDS from its own file is routed to DISCOVER too', () => {
  const { ctx } = fresh(['RESEARCH', 'DISCOVER']);
  ctx.TG_KIND_ROUTINE.wander = 'RESEARCH';
  assert.equal(ctx.tgKindRoutine('wander'), 'RESEARCH');
  ctx.TG_DISCOVER_KINDS.push('wander');
  assert.equal(ctx.tgKindRoutine('wander'), 'DISCOVER');
});

test('/compare and /scout fire the DISCOVER routine when it is configured', () => {
  const { ctx, state } = fresh(['RESEARCH', 'DISCOVER']);
  ctx.tgTripUpsert({ slug: 'quillmere', title: 'Quillmere', destination: 'Quillmere', start: '2027-05-12', end: '2027-05-14', status: 'planned' });
  const say = (text) => ctx.doPost(H.postEvent('tg', { k: state.props[ctx.PROP.WEBHOOK_SECRET] }, H.tgUpdate({ text })));
  say('/compare Reed Mill, Pear Press');
  say('/scout matcha');
  const fires = state.fetch.routine().map((r) => r.url);
  assert.deepEqual(fires, ['https://api.anthropic.com/v1/routines/test_discover/fire', 'https://api.anthropic.com/v1/routines/test_discover/fire']);
  const routines = JSON.parse(JSON.stringify(ctx.storeAll('Requests'))).map((r) => r.routine);
  assert.deepEqual(routines, ['DISCOVER', 'DISCOVER']);
});

// Developed by: LightAISolutions
