'use strict';
// Tour Guide — Compare: the cut before the lookups (TG-PHASE-14 WP-14f). compareCut is exported so a routine can cut a
// long saved list to ten on the bare records ({ place_id }) before it spends lookups on them; rankScout's `already_cut`
// then carries the count into `more`. Brindlewick is an invented town; every place, id and date below is invented.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const SC = () => import('../packs/tour-guide/scout/index.mjs');
const S = () => import('../packs/tour-guide/schemas/index.mjs');

const INN = { lat: 52.3, lng: 4.1 };
const EVERYDAY = { periods: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ open: { day, hour: 9, minute: 0 }, close: { day, hour: 21, minute: 0 } })) };
const id = (k) => 'FixtureBrindleCut' + k;
const full = (k) => ({ id: id(k), displayName: { text: 'Cut Noodle ' + k }, types: ['restaurant'], primaryType: 'restaurant', rating: 4.4,
  userRatingCount: 100 + k, businessStatus: 'OPERATIONAL', location: { latitude: INN.lat + 0.5 / 111, longitude: INN.lng }, regularOpeningHours: EVERYDAY });
const KS = Array.from({ length: 12 }, (_, k) => k);
// Places 3 and 9 are in the asked place; dates make 11, 10, 8, 7, 6, 5, 4, 2 the most recent of the rest; 0 and 1 are undated.
const in_where = [id(3), id(9)];
const listed_on = Object.fromEntries(KS.filter((k) => k > 1).map((k) => [id(k), '2027-05-' + String(10 + k).padStart(2, '0')]));
const opts = (over = {}) => ({ group: 'food', anchors: [INN], reach: {}, judgments: {}, trip_dates: ['2027-06-07'], mode: 'compare',
  source: { list: 'Long noodle list' }, ...over });

test('compareCut: exported from scout/index.mjs; twelve bare records → ten kept (where first, then the most recent), more 2, pool order', async () => {
  const sc = await SC();
  assert.equal(typeof sc.compareCut, 'function');
  const bare = KS.map((k) => ({ place_id: id(k) }));
  const { kept, more } = sc.compareCut(bare, { in_where, listed_on });
  assert.equal(more, 2);
  assert.deepEqual(kept.map((r) => r.place_id), [2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(id), 'the two undated places are cut; kept in pool order');
  // Ten or fewer: nothing cut; no options at all: pool order.
  assert.deepEqual(sc.compareCut(bare.slice(0, 10)), { kept: bare.slice(0, 10), more: 0 });
  assert.deepEqual(sc.compareCut(bare).kept.map((r) => r.place_id), KS.slice(0, 10).map(id));
  // The same places rankScout keeps from the twelve full records: the behaviour is unchanged.
  const r = sc.rankScout(KS.map((k) => sc.fromScoutResult(full(k))), opts({ in_where, listed_on }));
  assert.equal(r.more, 2);
  assert.deepEqual(r.items.map((i) => i.place_id).sort(), kept.map((x) => x.place_id).sort());
});

test('rankScout compare: already_cut is added to more; the payload carries it and validates', async () => {
  const sc = await SC();
  const s = await S();
  const { kept, more } = sc.compareCut(KS.map((k) => ({ place_id: id(k) })), { in_where, listed_on });
  const keptIds = new Set(kept.map((x) => x.place_id));
  const pool = KS.filter((k) => keptIds.has(id(k))).map((k) => sc.fromScoutResult(full(k)));
  const r = sc.rankScout(pool, opts({ in_where, listed_on, already_cut: more }));
  assert.equal(r.items.length, 10);
  assert.equal(r.more, 2);
  const p = sc.scoutPayload({ scout_id: 'sc-20270601-compare', destination: 'brindlewick', place_label: 'Brindlewick', created_on: '2027-06-01', diet: null, ranked: r });
  assert.equal(p.more, 2);
  const v = s.validatePayload('scout', p);
  assert.ok(v.ok, s.formatErrors(v.errors));
});

test('rankScout: already_cut must be a non-negative integer (else 0), adds to an internal cut, and is ignored in scout mode', async () => {
  const sc = await SC();
  const ten = KS.slice(0, 10).map((k) => sc.fromScoutResult(full(k)));
  for (const bad of [-1, 1.5, '3', null, undefined, NaN, Infinity]) assert.equal(sc.rankScout(ten, opts({ already_cut: bad })).more, 0, String(bad));
  assert.equal(sc.rankScout(ten, opts({ already_cut: 0 })).more, 0);
  assert.equal(sc.rankScout(KS.map((k) => sc.fromScoutResult(full(k))), opts({ already_cut: 5 })).more, 7, 'two cut here, five before');
  const scout = { what: 'noodle', group: 'food', anchors: [INN], reach: {}, judgments: {}, trip_dates: ['2027-06-07'], limit: 3 };
  assert.equal(sc.rankScout(ten, { ...scout, already_cut: 40 }).more, sc.rankScout(ten, scout).more);
});

// Developed by: LightAISolutions
