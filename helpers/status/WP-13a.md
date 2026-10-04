# WP-13a — Planner: the day's shape

**State: done.**
- Brief: `helpers/prompts/TG-PHASE-13.md` (WP-13a, Rules). Decisions and defaults: `helpers/decisions/WP-13a.md`.
- Worktree branch `wp-13a`, from `origin/main` c4d57ba (v01.63r). Not pushed.
- Step 0: `node --test helpers/tests/` 882 tests, 881 pass, 1 skipped, 0 fail; `bundle.mjs --all --check` ok;
  `boundary-check.mjs` clean.
- Finish: 900 tests, 899 pass, 1 skipped, 0 fail; bundle check ok; boundary check clean.

## Done
- A1: `solveDay` returns an empty `overrun` result instead of throwing; `planDay` builds the day without stops, start →
  end, with the `over_long_day` alert (overrun and the `/dates … hours` fix, ≤ 200 chars); `checkDayChain` accepts it.
- A2: `withOverride` clamps an inverted override (`clampOverride`, `CLAMP_MINUTES`) with a warn warning; both ends
  fixed → no stops and an alert.
- A3: a booking widens its day (start step and leg before, leg back after) with an info warning; a hard end never
  moves and a booking past it goes to Later naming that day and end; Later reasons quote the named day's window.
- A13: a booking dated outside the trip → Later, code `other`, "<name> is booked for <date>, outside the trip's dates".
- A8: a hard-end day's last leg leaves as late as allowed; free time before it; a transit leg asked again once at its
  new departure, counted in the day and in `budgetFor` (`late_leg_calls`).
- A12: evening extras start no earlier than the day's departure after its start step.
- A5 (hours): own hours/length facts older than FACTS_MAX_AGE_DAYS (trip-zone date of `now`) still apply, with
  "facts are old: <name>, checked <date>" on stops and dinners and the stop's check line (`oldFactsDate`).
- Tests (each failed before the fix): `pack_tour-guide_p13a_trip_breakers.test.js` (10),
  `pack_tour-guide_p13a_timing.test.js` (3), `pack_tour-guide_p13a_facts_age.test.js` (4),
  `pack_tour-guide_p13a_old_fixtures.test.js` (1).
- Tests changed outside the new files (A8, each assertion marked): `pack_tour-guide_phase11_wave2_e2e.test.js`
  (no owner this phase), `pack_tour-guide_planner_c11.test.js` (my module's).

## Next
- Nothing in WP-13a. The coordinator merges and plays the departure-day probe.

## REQUESTs
1. Coordinator / private repo — `checkTrip` (`checkDayOverrides`) still reports an override shorter than two hours or
   inverted, as before. If the plan-days skill validates the trip file before planning, an inverted override written by
   the brain, an outline or the app still stops the run there; either let the skill plan anyway (the planner now clamps
   with a warning) or ask WP-13a in a later phase to downgrade that check. Why: A2's clamp only helps a trip that
   reaches the planner.
2. Pack README (`helpers/packs/tour-guide/README.md`, contract text; not in WP-13a's paths) — document the new day-plan
   texts: the A1 `over_long_day` alert, the A2 clamp warning, the A3 "Day hours widened" info, the A5 "facts are old"
   info and check line, the A8 free-time note "free time near <place> before you leave for <end>", and Later code
   `other` for a booking outside the trip. Why: one contract text for the brain and the app.
3. WP-13b — `factsStale` gains its optional zone argument; WP-13a calls it with the trip-zone date string
   (`planToday`), so it needs no zone and keeps working. No change needed unless the signature changes.
4. Coordinator — at the merge, WP-13b's `facts.irregular` / `irregular_note` reach the planner through
   `planner-input.mjs` (`prepare`, a WP-13a file) as the brief says; the check line from A5 yields to any check line
   `checkOnDay` already gives.

Developed by: LightAISolutions
