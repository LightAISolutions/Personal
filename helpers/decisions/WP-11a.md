# WP-11a — decisions and defaults (planner: real starts, dinners, evenings, facts, crowd timing)

Brief: `helpers/prompts/TG-PHASE-11.md` (WP-11a, Contract C11). State, checks and REQUESTs: `helpers/status/WP-11a.md`.

## Process
1. **Ownership.** Only WP-11a paths are edited: `packs/tour-guide/planner/*`, `estimator/*`, `fixtures/*`, the JSON of `tour-guide-day-plan.schema.json` (`tour-guide-plan.schema.json` needed no change), planner/estimator tests and new test files. `schemas/index.mjs` and `schemas/tour-guide-checks.mjs` are not edited; what they need is a REQUEST.
2. **Fixtures are invented**: two made-up towns (Brindlecombe, Ashvale) in "Fictional Isles", coordinates in open ocean (34.2 N 160.3 E), zone `Etc/GMT-11` (matches that longitude), dates 2027-10-18..20, ids `FixtureMd…`, URLs on `example.com` / `example.org` only. No network call; Google is reached only through the recorded fixture responder. JSON fixture files carry no "Developed by" line (JSON has no comment syntax; the existing fixtures have none either).
3. **Backward compatibility is gated, not hoped for.** Every new output field appears only for new input: the evening layer (sunset, extras) only when the trip has `season`, `day_overrides` or the input has `dinners`; stop `minutes_source` / `last_entry` only on places with `facts`; `crowd_slot` only when the profile's `avoid` asks for it; country defaults only when `trip.country` names a covered country; overrides only on dates listed. Proof: SHA-256 of planTrip, replanDays and estimateBudget on the three fixtures and planTrip on the mini world in three modes, generated at 683c9e6 and compared in `pack_tour-guide_planner_c11_units.test.js`.
4. **`chooseMinutes` return shape unchanged** (an existing test compares it whole): the planner derives `minutes_source` itself (`official` from facts or a booking length, `research` when the estimate has a range or typical, else `estimate`).

## Day overrides, bags and ends
| Default | Value | Reason |
|---|---|---|
| `END_MARGIN` | 10 min | Reach a departure point 10 minutes before the train: enough to find the platform; the brief asks only that the day "reaches it". |
| Hotel bag step | 15 min (`BAGS.HOTEL_MIN`) | Check-in desk or luggage room, one queue. |
| Locker store / collect | 10 / 10 min | Find a free coin locker, load or unload it. |
| Hard end | the solver gets no spill (`maxSpill: 0`) and the retimer fails the last stop that would reach the end late | A missed train is worse than a dropped sight. |
| Breakfast | none on a day with `start` | The day begins at the arrival. |
| `bags.at` for carry / forward | forward → `lodging`; carry → `day-start` when the day has a start, else `lodging` | Where the line belongs on the card. |
| Locker `bags.start` / `end` | store time / end of the collection | The two moments the owner needs. |
| Locker only with sights | a locker day with no candidates gets no locker loop | Nothing to free the hands for. |
| Departure day | no dinner, no back-early line, no extras; when the day reaches the end point at least `FREE_MIN` early, a free line "time to spare near <end> before HH:MM" | The evening belongs to the journey. |
| Same-point legs | 0-minute STAY legs only on override days, and anchor-to-anchor STAY legs are dropped | A locker loop with no sights has nothing to show. |
| Hours | a per-date `day_start` / `day_end` replaces the trip's for that date; `start.time` is the day's start; `end.time` caps `day_end`; a date whose end is not after its start is an input error (`planTrip` throws) | The C11 table. |

## Dinner
| Default | Value | Reason |
|---|---|---|
| Radius | 1.5 km straight line from the last stop or the night's lodging (`DINNER.RADIUS_KM`); on a day planned under an outline (Phase 11 wave 2), a place inside the day's own area or the outline's dinner place for that evening may be up to 5 km from the lodging (`DINNER.HOME_KM`) | "About 1.5 km" in the brief: a 20-minute walk. The outline gives a picked restaurant one evening in its own area; a day that ended back at the lodging early would otherwise lose it (`decisions/WP-11e.md` §1). |
| Latest end | 23:00 | As the old dinner line. Earliest start stays 18:30 (`DINNER_EARLIEST`, existing). |
| Direct vs via lodging | direct (last stop → dinner → lodging) when within the radius of the last stop and the wait is ≤ 60 min (`MAX_WAIT`); otherwise lodging → dinner → lodging after the day, with 15 min to freshen up (`FRESHEN_MIN`) | No one waits more than an hour on a street corner. |
| Choice | made on straight-line estimates (walk 4.5 km/h, drive 30 km/h + 5 min, × 1.3 route factor), then timed on the two real legs; if the real legs miss the hours the old dinner stays (the two requests are spent) | No extra requests to compare places. |
| Rank | owner ✅ picks (`chosen` or `choices.picks`) → Later list (`saved-for-later`) → the rest; nearest first within a rank | The brief's order. |
| Excluded | `facts.menu.fits: 'no'`, rejected, `choices.skip`, `choices.later` (so `checkPlan`'s kept-for-later rule holds), no snapshot location, closed or unknown hours that evening, a stop of any day, used for dinner on another day | |
| Budget | `dinner_calls: 2` per day without an end, plus their allowance (`extraCallsFor(mode, 2)`) | Honest legs under the Phase 10 rules. |
| Booking line | `trip.bookings` (same `place` and `for_date`) wins, then `facts.booking` (`text`, else "Booking required/advised · lead · how · from N people") | The planner never adds a booking. |
| Meal places in `places` | a meal-category place also offered in `dinners` (and not a lunch spot by its activity) is held back from the day's stops; unused, it goes to "Didn't fit" with "kept for dinner, but no evening had room" | Dinner is not a daytime stop. |

## Evening: extras and sunset
| Default | Value | Reason |
|---|---|---|
| Radius | 2 km straight line from the last stop or the night's lodging (`EXTRAS.RADIUS_KM`) | "About 2 km" in the brief. |
| Count | at most 3, events first, nearest first (`EXTRAS.MAX`) | WP-11a says 3; the goals table's "at most two" is the older wording — the WP section and C11 (`extras` ≤ 3) win. |
| Early finish | back at least 60 min before the day's end (`EARLY_MIN`) for saved places; events show on every day | The brief. |
| "Running that evening" | on that date; not a holiday or closure; ends at or after 17:00 or past midnight, or (start only) starts at or after 16:00, or (no times) is a light-up | An afternoon fair is not an evening. |
| Event location | its own lat/lng, else its place's snapshot; an event with only an `area` is not offered | The distance must be known. |
| Saved places | Later list or `saved-for-later`, not restaurants or cafes (dinner's job), not scheduled or rejected, open ≥ 30 min (`MIN_OPEN`) between 15 min after the finish (`AFTER_MIN`) and the day's end, offered on one day only | |
| Back-early line | replaced when a day has extras | The brief. |
| Sunset | NOAA Solar Calculator spreadsheet algorithm (Meeus), zenith 90.833°, at the night's lodging, in the trip's zone, iterated twice; null in polar day or night | Standard, offline. |
| Sunset references | London 21:21 / 15:53, Sydney 20:05 / 16:53, Tokyo 19:00 / 16:32 (2021-06-21 / 2021-12-21), Ushuaia 22:10 (2021-12-21) — the timeanddate.com sun tables for those cities and dates, as published there; written from that source without a network call (none is allowed), so the test also checks ≥ 400 latitude × longitude × season points against an independent algorithm (USNO "Almanac for Computers", 1990) within 2 minutes | Two independent checks; the recalled values are the weaker one. |

## Facts in the schedule
| Default | Value | Reason |
|---|---|---|
| Own close | replaces Google's last close of the day (earlier or later); windows opening after it are dropped | "Use its own." |
| Last entry | a window's `last`: a visit must start by it (`earliestFit`), and the stop carries `last_entry` | |
| `closed_weekdays` | closes the day; a weekday Google lists closed but the own site does not reopens on Google's known hours of another weekday | |
| `visit_minutes` | midpoint × the pace × interest × calibration factor, kept inside min–max, rounded to 5 → `minutes_source: 'official'` | The owner's pace still matters inside the official range. |
| Conflict line | `ownHoursConflict` (planner-facts.mjs), mirroring WP-11b's `factsConflict` kinds (closed_day, google_closed, close_time, last_entry_after_close) and its 15-minute tolerance; one info warning per place and date, ≤ 200 | The coordinator can point it at `factsConflict` at merge. |
| Unknown Google hours | stay unknown (no window on the stop), but the facts' close and last entry bound the schedule | Never invent opening hours. |

## Country defaults (Japan first)
| Category / session | Minutes | Source |
|---|---|---|
| temple | 60 | Inference from typical published visitor guidance for major temples (main hall, garden, sub-temple); not verified online (no network). Replaces the generic 45. |
| shrine | 40 | Same basis: approach, main hall, omamori counter; generic 30. |
| garden | 75 | Same basis: strolling gardens are loops of about an hour; generic 60. |
| tea ceremony (session) | 45 | Typical length of a tourist tea ceremony (set session, `fixed`). |
| course meal (kaiseki, omakase, shōjin, tasting menu) | 120 | Typical multi-course dinner length (set session, `fixed`). |
Applied only when the trip's `country` reads as Japan (`Japan`, `JP`, `JPN`, `Nippon`, `Nihon`, `日本`), and only when there is no researched range or typical length. Other countries: unchanged.

## Crowd timing
| Default | Value | Reason |
|---|---|---|
| Profile rule | `avoid` lines matching crowds/crowded, peak (hours/times/season), rush hour, queues, tour groups, mass tourism, busy times (`CROWD_RULE_RE`) | Covers the ways an owner says it. |
| Magnet | `crowd_magnet: true` on the place (WP-11b's field), or `flags` containing `crowd_magnet` (C11); read only, never recomputed | The coordinator's note. |
| Slots | start within 60 min of opening (and by the last entry), or the whole visit inside the last 90 min before the effective close | The brief. |
| Waiting | a magnet's quiet slot may wait any length, like a booking; the wait becomes a free line "until HH:MM, a quieter time at X" | Otherwise the 75-minute wait limit makes a late slot impossible. |
| No slot | planned on its full hours with an info warning ("no quieter slot fitted …"); never dropped | The brief. |

## Schema (`tour-guide-day-plan.schema.json`)
- Day: `start`, `end` (`{ name ≤ 120, time }`), `bags` (`{ kind, at: lodging | day-start, start?, end?, text ≤ 160 }`), `sunset`, `extras` (≤ 3 × `{ kind: event | saved, ref, name ≤ 120, time?, km, note? ≤ 160 }`); stop `last_entry`, `minutes_source`, `crowd_slot`; meal `booking` ≤ 160 and `at` may be a restaurant slug.
- `legs.maxItems` 26 → 30: 12 stops + 1, a bag leg, a locker leg on, two dinner legs and room to spare.


Developed by: LightAISolutions
