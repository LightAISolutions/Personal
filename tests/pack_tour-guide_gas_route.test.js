'use strict';
// Tour Guide pack — /route and tgRoute (gas/31_route.js) over a mock of the Apps Script built-in Maps service, set on
// the vm context from this file (the harness is not changed). Places and lines are invented.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');

/** Minimal Maps.DirectionFinder mock: records every query; `answer(q)` returns the directions object or throws. */
function mockMaps(ctx, answer) {
  const queries = [];
  ctx.Maps = {
    DirectionFinder: { Mode: { WALKING: 'walking', TRANSIT: 'transit', DRIVING: 'driving', BICYCLING: 'bicycling' } },
    newDirectionFinder() {
      const q = {};
      const f = {
        setOrigin(o) { q.origin = o; return f; }, setDestination(d) { q.destination = d; return f; },
        setMode(m) { q.mode = m; return f; }, setDepart(d) { q.depart = d; return f; }, setLanguage(l) { q.language = l; return f; },
        getDirections() { queries.push(q); return answer(q); }
      };
      return f;
    }
  };
  return queries;
}
const ok = (sec, m, extra = {}) => ({ status: 'OK', routes: [{ summary: 'Harbor Road', legs: [{ duration: { value: sec, text: '' }, distance: { value: m, text: '' }, steps: extra.steps || [] }] }] });
const TRIP = { slug: 'harbor-town-2027', destination: 'Harbor Town', lodging: JSON.stringify({ text: 'Quay Inn, Example Street 1, Harbor Town' }) };

function fresh(answer, opts = {}) {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: '2027-04-10T08:00:00Z' });
  H.bootstrap(ctx, state);
  ctx.tgTripCurrent = () => (opts.noTrip ? null : TRIP);
  const queries = mockMaps(ctx, answer || (() => ok(1380, 1840)));
  return { ctx, state, queries, k: state.props[ctx.PROP.WEBHOOK_SECRET] };
}
const tg = (t, text) => t.ctx.doPost(H.postEvent('tg', { k: t.k }, H.tgUpdate({ text })));
const last = (state) => state.fetch.lastTelegramText();
const J = (v) => JSON.parse(JSON.stringify(v));

test('parse: →, ->, " to ", an optional trailing mode (and "by <mode>"), default transit', () => {
  const t = fresh();
  const p = (s) => J(t.ctx.tgRouteParse(s));
  assert.deepEqual(p('Old Port → Fish Market'), { from: 'Old Port', to: 'Fish Market', mode: 'transit' });
  assert.deepEqual(p('Old Port -> Fish Market walk'), { from: 'Old Port', to: 'Fish Market', mode: 'walk' });
  assert.deepEqual(p('Old Port to Fish Market by car'), { from: 'Old Port', to: 'Fish Market', mode: 'drive' });
  assert.deepEqual(p('Station to Harbor to Museum'), { from: 'Station', to: 'Harbor to Museum', mode: 'transit' });
  assert.deepEqual(p('A→B driving'), { from: 'A', to: 'B', mode: 'drive' });
  assert.deepEqual(p('walk'), { error: 'usage' });
  assert.deepEqual(p(''), { error: 'usage' });
  assert.deepEqual(p('just one place'), { error: 'usage' });
  assert.deepEqual(p('x'.repeat(201) + ' → y'), { error: 'too_long' });
});

test('tgRoute: minutes, distance, mode, Maps link; transit departs now and lists the lines', () => {
  const t = fresh((q) => (q.mode === 'transit'
    ? ok(1500, 6200, { steps: [{ transit_details: { line: { short_name: 'Line 2' } } }, {}, { transit_details: { line: { name: 'Harbor Bus 7' } } }] })
    : ok(1380, 1840)));
  const w = J(t.ctx.tgRoute('Old Port, Harbor Town', 'Fish Market, Harbor Town', 'walking'));
  assert.deepEqual(w, { ok: true, minutes: 23, distance_m: 1840, mode: 'walk', summary: 'via Harbor Road',
    maps_url: 'https://www.google.com/maps/dir/?api=1&origin=Old%20Port%2C%20Harbor%20Town&destination=Fish%20Market%2C%20Harbor%20Town&travelmode=walking' });
  const tr = t.ctx.tgRoute('A', 'B', 'transit');
  assert.equal(tr.summary, 'via Line 2 → Harbor Bus 7');
  assert.match(tr.maps_url, /travelmode=transit$/);
  assert.equal(t.queries[1].mode, 'transit');
  assert.ok(t.queries[1].depart, 'transit sets a departure time');
  assert.equal(t.queries[0].depart, undefined);
  assert.equal(t.ctx.tgRoute('A', 'B', 'drive').maps_url.endsWith('travelmode=driving'), true);
});

test('tgRoute errors never throw: no route, not found, quota exception, cap; cache saves repeat queries', () => {
  let status = 'ZERO_RESULTS';
  const t = fresh(() => { if (status === 'THROW') throw new Error('Service invoked too many times for one day: route.'); return { status, routes: [] }; });
  assert.equal(t.ctx.tgRoute('A', 'B', 'transit').error, 'no_route');
  status = 'NOT_FOUND';
  assert.equal(t.ctx.tgRoute('A', 'C', 'walk').error, 'not_found');
  status = 'THROW';
  const q = t.ctx.tgRoute('A', 'D', 'walk');
  assert.equal(q.ok, false); assert.equal(q.error, 'quota'); assert.match(q.maps_url, /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&/);
  assert.equal(t.ctx.storeAll('AuditLog').filter((a) => a.event === 'tg_route_error').length, 1);
  assert.equal(t.ctx.tgRoute('', 'B').error, 'usage');
  const t2 = fresh();
  t2.ctx.tgRoute('A', 'B', 'walk'); const again = t2.ctx.tgRoute('A', 'B', 'walk');
  assert.equal(again.cached, true); assert.equal(t2.queries.length, 1);
  t2.ctx.settingSet('tg_route_calls', t2.ctx.isoDateLocal() + '|200');
  assert.equal(t2.ctx.tgRoute('A', 'Z', 'walk').error, 'daily_cap');
  assert.equal(t2.queries.length, 1);
});

test('/route answers with duration, distance, mode and an escaped Maps link; hotel and the trip city are resolved', () => {
  const t = fresh();
  tg(t, '/route hotel → <b>Fish</b> & Market walk');
  const q = t.queries[0];
  assert.equal(q.origin, 'Quay Inn, Example Street 1, Harbor Town');
  assert.equal(q.destination, '<b>Fish</b> & Market, Harbor Town');
  assert.equal(q.mode, 'walking');
  const out = last(t.state);
  assert.match(out, /^🧭 <b>hotel<\/b> → <b>&lt;b&gt;Fish&lt;\/b&gt; &amp; Market<\/b>\n🚶 walk · <b>23 min<\/b> · 1\.8 km\nvia Harbor Road/);
  assert.match(out, /searched as Quay Inn/);
  assert.match(out, /<a href="https:\/\/www\.google\.com\/maps\/dir\/\?api=1&amp;origin=Quay%20Inn[^"]*&amp;travelmode=walking">Open in Google Maps<\/a>$/);
  assert.ok(!/<a href="[^"]*"[^>]*"/.test(out), 'no quote breaks out of the href');
  tg(t, '/route Old Port, Harbor Town to Lighthouse, Harbor Town');
  assert.equal(t.queries[1].origin, 'Old Port, Harbor Town');
  assert.ok(!/searched as/.test(last(t.state)));
  tg(t, '/route');
  assert.match(last(t.state), /^Usage: \/route A → B/);
  assert.ok(t.ctx.HB_REGISTRY.help.some((l) => /^\/route — /.test(l)));
});

test('/route without a trip queries the words as typed; a transit miss suggests walking', () => {
  const t = fresh(() => ({ status: 'ZERO_RESULTS', routes: [] }), { noTrip: true });
  tg(t, '/route North Gate -> South Pier');
  assert.equal(t.queries[0].origin, 'North Gate');
  const out = last(t.state);
  assert.match(out, /Google found no transit route\./);
  assert.match(out, /try <code>\/route North Gate → South Pier walk<\/code>/);
  assert.match(out, /travelmode=transit">Open in Google Maps/);
  assert.ok(out.length < 4096);
});

// Developed by: LightAISolutions
