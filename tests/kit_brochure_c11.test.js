'use strict';
// kits/brochure — Contract C11 (WP-11d): the model's new optional fields (a day's real start/end, the bag step,
// sunset and evening extras; a stop's last entry, visit-length source, crowd slot and booking line; a dinner's booking;
// a place's facts block and flags; the season page) validate, are rejected with unknown keys or bad values, render in
// the kit's own components, and leave a model without them rendering byte-for-byte as before. Invented data only.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const FIXTURE = path.resolve(__dirname, '..', 'kits', 'brochure', 'fixtures', 'sample-trip.json');
const fixture = () => JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
const kit = () => import('../kits/brochure/index.mjs');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
// Taken before WP-11d changed the kit (decisions/WP-11d.md): the fixture's HTML must not move by a byte.
const OLD_FIXTURE_HTML = 'c26b61ad4f1a6eb78b1028d8d11be6d3fb9193ca8b7edd2db96ab63cbe26b481';
const OLD_FIXTURE_HTML_FONTS = '81da1192cee9fe29cf4c2b3c56ac826866ebab3e5169b945baedc92c5d640c40';

/** The kit fixture with every C11 field (invented). */
function c11Model() {
  const m = fixture();
  const [d1, , d3] = m.days;
  Object.assign(d1, {
    start: { name: 'Northgate Halt', time: '07:15', lat: 50.1, lng: -4.2, maps_url: 'https://maps.example.com/northgate', note: 'Off the sleeper train.' },
    bags: { kind: 'locker', start: '07:20', end: '07:28', where: 'Northgate Halt' },
    sunset: '16:40',
    extras: [
      { kind: 'event', name: 'Harbour lights', time: '17:30', km: 0.4, note: 'Free, along the sea wall.', url: 'https://events.example.org/lights' },
      { kind: 'saved', name: 'Corran Arcade', place: 'corran-arcade', time: '18:00', km: 1.2 }
    ]
  });
  d1.legs.unshift({ from: 'day-start', to: 'lodging', mode: 'walk', minutes: 10, distance_m: 700, depart_at: '07:30', arrive_at: '07:40' });
  Object.assign(d1.stops[0], { last_entry: '16:00', minutes_source: 'official', crowd_slot: 'opening', booking_line: 'Book online the day before' });
  Object.assign(d1.stops[1], { minutes_source: 'estimate', crowd_slot: 'late', booking_line: 'Tickets at the gate' });
  const dinner = d1.meals.find((x) => x.kind === 'dinner');
  dinner.booking = 'Book 2 days ahead by phone';
  m.places['tide-museum'].facts = {
    checked: '2026-10-01', visit: 'about 60–90 min', last_entry: '4:00 pm', closed: 'Mondays', booking: 'Book online the day before',
    price: '€12 adult · includes the tide tower', payment: 'Card only', gate: 'North door',
    sources: [{ title: 'Tide Museum — visit', url: 'https://tide-museum.example.com/visit', accessed: '2026-10-01' }]
  };
  m.places['tide-museum'].flags = ['local_favourite'];
  m.places['brine-house'].facts = { checked: '2026-06-01', stale: true, price: '€30 set menu', menu: 'Fits vegetarian', menu_fits: 'yes', menu_checked: '2026-06-01', menu_stale: true };
  Object.assign(d3, { end: { name: 'Northgate Halt', time: '15:00' }, sunset: '16:38' });
  m.season = {
    checked: '2026-10-02', lead: 'Late autumn colour on the terraces.',
    weather: { text: 'Cool and bright, with sea fog some mornings.', high_c: 12, low_c: 6, rain_days: 11 },
    bloom: [{ label: 'Autumn leaves', from: '2026-11-01', to: '2026-11-20', status: 'peak', note: 'Best on the upper terraces.', url: 'https://gardens.example.com/leaves' }],
    events: [
      { name: 'Harbour lights', kind: 'light_up', from: '2026-11-10', to: '2026-11-15', start: '17:00', end: '21:00', area: 'Sea wall', url: 'https://events.example.org/lights' },
      { name: 'Foundry open night', kind: 'special_opening', from: '2026-11-13', to: '2026-11-13', place: 'glass-foundry', note: 'Glass blowing until late.' }
    ],
    sources: [{ title: 'Coast weather', url: 'https://weather.example.org/coast', accessed: '2026-10-02' }]
  };
  return m;
}
const errsAt = (errs, re) => errs.filter((e) => re.test(e.path));

test('a model with every C11 field validates and passes the semantic checks; the fixture alone does not use C11', async () => {
  const { validate, semanticErrors } = await kit();
  const { usesC11 } = await import('../kits/brochure/lib/model.mjs');
  const m = c11Model();
  assert.deepEqual(validate(m), []);
  assert.deepEqual(semanticErrors(m), []);
  assert.equal(usesC11(fixture()), false);
  assert.equal(usesC11(m), true);
  for (const add of [(x) => { x.season = c11Model().season; }, (x) => { x.days[0].sunset = '16:40'; }, (x) => { x.days[0].stops[0].crowd_slot = 'late'; }, (x) => { x.days[0].meals[2].booking = 'Book ahead'; }, (x) => { x.places.quillet.flags = ['crowd_magnet']; }]) {
    const one = fixture(); add(one);
    assert.equal(usesC11(one), true, 'any single C11 field switches the C11 styles on');
  }
});

test('an old model renders the same HTML byte for byte (hashes taken before WP-11d)', async () => {
  const { renderHtml } = await kit();
  assert.equal(sha(renderHtml(fixture(), { embedFonts: false }).html), OLD_FIXTURE_HTML);
  assert.equal(sha(renderHtml(fixture()).html), OLD_FIXTURE_HTML_FONTS);
  const plain = renderHtml(fixture(), { embedFonts: false }).html;
  for (const cls of ['ti-point', 'ti-bags', 'ti-evening', 'ti-dine', 'card-facts', 'sec-season', 'tag-fav']) assert.ok(!plain.includes(cls), `${cls} only appears with C11 fields`);
});

test('the C11 fields render in the kit\'s own components', async () => {
  const { renderHtml } = await kit();
  const { html, warnings } = renderHtml(c11Model(), { embedFonts: false });
  assert.deepEqual(warnings, []);
  // The day's real start, with its map link and note, then the timed bag step.
  assert.match(html, /<div class="ti ti-point ti-start"[^>]*>.*?7:15.*?<span class="ti-kind">Start<\/span> · Northgate Halt/s);
  assert.match(html, /Off the sleeper train\./);
  assert.match(html, /href="https:\/\/maps\.example\.com\/northgate"/);
  assert.match(html, /<div class="ti ti-leg ti-bags"[^>]*>.*?7:20.*?<b>Bags<\/b> · Bags in a locker at Northgate Halt/s);
  assert.match(html, /Walk<\/b> 10 min, 700 m from Northgate Halt to The Marram Inn/, 'a day-start leg names the start point and reaches the lodging');
  // The first stop: last entry, the visit length's source, the booking rule and the crowd note.
  assert.match(html, /last entry 4:00/);
  assert.match(html, /<span class="src">\(official site\)<\/span>/);
  assert.doesNotMatch(html, /ti-book">[^<]*<svg[^]*?<\/svg> Book online the day before/, 'a booked stop needs no booking rule');
  assert.match(html, /<p class="ti-meta ti-book">.*?Tickets at the gate<\/p>/);
  assert.match(html, /<span class="src">\(estimate\)<\/span>/);
  assert.match(html, /Go at opening; it gets busy later/);
  assert.match(html, /Late is quieter/);
  // The dinner card: booking, price, the menu line with its date and the stale mark.
  const dine = html.match(/<div class="ti ti-meal ti-dine".*?<\/div><\/div><\/div>/s);
  assert.ok(dine, 'a dinner with a booking line is a card');
  assert.match(dine[0], /Dinner<\/span> · The Brine House/);
  assert.match(dine[0], /Book 2 days ahead by phone/);
  assert.match(dine[0], /€30 set menu/);
  assert.match(dine[0], /Fits vegetarian · menu checked .*Jun.*<span class="stale">· check again<\/span>/);
  // This evening: sunset in the time column, then the extras with times, distances and links.
  const evenings = html.match(/<div class="ti ti-evening/g) || [];
  assert.equal(evenings.length, 1, 'day 3 leaves at 15:00, before its 16:38 sunset, so it has no evening row');
  assert.match(html, /This evening · sunset <b>4:40/);
  const rail1 = html.slice(html.indexOf('<div class="rail"'), html.indexOf('</section>', html.indexOf('<div class="rail"')));
  const box = rail1.indexOf('ti-evening');
  assert.ok(box > rail1.indexOf('Rookwell') && box < rail1.indexOf('ti-dine'), 'the box goes in at its sunset, in clock order');
  assert.ok(rail1.indexOf('ti-start') < rail1.indexOf('Breakfast'), 'the real start opens the rail');
  assert.match(html, /<b>Harbour lights<\/b>.*?400 m away.*?href="https:\/\/events\.example\.org\/lights"/s);
  assert.match(html, /<b>Corran Arcade<\/b>.*?1\.2 km away/s);
  // The day's end.
  assert.match(html, /<span class="ti-kind">End<\/span> · Northgate Halt/);
  // Place cards: facts block with the date checked, rows, sources; stale facts marked; the local favourite tag.
  const card = html.match(/<article[^>]*id="place-tide-museum".*?<\/article>/s) || html.match(/id="place-tide-museum".*?<\/article>/s);
  assert.ok(card, 'tide museum card');
  assert.match(card[0], /class="card-facts"/);
  assert.match(card[0], /Facts checked/i);
  for (const s of ['about 60–90 min', '4:00 pm', 'Mondays', '€12 adult · includes the tide tower', 'Card only', 'North door', 'Tide Museum — visit']) assert.ok(card[0].includes(esc(s)), s);
  assert.match(card[0], /tag-fav/);
  const brine = html.match(/id="place-brine-house".*?<\/article>/s);
  assert.match(brine[0], /class="stale"/, 'stale facts say so');
});
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

test('the season page follows the overview and comes before day 1, with weather, bloom, events and sources', async () => {
  const { renderHtml } = await kit();
  const { html } = renderHtml(c11Model(), { embedFonts: false });
  const at = (re) => html.search(re);
  const season = at(/<section class="sec sec-season"/), day1 = at(/<section class="sec sec-day"/);
  assert.ok(season > 0 && season < day1, 'season before the first day');
  const glance = at(/<section class="sec sec-glance/);
  assert.ok(glance > 0 && glance < season, 'season after the overview');
  const page = html.slice(season, day1);
  for (const s of ['Late autumn colour on the terraces.', 'Cool and bright', '12', '11', 'Autumn leaves', 'Best on the upper terraces.', 'Harbour lights', 'Sea wall', 'Foundry open night', 'Coast weather']) assert.ok(page.includes(s), s);
  assert.ok(page.indexOf('Harbour lights') < page.indexOf('Foundry open night'), 'events by date');
});

test('the schema rejects unknown keys in every new object and bad values in the new fields', async () => {
  const { validate } = await kit();
  const bogus = [
    ['/days/0/start', (m) => { m.days[0].start.bogus = 1; }],
    ['/days/0/bags', (m) => { m.days[0].bags.bogus = 1; }],
    ['/days/0/extras/0', (m) => { m.days[0].extras[0].bogus = 1; }],
    ['/places/tide-museum/facts', (m) => { m.places['tide-museum'].facts.bogus = 1; }],
    ['/places/tide-museum/facts/sources/0', (m) => { m.places['tide-museum'].facts.sources[0].bogus = 1; }],
    ['/season', (m) => { m.season.bogus = 1; }],
    ['/season/weather', (m) => { m.season.weather.bogus = 1; }],
    ['/season/bloom/0', (m) => { m.season.bloom[0].bogus = 1; }],
    ['/season/events/0', (m) => { m.season.events[0].bogus = 1; }]
  ];
  for (const [at, edit] of bogus) {
    const m = c11Model(); edit(m);
    const errs = validate(m);
    assert.ok(errs.some((e) => e.path === `${at}/bogus` || (e.path === at && /bogus|unknown/.test(e.message))), `${at}: ${JSON.stringify(errs)}`);
  }
  const bad = [
    [/\/days\/0\/bags\/kind/, (m) => { m.days[0].bags.kind = 'teleport'; }],
    [/\/days\/0\/extras/, (m) => { m.days[0].extras.push({ kind: 'event', name: 'A' }, { kind: 'event', name: 'B' }); }],
    [/\/days\/0\/extras\/0\/kind/, (m) => { m.days[0].extras[0].kind = 'party'; }],
    [/\/days\/0\/stops\/0\/minutes_source/, (m) => { m.days[0].stops[0].minutes_source = 'guess'; }],
    [/\/days\/0\/stops\/0\/crowd_slot/, (m) => { m.days[0].stops[0].crowd_slot = 'noon'; }],
    [/\/days\/0\/sunset/, (m) => { m.days[0].sunset = '25:00'; }],
    [/\/days\/0\/start/, (m) => { delete m.days[0].start.time; }],
    [/\/places\/tide-museum\/flags/, (m) => { m.places['tide-museum'].flags = ['tourist_trap']; }],
    [/\/places\/brine-house\/facts\/menu_fits/, (m) => { m.places['brine-house'].facts.menu_fits = 'mostly'; }],
    [/\/places\/brine-house\/facts/, (m) => { delete m.places['brine-house'].facts.checked; }],
    [/\/season\/weather\/rain_days/, (m) => { m.season.weather.rain_days = 40; }],
    [/\/season\/events\/0\/kind/, (m) => { m.season.events[0].kind = 'parade'; }]
  ];
  for (const [re, edit] of bad) {
    const m = c11Model(); edit(m);
    assert.ok(errsAt(validate(m), re).length > 0, `${re}: ${JSON.stringify(validate(m))}`);
  }
});

test('semantic checks cover the C11 references and date ranges', async () => {
  const { semanticErrors, prepare, ModelError } = await kit();
  const cases = [
    [/\/days\/0\/legs\/0\/from/, /needs the day's start/, (m) => { delete m.days[0].start; delete m.days[0].bags.where; }],
    [/\/days\/0\/extras\/1\/place/, /unknown place/, (m) => { m.days[0].extras[1].place = 'nowhere'; }],
    [/\/days\/0\/bags/, /ends before it starts/, (m) => { m.days[0].bags.end = '07:00'; }],
    [/\/season\/events\/0/, /ends before it starts/, (m) => { m.season.events[0].to = '2026-11-01'; }],
    [/\/season\/events\/1\/place/, /unknown place/, (m) => { m.season.events[1].place = 'nowhere'; }],
    [/\/season\/bloom\/0/, /ends before it starts/, (m) => { m.season.bloom[0].to = '2026-10-01'; }]
  ];
  for (const [at, msg, edit] of cases) {
    const m = c11Model(); edit(m);
    const errs = semanticErrors(m);
    assert.ok(errs.some((e) => at.test(e.path) && msg.test(e.message)), `${at}: ${JSON.stringify(errs)}`);
    assert.throws(() => prepare(m), ModelError);
  }
});

test('red team: markup in every new text field is escaped, javascript: links are dropped, long names are clipped', async () => {
  const { renderHtml, validate } = await kit();
  const X = '<script>alert(1)</script><img src=x onerror=alert(2)>';
  const JS = 'javascript:alert(3)';
  const m = c11Model();
  const d1 = m.days[0];
  d1.start.name = X; d1.start.note = X; d1.start.maps_url = JS;
  d1.bags.text = X;
  d1.extras[0].name = X; d1.extras[0].note = X; d1.extras[0].url = JS;
  d1.stops[1].booking_line = X;
  d1.meals.find((x) => x.kind === 'dinner').booking = X;
  m.days[2].end.name = 'E'.repeat(300);
  Object.assign(m.places['tide-museum'].facts, { visit: X, closed: X, gate: X, price: 'P'.repeat(300) });
  m.places['tide-museum'].facts.sources[0] = { title: X, url: JS };
  m.places['brine-house'].facts.menu = X;
  m.season.lead = X; m.season.weather.text = X;
  m.season.bloom[0].label = X; m.season.bloom[0].url = JS;
  m.season.events[0].name = X; m.season.events[0].url = JS;
  m.season.sources[0] = { title: X, url: JS };
  assert.deepEqual(validate(m), []);
  const { html, warnings } = renderHtml(m, { embedFonts: false });
  assert.deepEqual(warnings, []);
  assert.doesNotMatch(html, /<script|<img[\s>]/i);
  assert.doesNotMatch(html, /<[a-z][^>]*\sonerror=/i, 'no tag gained an event handler');
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'the text survives as visible, escaped text');
  assert.doesNotMatch(html, /javascript:/i, 'an unsafe link is not shown at all, not even as text');
  for (const [, u] of html.matchAll(/\s(?:src|href)="([^"]*)"/g)) assert.match(u, /^(data:image\/|data:font\/|#|https?:\/\/|mailto:)/, u);
  assert.ok(!/E{121}/.test(html), 'a 300-character end point is clipped to 120');
  assert.ok(!/P{201}/.test(html), 'a 300-character fact row is clipped to 200');
});

// The page budget is lib/paginate.mjs's: no block taller than a sheet (no warnings). A C11 trip may add the season page
// and one "continued" sheet per day whose rail gained C11 rows; nothing else (decisions/WP-11d.md).
test('the C11 trip prints within the page budget (no warnings; only the season page and day continuations added)', async () => {
  const { renderHtml, renderPdf, pdfAvailable } = await kit();
  if (!pdfAvailable()) return; // no Playwright/Chromium here (CI): the HTML tests above are the contract
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brochure-c11-'));
  for (const page of ['letter', 'a4']) {
    const plain = await renderPdf(renderHtml(fixture(), { page, embedFonts: false }).html, path.join(dir, `plain-${page}.pdf`));
    const c11 = await renderPdf(renderHtml(c11Model(), { page, embedFonts: false }).html, path.join(dir, `c11-${page}.pdf`));
    assert.deepEqual(c11.warnings, [], `${page}: ${c11.warnings.join('; ')}`);
    const grown = c11Model().days.filter((d) => d.start || d.end || d.bags || d.sunset || d.extras).length;
    assert.ok(c11.pages <= plain.pages + 1 + grown, `${page}: ${c11.pages} sheets vs ${plain.pages}`);
    assert.equal(fs.readFileSync(path.join(dir, `c11-${page}.pdf`)).subarray(0, 5).toString(), '%PDF-');
  }
});

// Developed by: LightAISolutions
