'use strict';
// packs/tour-guide/brochure-map — the pieces: closed days from weekday lines or periods, the day's hours line, source
// dedupe keys, travel-mode mapping, snapshot choice, edge days (no stops), bad input, and the guarded PDF step.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const loadAll = async () => {
  const bm = await import('../packs/tour-guide/brochure-map/index.mjs');
  const kit = await import('../kits/brochure/index.mjs');
  const { sampleInput } = await import('../packs/tour-guide/brochure-map/brochure-map-sample.mjs');
  return { bm, kit, sampleInput };
};
const P = (day, h, m = 0) => ({ day, hour: h, minute: m });

test('closedDays: from "Day: Closed" lines; from periods when there are no lines; none for 24/7 or unknown hours', async () => {
  const { bm } = await loadAll();
  const lines = ['Monday: Closed', 'Tuesday: 9:00 AM – 5:00 PM', 'Wednesday: closed', 'Thursday: 9:00 AM – 5:00 PM', 'Friday: 9:00 AM – 5:00 PM', 'Saturday: Open 24 hours', 'Sunday: Closed'];
  assert.deepEqual(bm.closedDays({ weekday_descriptions: lines, periods: [] }), ['Monday', 'Wednesday', 'Sunday']);
  const periods = [1, 2, 3, 4, 5].map((d) => ({ open: P(d, 9), close: P(d, 17) }));
  assert.deepEqual(bm.closedDays({ weekday_descriptions: [], periods }), ['Saturday', 'Sunday']);
  assert.deepEqual(bm.closedDays({ weekday_descriptions: [], periods: [{ open: P(0, 0) }] }), [], 'open 24/7');
  assert.deepEqual(bm.closedDays(null), []);
  assert.deepEqual(bm.closedDays({ weekday_descriptions: [], periods: [] }), []);
});

test('hoursLine / hoursToday: the line for the visit weekday; none when visits fall on days with different lines', async () => {
  const { bm } = await loadAll();
  const lines = ['Monday: Closed', 'Tuesday: 9:00 AM – 5:00 PM', 'Wednesday: 9:00 AM – 5:00 PM', 'Thursday: 10:00 AM – 8:00 PM', 'Friday: 9:00 AM – 5:00 PM', 'Saturday: 9:00 AM – 5:00 PM', 'Sunday: 11:00 AM – 4:00 PM'];
  assert.equal(bm.hoursLine(lines, 'Thursday'), '10:00 AM – 8:00 PM');
  assert.equal(bm.hoursToday(lines, ['2027-05-13']), '10:00 AM – 8:00 PM');
  assert.equal(bm.hoursToday(lines, ['2027-05-11', '2027-05-12']), '9:00 AM – 5:00 PM', 'Tuesday and Wednesday share a line');
  assert.equal(bm.hoursToday(lines, ['2027-05-13', '2027-05-14']), undefined);
  assert.equal(bm.hoursToday(lines, []), undefined);
});

test('sourceKey and mergeSources: scheme/host case, fragment and trailing slash do not split a source', async () => {
  const { bm } = await loadAll();
  const k = bm.sourceKey('HTTPS://Guide.Example.com/harrowmere/#top');
  assert.equal(k, bm.sourceKey('https://guide.example.com/harrowmere'));
  assert.notEqual(bm.sourceKey('https://guide.example.com/a?x=1'), bm.sourceKey('https://guide.example.com/a?x=2'));
  const rows = bm.mergeSources([{ title: 'A', url: 'https://a.example.org/p', accessed: '2027-01-01', supports: 'x' }, { title: 'B', url: 'https://a.example.org/p/', accessed: '2027-02-01', supports: 'y' }, { title: 'C', url: 'https://c.example.org/' }], 2);
  assert.deepEqual(rows, [{ title: 'A', url: 'https://a.example.org/p', accessed: '2027-02-01', supports: 'x; y' }, { title: 'C', url: 'https://c.example.org/' }]);
});

test('legMode and the snapshot choice (this build first, else the newest fetch)', async () => {
  const { bm, sampleInput } = await loadAll();
  assert.deepEqual(['TRANSIT', 'WALK', 'DRIVE', 'BICYCLE', 'FERRY'].map(bm.legMode), ['transit', 'walk', 'drive', 'bike', 'other']);
  const input = sampleInput();
  const museum = input.snapshots[0];
  input.snapshots.push({ ...museum, build_id: 'older-build', fetched_at: '2027-04-25T08:00:00.000Z', content: { ...museum.content, rating: 1.1 } });
  assert.equal(bm.toBrochureModel(input).places['slate-museum'].rating, 4.6, "this build's snapshot wins over a newer one from another build");
  input.plan.build_id = 'yet-another-build';
  assert.equal(bm.toBrochureModel(input).places['slate-museum'].rating, 1.1, 'else the newest');
});

test('a day with no stops becomes a "Free days" practical line; a plan with no stop at all is refused', async () => {
  const { bm, kit, sampleInput } = await loadAll();
  const input = sampleInput();
  input.plan.days[1] = { ...input.plan.days[1], stops: [], legs: [], warnings: [], free: [{ start: '09:00', end: '19:00', note: 'Rest day.' }] };
  const m = bm.toBrochureModel(input);
  assert.deepEqual(m.days.map((d) => d.date), ['2027-05-13']);
  assert.deepEqual(m.practical.find((s) => s.title === 'Free days').items, [{ label: '2027-05-14', text: 'Rest day.' }]);
  assert.deepEqual(kit.validate(m), []);
  input.plan.days[0] = { ...input.plan.days[0], stops: [], legs: [], meals: [], warnings: [] };
  assert.throws(() => bm.toBrochureModel(input), /no day with a stop/);
});

test('bad input: unknown stop place throws; unknown references elsewhere are dropped; hostile strings stay data', async () => {
  const { bm, kit, sampleInput } = await loadAll();
  const input = sampleInput();
  input.plan.days[0].stops[0].place = 'nowhere';
  assert.throws(() => bm.toBrochureModel(input), /stop "nowhere" is not among the places/);
  const i2 = sampleInput();
  i2.plan.days[0].warnings.push({ severity: 'warn', code: 'other', text: 'x', place: 'ghost' });
  i2.plan.days[0].meals.push({ kind: 'dinner', start: '18:00', at: 'ghost' });
  i2.plan.later[0].items.push({ place: 'ghost', place_id: 'FixtureGhost0001', reason: 'gone', code: 'other', added_on: '2027-04-20' });
  i2.places[0].name = '<script>alert(1)</script>';
  i2.notes[0].why_you = 'x'.repeat(5000);
  const m = bm.toBrochureModel(i2);
  assert.deepEqual(kit.validate(m), []);
  assert.deepEqual(kit.semanticErrors(m), []);
  assert.equal(m.days[0].warnings.at(-1).place, undefined);
  assert.equal(m.days[0].meals.at(-1).place, undefined);
  assert.deepEqual(m.later[0].items.at(-1), { name: 'ghost', reason: 'gone' });
  assert.equal(m.places['slate-museum'].note.why_you.length, 4000);
  assert.doesNotMatch(bm.renderPlan(i2).html, /<script>alert/);
  assert.throws(() => bm.toBrochureModel({}), /needs \{ trip, plan \}/);
});

test('renderPlanPdf: HTML always; a PDF only when Playwright and Chromium are present', async () => {
  const { bm, sampleInput } = await loadAll();
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tg-brochure-')), 'plan.pdf');
  if (!bm.pdfAvailable()) {
    const r = await bm.renderPlanPdf(sampleInput(), out);
    assert.equal(r.available, false); assert.equal(r.pdf, null); assert.ok(r.html.length > 1000);
    assert.equal(fs.existsSync(out), false);
    return;
  }
  const r = await bm.renderPlanPdf(sampleInput(), out);
  assert.equal(r.available, true);
  assert.ok(r.pages >= 4);
  assert.equal(fs.readFileSync(out).subarray(0, 4).toString(), '%PDF');
});

test('rain swaps: mapped to the day\'s "If it rains" alternatives with a note, rendered in the aside', async () => {
  const { bm, kit, sampleInput } = await loadAll();
  const input = sampleInput();
  input.plan.days[1].rain_swaps = [{ place: 'ember-hall', place_id: input.places.find((p) => p.id === 'ember-hall').place_id, instead_of: 'lark-hill', km: 1.2, hours: 'unknown' }, { place: 'ghost', place_id: 'FixtureGhost0001', instead_of: 'lark-hill', km: 0.4, hours: 'open' }];
  const m = bm.toBrochureModel(input);
  assert.deepEqual(kit.validate(m), []);
  assert.deepEqual(kit.semanticErrors(m), []);
  const alt = m.days[1].alternatives;
  assert.equal(alt.title, 'If it rains');
  assert.deepEqual(alt.items.map((x) => x.place), ['ember-hall'], 'an unknown place is dropped');
  assert.match(alt.items[0].note, /^Instead of .+ · 1\.2 km away · check the hours$/);
  assert.equal(m.days[0].alternatives, undefined, 'a day without swaps has none');
  const html = bm.renderPlan(input).html;
  assert.match(html, /If it rains/);
  assert.match(html, /1\.2 km away/);
});

// Developed by: LightAISolutions
