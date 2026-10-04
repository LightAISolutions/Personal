'use strict';
// WP-15b (TG-PHASE-15, change E): the evening extras — an event under way when the stops finish, chosen What's on
// events first on their day, the 10 km radius and its warning, isEveningChoice. Invented places and events only.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const PLANNER = pathToFileURL(path.join(__dirname, '..', 'packs', 'tour-guide', 'planner', 'index.mjs')).href;
const load = () => import(PLANNER);

const DATE = '2027-05-12';
const END = { lat: 45.0, lng: 7.0 };                       // where the day ends: the last stop
const LODGING = { lat: 45.0, lng: 7.0 };
const at = (km) => ({ lat: 45.0 + km / 111.2, lng: 7.0 });  // km due north of the end point
const evening = (o = {}) => Object.assign({ finish: 16 * 60, dayEnd: 22 * 60, ends: false, lodging: LODGING, ready: 9 * 60,
  last: { cand: { loc: END } } }, o);
const ev = (o) => Object.assign({ kind: 'light_up', from: DATE, to: DATE }, o);
const run = async (season, o = {}) => {
  const { eveningExtras } = await load();
  const warnings = o.warnings || [];
  const out = eveningExtras({ evening: evening(o.evening), date: o.date || DATE, season: { checked: '2027-04-01', events: season },
    places: [], snapshots: new Map(), warnings });
  return { out, warnings };
};

test('the fault: an unchosen 10:00–17:30 opening 1 km away is no longer offered "that evening" at 10:00', async () => {
  const opening = ev(Object.assign({ id: 'ember-hall-late', name: 'Ember Hall open day', kind: 'special_opening', start: '10:00', end: '17:30' }, at(1)));
  // stops finish at 16:00: offered from 16:15 (finish + AFTER_MIN), 75 minutes of it left
  const a = await run([opening]);
  assert.equal(a.out.length, 1);
  assert.equal(a.out[0].time, '16:15');
  assert.notEqual(a.out[0].time, '10:00');
  // stops finish at 17:10: from 17:25 only 5 minutes are left (< MIN_OPEN) — not offered at all
  const b = await run([opening], { evening: { finish: 17 * 60 + 10 } });
  assert.deepEqual(b.out, []);
  // ready later than the finish + AFTER_MIN (a moving day's bag step): the later of the two
  const c = await run([opening], { evening: { finish: 14 * 60, ready: 15 * 60 } });
  assert.equal(c.out[0].time, '15:00');
});

test('an evening event that starts after the finish keeps its own start', async () => {
  const { out } = await run([ev(Object.assign({ id: 'lantern-walk', name: 'Lantern walk', start: '20:00', end: '22:00' }, at(1)))]);
  assert.equal(out[0].time, '20:00');
  assert.equal(out[0].chosen, undefined);
});

test('chosen evening events come first, within 10 km, with chosen: true; unchosen by distance next; MAX holds', async () => {
  const season = [
    ev(Object.assign({ id: 'near-a', name: 'Near A', start: '19:00', end: '21:00' }, at(0.5))),
    ev(Object.assign({ id: 'near-b', name: 'Near B', start: '19:00', end: '21:00' }, at(1.0))),
    ev(Object.assign({ id: 'near-c', name: 'Near C', start: '19:00', end: '21:00' }, at(1.5))),
    ev(Object.assign({ id: 'wo-far-glow', name: 'Far glow', start: '20:00', end: '23:00', chosen_on: DATE }, at(7)))
  ];
  const { out, warnings } = await run(season);
  assert.deepEqual(out.map((x) => x.ref), ['wo-far-glow', 'near-a', 'near-b']);
  assert.equal(out[0].chosen, true);
  assert.equal(out[0].km, 7);
  assert.equal(out[1].chosen, undefined);
  assert.deepEqual(warnings, []);
});

test('a chosen evening event past 10 km is not offered; the day gets the info warning instead', async () => {
  const season = [ev(Object.assign({ id: 'wo-hill-fire', name: 'Hill fire show', start: '21:00', end: '22:00', chosen_on: DATE }, at(14.2)))];
  const { out, warnings } = await run(season);
  assert.deepEqual(out, []);
  assert.deepEqual(warnings, [{ severity: 'info', code: 'other', text: 'Hill fire show, chosen for this evening, is about 14 km from where the day ends' }]);
  // an unchosen event at that distance is simply out of range, as before (2 km)
  const plain = await run([ev(Object.assign({ id: 'hill-fire', name: 'Hill fire show', start: '21:00', end: '22:00' }, at(3)))]);
  assert.deepEqual(plain.out, []);
  assert.deepEqual(plain.warnings, []);
});

test('a chosen event is considered only on its chosen_on date; an unchosen one on every evening it runs', async () => {
  const run3 = { from: '2027-05-12', to: '2027-05-14', start: '19:00', end: '21:00' };
  const chosen = Object.assign({ id: 'wo-river-lights', name: 'River lights', kind: 'light_up', chosen_on: '2027-05-13' }, run3, at(1));
  const plain = Object.assign({ id: 'bridge-glow', name: 'Bridge glow', kind: 'light_up' }, run3, at(1));
  const d12 = await run([chosen, plain], { date: '2027-05-12' });
  assert.deepEqual(d12.out.map((x) => x.ref), ['bridge-glow']);
  const d13 = await run([chosen, plain], { date: '2027-05-13' });
  assert.deepEqual(d13.out.map((x) => [x.ref, x.chosen]), [['wo-river-lights', true], ['bridge-glow', undefined]]);
  const d14 = await run([chosen, plain], { date: '2027-05-14' });
  assert.deepEqual(d14.out.map((x) => x.ref), ['bridge-glow']);
});

test('a daytime choice is never an extra, even close by and running into the evening', async () => {
  const day = ev(Object.assign({ id: 'wo-ember-hall', name: 'Ember Hall open day', kind: 'special_opening', start: '10:00', end: '18:30', chosen_on: DATE }, at(0.3)));
  const { isEveningChoice } = await load();
  assert.equal(isEveningChoice(day), false);
  const { out, warnings } = await run([day]);
  assert.deepEqual(out, []);
  assert.deepEqual(warnings, []);
});

test('isEveningChoice: runs that evening on chosen_on, and starts at or after START_FROM when it has a start', async () => {
  const { isEveningChoice, EXTRAS } = await load();
  assert.equal(EXTRAS.CHOSEN_RADIUS_KM, 10);
  assert.equal(isEveningChoice(ev({ id: 'a', name: 'A', start: '19:00', end: '21:00', chosen_on: DATE })), true);
  assert.equal(isEveningChoice(ev({ id: 'b', name: 'B', chosen_on: DATE })), true);                                   // a light-up, no times
  assert.equal(isEveningChoice(ev({ id: 'c', name: 'C', kind: 'market', end: '21:00', chosen_on: DATE })), true);      // end only, in the evening
  assert.equal(isEveningChoice(ev({ id: 'd', name: 'D', kind: 'market', start: '15:59', end: '21:00', chosen_on: DATE })), false);
  assert.equal(isEveningChoice(ev({ id: 'e', name: 'E', kind: 'market', start: '16:00', end: '21:00', chosen_on: DATE })), true);
  assert.equal(isEveningChoice(ev({ id: 'f', name: 'F', kind: 'festival', start: '11:00', end: '15:00', chosen_on: DATE })), false);
  assert.equal(isEveningChoice(ev({ id: 'g', name: 'G', kind: 'holiday', chosen_on: DATE })), false);
  assert.equal(isEveningChoice(ev({ id: 'h', name: 'H', start: '19:00' })), false);                                    // not chosen
  assert.equal(isEveningChoice(ev({ id: 'i', name: 'I', start: '19:00', chosen_on: '2027-05-20' })), false);           // outside its run
  assert.equal(isEveningChoice(null), false);
});

test('without chosen events or a warnings list the extras are exactly as before', async () => {
  const { eveningExtras } = await load();
  const season = { checked: '2027-04-01', events: [ev(Object.assign({ id: 'quiet-glow', name: 'Quiet glow', start: '20:30', end: '22:00', note: 'By the old mill' }, at(1.2)))] };
  const out = eveningExtras({ evening: evening(), date: DATE, season, places: [], snapshots: new Map() });
  assert.deepEqual(out, [{ kind: 'event', ref: 'quiet-glow', name: 'Quiet glow', km: 1.2, time: '20:30', note: 'By the old mill' }]);
  // a far chosen event with no warnings list given does not throw
  const far = { checked: '2027-04-01', events: [ev(Object.assign({ id: 'wo-x', name: 'X', start: '20:00', chosen_on: DATE }, at(30)))] };
  assert.deepEqual(eveningExtras({ evening: evening(), date: DATE, season: far, places: [], snapshots: new Map() }), []);
});

/* ---------------- the planner end to end, on the invented moving-day fixture ---------------- */
const loadAll = async () => ({
  fixtures: await import('../packs/tour-guide/fixtures/index.mjs'),
  maps: await import('../kits/maps/index.mjs'),
  planner: await load(),
  schemas: await import('../packs/tour-guide/schemas/index.mjs'),
  subset: await import('../kits/brochure/lib/validate.mjs')
});
const MD = ['2027-10-18', '2027-10-19', '2027-10-20'];
async function planMoving(L, mut) {
  const fx = L.fixtures.loadFixture('moving-day');
  mut(fx);
  const maps = L.maps.createMapsClient({ transport: L.maps.createMockTransport(L.fixtures.createFixtureResponder(fx)), ledger: L.maps.createLedger() });
  const p = await L.planner.planTrip({ ...fx, maps, build_id: 'wo-evening', now: '2027-10-01T09:00:00Z', seed: 7 });
  for (const d of p.days) assert.deepEqual(L.subset.validate(d, L.schemas.loadSchema('day-plan')), [], `${d.date}: the day-plan schema accepts it`);
  return (date) => p.days.find((d) => d.date === date);
}

test('planTrip: a chosen light-up comes first with chosen: true on its day only; a far choice warns instead; schemas hold', async () => {
  const L = await loadAll();
  const day = await planMoving(L, (fx) => {
    fx.trip.season.events.push({ id: 'wo-ridge-lanterns', name: 'Ridge lanterns', kind: 'light_up', from: MD[0], to: MD[2], start: '19:30', end: '22:00',
      lat: 34.4505 + 0.045, lng: 160.5505, chosen_on: MD[1] });
    fx.trip.season.events.push({ id: 'wo-cape-drums', name: 'Cape drums', kind: 'performance', from: MD[1], to: MD[1], start: '20:00', end: '21:30',
      lat: 34.4505 + 0.2, lng: 160.5505, chosen_on: MD[1] });
  });
  const d2 = day(MD[1]);
  assert.equal(d2.extras[0].ref, 'wo-ridge-lanterns');
  assert.equal(d2.extras[0].chosen, true);
  assert.ok(d2.extras[0].km > 2 && d2.extras[0].km <= 10, String(d2.extras[0].km));
  assert.ok(d2.extras.slice(1).every((x) => x.chosen === undefined));
  assert.ok(d2.extras.length <= 3);
  assert.ok(d2.warnings.some((w) => w.severity === 'info' && w.code === 'other' && /^Cape drums, chosen for this evening, is about \d+ km from where the day ends$/.test(w.text)), JSON.stringify(d2.warnings));
  for (const d of [day(MD[0]), day(MD[2])]) {
    assert.ok(!(d.extras || []).some((x) => x.ref === 'wo-ridge-lanterns' || x.chosen), `${d.date}: not on another day`);
    assert.ok(!d.warnings.some((w) => /chosen for this evening/.test(w.text)), `${d.date}: no warning`);
  }
});

/* ---------------- `chosen` through both schemas, the core's check, the chat and the app ---------------- */
const H = require('./harness/gas-mocks');
const GNOW = '2027-06-01T16:00:00Z', GTRIP = 'reed-harbour';
const J = (v) => JSON.parse(JSON.stringify(v));
const mapsUrl = (id) => 'https://www.google.com/maps/search/?api=1&query=Fixture&query_place_id=' + id;
const PARADE = '<a href="https://www.google.com/maps/search/?api=1&amp;query=Fixture&amp;query_place_id=Parade">Lantern &lt;parade&gt;</a>';
function freshGas() {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: GNOW });
  H.bootstrap(ctx, state);
  ['RESEARCH', 'PLAN', 'PREFS', 'NOTES', 'BROCHURE', 'PLACES'].forEach((n) => H.configureRoutine(ctx, state, n));
  ctx.tgTripUpsert({ slug: GTRIP, title: 'Reed Harbour', destination: 'Reed Harbour' });
  return { ctx, state };
}
const digestDay = (date, extras) => ({ date, theme: 'Harbour evening', sunset: '19:40', extras,
  stops: [{ n: 1, slug: 'tide-museum', name: 'Tide Museum', arrive: '13:00', depart: '14:30', minutes: 90, maps_url: mapsUrl('Tide'), note_line: '' }],
  legs: [{ from: 'lodging', to: 'tide-museum', mode: 'WALK', minutes: 10 }], warnings: [] });
const CHOSEN = [{ kind: 'event', name: 'Lantern <parade>', time: '20:45', maps_url: mapsUrl('Parade'), chosen: true, note_line: 'Starts at the quay.' },
  { kind: 'event', name: 'Quay drums', time: '21:00' }, { kind: 'saved', name: 'Rope Loft' }];
const PLAIN = [{ kind: 'event', name: 'Quay drums', time: '21:00' }, { kind: 'saved', name: 'Rope Loft' }];
const digest = (days) => ({ v: 1, kind: 'plan_digest', trip: GTRIP, build_id: 'build-wo-1', verified_on: '2027-05-30', tz: 'Etc/UTC',
  drive: { plan: 'fixtureDrivePlanFile01', brochure_html: null, brochure_pdf: null }, days, later: [] });
function gasErrors(ctx, type, payload) {
  const raw = JSON.stringify(H.envelope(type, payload));
  return J(ctx.validateEnvelope(raw, Buffer.byteLength(raw))).errors || [];
}

test('chosen: true passes the day-plan and digest schemas and the core check; any other value is refused by all three', async () => {
  const L = await loadAll();
  const good = digest([digestDay('2027-06-10', J(CHOSEN)), digestDay('2027-06-11', J(PLAIN))]);
  assert.deepEqual(L.schemas.validatePayload('plan_digest', J(good)).errors, []);
  const { ctx } = freshGas();
  assert.deepEqual(gasErrors(ctx, 'plan_digest', J(good)), []);
  for (const bad of [false, 'true', 1, null]) {
    const x = J(good);
    x.days[0].extras[0].chosen = bad;
    assert.equal(L.schemas.validatePayload('plan_digest', J(x)).ok, false, 'node schema: chosen ' + JSON.stringify(bad));
    assert.ok(gasErrors(ctx, 'plan_digest', J(x)).some((e) => /extras\[0\]\.chosen/.test(e)), 'core: chosen ' + JSON.stringify(bad));
  }
  const schema = L.schemas.loadSchema('day-plan');
  const extra = { kind: 'event', ref: 'wo-ridge-lanterns', name: 'Ridge lanterns', km: 4.9, time: '19:30', chosen: true };
  assert.deepEqual(L.subset.validate([extra], { ...schema.properties.extras, $defs: schema.$defs }), []);
  assert.notDeepEqual(L.subset.validate([{ ...extra, chosen: false }], { ...schema.properties.extras, $defs: schema.$defs }), []);
});

test('the chat: chosen events show ⭐ under "This evening"; without a chosen first the heading stays "If you have energy"', () => {
  const { ctx, state } = freshGas();
  H.putEnvelope(state, H.envelope('plan_digest', digest([digestDay('2027-06-10', J(CHOSEN)), digestDay('2027-06-11', J(PLAIN))])));
  assert.equal(J(ctx.pollFromBrain()).processed, 1);
  assert.deepEqual(J(ctx.tgCmdDayExtraLines(J(CHOSEN))), ['<b>This evening</b>', '⭐ 20:45 ' + PARADE, '   <i>Starts at the quay.</i>', '✨ 21:00 Quay drums', '🔖 Rope Loft']);
  assert.deepEqual(J(ctx.tgCmdDayExtraLines(J(PLAIN))), ['<b>If you have energy</b>', '✨ 21:00 Quay drums', '🔖 Rope Loft']);
  // a chosen event that is not first is still starred, under the usual heading
  assert.deepEqual(J(ctx.tgCmdDayExtraLines([J(PLAIN)[0], J(CHOSEN)[0]])).slice(0, 3), ['<b>If you have energy</b>', '✨ 21:00 Quay drums', '⭐ 20:45 ' + PARADE]);
  // the stored day keeps chosen, and /day shows it
  assert.equal(J(ctx.tgDigestDay(GTRIP, 1)).extras[0].chosen, true);
  ctx.settingSet(ctx.TG_SETTINGS.CURRENT_TRIP, GTRIP, 'test');
  const before = state.fetch.telegram('sendMessage').length;
  ctx.doPost(H.postEvent('tg', { k: state.props[ctx.PROP.WEBHOOK_SECRET] }, H.tgUpdate({ text: '/day 1' })));
  const card = state.fetch.telegram('sendMessage').slice(before).map((r) => r.json.text).join('\n');
  assert.match(card, /<b>This evening<\/b>\n⭐ 20:45 /);
  assert.doesNotMatch(card, /If you have energy/);
});

/* ---------------- the app's day view (the page's own dayCard in a VM) ---------------- */
const fs = require('node:fs');
const vm = require('node:vm');
const PAGE_FILE = path.join(__dirname, '..', '..', 'live-site-pages', 'helper-app.html');
const PAGE = fs.existsSync(PAGE_FILE) ? fs.readFileSync(PAGE_FILE, 'utf8') : null;
const SKIP = { skip: PAGE === null ? 'the app page is not part of this copy of the helpers' : false };
class N {
  constructor(tag) { this.tagName = tag; this.children = []; this.attrs = {}; this.className = ''; this._text = ''; this.listeners = {}; }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this.children = []; this._text = String(v); }
  appendChild(c) { this.children.push(c); return c; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; }
  addEventListener(e, f) { (this.listeners[e] = this.listeners[e] || []).push(f); }
}
function slice(from, to) {
  const a = PAGE.indexOf(from), b = PAGE.indexOf(to, a + 1);
  assert.ok(a >= 0 && b > a, 'markers found: ' + from + ' … ' + to);
  return PAGE.slice(a, b);
}
function dayCardText(d) {
  const box = { document: { title: '', createElement: (t) => new N(t), createTextNode: (t) => { const n = new N('#text'); n._text = String(t); return n; } } };
  vm.runInNewContext([slice('    /* ---------- DOM helpers', '    function stateView('),
    slice('    /* ---------- a planned day, worded like the chat', '    /* ---------- brochure:')].join('\n'), box);
  const out = [];
  const walk = (n) => { if (n.tagName === 'h4' || n.className.split(/\s+/).includes('line')) out.push(n.textContent); else n.children.forEach(walk); };
  walk(box.dayCard(d, 0, 1));
  return out;
}

test('the app: a chosen event shows ⭐ under "This evening"; plain extras keep "If you have energy"', SKIP, () => {
  const base = { date: '2027-06-10', theme: 'Harbour evening', sunset: '19:40', stops: [], legs: [], warnings: [] };
  const a = dayCardText({ ...base, extras: J(CHOSEN) });
  const ia = a.indexOf('This evening');
  assert.deepEqual(a.slice(ia, ia + 4), ['This evening', '⭐ 20:45 Lantern <parade>', '✨ 21:00 Quay drums', '🔖 Rope Loft'], JSON.stringify(a));
  assert.ok(!a.includes('If you have energy'));
  const b = dayCardText({ ...base, extras: J(PLAIN) });
  const ib = b.indexOf('If you have energy');
  assert.deepEqual(b.slice(ib, ib + 3), ['If you have energy', '✨ 21:00 Quay drums', '🔖 Rope Loft'], JSON.stringify(b));
  assert.ok(!b.includes('This evening'));
});

// Developed by: LightAISolutions
