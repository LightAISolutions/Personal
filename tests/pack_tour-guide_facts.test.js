'use strict';
// packs/tour-guide/facts — C11 place facts (WP-11b): the normaliser accepts a full invented record and refuses every
// out-of-bounds value and unknown key; the display lines, staleness and the disagreement with Google's hours.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const F = () => import('../packs/tour-guide/facts/index.mjs');
const FIX = JSON.parse(readFileSync(join(__dirname, '../packs/tour-guide/facts/fixtures/facts-fixture-full.json'), 'utf8'));
const copy = (x) => JSON.parse(JSON.stringify(x));

test('normalizeFacts: full invented records pass; strings are trimmed, nulls dropped, weekdays sorted once each; the input is untouched', async () => {
  const f = await F();
  for (const key of ['garden', 'restaurant']) {
    const r = f.normalizeFacts(FIX[key]);
    assert.equal(r.ok, true, key + ': ' + JSON.stringify(r.errors));
    assert.deepEqual(r.facts, FIX[key]);
  }
  const raw = { ...copy(FIX.garden), payment: '  cash only ', gate_name: null, closed_weekdays: [3, 1, 3], menu: { checked: '2031-04-02', fits: 'YES' } };
  const before = copy(raw);
  const r = f.normalizeFacts(raw);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.facts.payment, 'cash only');
  assert.equal('gate_name' in r.facts, false);
  assert.deepEqual(r.facts.closed_weekdays, [1, 3]);
  assert.equal(r.facts.menu.fits, 'yes');
  assert.deepEqual(raw, before, 'input not mutated');
  assert.deepEqual(f.normalizeFacts(null), { ok: false, facts: null, errors: [{ path: '/', message: 'facts must be an object' }] });
  assert.equal(f.normalizeFacts([]).ok, false);
});

test('normalizeFacts: each out-of-bounds value and each unknown key is refused at its path', async () => {
  const f = await F();
  const base = FIX.restaurant;
  const long = (n) => 'x'.repeat(n);
  const cases = [
    ['/', (x) => { delete x.checked; }],
    ['/checked', (x) => { x.checked = '2031-02-30'; }],
    ['/sources', (x) => { x.sources = []; }],
    ['/sources', (x) => { x.sources = Array.from({ length: 7 }, () => x.sources[0]); }],
    ['/sources/0/url', (x) => { x.sources[0].url = 'http://kelp-and-cedar.example.net/menu'; }],
    ['/sources/0/title', (x) => { x.sources[0].title = long(121); }],
    ['/sources/0/accessed', (x) => { x.sources[0].accessed = '05/04/2031'; }],
    ['/sources/0/extra', (x) => { x.sources[0].extra = 1; }],
    ['/visit_minutes/min', (x) => { x.visit_minutes.min = 14; }],
    ['/visit_minutes/max', (x) => { x.visit_minutes.max = 721; }],
    ['/visit_minutes/min', (x) => { x.visit_minutes.min = 60.5; }],
    ['/visit_minutes', (x) => { x.visit_minutes = { min: 120, max: 90 }; }],
    ['/last_entry', (x) => { x.last_entry = '24:30'; }],
    ['/last_entry_note', (x) => { x.last_entry = '20:00'; x.last_entry_note = long(81); }],
    ['/close', (x) => { x.close = '9pm'; }],
    ['/closed_weekdays/0', (x) => { x.closed_weekdays = [7]; }],
    ['/closed_weekdays/0', (x) => { x.closed_weekdays = [-1]; }],
    ['/booking/party_min', (x) => { x.booking.party_min = 21; }],
    ['/booking/party_min', (x) => { x.booking.party_min = 0; }],
    ['/booking/lead', (x) => { x.booking.lead = long(81); }],
    ['/booking/how', (x) => { x.booking.how = long(81); }],
    ['/booking/text', (x) => { x.booking.text = long(161); }],
    ['/booking/required', (x) => { x.booking.required = 'yes'; }],
    ['/booking/url', (x) => { x.booking.url = 'https://kelp-and-cedar.example.net/'; }],
    ['/price/text', (x) => { x.price.text = long(81); }],
    ['/price', (x) => { x.price = { includes: 'tea' }; }],
    ['/price/includes', (x) => { x.price.includes = long(161); }],
    ['/payment', (x) => { x.payment = long(81); }],
    ['/gate_name', (x) => { x.gate_name = long(81); }],
    ['/menu/fits', (x) => { x.menu.fits = 'maybe'; }],
    ['/menu', (x) => { delete x.menu.checked; }],
    ['/menu/note', (x) => { x.menu.note = long(161); }],
    ['/opening_hours', (x) => { x.opening_hours = 'daily'; }]
  ];
  for (const [path, mutate] of cases) {
    const x = copy(base);
    mutate(x);
    const r = f.normalizeFacts(x);
    assert.equal(r.ok, false, `${path} should be refused`);
    assert.equal(r.facts, null);
    assert.ok(r.errors.some((e) => e.path === path), `${path}: got ${JSON.stringify(r.errors)}`);
  }
});

test('factsLines: one display line each, ≤ 160, from the place\'s own facts; only keys with something to say', async () => {
  const f = await F();
  const g = f.normalizeFacts(FIX.garden).facts, r = f.normalizeFacts(FIX.restaurant).facts;
  assert.deepEqual(f.factsLines(g, { now: '2031-04-20' }), {
    facts_line: 'Last entry 16:00 (tea house 15:30) · closes 16:30 · about 60–90 min · closed Mondays · enter at the Lantern Gate · official site',
    booking_line: 'No booking needed · Groups of ten or more write ahead',
    price_line: '800 credits, tea and a sweet included · cash only'
  });
  assert.deepEqual(f.factsLines(r, { now: '2031-04-20', diet: 'vegetarian' }), {
    facts_line: 'Closes 22:00 · about 90 min–2 h · closed Sundays and Wednesdays · official site',
    booking_line: 'Book 2 days ahead by phone · 2 people or more · Course only after 18:00',
    price_line: '6,500 credits course, eight dishes and tea · cards accepted · menu partly fits vegetarian',
    menu_checked: '2031-04-05'
  });
  // without a diet the price line says nothing about the menu; stale facts name their check month
  assert.equal(f.factsLines(r, { now: '2031-04-20' }).price_line, '6,500 credits course, eight dishes and tea · cards accepted');
  assert.match(f.factsLines(g, { now: '2031-09-01' }).facts_line, /official site, checked Apr 2031$/);
  assert.deepEqual(f.factsLines({ checked: '2031-04-02', sources: FIX.garden.sources }), {}, 'nothing to say → no keys');
  assert.deepEqual(f.factsLines(null), {});
  assert.equal(f.factsLines({ ...g, booking: { required: true } }).booking_line, 'Book ahead');
  assert.equal(f.factsLines({ ...g, booking: { party_min: 1, how: 'online' } }).booking_line, 'Book online');
  assert.equal(f.factsLines({ ...g, visit_minutes: { min: 45, max: 45 } }).facts_line.includes('about 45 min'), true);
  assert.equal(f.factsLines({ checked: '2031-04-02', sources: FIX.garden.sources, visit_minutes: { min: 120, max: 180 } }).facts_line, 'About 2–3 h · official site');
  // every line stays within 160 even when the facts are at their bounds
  const huge = { ...g, last_entry_note: 'n'.repeat(80), gate_name: 'g'.repeat(80), booking: { required: true, lead: 'l'.repeat(80), how: 'h'.repeat(80), text: 't'.repeat(160) }, price: { text: 'p'.repeat(80), includes: 'i'.repeat(160) }, payment: 'c'.repeat(80) };
  for (const [k, v] of Object.entries(f.factsLines(huge, { diet: ['vegetarian', 'no pork'] }))) if (k !== 'menu_checked') assert.ok(v.length <= f.LINE_MAX, `${k} is ${v.length}`);
  assert.equal(f.menuLine(r, { now: '2031-04-20', diet: 'vegetarian' }), 'Menu checked 5 Apr 2031: partly fits vegetarian — ask for the course without fish stock');
  assert.equal(f.menuLine(r, { now: '2031-06-01' }), 'Menu checked 5 Apr 2031 (may have changed): partly fits the diet — ask for the course without fish stock');
  assert.equal(f.menuLine(g), '');
});

test('factsStale: facts after 90 days, a menu check after 30; an unknown date is stale; now may be a Date, a timestamp or a date', async () => {
  const f = await F();
  const r = f.normalizeFacts(FIX.restaurant).facts;
  assert.deepEqual(f.factsStale(r, '2031-04-20'), { facts: false, menu: false, any: false, facts_age_days: 15, menu_age_days: 15 });
  assert.deepEqual(f.factsStale(r, new Date(Date.UTC(2031, 4, 6, 12))), { facts: false, menu: true, any: true, facts_age_days: 31, menu_age_days: 31 });
  assert.equal(f.factsStale(r, '2031-05-05T23:00:00Z').menu, false, 'day 30 is still fresh');
  assert.equal(f.factsStale(r, '2031-07-04').facts, false, 'day 90 is still fresh');
  assert.equal(f.factsStale(r, '2031-07-05').facts, true);
  const g = f.normalizeFacts(FIX.garden).facts;
  assert.deepEqual(f.factsStale(g, '2031-04-20'), { facts: false, menu: false, any: false, facts_age_days: 18, menu_age_days: null }, 'no menu → never a stale menu');
  assert.equal(f.factsStale({}, '2031-04-20').facts, true);
  assert.equal(f.FACTS_MAX_AGE_DAYS, 90);
  assert.equal(f.MENU_MAX_AGE_DAYS, 30);
  assert.throws(() => f.factsStale(r, 'tomorrow'), /facts: now must be/);
});

test('factsConflict: own closed day, Google closed day, closing time and last entry against Google; unknown hours never conflict', async () => {
  const f = await F();
  const g = f.normalizeFacts(FIX.garden).facts; // closed Mondays, closes 16:30, last entry 16:00
  const week = (h, m) => ({ periods: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ open: { day: d, hour: 9, minute: 0 }, close: { day: d, hour: h, minute: m } })) });
  // 2031-11-17 is a Monday, 2031-11-18 a Tuesday
  const mon = f.factsConflict(g, week(16, 30), '2031-11-17');
  assert.deepEqual(mon.items.map((i) => i.kind), ['closed_day']);
  assert.equal(mon.conflict, true);
  assert.match(mon.items[0].text, /closed on Mondays; Google shows it open/);
  assert.deepEqual(f.factsConflict(g, week(16, 40), '2031-11-18'), { conflict: false, items: [] }, 'within 15 minutes is the same time');
  const late = f.factsConflict(g, week(17, 30), '2031-11-18');
  assert.deepEqual(late.items.map((i) => [i.kind, i.own, i.google]), [['close_time', '16:30', '17:30']]);
  const early = f.factsConflict(g, week(15, 30), '2031-11-18');
  assert.deepEqual(early.items.map((i) => i.kind), ['close_time', 'last_entry_after_close']);
  const shut = { periods: [{ open: { day: 1, hour: 9, minute: 0 }, close: { day: 1, hour: 16, minute: 30 } }] };
  assert.deepEqual(f.factsConflict(g, shut, '2031-11-18').items.map((i) => i.kind), ['google_closed'], 'own list of closed days says Tuesday is open');
  assert.deepEqual(f.factsConflict({ ...g, closed_weekdays: undefined }, shut, '2031-11-18'), { conflict: false, items: [] }, 'no own list → no claim about Tuesday');
  assert.deepEqual(f.factsConflict(g, null, '2031-11-17'), { conflict: false, items: [] });
  assert.deepEqual(f.factsConflict(null, week(16, 30), '2031-11-17'), { conflict: false, items: [] });
  assert.throws(() => f.factsConflict(g, week(16, 30), '17/11/2031'), /facts: date/);
});

// Developed by: LightAISolutions
