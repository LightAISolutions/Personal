'use strict';
// Tour Guide Phase 10 (WP-10b) — the six tidy-up fixes (a)–(f). Each fix has a "before" assertion (what the Phase 9 code
// got wrong, pinned against the real function) and an "after" assertion (the fixed behaviour). Invented places only.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const W = require('./pack_tour-guide_planner_world.js');
const planner = () => import('../packs/tour-guide/planner/index.mjs');
const gems = () => import('../packs/tour-guide/gems/index.mjs');
const estimator = () => import('../packs/tour-guide/estimator/index.mjs');

// ---- (b) temple, shrine, garden, experience --------------------------------------------------------------------------

test('(b) Google types map to the new categories (Phase 9 filed temples under church, shrines under other, gardens under park)', async () => {
  const { categoryOf } = await gems();
  const rec = (primary_type, extra = {}) => ({ place_id: 'FixtureCat0001', name: 'Fixture', primary_type, types: [primary_type], ...extra });
  assert.equal(categoryOf(rec('buddhist_temple')), 'temple');
  assert.equal(categoryOf(rec('hindu_temple')), 'temple');
  assert.equal(categoryOf(rec('shinto_shrine')), 'shrine');
  assert.equal(categoryOf(rec('botanical_garden')), 'garden');
  assert.equal(categoryOf(rec('garden')), 'garden');
  assert.equal(categoryOf(rec('cultural_center')), 'experience');
  assert.equal(categoryOf(rec('church')), 'church', 'a church stays a church');
  assert.equal(categoryOf(rec('park')), 'park');
  assert.equal(categoryOf({ ...rec('place_of_worship'), category: 'church', name: 'Hollow-ji' }), 'temple', 'a stored legacy church is refined on load');
});

test('(b) refineCategory: legacy churches named as temples or shrines, sessions filed as neighbourhoods', async () => {
  const { refineCategory, withRefinedCategory } = await planner();
  assert.equal(refineCategory({ category: 'church', name: 'Lantern Shrine' }), 'shrine');
  assert.equal(refineCategory({ category: 'church', name: 'Fox Jinja' }), 'shrine');
  assert.equal(refineCategory({ category: 'church', name: 'Pine-ji' }), 'temple');
  assert.equal(refineCategory({ category: 'church', name: 'Quiet Temple' }), 'temple');
  assert.equal(refineCategory({ category: 'church', name: 'St Brannoc Church' }), 'church');
  assert.equal(refineCategory({ category: 'neighbourhood', name: 'Old Lane', activity: 'tea ceremony in a townhouse' }), 'experience');
  assert.equal(refineCategory({ category: 'neighbourhood', name: 'Old Lane', activity: 'stroll the lanes' }), 'neighbourhood');
  assert.equal(refineCategory({ category: 'museum', name: 'Temple Museum' }), 'museum', 'only church records are renamed');
  const p = { category: 'church', name: 'Pine-ji' };
  assert.notEqual(withRefinedCategory(p), p);
  assert.equal(p.category, 'church', 'never mutates the stored record');
});

test('(b) the planner times a legacy "church" temple as a temple (45 min, was 30) and a garden as a garden', async () => {
  const { prepare } = await planner();
  const { chooseMinutes, categoryDefault } = await estimator();
  const w = W.world();
  assert.equal(categoryDefault('church'), 30, 'before: the church default');
  const places = [
    { v: 1, id: 'pine-ji', place_id: 'FixtureTidyTemple01', name: 'Pine-ji', category: 'church', tags: [], status: 'candidate', activity: 'temple grounds', priority: 2 },
    { v: 1, id: 'moss-garden', place_id: 'FixtureTidyGarden02', name: 'Moss Garden', category: 'garden', tags: [], status: 'candidate', activity: 'garden walk', priority: 2 }
  ];
  const ctx = await prepare({ trip: w.trip, places, snapshots: [], estimates: [], profile: {}, chooseMinutes });
  const by = Object.fromEntries(ctx.cands.map((c) => [c.id, c]));
  assert.equal(by['pine-ji'].category, 'temple');
  assert.equal(by['pine-ji'].minutes, 45);
  assert.equal(by['moss-garden'].minutes, 60);
});

// ---- (c) rain swaps name covered sights only -------------------------------------------------------------------------

function rainWorld(extra) {
  const snap = (id, lat, lng) => [id, { place_id: id, location: { lat, lng }, content: { business_status: 'OPERATIONAL', hours: null } }];
  const P = (id, place_id, category, o = {}) => ({ v: 1, id, place_id, name: id, category, tags: [], status: 'candidate', activity: 'visit', priority: 2, ...o });
  const rows = [['park', 'PidPark0001', 'park', 40, -70], ...extra];
  return {
    snapshots: new Map(rows.map((r) => snap(r[1], r[3], r[4]))),
    places: rows.map((r) => P(r[0], r[1], r[2], r[5])),
    day: { date: '2027-06-08', mode: 'TRANSIT', stops: [{ place: 'park', place_id: 'PidPark0001' }] }
  };
}

test('(c) a rain swap is never a meal or a shop (Phase 9 offered the nearest restaurant instead of a park)', async () => {
  const { rainSwaps, isIndoor, isCoveredSight } = await planner();
  const { day, places, snapshots } = rainWorld([
    ['noodle-bar', 'PidNoodle001', 'restaurant', 40.0005, -70], ['corner-cafe', 'PidCafe00001', 'cafe', 40.0006, -70],
    ['gift-shop', 'PidShop00001', 'shop', 40.0007, -70], ['tile-museum', 'PidMuseum001', 'museum', 40.004, -70]
  ]);
  assert.equal(isIndoor(places[1]), true, 'before: a restaurant counted as an indoor swap');
  assert.equal(isCoveredSight(places[1]), false);
  assert.deepEqual(rainSwaps({ day, places, snapshots }).map((r) => r.place), ['tile-museum']);
});

test('(c) covered sights: indoor markets and sessions count, open markets and indoor:false never do; no sight, no swap', async () => {
  const { rainSwaps, isCoveredSight } = await planner();
  assert.equal(isCoveredSight({ category: 'market' }), false);
  assert.equal(isCoveredSight({ category: 'market', indoor: true }), true);
  assert.equal(isCoveredSight({ category: 'museum', indoor: false }), false);
  assert.equal(isCoveredSight({ category: 'neighbourhood', activity: 'pottery workshop' }), true, 'a session filed as a neighbourhood');
  assert.equal(isCoveredSight({ category: 'restaurant', indoor: true }), false);
  assert.equal(isCoveredSight({ category: 'church', name: 'Pine-ji' }), false, 'a refined temple is outdoor');
  const a = rainWorld([['fish-hall', 'PidFishHall1', 'market', 40.001, -70, { indoor: true }], ['open-market', 'PidOpenMkt01', 'market', 40.0005, -70]]);
  assert.deepEqual(rainSwaps(a).map((r) => r.place), ['fish-hall']);
  const b = rainWorld([['noodle-bar', 'PidNoodle001', 'restaurant', 40.0005, -70]]);
  assert.deepEqual(rainSwaps(b), [], 'no swap is better than a meal');
});

// ---- (d) a dropped place says how short it was and offers a shorter visit ---------------------------------------------

const K = () => import('../kits/maps/index.mjs');
/** One-day Minibury plan with only `keep` places; `tweak(place)` may change a place, `cm` replaces chooseMinutes. */
async function oneDay({ day_end = '15:30', keep, tweak = (p) => p, cm = null, snap = (s) => s }) {
  const w = W.world({ day_end });
  w.trip.end_date = w.trip.start_date;
  w.places = w.places.filter((p) => keep.includes(p.id)).map(tweak);
  w.snapshots = w.snapshots.map(snap);
  const k = await K();
  const maps = k.createMapsClient({ transport: k.createMockTransport(W.responder), ledger: k.createLedger() });
  const p = await planner();
  return p.planTrip({ ...w, ...(cm ? { chooseMinutes: cm } : {}), maps, build_id: 'tidy', now: '2027-06-01T09:00:00Z', seed: 3 });
}
const laterItem = (plan, id) => plan.later.flatMap((l) => l.items).find((i) => i.place === id);

test('(d) a pick dropped as "no room left" says how many minutes it was short and offers a visit that fits', async () => {
  const plan = await oneDay({ keep: ['lantern-museum', 'river-market', 'tile-workshop', 'green-park'] });
  const item = laterItem(plan, 'green-park');
  assert.equal(item.code, 'day_full');
  assert.ok(item.reason.startsWith('no room left on Mon 7 Jun for Green Park'), 'before: Phase 9 stopped at "no room left"'); // WP-12d: date in words
  assert.match(item.reason, /: \d+ min short; a 50-minute visit would fit (after|before) [A-Z]/, 'after: minutes short and an offer');
  const short = Number(/: (\d+) min short/.exec(item.reason)[1]);
  assert.ok(short > 0 && short < 60 - 30, 'shorter than the visit, and a sensible-minimum visit (park: 20 min) fits');
  assert.ok(item.reason.length <= 300);
  const w = plan.days[0].warnings.find((x) => x.place === 'green-park');
  assert.ok(w && w.text.startsWith('Green Park did not fit: ') && w.text.length <= 200, 'the day warns too');
  assert.ok(w.text.includes(`${short} min short`));
});

test('(d) the offer is real: re-planning with the offered length keeps the place in the day', async () => {
  const first = await oneDay({ keep: ['lantern-museum', 'river-market', 'tile-workshop', 'green-park'] });
  const offered = Number(/a (\d+)-minute visit/.exec(laterItem(first, 'green-park').reason)[1]);
  const cm = ({ typical, category }) => ({ minutes: category === 'park' ? offered : typical || 60, confidence: 'single-source', factors: {} });
  const second = await oneDay({ keep: ['lantern-museum', 'river-market', 'tile-workshop', 'green-park'], cm });
  assert.ok(second.days[0].stops.some((s) => s.place === 'green-park' && s.minutes === offered), 'a visit of the offered length is scheduled');
});

test('(d) a set session is never offered shorter; a day already over its end offers nothing', async () => {
  const cm = ({ typical, category }) => (category === 'park' ? { minutes: 60, confidence: 'single-source', factors: {}, fixed: true } : { minutes: typical || 60, confidence: 'single-source', factors: {} });
  const fixed = await oneDay({ keep: ['lantern-museum', 'river-market', 'tile-workshop', 'green-park'], cm });
  const r = laterItem(fixed, 'green-park').reason;
  assert.match(r, /: \d+ min short$/, 'minutes short, no shorter visit offered');
  const full = await oneDay({ day_end: '13:30', keep: ['lantern-museum', 'river-market', 'tile-workshop', 'green-park'] });
  assert.match(laterItem(full, 'green-park').reason, /: 60 min short$/, 'no gap at all: the whole visit is short, no offer');
});

// ---- (e) irregular or unknown opening days stay in the plan, marked "check on the day" --------------------------------

const irregularTweak = (p) => (p.id === 'saturday-cafe' ? { ...p, name: 'Lantern Hall', category: 'temple', activity: 'temple grounds', opening_days: 'irregular', opening_note: 'Opens on irregular days, posted online the week before.' } : p);

test('(e) a place whose own record says its opening days are irregular is kept within its known hours, with check_on_day', async () => {
  const { hoursOn } = await planner();
  const w = W.world();
  const snap = w.snapshots.find((s) => s.place_id === 'FixtureMiniCafe09');
  assert.equal(hoursOn(snap, '2027-06-07').status, 'closed', 'before: Google lists Saturday hours only, so a Monday reads closed');
  const before = await oneDay({ keep: ['saturday-cafe', 'river-market'], tweak: (p) => (p.id === 'saturday-cafe' ? { ...irregularTweak(p), opening_days: undefined } : p) });
  assert.equal(laterItem(before, 'saturday-cafe').reason, 'Lantern Hall is closed on every day of the trip', 'without the record: dropped as Phase 9 did');
  assert.deepEqual(hoursOn(snap, '2027-06-07', { irregular: true }), { status: 'irregular', windows: [{ open: 480, close: 840 }] });
  const after = await oneDay({ keep: ['saturday-cafe', 'river-market'], tweak: irregularTweak });
  const stop = after.days[0].stops.find((s) => s.place === 'saturday-cafe');
  assert.ok(stop, 'after: kept in the plan');
  assert.equal(stop.check_on_day, 'Opens on irregular days, posted online the week before.');
  assert.ok(stop.arrive >= '08:00' && stop.depart <= '14:00', 'within the hours Google knows (08:00–14:00)');
  assert.ok(after.days[0].warnings.some((x) => x.code === 'hours_unknown' && x.place === 'saturday-cafe'));
  const s = await import('../packs/tour-guide/schemas/index.mjs');
  assert.ok(s.validate(after, 'plan').ok);
});

test('(e) Google text that says the hours vary counts as irregular; unknown hours get check_on_day too', async () => {
  const { hoursOn, CHECK_IRREGULAR_TEXT, CHECK_UNKNOWN_TEXT } = { ...(await planner()), ...(await import('../packs/tour-guide/planner/planner-day.mjs')) };
  const vary = (s) => (s.place_id === 'FixtureMiniCafe09' ? { ...s, content: { ...s.content, hours: { periods: [], weekday_descriptions: ['Monday: Hours vary', 'Tuesday: Closed', 'Wednesday: Closed', 'Thursday: Closed', 'Friday: Closed', 'Saturday: Hours vary', 'Sunday: Closed'] } } } : s);   // A7 (Phase 13): the varying line is Monday's own; a Saturday line no longer re-opens Monday
  const snap = vary(W.world().snapshots.find((x) => x.place_id === 'FixtureMiniCafe09'));
  assert.equal(hoursOn(snap, '2027-06-07').status, 'irregular');
  assert.equal(hoursOn(snap, '2027-06-08').status, 'closed', 'A7 (Phase 13): Tuesday\'s "Closed" line stays closed');
  const plan = await oneDay({ keep: ['saturday-cafe', 'hill-viewpoint'], snap: vary });
  const by = Object.fromEntries(plan.days[0].stops.map((x) => [x.place, x]));
  assert.equal(by['saturday-cafe'].check_on_day, CHECK_IRREGULAR_TEXT);
  assert.equal(by['hill-viewpoint'].check_on_day, CHECK_UNKNOWN_TEXT, 'Google gave no hours');
  assert.equal(by['saturday-cafe'].window, null, 'no known hours: no window');
});

// ---- (f) rough times on sights, exact times on bookings, sessions and last entries ------------------------------------

test('(f) time_style: about on sights, exact on bookings, sessions, experiences and a stop near its last entry', async () => {
  const { timeStyle, EXACT_NEAR_LAST_ENTRY, LAST_ENTRY_BEFORE_CLOSE } = await import('../packs/tour-guide/planner/planner-day.mjs');
  assert.deepEqual([EXACT_NEAR_LAST_ENTRY, LAST_ENTRY_BEFORE_CLOSE], [30, 30]);
  const sight = { category: 'museum' }, w = { open: 600, close: 1020 };
  assert.equal(timeStyle(sight, 660, w), 'about');
  assert.equal(timeStyle(sight, 960, w), 'exact', '16:00 into a 17:00 close: last entry 16:30 is within 30 min');
  assert.equal(timeStyle(sight, 929, w), 'about');
  assert.equal(timeStyle({ category: 'restaurant', booking: { time: 780 } }, 780, null), 'exact', 'a meal with a booking');
  assert.equal(timeStyle({ category: 'restaurant' }, 780, null), 'about', 'an unbooked meal');
  assert.equal(timeStyle({ category: 'experience' }, 600, null), 'exact');
  assert.equal(timeStyle({ category: 'neighbourhood', fixed: true }, 600, null), 'exact', 'a set session');
  assert.equal(timeStyle(sight, 1400, { open: 0, close: 1440 }), 'about', 'open all day has no last entry');
});

test('(f) every planned stop carries time_style; Phase 9 stops had none (absent means exact)', async () => {
  const plan = await oneDay({ day_end: '18:00', keep: ['lantern-museum', 'old-church', 'tile-workshop', 'river-market'], tweak: (p) => (p.id === 'old-church' ? { ...p, booking: { ...p.booking, date: '2027-06-07' } } : p) });
  const by = Object.fromEntries(plan.days[0].stops.map((x) => [x.place, x]));
  assert.ok(plan.days[0].stops.every((x) => x.time_style === 'about' || x.time_style === 'exact'));
  assert.equal(by['old-church'].time_style, 'exact', 'booked');
  assert.equal(by['lantern-museum'].time_style, 'about');
  const s = await import('../packs/tour-guide/schemas/index.mjs');
  assert.ok(s.validate(plan, 'plan').ok);
  const old = JSON.parse(JSON.stringify(plan.days[0]));
  for (const x of old.stops) delete x.time_style;
  assert.ok(s.validate(old, 'day-plan').ok, 'a Phase 9 DayPlan without time_style still validates');
});

// Developed by: LightAISolutions
