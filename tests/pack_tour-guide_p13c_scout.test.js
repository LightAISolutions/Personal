'use strict';
// WP-13c — Scout on the core side: the ranked chat line's marks, the request text as typed (chat and app) and the
// scouted candidates group. Invented data: the trip "Fernhollow"; no network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const W = require('./pack_tour-guide_p13c_world');

const SID = 'sc-20270501-tea';
const pick = (n, slug, over = {}) => ({ n, slug, name: slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '), area: 'Mill quarter',
  category: 'cafe', score: 95 - n * 5, parts: { topic: 90, quality: 80, fit: 70, reach: 60 }, why_you: 'A quiet room by the race.',
  labels: [], maps_url: W.maps('FixtureS' + n), reach: { minutes: 5 + n, mode: 'WALK', estimated: false }, ...over });
const scout = (over = {}) => ({ v: 1, kind: 'scout', scout_id: SID, query: 'tea', destination: W.TRIP, place_label: 'Fernhollow, Fictland',
  trip: W.TRIP, group: 'food', created_on: '2027-05-01', diet: 'vegetarian',
  items: [pick(1, 'reed-tea-room', { labels: ['gem', 'veg_verified', 'seen_before'] }), pick(2, 'weir-kettle', { labels: ['seen_before'] }),
    pick(3, 'pear-leaf', { labels: ['veg_likely'] })],
  left_out: [], ...over });

test('the ranked chat line marks a pick already in the owner\'s places with 🔁, next to 💎 and 🌱', () => {
  const { ctx, state } = W.fresh();
  W.trip(ctx);
  const st = W.deliver(ctx, state, 'scout', scout());
  assert.equal(st.processed, 1, JSON.stringify(st));
  const lines = W.last(state).split('\n');
  assert.match(lines[1], /^<b>1\.<\/b> <a href="[^"]+">Reed Tea Room<\/a> 💎 🌱 🔁 · Mill quarter · /);
  assert.match(lines[2], /^<b>2\.<\/b> <a href="[^"]+">Weir Kettle<\/a> 🔁 · Mill quarter · /);
  assert.match(lines[3], /^<b>3\.<\/b> <a href="[^"]+">Pear Leaf<\/a> 🌱 · Mill quarter · /, 'no 🔁 without the label');
});

const app = (ctx, state, op, args) => W.J(W.H.appPost(ctx, state, 'app', { op, args }));

test('item 7: a chat scout request carries the owner\'s words exactly as typed', () => {
  const { ctx, state } = W.fresh();
  W.trip(ctx);
  const typed = ['/scout matcha near Weir End, Gullport', '/scout   river  walks   in   Fernhollow ', '/scout@FixtureBot pear cider @ Mill quarter, Fernhollow',
    '/scout tea'];
  typed.forEach((t) => W.say(ctx, state, t));
  const rq = W.reqOf(state, 'scout');
  assert.deepEqual(rq.map((r) => r.text).sort(), typed.slice().sort(), 'no re-spacing, no rebuilt sentence');
  // The old fields are still filled from the core's words, for the current pin.
  const tea = rq.find((r) => r.text === '/scout tea');
  assert.deepEqual([tea.query, tea.where, tea.destination, tea.trip], ['tea', 'Fernhollow', W.TRIP, W.TRIP]);
  const near = rq.find((r) => /Weir End/.test(r.text));
  assert.deepEqual([near.query, near.where, near.trip], ['matcha', 'Weir End, Gullport', undefined]);
});

test('item 7: an app scout writes "/scout <what> in <where>" with no suffix, the where resolved when left blank', () => {
  const { ctx, state } = W.fresh();
  W.trip(ctx);
  const a = app(ctx, state, 'scout.new', { query: 'tea' });
  const b = app(ctx, state, 'scout.new', { query: 'pear  cider', where: 'Gull  Bay' });
  assert.equal(a.ok && b.ok, true);
  const rq = W.reqEnvOf(state, 'scout');
  const text = (id) => rq.find((e) => e.id === id).payload.text;
  assert.equal(text(a.request_id), '/scout tea in Fernhollow');
  assert.equal(text(b.request_id), '/scout pear cider in Gull Bay');
  rq.forEach((e) => assert.doesNotMatch(e.payload.text, /\(app\)/));
});

test('red team: a scout text carrying markup stays raw data in the request and is escaped in every message', () => {
  const { ctx, state } = W.fresh();
  W.trip(ctx);
  const typed = '/scout <b>tea</b> & <a href="https://evil.example.invalid/">cake</a> in <script>x</script>';
  W.say(ctx, state, typed);
  const rq = W.reqOf(state, 'scout');
  assert.equal(rq.length, 1);
  assert.equal(rq[0].text, typed, 'the request holds the words, not HTML for anyone to render');
  const out = W.texts(state).join('\n');
  assert.doesNotMatch(out, /<script|<a href="https:\/\/evil|<b>tea<\/b>/);
  assert.match(out, /&lt;b&gt;tea&lt;\/b&gt; &amp; &lt;a href=/);
});

// Developed by: LightAISolutions
