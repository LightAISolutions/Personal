# WP-3a — Tour Guide schemas, estimator, Later lists, fixtures: status

**State: done** (2026-10-01). Branch `wp-3a`, worktree `../wt-3a`, never pushed. Defaults and reasons: `helpers/decisions/WP-3a.md`.

## Contract (TG-PHASE-3.md §2, row 3a, and data contract v1)
| Item | State |
|---|---|
| JSON Schemas for every entity: trip, place, google-snapshot, visit-estimate, place-note, calibration, day-plan, later-list, plan (+ profile-excerpt, decision 3) | done — `packs/tour-guide/schemas/tour-guide-<kind>.schema.json` |
| `validate(entity, kind) → {ok, errors:[{path,message}]}`, `listKinds()` | done — `schemas/index.mjs`. Schema pass reuses the brochure kit validator, then semantic checks (`tour-guide-checks.mjs`) |
| Estimator on the research kit's `durationRange`: activity + sources → min/max, chosen minutes, confidence | done — `estimator/estimator-build.mjs` (`buildEstimate`) |
| Chosen minutes adjusted by pace, profile interest and calibration | done — `estimator/estimator-minutes.mjs` (`chooseMinutes`) |
| Calibration from longer / shorter / about-right taps per category, bounded and reversible | done — `estimator/estimator-calibration.mjs`: factor 1 + 0.1 × (longer − shorter), clamped to 0.7–1.4 |
| Later lists: statuses candidate · scheduled · saved-for-later · rejected; named lists with reasons; promote / demote that report `affected_days` | done — `later/later-lists.mjs`, `later/later-moves.mjs`; nothing is mutated |
| Two invented fixture trips: 3-day transit city, 4-day driving loop | done — `fixtures/transit-city/`, `fixtures/driving-loop/` |
| Responder through the Maps kit's `createMockTransport`: real API shapes, `{placeId}` and `{location:{latLng}}` waypoints, nearest-neighbour `optimizedIntermediateWaypointIndex` | done — `fixtures/fixture-responder.mjs` |
| `fixtureTravel()` is the single source of truth for all durations | done — `fixtures/fixture-travel.mjs`; routes, matrix and optimization all read it |
| Edge cases: closed on a trip date, fits only outside the day, timed booking, CLOSED_TEMPORARILY, unknown hours, priority-3 far-off place | done — see the per-fixture descriptions below |
| Tests | done — `helpers/tests/pack_tour-guide_{schemas,estimator,later,fixtures}.test.js` (8 + 7 + 5 + 13 tests) |

## Checks (run from /home/user/wt-3a at the last commit)
- `node --test helpers/tests/` → 181 tests: 179 pass, 1 skipped (the kit's by-hand live smoke), **1 fail, pre-existing and not in a WP-3a file**: `tools_bundle.test.js` "bundle(hello): manifest block first…" asserts `listPacks()` is `['hello']`. The coordinator's skeleton commit `4804e6c` (tour-guide `helper.json`) made it `['hello','tour-guide']`. It fails the same way with every WP-3a change stashed. See request 1. All 33 WP-3a tests pass.
- `node helpers/tools/bundle.mjs --all --check` → `ok: hello — 16 files`, `ok: tour-guide — 15 files`; exit 0.
- `node helpers/tools/boundary-check.mjs` → clean, 214 files.

## Requests to the coordinator (files WP-3a does not own)
1. **`helpers/tests/tools_bundle.test.js` line 46**: change `assert.deepEqual(B.listPacks(), ['hello']);` to `assert.deepEqual(B.listPacks(), ['hello', 'tour-guide']);`, or to `assert.ok(B.listPacks().includes('hello'));` so that more packs don't break it again. Without this, `node --test helpers/tests/` stays red on every Phase 3 branch.
2. **Pack README**: paste the "README section" block below into `helpers/packs/tour-guide/README.md`.
3. **README tree / CHANGELOG** (push-time bookkeeping). New files:
   - `helpers/packs/tour-guide/schemas/{index.mjs,tour-guide-dates.mjs,tour-guide-checks.mjs}`
   - `helpers/packs/tour-guide/schemas/tour-guide-{trip,place,google-snapshot,visit-estimate,place-note,calibration,day-plan,later-list,plan,profile-excerpt}.schema.json`
   - `helpers/packs/tour-guide/estimator/{index,estimator-defaults,estimator-calibration,estimator-build,estimator-minutes}.mjs`
   - `helpers/packs/tour-guide/later/{index,later-lists,later-moves}.mjs`
   - `helpers/packs/tour-guide/fixtures/{index,fixture-geo,fixture-travel,fixture-load,fixture-responder}.mjs`
   - `helpers/packs/tour-guide/fixtures/{transit-city,driving-loop}/tg-fixture-<name>-{trip,places,snapshots,estimates,notes,profile,calibration,routes}.json`
   - `helpers/tests/pack_tour-guide_{schemas,estimator,later,fixtures}.test.js`
   - `helpers/status/WP-3a.md`, `helpers/decisions/WP-3a.md`
4. **For 3b/3c (planner, brochure)**:
   - A day plan must satisfy `validate(day, 'day-plan')`, which includes the semantic checks (decision 6): legs = stops + 1, the first leg starts from `lodging` and the last ends at it, a leg's minutes match its arrive − depart within ±1, and every stop sits inside its opening window.
   - A plan must satisfy `validate(plan, 'plan')`: each non-rejected place is either scheduled or in a Later list, never both.
   - Use `fixtures.loadFixture(name)` plus `createMockTransport(createFixtureResponder(fx))` instead of recording your own responses.

## README section
Paste this block into the pack README as is.

```markdown
### Schemas — `schemas/`
One JSON Schema per entity, `schemas/tour-guide-<kind>.schema.json` (subset of 2020-12, the same one the brochure kit validates).
Kinds: trip, place, google-snapshot, visit-estimate, place-note, calibration, day-plan, later-list, plan, profile-excerpt.
- `validate(entity, kind) → { ok, errors: [{ path, message }] }`. It runs the schema first. If that passes, it runs the semantic checks:
  - Trip: real calendar dates, ≤ 31 days, a valid IANA time zone, day_start < day_end, exactly one lodging per night.
  - Day plan: legs and stops chain lodging → … → lodging; times run in order (they may cross midnight); each leg's minutes match its clock times within 1; each stop sits inside its opening window.
  - Plan: each part is validated as its own kind; each non-rejected place is either scheduled or in exactly one Later list.
- `listKinds()`, `assertValid(entity, kind)` (throws, `err.errors`), `loadSchema(kind)`, `formatErrors(errors)`.
- Date helpers: `tripDates`, `weekdayOf`, `addDays`, `toMinutes` / `fromMinutes`, `lodgingForNight`, `dayLodgings`.
  - A lodging covers the nights [from, to).
  - A day starts at the previous night's lodging and ends at that night's lodging. The last date ends at the lodging with to = end_date.

### Estimator — `estimator/`
- `buildEstimate({ place_id, activity, category, mentions, sources, now }) → VisitEstimate`.
  - It runs the research kit's `durationRange`. Confidence is confirmed, conflicting, single-source or unverified.
  - chosen_minutes is the typical value, else the midpoint, else the category default.
- `chooseMinutes({ estimate | range+typical, category, pace, interest | profile, calibration }) → { minutes, min, max, confidence, factors }`.
  - Factors: pace (relaxed 1.15, normal 1, packed 0.85), interest (low 0.8, normal 1, high 1.25) and the category calibration.
  - The result is rounded to 5 minutes and kept within half the range minimum and twice the range maximum.
- Calibration:
  - `createCalibration()`; `applyTap(state, { category, tap: 'longer' | 'shorter' | 'about-right' })` returns a new state.
  - `calibrationFactor(state, category)` = 1 + 0.1 × (longer − shorter), clamped to 0.7–1.4.
  - It is reversible: an opposite tap undoes a tap.

### Later lists — `later/`
- Statuses: candidate · scheduled · saved-for-later · rejected.
- Default lists: "Didn't fit" (machine codes) and "Next time" (owner).
- `createLists(trip_id)`, `addItem(lists, { place, place_id, reason, code, from_date?, list?, added_on })`, `removeItem`, `findItem`, `setStatus`.
  - Adding a place that is already listed moves it.
- `promote({ lists, places, place, to_date }) → { lists, places, affected_days: [to_date] }`.
  - The place becomes a candidate with `scheduled_hint.date`.
- `demote({ lists, places, days, place, reason, code }) → { lists, places, affected_days }`.
  - affected_days are the dates whose day plans contain the place.
  - Re-plan only those days.
- Pure functions: inputs are never mutated.

### Fixtures — `fixtures/`
- Two invented trips, `transit-city` and `driving-loop`. Each has eight JSON parts: trip, places, snapshots, estimates, notes, profile, calibration, routes.
- `loadFixture(name)` returns a fresh copy. `listFixtures()`.
- `fixtureTravel(fx, mode, fromPlaceId, toPlaceId) → { durationSec, distanceMeters, line? }` is the only source of travel times.
  - Lookup order: the tabled pair, then its reverse, then a haversine × 1.3 fallback at the mode's speed.
- `createFixtureResponder(fx)` is used with the Maps kit's `createMockTransport`. It answers Place Details, Compute Routes and Compute Route Matrix in real API shapes:
  - It honours the field mask.
  - Waypoints may be `{placeId}`, `{location:{latLng}}` (snapped within 50 m) or an exact address.
  - `optimizeWaypointOrder` returns a nearest-neighbour `optimizedIntermediateWaypointIndex`.
  - TRANSIT returns walk / transit / walk steps with line names.
  - Unknown ids give the kit's NOT_FOUND (HTTP 404) error.
```

## Fixtures
Ids, names, coordinates, addresses and URLs are all invented. URLs use reserved example domains only. Time zones are `Etc/GMT±N`, so there is no daylight-saving shift.

### transit-city — "Three days in Port Sorrel" (`port-sorrel-spring-2027`)
- **Dates:** Wed 2027-05-12 to Fri 2027-05-14, 3 days.
- **Settings:** time zone Etc/GMT+2, pace normal, day 09:00–18:00. TRANSIT is the default; WALK is also allowed.
- **Lodging:** harbour-lane-guesthouse for all three nights (05-12 to 05-15).
- **Places:** 14, plus 15 snapshots including the lodging. There are 9 notes.
- **Profile:** museum high, viewpoint high, market normal, shop low, breakfast at the lodging.
- **Routes:** 168 TRANSIT pairs (Line 1, Line 2, Line 3, Tram 4; pairs under 650 m have no line and are walk-only) and 132 WALK pairs.

| Edge case | Carrier |
|---|---|
| Fits only after day_end | moonlight-night-market: Wed–Sun 18:30–23:30, while the day ends at 18:00 |
| Closed on a trip date | maritime-archive: closed Mon and Thu, so closed on Thu 2027-05-13 |
| Timed booking | clock-tower-climb: 2027-05-13 11:00, ref FIXTURE-CT-0513 |
| CLOSED_TEMPORARILY | tram-depot-gallery |
| Unknown hours | bluebell-ceramics-studio: hours null; it is also priority 3 with an unverified estimate |
| Conflicting estimate | saffron-row-market |
| Split hours | st-brannoc-church: 09:00–12:30 and 14:00–17:00 |
| Open 24 hours | signal-hill-lookout, harbour-district, old-town-lanes |

### driving-loop — "Carrow coast loop" (`carrow-coast-loop-2027`)
- **Dates:** Tue 2027-06-08 to Fri 2027-06-11, 4 days.
- **Settings:** time zone Etc/GMT+3, pace relaxed, day 09:00–18:30. DRIVE is the default; WALK is also allowed.
- **Lodgings:**
  - brackenford-inn: nights 06-08 and 06-09
  - gullhaven-lodge: night 06-10
  - marrow-bay-hotel: night 06-11
  - Day 06-10 therefore runs inn → lodge, and day 06-11 runs lodge → hotel.
- **Places:** 15, plus 18 snapshots including the three lodgings. There are 8 notes.
- **Profile:** hike high, viewpoint high, museum low, neighbourhood normal.
- **Routes:** 244 DRIVE pairs and 18 WALK pairs. The far place is deliberately untabled, so its times come from the fallback.

| Edge case | Carrier |
|---|---|
| Priority-3 far-off place | northcape-sea-stacks: 42.85, -40.35, about 184 km from brackenford-inn and more than 150 km from every lodging; untabled |
| Closed on a trip date | gullhaven-lighthouse: closed Mon and Thu, so closed on Thu 2027-06-10 |
| Closed on a trip date | brackenford-harbour-market: open only Tue, Thu and Sat, so closed on Wed 06-09 and Fri 06-11 |
| Open after day_end | gullhaven-fish-shack: 11:30–21:00 (a dinner candidate) |
| Conflicting estimate | seal-cove |
| Unverified estimate | marrow-bay-gallery |
| Long hikes | heron-ridge-trail, blackwater-falls |

This trip has no timed booking, no CLOSED_TEMPORARILY place and no place with unknown hours; transit-city carries those cases.

## Log
- 2026-10-01 — Read the brief (data contract v1), TG-PHASE-3 row 3a, and the maps, research and brochure kits.
- 2026-10-01 — Schemas, validator and semantic checks (`6aa9ce9`).
- 2026-10-01 — Estimator and calibration (`db759ae`).
- 2026-10-01 — Later lists (`86a8ce5`).
- 2026-10-01 — Fixtures, loader, travel table and responder (`ede5123`).
- 2026-10-01 — Tests (`7b0b979`).
- 2026-10-01 — The fixtures test showed northcape-sea-stacks was only about 137 km from gullhaven-lodge. Moved it to 42.85, -40.35 and regenerated (`450034d`).
- 2026-10-01 — Full suite: the only failure is `tools_bundle.test.js` `listPacks()`. It fails on a clean wp-3a too (request 1). Bundle check and boundary check are clean.

Developed by: LightAISolutions
