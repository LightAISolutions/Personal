# Phase 16 — Before the trip: Quiet and Menu check

> Written 2026-10-04 by the coordinator of the owner's morning review. The owner approved decision-page items 13 (Quiet) and 14 (Menu check); they follow Phase 15 and come before the rehearsal. The owner's model rule from Phase 15 holds: builders are `hb-builder-opus`, and no other agent type builds. Start with `Read helpers/prompts/TG-PHASE-16.md and execute it exactly.` Progress in `helpers/BUILD-STATE.md`.

Both are **branches** in the sense of Phase 14's scaffold (`helpers/tools/new-branch.mjs`, `helpers/tools/README.md` "Branches"): a command, a request kind answered by the Discover routine (trip research until it exists), a pure engine with tests, a validated envelope that carries only our own words, scores and place ids, a tab, a chat card and an app screen. Each also puts **a one-tap button where the owner meets the problem**: 🕊 under a stop that the plan times around the crowds, and 🍽 under a planned dinner whose menu nobody has checked, on the day card, the morning message and the app's day view.

**The owner's notes, generalised.**
- **Item 13.** The owner's profile asks to avoid crowds and peak hours, and a trip can fall in a destination's busiest weeks. Phase 11 already times a crowd magnet at opening or late; Quiet offers an alternative, not just a timing.
- **Item 14.** Phase 13 made the planner say when a dinner's menu is unchecked, or was checked more than 30 days before the dinner. Menu check turns an unknown into a known in minutes, for the dinner the owner is about to choose, instead of waiting for a research round. Menus change with the seasons, so every check is dated.
- **Item 16** (built in Phase 14) is one Discover routine for Scout, Save, Compare, Quiet and Menu, chosen by request kind. Both new kinds are discovery kinds.

## Done when (the owner's criteria, generalised for this public repo)

| Item | Done when |
|---|---|
| 13 Quiet | `/quiet <place> [on <date>]` returns, within one routine run, a board for that crowd magnet: up to 3 quieter places of the same kind within 30 minutes of it, each with the minutes from the magnet, how much quieter it is, why it is worth it and when to go; and the magnet's quietest hours with their source, for the day the owner goes anyway. Every place shown is saved as a candidate, and ➕ puts one on the trip's Later list. A stop that the plan times around the crowds has a 🕊 button that asks for its board, or resends the board it already has. |
| 14 Menu check | `/menu <restaurant> [on <date>]` returns, within one routine run, the dishes the party can eat and the ones to ask about (with what to ask), with the menu's own names and prices and the page they came from, and writes the place's menu fact with today's date. A planned dinner whose menu is unchecked has a 🍽 button. After a check that counts for a planned dinner, the card offers to re-plan that day: the re-planned day no longer flags the dinner, and a dinner whose menu does not fit is replaced. The planner counts a check made at most 30 days before the dinner (Phase 13), so a check made earlier says from which date to check again. |

## Contract C16 — two new envelopes and two hooks

Every new type and field is additive, so old trips, plans, digests, requests, the private repo's current pin and the live core keep working. A validator accepts a field only with the type and bounds below and still refuses unknown keys. Nothing changes in the place, trip, day-plan or digest schemas: the menu check writes the place's existing `facts.menu` (`checked`, `fits`, `note`), and the core finds what to offer in what the digest already carries.

| Where | Field | Type | Meaning |
|---|---|---|---|
| `helper.json` `envelope_types` | `quiet`, `menu` | new types | A quiet board and a menu check (below). The skeleton adds both; the three pinned type lists gain them in the skeleton commit |
| new request kind `quiet` | payload `{ trip?: slug, place: string 1–80, slug?: slug, date?: date }` | | `place` is the magnet in the owner's words, or a stop's name from a 🕊 button, which also sets `slug` (the trip's place) and `date` (the planned day). A discovery kind: `DISCOVER` when configured, else `RESEARCH` |
| new request kind `menu` | payload `{ trip?: slug, place: string 1–80, slug?: slug, date?: date }` | | The restaurant, the same way; a 🍽 button sets `slug` and `date`. A discovery kind |
| `planner/planner-crowd.mjs` | `noQuietSlotText(name, at)` | function | The planner's existing warning for a magnet that no quiet slot fits, moved into one exported function: `planner-day.mjs` calls it and `planner/index.mjs` exports it. The text does not change (skeleton commit) |
| `gas/10_commands.js` `tgCmdDayMessages` | the day rows hook | | Before the day navigation row, the rows of `tgCmdDayRows(trip, day)`: those of `tgQuietDayRows(trip, day)`, then those of `tgMenuDayRows(trip, day)`, each only when the function exists. A row function that throws, and a row the keyboard cannot carry (a button without text, without data or a link, or with data over 64 bytes), is audited (`tg_day_rows_error`) and adds nothing, so the day goes out with the keyboard it had (skeleton commit) |
| `gas/18_morning.js` `tgMorningKeyboard` | a `day` argument and the same hook | | `tgMorningKeyboard(trip, date, day)`, with the caller passing the day; the two functions' rows follow the late and re-plan rows. Without a `day` the hook adds nothing, so an older caller keeps its keyboard (skeleton commit) |
| `state.json` snapshot | `menu_checks` | `[{ id, trip, place_slug, checked, fits, note }]` | The menu checks of the last 30 days, newest first, at most 50, from a provider registered in `44_menu.js`. A plan reads a check from here even before the check's memory commit reaches the private repo's `main` |

**What the buttons read.** Each module keeps a mirror of an engine text, and a parity test keeps them in step, as the parse mirrors do:
- `TG_QUIET.WARN_RE` in `43_quiet.js` matches `noQuietSlotText`'s text and captures the name. The digest keeps the planner's warning text, cut to 200 characters, with the name first.
- `TG_MENU.CAVEAT_RE` in `44_menu.js` matches both of `dinnerMenu`'s caveats (`planner/planner-dinner.mjs`), case-insensitively, at the start of the note or after " · ". The digest's dinner `note_line` is the planner's meal note without the place's name and with its first letter in capitals: "Menu not checked for …", "Menu last checked <date>". "The menu partly fits your diet" and a note without a caveat never match.

**Own data only.** Both payloads carry our own words, our scores, place ids, names and links, never a Google field: no coordinates, ratings, review counts, photos, hours or prices from Google. The core refuses them as Scout does (`tgScoutGoogleKeys` in `gas/16_scout.js`). A board's quiet hours come from the magnet's own site or from locals' pages, never from Google's hours, and a dish's price is the menu's own. The routine keeps coordinates in the private repo, under the Maps kit's caching rules.

**The `quiet` payload** (WP-16a owns the schema, both validators and the parity test). The whole payload stays under 12,000 characters.

| Field | Type | Meaning |
|---|---|---|
| `v` | `1` | |
| `id` | `^qt-\d{8}-[a-z0-9-]{1,40}$` | `qt-`, the run's local date, `-`, the magnet's slug. A re-delivered id replaces its board and keeps what was added |
| `trip` | slug or `null` | The request's trip, else `null` |
| `created_on` | date | |
| `date` | date, optional | The day asked for |
| `magnet` | `{ name: 1–120, slug, place_id?, kind: 1–40, busy: boolean, quiet: 1–160, source?: { title: 1–120, url: https } }` | The crowd magnet. `kind` is our word for what it is ("shrine", "noodle bar"). `busy` is Phase 11's crowd-magnet rule applied to the magnet among the places found (`isBusy`). `quiet` is `quietLine`'s text, and `source` the page its hours or tip came from |
| `items` | array 0–3, best first | Below |
| `more` | integer 0–20, optional | Places that passed every screen but did not make the top 3 |
| `left_out` | array ≤ 12 of `{ name: 1–120, reason }` | `reason`: `the_magnet`, `duplicate`, `not_same_kind`, `closed`, `closed_on_dates`, `low_rating`, `unproven`, `diet`, `also_busy`, `not_quieter`, `too_far`, `other` |

A `quiet` item:

| Field | Type | Meaning |
|---|---|---|
| `n` | integer 1–3 | Its place on the board |
| `slug`, `name` | slug; string 1–120 | |
| `place_id` | optional | |
| `kind` | string 1–40 | Our word for what it is |
| `reach` | `{ minutes: integer 0–180, mode: WALK or TRANSIT, estimated: boolean }` | From the magnet |
| `quieter` | `much`, `clearly` or `somewhat` | `quieterWord` |
| `why` | string 1–200 | Why it is worth going instead, in our words |
| `best` | string 1–120, optional | When to go, from its own site or locals' pages |
| `score` | integer 0–100 | |
| `parts` | `{ quiet, quality, fit, local, reach }`, each an integer 0–100 | The five parts of the score |
| `labels` | array ≤ 6, unique, of `local_favourite`, `veg_verified`, `veg_likely`, `booking`, `rain_ok`, `seen_before` | Scout's words where Scout has them |
| `maps_url` | url | |

**The `menu` payload** (WP-16b owns the schema, both validators and the parity test). The whole payload stays under 12,000 characters.

| Field | Type | Meaning |
|---|---|---|
| `v` | `1` | |
| `id` | `^mn-\d{8}-[a-z0-9-]{1,40}$` | `mn-`, the run's local date, `-`, the place's slug. A re-delivered id replaces its row |
| `trip` | slug or `null` | The request's trip, else `null` |
| `created_on` | date | |
| `date` | date, optional | The planned day the check was asked for |
| `place` | `{ name: 1–120, slug, place_id?, local_name?: 1–80 }` | |
| `checked` | date | The day the menu was read; the fact's `checked` |
| `fits` | `yes`, `partly`, `no` or `unknown` | `menuFits`; the fact's `fits` |
| `note` | string 1–160 | `menuNote`; the fact's `note` |
| `diet` | string 1–80 | The party's limits in plain words ("vegetarian, no fish stock") |
| `dishes` | array 0–12 | Below, in `menuPayload`'s order |
| `others` | integer 0–200, optional | Dishes on the menu that do not fit |
| `sources` | array 0–3 of `{ title: 1–120, url: https }` | At least one unless `fits` is `unknown` |

A `menu` dish is `{ name: 1–80, local?: 1–80, course, fits, ask?: 1–120, price?: 1–40 }`:
- `course` is `set`, `main`, `starter`, `side`, `dessert` or `drink`;
- `fits` is `yes` or `ask`; a dish that does not fit is not listed but counted in `others`;
- `ask` is what to ask the staff ("without the fish-stock broth?"), required when `fits` is `ask` and absent otherwise;
- `price` is the menu's own words ("14.50", "set of 5 courses 60.00").

## Step 0 — Orient (every WP)

1. Your worktree starts at `origin/main`. First run `git merge --ff-only p16-skeleton`: the coordinator's skeleton commit holds both generated branches, the C16 lines in the three pinned type lists, `noQuietSlotText` and the two hooks. If the merge is not a fast-forward, stop and write why in your status file.
2. Read `CLAUDE.md`, `helpers/SPEC.md` (§5 registries, §16 ownership map, §18 limits), `helpers/packs/tour-guide/README.md`, `helpers/tools/README.md` "Branches", `helpers/decisions/TG-SCOUT.md`, `TG-PHASE-15.md`, `WP-15a.md` and `WP-15b.md`, Contract C16 above, and every file your section names. Name functions when you cite code; line numbers move.
3. Run `node --test helpers/tests/`, `node helpers/tools/bundle.mjs --all --check` and `node helpers/tools/boundary-check.mjs`. All three must be clean before you start; if not, stop and write why in your status file. Run `node helpers/tools/new-branch.mjs --check <your branch>` as well.
4. Study Scout and Day trip end to end before you fill your branch in; Day trip is the newest branch built to this shape.
   - Scout: `gas/16_scout.js`, `gas/35_scout_app.js`, `helpers/packs/tour-guide/scout/`, `schemas/tour-guide-scout.schema.json`, the Scout tests and the Scout screen in `live-site-pages/helper-app.html`.
   - Day trip: `gas/41_daytrip.js` (its command, `tgOpenKindRequest`, its board keys, card, buttons and replan), `gas/33_daytrip_app.js`, `helpers/packs/tour-guide/daytrip/` and its tests.
   - Copy their patterns: board keys (`k` + 12 hex of the board id), the 📱 app button (`tgAppRows`), the write ops, and the tests' use of the harness.
5. **Generated once.** The skeleton was generated with the commands in the Coordinator section. Never run the generator again for your branch, and never with `--force`: fill the files in. Keep the `@branch` line in step with what the branch declares, and run `--check` before you finish.
6. Write a failing test for each behaviour you add or change before you change the code, and keep the test.

## WP-16a — Quiet (item 13) · `hb-builder-opus`

**Goal.** For a crowd magnet the owner wants to see anyway, one board: up to 3 quieter places of the same kind within 30 minutes of it, and the magnet's quietest hours. It is one tap away from any stop that the plan times around the crowds.

**Owns:**
- the generated `quiet` branch, filled in: `gas/43_quiet.js`, `gas/38_quiet_app.js`, `schemas/tour-guide-quiet.schema.json`, `helpers/packs/tour-guide/quiet/**` and `helpers/tests/pack_tour-guide_quiet.test.js` (more test files `pack_tour-guide_quiet_*.test.js` are yours too);
- in `live-site-pages/helper-app.html`, without its version file or changelog: the Quiet screen and the day view's 🕊 buttons;
- `helpers/decisions/WP-16a.md` and `helpers/status/WP-16a.md`.

**Builds:**

1. **The command.** `/quiet <place> [on <date>]`, and `/quiet` alone.
   - `on` takes `/daytrip`'s date words: `YYYY-MM-DD`, `M/D` (the next such date), `today` or `tomorrow`. What is left is the place, 1–80 characters. The engine's `parseQuietText(text, { today })` and the core's `tgQuietParse(text, today)` agree on a shared case list (a parity test, as Day trip's parse has).
   - The request is kind `quiet` with C16's payload; `trip` is the current trip whenever there is one. The acknowledgement reads "🕊 Looking for places quieter than <b><place></b>…".
   - `/quiet` alone lists, as 🕊 buttons (at most 8), the stops of the coming planned days that step 6 gives a button, then the last 5 boards as resend buttons, then a one-line how-to. With neither, it sends only the how-to.
2. **The engine** (`quiet/`), pure, with no network. `QUIET` holds every number below, each with a comment that says why: `MAX_MINUTES: 30`, `MAX_RATIO: 0.5`, `RADII: [1000, 2000, 3500]`, `MIN_POOL: 6`, `ITEMS: 3` and the five weights.
   - `quietRatio(count, magnetCount)` is the candidate's rating count (0 when it has none) over the magnet's, which must be a positive number; otherwise it throws.
   - `quietPart(ratio)` is 100 at or below 0.05, 0 at or above `MAX_RATIO`, and linear in log10 between, rounded: 0.1 → 70 and 0.25 → 30. `quieterWord(ratio)` is `much` up to 0.1, `clearly` up to 0.25, else `somewhat`.
   - `isBusy(magnet, pool)` is Phase 11's rule: the gems pack's `crowdMagnetIds` over the magnet and the pool includes the magnet.
   - `rankQuiet(candidates, { magnet, group, date, cityDates, diet, dietRule, visited })` returns `{ items, more, left_out }`.
     - **A candidate** is `{ record, reach, judgment }`.
       - `record` is Scout's `normalizeScoutRecord` of a place, with its local mentions and mass-tourism rank.
       - `reach` is `estimateReach`'s answer from the magnet, or null.
       - `judgment` is `{ same_kind: boolean, part_of_magnet?: boolean, fit: 0–1, why, best?, veg?, relevance?, booking?, rain_ok? }`. `part_of_magnet` marks a hall, garden or sub-shrine of the magnet itself.
     - **Screens, in order:**
       - `the_magnet`: the magnet's place id, or `part_of_magnet`;
       - `duplicate`: the same place id, or the same name ignoring case and accents;
       - `not_same_kind`;
       - then Scout's `screenFlags`, with `reach: null`, `what` the magnet's kind, and `city_dates` the asked date (or `cityDates` without one). Its `closed`, `closed_on_trip` (as `closed_on_dates`), `low_rating`, `unproven`, and `diet` or `diet_unproven` (both as `diet`) apply in that order;
       - `also_busy`: a mass-tourism rank within the gems pack's `MASS_TOURISM_TOP_N`. How much busier one place is than another is the ratio's job, so the pool's top-decile rule is not used here;
       - `not_quieter`: a ratio above `MAX_RATIO`;
       - `too_far`: no reach, or more than `MAX_MINUTES`.

       `left_out` keeps the first 12, in candidate order.
     - **The score** is the rounded sum of five parts, each 0–100:
       - 0.35 × `quietPart`;
       - 0.20 × Scout's `qualityPart` (with `muFor(group)`) × 100;
       - 0.20 × `fit` × 100;
       - 0.10 × min(1, local mentions × Scout's `LOCAL_PER_MENTION`) × 100;
       - 0.15 × Scout's `reachValue` × 100.
     - Ties go to the lower ratio, then the shorter reach, then the name. The top 3 are the items, numbered; the count of the rest is `more`.
     - **Labels:** `local_favourite` at two or more local mentions; `veg_verified` or `veg_likely` from the judgment's veg word, for food only; `booking` and `rain_ok` from the judgment; `seen_before` when the slug is in `visited`.
   - `quietLine({ hours, always_open, tip })` returns the magnet's quiet line, at most 160 characters, by the first rule that applies:
     - with `hours` (`{ open, close, last_entry? }` as "HH:MM", from the magnet's own site), the planner's `crowdWindows` gives "Quietest at opening (09:00–10:00) or late (from 15:30; last entry 16:30)", or the opening part alone when no late slot fits, followed by "; " and the tip when there is one;
     - else the tip;
     - else, when `always_open`, "Open all day; early morning is usually quietest";
     - else "No quiet hours found; early is usually quieter".
   - `pickRadius(counts)` takes `[{ radius, count }]` and returns the smallest radius with a count of at least `MIN_POOL`, else the largest with a count of at least 1, else null.
   - `quietId(createdOn, slug)` and `quietPayload({ trip, createdOn, date, magnet, ranked })` return a payload that passes the schema.
3. **The schema and the two validators** are C16's `quiet`, with the parity test the skeleton wrote, on the real fields.
   - The core validator refuses every Google field by calling `tgScoutGoogleKeys`, and refuses a payload over 12,000 characters.
   - The fixture is invented: an invented magnet and invented places. Its first `valid` payload is the pinned payloads test's `quiet` example (`fixtureValid` in `pack_tour-guide_payloads.test.js`), so keep it a complete payload that the schema, both validators and the core accept.
4. **The store and the card.**
   - **The Quiet tab** holds one row per board id, with columns `id`, `trip`, `magnet_slug`, `magnet_name`, `created_on`, `date`, `count`, `payload_json`, `added_json` and `received_at`. `added_json` is `[{ slug, at }]`. A re-delivered id replaces its row and keeps each added entry whose slug is still on the board.
   - **The card** reads "🕊 <b>Quieter than <magnet></b>", plus "· <date>" when one was asked.
     - When `busy` is false, a line says that the magnet is not one of the busiest places nearby, so the board is a choice rather than an escape.
     - Each item has a numbered line `n. <name> — 🚶 12 min · much quieter` (🚆 by transit, "about" when estimated), its `why` in italics, and "🕐 <best>" when given.
     - Then "🕐 <b>If you go anyway:</b> <quiet>", with the source as a link.
     - An empty board says "Nothing of the same kind within 30 minutes is clearly quieter", followed by the quiet line.
     - Below come ➕ n buttons and 📱 Open in the app. Nothing left out is listed in the chat; the app shows it.
   - **The buttons.** `qt:<key>:<n>` adds item n to the Later list of the board's trip, else of the current trip, else answers "No current trip — /plan one first."
     - It adds with reason `owner_choice`, as Scout's ➕ does: a rebuild keeps only the owner's Later rows with that reason (`tgDigestStore`).
     - It records the slug in `added_json`, answers "Added" and sends `tgScoutAddedMessage` with the same `{ trip, item, index, days }`, so the owner can put the place on a day.
     - `qt:<key>:s` resends the card.
5. **The app.**
   - `quiet.list` returns the last 20 heads, and `quiet.get { id }` a board with its added entries.
   - `quiet.add { id, n }` is a write op with the button's rules.
   - `quiet.new { place, date?, slug? }` is a write op that opens the request as the command does.
   - `quiet.day { trip, date }` returns the day's stops that step 6 gives a button, each with the board id to resend or null.
   - **The Quiet screen** lists the boards. A board shows the magnet's quiet line and its source, then each item's reach, quieter word, why, best time and five score bars in the style of Scout's, with an Add button. What was left out appears under the list, with the reasons in words.
   - **The day view** asks `quiet.day` in the background and shows 🕊 under those stops. The button opens the board when one exists; otherwise it asks for one with the stop's name and slug and the day.
6. **The 🕊 rows.** `tgQuietDayRows(trip, day)` returns at most 2 rows of one button each, "🕊 Quieter than <name>" with the name cut to 30 characters, for the skeleton's hooks.
   - **Which stops:** first the stops with a `crowd_slot`, then the stops that a warning names (`TG_QUIET.WARN_RE`; the name matches a stop's name exactly, else ignoring case), in stop order, each once.
   - **Resend or ask.** The newest board for that magnet slug received in the last 30 days gives `qt:<key>:s`. Otherwise the button is `cbEncode('qt', tgCmdTripKey(trip.slug), <the day's date as 8 digits>, tgCmdTag(slug))`, which has four parts where a board's buttons have three. The callback finds the stop again in that day's digest and opens the request `{ trip, place: <stop name>, slug, date }`. When the tag no longer matches a stop of that day, it answers "That day has changed — send /day again."
   - A day before `tgTripToday` gets no rows.
7. **Docs.** The branch README, the pack README's rows for `43_quiet.js` and `38_quiet_app.js`, and REQUEST lines for the SPEC §16 row and anything outside your paths.

**Tests**, all on invented data:
- the parse parity, `quietRatio`, `quietPart`, `quieterWord`, `isBusy` and `pickRadius`;
- every screen, the score, ties, `more` and the labels, and `quietLine`'s four cases;
- the schema and both validators, including a Google field and an oversize payload;
- the command, with and without a date, and `/quiet` alone with and without stops or boards;
- the handler and the card, an empty board, a magnet that is not busy, and a re-delivery that keeps an added entry;
- ➕ with and without a trip, and the resend;
- the 🕊 rows: a crowd slot, a warned stop, the cap, the resend, the request's payload, a changed day, a past day, and `WARN_RE`'s parity with `noQuietSlotText`, including a warning cut at 200 characters;
- the day card and the morning message show 🕊 through the skeleton's hooks;
- the five app ops.

## WP-16b — Menu check (item 14) · `hb-builder-opus`

**Goal.** For a restaurant the owner is about to choose, the dishes the party can eat and the ones to ask about, read from the restaurant's own menu and dated. The place's menu fact is updated, so the planner knows, and a planned dinner whose menu nobody has checked is one tap from a check.

**Owns:**
- the generated `menu` branch, filled in: `gas/44_menu.js`, `gas/39_menu_app.js`, `schemas/tour-guide-menu.schema.json`, `helpers/packs/tour-guide/menu/**` and `helpers/tests/pack_tour-guide_menu.test.js` (more test files `pack_tour-guide_menu_*.test.js` are yours too);
- in `live-site-pages/helper-app.html`, without its version file or changelog: the Menu screen and the day view's 🍽 button;
- `helpers/decisions/WP-16b.md` and `helpers/status/WP-16b.md`.

**Builds:**

1. **The command.** `/menu <restaurant> [on <date>]`, and `/menu` alone.
   - The words and the parity test are Quiet's: `parseMenuText(text, { today })` and the core's `tgMenuParse(text, today)`.
   - The request is kind `menu` with C16's payload; `trip` is the current trip whenever there is one. The acknowledgement reads "🍽 Reading the menu of <b><restaurant></b>…".
   - `/menu` alone lists, as 🍽 buttons (at most 8), the planned dinners from today on that step 6 gives a button, then the last 5 checks as resend buttons, then a one-line how-to. With neither, it sends only the how-to.
2. **The engine** (`menu/`), pure, with no network. `MENU` holds every number, each with a comment that says why: `DISHES: 12` and `PARTLY_MIN_SMALL: 2`.
   - `menuFits(dishes, { read, others })` returns, by the first rule that applies:
     - `unknown` when no menu was read (`read` is false, or there are no dishes and no others);
     - `yes` when a set or main fits;
     - `partly` when a set or main can be asked for, or when at least `PARTLY_MIN_SMALL` starters or sides fit;
     - `no` otherwise. Desserts and drinks alone never make a menu fit.

     A dish's `course` is how it is eaten there: the small plates of a small-plates place are mains.
   - `menuNote({ fits, dishes, diet })` returns the fact's note, at most 160 characters, cut at a word with "…":
     - for `yes` and `partly`, "Fits: <dishes that fit>; ask: <dishes to ask about>", leaving out an empty half;
     - for `no`, "Nothing on the menu fits <diet>";
     - for `unknown`, "No menu found to check".
   - `menuFact(payload)` returns `{ checked, fits, note }`; a test passes it through the facts pack's `normalizeFacts`.
   - `menuCaveat(note)` returns `unchecked`, `old` or null for a dinner's note, by `dinnerMenu`'s two caveats (C16, "What the buttons read"). A test runs the real `dinnerMenu`'s outputs through it, in both forms.
   - `menuCounts(checked, date)` is true when the check was made at most the facts pack's `MENU_MAX_AGE_DAYS` before the dinner's date, as the planner counts it. `menuCountsFrom(date)` is the first date whose check counts for that dinner.
   - `menuId(createdOn, slug)` and `menuPayload({ trip, createdOn, date, place, checked, read, diet, dishes, others, sources })` return a payload that passes the schema.
     - The dishes are sorted by course (set, main, starter, side, dessert, drink), then `yes` before `ask`, otherwise in the menu's order.
     - The first `DISHES` are kept, and the rest are added to `others`.
     - `fits` and `note` come from `menuFits` and `menuNote`.
3. **The schema and the two validators** are C16's `menu`, with the parity test the skeleton wrote, on the real fields.
   - Besides the schema's bounds, the validators check that `ask` appears exactly on the dishes whose `fits` is `ask`, and that `sources` has at least one entry unless `fits` is `unknown`.
   - The core validator refuses every Google field by calling `tgScoutGoogleKeys`, and refuses a payload over 12,000 characters.
   - The fixture is invented: an invented restaurant, dishes and prices. Its first `valid` payload is the pinned payloads test's `menu` example, so keep it a complete payload that the schema, both validators and the core accept.
4. **The store and the card.**
   - **The Menus tab** holds one row per check id, with columns `id`, `trip`, `place_slug`, `place_name`, `checked`, `fits`, `payload_json` and `received_at`. A re-delivered id replaces its row.
   - **The card** reads "🍽 <b>Menu check: <name></b> · checked <date>", with the local name in brackets when given. Then come:
     - the fits line: "✅ Fits your party", "🟡 Partly fits — ask first", "⛔ Nothing on the menu fits" or "❔ No menu found to check";
     - "For: <diet>";
     - a line per dish: "✅ <name> (<local>) · <price>", or "❓ <name> (<local>) · <price> — ask: <ask>";
     - "+ N other dishes that do not fit" when `others` is above 0;
     - "Source:" and the links.
   - **The re-plan offer.** It covers the planned days of the check's trip, from `tgTripToday` on, whose dinner's slug is the check's place slug, at most 3.
     - When `fits` is `unknown`, nothing is offered.
     - When `fits` is `no`, or the check counts for that day (`menuCounts`), the card has a 🔁 Re-plan <day> button; for `no`, a line above it says "This dinner does not fit; re-plan <day> to replace it."
     - Otherwise, a line says that for <day> this check counts from <date> (`menuCountsFrom`), and to send 🍽 again then.
   - **The other buttons.** 🥗 Veg card when the trip has one (`tgVegCardHas`), and 📱 Open in the app.
   - **The callbacks.** `mn:<key>:s` resends the card, and `mn:<key>:v` sends the trip's veg card. `mn:<key>:r<date as 8 digits>` first checks that day's dinner again: a different dinner answers "That day's dinner has changed — send /day again." Otherwise it opens `replan` with `{ trip, dates: [that date], reason: 'menu checked at <name>', deliverables: tgCmdDeliverables(trip) }` and the acknowledgement "🔁 Re-planning <day> with the checked menu…".
   - **The `menu_checks` snapshot provider** (C16) is registered from your module, so `21_sheets.js` is not edited.
5. **The app.**
   - `menu.list` returns the last 20 heads, and `menu.get { id }` a check.
   - `menu.new { place, date?, slug? }` is a write op that opens the request as the command does.
   - `menu.replan { id, date }` is a write op with the button's rules.
   - `menu.day { trip, date }` returns the day's 🍽 button by step 6's rules: `null`, or `{ check: <id to resend> | null }`.
   - **The Menu screen** lists the checks. A check shows the fits line, the dishes with what to ask and their prices, the count of the others, the sources and the re-plan offer, with the same rules as the card.
   - **The day view** asks `menu.day` in the background and shows 🍽 under the dinner.
6. **The 🍽 row.** `tgMenuDayRows(trip, day)` returns at most 1 row with one button, for the skeleton's hooks, only for a day from `tgTripToday` on whose dinner has a slug and a caveat in its `note_line` (`TG_MENU.CAVEAT_RE`). Let *from* be `menuCountsFrom` of the day's date, mirrored in the core as `TG_MENU.MAX_AGE_DAYS` (a parity test with the facts pack). The newest check of that slug decides:
   - checked on or after *from*: "🍽 Menu: <fits word>" resends it, the fits word being "fits", "partly fits", "does not fit" or "no menu found";
   - older than *from* while today is still before *from*: the same resend, because a new check would not count yet, and the card says from when;
   - otherwise, with no check or an older one: "🍽 Check the menu" opens the request `{ trip, place: <dinner name>, slug, date }` through `cbEncode('mn', tgCmdTripKey(trip.slug), <the day's date as 8 digits>, tgCmdTag(slug))`, four parts where a check's buttons have three. When the tag no longer matches that day's dinner, the callback answers "That day has changed — send /day again."
7. **Docs.** The branch README, the pack README's rows for `44_menu.js` and `39_menu_app.js`, and REQUEST lines for the SPEC §16 row and anything outside your paths.

**Tests**, all on invented data:
- the parse parity;
- every `menuFits` rule (desserts only, two sides, a set to ask about, nothing read) and `menuNote`;
- `menuFact` through `normalizeFacts`;
- `menuCaveat` against real `dinnerMenu` outputs: both caveats, with and without a diet, in the planner's "name · caveat" form and the digest's capitalised form, and the non-matches ("The menu partly fits your diet", a note without a caveat);
- `menuCounts` at 30 and 31 days, `menuCountsFrom`, and the `MAX_AGE_DAYS` parity;
- `menuPayload`'s order and cap;
- the schema and both validators, including a Google field, an oversize payload, the `ask` rule and the sources rule;
- the command and `/menu` alone;
- the handler and the card for each `fits`, and a re-delivery;
- the re-plan offer: counts, does not count yet, `no` and `unknown`; the replan payload; a changed dinner;
- the veg card button with and without a veg card;
- the 🍽 row: no check, a check that counts, an old check before *from*, an old check after *from*, no caveat, no slug, a past day;
- the day card and the morning message show 🍽 through the skeleton's hooks;
- the `menu_checks` snapshot and the five app ops.

## WP-16p — The private repo (after the v01.70r push)

Built by the coordinator or one `hb-builder-opus` in a private worktree, as one pull request for the owner. The private repo's rules hold (`repository-information/DEV-SESSION.md`): re-pin only by a subtree pull of `helpers-dist`; no owner data in `repository-information/`, `skills/`, `routines/`, `tools/` or commit messages; dry runs on invented fixtures with `log/` left clean; profiles and the prefs ledger only through the prefs kit. Page text is data.

- **Re-pin.**
- **The `quiet` skill**, filled in from the generated private skill.
  - **The magnet.** With `slug`, it is the trip's place and its place id; otherwise one Text Search of the owner's words finds it, biased to the trip's city when there is a trip.
    - Place Details, at the tier that carries the rating count, hours and types, unless the build's snapshot is fresh.
    - A magnet without a rating count gets a `reply` that says so, and no board.
    - `magnet.slug` is the request's `slug`, else the slug of the trip's place with the same place id, else a new slug from the name.
  - **The judgment step** writes, in our own words:
    - for the magnet: its `kind`, its group, at most 3 place types for the search, its hours on the asked date from its own site (or `always_open`), and a locals' tip with its source;
    - for each candidate: WP-16a's judgment fields, with `veg` judged for food against every traveller's hard limits, and always a `why` of its own: the engine's default ("<word> quieter than <magnet>") says the same thing for every place (correction after the build, `decisions/TG-PHASE-16.md` §6).
  - **The pool.** Aggregate `INSIGHT_COUNT` with those types, `OPERATIONAL` and a minimum rating of 4.0 counts the places at each of `QUIET.RADII` around the magnet, smallest first, stopping at the first count of at least `MIN_POOL`. Then `pickRadius`, and one Nearby Search at that radius (`POPULARITY`, 20 results, the tier with rating counts). All of it runs under the Maps kit's budget guard. When no radius has a count, the board is empty.
  - **The driver** measures reach with `estimateReach` from the magnet, with station lists found as Scout's driver finds them. It then runs `isBusy`, `rankQuiet`, `quietLine` and `quietPayload`, and writes the envelope with `--in-reply-to <id>` and `--dedupe-key quiet:<id>`.
  - **Memory.** Every item shown is saved as Scout's skill saves its picks: a place file (status `candidate` for a new place, tags `quiet` and the kind, a `scouted` history entry with the note "quieter than <magnet>") and one `places_digest`. Coordinates stay in the private repo under the Maps kit's caching rules.
- **The `menu` skill**, filled in from the generated private skill.
  - **The place.** With `slug`, it is the trip's place; otherwise one Text Search finds it, biased to the trip's city, and it gets a new place file as Scout's skill writes one.
  - **The menu** is read only from the place's own site, recorded with `--official` (only the place's own domain), as place-notes step 4a does: never Google, a review site, a blog or an aggregator. A restaurant with no menu on its own site gets `fits: unknown`, and the reply says where the skill looked.
  - **The judgment step** judges each dish against every traveller's hard limits (the Phase 8 merge rule) and the party's hidden-stock rule: a broth, sauce or stock that usually hides an ingredient the party avoids makes the dish `ask`, with what to ask. Names, local names and prices are the menu's own.
  - **The driver**:
    - runs `menuPayload` and `menuFact`;
    - writes the fact through `place-notes-facts.mjs write` with `menu_only: true`. The writer's own-site and quarantine rules hold; a refusal is named in the reply, and the board still goes;
    - commits and pushes memory;
    - then writes the envelope with `--in-reply-to <id>` and `--dedupe-key menu:<id>`.

    The skill never re-plans; the owner does, from the card.
- **Plans read the checks.** Before every plan, replan and outline, plan-days applies `state.json` → `menu_checks`: a check newer than the place's `facts.menu` stands for that build, so a re-plan straight after a check sees it. The fact reaches memory only through the menu skill's writer.
- **Routing.** The `discover` skill dispatches both kinds to these skills. Trip research hands them over while no Discover routine is configured, as it does Scout's. The routines table gains both kinds.
- **Dry runs** on invented fixtures:
  - a quiet board that runs every screen, an empty board, and a magnet without a rating count;
  - a menu check for each `fits`;
  - the facts todo no longer gives a dinner just checked the reason `no_menu` or `menu_stale`;
  - a plan that reads a check from `menu_checks` before its memory commit;
  - a replan that replaces a dinner whose menu does not fit.

**The owner's steps** after the private pull request merges, sent in one message:
1. Try `/quiet <a busy sight>` and `/menu <a restaurant>`, and the 🕊 and 🍽 buttons under a planned day (`/day`).
2. A menu check counts for a dinner when it is made at most 30 days before that dinner, so check each dinner's menu within its last 30 days.
3. Trip research answers both kinds until the Discover routine from Phase 14's steps exists.

## Coordinator — skeleton, builders, merge, probe, push, then the private repo

1. **The skeleton**, after v01.69r is on `main`.
   - In the Personal checkout, make a local branch `p16-skeleton` from `origin/main`.
   - Generate both branches, in this order, so that the app files take 38 and 39:
     ```
     node helpers/tools/new-branch.mjs quiet --title "Quiet" --command /quiet --kind quiet --envelope quiet --tab Quiet --prefix 43 --discover --private-out <scratch>/p16-private
     node helpers/tools/new-branch.mjs menu --title "Menu check" --command /menu --kind menu --envelope menu --tab Menus --prefix 44 --discover --private-out <scratch>/p16-private
     ```
     `<scratch>` is outside the repo; the private skills wait there for WP-16p. Never use `--force`.
   - Add both types to the three pinned type lists ("What you still write by hand" in `helpers/tools/README.md`), with the generated fixtures as their `EXAMPLES`. Mark each line `C16`.
   - Move the planner's no-quiet-slot warning into `noQuietSlotText(name, at)` in `planner/planner-crowd.mjs`, call it from `planner-day.mjs`, and export it from `planner/index.mjs`. A test pins the text, which does not change.
   - Add the two hooks (C16) to `tgCmdDayMessages` and `tgMorningKeyboard`. Each calls a row function only when it exists (`typeof tgQuietDayRows === 'function'`). Both go through `tgCmdDayRows`. One test stubs the functions and checks where their rows land, another that nothing changes without them, and a third that a failing function or an unusable row is audited and left out (`tests/pack_tour-guide_c16_hooks.test.js`).
   - Run `--check quiet`, `--check menu`, the three checks and the vendored-layout tests, then commit to `p16-skeleton`.
2. **Spawn** WP-16a and WP-16b in parallel (`hb-builder-opus`), each in its own worktree from `origin/main`. Change into the Personal checkout before spawning: worktree isolation follows the shell's directory. Each builder merges `p16-skeleton` first (Step 0).
3. **Merge** into this session's `claude/*` branch, rebased on `origin/main`: the skeleton, then squash-merge `wp-16a`, then `wp-16b`.
   - Resolve conflicts by ownership. In `helper-app.html`, the Quiet screen and the day view's 🕊 buttons are WP-16a's; the Menu screen and the day view's 🍽 button are WP-16b's. A row of the pack README belongs to the WP that owns its file.
   - After each merge, run the three checks and the vendored-layout tests.
   - Act on each REQUEST, and check every test a builder changed outside its own paths.
   - `--check quiet` and `--check menu` pass.
4. **The probe**, on invented data.
   - **Quiet.**
     - A board for an invented magnet runs every screen and the score, and an empty board shows the quiet line.
     - ➕ puts a place on the Later list with reason `owner_choice`, and the place stays there through a rebuild (`tgDigestStore`).
     - A day with a crowd-timed stop, and one with a warned stop, show 🕊 on the day card and in the morning message; once a board exists, the button resends it.
     - Check the five app ops.
   - **Menu check.**
     - Run one check for each `fits`.
     - Check the card's re-plan offer for a check that counts, one that does not count yet (with its date), `no` and `unknown`, and the replan payload.
     - A day whose dinner has a caveat shows 🍽; after a check that counts, the button resends it.
     - Check `menu_checks` in the snapshot and the five app ops.
   - **No change without them.** A day without crowd slots, warnings or dinner caveats shows exactly the keyboard it showed before.
5. **The push** (v01.70r). Do the bookkeeping per `CLAUDE.md` in the single push commit:
   - the repo version;
   - the CHANGELOG with the owner's prompt, personal details redacted;
   - the README timestamp, and tree entries for new files;
   - `helpers/BUILD-STATE.md` (row 16 and a log entry; row 15 gains the WP-15p pull request) and the SPEC §16 rows;
   - `helpers/decisions/TG-PHASE-16.md`, and the WP-15p pull request in `helpers/decisions/TG-PHASE-15.md`;
   - the helper app's version file, meta tag and page changelog.

   Fetch, check and push in one chain; verify `main` afterwards; confirm that **Deploy helper** and `helpers-dist` ran.
6. **The private repo** (WP-16p), as one pull request, then the owner's steps in one message. Record each live result in `helpers/decisions/TG-PHASE-16.md` and BUILD-STATE row 16.

## Rules (every WP)

- **Public repo.** Never commit names, places, dates, hotels, ids, e-mail addresses, phone numbers, or anything from the private repo or the review. Fixtures are invented: invented magnets, places, restaurants, dishes, prices, dates and parties.
- **Own paths only.** Edit only the paths you own. Anything else is a REQUEST line in your status file (file, change, why).
  - The skeleton's changes are done, and nobody edits those files again this phase: `helper.json`, `schemas/index.mjs`, the three pinned type lists, `planner/planner-crowd.mjs`, `planner/planner-day.mjs`, `planner/index.mjs`, `gas/10_commands.js` and `gas/18_morning.js`. Your `EXAMPLES` entry follows your fixture's first `valid` payload, so change the fixture, not the list.
  - `fixtures/index.mjs`, the shared fixture loaders and `helpers/tests/harness/` are nobody's: load your fixtures, and stub what you need, inside your own tests.
  - In `helpers/packs/tour-guide/README.md`, edit only your own rows.
  - An export you need from a module you do not own is a REQUEST; meanwhile, import from the file directly.
- **Tests outside your paths.**
  - Never edit a test that the other WP owns.
  - A test that no WP of this phase owns may be updated only when it breaks because of a change your section asks for. Mark each changed assertion `C16`, and list the test in your status file.
  - Never weaken a test to make it pass.
- **Off limits.** Never push and never commit to `main`.
  - Never touch `.github/workflows/`, `repository-information/`, the root `README.md`, `helpers/BUILD-STATE.md`, `helpers/prompts/` or `live-site-pages/`. The exceptions are in `helper-app.html`, without its version file or changelog: WP-16a's Quiet screen and 🕊 buttons, and WP-16b's Menu screen and 🍽 button.
  - `gas/` is edited only in your own two files: WP-16a's `43_quiet.js` and `38_quiet_app.js`, WP-16b's `44_menu.js` and `39_menu_app.js`. Your rows reach the day card and the morning message only through the skeleton's hooks.
  - `helpers/core/`, `planner/` and `facts/` are nobody's this phase. The coordinator does the bookkeeping.
  - Add no envelope type, request kind, tab, alarm, snapshot or setting beyond C16 and your section.
- **Backward compatible.** The core deploys on the push, and the private repo stays on its current pin until its pull request merges. Everything the old code wrote must still load and display: every row, envelope, digest, plan and request. A day card, morning message or day view shows a new button only when its conditions hold.
- **No network** except recorded fixtures: no live Google, Telegram, Drive, web or Claude API calls, and no package installs.
  - `/mnt/project-files` is read-only to you, and nothing in it is needed for this phase.
- **Commits and records.** Commit to your worktree branch as you go: small commits, plain messages without a version prefix, each ending with the session's attribution trailer.
  - Commit after every finished step. If the coordinator tells you to stop (the owner's usage rule), commit, update your status file and stop.
  - Keep `helpers/status/WP-16x.md` current after each step (done, next, REQUESTs), with your own letter for x.
  - Record every default you pick, with its reason, in `helpers/decisions/WP-16x.md`.
  - `Developed by: LightAISolutions` is the last line of every new file.
- **Real tests.** Tests verify real behaviour (the `CLAUDE.md` test-quality rule): call the real function with controlled input and check its output or side effect.
- **When you finish,** the three checks and `--check <your branch>` are clean in your worktree. Your last message says:
  - what you built;
  - what you decided;
  - every REQUEST;
  - every test outside your paths that you changed.

Developed by: LightAISolutions
