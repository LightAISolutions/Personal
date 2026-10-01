# WP-3a — decisions and defaults

The brief left these open; each was chosen without asking, per the WP rules. They are numbered so 3b, 3c and the coordinator can cite them.

1. **Reuse the brochure kit's validator.** `schemas/index.mjs` imports `helpers/kits/brochure/lib/validate.mjs` instead of copying it.
   - Why: one JSON Schema subset in the repo, so a fix lands once. The kit is already in every bundle that uses the pack.
   - Schemas use only that subset: type, const, enum, properties, required, additionalProperties, propertyNames, maxProperties, items, minItems, maxItems, minLength, maxLength, pattern, minimum, maximum, anyOf, and local `$ref` to `#/$defs/…`.

2. **A Plan's parts are validated in code, not by cross-file `$ref`.**
   - The subset has no cross-file `$ref`. So `tour-guide-plan.schema.json` checks only the envelope (`v`, `trip_id`, `places[]`, `days[]`, `later[]`, `budget`, `usage`).
   - `validate(plan, 'plan')` then validates each part as its own kind and prefixes paths, e.g. `/days/1/legs/0/minutes`.
   - Why: errors keep exact paths, and each schema file stays standalone.

3. **A tenth kind, `profile-excerpt`.** It covers the profile fields the planner and estimator read: pace, interests by category, meals, mobility and avoid.
   - Why: the fixtures ship a profile part, and every fixture part should validate.
   - It is an excerpt, not the owner's profile file. The file name follows the boundary rule: no name starts with `profile`.

4. **Place carries an optional `scheduled_hint: { date }`.**
   - Why: the brief's `promote()` sends a place back as a candidate for a given day. The hint is where that date lives until the planner places it.
   - `demote()` deletes the hint.

5. **Night rule for lodgings.**
   - A lodging covers the nights [from, to).
   - A day starts at the previous night's lodging (day 1 starts at its own night's lodging) and ends at that night's lodging.
   - The last trip date has no night of its own. It ends at the lodging whose `to` equals `end_date`.
   - Trip validation requires exactly one lodging for every night from start_date up to, but not including, end_date. If no lodging has `to` = end_date, it requires one for end_date's night too.
   - Why: it matches how a hotel booking reads and avoids "where does the last day end" ambiguity.

6. **Day-plan and plan semantic checks.** These run only after the schema pass is clean. Errors are capped at 50.
   - **Leg and stop structure:**
     - legs = stops + 1, or ≤ 1 for a day with no stops
     - the first leg starts from `lodging` and the last ends at it
     - each leg's `to` is the next stop's place
   - **Timeline:**
     - Times may cross midnight: a time more than 12 h earlier than the previous one counts as the next day.
     - Items must run in order, and every end must be ≥ its start.
     - Each leg's arrive − depart must equal its `minutes` within ±1, to allow for rounding of seconds-based durations.
     - A stop's `minutes` must be ≤ its arrive–depart span; the rest is slack.
   - **Opening window:**
     - A stop must have open ≤ arrive and depart ≤ close.
     - close ≤ open means the window ends the next day, and `24:00` is allowed.
   - **Plan rules:**
     - a non-rejected place must be scheduled or in a Later list
     - a place is never both scheduled and listed
     - a place is in at most one list
     - status `scheduled` ⇔ the place is in some day's stops
   - Why: these are the invariants 3b's planner and 3c's brochure both rely on. Checking them once here keeps both honest.

7. **`chooseMinutes` defaults.**
   - **Base:** the estimate's `chosen_minutes`, else typical, else the range midpoint, else the category default.
     - Category defaults: museum 120, viewpoint 30, market 60, hike 180, park 60, church 30, neighbourhood 90, restaurant 75, cafe 30, shop 45, other 60.
   - **Factors:** pace × interest × calibration.
     - Pace: relaxed 1.15, normal 1, packed 0.85.
     - Interest: an explicit value wins, else the profile's interest for the category, else normal. Low 0.8, normal 1, high 1.25.
   - **With a range:** min and max are scaled by the same factor. Every value is rounded to 5 and kept within [ceil5(max(15, ½·range min)), floor5(2·range max)].
   - **Without a range:** min = max = minutes, clamped to 15–1440.
   - **Confidence:** the estimate's own, else `unverified`.
   - Why: adjustments stay proportional and bounded. A single tap or a "high interest" setting can never turn a 30-minute viewpoint into a half-day.

8. **Calibration.** Factor = 1 + 0.1 × (longer − shorter), rounded to 2 decimals and clamped to 0.7–1.4. `about-right` is counted as `about_right` but does not move the factor. `applyTap` returns a new state.
   - Why: it is bounded and reversible, as row 3a asks. An opposite tap exactly undoes one, and rounding avoids float noise in stored state.

9. **`buildEstimate` details.**
   - Sources cited only by mentions flagged `injection_suspect` are dropped, so the estimate never points at untrusted text that was ignored.
   - `estimated_on` is the UTC calendar day of `now`.
   - `calibration` starts `null`; `chooseMinutes` applies it at plan time, so stored estimates stay source-only.

10. **Later lists.**
    - Adding a place that is already listed moves it, so a place is never in two lists.
    - An unknown list name creates that list, with the trip_id of the first list.
    - Machine codes go to "Didn't fit"; code `owner` goes to "Next time". `demote()` defaults to `owner`, since it is the owner's tap.
    - `from_date` is optional. `affected_days` may be empty when the place wasn't scheduled.
    - Nothing is mutated.

11. **`fixtureTravel` lookup order.**
    1. The tabled `from|to` pair.
    2. Its reverse twin.
    3. A haversine × 1.3 detour fallback at the mode's speed, plus a fixed overhead: WALK 4.5 km/h + 0 s, TRANSIT 14 km/h + 420 s, DRIVE 45 km/h + 180 s. A fixture may override this with `routes.fallback`.
    - The same place gives 0. An unknown id throws code NOT_FOUND; a bad mode throws BAD_INPUT.
    - The result is exactly `{ durationSec, distanceMeters, line? }`.
    - Why: one source of truth for every responder answer. Tabled pairs are generated near-symmetric (ratio within 0.75–1.33), so tests can assert that.

12. **Responder behaviour.**
    - It honours `X-Goog-FieldMask` (top-level field names), so mask tiers can be tested.
    - Waypoints resolve by `placeId`, by `latLng` within 50 m of a snapshot, or by an exact address. Anything else gets a 404 `NOT_FOUND`, which the kit turns into `HTTP_404`.
    - TRANSIT with intermediates gives a 400, as the real API does.
    - TRANSIT legs are WALK + TRANSIT + WALK steps when the pair has a line (vehicle TRAM, BUS or SUBWAY from the line name). Without a line they are a single WALK step. Stop times appear when `departureTime` is given.
    - `optimizeWaypointOrder` uses nearest-neighbour from the origin on `fixtureTravel` durations, with ties going to the lower index.
    - Why: these are deterministic and close enough to the API for the planner's code paths.

13. **Invented geography and calendar.**
    - Coordinates are in open ocean (about 36–43° N, 33–41° W) under invented names.
    - Time zones are `Etc/GMT+2` and `Etc/GMT+3`, so there is no daylight-saving change. Dates are in 2027.
    - Ids are `FixtureTc…` and `FixtureDl…`; URLs use example.com, .org and .net only.
    - The generator scripts live in the session scratchpad, not the repo. The JSON is the artifact, and the tests pin its invariants.

14. **Far-off place position.** northcape-sea-stacks sits at 42.85, -40.35, about 184 km from brackenford-inn and more than 150 km from every lodging. It is deliberately absent from the route table.
    - Why: the first position (42.65) was only about 137 km from gullhaven-lodge, which is too close to be clearly a "doesn't fit" case for 3b.

Developed by: LightAISolutions
