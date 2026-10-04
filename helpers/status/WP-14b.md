# WP-14b — status (Scout's ranking, tuned)

Branch `wp-14b` (from origin/main v01.65r). State: **done**, pending review.

## Done
1. Quality anchor per group (food 4.2, activities 4.3) — `scout-weights.mjs` `QUALITY_MU`, `scout-rank.mjs` `muFor`.
2. Chain penalty 8, crowd penalty 4 (crowd = gems `CROWD_MAGNET_MIN_COUNT`, re-exported as `CROWD_MIN_COUNT`).
3. Rescue from `unproven` (relevance ≥ 0.7 or veg `verified`); rescued place labelled `new`.
4. Drinks / cafés / markets "likely" for a vegetarian party (drinks also vegan); meals strict — `foodKind`, `kindLikely`.
5. Unjudged fit 0.3 and the `not_judged` label (schema enum, core `TG_SCOUT_LABELS`, board, app, chat line).
6. `parts.local` in the payload (schema, core validator, board fifth bar, app bars on the Scout screen).
7. One estimator: `estimateReach` (planner `walkMinutes` ≤ 20, else `railEstimate`), exported from `scout/index.mjs`.
- Old payloads (no `local`, no `not_judged`) still validate in schema and core and still display (tested).
- New test file `helpers/tests/pack_tour-guide_p14b_scout.test.js`; decisions in `helpers/decisions/WP-14b.md`; contract in `helpers/decisions/TG-SCOUT.md` §10.

## REQUESTs
- **Private driver (TourGuide repo / its Scout driver):** drop its own walk/train reach estimator and call `estimateReach(from, to, { fromStations, toStations })` from `vendor/helpers/packs/tour-guide/scout/index.mjs` (change 7). The walk limit is now 20 minutes in both places.

## Tests changed outside the new file (all Scout tests; assertions marked "WP-14b change N")
- `helpers/tests/pack_tour-guide_scout.test.js` — changes 1, 2, 5, 6, 7 (mu 4.2 scores, typed fixture, `not_judged` labels, `local: 50` part, refuse case `local = 101`, reach 20-minute walk / train estimate).
- `helpers/tests/pack_tour-guide_p13d_scout.test.js` — change 5 (`not_judged` in expected labels).
- `helpers/tests/pack_tour-guide_scout_redteam.test.js` — change 5 (`not_judged` in expected/allowed labels).

## Next
- None for this WP.

Developed by: LightAISolutions
