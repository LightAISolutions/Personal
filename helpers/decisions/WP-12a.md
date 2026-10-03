# WP-12a — decisions and defaults (planner and contracts: when to leave, the day's town, re-plans from where you are)

Brief: `helpers/prompts/TG-PHASE-12.md` (WP-12a, Contract C12). State, checks and REQUESTs: `helpers/status/WP-12a.md`.

## Process
1. **Ownership.** Only WP-12a paths are edited: the planner, facts and fixtures directories, the trip, place and
   day-plan schemas, `checkTrip` / `checkPlace` / `checkDayPlan` / `checkDayChain` (and helpers next to them) in
   `schemas/tour-guide-checks.mjs`, one line in an existing planner test (below) and two new test files. The Plan
   schema needed no change (it holds DayPlans by reference).
2. **No network, no installs, no live API.** Every Maps answer comes from the fixture responder.
3. **Invented data only.** The new fixture `rehearsal-day` names two invented towns (Quillmere, Tarnwick) on the
   "Fictional Isles", country code `ZZ` (user-assigned in ISO 3166-1, so never a real country), zone `Etc/GMT+10`,
   dates 2027-11-08 to 2027-11-10 (Monday to Wednesday, checked with `date -d`), reserved domains only.

## Schemas and checks (C12 inputs and outputs)
4. **One `access` definition per schema.** The trip and place schemas each carry an identical `$defs.access` (the
   validator subset resolves only local `#/$defs` references). An empty list is allowed (no `minItems`): "no access
   note" and "an empty one" mean the same, and the brief bounds only the maximum.
5. **checkAccess (new, next to checkPlace).** Two entries naming the same station on the same line (case and spacing
   ignored; a missing line counts as its own line) are refused, on a lodging and in place facts, and `normalizeFacts`
   runs the same check. Two lines at one station are fine.
6. **leave_by is checked, not just typed.** `checkDayPlan` refuses a `leave_by` that is not the first leg's
   `depart_at`, and a `leave_by` on a day without legs. `areas` may not name one town twice.
7. **"here" in checkDayChain.** `here` is never a stop and never a leg's `to`. It may be the `from` of the first leg,
   or of the leg right after the one that reaches the last visited stop (where a re-plan restarts) — nowhere else.
   Visited stops come first. At the last visited stop the timeline may move on from its arrival (a re-plan at 10:30
   from a stop planned until 11:00 leaves at 10:30). `checkDayChain` exports `HERE` from the checks module.
8. **factsLines unchanged.** It never reads `local_name`, `address` or `access`; a test pins that adding them changes
   no line.

## The morning fields
9. **leave_by** is set on every day the planner builds (planTrip, replanDays, planDates) that has a leg; kept days of
   a re-plan are copied untouched. A re-planned day keeps its morning `leave_by` (the history is not rewritten).
10. **areas** = the morning lodging's `area`, then the night lodging's when different, trimmed to 60; absent when
   neither lodging has one. Start and end overrides do not change it (the areas are the lodgings' towns).
11. **The golden test.** `pack_tour-guide_planner_c11_units.test.js` (planner tests are WP-12a's) now strips
   `leave_by` before hashing, after asserting it equals the first leg's departure and that no `areas` appears on the
   old fixtures. The 683c9e6 hashes are unchanged, so everything else is still byte-identical.

## The re-plan from where you are (planner-restart.mjs)
12. **One date only**; two or more with `from` is refused. `visited` and `rain` without `from` are ignored, so a
    re-plan without `from` is byte for byte the old one (tested with `visited`, `rain` and `from: null`).
13. **Request bounds** (`restartErrors`, exported for the core to reuse): `from` exactly one of `place` (a slug, never
    `here`) and `point` (`lat` −90..90, `lng` −180..180, no other key), `time` HH:MM; `visited` ≤ 25 slugs, each
    once; `rain` only `true`. Any error refuses the re-plan before a Maps request.
14. **Visited is read in the day's order.** Slugs that are not stops of that date are ignored and named in one info
    warning (the core may send a stale list); `from.place` must be a stop of that date, is added to `visited`, and must
    be the last visited one (starting from an earlier stop than one already done is refused).
15. **Start time** T = the latest of `from.time`, the day's start and the last visited stop's arrival. A re-plan at
    or after the day's hard end (its `end` override less the station margin, else `day_end`) is refused ("too late").
16. **The restart point.** `from.place` uses that place's snapshot coordinates; `from.point` becomes the reserved
    point `here`, named "where you were". Its coordinates reach the Routes requests only: no field of the plan holds
    them, and links that start there omit the origin (Google then starts from the viewer's own location). Tested by
    searching the plan JSON for the point's digits.
17. **The kept part.** Legs to the visited stops are copied verbatim. When a stop between two visited ones was not
    visited, one leg is kept from the old times (departure of the first skipped leg, arrival of the reaching leg, the
    distances summed), noted "Kept from before the re-plan; not re-routed" — no Maps request for history. The hotel
    bag leg is kept once the bags are left. Breakfast is kept once anything is visited or it is over; a lunch is kept
    when it is over and was at the lodging, the day start or a visited stop, and then the rest plans no second lunch.
    Free slots and place warnings of the history are kept; the old `transit_estimated` warning is recomputed over
    all legs.
18. **The rest of the day** is planned as a day override starting at the restart point (planDay as before: day end,
    opening hours, last entry, the dinner, crowd slots, bag steps). Bags: a hotel step not done yet becomes the
    rest's step; a locker already used stays (its end may move); a locker not yet reached while elsewhere becomes
    `carry`; carry and forward stay.
19. **The pool.** Every place the re-plan may use except the visited ones: the day's other stops (a stop the core
    dropped for running late is still a stop or a `scheduled` place, so it is a candidate again) and, new here, a
    place the plan put on the Later list because that day ran out of time (`lateAgain`: code `day_full`,
    `from_date` that date) even though the plan marked it `saved-for-later`.
20. **Later reasons** from the re-planned day start "re-planned at HH:MM: " (both the assignment's and the day's).
21. **Warnings.** The first line says "Re-planned at HH:MM from <place | where you were>[, covered places first]".
22. **day_url** covers the rest of the day (from the restart point to the end); the history has its own leg links.
23. **Budget.** The restart day is budgeted as a day override (its matrix includes the restart point, the end and a
    bag point; bag legs as Phase 11). The history costs nothing. A test checks every unit the re-plan spends is
    within its budget and recorded in `usage`, for a place and for a point.

## Rain
24. **Covered** = `isCoveredSight`, plus meal places (restaurant, cafe, bar) unless `indoor: false`.
25. **Ranking and weight.** Candidates carry `rain`; assignment ranks covered places right after bookings and anchors;
    the solver weighs a covered place 2000× its normal weight (anchors stay must-haves), so any set of covered places
    outweighs any set of outdoor ones: an outdoor place is planned only in time no covered place can use.
26. **Meals.** The lunch spot prefers an indoor one before priority; the dinner prefers a place not marked
    `indoor: false` that evening (after the outline's own preference, before rank).
27. **No rain_swaps** on the re-planned day (it already is the swap); other days keep theirs.

## Observations for the coordinator (not changed: older behaviour)
28. `replanDays` with `input.places` = the trip's own places (not `plan.places`) leaves a kept day's dinner place out
    of `plan.places`, so the Plan fails validation ("unknown place"). The tests pass `places: plan.places`. With
    `plan.places`, a dinner place the plan used reads `scheduled`, which ranks below `saved-for-later` in the dinner
    pool, so a plain re-plan may change a chosen dinner. Neither is new in Phase 12; WP-12b's core decides which places
    it sends.
29. A pool with two lunch spots plans the second as an ordinary stop (older planDay behaviour); the C12 fixture has
    two on purpose so the rain test shows the indoor one chosen.

Developed by: LightAISolutions
