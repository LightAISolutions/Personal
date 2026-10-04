# WP-15b status — What's on (item 20), the season sheet and the evening

Branch `wp-15b` (worktree of `origin/main` at v01.68r, 6a27371, fast-forwarded to `p15-skeleton` 3e19825). Brief:
`helpers/prompts/TG-PHASE-15.md` "WP-15b". Decisions and defaults: `helpers/decisions/WP-15b.md`. **State: done.**

## Step 0
- `git merge --ff-only p15-skeleton` was a fast-forward (3e19825).
- Baseline: `node --test helpers/tests/` 1120 tests (1119 pass, 1 skipped), `bundle.mjs --all --check` ok,
  `boundary-check.mjs` clean, `new-branch.mjs --check whatson` complete.

## Done
- **Step 1, the season sheet (C15).** `season_event.chosen_on` and the kinds `exhibition` and `performance` in
  `schemas/tour-guide-trip.schema.json`; `checkSeason` refuses a `chosen_on` that is not a date or lies outside
  `from`..`to`; `normalizeSeason` keeps it (`pack_tour-guide_season.test.js`).

- **Step 2, the evening (change E) and `chosen`** (`pack_tour-guide_whatson_evening.test.js`, fault reproduced first).
  - `planner-evening.mjs`: `CHOSEN_RADIUS_KM` 10, `isEveningChoice`, the under-way-at-finish rule, chosen evening events
    first with `chosen: true`, and the far-choice info warning.
  - `planner/index.mjs`: passes `warnings`, and exports `isEveningChoice`.
  - `chosen` in the day-plan and digest schemas, the core's `tgEnvDayC11`, the chat's `tgCmdDayExtraLines` (⭐,
    "This evening") and the app's day view.

- **Step 3, the engine, the schema, both validators and the core** (`pack_tour-guide_whatson_engine.test.js`,
  `pack_tour-guide_whatson.test.js`).
  - `whatson/`: `whatson-check.mjs` (`validateWhatsonPayload`, `checkWhatson`, no imports), `whatson-text.mjs`
    (`parseWhatsonText`), `whatson-events.mjs` (`eventId`, `normalizeWhatson`, `newItems`, `toSeasonEvent`,
    `mergeChosen`), `whatson-payload.mjs` (`whatsonPayload`, self-contained schema check); fixtures `whatson-sample.json`
    (valid/invalid/semantic) and `whatson-parse-cases.json` (the shared case list).
  - `schemas/tour-guide-whatson.schema.json`: the full C15 payload.
  - `gas/42_whatson.js`: `/whatson` (words, defaults, refusals, `last`, `auto on|off`), the WhatsOn tab, the validator
    mirror, the card, the `wo` buttons (which day, re-plan, un-choose), alarm `tg_whatson`, snapshot `whatson_chosen`,
    the handler (silent auto boards unless new).
  - `gas/34_whatson_app.js`: `whatson.list`, `whatson.get`, `whatson.choose`, `whatson.new`.

- **Step 4, the What's on screen** in `live-site-pages/helper-app.html` (no version file or changelog;
  `pack_tour-guide_whatson_app.test.js`, the page's own code in a VM against the real core).
  - Wiring: the `whatson` entry in SCREENS, `WHATSON_ID_RE`, `S.board`, `board` in `readParams`, `whatson: showWhatson` in
    `go()`, and the nav button's reset. WP-15a added its daytrip entries to the same lines on main: keep both.
  - The list (boards, the form → `whatson.new`), a board grouped by date (kind, times, venue, why, food, price, booking,
    source, confidence, labels; sources; left out), the Choose toggle with its day picker, Re-plan on a planned day,
    un-choosing.

- **Step 5, the docs.** `whatson/README.md` (rewritten: the parts, the words, the engine, the core and the app),
  `season/README.md` (`chosen_on`, `exhibition`, `performance`), and in the pack README the `whatson/` row, the evening
  bullet, `chosen` on the digest's extras, the season line, and the rows for `34_whatson_app.js` and `42_whatson.js`.

## Next
- Nothing: the final checks, then the hand-back.

## REQUESTs
- `helpers/packs/tour-guide/schemas/index.mjs`: `import { checkWhatson } from '../whatson/whatson-check.mjs';` and
  `KINDS['whatson'] = checkWhatson` (in place of `null`). Why: the rules the JSON schema cannot say (window ≤ 31 days,
  `to ≥ from`, each item's run and days, a day in the window, the order, unique ids, the 40 000 cap) are then checked
  by `validatePayload('whatson', …)` and `tools/envelope.mjs --pack tour-guide`. `whatson-check.mjs` has no imports, so
  there is no cycle; the fixture's `semantic` list is the test (each must then fail `validatePayload`).
- `helpers/packs/tour-guide/gas/32_app_api.js` `tgAppDayC11`: in the extras map, add `if (x.chosen === true) o.chosen = true;`.
  Why: `tgAppAnchor` keeps only listed keys, so `trip.digest` drops `chosen` and the app cannot show ⭐ or "This evening"
  (C15 `chosen` on digest extras). `tgAppS(true)` would give the string "true", so the key needs this check rather than
  a place in the keys list.
- The two new season kinds, `exhibition` and `performance`, in the other kind lists (C15 added them to the trip schema).
  Why: until then a season sheet's exhibitions and performances are skipped without a word by the brochure's season page
  and by the journey's evenings (old kinds behave exactly as before, so nothing breaks):
  - `helpers/packs/tour-guide/brochure-map/brochure-map-facts.mjs` `EVENT_KINDS`: add `'exhibition', 'performance'`;
  - `helpers/kits/brochure/schema/brochure.schema.json` (the season event `kind` enum, line ~279): add both;
  - `helpers/kits/brochure/lib/sections/season.mjs` `EVENT_KIND`: `exhibition: 'Exhibition', performance: 'Performance'`;
  - `helpers/packs/tour-guide/journey/journey-areas.mjs` `EVENING_KINDS`: add both, matching the planner, which treats every
    kind but `holiday` and `closure` as a possible evening (`planner-evening.mjs` `NOT_EVENING`).
- `helpers/SPEC.md` §16: a row for WP-15b — `helpers/packs/tour-guide/whatson/*`, `gas/{42_whatson,34_whatson_app}.js`,
  `schemas/tour-guide-whatson.schema.json`, the What's on screen and the day view's extras in
  `live-site-pages/helper-app.html`, `season_event` in `schemas/tour-guide-trip.schema.json`, `checkSeason` in
  `schemas/tour-guide-checks.mjs`, `season/season-normalize.mjs`, `planner/planner-evening.mjs` and the extras call and
  export in `planner/index.mjs`, `chosen` in `schemas/tour-guide-{day-plan,plan-digest}.schema.json`, `tgEnvDayC11` in
  `gas/20_envelopes.js`, `tgCmdDayExtraLines` in `gas/10_commands.js`,
  `helpers/tests/pack_tour-guide_{whatson,whatson_*,season}.test.js`, `helpers/status/WP-15b.md`,
  `helpers/decisions/WP-15b.md` | WP-15b What's on, the season sheet and the evening (Phase 15) | `/whatson`, the
  `whatson` envelope and the weekly check, `season_event.chosen_on`, chosen evening events in the plan.
- `live-site-pages/helper-app.html`, merge note (not a change to make): WP-15a's daytrip entries and mine sit on the same
  wiring lines (SCREENS, `S`, `readParams`, the `go()` map, the nav reset). Keep both; mine are the `whatson` entry,
  `WHATSON_ID_RE`, `board: ''`, the `board` parameter, `whatson: showWhatson` and `if (s.id === 'whatson') S.board = '';`.
  The screen itself is one block, `/* ---------- what's on: … */`, just before `/* ---------- boot ---------- */`.

## Tests outside my paths that I changed
- `helpers/tests/pack_tour-guide_p13a_timing.test.js`, test "A12: on a day that starts late …": the assertion
  `fair.time === bags.end` became **E**. The fair runs 17:30–21:00 and is under way when the stops finish, so it is now
  offered after the last stop (the later of finish + AFTER_MIN and ready), with at least MIN_OPEN left. It was offered
  from the arrival, during the stops. The "never before the arrival and its bag step" assertions are unchanged.
- `helpers/tests/pack_tour-guide_gas_bookings.test.js` and `helpers/tests/pack_tour-guide_p13c_reminders.test.js`,
  `fresh()`: one setup line, `ctx.settingSet('whatson_auto', 'off', 'test')`, marked **C15**. Their trips start within
  21 days, so the weekly What's on check (alarm `tg_whatson`, on by default) is due at once and takes the one alarm
  trigger first; the tests watch the bookings alarm alone. No assertion changed.
- `helpers/tests/pack_tour-guide_vegcard_app.test.js`, test "the app page: … go() opens the Veg card screen": `showWhatson`
  added to its `shows` list, marked **C15**. `go()` now maps the What's on screen, so the VM needs the name. No assertion
  changed. (WP-15a adds `showDaytrip` to the same list on main: keep both.)

Developed by: LightAISolutions
