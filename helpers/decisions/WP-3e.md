# WP-3e — decisions and defaults

## Given (coordinator)
1. **No fallback to driving.** A trip planned for transit stays on transit; only the minutes are estimated.
2. **Formula and defaults**: straight-line distance × 1.3 at `kmh` (20) plus `overhead_min` (12); `trip.transit_fallback` overrides both; the solver uses the same estimate; the warning text and code; legs keep the transit Maps link.

## Chosen
3. **Only TRANSIT falls back.** A DRIVE or WALK pair with no route still counts as unreachable (Infinity), exactly as before: Google not finding a walking or driving route is information about the place, not a data gap. The fallback is computed per day only when the day's mode is TRANSIT.
4. **Minutes are rounded up, at least 1; `distance_m` is the estimated route distance** (straight line × 1.3, in metres). The day-plan schema requires an integer distance, and the 1.3 factor is already the planner's model of the route. `source` stays `route` (the slot the leg fills); `estimated` says what it really is, so the `source` enum and every reader of it are unchanged.
5. **"Exempt estimated legs" = the recorded-time property, not the clock check.** `tour-guide-checks.mjs` still requires every leg's minutes to match its own depart/arrive times (estimated legs do, the timeline runs on them). The property that compares legs with the fixture travel table (integration and choices tests) skips estimated legs. The checks gain rules instead: only TRANSIT legs are estimated, `estimated` and `estimate_basis` go together, a day with estimated legs carries exactly one `transit_estimated` warning, and that warning never appears without one.
6. **Severity `warn`.** An `info` warning without a place disappears in the brochure (info notes attach to stops); `warn` lands in the day's "Mind" block, which is where "check before you go" belongs.
7. **A missing element and a `ROUTE_NOT_FOUND` element are the same case.** The kit reports both as no route; the tests strip half the elements and mark the other half `ROUTE_NOT_FOUND`, and a scratch run with an empty matrix answer also builds.
8. **No coordinates → no estimate.** A point without lat/lng (never the case for fixture places or lodgings) stays unreachable rather than guessed.
9. **Exports**: `transitFallback(trip)`, `estimateTransit(a, b, fallback)`, `TRANSIT_FALLBACK_DEFAULT`, `ROUTE_FACTOR`, `TRANSIT_ESTIMATED_TEXT` from `planner/index.mjs`, so the brain side and tests use the same numbers.

Developed by: LightAISolutions
