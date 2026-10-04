'use strict';
// TG-PHASE-14 WP-14b — Scout's ranking, tuned (item 7): a fixed quality anchor, chain and crowd penalties, a judgment
// rescues a new place, drinks / cafés / markets are "likely" for a vegetarian party while meals stay strict, an
// unjudged place gets a low fit and says so, the card shows all five parts, and one estimator gives a leg's minutes.
// Quillmere is an invented lake town; every place, id, rating and mention below is invented and nothing is fetched.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SC = () => import('../packs/tour-guide/scout/index.mjs');
const S = () => import('../packs/tour-guide/schemas/index.mjs');
const RAIL = () => import('../packs/tour-guide/planner/planner-rail.mjs');

const INN = { label: 'your inn', lat: 46.2, lng: 8.9 };
const at = (kmNorth) => ({ latitude: INN.lat + kmNorth / 111, longitude: INN.lng });
const MENTION = (n) => ({ ref: 'Q' + n, language: 'xx', kind: 'local-language', publisher: `quill-paper-${n}.example` });
function place(id, name, o = {}) {
  const types = o.types || ['cafe'];
  return { id: 'FixtureQuill' + id, displayName: { text: name }, types, primaryType: types[0], rating: o.rating === undefined ? 4.5 : o.rating,
    userRatingCount: o.count === undefined ? 100 : o.count, businessStatus: 'OPERATIONAL', location: at(o.km === undefined ? 0.3 : o.km),
    servesVegetarianFood: o.veg };
}
const rec = (sc, raw, mentions = []) => sc.fromScoutResult(raw, { local_mentions: mentions });
const byId = (r) => Object.fromEntries(r.items.map((i) => [i.place_id, i]));
const leftBy = (r) => Object.fromEntries(r.left_out.map((l) => [l.place_id, l.reason]));
const weighted = (sc, parts) => 100 * Object.entries(sc.WEIGHTS.WEIGHTS).reduce((s, [k, w]) => s + w * parts[k], 0);

test('change 1: a fixed quality anchor — the same record gets the same quality part in pools with different means', async () => {
  const sc = await SC();
  const same = place('Anchor', 'Quill Matcha Room', { rating: 4.5, count: 60 });
  const high = [same, place('HighA', 'Quill Matcha One', { rating: 4.9, count: 400 }), place('HighB', 'Quill Matcha Two', { rating: 4.8, count: 300 })];
  const low = [same, place('LowA', 'Quill Matcha Three', { rating: 4.0, count: 40 }), place('LowB', 'Quill Matcha Four', { rating: 4.1, count: 30 })];
  const q = (pool) => byId(sc.rankScout(pool.map((r) => rec(sc, r)), { what: 'matcha', group: 'food' })).FixtureQuillAnchor.parts.quality;
  assert.equal(q(high), q(low), 'a 4.5 means the same on every board');
  assert.ok(Math.abs(q(high) - sc.qualityPart(rec(sc, same), 4.2)) < 1e-12, 'food is anchored at 4.2');
  const act = place('Garden', 'Quill Garden', { types: ['garden'], rating: 4.5, count: 60 });
  const g = byId(sc.rankScout([rec(sc, act)], { what: 'garden', group: 'activities' })).FixtureQuillGarden.parts.quality;
  assert.ok(Math.abs(g - sc.qualityPart(rec(sc, act), 4.3)) < 1e-12, 'activities are anchored at 4.3');
  assert.deepEqual({ ...sc.WEIGHTS.QUALITY_MU }, { food: 4.2, activities: 4.3 });
});

test('change 2: a chain or a crowd magnet pays for it — a 4.6 chain with 3,000 ratings ranks below a 4.4 local favourite', async () => {
  const sc = await SC();
  assert.equal(sc.WEIGHTS.PENALTY.chain, 8);
  assert.equal(sc.WEIGHTS.PENALTY.crowd, 4);
  const { CROWD_MAGNET_MIN_COUNT } = await import('../packs/tour-guide/gems/gems-weights.mjs');
  assert.equal(sc.WEIGHTS.CROWD_MIN_COUNT, CROWD_MAGNET_MIN_COUNT, 'the planner\'s crowd-magnet threshold, reused');
  const pool = [rec(sc, place('Chain', 'Quill Matcha Lakeside', { rating: 4.6, count: 3000 })),
    rec(sc, place('Fav', 'Quill Matcha Corner', { rating: 4.4, count: 150 }), [MENTION(1), MENTION(2)])];
  const r = sc.rankScout(pool, { what: 'matcha', group: 'food', judgments: { FixtureQuillChain: { labels: ['chain'], fit: 0.6 }, FixtureQuillFav: { fit: 0.6 } } });
  const { FixtureQuillChain: chain, FixtureQuillFav: fav } = byId(r);
  assert.ok(weighted(sc, chain.parts) > weighted(sc, fav.parts), 'on its parts alone the chain would win (the fault)');
  assert.deepEqual(r.items.map((i) => i.place_id), ['FixtureQuillFav', 'FixtureQuillChain']);
  assert.equal(chain.score, Math.round(weighted(sc, chain.parts)) - 8 - 4, 'a chain past the crowd threshold pays both');
  assert.ok(chain.labels.includes('chain'));
  // A crowd magnet (not a chain) loses its points and keeps its place in the list.
  const crowd = sc.rankScout([rec(sc, place('Busy', 'Quill Matcha Pier', { count: 2500 })), rec(sc, place('Under', 'Quill Matcha Quay', { count: 1999 }))],
    { what: 'matcha', group: 'food', judgments: { FixtureQuillBusy: { fit: 0.5 }, FixtureQuillUnder: { fit: 0.5 } } });
  const c = byId(crowd);
  assert.equal(crowd.left_out.length, 0);
  assert.equal(c.FixtureQuillBusy.score, Math.round(weighted(sc, c.FixtureQuillBusy.parts)) - 4);
  assert.equal(c.FixtureQuillUnder.score, Math.round(weighted(sc, c.FixtureQuillUnder.parts)), 'under the threshold: no penalty');
  // Never below zero.
  const floor = sc.rankScout([rec(sc, place('Low', 'Quill Matcha Kiosk', { rating: 4.0, count: 9000 }))], { what: 'matcha', group: 'food', judgments: { FixtureQuillLow: { relevance: 0.3, fit: 0, labels: ['chain'] } } });
  assert.ok(floor.items[0].score >= 0);
});

test('change 3: a judgment rescues a new place (relevance ≥ 0.7 or veg verified) and labels it new; an unrescued one stays unproven', async () => {
  const sc = await SC();
  const fresh = (id) => rec(sc, place(id, 'Quill Matcha ' + id, { rating: 5, count: 2 }));
  const r = sc.rankScout([fresh('Rel'), fresh('Veg'), fresh('Plain'), fresh('Weak')], { what: 'matcha', group: 'food', diet: 'vegetarian',
    judgments: { FixtureQuillRel: { relevance: 0.7, veg: 'likely', fit: 0.6 }, FixtureQuillVeg: { veg: 'verified', fit: 0.6 }, FixtureQuillWeak: { relevance: 0.69, veg: 'likely' } } });
  const kept = byId(r);
  assert.ok(kept.FixtureQuillRel.labels.includes('new'), 'relevance 0.7 rescues');
  assert.ok(kept.FixtureQuillVeg.labels.includes('new'), 'veg verified rescues');
  assert.deepEqual(leftBy(r), { FixtureQuillPlain: 'unproven', FixtureQuillWeak: 'unproven' });
  // A place with enough ratings is not "new", judgment or not.
  const old = sc.rankScout([rec(sc, place('Old', 'Quill Matcha Old', { count: 80 }))], { what: 'matcha', group: 'food', judgments: { FixtureQuillOld: { relevance: 0.9 } } });
  assert.ok(!old.items[0].labels.includes('new'));
  // screenReason itself: the rescue only lifts the unproven screen.
  const base = { rating: 5, rating_count: 2, local_mentions: [] };
  assert.equal(sc.screenReason(base, { topic: 0.9, judgment: { relevance: 0.8 } }), null);
  assert.equal(sc.screenReason(base, { topic: 0.9, judgment: { veg: 'verified' } }), null);
  assert.equal(sc.screenReason(base, { topic: 0.9, judgment: {} }), 'unproven');
  assert.equal(sc.screenReason({ ...base, rating: 3, rating_count: 40 }, { topic: 0.9, judgment: { relevance: 1 } }), 'low_rating');
});

test('change 4: drinks are likely for a vegetarian or vegan party, cafés and markets for a vegetarian one; meals stay strict', async () => {
  const sc = await SC();
  const pool = [
    rec(sc, place('Tea', 'Quill Tea House', { types: ['tea_house'] })),
    rec(sc, place('Bar', 'Quill Lamp Bar', { types: ['bar'] })),
    rec(sc, place('Ramen', 'Quill Ramen', { types: ['ramen_restaurant'] })),
    rec(sc, place('Market', 'Quill Morning Market', { types: ['market'] })),
    rec(sc, place('Bakery', 'Quill Bakery', { types: ['bakery'] })),
    rec(sc, place('SakeSushi', 'Quill Sake and Sushi', { types: ['bar'] }))
  ];
  const veg = sc.rankScout(pool, { what: 'quill', group: 'food', diet: 'vegetarian' });
  const v = byId(veg);
  for (const id of ['FixtureQuillTea', 'FixtureQuillBar', 'FixtureQuillMarket', 'FixtureQuillBakery']) {
    assert.ok(v[id], `${id} kept for a vegetarian party`);
    assert.ok(v[id].labels.includes('veg_likely') && !v[id].labels.includes('veg_verified'), `${id}: likely, never verified`);
  }
  assert.deepEqual(leftBy(veg), { FixtureQuillRamen: 'diet_unproven', FixtureQuillSakeSushi: 'diet_unproven' }, 'a meal word anywhere keeps the strict screen');
  const vegan = sc.rankScout(pool, { what: 'quill', group: 'food', diet: 'vegan' });
  assert.deepEqual(Object.keys(byId(vegan)).sort(), ['FixtureQuillBar', 'FixtureQuillTea']);
  assert.equal(leftBy(vegan).FixtureQuillMarket, 'diet_unproven', 'a market is not likely vegan');
  // A judgment's veg always wins over the word lists ("none" is read as "no").
  for (const no of ['none', 'no']) {
    const j = sc.rankScout(pool, { what: 'quill', group: 'food', diet: 'vegetarian', judgments: { FixtureQuillBar: { veg: no } } });
    assert.equal(leftBy(j).FixtureQuillBar, 'diet', `veg ${no} drops a bar`);
  }
  // The query decides when the place's own name and type say nothing; the hidden-stock rule still holds for meals.
  const plain = [rec(sc, place('Plain', 'Quill Number Nine', { types: ['food'] }))];
  assert.equal(sc.rankScout(plain, { what: 'coffee', group: 'food', diet: 'vegetarian', judgments: { FixtureQuillPlain: { relevance: 0.8 } } }).items.length, 1);
  assert.equal(leftBy(sc.rankScout(plain, { what: 'dinner', group: 'food', diet: 'vegetarian', judgments: { FixtureQuillPlain: { relevance: 0.8 } } })).FixtureQuillPlain, 'diet_unproven');
  const broth = [rec(sc, place('Udon', 'Quill Udon', { types: ['restaurant'], veg: true }))];
  assert.equal(leftBy(sc.rankScout(broth, { what: 'quill', group: 'food', diet: 'vegetarian', diet_rule: 'no fish stock' })).FixtureQuillUdon, 'diet_unproven');
  // Google saying "no vegetarian food" outright is not silence: the word lists do not overrule it.
  const said = [rec(sc, place('NoVeg', 'Quill Night Bar', { types: ['bar'], veg: false }))];
  assert.equal(leftBy(sc.rankScout(said, { what: 'quill', group: 'food', diet: 'vegetarian' })).FixtureQuillNoVeg, 'diet_unproven');
  // Without a diet there is no screen and no likely label from the lists.
  assert.ok(byId(sc.rankScout(pool, { what: 'quill', group: 'food' })).FixtureQuillBar.labels.every((l) => !l.startsWith('veg_')));
  assert.equal(sc.foodKind({ name: 'Quill Tea House', primary_type: 'tea_house' }, 'quill'), 'drink');
  assert.equal(sc.foodKind({ name: 'Quill Corner', primary_type: 'food_court' }, 'food hall'), 'market');
});

test('change 5: an unjudged place gets fit 0.3 and the not_judged label; a judged place at 0.35 outranks it', async () => {
  const sc = await SC();
  const pool = [rec(sc, place('Unjudged', 'Quill Matcha A')), rec(sc, place('Judged', 'Quill Matcha B'))];
  const r = sc.rankScout(pool, { what: 'matcha', group: 'food', judgments: { FixtureQuillJudged: { fit: 0.35 } } });
  assert.deepEqual(r.items.map((i) => i.place_id), ['FixtureQuillJudged', 'FixtureQuillUnjudged']);
  const u = byId(r).FixtureQuillUnjudged;
  assert.equal(u.parts.fit, 0.3);
  assert.ok(u.labels.includes('not_judged'));
  assert.ok(!byId(r).FixtureQuillJudged.labels.includes('not_judged'));
  const payload = sc.scoutPayload({ scout_id: 'sc-20270901-matcha', query: 'matcha', destination: 'quillmere', place_label: 'Quillmere', group: 'food', created_on: '2027-09-01', ranked: r });
  assert.deepEqual((await S()).validatePayload('scout', payload).errors, []);
  assert.ok(payload.items[1].labels.includes('not_judged'));
  assert.match(sc.renderScoutBoard({ payload }).html, /<span class="chip">not judged<\/span>/);
});

const payloadFor = (sc, ranked) => sc.scoutPayload({ scout_id: 'sc-20270901-matcha', query: 'matcha', destination: 'quillmere', place_label: 'Quillmere',
  group: 'food', created_on: '2027-09-01', from: 'your inn', ranked });
const barsOf = (html) => [...html.matchAll(/<div class="bar">([^<]+)<i><b style="width:(\d+)%"><\/b><\/i><\/div>/g)].map((m) => [m[1], Number(m[2])]);

test('change 6: the payload carries parts.local; the board shows five bars that, weighted, reproduce the score; an old payload shows four', async () => {
  const sc = await SC();
  const pool = [rec(sc, place('Five', 'Quill Matcha Five', { rating: 4.7, count: 240 }), [MENTION(1), MENTION(2)]), rec(sc, place('Six', 'Quill Matcha Six', { rating: 4.3, count: 90 }))];
  const ranked = sc.rankScout(pool, { what: 'matcha', group: 'food', anchors: [INN], judgments: { FixtureQuillFive: { fit: 0.7 }, FixtureQuillSix: { fit: 0.4 } } });
  const payload = payloadFor(sc, ranked);
  assert.deepEqual((await S()).validatePayload('scout', payload).errors, []);
  for (const it of payload.items) {
    assert.deepEqual(Object.keys(it.parts), ['topic', 'quality', 'fit', 'local', 'reach']);
    const sum = Object.entries(sc.WEIGHTS.WEIGHTS).reduce((s, [k, w]) => s + w * it.parts[k], 0);
    assert.ok(Math.abs(sum - it.score) <= 1, `${it.name}: Σ weight × bar = ${sum.toFixed(2)} vs ${it.score}`);
  }
  assert.equal(payload.items[0].parts.local, 50);
  const html = sc.renderScoutBoard({ payload }).html;
  const cards = html.split('<li class="card"').slice(1);
  assert.deepEqual(barsOf(cards[0]).map(([k]) => k), ['on topic', 'quality', 'fit', 'local', 'reach']);
  assert.deepEqual(barsOf(cards[0]).map(([, v]) => v), ['topic', 'quality', 'fit', 'local', 'reach'].map((k) => payload.items[0].parts[k]));
  // An old payload (no local) still validates and shows its four bars.
  const old = JSON.parse(JSON.stringify(payload));
  old.items.forEach((it) => { delete it.parts.local; it.labels = it.labels.filter((l) => l !== 'not_judged'); });
  assert.deepEqual((await S()).validatePayload('scout', old).errors, []);
  assert.deepEqual(barsOf(sc.renderScoutBoard({ payload: old }).html.split('<li class="card"')[1]).map(([k]) => k), ['on topic', 'quality', 'fit', 'reach']);
  // The bounds hold for the new part.
  const bad = JSON.parse(JSON.stringify(payload)); bad.items[0].parts.local = 101;
  assert.ok((await S()).validatePayload('scout', bad).errors.some((e) => /parts\/local/.test(e.path || e.instancePath || JSON.stringify(e))));
});

test('change 6 (core): the validator takes parts.local and not_judged, old payloads still pass, the chat line says new and not judged', () => {
  const H = require('./harness/gas-mocks');
  const MANIFEST = JSON.parse(fs.readFileSync(path.join(H.HELPERS_ROOT, 'packs', 'tour-guide', 'helper.json'), 'utf8'));
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: '2027-09-01T12:00:00Z', manifest: { ...MANIFEST, envelope_types: [...new Set([...MANIFEST.envelope_types, 'scout'])] } });
  H.bootstrap(ctx, state);
  const item = (n, over = {}) => ({ n, slug: 'quill-pick-' + n, name: 'Quill Pick ' + n, area: 'Lakeside', category: 'cafe', score: 70, parts: { topic: 90, quality: 60, fit: 30, reach: 50 },
    why_you: 'A quiet room by the lake.', labels: [], maps_url: 'https://www.google.com/maps/search/?api=1&query=Fixture&query_place_id=FixtureQuill' + n, ...over });
  const p = (items) => ({ v: 1, kind: 'scout', scout_id: 'sc-20270901-matcha', query: 'matcha', destination: 'quillmere', place_label: 'Quillmere', group: 'food', created_on: '2027-09-01', items, left_out: [] });
  const V = (x) => JSON.parse(JSON.stringify(ctx.tgEnvValidateScout(x)));   // the core runs in its own realm
  assert.deepEqual(V(p([item(1)])), [], 'an old payload (four parts) passes');
  const now = p([item(1, { parts: { topic: 90, quality: 60, fit: 30, local: 25, reach: 50 }, labels: ['new', 'not_judged'] }), item(2, { labels: ['veg_likely'] })]);
  assert.deepEqual(V(now), []);
  assert.ok(ctx.tgEnvValidateScout(p([item(1, { parts: { topic: 90, quality: 60, fit: 30, local: 101, reach: 50 } })])).some((e) => /parts\.local/.test(e)));
  assert.ok(ctx.tgEnvValidateScout(p([item(1, { parts: { topic: 90, quality: 60, fit: 30, reach: 50, crowd: 4 } })])).some((e) => /unknown key "crowd"/.test(e)));
  assert.ok(ctx.tgEnvValidateScout(p([item(1, { labels: ['judged'] })])).length > 0);
  const html = ctx.tgScoutMessages(now).map((m) => m.html).join('\n');
  assert.match(html, /Quill Pick 1<\/a> 🆕 · not judged/);
  assert.doesNotMatch(html.split('\n').find((l) => /Quill Pick 2/.test(l)), /not judged|🆕/);
});

test('change 7: one estimator — reachFor and the exported estimateReach give the same minutes, from the planner\'s figures', async () => {
  const sc = await SC(); const rail = await RAIL();
  const { haversineKm } = await import('../packs/tour-guide/planner/planner-geo.mjs');
  for (const km of [0.4, 1.1, 1.6, 4, 9, 30]) {
    const to = { lat: INN.lat + km / 111, lng: INN.lng };
    const e = sc.estimateReach(INN, to);
    const r = sc.reachFor({ place_id: 'FixtureQuillLeg', location: to }, { anchors: [INN] });
    assert.deepEqual(r, e, `${km} km`);
    const d = haversineKm(INN, to), walk = rail.walkMinutes(d);
    if (walk <= sc.WEIGHTS.ESTIMATE_WALK_MAX_MINUTES) assert.deepEqual(e, { minutes: walk, mode: 'WALK', estimated: true }, `${km} km: the planner's walking minutes`);
    else {
      const t = rail.railEstimate(INN, to, [INN], [to]);
      assert.deepEqual(e, { minutes: t.minutes, mode: t.kind === 'walk' ? 'WALK' : 'TRANSIT', estimated: true }, `${km} km: the planner's rail estimate`);
    }
  }
  // With real station lists the estimate is railEstimate's own; the nearest anchor (by estimate) wins.
  const to = { lat: INN.lat + 6 / 111, lng: INN.lng };
  const st = [{ name: 'Inn Halt', lat: INN.lat + 0.3 / 111, lng: INN.lng }], st2 = [{ name: 'Pier Halt', lat: to.lat - 0.2 / 111, lng: to.lng }];
  assert.equal(sc.estimateReach(INN, to, { fromStations: st, toStations: st2 }).minutes, rail.railEstimate(INN, to, st, st2).minutes);
  const near = { lat: to.lat - 0.5 / 111, lng: to.lng };
  assert.deepEqual(sc.reachFor({ place_id: 'X1', location: to }, { anchors: [INN, near] }), sc.estimateReach(near, to));
  assert.equal(sc.reachFor({ place_id: 'X2', location: to }, { anchors: [] }), null);
  assert.equal(sc.estimateReach(INN, null), null);
});

/* ---- the app page's Scout screen, run in a vm with a tiny DOM ---- */
// The page lives outside helpers/; a vendored copy of these tests (helpers only) has no page to read, so this test skips there.
const PAGE_FILE = path.join(__dirname, '..', '..', 'live-site-pages', 'helper-app.html');
const PAGE = fs.existsSync(PAGE_FILE) ? fs.readFileSync(PAGE_FILE, 'utf8') : null;
function node(tag, attrs = {}, children) {
  const n = { tag, attrs, children: [], text: attrs.text === undefined ? '' : String(attrs.text),
    appendChild(c) { if (c) this.children.push(c); return c; }, setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; }, addEventListener() {} };
  [].concat(children || []).forEach((c) => n.appendChild(typeof c === 'string' ? node('#text', { text: c }) : c));
  return n;
}
const walk = (n, f, out = []) => { if (!n) return out; if (f(n)) out.push(n); n.children.forEach((c) => walk(c, f, out)); return out; };
function runScout(items) {
  const src = PAGE.slice(PAGE.indexOf('    /* ---------- scout:'), PAGE.indexOf('    function showScoutOne(id) {')) +
    PAGE.slice(PAGE.indexOf('    function showScoutOne(id) {'), PAGE.indexOf('\n    }\n', PAGE.indexOf('    function showScoutOne(id) {')) + 7);
  let rendered = null;
  const box = { str: (v, max) => { v = v === undefined || v === null ? '' : String(v); return max && v.length > max ? v.slice(0, max - 1) + '…' : v; },
    num: (v) => (isFinite(Number(v)) ? Number(v) : 0), list: (v) => (Array.isArray(v) ? v : []), obj: (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {}),
    el: node, clear: (n) => { n.children.length = 0; return n; }, linkBtn: () => null, render: (v) => { rendered = v; }, stateView: () => null, why: () => '',
    call: (op, args, ok) => ok({ scout: { id: 'sc-20270901-matcha', query: 'matcha', place_label: 'Quillmere', created_on: '2027-09-01', items, left_out: [] } }),
    setMain() {}, haptic() {}, go() {}, setStatus() {}, mainProgress() {}, httpsUrl: () => '', S: { scout: 'sc-20270901-matcha' }, SCOUT_ID_RE: /^sc-/, setTimeout, clearTimeout };
  vm.runInNewContext(src + '\nshowScoutOne("sc-20270901-matcha");', box);
  return walk(rendered, (n) => n.attrs && n.attrs.class === 'item reveal').map((card) => ({
    bars: walk(card, (n) => n.attrs && n.attrs['data-part']).map((b) => [b.attrs['data-part'], b.attrs['data-value']]),
    pills: walk(card, (n) => n.attrs && n.attrs.class === 'pill' && n.text).map((p) => p.text)
  }));
}

test('change 6 (app): the Scout card shows five bars, four for an old payload; not judged and new read as words',
  { skip: PAGE === null ? 'the app page is not part of this copy of the helpers' : false }, () => {
  const scripts = [...PAGE.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  scripts.forEach((s) => assert.doesNotThrow(() => new vm.Script(s)));
  const it = (n, parts, labels = []) => ({ n, name: 'Quill Pick ' + n, why_you: 'A quiet room.', parts, labels, maps_url: 'https://www.google.com/maps/' });
  const cards = runScout([it(1, { topic: 90, quality: 60, fit: 30, local: 25, reach: 50 }, ['new', 'not_judged']), it(2, { topic: 80, quality: 70, fit: 40, reach: 100 }), it(3, { topic: '<b>x</b>', quality: 900 })]);
  assert.deepEqual(cards[0].bars, [['topic', '90'], ['quality', '60'], ['fit', '30'], ['local', '25'], ['reach', '50']]);
  assert.deepEqual(cards[1].bars, [['topic', '80'], ['quality', '70'], ['fit', '40'], ['reach', '100']]);
  assert.deepEqual(cards[2].bars, [['topic', '0'], ['quality', '100']], 'hostile or out-of-range parts are clamped numbers');
  assert.ok(cards[0].pills.includes('new') && cards[0].pills.includes('not judged'));
});

// Developed by: LightAISolutions
