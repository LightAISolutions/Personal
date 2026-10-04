'use strict';
// WP-13c item 6 (A16): every free-text length bound of the ten payload schemas gives the same answer in the pack's
// validator (schemas/index.mjs) and in the core's mirror (the registered GAS validator, after its hidden-character
// cleaning) — at the bound and one past it, written in kanji, in emoji (surrogate pairs) and with combining marks.
// The walk is driven by the schemas, so a bound added later is probed too. Invented data only.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const W = require('./pack_tour-guide_p13c_world');

const clone = (x) => JSON.parse(JSON.stringify(x));
const made = [];
after(() => { for (const d of made) fs.rmSync(d, { recursive: true, force: true }); });
const MAPS = 'https://www.google.com/maps/search/?api=1&query=Fixture&query_place_id=FixtureFhReedMill';
const CORE = { prefs_review: 'tgEnvValidatePrefsReview', shortlist: 'tgEnvValidateShortlist', trip_facts: 'tgEnvValidateTripFacts',
  plan_digest: 'tgEnvValidatePlanDigest', profile_summary: 'tgEnvValidateProfileSummary', places_digest: 'tgEnvValidatePlacesDigest',
  bookings: 'tgEnvValidateBookings', scout: 'tgEnvValidateScout', outline: 'tgEnvValidateOutline', day_versions: 'tgEnvValidateDayVersions' };
/** One "character" of each kind and its UTF-16 length: a kanji (1), an emoji (a surrogate pair, 2), e + a combining acute (2). */
const UNITS = { kanji: '漢', emoji: '😀', combining: 'é' };
/** A string of exactly n UTF-16 units made of `unit` (padded with 'a' when the unit does not divide n). */
const fill = (unit, n) => unit.repeat(Math.floor(n / unit.length)) + 'a'.repeat(n % unit.length);

// Example payloads, every field filled where the schema allows (invented: the town Fernhollow).
const item = (n, slug, over = {}) => ({ n, slug, name: slug.replace(/-/g, ' '), why_you: 'Quiet in the morning.', fit: 0.8, est_minutes: 60,
  area: 'Old Town', maps_url: MAPS, labels: ['verified'], ...over });
const EXAMPLES = {
  shortlist: () => ({ v: 1, kind: 'shortlist', trip: 'fernhollow', run_id: 'r-2027-05-01-a', round: 1, more: true, decided: [],
    groups: [{ id: 'activities', gems_wanted: 2, gems_shown: 1, items: [item(1, 'reed-mill', { place_id: 'FixtureFhReedMill', new: true,
      gem: true, gem_line: 'Rated well by few.', seen_before: { trip: 'fernhollow-2026', on: '2026-10-04', outcome: 'skipped' },
      changes: ['Opens late on Fridays.'], dims: [{ dimension: 'interests', value: 'mills' }] })] }] }),
  trip_facts: () => ({ v: 1, kind: 'trip_facts', trip: 'fernhollow',
    found: [{ n: 1, kind: 'lodging', text: 'Reed Inn, three nights', start: '2027-06-10', end: '2027-06-13' }], missing: ['flight'] }),
  plan_digest: () => clone(W.digest({ tz: 'Europe/Lisbon', days: [{ date: '2027-06-10', theme: 'Mill race', spare_minutes: 30,
    stops: [{ ...W.stop(1, 'reed-mill', 'Reed Mill'), time_style: 'about', check_on_day: 'Check the wheel runs.' }],
    legs: [{ from: 'lodging', to: 'reed-mill', mode: 'WALK', minutes: 9 }], warnings: ['Lunch is tight.'] }],
    later: [{ slug: 'pear-walk', name: 'Pear Walk', reason: 'kept for later' }] })),
  profile_summary: () => ({ v: 1, kind: 'profile_summary', text: 'Relaxed pace; mills first.', dimensions_count: 3, updated: '2027-04-28T08:15:00Z' }),
  places_digest: () => ({ v: 1, kind: 'places_digest', destination: 'fernhollow', places: [{ slug: 'reed-mill', name: 'Reed Mill', area: 'Old Town',
    category: 'sight', tags: ['indoor'], status: 'candidate', last_trip: null, last_researched: '2027-05-01', last_verified: null,
    note_line: 'Quiet before noon.', maps_url: MAPS, history_summary: 'seen in 2026', scouted: true }] }),
  bookings: () => ({ v: 1, kind: 'bookings', trip: 'fernhollow', tz: 'Europe/Lisbon', bookings: [{ id: 'mill-tour', title: 'Mill tour', kind: 'sight',
    rule: 'Two people; opens 14 days ahead.', status: 'todo', place: 'reed-mill', for_date: '2027-06-11', opens_at: '2027-05-28T10:00:00+01:00',
    book_by: '2027-06-10T18:00:00+01:00', how: 'mill website', party_min: 2, url: 'https://tickets.example.org/mill', note: 'Mornings go first.',
    source: 'mill site', updated: '2027-04-20' }] }),
  scout: () => ({ v: 1, kind: 'scout', scout_id: 'sc-20270501-cider', query: 'cider', destination: 'fernhollow', place_label: 'Fernhollow',
    trip: 'fernhollow', group: 'food', created_on: '2027-05-01', from: 'your inn', diet: 'vegetarian',
    items: [{ n: 1, slug: 'pear-press', name: 'Pear Press', area: 'Old Town', category: 'cafe', score: 81, parts: { topic: 90, quality: 74, fit: 60, reach: 88 },
      why_you: 'Named for cider.', try: 'Pear cider', labels: ['gem'], rated: 'very well rated', reach: { minutes: 9, mode: 'WALK', estimated: false },
      maps_url: MAPS, place_id: 'FixtureFhPearPress' }],
    left_out: [{ name: 'Quay Grill', reason: 'off_topic' }], more: 2, drive: { board_html: 'fixtureDriveScoutBoardFh', board_pdf: null } }),
  outline: () => ({ v: 1, kind: 'outline', trip: 'fernhollow', build_id: 'ol-fernhollow-1', notes: 'Both keep the mill tour.',
    options: ['A', 'B'].map((key) => ({ key, title: 'Way ' + key, gains: 'A calm day.', gives_up: 'No day trip.',
      days: [{ date: '2027-06-10', area: 'Old Town', kind: 'full', note: 'Arrive by noon.', anchors: [{ slug: 'reed-mill', name: 'Reed Mill' }] }] })) }),
  day_versions: () => ({ v: 1, kind: 'day_versions', trip: 'fernhollow', build_id: 'dv-fernhollow-1', date: '2027-06-11', chosen: 'A',
    versions: ['A', 'B'].map((key) => ({ key, title: 'Version ' + key, summary: 'Two sights.', stops: [{ slug: 'reed-mill', name: 'Reed Mill', time: '10:00' }],
      walk_minutes: 35, transit_minutes: 20, spare_minutes: 50, bookings: ['Mill 14:00'], leaves_out: [{ slug: 'pear-walk', name: 'Pear Walk' }],
      warnings: ['Steep lane.'] })) })
};
async function prefsReview() {
  const m = await import('../kits/prefs/index.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tg-p13c-parity-'));
  made.push(dir);
  const evidence = JSON.parse(fs.readFileSync(path.join(W.H.HELPERS_ROOT, 'kits', 'prefs', 'fixtures', 'evidence-sample.json'), 'utf8'));
  m.ingest({ vocab: 'travel', held: path.join(dir, 'held'), evidence });
  return m.review({ vocab: 'travel', held: path.join(dir, 'held'), ledger: path.join(dir, 'ledger.json') });
}

/**
 * Every free-text string of a schema (a string type with no pattern, enum, const or format) → { at: [keys], min, max }.
 * Arrays walk their first item; $ref (#/$defs/…) and anyOf are followed.
 */
function freeText(root) {
  const out = [];
  const deref = (s) => (s && s.$ref ? root.$defs[s.$ref.replace('#/$defs/', '')] : s);
  (function walk(s, at, seen) {
    s = deref(s);
    if (!s || typeof s !== 'object' || seen.has(s)) return;
    seen = new Set(seen).add(s);
    (s.anyOf || []).forEach((alt) => walk(alt, at, seen));
    const types = [].concat(s.type || []);
    if (types.includes('string') && s.pattern === undefined && s.enum === undefined && s.const === undefined && s.format === undefined) {
      out.push({ at, min: s.minLength || 0, max: s.maxLength });
    }
    Object.entries(s.properties || {}).forEach(([k, v]) => walk(v, at.concat(k), seen));
    if (s.items) walk(s.items, at.concat(0), seen);
  })(root, [], new Set());
  return out;
}
/** Set the value at `at` in a clone of p; null when the example has no such parent (the probe is then skipped). */
function setAt(p, at, value) {
  const c = clone(p);
  let o = c;
  for (let i = 0; i < at.length - 1; i++) { o = o == null ? undefined : o[at[i]]; if (o === undefined || o === null || typeof o !== 'object') return null; }
  if (Array.isArray(o) && at[at.length - 1] >= o.length) return null;
  o[at[at.length - 1]] = value;
  return c;
}

test('A16 parity: the pack validator and the core mirror agree on every free-text length bound, in kanji, emoji and combining marks', async (t) => {
  const S = await import('../packs/tour-guide/schemas/index.mjs');
  const { ctx } = W.fresh();
  const examples = { ...EXAMPLES, prefs_review: () => prefsReview() };
  const differ = [], probed = {};
  for (const [type, make] of Object.entries(examples)) {
    const base = clone(await make());
    const pack = (p) => S.validatePayload(type, p).ok;
    const core = (p) => W.J(ctx.tgEnvCleaned(ctx[CORE[type]])(clone(p))).length === 0;
    assert.ok(pack(base), type + ' example valid for the pack: ' + S.formatErrors(S.validatePayload(type, base).errors));
    assert.ok(core(base), type + ' example valid for the core: ' + W.J(ctx.tgEnvCleaned(ctx[CORE[type]])(clone(base))).join('; '));
    probed[type] = 0;
    for (const f of freeText(S.loadSchema(S.PAYLOAD_KINDS[type]))) {
      // At the bound and one past it; at the minimum and one under it; an unbounded field gets a long string.
      const lens = f.max !== undefined ? [f.max, f.max + 1] : [2000];
      if (f.min > 1) lens.push(f.min, f.min - 1);
      for (const [kind, unit] of Object.entries(UNITS)) {
        for (const n of lens) {
          const p = setAt(base, f.at, fill(unit, n));
          if (!p) continue;
          probed[type]++;
          const a = pack(p), b = core(p);
          if (a !== b) differ.push(`${type} /${f.at.join('/')} ${kind} × ${n} units (bound ${f.max}): pack ${a ? 'accepts' : 'refuses'}, core ${b ? 'accepts' : 'refuses'}`);
          if (f.max !== undefined && n === f.max + 1) assert.equal(a, false, `${type} /${f.at.join('/')} must refuse ${n} units`);
        }
      }
    }
  }
  t.diagnostic('probes per type: ' + JSON.stringify(probed));
  assert.deepEqual(differ, []);
  Object.entries(probed).forEach(([type, n]) => assert.ok(n > 0, type + ' had no free-text field to probe'));
});

test('A16: the bounds count UTF-16 units on both sides — an emoji counts 2, a combining mark 1, a kanji 1', async () => {
  const S = await import('../packs/tour-guide/schemas/index.mjs');
  const { ctx } = W.fresh();
  const p = EXAMPLES.profile_summary();
  const max = S.loadSchema('profile-summary').properties.text.maxLength;
  const at = (text) => ({ ...p, text });
  // max/2 emoji are max units: both accept; one more kanji makes max + 1 units: both refuse.
  const fits = at('😀'.repeat(max / 2)), over = at('😀'.repeat(max / 2) + '漢');
  assert.equal(S.validatePayload('profile_summary', fits).ok, true);
  assert.equal(S.validatePayload('profile_summary', over).ok, false);
  assert.deepEqual(W.J(ctx.tgEnvCleaned(ctx.tgEnvValidateProfileSummary)(clone(fits))), []);
  assert.ok(W.J(ctx.tgEnvCleaned(ctx.tgEnvValidateProfileSummary)(clone(over))).some((e) => /text/.test(e)));
});

// Developed by: LightAISolutions
