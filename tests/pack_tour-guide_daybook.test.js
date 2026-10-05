'use strict';
// packs/tour-guide — Contract C18 wave 3 (WP-18e): brochure-map's Day book (options.book 'day' + options.date) and the
// briefing's Day book fields (`book`, `inside`, food and if-then up to 10). The Day book keeps one day with its number
// in the trip, only the places that day refers to and their sources; the briefing merges at the Day book's caps; `inside`
// anywhere else is a "briefing: …" warning. Invented data only (brochure-map-sample-c18.mjs,
// brochure-map-sample-daybook.mjs).
const { test } = require('node:test');
const assert = require('node:assert/strict');

const load = async () => ({
  bm: await import('../packs/tour-guide/brochure-map/index.mjs'),
  kit: await import('../kits/brochure/index.mjs'),
  schemas: await import('../packs/tour-guide/schemas/index.mjs'),
  ...(await import('../packs/tour-guide/brochure-map/brochure-map-sample-c18.mjs')),
  ...(await import('../packs/tour-guide/brochure-map/brochure-map-sample-daybook.mjs'))
});
const clone = (x) => JSON.parse(JSON.stringify(x));
/** The Day book sample with its briefing replaced (or edited) and extra options. */
const input = (L, edit, extra = {}) => {
  const s = L.sampleInputDayBook();
  if (edit) edit(s.options.briefing, s);
  s.options = { ...s.options, ...extra };
  return s;
};
function assertKitValid(kit, model) {
  assert.deepEqual(kit.validate(model), []);
  assert.deepEqual(kit.semanticErrors(model), []);
}

test('buildModel Day book: book "day", one day with its number, only that day\'s places and sources, nothing trip-wide', async () => {
  const L = await load();
  const { model, warnings } = L.bm.buildModel(L.sampleInputDayBook());
  assert.deepEqual(warnings, []);
  assertKitValid(L.kit, model);
  assert.equal(model.book, 'day');
  assert.deepEqual(Object.keys(model).sort(), ['attribution', 'book', 'days', 'places', 'trip', 'version']);
  assert.equal(model.days.length, 1);
  assert.equal(model.days[0].date, L.DAYBOOK_DATE);
  assert.equal(model.days[0].number, 1);
  // The whole brochure of the same plan, for comparison.
  const s = L.sampleInputC18(); s.options = { ...s.options, c18: true };
  const full = L.bm.buildModel(s).model;
  assert.equal(full.book, undefined, 'a brochure carries no book key');
  assert.equal(full.days[0].number, undefined, 'a brochure carries no day number');
  const keys = L.bm.dayPlaceKeys(model.days[0]);
  const want = Object.keys(full.places).filter((k) => keys.has(k));
  assert.deepEqual(Object.keys(model.places), want, 'the day\'s places, in the brochure\'s card order');
  assert.ok(!('lark-hill' in model.places), 'a place of another day is left out');
  for (const k of want) assert.deepEqual(model.places[k], full.places[k]);
  const bare = (u) => String(u).split('#')[0]; // the brochure's de-duplication may keep another fragment of the same page
  const urls = new Set(full.attribution.sources.map((x) => bare(x.url)));
  assert.ok(model.attribution.sources.every((x) => urls.has(bare(x.url))), 'every source is one of the brochure\'s');
  assert.ok(model.attribution.sources.length <= full.attribution.sources.length);
  assert.equal(model.trip.title, full.trip.title);
  // The second day: number 2, its own place.
  const d2 = L.bm.buildModel(input(L, (b, x) => { x.options.date = '2027-05-14'; delete x.options.briefing; })).model;
  assert.equal(d2.days[0].number, 2);
  assert.ok('lark-hill' in d2.places && !('slate-museum' in d2.places));
  assertKitValid(L.kit, d2);
});

test('the briefing merges at the Day book caps: 8 food, 8 if-then, the order inside the museum', async () => {
  const L = await load();
  const { model } = L.bm.buildModel(L.sampleInputDayBook());
  const d = model.days[0], b = L.DAYBOOK_BRIEFING.days[L.DAYBOOK_DATE];
  assert.equal(d.theme, b.theme);
  assert.equal(d.food.length, 8);
  assert.equal(d.if_then.length, 8);
  const museum = d.stops.find((s) => s.place === 'slate-museum');
  assert.equal(museum.inside.length, b.inside['slate-museum'].length);
  assert.deepEqual(museum.inside[0], { time: '10:00', text: b.inside['slate-museum'][0].text });
  assert.deepEqual(museum.inside.at(-1), { text: b.inside['slate-museum'].at(-1).text }, 'an untimed step stays untimed');
  assert.equal(d.stops.find((s) => s.place === 'copper-market').inside, undefined);
  // Over the Day book caps: the first 10 kept, with a warning.
  const big = L.bm.buildModel(input(L, (x) => { const day = x.days[L.DAYBOOK_DATE]; day.food = Array(12).fill(day.food[0]); day.if_then = Array(11).fill(day.if_then[0]); day.inside['slate-museum'] = Array(12).fill({ text: 'A room' }); }));
  const bd = big.model.days[0];
  assert.deepEqual([bd.food.length, bd.if_then.length, bd.stops[0].inside.length], [10, 10, 10]);
  for (const k of ['food', 'if_then', 'inside slate-museum']) assert.ok(big.warnings.some((w) => w.startsWith(`briefing: ${L.DAYBOOK_DATE} ${k}`) && /the first 10 kept/.test(w)), `${k}: ${JSON.stringify(big.warnings)}`);
  assertKitValid(L.kit, big.model);
});

test('inside: a bad, out-of-order or out-of-span time leaves the step without it; an unknown stop or an empty step is dropped', async () => {
  const L = await load();
  const D = L.DAYBOOK_DATE;
  const { model, warnings } = L.bm.buildModel(input(L, (x) => {
    const st = x.days[D].inside['slate-museum'];
    st[1].time = '9.30';                       // not HH:MM
    st[2].time = '10:05';                      // in order (after the 10:00 step; the untimed step between is skipped)
    st[3].time = '10:01';                      // earlier than 10:05
    st[4].time = '12:30';                      // after the stop departs (12:00)
    st.push({ text: '' });                     // no text
    x.days[D].inside['lark-hill'] = [{ text: 'Another day' }];
  }));
  const st = model.days[0].stops.find((s) => s.place === 'slate-museum').inside;
  assert.equal(st.length, 6, 'every step with a text is kept');
  assert.deepEqual(st.map((s) => s.time), ['10:00', undefined, '10:05', undefined, undefined, undefined]);
  const has = (re) => assert.ok(warnings.some((w) => re.test(w)), `${re}: ${JSON.stringify(warnings)}`);
  has(/^briefing: 2027-05-13 inside slate-museum 2: time is not HH:MM — the step kept without it$/);
  has(/^briefing: 2027-05-13 inside slate-museum 4: 10:01 is earlier than the step before — the step kept without its time$/);
  has(/^briefing: 2027-05-13 inside slate-museum 5: 12:30 is outside the stop \(10:00 – 12:00\) — the step kept without its time$/);
  has(/^briefing: 2027-05-13 inside slate-museum 7: needs a text — dropped$/);
  has(/^briefing: 2027-05-13 inside lark-hill: not a stop of the day — dropped$/);
  assertKitValid(L.kit, model);
});

test('in the brochure: inside is dropped with a warning; food and if-then over 6 are cut to 6; a Day book briefing still merges', async () => {
  const L = await load();
  const s = L.sampleInputC18();
  s.options = { ...s.options, c18: true, briefing: clone(L.DAYBOOK_BRIEFING) };
  const { model, warnings } = L.bm.buildModel(s);
  assertKitValid(L.kit, model);
  assert.equal(model.book, undefined);
  assert.equal(model.days.length, 2);
  assert.ok(model.days.every((d) => d.stops.every((x) => x.inside === undefined)));
  assert.equal(model.days[0].food.length, 6);
  assert.equal(model.days[0].if_then.length, 6);
  const has = (re) => assert.ok(warnings.some((w) => re.test(w)), `${re}: ${JSON.stringify(warnings)}`);
  has(/^briefing: written for a Day book, merged into the brochure at its caps$/);
  has(/^briefing: 2027-05-13 inside: the order inside a stop is for the Day book — dropped$/);
  has(/^briefing: 2027-05-13 food: 8 entries, the first 6 kept$/);
  has(/^briefing: 2027-05-13 if_then: 8 entries, the first 6 kept$/);
  // A brochure briefing in a Day book: merged at the Day book's caps, with the note.
  const b = clone(L.C18_BRIEFING); b.book = 'brochure';
  const r = L.bm.buildModel(input(L, (_x, x) => { x.options.briefing = b; }));
  assert.ok(r.warnings.includes('briefing: written for the brochure, merged into the Day book at its caps'), JSON.stringify(r.warnings));
  assert.ok(r.warnings.includes('briefing: 2027-05-14 is not the Day book\'s day — dropped'), JSON.stringify(r.warnings));
  assertKitValid(L.kit, r.model);
});

test('options: a bad book, a Day book without a date, a date not in the plan and a free day throw; a lone date warns', async () => {
  const L = await load();
  const bad = [
    [(o) => { o.book = 'pamphlet'; }, /options\.book must be "brochure" or "day" \(got pamphlet\)/],
    [(o) => { delete o.date; }, /needs options\.date, YYYY-MM-DD/],
    [(o) => { o.date = '13 May'; }, /needs options\.date, YYYY-MM-DD/],
    [(o) => { o.date = '2027-06-01'; }, /2027-06-01 is not a day of the plan/]
  ];
  for (const [edit, re] of bad) {
    const s = L.sampleInputDayBook(); edit(s.options);
    assert.throws(() => L.bm.buildModel(s), re);
  }
  const free = L.sampleInputDayBook();
  free.plan.days.push({ ...clone(free.plan.days[1]), date: '2027-05-15', stops: [], legs: [], meals: [] });
  free.trip.end_date = '2027-05-15';
  free.options.date = '2027-05-15'; delete free.options.briefing;
  assert.throws(() => L.bm.buildModel(free), /2027-05-15 is a free day with no stops; a Day book needs a planned day/);
  // book 'brochure' is the brochure; a date without book 'day' is ignored with a warning.
  const s = L.sampleInputC18(); s.options = { ...s.options, c18: true, book: 'brochure', date: '2027-05-13' };
  const r = L.bm.buildModel(s);
  assert.equal(r.model.days.length, 2);
  assert.deepEqual(r.warnings, ['day book: options.date ignored — it needs options.book "day"']);
  // The Day book implies C18 (no options.c18 needed for the briefing).
  const noc = L.sampleInputDayBook(); delete noc.options.c18;
  const n = L.bm.buildModel(noc);
  assert.deepEqual(n.warnings, []);
  assert.equal(n.model.days[0].food.length, 8);
});

test('briefing schema and checks: book, inside, the caps per book, one date in a Day book, inside steps in time order', async () => {
  const L = await load();
  const { BRIEFING_BOOK_CAPS } = await import('../packs/tour-guide/schemas/tour-guide-checks.mjs');
  const { BRIEF_CAPS } = await import('../kits/brochure/lib/model.mjs');
  for (const k of ['brochure', 'day']) for (const f of ['food', 'if_then']) assert.equal(BRIEFING_BOOK_CAPS[k][f], BRIEF_CAPS[k][f], `${k} ${f}: the pack and the kit agree`);
  const v = (b) => L.schemas.validate(b, 'briefing');
  const D = L.DAYBOOK_DATE;
  assert.deepEqual(v(clone(L.DAYBOOK_BRIEFING)), { ok: true, errors: [] });
  assert.deepEqual(v(clone(L.C18_BRIEFING)), { ok: true, errors: [] });
  const bad = [
    ['/book', /./, (b) => { b.book = 'pamphlet'; }],
    [`/days/${D}/inside/slate-museum`, /./, (b) => { b.days[D].inside['slate-museum'] = []; }],
    [`/days/${D}/inside/slate-museum`, /./, (b) => { b.days[D].inside['slate-museum'] = Array(11).fill({ text: 'A room' }); }],
    [`/days/${D}/inside/slate-museum/0/note`, /./, (b) => { b.days[D].inside['slate-museum'][0].note = 'x'; }],
    [`/days/${D}/inside/slate-museum/0/time`, /./, (b) => { b.days[D].inside['slate-museum'][0].time = '10.00'; }],
    [`/days/${D}/inside/Slate_Museum`, /./, (b) => { b.days[D].inside.Slate_Museum = [{ text: 'x' }]; }],
    [`/days/${D}/food`, /./, (b) => { b.days[D].food = Array(11).fill(b.days[D].food[0]); }],
    ['/days', /exactly one date \(got 2\)/, (b) => { b.days['2027-05-14'] = { theme: 'The second day' }; }],
    [`/days/${D}/inside/slate-museum/2/time`, /time order/, (b) => { b.days[D].inside['slate-museum'][2].time = '10:05'; }],
    [`/days/${D}/food`, /at most 6 items in a brochure briefing/, (b) => { delete b.book; delete b.days[D].inside; }],
    [`/days/${D}/if_then`, /at most 6 items in a brochure briefing/, (b) => { b.book = 'brochure'; delete b.days[D].inside; }],
    [`/days/${D}/inside`, /inside is for the Day book/, (b) => { delete b.book; b.days[D].food.length = 6; b.days[D].if_then.length = 6; }]
  ];
  for (const [at, msg, edit] of bad) {
    const b = clone(L.DAYBOOK_BRIEFING); edit(b);
    const r = v(b);
    assert.equal(r.ok, false, at);
    assert.ok(r.errors.some((e) => e.path === at && msg.test(e.message)), `${at} ${msg}: ${JSON.stringify(r.errors)}`);
  }
});

// Developed by: LightAISolutions
