# WP-13b — Planner: hours, facts, season, rail, dinner

**State: done.**
- Brief: `helpers/prompts/TG-PHASE-13.md` (Contract C13, WP-13b, Rules), read from the coordinator's commit 8a29e0a
  (the brief is not on this branch's base). Decisions and defaults: `helpers/decisions/WP-13b.md`.
- Worktree branch `wp-13b`, from `origin/main` c4d57ba (v01.63r). Not pushed.
- Step 0: `node --test helpers/tests/` 882 tests, 881 pass, 1 skipped, 0 fail; `bundle.mjs --all --check` ok;
  `boundary-check.mjs` clean.
- Final: `node --test helpers/tests/` 898 tests, 897 pass, 1 skipped, 0 fail (16 new); `bundle.mjs --all --check` ok
  (hello, tour-guide); `boundary-check.mjs` clean.

## Done
- **A7** (`planner-hours.mjs`): irregular wording counts only for the weekday whose line carries it
  (`irregularWeekdays`, `lineForWeekday`, `lineWeekday`, `isIrregularLine`); a "Closed" line with only the holiday
  caveat stays closed. The no-periods path reads the named line too.
- **B7** (C13; place schema, `checkPlace`, `planner-facts.mjs`, `facts/*`): `facts.irregular` (`const: true`) and
  `facts.irregular_note` (1–160, visible text). `placeFacts` exposes them; `factsHours` turns a Google-closed or unknown
  date into `irregular` with the known windows; no `closed_day` conflict for an irregular place; facts line leads with
  "Opening days vary[: note]"; `placeCheckNote(place)` for the check line.
- **A14** (`planner-rain.mjs`): rain swaps pass the place's irregular flag (opening_days or facts) to `hoursOn`.
- **A9** (`planner-rail.mjs`): 40–150 km is a conventional line, `ceil(20 + km × 1.2 / 60 × 60)`; 85 km → 122 min.
  City and high-speed bands unchanged.
- **A6** (`season/*`): roses May–November; autumn-flowering cherries (English and local terms, name or tags) in season
  October–December as well, shifted south of the equator.
- **A4/A5 menus** (`planner-dinner.mjs`): inside each owner rank, a current yes, then current partly, then unchecked or
  older than 30 days; notes "menu not checked for <diet>" / "menu last checked <date>". `dinnerMenu`, `MENU_RANK`;
  optional `today` and `diet` on `prepareDinners`.
- **A15** (`facts/facts-check.mjs`, `facts-lines.mjs`): `dateOf(now, timeZone?)`, `factsStale(facts, now, timeZone?)`,
  `factsLines`/`menuLine` `{ timeZone }`. Every existing call unchanged.
- New tests: `pack_tour-guide_p13b_hours.test.js` (8), `pack_tour-guide_p13b_rail_season.test.js` (4),
  `pack_tour-guide_p13b_dinner.test.js` (4). Owned tests adjusted: `pack_tour-guide_rail.test.js` (A9, 100 km bound),
  `pack_tour-guide_season.test.js` (A6, rose "out" dates moved to December).

## REQUESTs
1. REQUEST `helpers/packs/tour-guide/planner/index.mjs` (WP-13a): pass `today: ctx.today, diet: input.profile &&
   input.profile.diet` to `prepareDinners` at its three calls (planTrip ~l.110, replan ~l.291, budget ~l.328). Why: A5
   menu staleness needs the plan's day; until wired a stale menu ranks as current in `planTrip`.
2. REQUEST `planner/index.mjs` (WP-13a): re-export `irregularWeekdays`, `lineForWeekday`, `lineWeekday`,
   `isIrregularLine`, `HOLIDAY_CAVEAT_RE` (planner-hours); `placeCheckNote`, `closedWeekdaysOf` (planner-facts);
   `dinnerMenu`, `MENU_RANK` (planner-dinner). Why: the planner's public surface.
3. REQUEST `planner/planner-input.mjs` (coordinator wiring at the merge): replace the opening_note-only line (~l.141)
   with `const note = placeCheckNote(p); if (note) cand.opening_note = note;`. Why: B7 check line uses
   `facts.irregular_note` when there is no `opening_note`.
4. REQUEST WP-13a's A5 hours code may call `factsStale(facts, now, trip.timezone)` now that the zone argument exists
   (A15). No change needed for existing calls.
5. REQUEST `journey/journey-areas.mjs` (unowned): its `hoursOn` call (~l.46) passes only `opening_days`; pass
   `p.opening_days === 'irregular' || placeFacts(p)?.irregular` so a `facts.irregular` place is not read as closed.

## Tests outside WP-13b's paths changed
- `helpers/tests/pack_tour-guide_planner_tidy.test.js` — **A7**: the "vary" fixture's Monday line now says
  "Monday: Hours vary" (the old fixture put the wording on another weekday's line); added an assertion that Tuesday,
  whose line is "Closed", stays closed.
- `helpers/tests/pack_tour-guide_gems_c11.test.js` — **A6**: the rose garden is now in season in November, so the
  out-of-season screen and the forecast case use December dates; a November screen keeps it.

Developed by: LightAISolutions
