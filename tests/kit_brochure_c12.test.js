'use strict';
// kits/brochure — Contract C12 (WP-12d): a day re-planned from where you are. A stop's `visited: true` renders as done
// (a tick, muted, still in order, also on the glance page); the reserved leg start `here` reads "from where you were",
// its link has no origin and no coordinate of that point exists anywhere; `here` may not end a leg; a place keyed
// `here` keeps meaning that place; and a model without either field gets no C12 rules. Invented data only.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FIXTURE = path.resolve(__dirname, '..', 'kits', 'brochure', 'fixtures', 'sample-trip.json');
const fixture = () => JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
const kit = () => import('../kits/brochure/index.mjs');

/** Day 1 of the kit fixture re-planned at 11:40 from a shared location after the first stop. */
function replanned({ withUrl = false } = {}) {
  const m = fixture();
  const d = m.days[0];
  d.stops[0].visited = true;
  const leg = d.legs.find((l) => l.from === 'tide-museum');
  leg.from = 'here';
  leg.depart_at = '11:40'; leg.arrive_at = '11:44'; leg.minutes = 4;
  if (withUrl) leg.maps_url = 'https://www.google.com/maps/dir/?api=1&destination=Lantern%20Quay%20Market&travelmode=walking';
  else delete leg.maps_url;
  return m;
}
const legRowOf = (html, text) => (html.split('\n').join(' ').match(new RegExp(`<div class="ti ti-leg"(?:(?!<div class="ti ).)*?${text}(?:(?!<div class="ti ).)*`)) || [''])[0];

test('schema: a stop takes visited: true only; a leg takes from: "here"; unknown keys are still refused', async () => {
  const { validate } = await kit();
  assert.deepEqual(validate(replanned()), []);
  for (const bad of [false, 'yes', 1]) {
    const m = replanned(); m.days[0].stops[0].visited = bad;
    assert.ok(validate(m).some((e) => e.path === '/days/0/stops/0/visited'), String(bad));
  }
  const m = replanned(); m.days[0].stops[0].done = true;
  assert.ok(validate(m).some((e) => /done/.test(e.path + e.message)));
});

test('a leg from "here" reads "from where you were"; its kit-made link has no origin and no coordinate', async () => {
  const { renderHtml, prepare } = await kit();
  const p = prepare(replanned());
  const leg = p.days[0].legs.find((l) => l.from === 'here');
  assert.deepEqual(leg.fromPoint, { name: 'where you were', here: true });
  assert.equal(leg.fromPlace, null);
  assert.equal(leg.start, 11 * 60 + 40);
  const q = new URL(leg.directions_url).searchParams;
  assert.equal(q.get('origin'), null); assert.equal(q.get('origin_place_id'), null);
  assert.equal(q.get('destination'), '47.3151,-22.8041');
  assert.equal(q.get('travelmode'), 'walking');
  const { html } = renderHtml(replanned(), { embedFonts: false });
  const row = legRowOf(html, 'where you were');
  assert.match(row, /<b>Walk<\/b> 4 min, [^<]* from where you were to Lantern Quay Market/);
  assert.doesNotMatch(row, /origin/);
  // the planner's own origin-less link is kept as given
  const own = legRowOf(renderHtml(replanned({ withUrl: true }), { embedFonts: false }).html, 'where you were');
  assert.match(own, /href="https:\/\/www\.google\.com\/maps\/dir\/\?api=1&amp;destination=Lantern%20Quay%20Market&amp;travelmode=walking"/);
});

test('"here" may only start a leg; a place keyed "here" is that place, not the reserved point', async () => {
  const { semanticErrors, prepare } = await kit();
  const m = replanned(); m.days[0].legs[0].to = 'here';
  assert.deepEqual(semanticErrors(m).map((e) => e.path), ['/days/0/legs/0/to']);
  assert.match(semanticErrors(m)[0].message, /only start a leg/);
  const k = fixture();
  k.places.here = { ...k.places['tide-museum'], name: 'Here Gallery' };
  k.days[0].legs[1].from = 'here';
  assert.deepEqual(semanticErrors(k), []);
  const leg = prepare(k).days[0].legs[1];
  assert.equal(leg.fromPlace.name, 'Here Gallery');
  assert.equal(leg.fromPoint, null);
});

test('visited stops render as done, quietly and in order, on the rail and on the glance page', async () => {
  const { renderHtml } = await kit();
  const { html } = renderHtml(replanned(), { embedFonts: false });
  const rows = html.match(/<div class="ti ti-stop[^"]*" data-pg="block">.*?<span class="badge">\d+<\/span>/g).slice(0, 4);
  assert.deepEqual(rows.map((r) => r.match(/badge">(\d+)/)[1]), ['1', '2', '3', '4'], 'numbering unchanged');
  assert.match(rows[0], /class="ti ti-stop ti-done"/);
  assert.ok(rows.slice(1).every((r) => !/ti-done/.test(r)));
  assert.match(html, /<h3 class="ti-name">Museum of Tide &amp; Trade<span class="chip hue">booked<\/span><span class="chip tag-done">✓ visited<\/span><\/h3>/);
  assert.equal((html.match(/✓ visited/g) || []).length, 2, 'the rail and the glance list, once each');
  assert.match(html, /<li class="isdone"><span class="n">1<\/span><span>Museum of Tide &amp; Trade <span class="done-tick">✓ visited<\/span><\/span>/);
  assert.match(html, /<\/li><li><span class="n">2<\/span><span>Lantern Quay Market<\/span>/, 'the next stop is not marked');
  for (const rule of ['.ti-done .ti-name', '.chip.tag-done', '.gday-stops li.isdone']) assert.ok(html.includes(rule), rule);
});

test('a model without visited or here: no C12 rules, no tick, the same HTML whether or not the kit knows C12', async () => {
  const { renderHtml } = await kit();
  const { usesC12 } = await import('../kits/brochure/lib/model.mjs');
  const { stylesheet } = await import('../kits/brochure/lib/css.mjs');
  const m = fixture();
  assert.equal(usesC12(m), false);
  assert.equal(usesC12(replanned()), true);
  const k = fixture(); k.places.here = { ...k.places['tide-museum'] }; k.days[0].legs[1].from = 'here';
  assert.equal(usesC12(k), false, 'a place keyed "here" is not the reserved point');
  const { html } = renderHtml(m, { embedFonts: false });
  assert.doesNotMatch(html, /ti-done|tag-done|isdone|where you were/);
  assert.ok(!stylesheet({ c11: true }).includes('.ti-done'));
  assert.ok(stylesheet({ c12: true }).includes('.ti-done'));
});

test('the phone clock: at 390 px every rail time is whole, inside its column and clear of the badge', async (t) => {
  const { renderHtml, pdfAvailable } = await kit();
  if (!pdfAvailable()) { t.skip('no global Playwright/Chromium here; the CSS rule is pinned by the golden hashes'); return; }
  const { launch } = await import('../kits/brochure/lib/pdf.mjs');
  const browser = await launch();
  try {
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    await page.setContent(renderHtml(replanned(), { embedFonts: true }).html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const cells = await page.evaluate(() => [...document.querySelectorAll('.rail .ti-time .t')].map((t) => {
      const r = document.createRange(); r.selectNodeContents(t);
      const tr = r.getBoundingClientRect(), cell = t.parentElement.getBoundingClientRect();
      const mark = t.closest('.ti').querySelector('.ti-mark > *').getBoundingClientRect();
      return { text: t.textContent, lines: tr.height / parseFloat(getComputedStyle(t).lineHeight), inside: tr.left >= cell.left - 0.5 && tr.right <= cell.right + 0.5, clear: tr.right <= mark.left };
    }));
    assert.ok(cells.some((c) => /^1[0-2]:\d\d[ap]m$/.test(c.text)), 'the fixture has two-digit hours');
    for (const c of cells) {
      assert.ok(c.inside, `${c.text} fits its column`);
      assert.ok(c.clear, `${c.text} does not run under the badge`);
      assert.ok(c.lines < 1.5, `${c.text} is on one line`);
    }
  } finally { await browser.close(); }
});

// Developed by: LightAISolutions
