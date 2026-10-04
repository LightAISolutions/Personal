# Phase 15 — Before the trip: Day trip and What's on

> Written 2026-10-04 by the coordinator of the owner's morning review. The owner approved decision-page items 19 (Day trip) and 20 (What's on), with a note on each, and chose on a card to build them **before the trip**, right after Phase 14 and ahead of items 13 (Quiet) and 14 (Menu check). Model rule (owner): coordinator Opus 5.5, builders `hb-builder-opus` (Opus 5.5 · high), **no Fable anywhere**. Start with `Read helpers/prompts/TG-PHASE-15.md and execute it exactly.` Progress in `helpers/BUILD-STATE.md`.

Both are **branches** in the sense of Phase 14's scaffold (`helpers/tools/new-branch.mjs`, `helpers/tools/README.md` "Branches"): a command, a request kind answered by the Discover routine (trip research until it exists), a pure engine with tests, a validated envelope that carries only our own words, scores and place ids, a tab, a chat card, an app screen, and a way into the plan the planner already reads.

**The owner's notes, generalised.**
- **Item 19.** The owner has not settled every city yet and may use Day trip for a city that is not on the trip. So a day trip starts from **any base**, not only a trip city.
- **Item 20.** The same note: What's on works for **any city and dates**, not only the trip's.

## Done when (the owner's criteria, generalised for this public repo)

| Item | Done when |
|---|---|
| 19 Day trip | `/daytrip [from] <place> [under <N> min] [on <date>]` returns, within one routine run, a ranked board of up to 8 day trips from that base, which may be a trip city or not. Each trip shows the rail minutes from the one estimator, half or full day, why it suits the party, what to see and to eat (vegetarian-checked), and what is closed or out of season on the asked date or the trip's days. ➕ keeps a day trip. On a trip with planned days, two taps put a kept trip on a day and re-plan that day. The app shows the boards and the kept trips, and kept trips reach the trip's outlines and plans. |
| 20 What's on | `/whatson [<place>] [<dates>]` returns, within one routine run, what is on in that place on those dates, up to 31 days and any city: light-ups, festivals, markets, special openings, exhibitions, performances, and the holidays and closures that change a day. The board is grouped by date. Each item has its source link, its times, price and booking rule when known, and whether its dates are confirmed. ➕ chooses an item for a day. A chosen evening event is offered first in that evening's plan; a chosen daytime event is pinned to its day. Before and during a trip, the trip's cities are checked once a week and the owner hears only about new things; `/whatson auto off` stops the checks. |
| Rail estimate (with item 19) | A ride of 15–40 km in a straight line no longer costs more than a 41 km ride. The estimate rises steadily from the city formula to the conventional line, so a 35 km day trip reads about an hour, not 101 minutes. Rides up to 15 km keep their numbers (the owner kept the city estimates on 2026-10-03). |

## Contract C15 — new fields and two new envelopes

Every new field is optional and every new type is additive, so old trips, season sheets, plans, digests, requests, the private repo's current pin and the live core keep working. A validator accepts a field only with the type and bounds below and still refuses unknown keys.

| Where | Field | Type | Meaning |
|---|---|---|---|
| `helper.json` `envelope_types` | `daytrip`, `whatson` | new types | A day-trip board and a what's-on board (below). The skeleton adds both; the three pinned type lists gain them in the skeleton commit |
| new request kind `daytrip` | payload `{ trip?: slug, from?: string 1–80, date?: date, max_minutes: integer 30–180 }` | | `from` is the base in the owner's words; absent, the base is where the current trip stays on `date` (or on its next day). A discovery kind: `DISCOVER` when configured, else `RESEARCH` |
| new request kind `whatson` | payload `{ trip?: slug, place?: string 1–80, from: date, to: date, dates_given?: true, auto?: true }` | | `to − from` ≤ 30 days. No `place`: the trip's cities on those dates (at most 6). `auto` marks the weekly check. A discovery kind |
| `replan` request payload | `daytrip` | `{ board: daytrip id, n: 1–8 }` | Plan the request's date as that kept day trip |
| `replan` request payload | `whatson` | `{ board: whatson id, item: slug }` | Fit that chosen event on the request's date |
| trip `season.events[]` (`season_event`) | `chosen_on` | date, `from ≤ chosen_on ≤ to` | The owner chose this event for that day in What's on |
| trip `season.events[]` `kind` | `exhibition`, `performance` | new enum values | |
| day plan `extras[]` and `plan_digest` day `extras[]` | `chosen` | `true` | A chosen What's on event; the chat and the app show it first, with ⭐ |
| `to-brain/state.json` | `daytrips_kept` | array ≤ 20, newest first | Kept day trips of boards whose trip is not done, and of boards without a trip: `{ board, n, trip, base, name, slug, length, ride_minutes, stops, place_id?, date?, kept_at }` |
| `to-brain/state.json` | `whatson_chosen` | array ≤ 40, newest first | Chosen items, same rule: `{ board, item, trip, place, name, kind, from, to, days?, start?, end?, venue?, url, booking?, chosen_on, chosen_at }` |
| `planner/planner-rail.mjs` `RAIL` | `CITY_FULL_KM` | `15` | Where the city formula stops growing on its own (WP-15a) |
| `planner/planner-evening.mjs` `EXTRAS` | `CHOSEN_RADIUS_KM` | `10` | How far a chosen evening event may be from the last stop or the lodging (WP-15b) |

**Own data only.** Both new payloads carry our own words, our scores, place ids, names and links. Neither carries a Google field: no coordinates, ratings, review counts, photos, hours or prices from Google. The core refuses them the way Scout does (`tgScoutGoogleKeys` in `gas/16_scout.js`). The routine keeps coordinates in the private repo, under the Maps kit's caching rules.

**The `daytrip` payload** (WP-15a owns the schema, both validators and the parity test). The whole payload stays under 20,000 characters.

| Field | Type | Meaning |
|---|---|---|
| `v` | `1` | |
| `id` | `^dt-\d{8}-[a-z0-9-]{1,40}$` | `dt-`, the run's local date, `-`, the base's slug. A re-delivered id replaces its board and keeps what was kept |
| `trip` | slug or `null` | The trip the base belongs to (one of its lodgings or cities), else `null` |
| `base` | `{ label: string 1–80, slug }` | Where the day starts |
| `created_on` | date | |
| `max_minutes` | integer 30–180 | The one-way limit asked for |
| `date` | date, optional | The day asked for |
| `items` | array 0–8, best first | Below |
| `more` | integer 0–50, optional | Day trips that passed every screen but did not make the top 8 |
| `left_out` | array ≤ 20 of `{ name: 1–120, reason }` | `reason`: `too_far`, `no_rail`, `closed_on_dates`, `out_of_season`, `duplicate`, `other` |

A `daytrip` item:

| Field | Type | Meaning |
|---|---|---|
| `n` | integer 1–8 | Its place on the board |
| `slug`, `name` | slug; string 1–120 | The destination: a town, an area or one big sight |
| `area` | string 0–80, optional | The region, in plain words |
| `ride` | `{ minutes: 1–600, estimated: boolean, from_station?: 1–80, to_station?: 1–80 }` | One way, waits included. `estimated` is true when the minutes come from the estimator |
| `length` | `half` or `full` | |
| `why` | string 1–200 | Why it suits the party, in our words |
| `see` | array 1–4 of strings 1–80 | The highlights |
| `eat` | string 1–160, optional | A vegetarian-checked food note |
| `season` | string 1–120, optional | What is in season there on the date or the trip's days |
| `closed` | array ≤ 7 of dates, optional | The asked date or trip days on which its main sights are closed |
| `score` | integer 0–100 | |
| `parts` | `{ fit, reach, season, food }`, each an integer 0–100 | The four parts of the score |
| `labels` | array ≤ 4, unique, of `gem`, `veg_easy`, `booking`, `crowded`, `rain_ok`, `seen_before` | |
| `stops` | array 1–6 of `{ name: 1–120, place_id? }` | The sights in a sensible order: the anchors a plan uses |
| `place_id` | optional | The destination's own place |
| `maps_url` | url | |

**The `whatson` payload** (WP-15b owns the schema, both validators and the parity test). The whole payload stays under 40,000 characters.

| Field | Type | Meaning |
|---|---|---|
| `v` | `1` | |
| `id` | `^wo-\d{8}-[a-z0-9-]{1,40}$` | `wo-`, the run's local date, `-`, the place's slug. A re-delivered id replaces its board and keeps the choices |
| `trip` | slug or `null` | The trip whose city and dates these are, else `null` |
| `place` | `{ label: string 1–80, slug }` | |
| `from`, `to` | dates, `from ≤ to`, at most 31 days | The window |
| `created_on` | date | |
| `auto` | `true`, optional | Sent for the weekly check |
| `items` | array 0–20, sorted by first day in the window, then start time, then name | Below |
| `more` | integer 0–50, optional | |
| `sources` | array ≤ 10 of `{ title: 1–120, url: https }` | The pages the board was built from |
| `left_out` | array ≤ 20 of `{ name: 1–120, reason }` | `reason`: `outside_dates`, `duplicate`, `unconfirmed`, `sold_out`, `other` |

A `whatson` item:

| Field | Type | Meaning |
|---|---|---|
| `id` | slug, unique in the board | Stable across runs: the engine's `eventId(name, from)` |
| `name` | string 1–120 | |
| `kind` | `light_up`, `special_opening`, `festival`, `market`, `exhibition`, `performance`, `holiday`, `closure` | Holidays and closures inform and cannot be chosen |
| `from`, `to` | dates | The event's own run, which may extend past the window |
| `days` | array ≤ 31 of dates within `from`..`to`, optional | Only these days (a market on the 21st) |
| `start`, `end` | times, optional | `end` before `start` runs past midnight |
| `venue` | `{ name: 1–120, area?: 1–80, place_id? }`, optional | |
| `why` | string 1–200 | What it is and why it suits the party, in our words |
| `food` | string 1–160, optional | A vegetarian note (festival stalls, a café) |
| `price` | string 1–80, optional | The organiser's price, in its words ("free", "1,500 yen") |
| `booking` | string 1–120, optional | The booking rule |
| `url` | https | The event's own page |
| `confidence` | `confirmed` or `likely` | `confirmed`: the organiser's page gives these dates. `likely`: a recurring event whose dates for this year are not published yet |
| `labels` | array ≤ 4, unique, of `evening`, `free`, `crowded`, `rain_ok`, `veg_food`, `booking` | |

## Step 0 — Orient (every WP)

1. Your worktree starts at `origin/main`. First run `git merge --ff-only p15-skeleton`: the coordinator's skeleton commit holds both generated branches and the C15 lines in the three pinned type lists. If the merge is not a fast-forward, stop and write why in your status file.
2. Read `CLAUDE.md`, `helpers/SPEC.md` (§5 registries, §16 ownership map, §18 limits), `helpers/packs/tour-guide/README.md`, `helpers/tools/README.md` "Branches", `helpers/decisions/TG-SCOUT.md`, `TG-PHASE-14.md` and `WP-14a.md`–`WP-14e.md`, Contract C15 above, and every file your section names. Name functions when you cite code; line numbers move.
3. Run `node --test helpers/tests/`, `node helpers/tools/bundle.mjs --all --check` and `node helpers/tools/boundary-check.mjs`. All three must be clean before you start; if not, stop and write why in your status file. Run `node helpers/tools/new-branch.mjs --check <your branch>` as well.
4. Study Scout end to end before you fill your branch in. Your branch is Scout's shape: `gas/16_scout.js` (command, kind request, validator, handler, store, card, callback), `gas/35_scout_app.js` (app ops, including the write ops `scout.new` and `scout.add`), `helpers/packs/tour-guide/scout/` (engine and payload), `schemas/tour-guide-scout.schema.json`, the Scout tests and the Scout screen in `live-site-pages/helper-app.html`. Copy its patterns, its board keys (`k` + 12 hex of the board id), its 📱 app button and its tests' harness use.
5. **Generated once.** The skeleton was generated with the commands in the Coordinator section. Never run the generator again for your branch, and never with `--force`: fill the files in. Keep the `@branch` line in step with what the branch declares, and run `--check` before you finish.
6. Write a failing test for each behaviour you add or change before you change the code, and keep the test.

## WP-15a — Day trip (item 19) and the rail estimate · `hb-builder-opus`

**Goal.** From any base, the owner asks which day trips are worth it and gets a ranked board of up to 8 within a one-way ride limit. The minutes come from the one rail estimator. The owner keeps the trips they like and, during a planned trip, puts one on a day.

**Owns:**
- the generated `daytrip` branch, filled in: `gas/41_daytrip.js`, `gas/33_daytrip_app.js`, `schemas/tour-guide-daytrip.schema.json`, `helpers/packs/tour-guide/daytrip/**` and `helpers/tests/pack_tour-guide_daytrip.test.js` (more test files `pack_tour-guide_daytrip_*.test.js` are yours too);
- the rail estimate in `planner/planner-rail.mjs` and its two test files, `pack_tour-guide_rail.test.js` and `pack_tour-guide_p13b_rail_season.test.js`;
- the Day trips screen in `live-site-pages/helper-app.html`, without its version file or changelog;
- `helpers/decisions/WP-15a.md` and `helpers/status/WP-15a.md`.

**Builds:**

1. **The rail estimate (change R).** Reproduce the fault first: 40 km costs 114 minutes and 41 km costs 70.
   - Add `RAIL.CITY_FULL_KM: 15`, with a comment that says why. Name the city formula `city(km)` and the conventional-line formula `conventional(km)`, as `rideMinutes` computes them today.
   - Up to `CITY_FULL_KM`, a ride costs `city(km)`, as today.
   - From `CITY_FULL_KM` to `INTERCITY_KM`, it costs `min(city(km), max(city(CITY_FULL_KM), conventional(km)))`.
   - Above `INTERCITY_KM`, nothing changes.
   - So 8 km stays 31 minutes, and the new figures are 17 km → 49, 25 → 50, 30 → 56, 35 → 62, 40 → 68 and 41 → 70.
   - In the test `A9: city rides and rides past SHINKANSEN_KM keep their numbers`, the list `[0.5, 3, 8, 25, 40]` becomes `[0.5, 3, 8, 15]`; mark the line `C15`.
   - A new test pins the band:
     - from 0.5 km to 150 km in 0.5 km steps, the minutes never fall;
     - the 40 → 41 km step is at most 3 minutes;
     - no ride in the band costs more than the city formula did.
   - Scout's `estimateReach` and the planner's legs get the new numbers through `rideMinutes`. A test elsewhere that pinned a minute figure for a 15–40 km ride may change; mark it `C15` and list it.
2. **The command.** `/daytrip [from] <place> [under <N> min|h] [on <date>]`, and `/daytrip` alone.
   - **The words.** `from` is optional.
     - `under 45 min`, `under 1.5 h` and `under 2h` become minutes, clamped to 30–180; the default is 90.
     - `on` takes `YYYY-MM-DD`, `M/D` (the next such date from today, in the trip's zone or the owner's), `today` or `tomorrow`.
     - What is left is the base, 1–80 characters.
     - The engine's `parseDaytripText(text, { today })` and the core's `tgDaytripParse(text, today)` agree on a shared case list (a parity test, as Scout's parse has).
   - **No base.**
     - With a current trip (under way or upcoming), the request goes without `from`. The routine starts from that trip's lodging: of the asked date; without a date, of tomorrow while the trip is under way, else of its first night. The acknowledgement says "from where you stay".
     - With no trip, the owner gets a one-line how-to and no request is opened.
   - The request is kind `daytrip` with C15's payload; `trip` is the current trip whenever there is one. The routine decides whether the base belongs to that trip and sets the board's `trip` to match.
   - `/daytrips` lists the last 10 boards, one line each, with 🚆 buttons that resend a board; the kept trips are listed first, marked ✅.
3. **The engine** (`daytrip/`), pure, with no network.
   - `reachPart(minutes, maxMinutes)` is 100 up to 30 minutes, falls linearly to 40 at `maxMinutes`, and is `null` beyond it.
   - `rankDayTrips(candidates, { maxMinutes, date, tripDays })` returns `{ items, more, left_out }`.
     - **A candidate** is the private driver's record: `{ slug, name, area?, ride: { minutes, estimated, from_station?, to_station? } | null, length, why, see, eat?, food: 'confirmed' | 'likely' | 'unknown' | 'none', season: 'in' | 'neutral' | 'out', season_line?, closed: [dates], fit: 0–100, labels?, stops, place_id?, maps_url }`. The judgment marks `season: 'out'` only when the main reason to go is a season that is over or not yet begun.
     - **Screens, in order:**
       - `duplicate`: the same slug, or the same name ignoring case and accents;
       - `no_rail`: `ride` is null, because the routine found no train or bus;
       - `too_far`: `reachPart` is null;
       - `closed_on_dates`: closed on the asked date, or, without a date, on every trip day;
       - `out_of_season`.
     - **The score** is the rounded sum of four weighted parts:
       - 0.45 × `fit`;
       - 0.25 × reach;
       - 0.15 × season, where `in` = 100, `neutral` = 60 and `out` = 0;
       - 0.15 × food, where `confirmed` = 100, `likely` = 70, `unknown` = 40 and `none` = 0.
     - Ties go to the shorter ride, then the name. The top 8 are the items, numbered; the count of the rest is `more`. The engine adds `veg_easy` to `labels` when the food is confirmed.
   - `dayTripId(createdOn, baseSlug)` and `daytripPayload({ trip, base, createdOn, maxMinutes, date, ranked })` return a payload that passes the schema.
   - `dayTripOutlineEntry({ name, center: { lat, lng }, anchors })` returns `{ kind: 'full', area: { name, lat, lng, radius_km: 3 }, anchors }`, with at most 3 anchors. The private side plans a kept trip's day with it. A test passes the result through the planner's `normalizeOutline`.
4. **The schema and the two validators** are C15's `daytrip`, with the parity test the skeleton wrote, on the real fields.
   - The core validator refuses every Google field by calling `tgScoutGoogleKeys`, and refuses a payload over 20,000 characters.
   - The fixture is invented: an invented base and invented towns.
5. **The store and the card.**
   - **The DayTrips tab** holds one row per board id, with columns `id`, `trip`, `base_label`, `created_on`, `max_minutes`, `date`, `count`, `payload_json`, `kept_json` and `received_at`. `kept_json` is `[{ n, slug, date?, at }]`. A re-delivered id replaces its row and keeps each kept entry whose slug is still on the board, renumbered.
   - **The card** reads "🚆 <b>Day trips from <base></b> · under N min", plus "· <date>" when one was asked.
     - Each item has a numbered line `n. <name> — 🚆 45 min · full day`, then its `why` in italics.
     - When given, these lines follow: 🌱 the food, 🍂 the season, ⛔ the closed days.
     - Below the list come ➕ n buttons, 4 to a row, and 📱 Open in the app.
     - Nothing left out is listed in the chat; the app shows it.
   - **The buttons.** `dt:<key>:<n>` keeps or un-keeps item n: the answer is "Kept" or "Removed", and the card's keyboard shows ✅ on kept items. `dt:<key>:s` resends the card.
     - A keep on a board whose trip has planned days (`tgDigestDays`) is followed by "Put <name> on a day?" with one button per planned day, `dt:<key>:<n>.<d>`.
     - A day tap stores the date on the kept entry and opens a `replan`, with an acknowledgement like the Later list's promote. The payload is `{ trip, dates: [that date, plus the old date when the trip moves from one], daytrip: { board, n }, reason: 'a day trip to <name>', deliverables: tgCmdDeliverables(trip) }`.
   - **The `daytrips_kept` snapshot provider** (C15) is registered from your module, so `21_sheets.js` is not edited.
6. **The app.**
   - `daytrip.list` returns the last 20 heads.
   - `daytrip.get { id }` returns the board and its kept entries.
   - `daytrip.keep { id, n, keep, date? }` is a write op with the buttons' rules, including the re-plan when a date is set.
   - `daytrip.new { from?, under?, date? }` is a write op that opens the request as the command does.
   - **The Day trips screen** lists the boards. A board shows each item's ride, length, why, highlights, food, season, closed days and four score bars, in the style of Scout's bars. It shows a Keep toggle and, on a trip with planned days, a day picker. What was left out appears under the list, with the reasons in words.
7. **Docs.** The branch README, the pack README's rows for `41_daytrip.js` and `33_daytrip_app.js`, and REQUEST lines for the SPEC §16 row and anything outside your paths.

**Tests**, all on invented data:
- the parse parity, `reachPart` and every screen, the ranking order, ties, `more` and labels;
- the schema and both validators, including a Google field and an oversize payload;
- the command: with a base, without one, and with no trip; the request's payload;
- the handler, which stores the board and sends the card;
- a re-delivery that keeps a kept entry;
- the keep toggle, the day buttons and the replan payload;
- the snapshot and the four app ops;
- `dayTripOutlineEntry` through `normalizeOutline`;
- the rail band.

## WP-15b — What's on (item 20), the season sheet and the evening · `hb-builder-opus`

**Goal.** For any city and dates, the owner sees what is on, grouped by date with its sources, and chooses things for specific days; the plan then carries them. Before and during a trip, the trip's cities are checked once a week, and the owner hears only about new things.

**Owns:**
- the generated `whatson` branch, filled in: `gas/42_whatson.js`, `gas/34_whatson_app.js`, `schemas/tour-guide-whatson.schema.json`, `helpers/packs/tour-guide/whatson/**` and `helpers/tests/pack_tour-guide_whatson.test.js` (more test files `pack_tour-guide_whatson_*.test.js` are yours too);
- the season sheet's C15 fields: `season_event` in `schemas/tour-guide-trip.schema.json`, `checkSeason` in `schemas/tour-guide-checks.mjs`, `season/season-normalize.mjs`, and `pack_tour-guide_season.test.js`;
- the evening: `planner/planner-evening.mjs`, and in `planner/index.mjs` the extras call and the line that exports from `planner-evening.mjs` (add `isEveningChoice` there). Your new evening tests go in your own test files; the planner's existing tests are not yours (Rules: tests outside your paths);
- the `chosen` field on extras:
  - `schemas/tour-guide-day-plan.schema.json` and `schemas/tour-guide-plan-digest.schema.json`;
  - the core's extras check in `gas/20_envelopes.js`;
  - the chat's extras lines in `gas/10_commands.js` (`tgCmdDayExtraLines`);
  - the extras block of the app's day view;
- the What's on screen in `live-site-pages/helper-app.html`, without its version file or changelog;
- `helpers/decisions/WP-15b.md` and `helpers/status/WP-15b.md`.

**Builds:**

1. **The season sheet (C15).**
   - `season_event.chosen_on` is an optional date. `checkSeason` refuses it outside `from`..`to`, and `normalizeSeason` keeps it.
   - The event kinds gain `exhibition` and `performance`.
   - Old season sheets load and plan exactly as before.
2. **The evening (change E).**
   - **The fault.** Reproduce it first: an unchosen 10:00–17:30 special opening 1 km away is offered that evening at "10:00".
   - **The fix.** An event already under way when the day's stops finish is offered from the later of the finish plus `AFTER_MIN` and `ready`, while at least `MIN_OPEN` minutes of it are left; otherwise it is not offered. This is A12's rule for the day's start, applied to the finish.
   - **An evening choice.** Export `isEveningChoice(event)` so the private side uses the same rule: true when `runsThatEvening(event, event.chosen_on)` holds and the event's start, when it has one, is at or after `EXTRAS.START_FROM`. Every other chosen event is a daytime choice. A daytime choice is never an extra: the private side pins it to its day.
   - **Chosen events in the extras.**
     - A chosen event is considered only on its `chosen_on` date. An unchosen event is considered on every evening it runs, as today.
     - Chosen evening events come first, within `EXTRAS.CHOSEN_RADIUS_KM` (10 km), and carry `chosen: true`.
     - Unchosen events by distance come next, then saved places, all under `EXTRAS.MAX`.
     - A chosen evening event farther than 10 km is not offered. Instead, the day gets an info warning: "<name>, chosen for this evening, is about N km from where the day ends".
   - **The `chosen` field.** The day-plan schema, the digest schema, the core's check, the chat and the app all accept `chosen: true` on an extra.
     - The chat and the app show a chosen event with ⭐.
     - They head the list "This evening" when the first extra is chosen, and "If you have energy" otherwise.
     - An older digest shows exactly as before.
3. **The command.** `/whatson [in] [<place>] [<when>]`.
   - **`<when>`** may be:
     - `today` or `tomorrow`;
     - `this week` (today to Sunday), `next week` (Monday to Sunday) or `this weekend`;
     - a date: `YYYY-MM-DD`, `M/D`, `8 Jun` or `Jun 8`;
     - a range: `<date> to <date>`, `<date>-<date>`, `<date>..<date>`, `8-10 Jun` or `Jun 8-10`.

     A window is at most 31 days. A year-less date means its next occurrence from today. A window that is past, reversed or too long gets a one-line answer and no request.
   - **The defaults.**
     - With no `<when>` and a current trip, the window runs from the trip's today (or its first day) to its last day, at most 31 days. With no trip, it is today and the next 6 days.
     - With no place and a current trip, the routine checks the trip's cities on those dates (`trip` is in the request). With no place and no trip, the owner gets a one-line how-to.
   - The request is kind `whatson` with C15's payload. The core sends the resolved `from` and `to`, with `dates_given: true` when the owner named them. The engine's `parseWhatsonText(text, { today })` and the core's mirror agree on a shared case list (a parity test).
   - `/whatson last` lists the last 10 boards with 🗓 buttons that resend one.
   - `/whatson auto on|off` sets the setting `whatson_auto` (`settingGet` and `settingSet`, as `/lists auto on|off` does), which is on by default.
4. **The weekly check.** An alarm, `tg_whatson`.
   - **When.** For every trip that is not done and has dates, the check is due at 09:00 in the trip's zone. The first check falls 21 days before the trip's first day; after that it is due seven days after the last check, up to the trip's last day. `next()` returns the earliest due time, or `null` when `whatson_auto` is off or no trip is due.
   - **What it opens.** `run()` opens one request per due trip, `whatson { trip, from: max(trip today, first day), to: min(last day, from + 30), auto: true }`, with no acknowledgement (`ack: false`). It records the date the check ran for that trip. It skips a trip while a `whatson` request for it is still open.
   - **Silent unless new.** The handler stores an `auto` board without a word unless the board has an item whose id was not on the previous board for the same trip and place. When it does, it sends "🗓 <b>New on in <place></b> · <window>", listing only the new items. The rest of the board is in the app.
5. **The engine** (`whatson/`), pure, with no network.
   - `parseWhatsonText`.
   - `eventId(name, from)`: the slug of the name plus the date's `mmdd`, so the same event keeps its id from run to run.
   - `normalizeWhatson(items, { from, to })` returns `{ items, more, left_out }`.
     - Duplicates are items with the same name, ignoring case and accents, and overlapping dates. Keep the confirmed one, else the one with more fields.
     - Items with no day in the window are left out as `outside_dates`.
     - Sort by the first day in the window, then start time, then name; cap at 20.
   - `whatsonPayload(...)`.
   - `toSeasonEvent(item, { chosen_on })` returns a `season_event` that passes the trip schema and `checkSeason`. Its id is `wo-` plus the item id, cut to the slug's length. Its note is `why`, cut to 160. It keeps the kind, the run, the times and the url, and takes `place_id` and `area` from the venue: the planner locates an event by its `place_id`, and never by an area alone.
   - `mergeChosen(season, choices, { tripStart, tripEnd })` returns `{ season, added, marked, dropped }`; the season passes `normalizeSeason`.
     - A choice that matches an event already in the sheet (same name, ignoring case and accents, and overlapping dates) marks that event with `chosen_on` and adds nothing.
     - Other choices are added.
     - Over the 40-event cap, unchosen events are dropped: first those wholly outside the trip, then those starting latest. A chosen event is never dropped.
   - `newItems(previous, next)`.
6. **The schema and the two validators** are C15's `whatson`, with the parity test the skeleton wrote, on the real fields.
   - The core validator refuses every Google field (`tgScoutGoogleKeys`) and a payload over 40,000 characters.
   - The fixture is invented.
7. **The store and the card.**
   - **The WhatsOn tab** holds one row per board id, with columns `id`, `trip`, `place_label`, `from`, `to`, `created_on`, `auto`, `count`, `payload_json`, `chosen_json` and `received_at`. `chosen_json` is `[{ item, chosen_on, at }]`. A re-delivered id replaces its row and keeps each choice whose item id is still on the board.
   - **The card** reads "🗓 <b>What's on in <place></b> · 8–10 Jun".
     - Items that run on every day of the window go first, under "<b>All these days</b>". The rest go under their dates ("<b>Mon 8 Jun</b>").
     - Each item has one line: a kind emoji, the times, the name, "until <date>" when the item runs on past the window, and ✅ when chosen.
     - Under it come `why` in italics, then 🌱 food, 💴 price and 🎟 booking when given.
     - A `likely` item says "(dates not yet confirmed)".
     - A "Sources:" line links up to 3 sources.
     - Below the list come ➕ n buttons for the choosable kinds, and 📱 Open in the app.
     - The card stays under 4,000 characters; past that, it ends with "… and N more in the app".
   - **Choosing.** A ➕ button (`wo:<key>:…`) chooses or un-chooses an item. Like the Later list's buttons, it carries a short tag of the item id, so a re-delivered board cannot make it choose the wrong item.
     - **Which day.** `chosen_on` is the item's day within the window and the trip's days (just the window when the board has no trip). When the item covers more than one such day, the bot asks "Which day?" with buttons for the first 8 of them.
     - **Re-planning.** Once an item is chosen, the bot offers "🔁 Re-plan <day>" when the board's trip has a planned day on `chosen_on`. That button opens `replan { trip, dates: [chosen_on], whatson: { board, item }, reason: 'added <name> from What\'s on', deliverables }`.
     - **Un-choosing** answers "Removed — any day already planned keeps it until that day is re-planned".
   - **The `whatson_chosen` snapshot provider** (C15) is registered from your module.
8. **The app.**
   - `whatson.list` returns the last 20 heads.
   - `whatson.get { id }` returns the board and its choices.
   - `whatson.choose { id, item, choose, chosen_on?, replan? }` is a write op with the buttons' rules. With `replan: true` and a planned day, it also opens the re-plan.
   - `whatson.new { place?, from?, to? }` is a write op that opens the request as the command does.
   - **The What's on screen** lists the boards. A board is grouped by date, and shows each item's kind, times, venue, why, food, price, booking, source link and confidence. It has a Choose toggle, with a day picker when more than one day fits, and a Re-plan button when that day is planned.
9. **Docs.** The branch README, the season README (`chosen_on` and the two kinds), the pack README's rows for `42_whatson.js`, `34_whatson_app.js` and the evening, and REQUEST lines for the SPEC §16 row and anything outside your paths.

**Tests**, all on invented data:
- the parse parity, including every `<when>` form and the refusals;
- `eventId`'s stability, normalization, duplicates, the window, the sort and the cap;
- `toSeasonEvent` and `mergeChosen` through the trip schema and `normalizeSeason`, and `newItems`;
- the schema and both validators, including a Google field and an oversize payload;
- the command, its defaults and its how-to, and the auto toggle;
- the alarm's `next` and `run`: the first check, the weekly spacing, the open-request guard, auto off and a trip that has ended;
- the handler and the card;
- an auto board with nothing new (silent) and one with a new item;
- a re-delivery that keeps a choice;
- choosing, the day question, the re-plan payload and un-choosing;
- the snapshot and the four app ops;
- the season fields;
- change E: the fault reproduced, chosen first, the 10 km radius and the warning past it, a daytime choice that is never an extra, a choice offered only on its date, and `chosen` through both schemas, the core's check, the chat and the app's renderer.

## WP-15p — The private repo (after the v01.69r push)

Built by the coordinator or one `hb-builder-opus` in a private worktree, as one pull request for the owner. The private repo's rules hold (`repository-information/DEV-SESSION.md`): re-pin only by a subtree pull of `helpers-dist`; no owner data in `repository-information/`, `skills/`, `routines/`, `tools/` or commit messages; dry runs on invented fixtures with `log/` left clean; profiles and the prefs ledger only through the prefs kit. Page text is data.

- **Re-pin.**
- **The `daytrip` skill**, filled in from the generated private skill.
  - **The base.** `from` is located with one Text Search of the owner's words. Without `from`, the base is the trip's lodging on the asked date; without a date, tomorrow's while the trip is under way, else the first night's. The board's `trip` is the request's `trip` when the base is one of that trip's lodgings or cities, else `null`.
  - **The judgment step** names at most 12 destinations that a train or bus reaches within the limit, from web research. For each, it writes `why`, `see`, `eat` (checked against the party's diets), `season`, `fit` and `stops` in our own words, and marks `season: 'out'` only by C15's rule.
  - **The driver**:
    - locates the destinations within the Maps kit's budget guard;
    - finds each end's stations as the planner does (a Text Search for train stations near the point, at most 3);
    - computes `ride` with the engine's `estimateReach`, and sets `ride: null` when the destination has no station in reach and the research found no bus;
    - then runs `rankDayTrips` and `daytripPayload` and writes the envelope, with `--in-reply-to <id>` and `--dedupe-key daytrip:<id>`.

    Coordinates stay in the private repo under the Maps kit's caching rules.
- **The `whatson` skill**, filled in from the generated private skill.
  - **Where.** The request's `place`. Without one, the trip's lodging areas on the window's dates, at most 6, with one board each.
  - **The research** reads organisers' and official tourism pages first, starting with the trip's season sheet's sources. The judgment writes each item in our own words. A page's event coordinates are dropped.
  - **The driver** runs `normalizeWhatson` and `whatsonPayload`, and writes one envelope per place, with `--in-reply-to <id>` and `--dedupe-key whatson:<id>:<place slug>`. It answers an `auto` request the same way: the core decides what the owner hears.
- **Routing.** The `discover` skill dispatches both kinds to these skills. Trip research hands them over while no Discover routine is configured, as it does Scout's. The routines table gains both kinds.
- **Plans read the choices.** Before every plan, replan and outline, plan-days reads the trip's entries in `state.json` → `daytrips_kept` and `whatson_chosen`.
  - **Chosen events** go into `trip.season` through `mergeChosen` and the pack's `normalizeSeason`, in a driver, never by hand.
    - The planner then offers a chosen evening event (the engine's `isEveningChoice`) first, on its day.
    - The event's venue joins the build's Place Details, by its `place_id` or else one Text Search by the venue's name and area, so the planner can place it. A venue it cannot place is named in the reply.
  - **A chosen daytime event** is pinned to its day.
    - The venue gets a place file, with history `chosen` and the note "chosen in What's on for <day>".
    - It becomes an anchor on `chosen_on`: the outline entry `{ kind: 'full', anchors: [slug] }` when the date has none, or one more anchor when the date has fewer than 3.
    - A day that already has 3 anchors, or is a free or travel day, keeps its plan, and the reply says why the choice was not placed.
  - **A kept day trip with a date** plans that date with `dayTripOutlineEntry`.
    - The destination is the area's centre, and its first 3 stops are the anchors. All of them are looked up in the build's Place Details, by the board's place ids or else one Text Search each.
    - Each stop gets a place file, with history `chosen` and the note "kept as a day trip for <day>".
    - The reply says "<day> is now a day trip to <name>".
  - **A kept day trip without a date** joins the trip's candidates as picks, through its stops, so that the outlines' "Full days" option can place it.
  - **A `replan` with `daytrip` or `whatson`** applies that one choice to its date. The plan-days driver reads the field from the saved request, as it reads `alternative`.
- **Dry runs** on invented fixtures:
  - a day-trip board;
  - a What's on board for two places;
  - an `auto` board;
  - a plan that applies a kept day trip, an evening choice and a daytime choice.

**The owner's steps** after the private pull request merges, sent in one message:
1. Try `/daytrip`, `/daytrip from <place>`, `/whatson` and `/whatson <place> <dates>`.
2. The weekly What's on check starts by itself 21 days before a trip; `/whatson auto off` stops it.
3. Trip research answers both kinds until the Discover routine from Phase 14's steps exists.

## Coordinator — skeleton, builders, merge, probe, push, then the private repo

1. **The skeleton**, after v01.68r is on `main`.
   - In the Personal checkout, make a local branch `p15-skeleton` from `origin/main`.
   - Generate both branches, in this order, so that the app files take 33 and 34:
     ```
     node helpers/tools/new-branch.mjs daytrip --title "Day trip" --command /daytrip --kind daytrip --envelope daytrip --tab DayTrips --prefix 41 --discover --private-out <scratch>/p15-private
     node helpers/tools/new-branch.mjs whatson --title "Whats on" --command /whatson --kind whatson --envelope whatson --tab WhatsOn --prefix 42 --discover --private-out <scratch>/p15-private
     ```
     `<scratch>` is outside the repo; the private skills wait there for WP-15p.
   - The title pattern takes no apostrophe, so write "What's on" into the generated text by hand. Never use `--force`.
   - Add both types to the three pinned type lists ("What you still write by hand" in `helpers/tools/README.md`), with the generated fixtures as their `EXAMPLES`. Mark each line `C15`.
   - Run `--check daytrip`, `--check whatson`, the three checks and the vendored-layout tests, then commit to `p15-skeleton`.
2. **Spawn** WP-15a and WP-15b in parallel (`hb-builder-opus`), each in its own worktree from `origin/main`. Change into the Personal checkout before spawning: worktree isolation follows the shell's directory. Each builder merges `p15-skeleton` first (Step 0).
3. **Merge** into this session's `claude/*` branch, rebased on `origin/main`: the skeleton, then squash-merge `wp-15a`, then `wp-15b`.
   - Resolve conflicts by ownership. In `helper-app.html`, the Day trips screen is WP-15a's; the What's on screen and the day view's extras are WP-15b's. A row of the pack README belongs to the WP that owns its file.
   - After each merge, run the three checks and the vendored-layout tests.
   - Act on each REQUEST, and check every test a builder changed outside its own paths.
   - `--check daytrip` and `--check whatson` pass.
4. **The probe**, on invented data.
   - **Rail.** `rideMinutes` gives 8 km → 31, 15 → 49, 25 → 50, 35 → 62, 40 → 68 and 41 → 70. Scout's `estimateReach` reads about an hour for two stations 35 km apart.
   - **Day trip.** A board from an invented base runs every screen. Then check a keep, a day tap and its replan payload, `daytrips_kept` in the snapshot, and the four app ops.
   - **What's on.** A window holds an exhibition that runs the whole window, a market on one day, an evening light-up and a holiday.
     - Check the card's grouping, choosing with the day question, the re-plan offer and `whatson_chosen`.
     - An auto board with nothing new stays silent; one with a new item tells only that item.
     - Check the alarm's `next` and `run`.
   - **The evening.** A chosen light-up comes first, with ⭐, on its day only. An unchosen daytime opening is no longer offered at its morning start.
5. **The push** (v01.69r). Do the bookkeeping per `CLAUDE.md` in the single push commit:
   - the repo version;
   - the CHANGELOG with the owner's prompt, personal details redacted;
   - the README timestamp, and tree entries for new files;
   - `helpers/BUILD-STATE.md` (row 15 and a log entry) and the SPEC §16 rows;
   - `helpers/decisions/TG-PHASE-15.md`;
   - the helper app's version file, meta tag and page changelog.

   Fetch, check and push in one chain; verify `main` afterwards; confirm that **Deploy helper** and `helpers-dist` ran.
6. **The private repo** (WP-15p), as one pull request, then the owner's steps in one message. Record each live result in `helpers/decisions/TG-PHASE-15.md` and BUILD-STATE row 15.

## Rules (every WP)

- **Public repo.** Never commit names, places, dates, hotels, ids, e-mail addresses, phone numbers, or anything from the private repo or the review. Fixtures are invented: invented bases, towns, events, venues, dates and parties.
- **Own paths only.** Edit only the paths you own. Anything else is a REQUEST line in your status file (file, change, why).
  - The skeleton's changes to `helper.json`, `schemas/index.mjs` and the three pinned type lists are done; nobody edits them again this phase.
  - `fixtures/index.mjs`, the shared fixture loaders and `helpers/tests/harness/` are nobody's: load your fixtures, and stub what you need, inside your own tests.
  - In `helpers/packs/tour-guide/README.md`, edit only your own rows.
  - An export you need from a module you do not own is a REQUEST; meanwhile, import from the file directly.
- **Tests outside your paths.**
  - Never edit a test that the other WP owns.
  - A test that no WP of this phase owns may be updated only when it breaks because of a change your section asks for. Mark each changed assertion with the change's letter (`R`, `E`) or `C15`, and list the test in your status file.
  - Never weaken a test to make it pass.
- **Off limits.** Never push and never commit to `main`.
  - Never touch `.github/workflows/`, `repository-information/`, the root `README.md`, `helpers/BUILD-STATE.md`, `helpers/prompts/` or `live-site-pages/`. The exceptions are in `helper-app.html`, without its version file or changelog: WP-15a's Day trips screen, and WP-15b's What's on screen and the day view's extras.
  - `gas/` is edited only where a section says so: WP-15a's `41_daytrip.js` and `33_daytrip_app.js`; WP-15b's `42_whatson.js` and `34_whatson_app.js`, the extras check in `20_envelopes.js` and `tgCmdDayExtraLines` in `10_commands.js`. `helpers/core/` is nobody's. The coordinator does the bookkeeping.
  - In `planner/`, WP-15a edits only `planner-rail.mjs`, and WP-15b only `planner-evening.mjs` and its two places in `planner/index.mjs`.
  - Add no envelope type, request kind, tab, alarm or setting beyond C15 and your section.
- **Backward compatible.** The core deploys on the push, and the private repo stays on its current pin until its pull request merges. Everything the old code wrote must still load and display: every row, envelope, digest, plan, season sheet and request. The old pin's payloads must still validate, and an extra without `chosen` shows exactly as before.
- **No network** except recorded fixtures: no live Google, Telegram, Drive, Open-Meteo, web or Claude API calls, and no package installs.
  - `/mnt/project-files` is read-only to you, and nothing in it is needed for this phase.
- **Commits and records.** Commit to your worktree branch as you go: small commits, plain messages without a version prefix, each ending with the session's attribution trailer.
  - Commit after every finished step. If the coordinator tells you to stop (the owner's usage rule), commit, update your status file and stop.
  - Keep `helpers/status/WP-15x.md` current after each step (done, next, REQUESTs), with your own letter for x.
  - Record every default you pick, with its reason, in `helpers/decisions/WP-15x.md`.
  - `Developed by: LightAISolutions` is the last line of every new file.
- **Real tests.** Tests verify real behaviour (the `CLAUDE.md` test-quality rule): call the real function with controlled input and check its output or side effect.
- **When you finish,** the three checks and `--check <your branch>` are clean in your worktree. Your last message says:
  - what you built;
  - what you decided;
  - every REQUEST;
  - every test outside your paths that you changed.

Developed by: LightAISolutions
