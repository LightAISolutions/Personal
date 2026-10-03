# Tour Guide pack — `helpers/packs/tour-guide/`

The engine behind the Tour Guide helper: it turns a trip, its researched places and the owner's profile into day plans, Later lists and a brochure. Everything here is a plain Node ESM library with no build step and no runtime npm dependency; the Apps Script feature pack (`gas/`, the Telegram chatbot — below) is bundled with the core, and the brain side (skills and routine prompts) lives in the private repo and calls this pack through `vendor/helpers/packs/tour-guide/`.

| Directory | What it holds | Contract |
|---|---|---|
| `helper.json` | The pack manifest (SPEC §4): display name "Tour Guide", Drive root `TourGuide`, no property prefix, memory directories `trips/ places/ profile/`, default time zone `America/New_York` (the `TIMEZONE` Script Property overrides it) | `node helpers/tools/bundle.mjs tour-guide --check` |
| `schemas/` | JSON Schemas for every entity of the data contract and a validator with semantic checks | below |
| `estimator/` | Visit-duration estimates on top of the research kit, pace and interest factors, tap calibration | below |
| `planner/` | Day assignment, the time-window solver, real legs, meals, warnings, Maps links, budget, Later lists | below |
| `later/` | Later-list operations (promote and demote report which days to re-plan) | below |
| `brochure-map/` | Maps a Plan onto the brochure kit's model and renders it | below |
| `gems/` | The Gem Funnel's engine (proposal §4 stages 2–5): screening, the gem score and 💎 rule, evidence flags, the "why it's a gem" line, shortlist floors and the "Gems not chosen" Later list — pure functions, no calls | below |
| `shortlist-sheet/` | One research round (the `shortlist` payload) as a printable PDF with the chat's numbers, for the owner to read before picking | below |
| `fixtures/` | Two invented trips with recorded Maps answers in the real API shapes, used by every test | below |
| `gas/` | The Telegram chatbot: commands, flows, envelope handlers, sheets, Lane B, `/route` (Phase 5) | below |

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
Kinds: trip, place, google-snapshot, visit-estimate, place-note, calibration, day-plan, later-list, plan, profile-excerpt, and the six envelope payloads (see "Payloads" below): shortlist, trip-facts, plan-digest, profile-summary, prefs-review, places-digest.
- `validate(entity, kind) → { ok, errors: [{ path, message }] }`. It runs the schema first. If that passes, it runs the semantic checks:
  - Trip: real calendar dates, ≤ 31 days, a valid IANA time zone, day_start < day_end, exactly one lodging per night.
  - Day plan: legs and stops chain lodging → … → lodging; times run in order (they may cross midnight); each leg's minutes match its clock times within 1; each stop sits inside its opening window.
  - Place: real calendar dates in `last_researched`, `last_verified`, the booking and `history` (oldest first).
  - Plan: each part is validated as its own kind; each non-rejected place is either scheduled or in exactly one Later list. With `plan.choices`: every slug is a known place and sits in one list only; skipped places are rejected and unscheduled; kept places are unscheduled; a candidate that was not picked may be in neither (it was simply not chosen).
  - Payloads: numbering and slugs unique, real dates, end ≥ start, a review's buttons name their own item, digests ≤ 60 000 characters.
- `listKinds()`, `assertValid(entity, kind)` (throws, `err.errors`), `loadSchema(kind)`, `formatErrors(errors)`.
- Date helpers: `tripDates`, `weekdayOf`, `addDays`, `toMinutes` / `fromMinutes`, `lodgingForNight`, `dayLodgings`.
  - A lodging covers the nights [from, to).
  - A day starts at the previous night's lodging and ends at that night's lodging. The last date ends at the lodging with to = end_date.

## Estimator — `estimator/`
- `buildEstimate({ place_id, activity, category, mentions, sources, now }) → VisitEstimate`.
  - It runs the research kit's `durationRange`. Confidence is confirmed, conflicting, single-source or unverified.
  - chosen_minutes is the typical value, else the midpoint, else the session length of a set activity (`activityDefault`: a tea ceremony 60, a class or lesson 150, a workshop 120, a tasting 60, a performance 90), else the category default.
- `chooseMinutes({ estimate | range+typical, category, activity, booked, pace, interest | profile, calibration }) → { minutes, min, max, confidence, factors, fixed? }`.
  - A booked length (`booking.minutes` on the place) or a set activity's session length with no sourced figure is fixed: no pace, interest or calibration factor (`fixed: true`). The planner always takes `booking.minutes` when the place has one.
  - Factors: pace (relaxed 1.15, normal 1, packed 0.85), interest (low 0.8, normal 1, high 1.25) and the category calibration.
  - The result is rounded to 5 minutes and kept within half the range minimum and twice the range maximum.
- Calibration:
  - `createCalibration()`; `applyTap(state, { category, tap: 'longer' | 'shorter' | 'about-right' })` returns a new state.
  - `calibrationFactor(state, category)` = 1 + 0.1 × (longer − shorter), clamped to 0.7–1.4.
  - It is reversible: an opposite tap undoes a tap.

## Travellers — `travellers/`
- `profileExcerpt(markdown, overrides)` → the planner's excerpt of a profile file: pace, day rhythm, interests by level, `avoid`, `dietary`, `diet` and its `diet_rule`. Overrides may add dietary limits, never lift one.
- `partyExcerpt(owner, companions)` → the excerpt for a trip with other travellers ("their limits, your lead"): every traveller's dietary limits and things to avoid, the strictest diet, the most relaxed pace, the owner's interests, and `also_like` (companions' high interests the owner did not rate); `party` counts the travellers. With no companions it returns the owner's excerpt unchanged.
- The private repo keeps companions' profiles in `profile/people/<slug>.md`; this module holds no names.

## Later lists — `later/`
- Statuses: candidate · chosen · scheduled · saved-for-later · rejected. `chosen` = the owner picked it from the shortlist; the planner treats it like a candidate.
- Trip statuses: intake · researched · choosing · planned · delivered · done.
- Default lists: "Didn't fit" (machine codes), "Next time" (code `owner`), "Saved by you" (code `owner_choice`: kept for later while choosing from the shortlist) and "Gems not chosen" (code `not_shown`: gems the shortlist could not show). `defaultListFor(code)` and `LIST_DESCRIPTIONS` name them.
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
// the owner's choices from the shortlist (slugs):
const chosen = await planTrip({ …, choices: { picks: ['old-market'], later: ['river-walk'], skip: ['tower'] } });
```
`maps` is a Maps-kit client; its ledger counts every unit before it is sent. For each trip date the planner assigns candidates (geography + lodging anchors, priority first, bookings pinned, a promoted place's `scheduled_hint` preferred; too-far and never-open places go straight to *Didn't fit*), fetches **one Route Matrix** (stops + lodging endpoints, ≤ 10 points on TRANSIT days), solves the exact best subset and order under opening hours, bookings and the day bounds (lunch 12:00–14:00 is mandatory on a day that runs past it; breakfast at the lodging from `day_start`; dinner suggested after the return), then fetches the **real legs pair by pair** at the planned departure times (TRANSIT legs carry the line), re-timelines on them (one re-solve, then drops a stop at a time), cross-checks the order with Google on DRIVE / WALK days, and writes the DayPlan with Maps links, meals, free blocks and warnings. Visit lengths come from the estimator's `chooseMinutes` (pace, interest, calibration); a caller may inject its own. `replanDays` rebuilds only the dates given and keeps every other day byte-identical. **Rainy-day swaps** (`planner-rain.mjs`): every day with an outdoor stop gets up to 2 `rain_swaps` — indoor places not on the plan (the Place's `indoor` flag, else its category), open or of unknown hours that date, within reach of one of the day's outdoor stops (straight line: WALK 1.5 km, TRANSIT 5 km, DRIVE 20 km), nearest first, each place offered on one day only; skipped and rejected places never appear. No API call; a swap goes on the plan only through a `replan` with `promote`/`demote` (`/day`'s ☔ Swap in button, or a chat hand-off). Limits: ≤ 12 stops per day (≤ 9 on TRANSIT with one lodging, ≤ 8 with two), ≤ 31 days, modes TRANSIT / DRIVE / WALK, return leg may spill ≤ 90 min past `day_end` (warned), a stop waits ≤ 75 min for its opening window (a booked stop may wait any length).

**Rail first, buses as the fallback.** On a TRANSIT day the planner asks Google for train, metro and tram routes only (`transitPrefs(trip)` in `planner-transit.mjs`: `allowedTravelModes` TRAIN, SUBWAY, LIGHT_RAIL, RAIL). `withBusFallback` then re-asks with buses allowed for just the pairs that got no rail route, so a bus shows up only where rail has nothing. Where Google has no transit at all (Japan) one probe element shows that and the wrapper stops re-asking; those legs become the train estimates below, which never use buses. A trip that lists its own `transit_preferences.allowedTravelModes` (with `BUS`, say) is asked exactly that. The budget estimate does not count the bus re-asks.

**Train estimates where Google has no transit (Japan).** The Routes API returns no transit route in Japan, so `planTrip` wraps the Maps client with `withRailEstimates` (`planner-rail.mjs`): a TRANSIT matrix element or leg Google could not find becomes walk → nearest station → ride → station → walk, using Google's own station places (Text Search Pro, one call per point, cached for the build; train, subway and light-rail stations within 1.3 km). The ride is an estimate (straight line × 1.3 at 30 km/h plus a 5 min wait, one 5 min change past 6 km; past 40 km 75 km/h, past 150 km shinkansen speed) and the leg's line reads `Shibuya Station → Ueno Station (estimate)`; its Google Maps link (travelmode=transit) shows the exact train. Hops under 1.2 km are walked; a point with no station in reach keeps "no route". Live check 2026-10-01 on Tokyo pairs: estimates ran about 0–10 min above the real Metro times. Pass `railEstimates: false` to turn it off. The budget estimate does not yet count the Text Search calls.

**Transit fallback** — Google Routes has no TRANSIT routes in some countries (Japan, for one). The rail estimates above run first; a leg they leave as "no route" (no station in reach, or `railEstimates: false`) falls through to this. When a TRANSIT matrix element is missing or not `ROUTE_EXISTS`, or a TRANSIT Compute Routes call returns no route, the planner does not switch to driving: it estimates the leg as straight-line distance × 1.3 at `trip.transit_fallback.kmh` (default 20) plus `overhead_min` (default 12), rounded up. The solver uses the same estimate for missing matrix pairs. Estimated legs carry `estimated: true`, `estimate_basis: "distance"`, no `line` and the normal transit Maps link; each affected day gets one `transit_estimated` warning ("Transit times on this day are estimates; check the Maps link before you go"). `trip.transit_fallback = { kmh, overhead_min, source?: default|researched, note? }`. DRIVE and WALK days are unchanged. Reasons: `helpers/decisions/WP-3e.md`.

**Choices** — `input.choices = { picks?, later?, skip? }`, arrays of place slugs (ids); absent → the plan is exactly what it was before choices existed.
- `picks` is the whole pool: picked places get status `chosen` and are planned; candidates that were not picked stay `candidate`, are not planned and are in no Later list. A place promoted with `scheduled_hint` counts as picked.
- `later` → the "Saved by you" list (code `owner_choice`), status saved-for-later, never planned.
- `skip` → status rejected, never planned, in no list.
- Unknown slugs, a slug in two lists or extra keys throw (`planner: …`); duplicates inside one list are ignored. An explicit pick may bring back a saved or rejected place.
- The plan records them as `plan.choices` (sorted, effective). `replanDays(plan, dates, input)` uses `input.choices` when given, else `plan.choices`; `choices: null` drops them. Keeping or skipping a place that is scheduled on a day not being re-planned throws (re-plan that day too). `estimateBudget` honours choices.

Every default and its reason (objective weights, mandatory lunch, meal rules, waits and spill, hours model, assignment score, capacity, too-far radius, Later reason precedence, one matrix per day, real legs, cross-check, Maps links, budget, determinism, time zones, limits): `helpers/decisions/WP-3b.md`.

## Payloads (envelope types) — `schemas/`

`helper.json` declares six envelope types (no actions: `action_allowlist` is empty). Each has a schema `schemas/tour-guide-<kind>.schema.json` and semantic checks; `PAYLOAD_KINDS` maps type → kind and `validatePayload(type, payload) → { ok, kind, errors }` validates one (an unknown type gives `ok: false, kind: null`). `node helpers/tools/envelope.mjs <type> <skill> <payload.json> --pack tour-guide` refuses a payload that fails it.

| Type | Kind | Shape (strict: no extra fields) |
|---|---|---|
| `shortlist` | shortlist | `{ v?, kind?, trip, run_id, round, groups: [{ id: activities\|food, gems_wanted, gems_shown, items: [{ n, slug, name, why_you, fit 0–1, est_minutes, area, maps_url, labels, place_id?, new?, gem?, gem_line?, seen_before?, changes?, dims? }] ≤ 20 }] ≤ 2, more, decided? }` |
| `trip_facts` | trip-facts | `{ trip, found: [{ n, kind: dates\|lodging\|flight\|booking\|companions\|other, text ≤ 200, start?, end? }] ≤ 40, missing: [kind] ≤ 10 }` |
| `plan_digest` | plan-digest | `{ trip, build_id, verified_on, days: [{ date, theme, stops: [{ n, slug, name, arrive, depart, minutes, maps_url, note_line }], legs: [{ from, to, mode, minutes, maps_url? }], warnings: [text], rain?: [{ slug, name, instead_of, km, maps_url }] ≤ 2 }], later: [{ slug, name, reason }], drive: { plan, brochure_html, brochure_pdf } }`, ≤ 60 000 characters |
| `profile_summary` | profile-summary | `{ text ≤ 1200 }` — the prefs kit's plain-text summary as is; optional `dimensions_count`, `updated` (ISO date-time) |
| `prefs_review` | prefs-review | exactly the prefs kit's `buildReview` payload: `{ v: 1, kind, vocab, batch_id, items: [{ cid, dimension, value, stance, statement, suspect, text, buttons }] ≤ 40, held_back, more }` |
| `places_digest` | places-digest | `{ destination, places: [{ slug, name, area, category, tags, status, last_trip, last_researched, last_verified, note_line, maps_url, history_summary }] }`, ≤ 60 000 characters, no Google content |

Place records may also carry `destination`, `history[]` (trip, date, event), `last_researched`, `last_verified` and the gem fields `gem_score` (0–100), `gem`, `obscurity` (0–1), `local_mentions[]` and `flags[]`.

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
  A day's `rain_swaps` (with a card) become its "If it rains" alternatives aside.
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

## Gem Funnel — `gems/`
Library only: pure functions over the candidate pool the `trip-research` skill assembles; no Google call, no fetch, no clock. Every tunable number lives in `gems/gems-weights.mjs`.
```js
import * as gems from './gems/index.mjs';
const { kept, dropped } = gems.screen(pool, { trip_dates, anchors, off_track_minutes, modes, avoid_types, rating_floor, rating_offset });   // stage 2: one reason_code per drop (hotels, gates, facilities too)
const scored = gems.scoreGems(kept, { appetite, city_size, fit_estimates, profile, trip_dates, day_start, day_end, anchors, rough_edges }); // stage 3: q o l f p → gem_score, gem
const { flags, record } = gems.flagEvidence(scored[0], { trip_dates, today, signals });   // stage 4: unproven | tourist_oriented | closed_day_conflict
const line = gems.gemLine(record, { category_median_count });                              // ≤ 200 chars, numbers and source kinds only
const { groups, not_shown } = gems.selectShortlist(flagged, { appetite, per_group: { activities: 8, food: 6 }, decided });
const later = gems.gemsNotChosenList({ trip_id, not_shown, today });                      // LaterList "Gems not chosen", code not_shown
const placeFields = gems.toPlaceFields(record);                                           // gem_score, gem, obscurity, local_mentions, flags — no Google field
```
- Pool record: `{ place_id, name, types, primary_type?, category?, rating?, rating_count?, price_level?, business_status, location, hours?, website?, streams, local_mentions: [{ ref, language, kind }], mass_tourism_rank?, reviews? (in-run only), slug?, friction?, signals? }`; `fromSearchResult(rawPlace, { streams })` builds one from a Places (New) search result.
- Screening drops: not operational, avoided type, chain (a name repeated ≥ 3 times or a short generic brand list), rating under the floor (4.3; 4.5 at appetite ≥ 4), fewer than 15 ratings unless two local mentions or an owner seed, closed on every trip date, beyond `off_track_minutes` from every anchor in a straight line at WALK 4.5 / TRANSIT 15 / DRIVE 30 km/h.
- Score: Bayesian quality (m = 30, μ = the category's pool mean or 4.2), bucketed obscurity (40–400 ratings in a large city, 15–150 in a small one; > 2 000 → 0; owner seeds 0.5), local-ness (+0.5 per local-language source, +0.3 editorial, +0.2 community, −0.5 top-ten mass tourism), fit (the skill's estimate, else a cheap one from types and price), practicality (open at a usable time on a trip day, within reach, minus untolerated rough edges). `100 × (0.35 F + 0.25 Q + 0.20 O + 0.15 L + 0.05 P)`; appetite moves up to 0.10 between Q + F and O + L. 💎 when O ≥ 0.6, L ≥ 0.3, Q ≥ 0.6.
- Shortlist: 💎 floor by appetite (1 → none, 2 → 1 + 1, 3 → 2 + 2, 4 → 3 + 2, 5 → 4 + 3), `decided` excluded, `floor_met: false` when the pool had too few gems. Unproven places are never shown as 💎.
- Persisted projections carry only our own numbers and notes; reviews are read in-run for their dates only; distances run to our own anchors, never a polygon test on Google coordinates. Defaults and reasons: `helpers/decisions/WP-2g-engine.md`; full contract: `gems/README.md`.

## Chatbot — `gas/`

Apps Script files bundled after the core in file-name order (`node helpers/tools/bundle.mjs tour-guide`); registries only, no core file is touched. Contract and per-file owners: `helpers/decisions/TG-PHASE-5.md` §1; reasons: `helpers/decisions/WP-5{a,b,c}.md`.

| File | What it does |
|---|---|
| `00_common.js` | Request routing (`research → RESEARCH`, `plan · replan → PLAN`, `notes → NOTES`, `brochure → BROCHURE`, `prefs → PREFS`, `places → PLACES`, `message · ask → CHAT`), `tgOpenKindRequest`, `tgSlug`, `tgLines`, shared Settings keys |
| `10_commands.js` | `/profile /trip /today /day /later /place /places /replan /notes /brochure /lodging /dates`; the `/start` interview offer (`core_start`); callbacks `dy lt rs ps pl` (`rs`: a day's ☔ Swap in button, confirmed, opens a `replan` that promotes the rainy-day option and demotes the stop it replaces) |
| `11_flow_interview.js` | `/interview [section\|all\|restart]` — the preference interview (flow `interview`) → a `prefs` request with `payload.interview` |
| `12_flow_plan.js` | `/plan <destination>`, `/seed`, `/repick` (typed picks take a round prefix: `r1 5 later 7`) — intake → confirm facts → research → shortlist rounds → plan (flow `plan`); renderers `tg_trip_facts`, `tg_shortlist`, `tg_plan_digest`; callbacks `tf sl` |
| `13_flow_review.js` | `/review [trip]` and the daily `tg_review_offer` (the day after a trip ends, once) — 👍 👎 + visit-length taps → a `prefs` request with `payload.review`; callback `rv` |
| `20_envelopes.js` | Handlers for the six pack envelope types (validate → store → the active `plan` flow, else the renderer); prefs review buttons `pf:<cid>:y\|e\|n` with ✏️ capture (`tg_capture_pf_edit`) → a `prefs` request with `payload.decisions`; the `tour_guide` snapshot in `state.json` |
| `22_people.js` | The people the owner travels with (Settings `tg_people`, ≤ 8), who comes on which trip, the day hours `/dates` sets, and `trip_update` — the dates, hours and travellers every research, plan and replan request carries so the routine writes them into the trip file |
| `21_sheets.js` | Tabs `Trips DayPlans Later Places Choices Shortlist` and their storage API (no Google fields are ever stored) |
| `30_chat_api.js` | Lane B (`tg_lane_b`): free text answered directly through the Claude API — **off by default**; `/smart on\|off` toggles it, `/status` shows the mode (`core_status`) |
| `31_route.js` | `/route A → B [mode]` through the Apps Script Maps service |
| `32_app_api.js` | `?route=app` for the Mini App (16 operations, see "The app"), the setup step `app_menu_button`, the 📱 `web_app` buttons on shortlist, plan and `/places` messages, and the shortlist-keyboard refresh after an app choice |
| `40_interview_bank.js` | Generated from `kits/prefs/presets/travel.interview.json` by the bundler (`--check` fails when stale) — never edit |

**Answer lanes.** Free text normally becomes a `message` request answered by the CHAT routine (Lane C, inside the subscription). Lane B answers in the chat at once through the Claude API, paid per use: it runs only when the owner has sent `/smart on` (or, before any `/smart`, `CHAT_API_ENABLED=true`) **and** `CLAUDE_API_KEY` is set.

**Script Properties the pack reads** (besides the core's): `CLAUDE_API_KEY` (secret; redacted from every log as an `*_API_KEY`), `CHAT_API_ENABLED` (default `false`), `CHAT_API_MODEL`, `CHAT_API_MODEL_LOOKUP`, `CHAT_API_MAX_PER_DAY`, and one `ROUTINE_FIRE_URL_<NAME>` / `ROUTINE_FIRE_TOKEN_<NAME>` pair per routine (`CHAT RESEARCH PLAN NOTES BROCHURE PREFS PLACES`). Consider raising `MAX_ROUTINE_FIRES_PER_DAY` to 20–24: a full `/plan` uses 4–6 fires.

**Trigger minutes** (measured in the mocks, `helpers/decisions/WP-5c.md` §M): a `/plan` with one extra shortlist round ≈ 45 s of one-off triggers; a typical day ≈ 0.5–1.5 of the 90 trigger-minutes, a heavy day 2.5–3. Webhook and wake-route runs are web-app executions and cost none.

## The app

`gas/32_app_api.js` serves the Telegram Mini App (the shell page `live-site-pages/helper-app.html`, built by WP-9c) through the core route `?route=app` (POST, `auth: 'webapp'`: the core verifies the owner's `initData` and counts the call against `MAX_APP_CALLS_PER_DAY`). Every operation is a request or a tap the chat already has, so the chat keeps working with the app switched off:

- `home` (the snapshot's data, the owner's display name and the current trip's people), `shortlist.get` (`all: true` adds the earlier rounds) `· choose · choose_many · more · done`, `people.list · add · trip`, `trip.digest`, `brochure.get` (the stored brochure HTML up to 200 000 characters, else its Drive link), `places.search · get · note · check`, `interview.bank · submit` (`person` answers for a companion: their own profile, never the owner's), `facts.get · confirm`.
- Writes and note requests run under the script lock (`registerRoute` `lock`), so two quick taps cannot interleave.
- A choice made in the app re-marks the chat's shortlist keyboard (message ids kept in Settings `tg_app_sl_msgs`).
- No Google call and no Google field: the app shows the pack's own rows only.
- Set `APP_SHELL_URL` (https) and run the setup step **Tour Guide: point the chat menu button at the app** to put the app in the chat's menu button. With the property set, the shortlist, plan and `/places` messages also carry one 📱 button that opens the app on the right screen; without it they are unchanged.

Answer shapes and reasons: `helpers/decisions/WP-9b.md`.

## Tests

`node --test helpers/tests/` runs the pack's suites: `pack_tour-guide_schemas`, `_estimator`, `_travellers`, `_later`, `_fixtures`, `_planner` (a small invented world of its own, `pack_tour-guide_planner_world.js`), `_planner_transit-fallback`, `_choices`, `_payloads`, `_gems`, `_brochure-map`, `_brochure-map_units`, `_integration`, and the chatbot's `pack_tour-guide_gas_{commands,interview,plan,review,envelopes,sheets,chat,route,app,e2e}` (the e2e runs the interview, the `/plan` journey, places, the review and the wake fallbacks against the Apps Script mocks). No test touches the network: Maps answers come from the fixture responder through the Maps kit's mock transport, and the PDF step runs only where `pdfAvailable()` is true (never in CI).

## What the pack never does

- Call Google without a Maps-kit client whose ledger counts every unit first; `planTrip` refuses to start a plan whose estimated SKUs exceed the ledger's ceiling (`PlanBudgetError`) unless the caller allows it.
- Keep Google content beyond the build: snapshots are read for the plan and the brochure of one build; only `place_id` and (for ≤ 30 days) coordinates are kept, per the Maps kit's rules.
- Store or read anything of the owner's: every file here is generic or invented; the owner's trips, places and profile live in the private repo and reach the engine as function arguments.
- Send messages, write to Drive or run a routine outside the framework's contracts: the chatbot (`gas/`) does it only through the core's Telegram, mailbox, request and routine-fire functions.

## Shortlist sheet — `shortlist-sheet/`
`node helpers/packs/tour-guide/shortlist-sheet/index.mjs shortlist.json out.pdf [--title T] [--dates D] [--stay S] [--notes notes.json] [--built-on YYYY-MM-DD] [--page letter|a4]` (exit 0 PDF · 3 HTML only · 1 error). Library: `shortlistSheetHtml(payload, opts)`, `renderShortlistPdf(payload, outPdf, opts)`. Built from the payload only (names, times, areas, why-you and gem lines, Maps links, the round's notes ≤ 12), in the brochure kit's typeface and colours; items appear in the chat's numbering so the owner can pick by number. The `trip-research` skill renders it and puts it on Drive with `tools/upload.mjs`, then names it in its reply's `drive_file_ids`.

Developed by: LightAISolutions
