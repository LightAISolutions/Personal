# Tour Guide pack — `helpers/packs/tour-guide/`

The engine behind the Tour Guide helper: it turns a trip, its researched places and the owner's profile into day plans, Later lists and a brochure. Everything here is a plain Node ESM library with no build step and no runtime npm dependency; the Apps Script feature pack (`gas/`) arrives in Phase 5 and the brain side (skills and routine prompts) lives in the private repo and calls this pack through `vendor/helpers/packs/tour-guide/`.

| Directory | What it holds | Contract |
|---|---|---|
| `helper.json` | The pack manifest (SPEC §4): display name "Tour Guide", Drive root `TourGuide`, no property prefix, memory directories `trips/ places/ profile/`, default time zone `America/New_York` (the `TIMEZONE` Script Property overrides it) | `node helpers/tools/bundle.mjs tour-guide --check` |
| `schemas/` | JSON Schemas for every entity of the data contract and a validator with semantic checks | below |
| `estimator/` | Visit-duration estimates on top of the research kit, pace and interest factors, tap calibration | below |
| `planner/` | Day assignment, the time-window solver, real legs, meals, warnings, Maps links, budget, Later lists | below |
| `later/` | Later-list operations (promote and demote report which days to re-plan) | below |
| `brochure-map/` | Maps a Plan onto the brochure kit's model and renders it | below |
| `fixtures/` | Two invented trips with recorded Maps answers in the real API shapes, used by every test | below |
| `gas/` | Empty until Phase 5 (the chatbot feature pack) | — |

Data contract v1 (plan §4.4): `Trip`, `Place`, `GoogleSnapshot` (the Maps kit's shape, content build-scoped), `VisitEstimate`, `PlaceNote`, `Calibration`, `DayPlan`, `LaterList`, `Plan` and a `profile-excerpt`. Clock values are local to `trip.timezone` as `HH:MM`; dates are `YYYY-MM-DD`; ids are our own slugs, Google place ids live in `place_id`.

## How a plan is built

```js
import { loadFixture, createFixtureResponder } from './fixtures/index.mjs';          // or the real data from the private repo
import { createMapsClient, createMockTransport, createLedger } from '../../kits/maps/index.mjs';
import { planTrip } from './planner/index.mjs';
import { validate } from './schemas/index.mjs';
import { renderPlan, renderPlanPdf } from './brochure-map/index.mjs';

const fx = loadFixture('transit-city');
const maps = createMapsClient({ transport: createMockTransport(createFixtureResponder(fx)), ledger: createLedger() }); // live: createMapsClient({ ledgerPath })
const plan = await planTrip({ ...fx, maps, build_id: 'build-2027-04-30', now: '2027-04-30T09:00:00Z', seed: 1 });
validate(plan, 'plan');                                   // { ok: true, errors: [] }
const { html } = renderPlan({ ...fx, plan, options: { generator: 'Tour Guide', built_on: '2027-04-30', verified_on: plan.days[0].verified_on } });
```

Input to `planTrip`: `trip`, `places`, `snapshots` (array or map by place id), `estimates`, `profile`, `calibration`, a Maps-kit client, `build_id`, `now`, `seed`. Output: a `Plan` — one `DayPlan` per trip date, the Later lists, the places with their new statuses, the SKU budget that was estimated before the first call and the usage that was actually spent. `helpers/tests/pack_tour-guide_integration.test.js` runs exactly this on both fixtures and checks the Phase 3 property set (no stop outside its hours, no visit on a closed day, every leg equal to the recorded travel time, days inside their bounds or warned, every candidate scheduled or in a Later list with a reason, re-planning one day leaves the others byte-identical, the plan maps to a valid brochure).

## Schemas — `schemas/`
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

## Estimator — `estimator/`
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

## Later lists — `later/`
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

## Fixtures — `fixtures/`
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

The two trips in detail (dates, lodging, every edge case and which place carries it): `helpers/status/WP-3a.md` → "Fixtures".

## Planner — `planner/`
```js
import { planTrip, replanDays, estimateBudget, PlanBudgetError } from './planner/index.mjs';
const plan = await planTrip({ trip, places, snapshots, estimates, profile, calibration, maps, build_id, now, seed });
const plan2 = await replanDays(plan, ['2027-05-04'], { trip, places: plan.places, snapshots, estimates, profile, maps });
const budget = await estimateBudget({ … same input … });   // no API call
```
`maps` is a Maps-kit client; its ledger counts every unit before it is sent. For each trip date the planner assigns candidates (geography + lodging anchors, priority first, bookings pinned, a promoted place's `scheduled_hint` preferred; too-far and never-open places go straight to *Didn't fit*), fetches **one Route Matrix** (stops + lodging endpoints, ≤ 10 points on TRANSIT days), solves the exact best subset and order under opening hours, bookings and the day bounds (lunch 12:00–14:00 is mandatory on a day that runs past it; breakfast at the lodging from `day_start`; dinner suggested after the return), then fetches the **real legs pair by pair** at the planned departure times (TRANSIT legs carry the line), re-timelines on them (one re-solve, then drops a stop at a time), cross-checks the order with Google on DRIVE / WALK days, and writes the DayPlan with Maps links, meals, free blocks and warnings. Visit lengths come from the estimator's `chooseMinutes` (pace, interest, calibration); a caller may inject its own. `replanDays` rebuilds only the dates given and keeps every other day byte-identical. Limits: ≤ 12 stops per day (≤ 9 on TRANSIT with one lodging, ≤ 8 with two), ≤ 31 days, modes TRANSIT / DRIVE / WALK, return leg may spill ≤ 90 min past `day_end` (warned), a stop waits ≤ 75 min for its opening window (a booked stop may wait any length).

**Train estimates where Google has no transit (Japan).** The Routes API returns no transit route in Japan, so `planTrip` wraps the Maps client with `withRailEstimates` (`planner-rail.mjs`): a TRANSIT matrix element or leg Google could not find becomes walk → nearest station → ride → station → walk, using Google's own station places (Text Search Pro, one call per point, cached for the build; train, subway and light-rail stations within 1 km). The ride is an estimate (straight line × 1.3 at 30 km/h plus a 5 min wait, one 5 min change past 6 km; past 40 km 75 km/h, past 150 km shinkansen speed) and the leg's line reads `Shibuya Station → Ueno Station (estimate)`; its Google Maps link (travelmode=transit) shows the exact train. Hops under 1.2 km are walked; a point with no station in reach keeps "no route". Live check 2026-10-01 on Tokyo pairs: estimates ran about 0–10 min above the real Metro times. Pass `railEstimates: false` to turn it off. The budget estimate does not yet count the Text Search calls.

Every default and its reason (objective weights, mandatory lunch, meal rules, waits and spill, hours model, assignment score, capacity, too-far radius, Later reason precedence, one matrix per day, real legs, cross-check, Maps links, budget, determinism, time zones, limits): `helpers/decisions/WP-3b.md`.

## Brochure map — `brochure-map/`

`packs/tour-guide/brochure-map/index.mjs` (library; no CLI, no network):

    toBrochureModel({ trip, plan, places?, notes?, snapshots?, estimates?,
                      options: { generator?, built_on?, verified_on?, show_google_content = true } }) → brochure model
    renderPlan(args, { page?, embedFonts? })           → { html, model, warnings }   (kit renderHtml)
    renderPlanPdf(args, outPath, { page?, shotsDir? }) → { …, pdf, pages, available } (PDF only when pdfAvailable())

- Days: one brochure day per DayPlan with stops. Stops keep arrive/depart/minutes/activity/booked. Legs map
  TRANSIT/WALK/DRIVE → transit/walk/drive and keep `line` and the Maps link. Meals at "lodging" name the lodging.
  Warn/alert warnings go in the day's "Mind" block; an info warning becomes a note on its stop. Days with no stops
  are listed under "Free days" on the practical page; `day_url`s go under "Day routes".
- Cards: our Place (name, category, why it fits) + PlaceNote + the build's GoogleSnapshot content (address, weekday
  hours, the visit day's line, closed days, rating, reviews count, website, Maps link, business status, fetched
  date) + the note's and the estimate's sources. Every place a stop, meal, warning or Later item uses gets a card.
- Later lists keep their names and reasons (empty lists are dropped). `trip.practical` passes through.
- Attribution: the union of note and estimate sources of the brochure's places, deduplicated by URL (latest
  access date, merged "supports"), plus the generator line.
- `show_google_content: false` prints no Places content. Cards keep only our Maps link and the place id, a dated
  "Verify before you go" section lists every place with its Maps link, and the Google block is off.
- `brochure-map-sample.mjs` → `sampleInput()`: an invented two-day trip for tests.
Defaults and their reasons: `helpers/decisions/WP-3c.md`.

## Tests

`node --test helpers/tests/` runs the pack's suites: `pack_tour-guide_schemas`, `_estimator`, `_later`, `_fixtures`, `_planner` (a small invented world of its own, `pack_tour-guide_planner_world.js`), `_brochure-map`, `_brochure-map_units` and `_integration`. No test touches the network: Maps answers come from the fixture responder through the Maps kit's mock transport, and the PDF step runs only where `pdfAvailable()` is true (never in CI).

## What the pack never does

- Call Google without a Maps-kit client whose ledger counts every unit first; `planTrip` refuses to start a plan whose estimated SKUs exceed the ledger's ceiling (`PlanBudgetError`) unless the caller allows it.
- Keep Google content beyond the build: snapshots are read for the plan and the brochure of one build; only `place_id` and (for ≤ 30 days) coordinates are kept, per the Maps kit's rules.
- Store or read anything of the owner's: every file here is generic or invented; the owner's trips, places and profile live in the private repo and reach the engine as function arguments.
- Send messages, write to Drive or run a routine: the brain side (Phase 4) and the chatbot pack (Phase 5) do that through the framework's envelope and mailbox contracts.

Developed by: LightAISolutions
