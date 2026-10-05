'use strict';
// kits/brochure — Contract C18 wave 1 (WP-18a): the trip's clock and temperature settings, a day's checklist, prep and
// departure, `fixed` and `tip` on the timeline, and a free window's title and options validate, are refused with unknown
// keys or bad values, render in the kit's own components, and leave a model without them byte for byte as before.
// Invented data only (fixtures/sample-trip-c18.json).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DIR = path.resolve(__dirname, '..', 'kits', 'brochure', 'fixtures');
const load = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
const fixture = () => load('sample-trip.json');
const c18 = () => load('sample-trip-c18.json');
const kit = () => import('../kits/brochure/index.mjs');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const errsAt = (errs, re) => errs.filter((e) => re.test(e.path));
/** The rendered HTML cut into its day sections (index 0 is everything before day 1). */
const days = (html) => html.split('class="sec sec-day');
const count = (s, re) => (s.match(re) || []).length;

// Golden hashes (embedFonts:false). The plain fixture's is the one the C11 test pins; the C18 fixture with every C18
// field stripped was hashed with the kit as it was before WP-18a and with the kit after it: the same bytes.
const FIXTURE_HTML = { letter: '1d9ab32bd321a8e043b4066672aa798290ea3480af8075469d848a03a26474d7', a4: 'b4f44a7eaf23bdee08a3ce662c018aa98dd3ea82d18afb1b7446b40e1810b705' };
const STRIPPED_HTML = { letter: '2fd0e0c14dd6ebe3bd8fbe4bd0d8ea9cfb6bca3771142d32295204891cf12b86', a4: 'faa0f18caba15d8cd27c5dad5f150c2a1aef7fae8bbb3338b1a7431f8d4fc348' };

/** The C18 fixture with every C18 field deleted: what a pre-C18 planner would have sent. */
function stripped() {
  const m = c18();
  delete m.trip.clock; delete m.trip.temp;
  for (const d of m.days) {
    delete d.checklist; delete d.prep; delete d.departure;
    if (d.start) delete d.start.fixed;
    if (d.end) delete d.end.fixed;
    for (const x of [...d.stops, ...(d.meals || [])]) { delete x.fixed; delete x.tip; }
    for (const x of d.free || []) { delete x.title; delete x.options; }
  }
  return m;
}

test('the C18 fixture validates and passes the semantic checks; usesC18 sees it, and not the plain fixture', async () => {
  const { validate, semanticErrors, prepare } = await kit();
  const { usesC18 } = await import('../kits/brochure/lib/model.mjs');
  const m = c18();
  assert.deepEqual(validate(m), []);
  assert.deepEqual(semanticErrors(m), []);
  assert.equal(usesC18(m), true);
  assert.equal(prepare(m).c18, true);
  assert.equal(usesC18(fixture()), false);
  assert.equal(usesC18(stripped()), false);
  assert.equal(prepare(fixture()).c18, false);
});

test('usesC18: each C18 field alone switches it on', async () => {
  const { usesC18 } = await import('../kits/brochure/lib/model.mjs');
  const edits = {
    'trip.clock': (m) => { m.trip.clock = '24h'; },
    'trip.temp': (m) => { m.trip.temp = 'f'; },
    'day.checklist': (m) => { m.days[0].checklist = { must: ['Be there'] }; },
    'day.prep': (m) => { m.days[0].prep = { night_before: ['Pack'] }; },
    'day.departure': (m) => { m.days[0].departure = { to: 'Northgate Halt', at: '18:42' }; },
    'start.fixed': (m) => { m.days[0].start = { name: 'Northgate Halt', time: '07:15', fixed: true }; },
    'stop.fixed': (m) => { m.days[0].stops[0].fixed = true; },
    'stop.tip': (m) => { m.days[0].stops[0].tip = 'North door.'; },
    'meal.tip': (m) => { m.days[0].meals[0].tip = 'Cards only.'; },
    'free.title': (m) => { m.days[0].free[0].title = 'Breather'; },
    'free.options': (m) => { m.days[0].free[0].options = [{ name: 'Sea wall benches' }]; }
  };
  for (const [name, edit] of Object.entries(edits)) {
    const m = fixture(); edit(m);
    assert.equal(usesC18(m), true, name);
  }
});

test('the schema refuses unknown keys and bad values in every C18 field', async () => {
  const { validate } = await kit();
  const bogus = [
    '/days/0/checklist', '/days/0/prep', '/days/0/prep/steps/0', '/days/2/departure', '/days/2/departure/scenarios/0',
    '/days/0/free/0', '/days/0/free/0/options/0'
  ];
  const at = (m, p) => p.split('/').slice(1).reduce((o, k) => o[k], m);
  for (const p of bogus) {
    const m = c18(); at(m, p).bogus = 1;
    const errs = validate(m);
    assert.ok(errs.some((e) => e.path === `${p}/bogus` || (e.path === p && /bogus|unknown/.test(e.message))), `${p}: ${JSON.stringify(errs)}`);
  }
  const long = 'x'.repeat(161);
  const bad = [
    [/\/trip\/clock/, (m) => { m.trip.clock = '25h'; }],
    [/\/trip\/temp/, (m) => { m.trip.temp = 'kelvin'; }],
    [/\/days\/0\/checklist\/must/, (m) => { m.days[0].checklist.must = Array(7).fill('Be there'); }],
    [/\/days\/0\/checklist\/carry/, (m) => { m.days[0].checklist.carry = Array(9).fill('Ticket'); }],
    [/\/days\/0\/checklist\/constraints\/0/, (m) => { m.days[0].checklist.constraints[0] = long; }],
    [/\/days\/0\/prep\/steps\/0/, (m) => { delete m.days[0].prep.steps[0].time; }],
    [/\/days\/0\/prep\/steps\/0\/time/, (m) => { m.days[0].prep.steps[0].time = '6.45'; }],
    [/\/days\/0\/prep\/steps/, (m) => { m.days[0].prep.steps.push(...m.days[0].prep.steps); }],
    [/\/days\/2\/departure/, (m) => { delete m.days[2].departure.at; }],
    [/\/days\/2\/departure\/by/, (m) => { m.days[2].departure.by = '5:55pm'; }],
    [/\/days\/2\/departure\/scenarios/, (m) => { m.days[2].departure.scenarios.push({ label: 'A third way' }); }],
    [/\/days\/2\/departure\/scenarios\/0\/spare_min/, (m) => { m.days[2].departure.scenarios[0].spare_min = 300; }],
    [/\/days\/2\/departure\/scenarios\/1\/spare_min/, (m) => { m.days[2].departure.scenarios[1].spare_min = 7.5; }],
    [/\/days\/2\/departure\/fallbacks/, (m) => { m.days[2].departure.fallbacks = Array(5).fill('Later train'); }],
    [/\/days\/0\/stops\/0\/fixed/, (m) => { m.days[0].stops[0].fixed = false; }],
    [/\/days\/0\/stops\/0\/tip/, (m) => { m.days[0].stops[0].tip = long; }],
    [/\/days\/0\/meals\/\d+\/fixed/, (m) => { m.days[0].meals[0].fixed = 'yes'; }],
    [/\/days\/0\/start\/fixed/, (m) => { m.days[0].start.fixed = 1; }],
    [/\/days\/0\/free\/0\/title/, (m) => { m.days[0].free[0].title = 'x'.repeat(61); }],
    [/\/days\/0\/free\/0\/options/, (m) => { m.days[0].free[0].options.push({ name: 'A fifth' }); }],
    [/\/days\/0\/free\/0\/options\/0/, (m) => { delete m.days[0].free[0].options[0].name; }],
    [/\/days\/0\/free\/0\/options\/0\/km/, (m) => { m.days[0].free[0].options[0].km = 250; }],
    [/\/days\/0\/free\/0\/options\/0\/walk_min/, (m) => { m.days[0].free[0].options[0].walk_min = 121; }],
    [/\/days\/0\/free\/0\/options\/1\/place/, (m) => { m.days[0].free[0].options[1].place = 'not a key!'; }]
  ];
  for (const [re, edit] of bad) {
    const m = c18(); edit(m);
    assert.ok(errsAt(validate(m), re).length > 0, `${re}: ${JSON.stringify(validate(m))}`);
  }
});

test('semantic checks: prep steps in time order, leave-by not after the departure, free options', async () => {
  const { semanticErrors, prepare, ModelError } = await kit();
  const cases = [
    [/^\/days\/0\/prep\/steps\/2\/time$/, /time order/, (m) => { m.days[0].prep.steps[2].time = '06:00'; }],
    [/^\/days\/2\/departure\/by$/, /after the departure/, (m) => { m.days[2].departure.by = '19:00'; }],
    [/^\/days\/0\/free\/0\/options\/1\/place$/, /unknown place/, (m) => { m.days[0].free[0].options[1].place = 'nowhere'; }],
    [/^\/days\/0\/free\/0\/options\/3\/name$/, /offered twice/, (m) => { m.days[0].free[0].options[3].name = 'SEA WALL BENCHES '; }]
  ];
  for (const [at, msg, edit] of cases) {
    const m = c18(); edit(m);
    const errs = semanticErrors(m);
    assert.ok(errs.some((e) => at.test(e.path) && msg.test(e.message)), `${at}: ${JSON.stringify(errs)}`);
    assert.throws(() => prepare(m), ModelError);
  }
  const ok = c18();
  ok.days[2].departure.by = ok.days[2].departure.at; // leaving at the departure time is late, not wrong
  ok.days[0].prep.steps[1].time = ok.days[0].prep.steps[0].time; // two steps at one time are in order
  assert.deepEqual(semanticErrors(ok), []);
});

test('the clock setting: 24h, 12h, else the locale default — in the rail, the prep and the departure', async () => {
  const { renderHtml } = await kit();
  const { clockText, hourCycle, withHourCycle } = await import('../kits/brochure/lib/format.mjs');
  assert.equal(clockText('17:05', 'en-US'), '5:05 pm');
  assert.equal(clockText('17:05', 'en-US', '24h'), '17:05');
  assert.equal(clockText('09:05', 'en-GB'), '09:05');
  assert.equal(clockText('09:05', 'en-GB', '12h'), '9:05 am');
  assert.equal(clockText('17:05', withHourCycle('en-US', '24h')), '17:05');
  assert.equal(clockText('17:05', withHourCycle('de-DE', '12h')), '5:05 pm');
  assert.equal(withHourCycle('en-US', ''), 'en-US');
  assert.equal(hourCycle('en-US-u-hc-h23', ''), '24h');
  assert.equal(hourCycle('en-US', ''), '');
  const lead = (m) => (renderHtml(m, { embedFonts: false }).html.match(/Leave by <b>([^<]+)<\/b>[^<]*<b>[^<]+<\/b>, departs <b>([^<]+)<\/b>/) || []).slice(1);
  const prep = (m) => (renderHtml(m, { embedFonts: false }).html.match(/<ol class="prep-steps"><li><b>([^<]+)<\/b>/) || [])[1];
  const m24 = c18();
  assert.equal(m24.trip.clock, '24h');
  assert.deepEqual(lead(m24), ['17:55', '18:42']);
  assert.equal(prep(m24), '06:45');
  assert.ok(!/<small>[ap]m<\/small>/.test(renderHtml(m24, { embedFonts: false }).html), '24h: no am/pm anywhere on the rail');
  const m12 = c18(); m12.trip.clock = '12h'; m12.trip.locale = 'en-GB';
  assert.deepEqual(lead(m12), ['5:55 pm', '6:42 pm']);
  assert.equal(prep(m12), '6:45 am');
  const us = c18(); delete us.trip.clock; us.trip.locale = 'en-US';
  assert.deepEqual(lead(us), ['5:55 pm', '6:42 pm']);
  const gb = c18(); delete gb.trip.clock; gb.trip.locale = 'en-GB';
  assert.deepEqual(lead(gb), ['17:55', '18:42']);
});

test('the temperature setting: c (default), f and both — in the season page and the formatter', async () => {
  const { renderHtml } = await kit();
  const { temperature } = await import('../kits/brochure/lib/format.mjs');
  assert.equal(temperature(12), '12 °C');
  assert.equal(temperature(12, 'f'), '54 °F');
  assert.equal(temperature(12.4, 'both'), '12 °C · 54 °F');
  assert.equal(temperature(-40, 'f'), '-40 °F');
  assert.equal(temperature('n/a', 'both'), '');
  const temps = (unit) => {
    const m = c18(); if (unit) m.trip.temp = unit; else delete m.trip.temp;
    return renderHtml(m, { embedFonts: false }).html;
  };
  const both = temps('both'), f = temps('f'), c = temps('');
  assert.ok(/\d+ °C · \d+ °F/.test(both));
  // The figures follow the setting; the planner's own prose (the weather summary) is left as written.
  assert.ok(/\d+ °F/.test(f) && !/°C ·/.test(f) && count(f, /\d+ °F/g) === count(both, /\d+ °F/g), 'f: every figure in Fahrenheit');
  assert.ok(/\d+ °C/.test(c) && !/\d+ °F/.test(c), 'c is the default');
});

test('the day brief: checklist groups (Must, Carry, Limits; empty groups omitted) and Night before · This morning', async () => {
  const { renderHtml } = await kit();
  const [, d1, d2, d3] = days(renderHtml(c18(), { embedFonts: false }).html);
  for (const d of [d1, d3]) {
    assert.ok(d.includes('<div class="day-brief two" data-pg="block">'), 'checklist and prep side by side');
    assert.deepEqual(d.match(/class="ck-h">[^<]+/g).map((s) => s.slice(13)), ['Must', 'Carry', 'Limits']);
    assert.ok(d.includes('Night before · This morning'));
  }
  assert.ok(d1.includes('<li>09:30 timed entry, Museum of Tide &amp; Trade</li>'));
  assert.ok(d1.includes('<li><b>09:15</b><span>Leave for the museum (12 min walk)</span></li>'));
  assert.equal(count(d1, /<ol class="prep-steps"><li>|<\/li><li><b>/g), 5, 'five prep steps');
  assert.ok(d2.includes('<div class="day-brief" data-pg="block">'), 'a checklist alone is one column');
  assert.deepEqual(d2.match(/class="ck-h">[^<]+/g).map((s) => s.slice(13)), ['Must', 'Carry']);
  assert.ok(!d2.includes('brief-prep'));
  const m = c18(); m.days[1].prep = { steps: [{ time: '08:00', text: 'Breakfast' }] }; delete m.days[1].checklist;
  const one = days(renderHtml(m, { embedFonts: false }).html)[2];
  assert.ok(one.includes('<p class="eyebrow">This morning</p>') && !one.includes('Night before'), 'the title names only what is there');
  // The brief sits between the day header and the aside, before the rail.
  assert.ok(d1.indexOf('day-brief') < d1.indexOf('data-pg="aside"') && d1.indexOf('day-brief') < d1.indexOf('class="rail'));
});

test('fixed times are bold with a tag, the legend appears once on a day that has one, tips sit under their rows', async () => {
  const { renderHtml } = await kit();
  const [, d1, d2, d3] = days(renderHtml(c18(), { embedFonts: false }).html);
  // Day 1: the start point, the museum and the dinner are fixed; day 2 the workshop; day 3 the ferry and the end point.
  assert.equal(count(d1, /class="ti-time is-fixed"/g), 3);
  assert.equal(count(d2, /class="ti-time is-fixed"/g), 1);
  assert.equal(count(d3, /class="ti-time is-fixed"/g), 2);
  for (const d of [d1, d2, d3]) {
    assert.equal(count(d, /class="fixed-legend"/g), 1);
    assert.equal(count(d, /class="fx-tag">fixed<\/span>/g), count(d, /class="ti-time is-fixed"/g));
  }
  assert.ok(d1.includes('<b>Bold</b> times are fixed by a booking, a timed entry or a train; the rest can slide.'));
  const m = c18(); delete m.days[1].stops[1].fixed;
  const plain2 = days(renderHtml(m, { embedFonts: false }).html)[2];
  assert.ok(!plain2.includes('fixed-legend') && !plain2.includes('is-fixed'), 'no fixed time, no legend');
  assert.ok(d1.includes('<span class="tip-k">Tip</span> Enter by the north door; the main hall opens at 9:30 sharp.'));
  assert.ok(d1.includes('<span class="tip-k">Tip</span> Ask for the window table; the kitchen closes at 21:30.'), 'meal tips too');
  assert.equal(count(d1, /class="ti-meta ti-tip"/g), 4);
});

test('a fixed stop is never shown as an "about" time', async () => {
  const { renderHtml } = await kit();
  const m = c18();
  delete m.days[1].stops[1].fixed;
  Object.assign(m.days[1].stops[0], { time_style: 'about' });
  const day2 = () => days(renderHtml(m, { embedFonts: false }).html)[2];
  const loose = day2();
  assert.equal(count(loose, /<span class="t2">about<\/span>/g), 1, 'an about stop rounds and says so');
  m.days[1].stops[0].fixed = true;
  const fixed = day2();
  assert.equal(count(fixed, /<span class="t2">about<\/span>/g), 0, 'fixed wins over about');
  assert.equal(count(fixed, /class="ti-time is-fixed"/g), 1);
});

test('free windows on a C18 day: title, length, options with walk/distance, open status, link and card ref', async () => {
  const { renderHtml } = await kit();
  const [, d1, d2, d3] = days(renderHtml(c18(), { embedFonts: false }).html);
  assert.ok(d1.includes('<b>Harbour hour</b> <span class="fr-len">· 1 h 34 min</span>'));
  assert.equal(count(d1, /class="fo-n">/g), 4);
  assert.ok(d1.includes('<span class="fo-n"><a href="https://maps.example.com/?q=Ninefold+Steps">The Ninefold Steps</a></span><span class="fo-m">9 min walk<span class="sep">·</span>lit until 22:00</span>'));
  assert.ok(/Fennick &amp; Daughters<\/span><span class="fo-m">6 min walk<span class="sep">·<\/span>open until 18:00<span class="sep">·<\/span><a class="pref" href="#place-fennick"/.test(d1), 'an option with a card links to it');
  assert.ok(!/Corran Arcade<\/span><span class="fo-m">[^]*?class="pref"[^]*?<\/li>/.test(d1.slice(d1.indexOf('Corran Arcade</span>'), d1.indexOf('Fennick &amp; Daughters</span>'))), 'no card, no ref');
  assert.ok(d2.includes('<b>Rest before dinner</b>') && d2.includes('class="fo-m">500 m away'), 'distance when there is no walk time');
  assert.ok(d3.includes('<b>Last half hour</b> <span class="fr-len">· 33 min</span>'));
  // A titled window without options still uses the new row; an untitled one is "Free".
  const m = c18(); delete m.days[1].free[0].title; delete m.days[1].free[0].options;
  const d = days(renderHtml(m, { embedFonts: false }).html)[2];
  assert.ok(d.includes('ti-free2') && d.includes('<b>Free</b>') && !d.includes('free-opts'));
  // On a pre-C18 model the free row is exactly the old one.
  assert.ok(!renderHtml(fixture(), { embedFonts: false }).html.includes('ti-free2'));
});

test('the departure: leave-by lead, both scenarios with spare time, fallbacks, note, placed before the walk-out', async () => {
  const { renderHtml } = await kit();
  const [, d1, d2, d3] = days(renderHtml(c18(), { embedFonts: false }).html);
  assert.ok(!d1.includes('ti-depart') && !d2.includes('ti-depart'));
  assert.equal(count(d3, /class="ti ti-depart"/g), 1);
  assert.ok(d3.includes('<p class="eyebrow">Getting out</p>'));
  assert.ok(d3.includes('Leave by <b>17:55</b> for <b>Northgate Halt</b>, departs <b>18:42</b>'));
  assert.deepEqual(d3.match(/class="spare">[^<]+/g).map((s) => s.slice(14)), ['22 min spare', '15 min spare']);
  assert.ok(d3.includes('<div class="dep-scen two">'));
  assert.ok(d3.includes('<p class="dep-k">If you miss it</p><ul><li>19:42 to Vellmoor Junction (same ticket)</li><li>21:05 last train, change at Orrin</li></ul>'));
  assert.ok(d3.includes('Tickets are on the rail pass; no seat booking needed.'));
  const rows = d3.match(/class="ti ti-[a-z]+/g).map((s) => s.slice(13));
  const at = rows.indexOf('depart');
  assert.deepEqual(rows.slice(at - 1), ['free', 'depart', 'leg', 'point'], 'after the last free window, before the 17:55 walk-out and the end');
  // Without a leave-by time the lead names the departure only, and the box goes in before the end point.
  const m = c18(); delete m.days[2].departure.by; m.days[2].departure.scenarios = [m.days[2].departure.scenarios[0]];
  const d = days(renderHtml(m, { embedFonts: false }).html)[3];
  assert.ok(d.includes('For <b>Northgate Halt</b>, departs <b>18:42</b>') && d.includes('<div class="dep-scen">'));
  const r2 = d.match(/class="ti ti-[a-z]+/g).map((s) => s.slice(13));
  assert.equal(r2[r2.length - 1], 'point');
  assert.equal(r2[r2.length - 2], 'depart');
});

test('red team: markup in C18 text is escaped, javascript: option links are dropped, long text is clipped', async () => {
  const { renderHtml, validate } = await kit();
  const m = c18();
  const evil = '<img src=x onerror=alert(1)>';
  m.days[0].checklist.must[0] = evil;
  m.days[0].prep.steps[0].text = evil;
  m.days[0].stops[0].tip = evil;
  m.days[0].free[0].title = '<b>x</b>';
  m.days[0].free[0].options[1].url = 'javascript:alert(1)';
  m.days[2].departure.fallbacks[0] = evil;
  m.days[2].departure.to = '"><script>alert(1)</script>';
  assert.deepEqual(validate(m), []);
  const { html } = renderHtml(m, { embedFonts: false });
  assert.ok(!html.includes('<img src=x') && !html.includes('<script>alert') && !html.includes('<b>x</b>'));
  assert.ok(!/href="javascript:/i.test(html));
  assert.ok(html.includes('<span class="fo-n">The Ninefold Steps</span>'), 'an unsafe link leaves the name as plain text');
});

test('back compat: a model without C18 fields renders byte for byte as before WP-18a (letter and A4)', async () => {
  const { renderHtml } = await kit();
  for (const page of ['letter', 'a4']) {
    assert.equal(sha(renderHtml(fixture(), { embedFonts: false, page }).html), FIXTURE_HTML[page], `plain fixture, ${page}`);
    assert.equal(sha(renderHtml(stripped(), { embedFonts: false, page }).html), STRIPPED_HTML[page], `C18 fixture stripped, ${page}`);
  }
  const html = renderHtml(stripped(), { embedFonts: false }).html;
  for (const cls of ['day-brief', 'fixed-legend', 'fx-tag', 'ti-tip', 'ti-depart', 'free-opts', '.dep-scen']) assert.ok(!html.includes(cls), `${cls} is absent, CSS included`);
});

test('the C18 fixture prints to PDF on Letter and A4 without pagination warnings', async (t) => {
  const { renderHtml, renderPdf, pdfAvailable } = await kit();
  if (!pdfAvailable()) { t.skip('no global Playwright/Chromium here; the HTML is covered above'); return; }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-c18-'));
  try {
    for (const page of ['letter', 'a4']) {
      const { pages, warnings } = await renderPdf(renderHtml(c18(), { page }).html, path.join(dir, `c18-${page}.pdf`), { page });
      assert.ok(pages >= 10, `${page}: ${pages} pages`);
      assert.deepEqual(warnings, [], `${page}: ${JSON.stringify(warnings)}`);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('C18: Google 12-hour hours text follows the 24-hour clock setting only', async () => {
  const { retimeText } = await import('../kits/brochure/lib/format.mjs');
  assert.equal(retimeText('9:30\u202fAM \u2013 5:00\u202fPM', '24h'), '09:30 \u2013 17:00');
  assert.equal(retimeText('Monday: 12 PM \u2013 12:30 AM', '24h'), 'Monday: 12:00 \u2013 00:30');
  assert.equal(retimeText('9:30 AM \u2013 5:00 PM', '12h'), '9:30 AM \u2013 5:00 PM');
  assert.equal(retimeText('Open 24 hours', '24h'), 'Open 24 hours');
  assert.equal(retimeText('Ask at 9 AMBER desk', '24h'), 'Ask at 9 AMBER desk');
});

// Developed by: LightAISolutions
