'use strict';
// kits/brochure — Contract C18 wave 3 (WP-18e): the Day book (`book: "day"`). One day as its own booklet — the day's
// cover, the day spread, that day's place cards, the sources — with the Day book caps (food and if-then up to 10) and
// the order inside a big stop (`stops[].inside`). Every older model renders byte for byte as before (hash pins below).
// Invented data only (fixtures/sample-day-book.json, the pack's invented samples).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DIR = path.resolve(__dirname, '..', 'kits', 'brochure', 'fixtures');
const load = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
const book = () => load('sample-day-book.json');
const kit = () => import('../kits/brochure/index.mjs');
const model = () => import('../kits/brochure/lib/model.mjs');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const errsAt = (errs, re) => errs.filter((e) => re.test(e.path));
const count = (s, re) => (s.match(re) || []).length;
/** The Day book fixture as a brochure: no `book`, no `number`, no `inside`. */
function asBrochure() {
  const m = book();
  delete m.book; delete m.days[0].number;
  for (const s of m.days[0].stops) delete s.inside;
  m.days[0].food = m.days[0].food.slice(0, 6); m.days[0].if_then = m.days[0].if_then.slice(0, 6);
  return m;
}

// Golden hashes (embedFonts:false). The first block was taken with the kit and the pack as they were before WP-18e
// (main at v01.80r) and again after it: the same bytes. c18b = the wave-2 kit fixture; c18pack-plain = the C18 pack
// sample as it is; c18bpack = the C18 pack sample with its briefing, clock 24h and temp both. The last block pins the
// Day book itself (the kit fixture and the pack's Day book sample).
const PINS = {
  'c18b-letter': '3fbb5c4461a3f4794a4a8bdd212f53381868039072778cdd1f32dde938d64a4c',
  'c18b-a4': 'a839d1c493c18013fb6aeac3c18f11887ad4541299aed52ca66d55d0fe5f0543',
  'c18pack-plain-letter': 'd8a1b4b7a4b2a1bc4216bf35bf368ee9ea630be1bc18ce16a50792270135685c',
  'c18pack-plain-a4': '25d70a4bd32da9fe7fc999cf90a28cdfe630dd31dfdbdf38c551ca2d3093d7ef',
  'c18bpack-letter': 'ea80d1fefc44d79a31360cb82a3fabfa6f3692f8b3b7d378c3ddb06b1afd949b',
  'c18bpack-a4': 'abe5cd2b0017a3062138fefb7f94fdfafc0979a2367b3a305f6d1e5c5e876004',
  'daybook-letter': 'dc68507e278e3e9c7ec6152bb984564367118b460ba39b0a1bbc51d3e74e0677',
  'daybook-a4': '17c9064c482f231333c49ee4dead894ba5de92b1b9dd74125da60079129c223f',
  'daybookpack-letter': '2ca79d7d5e11150eeed3fbdb496bb59a4494325c00c2b950105698cad3868c7a',
  'daybookpack-a4': 'ad72fddc6ee080da71edfcd7874ddb56e1675d3a01aac745d3bdef72bcdabe26'
};

test('older models render byte for byte as before WP-18e: the wave-2 kit fixture, the C18 pack sample with and without its briefing', async () => {
  const { renderHtml } = await kit();
  const bm = await import('../packs/tour-guide/brochure-map/index.mjs');
  const { sampleInputC18, C18_BRIEFING } = await import('../packs/tour-guide/brochure-map/brochure-map-sample-c18.mjs');
  for (const page of ['letter', 'a4']) {
    const opt = { embedFonts: false, page };
    assert.equal(sha(renderHtml(load('sample-trip-c18b.json'), opt).html), PINS[`c18b-${page}`], `c18b ${page}`);
    assert.equal(sha(bm.renderPlan(sampleInputC18(), opt).html), PINS[`c18pack-plain-${page}`], `C18 pack sample ${page}`);
    const s = sampleInputC18(); s.options = { ...s.options, clock: '24h', temp: 'both', briefing: JSON.parse(JSON.stringify(C18_BRIEFING)) };
    const r = bm.renderPlan(s, opt);
    assert.equal(sha(r.html), PINS[`c18bpack-${page}`], `C18 pack sample with its briefing ${page}`);
    assert.deepEqual(r.warnings, []);
  }
});

test('the Day book renders as pinned (the kit fixture and the pack sample), with no warnings', async () => {
  const { renderHtml } = await kit();
  const bm = await import('../packs/tour-guide/brochure-map/index.mjs');
  const { sampleInputDayBook } = await import('../packs/tour-guide/brochure-map/brochure-map-sample-daybook.mjs');
  for (const page of ['letter', 'a4']) {
    const opt = { embedFonts: false, page };
    const k = renderHtml(book(), opt);
    assert.equal(sha(k.html), PINS[`daybook-${page}`], `kit Day book ${page}`);
    assert.deepEqual(k.warnings, []);
    const p = bm.renderPlan(sampleInputDayBook(), opt);
    assert.equal(sha(p.html), PINS[`daybookpack-${page}`], `pack Day book ${page}`);
    assert.deepEqual(p.warnings, []);
  }
});

test('the fixture validates and passes the semantic checks; the book is "day", the caps are the Day book caps', async () => {
  const { validate, semanticErrors, prepare } = await kit();
  const { isDayBook, usesC18, briefCaps } = await model();
  const m = book();
  assert.deepEqual(validate(m), []);
  assert.deepEqual(semanticErrors(m), []);
  assert.equal(isDayBook(m), true);
  assert.equal(isDayBook(load('sample-trip-c18b.json')), false);
  assert.equal(usesC18(m), true);
  assert.equal(m.days.length, 1);
  assert.ok(m.days[0].food.length > 6 && m.days[0].food.length <= briefCaps('day').food, 'more food than a brochure holds');
  assert.ok(m.days[0].if_then.length > 6 && m.days[0].if_then.length <= briefCaps('day').if_then, 'more if-thens than a brochure holds');
  assert.ok(m.days[0].stops.some((s) => Array.isArray(s.inside) && s.inside.length > 1));
  const p = prepare(m);
  assert.equal(p.book, 'day');
  assert.equal(p.c18, true);
  assert.equal(p.days[0].index, m.days[0].number, 'the day keeps its number in the trip');
  assert.equal(prepare(asBrochure()).book, 'brochure');
  assert.equal(prepare(asBrochure()).days[0].index, 1);
});

test('the schema: book is "brochure" or "day"; number 1–31; inside is 1–10 steps of {time?, text}, nothing else', async () => {
  const { validate } = await kit();
  const ok = book(); ok.book = 'brochure'; delete ok.days[0].number; for (const s of ok.days[0].stops) delete s.inside;
  assert.deepEqual(validate(ok), []);
  const big = book().days[0].stops.findIndex((s) => s.inside);
  const at = `/days/0/stops/${big}/inside`;
  const bad = [
    [/^\/book$/, (m) => { m.book = 'pamphlet'; }],
    [/^\/days\/0\/number$/, (m) => { m.days[0].number = 0; }],
    [/^\/days\/0\/number$/, (m) => { m.days[0].number = 32; }],
    [/^\/days\/0\/number$/, (m) => { m.days[0].number = 2.5; }],
    [new RegExp(`^${at}$`), (m) => { m.days[0].stops[big].inside = []; }],
    [new RegExp(`^${at}$`), (m) => { m.days[0].stops[big].inside = Array(11).fill({ text: 'A step' }); }],
    [new RegExp(`^${at}/0$`), (m) => { delete m.days[0].stops[big].inside[0].text; }],
    [new RegExp(`^${at}/0/text$`), (m) => { m.days[0].stops[big].inside[0].text = ''; }],
    [new RegExp(`^${at}/0/text$`), (m) => { m.days[0].stops[big].inside[0].text = 'x'.repeat(161); }],
    [new RegExp(`^${at}/0/time$`), (m) => { m.days[0].stops[big].inside[0].time = '9.30'; }],
    [new RegExp(`^${at}/0/bogus$`), (m) => { m.days[0].stops[big].inside[0].bogus = 1; }],
    [/^\/days\/0\/food$/, (m) => { m.days[0].food = Array(11).fill(m.days[0].food[0]); }],
    [/^\/days\/0\/if_then$/, (m) => { m.days[0].if_then = Array(11).fill({ if: 'a', then: 'b' }); }]
  ];
  for (const [re, edit] of bad) {
    const m = book(); edit(m);
    assert.ok(errsAt(validate(m), re).length > 0, `${re}: ${JSON.stringify(validate(m))}`);
  }
});

test('semantic checks: one day; number and inside only in a Day book; inside in time order and within the stop; caps per book', async () => {
  const { semanticErrors, prepare, ModelError } = await kit();
  const big = book().days[0].stops.findIndex((s) => s.inside);
  const at = `/days/0/stops/${big}/inside`;
  const two = (m) => { const d = JSON.parse(JSON.stringify(m.days[0])); d.date = '2027-05-16'; delete d.number; m.days.push(d); };
  const cases = [
    [/^\/days$/, /exactly one day \(got 2\)/, two],
    [/^\/days\/0\/number$/, /for the Day book/, (m) => { delete m.book; for (const s of m.days[0].stops) delete s.inside; m.days[0].food.length = 6; m.days[0].if_then.length = 6; }],
    [new RegExp(`^${at}$`), /inside is for the Day book/, (m) => { m.book = 'brochure'; delete m.days[0].number; m.days[0].food.length = 6; m.days[0].if_then.length = 6; }],
    [new RegExp(`^${at}/2/time$`), /time order/, (m) => { m.days[0].stops[big].inside[2].time = m.days[0].stops[big].inside[0].time; m.days[0].stops[big].inside[1].time = '11:00'; }],
    [new RegExp(`^${at}/0/time$`), /outside the stop/, (m) => { m.days[0].stops[big].inside[0].time = '09:00'; }],
    [new RegExp(`^${at}/\\d+/time$`), /outside the stop/, (m) => { const s = m.days[0].stops[big]; s.inside.push({ time: '23:00', text: 'Too late' }); s.inside = s.inside.slice(-10); }],
    [/^\/days\/0\/food$/, /at most 6 items/, (m) => { delete m.book; delete m.days[0].number; for (const s of m.days[0].stops) delete s.inside; }]
  ];
  for (const [re, msg, edit] of cases) {
    const m = book(); edit(m);
    const errs = semanticErrors(m);
    assert.ok(errs.some((e) => re.test(e.path) && msg.test(e.message)), `${re} ${msg}: ${JSON.stringify(errs)}`);
    assert.throws(() => prepare(m), ModelError);
  }
  const untimed = book(); for (const x of untimed.days[0].stops[big].inside) delete x.time;
  assert.deepEqual(semanticErrors(untimed), [], 'untimed steps are fine');
  const edge = book(); const s = edge.days[0].stops[big];
  s.inside[0].time = s.arrive; s.inside[1].time = s.arrive; // the arrival itself, twice: in order and within the stop
  assert.deepEqual(semanticErrors(edge), []);
});

test('render: the day cover, the day, that day\'s cards, the sources — and nothing trip-wide; the title names the day', async () => {
  const { renderHtml } = await kit();
  const m = book();
  const { html, warnings } = renderHtml(m, { embedFonts: false });
  assert.deepEqual(warnings, []);
  assert.deepEqual([...html.matchAll(/<section class="(sec [^"]*)"/g)].map((x) => x[1]), ['sec sec-cover sec-cover-day', 'sec sec-day', 'sec sec-cards', 'sec sec-attr']);
  assert.ok(html.includes('<title>Harrowmere in four days — Day book, Saturday, May 15, 2027</title>'));
  assert.ok(html.includes('<div class="cover-days"><span class="cd-k">Day</span><b>3</b>Saturday<br>May 15</div>'), 'the corner names the day by its number in the trip');
  assert.ok(html.includes('<p class="eyebrow"><b>Day book</b> · Harrowmere · Brindalia · prepared for the Harrowmere sample family</p>'));
  assert.ok(/<dl class="cover-facts"><div><dt>Date<\/dt><dd>Saturday, May 15, 2027<\/dd><\/div><div><dt>Day runs<\/dt><dd>07:45 – 20:45<\/dd>/.test(html));
  assert.ok(html.includes('data-tab="Day 3"'), 'the day spread is Day 3');
  assert.ok(html.includes('<p class="sec-meta">Numbers match the timeline</p>'));
  assert.equal(count(html, /<article class="card[ "]/g), Object.keys(m.places).length, 'one card per place of the day');
  assert.ok(!html.includes('class="sec sec-glance"') && !html.includes('class="sec sec-later"') && !html.includes('class="sec sec-practical"') && !html.includes('class="sec sec-season"'));
  // The order inside the big stop: every step, in order, the untimed one with an empty time cell.
  const big = m.days[0].stops.find((s) => s.inside);
  const list = html.slice(html.indexOf('<div class="ti-inside">'));
  assert.ok(list.startsWith('<div class="ti-inside"><p class="in-h">Inside, in order</p><ol class="in-list">'));
  assert.equal(count(list.slice(0, list.indexOf('</ol>')), /<li>/g), big.inside.length);
  assert.ok(list.includes(`<li><span class="in-t">${big.inside[0].time}</span><span class="in-x">${big.inside[0].text}</span></li>`));
  assert.ok(list.includes('<li><span class="in-t"></span>'), 'an untimed step');
  assert.equal(count(html, /<div class="ti-inside">/g), m.days[0].stops.filter((s) => s.inside).length);
  // Food and if-then at the Day book caps: all of them render.
  assert.equal(count(html, /<td class="fd-d">/g), m.days[0].food.length);
  assert.equal(count(html, /<div class="it-row">/g), m.days[0].if_then.length);
});

test('the Day book styles (C18D) are added only to a Day book; a brochure of the same day has no inside list', async () => {
  const { renderHtml } = await kit();
  const dayCss = '.sec-cover-day .cd-k{';
  assert.ok(renderHtml(book(), { embedFonts: false }).html.includes(dayCss));
  for (const f of ['sample-trip.json', 'sample-trip-c18.json', 'sample-trip-c18b.json']) {
    const h = renderHtml(load(f), { embedFonts: false }).html;
    assert.ok(!h.includes(dayCss) && !h.includes('.ti-inside{'), f);
  }
  const h = renderHtml(asBrochure(), { embedFonts: false }).html;
  assert.ok(!h.includes('ti-inside') && !h.includes('sec-cover-day'));
  assert.ok(h.includes('class="sec sec-glance"'), 'a brochure keeps its glance page');
});

test('a Day book made from a brochure model: the trip-wide sections are left out with a warning each; only the day\'s cards', async () => {
  const { renderHtml, prepare } = await kit();
  const m = load('sample-trip-c18b.json');
  m.book = 'day'; m.days = [m.days[1]]; m.days[0].number = 2;
  const { html, warnings } = renderHtml(m, { embedFonts: false });
  for (const k of ['season', 'later', 'practical']) assert.ok(warnings.some((w) => w.startsWith(`day book: ${k} left out`)), `${k}: ${JSON.stringify(warnings)}`);
  assert.equal(warnings.length, 3);
  assert.ok(!html.includes('class="sec sec-season"') && !html.includes('class="sec sec-later"') && !html.includes('class="sec sec-practical"'));
  const p = prepare(m);
  assert.ok(p.cards.every((c) => c.day === 2), 'every card is the Day book\'s day');
  assert.equal(count(html, /<article class="card[ "]/g), p.cards.length);
  assert.ok(html.includes('data-tab="Day 2"'));
});

test('the Day book prints with no paginator warnings (letter and A4) when Playwright is present', async (t) => {
  const { renderHtml, renderPdf, pdfAvailable } = await kit();
  if (!pdfAvailable()) { t.skip('Playwright/Chromium not available'); return; }
  const bm = await import('../packs/tour-guide/brochure-map/index.mjs');
  const { sampleInputDayBook } = await import('../packs/tour-guide/brochure-map/brochure-map-sample-daybook.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'c18e-'));
  try {
    for (const page of ['letter', 'a4']) {
      for (const [name, html] of [['kit', renderHtml(book(), { embedFonts: false, page }).html], ['pack', bm.renderPlan(sampleInputDayBook(), { embedFonts: false, page }).html]]) {
        const r = await renderPdf(html, path.join(dir, `daybook-${name}-${page}.pdf`), { page });
        assert.deepEqual(r.warnings, [], `${name} ${page}`);
        assert.ok(r.pages >= 4 && r.pages <= 8, `${name} ${page}: ${r.pages} pages`);
      }
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// Developed by: LightAISolutions
