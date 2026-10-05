'use strict';
// packs/tour-guide — Contract C18 wave 2 (WP-18d): the briefing schema (schemas/tour-guide-briefing.schema.json) and
// brochure-map's merge of options.briefing (only with options.c18) into the brochure days: unknown keys and dates not in
// the brochure dropped, texts clipped to the kit's caps, a food place without a card kept as plain text, every drop a
// "briefing: …" warning from renderPlan, and the merged model valid for the kit. Invented data only
// (brochure-map-sample-c18.mjs: C18_BRIEFING).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const load = async () => ({
  bm: await import('../packs/tour-guide/brochure-map/index.mjs'),
  kit: await import('../kits/brochure/index.mjs'),
  schemas: await import('../packs/tour-guide/schemas/index.mjs'),
  ...(await import('../packs/tour-guide/brochure-map/brochure-map-sample-c18.mjs'))
});
const clone = (x) => JSON.parse(JSON.stringify(x));
/** The C18 sample with a briefing (a clone of C18_BRIEFING unless given) and the display options. */
const input = (L, briefing, extra = {}) => { const s = L.sampleInputC18(); s.options = { ...s.options, clock: '24h', temp: 'both', briefing: briefing === undefined ? clone(L.C18_BRIEFING) : briefing, ...extra }; return s; };
const days = (html) => html.split('class="sec sec-day');
/** The model is what the kit accepts: schema and semantic checks. */
function assertKitValid(kit, model) {
  assert.deepEqual(kit.validate(model), []);
  assert.deepEqual(kit.semanticErrors(model), []);
}

test('briefing schema: C18_BRIEFING is valid; unknown keys, bad dates, caps and the semantic checks are refused', async () => {
  const L = await load();
  const v = (b) => L.schemas.validate(b, 'briefing');
  assert.deepEqual(v(clone(L.C18_BRIEFING)), { ok: true, errors: [] });
  assert.deepEqual(v({ v: 1, days: {} }), { ok: true, errors: [] }, 'an empty briefing is valid');
  const D = '2027-05-13';
  const bad = [
    ['/extra', (b) => { b.extra = 1; }],
    ['/v', (b) => { b.v = 2; }],
    ['/days/2027-13-01', (b) => { b.days['2027-13-01'] = {}; }],
    ['/days/2027-02-30', (b) => { b.days['2027-02-30'] = {}; }],
    [`/days/${D}/mood`, (b) => { b.days[D].mood = 'sunny'; }],
    [`/days/${D}/theme`, (b) => { b.days[D].theme = 'x'.repeat(161); }],
    [`/days/${D}/lead`, (b) => { b.days[D].lead = 'x'.repeat(241); }],
    [`/days/${D}/contents`, (b) => { b.days[D].contents = ''; }],
    [`/days/${D}/key_times`, (b) => { b.days[D].key_times.push({ label: 'Late', time: '23:00' }); }],
    [`/days/${D}/key_times/0/time`, (b) => { b.days[D].key_times[0].time = '8:55'; }],
    [`/days/${D}/key_times/2/time`, (b) => { b.days[D].key_times[2].time = '09:00'; }],
    [`/days/${D}/food/0/place`, (b) => { b.days[D].food[0].place = 'Slate_Museum'; }],
    [`/days/${D}/food/0`, (b) => { delete b.days[D].food[0].fits; }],
    [`/days/${D}/food/0/stars`, (b) => { b.days[D].food[0].stars = 5; }],
    [`/days/${D}/if_then/0`, (b) => { delete b.days[D].if_then[0].if; }],
    [`/days/${D}/why`, (b) => { b.days[D].why = Array(5).fill('Because.'); }],
    [`/days/${D}/kit/weather/low_c`, (b) => { b.days[D].kit.weather.low_c = 25; }],
    [`/days/${D}/kit/weather/rain_pct`, (b) => { b.days[D].kit.weather.rain_pct = 130; }],
    [`/days/${D}/kit/items`, (b) => { b.days[D].kit.items = Array(7).fill('A layer'); }],
    ['/days', (b) => { for (let i = 1; i <= 32; i += 1) b.days[`2027-07-${String(i).padStart(2, '0')}`] = {}; }]
  ];
  for (const [at, edit] of bad) {
    const b = clone(L.C18_BRIEFING); edit(b);
    const r = v(b);
    assert.equal(r.ok, false, at);
    assert.ok(r.errors.some((e) => e.path === at || e.path.startsWith(at + '/')), `${at}: ${JSON.stringify(r.errors)}`);
  }
});

test('renderPlan merges the sample briefing: no warnings, every block printed, the merged model valid for the kit', async () => {
  const L = await load();
  const r = L.bm.renderPlan(input(L));
  assert.deepEqual(r.warnings, []);
  assertKitValid(L.kit, r.model);
  const [d1, d2] = r.model.days;
  assert.equal(d2.theme, 'Lark Hill and the train out', 'the briefing theme replaces the plan theme');
  assert.equal(d1.theme, L.sampleInputC18().plan.days[0].theme, 'no briefing theme: the plan theme stays');
  assert.deepEqual(d1.key_times.map((k) => k.time), ['08:55', '10:00', '19:00', '20:12']);
  assert.deepEqual(d1.food.map((f) => f.place), ['slate-museum', 'copper-market', 'juniper-table']);
  assert.equal(d1.kit.weather.rain_pct, 30);
  assert.equal(d2.kit.weather.rain_pct, undefined);
  const [glance, h1, h2] = days(r.html);
  for (const cls of ['day-lead', 'key-times', 'why-box', 'day-kit', 'day-food', 'day-ifthen']) assert.ok(h1.includes(`class="${cls}"`), cls);
  assert.ok(!h2.includes('day-food'), 'day 2 has no food in the briefing');
  assert.ok(glance.includes('The museum, the market, a free afternoon') && glance.includes('Lark Hill, then the train'));
  assert.ok(h1.includes('High <b>21 °C · 70 °F</b> · low <b>11 °C · 52 °F</b>'));
  assert.ok(h1.includes('Sunset <b>20:12</b>'), 'day 1: the sunset from the plan');
  assert.ok(!h2.includes('kit-sun'), 'day 2 ends at a train before sunset: no sunset in the kit');
  assert.ok(h1.includes('href="#place-juniper-table"'), 'a food place with a card links to it');
  // buildModel gives the same model and the mapping's own warnings; toBrochureModel the model alone.
  const b = L.bm.buildModel(input(L));
  assert.deepEqual(b, { model: r.model, warnings: [] });
  assert.deepEqual(L.bm.toBrochureModel(input(L)), r.model);
});

test('times inside the briefing texts follow the clock; key times stay HH:MM in the model and print in the clock', async () => {
  const L = await load();
  const r = L.bm.renderPlan(input(L, undefined, { clock: '12h' }));
  assert.deepEqual(r.warnings, []);
  const d1 = r.model.days[0];
  assert.ok(d1.lead.startsWith('Two fixed points: the 10:00 am museum entry and the 7:00 pm table'), d1.lead);
  assert.equal(d1.food[1].fits, 'lunch, 1:00 pm–1:45 pm');
  assert.equal(d1.bail_out, 'After the market, take Tram 3 back to Quayside Rooms and rest; keep only the 7:00 pm dinner.');
  assert.equal(d1.key_times[0].time, '08:55');
  assert.ok(days(r.html)[1].includes('<span class="kt-l">Train in</span><b class="kt-t">8:55 am</b>'));
  assert.ok(days(r.html)[1].includes('Sunset <b>8:12 pm</b>'));
  assertKitValid(L.kit, r.model);
});

test('a briefing is used only with options.c18, for its own build, as v1', async () => {
  const L = await load();
  const base = L.bm.renderPlan(input(L, null));
  assert.deepEqual(base.warnings, []);
  const noC18 = L.bm.renderPlan(input(L, undefined, { c18: false }));
  assert.deepEqual(noC18.warnings, ['briefing: ignored — it needs options.c18']);
  assert.equal(noC18.model.days[0].lead, undefined);
  const plainC18 = input(L, null, { c18: false });
  assert.equal(noC18.html, L.bm.renderPlan(plainC18).html, 'without c18 the briefing changes nothing');
  const other = clone(L.C18_BRIEFING); other.build_id = 'fixture-build-0002';
  const o = L.bm.renderPlan(input(L, other));
  assert.equal(o.warnings.length, 1);
  assert.match(o.warnings[0], /^briefing: ignored — written for build fixture-build-0002, the plan is build fixture-build-0001$/);
  assert.equal(o.html, base.html);
  const noBuild = clone(L.C18_BRIEFING); delete noBuild.build_id;
  assert.deepEqual(L.bm.renderPlan(input(L, noBuild)).warnings, [], 'a briefing without build_id applies');
  for (const bad of [{ v: 2, days: {} }, { v: 1 }, 'text', [1]]) {
    const w = L.bm.renderPlan(input(L, bad));
    assert.deepEqual(w.warnings, ['briefing: ignored — not a v1 briefing with days'], JSON.stringify(bad));
    assert.equal(w.html, base.html);
  }
});

test('merge drops what does not fit: dates outside the brochure, unknown keys, unusable entries — each a warning', async () => {
  const L = await load();
  const D = '2027-05-13';
  const b = clone(L.C18_BRIEFING);
  const before = clone(b);
  b.days['2027-05-20'] = { lead: 'A day after the trip.' };
  b.days[D].mood = 'sunny';
  b.days[D].kit.weather.wind = 'light';
  b.days[D].food.push({ name: 'Weaver Gallery café', place: 'weaver-gallery', dish: 'Fig tart', fits: 'afternoon, 16:00' });
  b.days[D].food.push({ name: 'No dish', fits: 'never' });
  b.days[D].if_then.push({ if: 'Only an if' });
  b.days[D].why.push(42);
  const snapshot = clone(b);
  const r = L.bm.renderPlan(input(L, b));
  assert.deepEqual(b, snapshot, 'the briefing given is not mutated');
  assert.deepEqual(r.warnings, [
    'briefing: 2027-05-13: unknown key "mood" — dropped',
    'briefing: 2027-05-13 food 4: no place card for "weaver-gallery" — kept as plain text',
    'briefing: 2027-05-13 food 5: needs a name, a dish and where it fits — dropped',
    'briefing: 2027-05-13 if_then 3: needs both "if" and "then" — dropped',
    'briefing: 2027-05-13 why 3: not text — dropped',
    'briefing: 2027-05-13 kit weather: unknown key "wind" — dropped',
    'briefing: 2027-05-20 is not a day of the brochure — dropped'
  ]);
  assertKitValid(L.kit, r.model);
  const d1 = r.model.days[0];
  assert.equal(d1.mood, undefined);
  assert.equal(d1.food.length, 4);
  assert.deepEqual(d1.food[3], { name: 'Weaver Gallery café', dish: 'Fig tart', fits: 'afternoon, 16:00' }, 'no card: the place is dropped, the name stays');
  assert.equal(d1.if_then.length, before.days[D].if_then.length);
  assert.equal(d1.why.length, before.days[D].why.length);
  assert.ok(!('wind' in d1.kit.weather));
  assert.ok(!r.html.includes('A day after the trip.'));
  const h1 = days(r.html)[1];
  assert.ok(h1.includes('Weaver Gallery café') && !h1.includes('href="#place-weaver-gallery"'));
});

test('merge clips texts to the kit caps and keeps the first N usable list entries', async () => {
  const L = await load();
  const D = '2027-05-13';
  const caps = (await import('../kits/brochure/lib/model.mjs')).BRIEF_CAPS.brochure;
  const b = clone(L.C18_BRIEFING);
  b.days[D].lead = 'Walk slowly. '.repeat(30);
  b.days[D].contents = 'c'.repeat(caps.contents + 20);
  b.days[D].why = ['One.', 'Two.', 'Three.', 'Four.', 'Five.', 'Six.'];
  b.days[D].key_times = [
    { label: 'Dinner', time: '19:00' }, { label: 'Bad', time: '25:00' }, { time: '09:00' },
    { label: 'Museum entry', time: '10:00' }, { label: 'Train in', time: '8:55' }, { label: 'Sunset', time: '20:12' },
    { label: 'Too many', time: '07:00' }
  ];
  const r = L.bm.renderPlan(input(L, b));
  assert.deepEqual(r.warnings, [
    `briefing: ${D} lead: clipped to ${caps.lead} characters`,
    `briefing: ${D} key_times 2: needs a label and an HH:MM time — dropped`,
    `briefing: ${D} key_times 3: needs a label and an HH:MM time — dropped`,
    `briefing: ${D} key_times: 5 entries, the first ${caps.key_times} kept`,
    `briefing: ${D} contents: clipped to ${caps.contents} characters`,
    `briefing: ${D} why: 6 entries, the first ${caps.why} kept`
  ]);
  assertKitValid(L.kit, r.model);
  const d1 = r.model.days[0];
  assert.ok(d1.lead.length <= caps.lead && d1.lead.endsWith('…'), d1.lead);
  assert.ok(d1.contents.length <= caps.contents && d1.contents.endsWith('…'));
  assert.deepEqual(d1.why, ['One.', 'Two.', 'Three.', 'Four.']);
  assert.deepEqual(d1.key_times, [
    { label: 'Train in', time: '08:55' }, { label: 'Museum entry', time: '10:00' },
    { label: 'Dinner', time: '19:00' }, { label: 'Sunset', time: '20:12' }
  ], 'the first four usable, a time normalised to HH:MM, then in time order');
});

test('merge checks the weather and leaves out an empty kit', async () => {
  const L = await load();
  const [D1, D2] = ['2027-05-13', '2027-05-14'];
  const b = clone(L.C18_BRIEFING);
  b.days[D1].kit = { weather: { high_c: 10, low_c: 14 } };
  b.days[D2].kit = { weather: { high_c: 18, low_c: 9, rain_pct: 140 }, items: [] };
  const r = L.bm.renderPlan(input(L, b));
  assert.deepEqual(r.warnings, [
    `briefing: ${D1} kit weather: the low is above the high — dropped`,
    `briefing: ${D2} kit weather: rain_pct must be 0–100 — dropped`
  ]);
  assertKitValid(L.kit, r.model);
  const [d1, d2] = r.model.days;
  assert.equal(d1.kit, undefined, 'nothing left in the kit: no kit');
  assert.deepEqual(d2.kit, { weather: { high_c: 18, low_c: 9 } });
  const b2 = clone(L.C18_BRIEFING);
  b2.days[D1].kit.weather = { high_c: 'warm', low_c: 11 };
  assert.deepEqual(L.bm.renderPlan(input(L, b2)).warnings, [`briefing: ${D1} kit weather: needs high_c and low_c between −60 and 60 — dropped`]);
});

test('the pack sample with the briefing prints with no warnings (letter and A4) when Playwright is present', async (t) => {
  const L = await load();
  if (!L.kit.pdfAvailable()) { t.skip('Playwright/Chromium not available'); return; }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'c18b-pack-'));
  try {
    for (const page of ['letter', 'a4']) {
      const r = await L.bm.renderPlanPdf(input(L, undefined, { page }), path.join(dir, `pack-${page}.pdf`), { page, embedFonts: false });
      assert.deepEqual(r.warnings, [], page);
      assert.ok(r.pages >= 6, `${page}: ${r.pages} pages`);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// Developed by: LightAISolutions
