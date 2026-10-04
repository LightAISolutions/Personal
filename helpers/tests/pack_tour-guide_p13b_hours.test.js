'use strict';
// Tour Guide Phase 13 (WP-13b) — opening hours: irregular wording on one Google weekday line (A7), a place whose own
// site posts its opening days (B7, C13 `facts.irregular` / `facts.irregular_note`) and the rain swaps (A14).
// Each test reproduces the fault first. Invented places in the tiny "Minibury" world only.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const W = require('./pack_tour-guide_planner_world.js');
// New exports are read from their modules (planner/index.mjs is WP-13a's; the re-export is a REQUEST).
const planner = async () => ({ ...(await import('../packs/tour-guide/planner/index.mjs')), ...(await import('../packs/tour-guide/planner/planner-hours.mjs')), ...(await import('../packs/tour-guide/planner/planner-facts.mjs')) });
const facts = () => import('../packs/tour-guide/facts/index.mjs');
const schemas = () => import('../packs/tour-guide/schemas/index.mjs');
const K = () => import('../kits/maps/index.mjs');

const MON = '2027-06-07', TUE = '2027-06-08';   // weekdays checked with `date -d`
const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const period = (day, oh, ch) => ({ open: { day, hour: oh, minute: 0 }, close: { day, hour: ch, minute: 0 } });
/** A snapshot with these Google periods and these weekday lines (Monday first, as Google lists them). */
const snapOf = (periods, lines, place_id = 'FixtureP13bHours01') => ({ build_id: 'b0', place_id, fetched_at: '2027-06-01T12:00:00.000Z', location: { lat: 40.01, lng: -70.01 },
  content: { display_name: 'Fixture', address: 'Minibury', business_status: 'OPERATIONAL', hours: { periods, weekday_descriptions: lines }, current_hours: null, rating: null, review_count: null, website: null, maps_uri: null, time_zone: 'America/New_York' } });
/** Closed on Mondays; every other line carries Google's holiday caveat "Hours might differ". */
const MONDAY_CLOSED_PERIODS = [0, 2, 3, 4, 5, 6].map((d) => period(d, 10, 17));
const MONDAY_CLOSED_LINES = [1, 2, 3, 4, 5, 6, 0].map((d) => (d === 1 ? 'Monday: Closed' : `${WD[d]}: 10:00 AM – 5:00 PM · Hours might differ`));

async function oneDay({ keep, tweak = (p) => p, snap = (s) => s, date = MON }) {
  const w = W.world({ day_end: '17:30' });
  w.trip.start_date = date; w.trip.end_date = date;
  w.trip.lodging[0].from = date;
  w.places = w.places.filter((p) => keep.includes(p.id)).map(tweak);
  w.snapshots = w.snapshots.map(snap);
  const k = await K();
  const maps = k.createMapsClient({ transport: k.createMockTransport(W.responder), ledger: k.createLedger() });
  return (await planner()).planTrip({ ...w, maps, build_id: 'p13b', now: '2027-06-01T09:00:00Z', seed: 3 });
}
const laterItem = (plan, id) => plan.later.flatMap((l) => l.items).find((i) => i.place === id);

// ---- A7: irregular wording affects only its own weekday --------------------------------------------------------------

test('A7: a place closed on Mondays whose other lines say "hours might differ" stays off a Monday and opens on Tuesday', async () => {
  const { hoursOn, irregularText, irregularWeekdays } = await planner();
  const snap = snapOf(MONDAY_CLOSED_PERIODS, MONDAY_CLOSED_LINES);
  assert.equal(irregularText(snap), true, 'Google\'s text does say the hours vary somewhere (still exported, unchanged)');
  assert.deepEqual(hoursOn(snap, MON), { status: 'closed', windows: [] }, 'fault: the Tuesday caveat made Monday irregular');
  assert.deepEqual(hoursOn(snap, TUE), { status: 'open', windows: [{ open: 600, close: 1020 }] });
  assert.deepEqual([...irregularWeekdays(snap)], [0, 2, 3, 4, 5, 6], 'the caveat varies its own weekdays only (open on Google\'s hours anyway); Monday is not among them');
  const plan = await oneDay({ keep: ['lantern-museum', 'river-market'], snap: (s) => (s.place_id === 'FixtureMiniMuseum01' ? snapOf(MONDAY_CLOSED_PERIODS, MONDAY_CLOSED_LINES, s.place_id) : s) });
  assert.ok(!plan.days[0].stops.some((s) => s.place === 'lantern-museum'), 'not scheduled on its closed Monday');
  assert.equal(laterItem(plan, 'lantern-museum').code, 'closed_day');
  const tue = await oneDay({ date: TUE, keep: ['lantern-museum', 'river-market'], snap: (s) => (s.place_id === 'FixtureMiniMuseum01' ? snapOf(MONDAY_CLOSED_PERIODS, MONDAY_CLOSED_LINES, s.place_id) : s) });
  const stop = tue.days[0].stops.find((s) => s.place === 'lantern-museum');
  assert.ok(stop && !stop.check_on_day, 'planned on Tuesday on its known hours, no check line');
});

test('A7: a line that says the hours vary makes that weekday irregular (never closed, known windows); a "Closed" line stays closed', async () => {
  const { hoursOn, irregularWeekdays } = await planner();
  // Google has hours for Saturday only; Monday's line says the hours vary, Tuesday's says closed
  const lines = ['Monday: Hours vary', 'Tuesday: Closed', 'Wednesday: Closed', 'Thursday: Closed', 'Friday: Closed', 'Saturday: 8:00 AM – 2:00 PM', 'Sunday: Closed'];
  const snap = snapOf([period(6, 8, 14)], lines);
  assert.deepEqual([...irregularWeekdays(snap)], [1]);
  assert.deepEqual(hoursOn(snap, MON), { status: 'irregular', windows: [{ open: 480, close: 840 }] });
  assert.deepEqual(hoursOn(snap, TUE), { status: 'closed', windows: [] });
  // the same lines in another order map by their weekday names
  const shuffled = snapOf([period(6, 8, 14)], [lines[6], lines[1], lines[0], lines[2], lines[3], lines[4], lines[5]]);
  assert.deepEqual([...irregularWeekdays(shuffled)], [1], 'a line\'s weekday name wins over its position');
  assert.equal(hoursOn(shuffled, MON).status, 'irregular');
  assert.equal(hoursOn(shuffled, TUE).status, 'closed');
  // no names: Google's order, Monday first
  const bare = snapOf([], ['Hours vary', 'Closed', 'Closed', 'Closed', 'Closed', 'Closed', 'Closed']);
  assert.equal(hoursOn(bare, MON).status, 'irregular');
  assert.equal(hoursOn(bare, TUE).status, 'closed');
  // stronger wording on a closed line ("closed irregularly") still varies; the record's own flag still wins everywhere
  const strong = snapOf([period(6, 8, 14)], ['Monday: Closed (irregular)', ...lines.slice(1)]);
  assert.equal(hoursOn(strong, MON).status, 'irregular');
  assert.equal(hoursOn(snapOf([period(6, 8, 14)], lines), TUE, { irregular: true }).status, 'irregular', 'Phase 10: the place\'s own record');
});

// ---- B7: the place's own site posts its opening days ------------------------------------------------------------------

const OWN = (f = {}) => ({ checked: '2027-05-20', sources: [{ url: 'https://hall.example.org/', title: 'Own site', accessed: '2027-05-20' }], ...f });
const ALL_CLOSED = [0, 1, 2, 3, 4, 5, 6];

test('B7: a place whose own facts say irregular, with all seven weekdays written as closed, is planned with its check line', async () => {
  const { CHECK_IRREGULAR_TEXT } = await import('../packs/tour-guide/planner/planner-day.mjs');
  const tweak = (on) => (p) => (p.id === 'saturday-cafe' ? { ...p, name: 'Lantern Hall', category: 'temple', activity: 'temple grounds', facts: OWN({ closed_weekdays: ALL_CLOSED, ...(on ? { irregular: true } : {}) }) } : p);
  const before = await oneDay({ keep: ['saturday-cafe', 'river-market'], tweak: tweak(false) });
  assert.equal(laterItem(before, 'saturday-cafe').code, 'closed_day', 'without the flag: every weekday closed, as research wrote it');
  const after = await oneDay({ keep: ['saturday-cafe', 'river-market'], tweak: tweak(true) });
  const stop = after.days[0].stops.find((s) => s.place === 'saturday-cafe');
  assert.ok(stop, 'fault fixed: back in the plan');
  assert.equal(stop.check_on_day, CHECK_IRREGULAR_TEXT, 'check on the day');
  assert.ok(stop.arrive >= '08:00' && stop.depart <= '14:00', 'within the hours Google knows');
  assert.ok(!after.days[0].warnings.some((x) => x.place === 'saturday-cafe' && /closed on/.test(x.text)), 'no closed-day conflict');
  const s = await schemas();
  assert.ok(s.validate(after, 'plan').ok);
});

test('B7: factsHours — an irregular place keeps own closed weekdays that leave a day open; Google-closed dates become irregular', async () => {
  const { placeFacts, factsHours, hoursOn, ownHoursConflict } = await planner();
  const google = snapOf([period(6, 8, 14)], ['Monday: Closed', 'Tuesday: Closed', 'Wednesday: Closed', 'Thursday: Closed', 'Friday: Closed', 'Saturday: 8:00 AM – 2:00 PM', 'Sunday: Closed']);
  const at = (f, d, extra = {}) => factsHours(hoursOn(google, d), placeFacts({ ...extra, facts: OWN(f) }), d, google, 'Lantern Hall');
  // closed on Mondays by its own site, irregular otherwise: Monday stays closed, Tuesday is irregular on the known hours
  assert.deepEqual(at({ irregular: true, closed_weekdays: [1] }, MON).hours, { status: 'closed', windows: [], own: true });
  assert.deepEqual(at({ irregular: true, closed_weekdays: [1] }, TUE).hours, { status: 'irregular', windows: [{ open: 480, close: 840 }], own: true });
  // all seven closed: closes nothing
  assert.deepEqual(at({ irregular: true, closed_weekdays: ALL_CLOSED }, MON).hours, { status: 'irregular', windows: [{ open: 480, close: 840 }], own: true });
  assert.equal(at({ closed_weekdays: ALL_CLOSED }, MON).hours.status, 'closed', 'without the flag: as before');
  // the place-level opening_days: "irregular" counts the same
  assert.equal(placeFacts({ opening_days: 'irregular', facts: OWN() }).irregular, true);
  assert.equal(at({ closed_weekdays: ALL_CLOSED }, MON, { opening_days: 'irregular' }).hours.status, 'irregular');
  // unknown Google hours become irregular too
  const none = snapOf([], []);
  assert.equal(factsHours(hoursOn(none, MON), placeFacts({ facts: OWN({ irregular: true }) }), MON, none, 'x').hours.status, 'irregular');
  // no closed_day conflict for such a place (Google open, own all closed)
  const open = snapOf([0, 1, 2, 3, 4, 5, 6].map((d) => period(d, 9, 17)), []);
  const conflict = (f) => ownHoursConflict(placeFacts({ facts: OWN(f) }), hoursOn(open, MON), MON, 'Lantern Hall');
  assert.match(conflict({ closed_weekdays: ALL_CLOSED }), /closed on Mondays/, 'without the flag: the conflict is raised');
  assert.equal(conflict({ closed_weekdays: ALL_CLOSED, irregular: true }), null);
  const fc = (await facts()).factsConflict;
  assert.deepEqual(fc(OWN({ closed_weekdays: [1], irregular: true }), open.content.hours, MON).items.map((x) => x.kind), []);
  assert.deepEqual(fc(OWN({ closed_weekdays: [1] }), open.content.hours, MON).items.map((x) => x.kind), ['closed_day']);
});

test('B7: placeFacts returns irregular and irregular_note; the check note is opening_note, then irregular_note', async () => {
  const { placeFacts, placeCheckNote } = await planner();
  assert.deepEqual([placeFacts({ facts: OWN() }).irregular, placeFacts({ facts: OWN() }).irregular_note], [false, null]);
  const f = placeFacts({ facts: OWN({ irregular: true, irregular_note: 'Open days are posted on the site each month' }) });
  assert.deepEqual([f.irregular, f.irregular_note], [true, 'Open days are posted on the site each month']);
  assert.equal(placeCheckNote({ facts: OWN({ irregular: true, irregular_note: '  Posted monthly ' }) }), 'Posted monthly');
  assert.equal(placeCheckNote({ opening_note: 'Opens on festival days', facts: OWN({ irregular: true, irregular_note: 'Posted monthly' }) }), 'Opens on festival days');
  assert.equal(placeCheckNote({ facts: OWN() }), null);
  assert.equal(placeCheckNote(null), null);
  assert.equal(placeCheckNote({ opening_note: 'x'.repeat(200) }).length, 160);
});

test('B7: facts lines say "Opening days vary" only for an irregular place; an old place\'s lines are byte for byte the same', async () => {
  const { factsLines } = await facts();
  const old = { checked: '2027-03-01', sources: [{ url: 'https://garden.example.org/', title: 'Site', accessed: '2027-03-01' }], last_entry: '16:30', close: '17:00', visit_minutes: { min: 60, max: 90 }, closed_weekdays: [1, 2], gate_name: 'East Gate', booking: { required: true, lead: '2 days', how: 'online' }, price: { text: '800 yen' }, payment: 'cash only', menu: { checked: '2027-03-01', fits: 'partly', note: 'ask' } };
  // pinned from the code before this phase
  assert.deepEqual(factsLines(old, { now: '2027-06-01', diet: 'vegetarian' }), { facts_line: 'Last entry 16:30 · closes 17:00 · about 60–90 min · closed Mondays and Tuesdays · enter at East Gate · official site, checked Mar 2027', booking_line: 'Book 2 days online', price_line: '800 yen · cash only · menu partly fits vegetarian', menu_checked: '2027-03-01' });
  assert.deepEqual(factsLines(old, { now: '2027-03-10', diet: 'vegetarian' }).facts_line, 'Last entry 16:30 · closes 17:00 · about 60–90 min · closed Mondays and Tuesdays · enter at East Gate · official site');
  assert.equal(factsLines({ ...old, irregular: true, irregular_note: 'posted monthly' }, { now: '2027-03-10' }).facts_line, 'Opening days vary: posted monthly · last entry 16:30 · closes 17:00 · about 60–90 min · closed Mondays and Tuesdays · enter at East Gate · official site');
  assert.equal(factsLines(OWN({ irregular: true, closed_weekdays: ALL_CLOSED }), { now: '2027-05-21' }).facts_line, 'Opening days vary · official site', 'never "closed every day" for a place whose days vary');
});

test('B7: the place schema, normalizeFacts and checkPlace accept irregular and irregular_note at their bounds only', async () => {
  const s = await schemas();
  const { normalizeFacts } = await facts();
  const place = (f) => ({ v: 1, id: 'lantern-hall', place_id: 'FixtureP13bHall01', name: 'Lantern Hall', category: 'temple', tags: [], status: 'candidate', activity: 'temple grounds', priority: 2, facts: OWN(f) });
  for (const f of [{ irregular: true }, { irregular: true, irregular_note: 'x' }, { irregular: true, irregular_note: 'y'.repeat(160) }, { irregular_note: 'Posted monthly' }]) {
    assert.ok(s.validate(place(f), 'place').ok, JSON.stringify(f));
    assert.equal(normalizeFacts(OWN(f)).ok, true);
  }
  const bad = [[{ irregular: false }, '/facts/irregular'], [{ irregular: 'yes' }, '/facts/irregular'], [{ irregular: true, irregular_note: '' }, '/facts/irregular_note'], [{ irregular: true, irregular_note: 'z'.repeat(161) }, '/facts/irregular_note'], [{ irregular_days: [1] }, '/facts/irregular_days']];
  for (const [f, path] of bad) {
    const r = s.validate(place(f), 'place');
    assert.ok(!r.ok && r.errors.some((e) => e.path === path), JSON.stringify(f) + ' → ' + JSON.stringify(r.errors));
    assert.equal(normalizeFacts(OWN(f)).ok, false);
  }
  assert.equal(normalizeFacts(OWN({ irregular: true, irregular_note: '   ' })).ok, false, 'trimmed to empty');
  const blank = s.validate(place({ irregular: true, irregular_note: '   ' }), 'place');
  assert.ok(!blank.ok && blank.errors.some((e) => e.path === '/facts/irregular_note'), 'checkPlace: a note of spaces only');
});

// ---- A14: the rain swaps know irregular places ------------------------------------------------------------------------

test('A14: the rain options call an irregular place\'s hours unknown, not closed', async () => {
  const { rainSwaps } = await planner();
  const w = W.world();
  // an indoor gallery Google lists for Saturdays only; the day is a Monday next to the outdoor park
  const gallery = (extra) => ({ v: 1, id: 'lantern-hall', place_id: 'FixtureP13bHall01', name: 'Lantern Hall', category: 'museum', tags: [], status: 'candidate', ...extra });
  const park = w.places.find((p) => p.id === 'green-park');
  const snapshots = new Map(w.snapshots.map((s) => [s.place_id, s]));
  snapshots.set('FixtureP13bHall01', { ...snapOf([period(6, 8, 14)], ['Monday: Closed', 'Tuesday: Closed', 'Wednesday: Closed', 'Thursday: Closed', 'Friday: Closed', 'Saturday: 8:00 AM – 2:00 PM', 'Sunday: Closed'], 'FixtureP13bHall01'), location: { lat: 40.016, lng: -70.002 } });
  const day = { date: MON, mode: 'TRANSIT', stops: [{ place: 'green-park', place_id: park.place_id }] };
  const swaps = (extra) => rainSwaps({ day, places: [park, gallery(extra)], snapshots });
  assert.deepEqual(swaps({}), [], 'Google says closed on Monday and the place says nothing: no swap');
  assert.deepEqual(swaps({ opening_days: 'irregular' }).map((x) => [x.place, x.hours]), [['lantern-hall', 'unknown']], 'fault fixed: the place\'s own record');
  assert.deepEqual(swaps({ facts: OWN({ irregular: true }) }).map((x) => [x.place, x.hours]), [['lantern-hall', 'unknown']], 'the facts\' flag too');
  assert.deepEqual(swaps({ facts: OWN({ irregular: true, closed_weekdays: [1] }) }), [], 'its own closed Monday still rules it out');
});

// Developed by: LightAISolutions
