'use strict';
// kits/brochure — Contract C18 wave 2 (WP-18d): the written briefing — lead, key-time tiles, the glance row (contents),
// food on the route, if-then and the bail-out, why this plan, the day kit — validates, is refused with unknown keys or
// bad values, passes its semantic checks, renders in the kit's components, and leaves every older model byte for byte
// as before (hash pins below). Invented data only (fixtures/sample-trip-c18b.json, the pack's invented samples).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DIR = path.resolve(__dirname, '..', 'kits', 'brochure', 'fixtures');
const load = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
const plain = () => load('sample-trip.json');
const c18 = () => load('sample-trip-c18.json');
const c18b = () => load('sample-trip-c18b.json');
const kit = () => import('../kits/brochure/index.mjs');
const model = () => import('../kits/brochure/lib/model.mjs');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const errsAt = (errs, re) => errs.filter((e) => re.test(e.path));
/** The rendered HTML cut into its day sections (index 0 is everything before day 1). */
const days = (html) => html.split('class="sec sec-day');
const count = (s, re) => (s.match(re) || []).length;
const WAVE2 = ['lead', 'key_times', 'contents', 'food', 'if_then', 'bail_out', 'why', 'kit'];

// Golden hashes (embedFonts:false), taken with the kit and the pack as they were before WP-18d (main at v01.79r) and
// again after it: the same bytes. c12 = the plain fixture with day 1's first stop visited and the leg from it starting
// 'here'; c11pack / c18pack = brochure-map's invented samples (c18pack with clock 24h and temp both, no briefing).
const PINS = {
  'plain-letter': '1d9ab32bd321a8e043b4066672aa798290ea3480af8075469d848a03a26474d7',
  'plain-a4': 'b4f44a7eaf23bdee08a3ce662c018aa98dd3ea82d18afb1b7446b40e1810b705',
  'de-letter': '34ab6de0bf0de373a59c1236c66a338c41fe4fe0aa68450f2ebce30e394ec7d4',
  'de-a4': '1fe7da5e8230da72363ce1a94d28db07fd6bf252a7072775e60f17e54e828339',
  'c12-letter': '4ec19225e03af0e2a5749756cf5a2c50919ff47d3254ddf8392b7635f7c3482b',
  'c12-a4': 'dbe3a1544d15357b3c89511692a83dd9e2135502578d8cdcd44abe58dfeb84c9',
  'c18kit-letter': '07f637e0c907369219948dbcf1fedbd31e259ea2f16cde196affe276b44dfaf1',
  'c18kit-a4': '456d084154d875980a1fc720c7dd271a90934c1117d485910d29211556b2cdc5',
  'c11pack-letter': '6cc55849cf21cf4c978104fcddd4e09b340e9066d3d226509dc2c4676488274c',
  'c11pack-a4': 'b84068a6e2b645fab77f47e1ebc20ab5c42c44abbeff0c9792bd2358fd3673fb',
  'c18pack-letter': '1957d0129150662b09ec26652de704077ffc3f03b3096b005913c0caa976b992',
  'c18pack-a4': 'c0481b97fda69d5f14400935e1da18593f3f3f08bd103bfb2d5a1a151a484fac'
};

/** The C18 wave-2 fixture with every wave-2 field deleted: the wave-1 fixture again. */
function stripped() {
  const m = c18b();
  for (const d of m.days) for (const k of WAVE2) delete d[k];
  return m;
}

test('older models render byte for byte as before WP-18d: plain, de-DE, C12, the wave-1 C18 fixture, the C11 and C18 pack samples', async () => {
  const { renderHtml } = await kit();
  const bm = await import('../packs/tour-guide/brochure-map/index.mjs');
  const { sampleInputC11 } = await import('../packs/tour-guide/brochure-map/brochure-map-sample-c11.mjs');
  const { sampleInputC18 } = await import('../packs/tour-guide/brochure-map/brochure-map-sample-c18.mjs');
  for (const page of ['letter', 'a4']) {
    const opt = { embedFonts: false, page };
    assert.equal(sha(renderHtml(plain(), opt).html), PINS[`plain-${page}`], `plain ${page}`);
    const de = plain(); de.trip.locale = 'de-DE';
    assert.equal(sha(renderHtml(de, opt).html), PINS[`de-${page}`], `de-DE ${page}`);
    const c12 = plain(); const d = c12.days[0]; d.stops[0].visited = true;
    const leg = d.legs.find((l) => l.from === 'tide-museum');
    Object.assign(leg, { from: 'here', depart_at: '11:40', arrive_at: '11:44', minutes: 4 }); delete leg.maps_url;
    assert.equal(sha(renderHtml(c12, opt).html), PINS[`c12-${page}`], `c12 ${page}`);
    assert.equal(sha(renderHtml(c18(), opt).html), PINS[`c18kit-${page}`], `wave-1 C18 fixture ${page}`);
    assert.equal(sha(renderHtml(stripped(), opt).html), PINS[`c18kit-${page}`], `wave-2 fixture stripped of wave 2 ${page}`);
    assert.equal(sha(bm.renderPlan(sampleInputC11(), opt).html), PINS[`c11pack-${page}`], `C11 pack sample ${page}`);
    const s = sampleInputC18(); s.options = { ...s.options, clock: '24h', temp: 'both' };
    const r = bm.renderPlan(s, opt);
    assert.equal(sha(r.html), PINS[`c18pack-${page}`], `C18 pack sample ${page}`);
    assert.deepEqual(r.warnings, []);
  }
});

test('the wave-2 fixture validates and passes the semantic checks; usesC18Brief sees it, and each field alone switches C18 on', async () => {
  const { validate, semanticErrors, prepare } = await kit();
  const { usesC18, usesC18Brief, C18_BRIEF } = await model();
  assert.deepEqual(C18_BRIEF, WAVE2);
  const m = c18b();
  assert.deepEqual(validate(m), []);
  assert.deepEqual(semanticErrors(m), []);
  assert.equal(usesC18Brief(m), true);
  assert.equal(prepare(m).c18, true);
  assert.equal(usesC18Brief(c18()), false);
  assert.equal(usesC18Brief(plain()), false);
  const one = {
    lead: 'The one thing to get right.', key_times: [{ label: 'Entry', time: '09:30' }], contents: 'Museum first',
    food: [{ name: 'Quillet\'s', dish: 'Broth', fits: 'lunch' }], if_then: [{ if: 'Rain', then: 'The arcade' }],
    bail_out: 'Back to the inn.', why: ['Timed entry first.'], kit: { items: ['A layer'] }
  };
  for (const k of WAVE2) {
    const p = plain(); p.days[0][k] = one[k];
    assert.equal(usesC18Brief(p), true, k);
    assert.equal(usesC18(p), true, k);
    assert.deepEqual(validate(p), [], k);
  }
});

test('the caps are constants (BRIEF_CAPS.brochure) and the kit schema says the same', async () => {
  const { BRIEF_CAPS, briefCaps } = await model();
  const { loadSchema } = await import('../kits/brochure/lib/validate.mjs');
  const s = loadSchema(), day = s.$defs.day.properties, caps = BRIEF_CAPS.brochure;
  assert.ok(Object.isFrozen(BRIEF_CAPS) && Object.isFrozen(caps));
  assert.equal(briefCaps('brochure'), caps);
  assert.equal(briefCaps('nonesuch'), caps, 'an unknown book uses the brochure caps');
  assert.equal(day.key_times.maxItems, caps.key_times);
  // food and if_then: the schema allows the largest cap over the books (the Day book's 10); the per-book cap is semantic.
  const most = (k) => Math.max(...Object.values(BRIEF_CAPS).map((c) => c[k]));
  assert.equal(day.food.maxItems, most('food'));
  assert.equal(day.if_then.maxItems, most('if_then'));
  assert.equal(caps.food, 6);
  assert.equal(caps.if_then, 6);
  assert.equal(caps.inside, 0, 'no order inside a stop in a brochure');
  const dc = briefCaps('day');
  assert.ok(Object.isFrozen(dc));
  assert.deepEqual([dc.food, dc.if_then, dc.inside], [10, 10, 10]);
  for (const k of Object.keys(caps)) if (!['food', 'if_then', 'inside'].includes(k)) assert.equal(dc[k], caps[k], `day book ${k}`);
  assert.equal(day.why.maxItems, caps.why);
  assert.equal(day.lead.maxLength, caps.lead);
  assert.equal(day.contents.maxLength, caps.contents);
  assert.equal(day.bail_out.maxLength, caps.bail_out);
  assert.equal(s.$defs.keyTime.properties.label.maxLength, caps.label);
  assert.equal(s.$defs.foodItem.properties.price.maxLength, caps.price);
  assert.equal(s.$defs.line.maxLength, caps.line);
  const kitp = s.$defs.dayKit.properties;
  assert.equal(kitp.items.maxItems, caps.kit_items);
  assert.equal(kitp.closures.maxItems, caps.kit_closures);
  assert.equal(kitp.not_missing.maxItems, caps.kit_not_missing);
  const pack = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'packs', 'tour-guide', 'schemas', 'tour-guide-briefing.schema.json'), 'utf8'));
  const pd = pack.$defs.day.properties;
  assert.deepEqual([pd.key_times.maxItems, pd.food.maxItems, pd.if_then.maxItems, pd.why.maxItems, pd.lead.maxLength, pd.contents.maxLength, pd.bail_out.maxLength, pd.theme.maxLength],
    [caps.key_times, dc.food, dc.if_then, caps.why, caps.lead, caps.contents, caps.bail_out, caps.theme], 'the pack briefing schema uses the same caps (food, if_then at the largest)');
});

test('the schema refuses unknown keys and bad values in every wave-2 field', async () => {
  const { validate } = await kit();
  const at = (m, p) => p.split('/').slice(1).reduce((o, k) => o[k], m);
  for (const p of ['/days/0/key_times/0', '/days/0/food/0', '/days/0/if_then/0', '/days/0/kit', '/days/0/kit/weather']) {
    const m = c18b(); at(m, p).bogus = 1;
    const errs = validate(m);
    assert.ok(errs.some((e) => e.path === `${p}/bogus`), `${p}: ${JSON.stringify(errs)}`);
  }
  const line = 'x'.repeat(161);
  const bad = [
    [/\/days\/0\/lead/, (m) => { m.days[0].lead = 'x'.repeat(241); }],
    [/\/days\/0\/contents/, (m) => { m.days[0].contents = 'x'.repeat(81); }],
    [/\/days\/0\/bail_out/, (m) => { m.days[0].bail_out = 'x'.repeat(241); }],
    [/\/days\/0\/key_times$/, (m) => { m.days[0].key_times.push({ label: 'Fifth', time: '22:00' }); }],
    [/\/days\/0\/key_times\/0\/label/, (m) => { m.days[0].key_times[0].label = 'x'.repeat(31); }],
    [/\/days\/0\/key_times\/0\/label/, (m) => { m.days[0].key_times[0].label = ''; }],
    [/\/days\/0\/key_times\/0\/time/, (m) => { m.days[0].key_times[0].time = '7.15'; }],
    [/\/days\/0\/key_times\/0/, (m) => { delete m.days[0].key_times[0].time; }],
    [/\/days\/0\/food$/, (m) => { m.days[0].food = Array(11).fill(m.days[0].food[0]); }],
    [/\/days\/0\/food\/0/, (m) => { delete m.days[0].food[0].dish; }],
    [/\/days\/0\/food\/0\/fits/, (m) => { m.days[0].food[0].fits = line; }],
    [/\/days\/0\/food\/0\/price/, (m) => { m.days[0].food[0].price = 'x'.repeat(61); }],
    [/\/days\/0\/food\/0\/place/, (m) => { m.days[0].food[0].place = 'not a key!'; }],
    [/\/days\/0\/if_then$/, (m) => { m.days[0].if_then = Array(11).fill({ if: 'a', then: 'b' }); }],
    [/\/days\/0\/if_then\/0/, (m) => { delete m.days[0].if_then[0].then; }],
    [/\/days\/0\/why$/, (m) => { m.days[0].why = Array(5).fill('Because.'); }],
    [/\/days\/0\/why\/0/, (m) => { m.days[0].why[0] = line; }],
    [/\/days\/0\/kit\/weather/, (m) => { delete m.days[0].kit.weather.low_c; }],
    [/\/days\/0\/kit\/weather\/high_c/, (m) => { m.days[0].kit.weather.high_c = 70; }],
    [/\/days\/0\/kit\/weather\/rain_pct/, (m) => { m.days[0].kit.weather.rain_pct = 101; }],
    [/\/days\/0\/kit\/weather\/rain_pct/, (m) => { m.days[0].kit.weather.rain_pct = 40.5; }],
    [/\/days\/0\/kit\/items/, (m) => { m.days[0].kit.items = Array(7).fill('A layer'); }],
    [/\/days\/0\/kit\/closures/, (m) => { m.days[0].kit.closures = Array(5).fill('Closed'); }],
    [/\/days\/0\/kit\/not_missing/, (m) => { m.days[0].kit.not_missing = Array(5).fill('Fine'); }]
  ];
  for (const [re, edit] of bad) {
    const m = c18b(); edit(m);
    assert.ok(errsAt(validate(m), re).length > 0, `${re}: ${JSON.stringify(validate(m))}`);
  }
});

test('semantic checks: key times in time order, a food place is a known place, the weather low not above the high', async () => {
  const { semanticErrors, prepare, ModelError } = await kit();
  const cases = [
    [/^\/days\/0\/key_times\/2\/time$/, /time order/, (m) => { m.days[0].key_times[2].time = '08:00'; }],
    [/^\/days\/0\/food\/1\/place$/, /unknown place/, (m) => { m.days[0].food[1].place = 'nowhere'; }],
    [/^\/days\/0\/kit\/weather\/low_c$/, /low is above the high/, (m) => { m.days[0].kit.weather.low_c = 14; }],
    // The schema allows 10 (the Day book's cap); a brochure stays at 6.
    [/^\/days\/0\/food$/, /at most 6 items/, (m) => { m.days[0].food = Array(7).fill(m.days[0].food[0]); }],
    [/^\/days\/0\/if_then$/, /at most 6 items/, (m) => { m.days[0].if_then = Array(7).fill({ if: 'a', then: 'b' }); }]
  ];
  for (const [at, msg, edit] of cases) {
    const m = c18b(); edit(m);
    const errs = semanticErrors(m);
    assert.ok(errs.some((e) => at.test(e.path) && msg.test(e.message)), `${at}: ${JSON.stringify(errs)}`);
    assert.throws(() => prepare(m), ModelError);
  }
  const ok = c18b();
  ok.days[0].key_times[1].time = ok.days[0].key_times[0].time; // two tiles at one time are in order
  ok.days[0].kit.weather.low_c = ok.days[0].kit.weather.high_c; // a flat day is not wrong
  assert.deepEqual(semanticErrors(ok), []);
});

test('the header: the lead replaces the summary, key times are tiles in the clock; the glance names the day by its contents', async () => {
  const { renderHtml } = await kit();
  const html = renderHtml(c18b(), { embedFonts: false }).html;
  const [before, d1, d2, d3] = days(html);
  const m = c18b();
  assert.ok(d1.includes(`<p class="day-lead">An easy day on foot with one fixed point`));
  assert.ok(!d1.includes('<p class="day-summary">'), 'the lead replaces the summary');
  assert.ok(d3.includes('<p class="day-summary">Built around the tide'), 'no lead: the summary stays');
  assert.ok(d1.includes('<ul class="key-times"><li><span class="kt-l">Off the train</span><b class="kt-t">07:15</b></li>'));
  assert.equal(count(d1, /<span class="kt-l">/g), 4);
  assert.equal(count(d2, /<span class="kt-l">/g), 2);
  assert.ok(!d3.includes('key-times'));
  // The glance page: the contents line instead of the theme; the day page keeps its theme as the title.
  for (const d of m.days) {
    assert.ok(before.includes(d.contents), `glance: ${d.contents}`);
  }
  assert.ok(!before.includes(`>${m.days[0].theme}<`), 'the glance row no longer shows the theme');
  assert.ok(d1.includes(m.days[0].theme), 'the day page keeps the theme');
  const twelve = c18b(); twelve.trip.clock = '12h';
  const t1 = days(renderHtml(twelve, { embedFonts: false }).html)[1];
  assert.ok(t1.includes('<span class="kt-l">Off the train</span><b class="kt-t">7:15 am</b>'), '12h tiles');
  assert.ok(t1.includes('<span class="kt-l">Dinner</span><b class="kt-t">7:00 pm</b>'));
});

test('why this plan and the day kit: bullets; weather in trip.temp, rain chance, note, sunset in the clock; bring, closed, not missing', async () => {
  const { renderHtml } = await kit();
  const temps = (unit, clock) => { const m = c18b(); if (unit) m.trip.temp = unit; else delete m.trip.temp; if (clock) m.trip.clock = clock; return days(renderHtml(m, { embedFonts: false }).html); };
  const [, d1, d2, d3] = temps('both');
  assert.ok(d1.includes('<div class="why-box" data-pg="block"><p class="eyebrow">Why this plan</p><ul><li>The museum is the only timed entry'));
  assert.equal(count(d1.split('why-box')[1].split('</ul>')[0], /<li>/g), 3);
  assert.ok(!d3.includes('why-box'));
  assert.ok(d1.includes('<div class="day-kit" data-pg="block"><p class="eyebrow">Day kit</p>'));
  assert.ok(d1.includes('High <b>12 °C · 54 °F</b> · low <b>6 °C · 43 °F</b>'));
  assert.ok(d1.includes('Rain chance <b>40%</b>'));
  assert.ok(d1.includes('<p class="kit-n">Sea fog until about ten; dry after.</p>'));
  assert.ok(d1.includes('<p class="kit-w kit-sun">Sunset <b>16:40</b></p>'));
  assert.deepEqual(d1.match(/class="kit-h">[^<]+/g).map((s) => s.slice(14)), ['Weather', 'Bring', 'Closed', 'Not missing']);
  assert.deepEqual(d2.match(/class="kit-h">[^<]+/g).map((s) => s.slice(14)), ['Weather', 'Bring'], 'empty groups are left out');
  assert.ok(!d2.includes('Rain chance'), 'no rain_pct, no rain line');
  assert.deepEqual(d3.match(/class="kit-h">[^<]+/g).map((s) => s.slice(14)), ['Weather', 'Not missing']);
  // Order beside the aside: why, then the kit, before the rail.
  assert.ok(d1.indexOf('why-box') < d1.indexOf('day-kit') && d1.indexOf('day-kit') < d1.indexOf('class="rail"'));
  const f = temps('f')[1], c = temps('')[1];
  assert.ok(f.includes('High <b>54 °F</b> · low <b>43 °F</b>'));
  assert.ok(c.includes('High <b>12 °C</b> · low <b>6 °C</b>'), 'Celsius by default');
  assert.ok(temps('both', '12h')[1].includes('Sunset <b>4:40 pm</b>'), 'the sunset follows the clock');
  assert.ok(d3.includes('<p class="kit-w kit-sun">Sunset <b>16:38</b></p>'), 'the sunset comes from the day (its evening)');
});

test('food on your route and if this, then that: the table, caveats, card links, the bail-out last', async () => {
  const { renderHtml } = await kit();
  const [, d1, d2, d3] = days(renderHtml(c18b(), { embedFonts: false }).html);
  assert.ok(d1.includes('<div class="day-food" data-pg="block"><p class="eyebrow">Food on your route</p><table class="food-t"><thead><tr><th>Name</th><th>Dish</th><th>Fits</th><th>Price</th></tr></thead>'));
  const food = d1.split('class="food-t"')[1].split('</table>')[0];
  assert.equal(count(food, /<td class="fd-n">/g), 4);
  assert.equal(count(food, /<tr class="fd-cav">/g), 3, 'three caveats, each a small line under its row');
  assert.ok(food.includes('<tr class="has-cav"><td class="fd-n"><b>Quillet&#39;s</b> <a class="pref" href="#place-quillet"'));
  assert.ok(food.includes('<td class="fd-n"><b>Corran Arcade bakery</b></td>'), 'a place without a card: the name only');
  assert.ok(food.includes('<td class="fd-p">€9</td>'));
  assert.ok(d2.includes('Cinder Lane Bakery') && d2.includes('href="#place-cinder-lane"'));
  assert.ok(!d3.includes('day-food'));
  const it = d1.split('<dl class="it-rows">')[1].split('</dl>')[0];
  assert.ok(it.startsWith('<div class="it-row it-head"><dt>If</dt><dd>Then</dd></div>'));
  assert.equal(count(it, /<div class="it-row">/g), 3);
  assert.ok(it.endsWith('<div class="it-row it-bail"><dt>Cutting the day short</dt><dd>After the belfry, walk 6 minutes back to the inn and rest; keep only the 19:00 dinner.</dd></div>'));
  assert.ok(d1.indexOf('class="rail"') < d1.indexOf('day-food') && d1.indexOf('day-food') < d1.indexOf('day-ifthen'), 'food then if-then, after the rail');
  assert.ok(!d2.includes('day-ifthen'));
  const bail = c18b(); delete bail.days[0].if_then;
  const b1 = days(renderHtml(bail, { embedFonts: false }).html)[1];
  assert.ok(b1.includes('<dl class="it-rows"><div class="it-row it-bail">'), 'a bail-out alone: no If/Then head row');
});

test('the wave-2 fixture prints with no paginator warnings (letter and A4) when Playwright is present', async (t) => {
  const { renderHtml, renderPdf, pdfAvailable } = await kit();
  if (!pdfAvailable()) { t.skip('Playwright/Chromium not available'); return; }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'c18b-'));
  try {
    for (const page of ['letter', 'a4']) {
      const { html } = renderHtml(c18b(), { embedFonts: false, page });
      const r = await renderPdf(html, path.join(dir, `c18b-${page}.pdf`), { page });
      assert.deepEqual(r.warnings, [], page);
      assert.ok(r.pages >= 10, `${page}: ${r.pages} pages`);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// Developed by: LightAISolutions
