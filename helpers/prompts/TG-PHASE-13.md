# Phase 13 — The fix package: trip-breakers, real stays, the vegetarian gaps, hours and rail, messages, Scout's faults

> Written 2026-10-04 by the coordinator of the owner's morning review. The owner approved the review's fix package (decision-page items 1–6 and 8) and asked for it before the other approved items; item 8 is the private repo's data pass and is not built here. Model rule (owner): coordinator Opus 5.5, builders `hb-builder-opus` (Opus 5.5 · high), **no Fable anywhere**. Start with `Read helpers/prompts/TG-PHASE-13.md and execute it exactly.` Progress in `helpers/BUILD-STATE.md`.

The review (finding ids A1–A16 in the framework; B-ids are the private repo's) found faults that would bite on the trip itself. Some stop the whole build: a departure day whose hard end cannot be met throws "no feasible day" instead of coming back empty with its alert (`solveDay`, `planner/planner-solve.mjs`; the alert is in `planDay`, `planner/planner-day.mjs`); a day override whose end is not after its start throws (`planner/planner-input.mjs`); a booked stop at either edge of its day is dropped to Later with the first day's window in its reason (`assign`, `planner/planner-assign.mjs`). The owner cannot set a trip with more than one stay from the chat: `/lodging` saves one text, `trip_update` has no lodging, and the routine locates lodging only while none is known. An unchecked dinner menu is offered exactly like a checked one, and owner facts never age. Irregular wording on one Google weekday line makes the whole place irregular, so its closed days are ignored. The travel day gets two booking reminders. Long lines are cut inside HTML tags. Scout's "been before" never lights, its board hours stop after seven dates, and the core and the engine parse the owner's words with two grammars.

The phase runs as **one wave of four framework work packages** in parallel, each in its own worktree from `origin/main` (v01.63r or later): WP-13a and WP-13b share the planner, split by file; WP-13c is the core; WP-13d is the Scout engine. The coordinator merges them, plays a departure-day probe end to end, pushes once, then re-pins the private repo and builds its side.

## Done when (the owner's criteria, generalised for this public repo)

| Item | Fixes | Done when |
|---|---|---|
| 1 Trip-breakers | A1, A2, A3 | A trip whose last day ends at a departure too early to fit (the start step plus the leg to the airport overrun it) builds end to end: that day comes back without stops and with an `over_long_day` alert, never an error. An override whose end is not after its start is clamped with a warning, and `/dates` says how to make an early end valid. A booking at the edge of its day stretches that day and is never dropped. |
| 2 Real stays | B4 framework half | The owner sends nights per stay (`/lodging <words> <first night> to <check-out>`) and the next request carries every stay; the routine applies dates and stays together (private). A plan records the lodging it was built for, and `/trip` says "built for different lodging" until it is rebuilt. |
| 3 Vegetarian gaps | A4, A5, B11 | Every dinner whose menu was never checked, or was checked more than 30 days ago, carries "menu not checked for <the diet>" and ranks below checked ones. Own hours facts older than 90 days raise a "facts are old" warning. Where the party's diet has a hidden-stock rule, Google's serves-vegetarian flag alone means "vegetarian not confirmed" in Scout. |
| 4 Hours, season, rail | A6, A7, A9, A12, A13, A14, B7 | A place closed on Mondays whose other lines say "hours might differ" stays off Monday. A place whose own record says it opens on irregular or posted days is back in the plan with "check on the day". A leg of about 85 km between two towns with no high-speed line estimates about two hours. A rose garden passes the season screen in November. Evening extras never start before the day's arrival; the rain swap knows irregular places; a booking dated outside the trip says so. |
| 5 Messages and timing | A8, A10, A11, A15, A16 | A day card with ten map links arrives as valid HTML. The travel day gets one booking reminder, not two. A departure day's last leg leaves as late as the end allows, with the spare time shown before it. Fact dates use the local day. Node and Apps Script agree on every length bound. (B12, B14, B17, B18 are the private repo's.) |
| 6 Scout's faults | review §4 faults 8–11 (framework half) | "Been before" lights. The board's hours cover every date the owner is in that city, and the closed-on-your-days screen uses only those dates. "<topic> near <area>, <city>" belongs to the city. The core sends the owner's raw words and the engine's grammar is the one that counts. Scouted candidates are their own group in `/places` and the app. |

## Contract C13 — new optional fields

Every field is optional, so old trips, places, digests, requests, the private repo's old pin and the live core keep working. A validator accepts a field only with the type and bounds below and still refuses unknown keys. Dates are `YYYY-MM-DD`.

| Where | Field | Type | Meaning |
|---|---|---|---|
| core request `trip_update` (every kind that carries one) | `lodging` | array 1–12 of `{ text 1–200, from, to }`, sorted by `from`, `to` after `from`, nights not overlapping | The owner's stays: `from` is the first night, `to` the check-out date (the stay covers the nights `from` … `to − 1`, the trip's night rule). Sent once the owner has used the dated `/lodging` form; from then on it is the whole truth (a stay not listed is gone). Absent → the trip file's lodging is untouched |
| core request `plan`, `replan` | `lodging_fp` | string `^lfp1:[0-9a-f]{8}$` | The lodging fingerprint the core holds when it sends the request |
| `plan_digest` top | `lodging_fp` | as above | Echoed by the routine from the request the digest answers |
| `places_digest` place | `scouted` | `true` | A candidate Scout found that the owner has not chosen yet |
| place `facts` | `irregular` | `true` | The place's own site says it opens on irregular or posted days |
| place `facts` | `irregular_note` | string 1–160 | Its own words about those days, shown as the stop's check line |

**The fingerprint.** `lfp1:` and the lower-case 8-hex FNV-1a (32-bit) of the stays, each normalised as `from|to|text` (text lower-cased, whitespace collapsed, trimmed), one per line in `from` order, joined by `\n`, hashed over the UTF-8 bytes; without stays, of the undated `/lodging` text alone; no lodging at all → no fingerprint. Only the core computes it; the routine copies it.

**The stale rule (core).** A stored plan is "built for different lodging" when its digest's `lodging_fp` — or, when the digest has none, the `lodging_fp` of the request it answers (`in_reply_to`) — differs from the trip's current fingerprint. A digest with neither is stale only when the lodging's `set_at` is later than the digest's arrival; a lodging without `set_at` (saved before this phase) and such a digest → no line.

**Who does what.** WP-13a owns the trip, day-plan and plan schemas and their checks; WP-13b the place schema, `normalizeFacts` and `checkPlace`; WP-13c both digests' schemas and checks (the pack's and the core's mirror), the requests and every Telegram and app behaviour; WP-13d the Scout engine and its payload. The private repo applies `trip_update.lodging`, copies `lodging_fp`, sets `scouted` and gives Scout its new inputs after the push.

## Step 0 — Orient (every WP)

1. Read `CLAUDE.md`, `helpers/SPEC.md` (§5 registries, §16 ownership map, §18 limits), `helpers/packs/tour-guide/README.md`, `helpers/decisions/TG-PHASE-10.md`, `TG-PHASE-11.md`, `TG-PHASE-12.md`, `WP-12a.md`, `WP-12b.md` and `WP-12r.md` (WP-13d also `TG-SCOUT.md`), Contract C13 above, and every file your section names. Name functions when you cite code; line numbers move.
2. In your worktree run `node --test helpers/tests/`, `node helpers/tools/bundle.mjs --all --check` and `node helpers/tools/boundary-check.mjs`. All three must be clean before you start; if not, stop and write why in your status file.
3. Reproduce each finding you own with a failing test before you fix it, and keep the test. A finding that does not reproduce is recorded in your decisions file with what you tried; it is not "fixed" by guesswork.

## WP-13a — Planner: the day's shape · `hb-builder-opus`

**Paths you own.** `helpers/packs/tour-guide/planner/*` except `planner-hours.mjs`, `planner-facts.mjs`, `planner-dinner.mjs`, `planner-rain.mjs` and `planner-rail.mjs` (WP-13b's); the schemas `tour-guide-trip.schema.json`, `tour-guide-day-plan.schema.json` and `tour-guide-plan.schema.json`, and `schemas/tour-guide-dates.mjs`; in `schemas/tour-guide-checks.mjs` only `checkTrip`, `checkDayPlan` and `checkDayChain` (add any helper next to them); new invented fixtures under `fixtures/p13a-*`; new tests `helpers/tests/pack_tour-guide_p13a_*.test.js`; the existing tests of the modules you own, where a finding changes their behaviour.

**Evidence.**
- **A1.** A day with a hard end (`end.time`, such as a departure) that cannot be reached even with no stops makes `solveDay` (`planner/planner-solve.mjs`) throw "no feasible day", and the whole trip fails. The `over_long_day` alert that `planDay` writes (`planner/planner-day.mjs`) is never reached. Reproduce it with trip hours from 09:00, the last day ending at an airport at 11:30, a leg of about 110 minutes to it, and the day's start step (`breakfastLen`).
- **A2.** `withOverride` (`planner/planner-input.mjs`) throws when an override's end is not after its start. The core's `/dates` refuses such an override, but the brain, the outline and the app interview write overrides without that check.
- **A3.** `assign` (`planner/planner-assign.mjs`) drops a booked stop to Later as `outside_day` when its booking starts before the day's start plus the start step, or ends after the day's end. The reason text quotes the window of a day other than the booked one.
- **A13.** A booking dated outside the trip comes back as "closed on every day of the trip".
- **A8.** On a day with a hard end, the last leg leaves right after the last stop, and the spare time is shown at the end point (`END_SPARE_NOTE`).
- **A12.** On a day that starts late, an evening extra (`planner/planner-evening.mjs`) can start before the day's start plus its bag step.
- **A5 (hours).** The planner applies a place's own facts however old they are. `factsStale` (`facts/facts-check.mjs`: 90 days for facts, 30 for menus) is never called.

**Build.**
1. **A1.**
   - An unreachable hard end never throws. That day comes back without stops: its legs as far as they go (start → end point, passing `checkDayChain`), and the `over_long_day` alert.
   - The alert says by how much the day overruns and how to fix it (an earlier start with `/dates <date> hours …`), in at most 200 characters.
   - `solveDay` returns an empty result instead of throwing. The "no route" errors for a leg that neither Google nor the estimate can find stay as they are.
2. **A2.** An override whose end is not after its start is clamped:
   - the hard end is kept;
   - the start moves to two hours before the end, never before 00:00;
   - a `warn` warning on that day names the date, the values given and the fix.

   When the start is hard too (`start.time`), the day is planned without stops, with an `alert` that says so. Trip-level hours under two hours still fail (the core refuses them).
3. **A3.** A booked stop is never dropped for its time.
   - Its day's window widens to hold it: the start no later than the booking minus the start step and the leg to it, the end no earlier than the booking's end plus the leg back. An `info` warning names the new hours.
   - A hard end never moves. A booking that cannot finish before one goes to Later, with a reason naming that day and that end.
   - Every Later reason quotes the window of the day it names.
4. **A13.** A booking dated outside the trip goes to Later with code `other` and the text "<name> is booked for <date>, outside the trip's dates".
5. **A8.** On a day with a hard end, the last leg leaves as late as the end allows, keeping its margin. The spare time becomes free time near the last stop, before that leg.
   - For transit, re-time the leg with one request at its new departure, counted in the day's budget (as Phase 11 did for dinner).
   - For other modes, keep its minutes.
6. **A12.** An evening extra starts no earlier than the day's start plus its start step (the bag step on a moving day).
7. **A5 (hours).** Own facts older than `FACTS_MAX_AGE_DAYS` still apply, judged on the plan's day (the trip-zone date of `now`).
   - Each stop or dinner using them adds an `info` warning "facts are old: <name>, checked <date>".
   - The stop's `check_on_day` reads "Hours last checked <date> — check before you go", unless it already has a check line.
   - Call `factsStale` as it is. WP-13b adds an optional zone argument and keeps every existing call working.
- Old fixtures plan byte for byte as before unless a finding changes them; name the finding beside each changed expectation.

**Tests.** Write one test per item, each reproducing the fault first:
- **A1.** The whole trip builds. The last day has no stops, carries the alert and passes `checkDayChain`, and the other days are unchanged.
- **A2.** An override ending before it starts is clamped with its warning; with a hard start too, the day is empty with its alert. Neither throws.
- **A3.** A booking ending at the day's end, and one starting before the day's start, are both scheduled at their booked times with the warning. A booking past a hard end goes to Later, naming that day.
- **A13.** The booking dated outside the trip gets its code and text.
- **A8.** The departure day's last leg leaves as late as allowed, with free time before it and no spare note at the end point. The extra request is counted.
- **A12.** No extra starts before arrival.
- **A5.** Facts checked 100 days before `now` give the warning and the check line; 80 days give neither.
- An old fixture plans exactly as before.

## WP-13b — Planner: hours, facts, season, rail, dinner · `hb-builder-opus`

**Paths you own.**
- In `helpers/packs/tour-guide/planner/`: `planner-hours.mjs`, `planner-facts.mjs`, `planner-dinner.mjs`, `planner-rain.mjs` and `planner-rail.mjs`.
- `season/*`, `facts/*` and `estimator/*`.
- The schema `tour-guide-place.schema.json`, and in `schemas/tour-guide-checks.mjs` only `checkPlace`.
- New invented fixtures under `fixtures/p13b-*` and new tests `helpers/tests/pack_tour-guide_p13b_*.test.js`.
- The existing tests of these modules (the rail test among them), where a finding changes their behaviour.

**Evidence.**
- **A7.** `irregularText` (`planner/planner-hours.mjs`) tests `IRREGULAR_LINE_RE` against every Google weekday line. One line saying "hours might differ" (Google adds it to a holiday's line), "seasonal" or "check website" makes the whole place irregular. `hoursOn` never closes an irregular place, so a museum closed on Mondays is scheduled on a Monday.
- **B7.** A place's facts cannot say that its own site lists irregular or posted opening days, so research writes every weekday into `closed_weekdays`. `factsHours` then closes the place on every date, and `factsConflict` raises `closed_day`. The place-level `opening_days: "irregular"` (Phase 10) exists, but own `closed_weekdays` win over it in `factsHours`.
- **A14.** `rainSwaps` (`planner/planner-rain.mjs`) calls `hoursOn` without the irregular flag.
- **A9.** `rideMinutes` (`planner/planner-rail.mjs`) runs every ride between `INTERCITY_KM` and `SHINKANSEN_KM` at `REGIONAL_KMH` (75 km/h). A leg of about 85 km in a straight line comes to about 90 minutes, where a limited express with no high-speed line takes about two hours.
- **A6.** `BLOOM_MONTHS_NORTH` (`season/season-bloom.mjs`) gives roses months 5–10 and cherry 3–5, so a rose garden's autumn season (to November) and autumn-flowering cherries are screened out as out of season.
- **A4.** `prepareDinners` (`planner/planner-dinner.mjs`) drops only `menu.fits: 'no'`. A menu that was never checked, or is `unknown`, ranks and reads exactly like `yes`; only `partly` gets a note.
- **A5 (menus).** A menu checked months ago still counts as checked.
- **A15.** `dateOf` (`facts/facts-check.mjs`) takes the UTC day of a Date or a timestamp, so an evening check west of UTC counts as the next day.

**Build.**
1. **A7.** Irregular wording affects only its own weekday.
   - A line that says the hours vary makes that weekday irregular: never closed, with the known windows.
   - Every other weekday keeps its own status; a "Closed" line stays closed.
   - Map the lines to weekdays by Google's order (Monday first) or by the line's weekday name, and record which. Keep `irregularText` exported.
2. **B7 and the C13 facts fields.**
   - The place schema, `normalizeFacts` and `checkPlace` accept `facts.irregular` and `facts.irregular_note` at C13's bounds.
   - `placeFacts` returns `irregular` (true for `facts.irregular` or for the place's `opening_days: "irregular"`) and `irregular_note`.
   - For an irregular place, `factsHours` keeps own `closed_weekdays` only when they leave at least one weekday open; a list of all seven closes nothing. A date it would otherwise call closed or unknown becomes `irregular` with the known windows, as `hoursOn` does.
   - `factsConflict` and `ownHoursConflict` raise no `closed_day` for such a place.
   - `factsLines` adds "Opening days vary: <note>" only when `irregular` is set, so an old place's lines stay byte for byte the same.
   - The stop's check line becomes the place's `opening_note`, then `irregular_note`, then today's text. The coordinator wires `irregular_note` into the stop (WP-13a's `planner-input.mjs`) at the merge, so export what that needs.
3. **A14.** `rainSwaps` passes the place's irregular flag, and the facts' too, as the planner does.
4. **A9.** A ride between `INTERCITY_KM` and `SHINKANSEN_KM` is a conventional line.
   - Choose an average speed, or a curve, so that about 85 km in a straight line comes to 115–130 minutes with the waits.
   - Rides past `SHINKANSEN_KM`, and city rides, keep their numbers.
   - Record the figures and their source in your decisions file.
   - The existing calibration numbers stay. Change the rail test's "regional ~75 km/h" bound, with A9 named beside it.
5. **A6.** Roses stay in season through November. Cherry stays spring unless the place names an autumn-flowering cherry; that is in season from October to December. Add the words for it in English and in the local terms the module already uses.
6. **A4 and A5 (menus).** Within each existing rank (picks, Later, the rest), dinner places sort by menu, nearest first within each:
   - a current `yes`;
   - then a current `partly`;
   - then a menu that is `unknown`, missing, or checked more than `MENU_MAX_AGE_DAYS` before the plan's day.

   `no` stays excluded. The meal's note reads "<name> · menu not checked for <diet>" (the profile's `diet`, else "your diet") or "<name> · menu last checked <date>". A current `partly` keeps its note.
7. **A15.** `dateOf(now, timeZone?)` takes the local day in that zone; without a zone it is exactly as before. `factsStale(facts, now, timeZone?)` passes the zone through.

**Tests.** Write one test per item, each reproducing the fault first:
- **A7.** A place closed on Mondays whose other lines say "hours might differ" stays off a Monday and opens on Tuesday.
- **B7.**
  - A place with `facts.irregular` and all seven weekdays closed is planned, with its check line.
  - An irregular place closed on Mondays stays closed on Monday.
  - No `closed_day` conflict is raised, and the facts lines of an old place are unchanged.
  - The schema accepts both fields at their bounds, and rejects them past their bounds or as unknown keys.
- **A14.** The rain options call an irregular place's hours unknown, not closed.
- **A9.**
  - About 85 km comes to 115–130 minutes.
  - The long-distance high-speed test keeps its range.
  - The calibration fixtures are unchanged.
- **A6.**
  - A rose garden passes in November.
  - A cherry park fails in November unless it names an autumn cherry.
- **A4 and A5.**
  - Unchecked and stale menus rank after current ones within the same rank, and carry their notes.
  - A menu checked 40 days ago reads "menu last checked".
  - `no` stays excluded.
- **A15.** With a zone, an evening timestamp west of UTC gives the local date; without one, the result is as before.

## WP-13c — Core: stays, stale plans, messages, Scout's raw text and group · `hb-builder-opus`

**Paths you own.**
- `helpers/packs/tour-guide/gas/*`, the pack's `helper.json` and `README.md`, and `helpers/SPEC.md`.
- The schemas `tour-guide-plan-digest.schema.json` and `tour-guide-places-digest.schema.json`, and `schemas/index.mjs`. In `schemas/tour-guide-checks.mjs`, only the digest checks.
- `helpers/tests/harness/*`; the core, GAS, red-team and Scout-core tests; new tests `helpers/tests/pack_tour-guide_p13c_*.test.js`.
- In `live-site-pages/helper-app.html`, the Places screen only. Leave its version file and changelog alone; the coordinator bumps them.
- `helpers/core/*` only where a pack cannot do the job; say why in your decisions file.

**Evidence.**
- **B4 (core half).** `/lodging` (`gas/10_commands.js`) saves one text on the trip, `lodging: { text, nights? }`.
  - `tgTripUpdateOf` (`gas/22_people.js`) sends dates, hours, travellers and day overrides, but no lodging.
  - The research request carries that text as a single line (`tgCmdLodgingText`).
  - The WP-12r offer (`tgLgOffer`, `gas/26_lodging.js`) re-plans after a change, but nothing marks a stored plan stale.
- **A2 (messages).** `tgCmdDatesDay` refuses a `/dates <date> end …` that leaves under two hours with "at least two hours". It gives no hint that `hours` with an earlier start would make the end valid.
- **A10.** `tgOwnerTz` (`gas/21_sheets.js`) switches the owner's zone to the trip's at midnight of the first day in the trip's zone. The daily reminder (`tgBkSendDaily`, `gas/14_bookings.js`) can then go out twice in one home-zone day, before the flight.
- **A11.** `tgLines` (`gas/00_common.js`) cuts an over-long line by length, even inside an HTML tag or entity. Telegram refuses the message, and the plain fallback shows the tags or loses the links.
- **A16.** The pack's validators and the core's mirror may count kanji and emoji differently. There is no parity test.
- **Scout (core half).**
  - `tgScoutParse` (`gas/16_scout.js`) parses the owner's words with its own grammar.
  - An app scout writes its request text with an " (app)" suffix.
  - `/places` and the app list scouted candidates beside chosen places.

**Build.**
1. **Stays.**
   - **Add.** `/lodging <words> <first night> to <check-out>` adds a stay. Dates are `YYYY-MM-DD`, or whatever date words the core already accepts. A stored stay whose nights overlap the new one is replaced, and the reply names what it replaced.
   - **Remove.** `/lodging remove <first night>` removes one stay; `/lodging clear` removes them all.
   - **List.** `/lodging` alone lists the stays with their nights, the trip nights no stay covers, and any stay outside the trip's dates.
   - **Undated.** `/lodging <words>` behaves as today while no stay is set. With stays set, it explains the dated form and `clear` instead.
   - **Storage.** Stays are stored on the trip's lodging as `stays` plus `set_at` (ISO), keeping `text` and `nights` readable by old code. At most 12 stays of at most 200 characters each; hidden characters are stripped, and the text is escaped wherever it is shown. Every refusal is in plain words, and nothing is saved.
   - **Sending.** Once a stay is set, every kind that carries a `trip_update` sends `trip_update.lodging` (C13), the whole list. The research request's lodging line lists every stay with its nights, so the private repo's current pin still learns them.
   - `tgLgOffer` still fires after a change.
2. **Fingerprints and stale plans.**
   - **Stamp.** Every `plan` and `replan` request carries `lodging_fp` when the trip has lodging. Stamp it in one place, where requests are opened. Keep it with the request id as well, so that a digest answering the request can be matched without reading the mailbox.
   - **Store.** A `plan_digest` keeps its `lodging_fp`: the digest's own, else the one kept for the request it answers.
   - **Validate.** Both digest validators (the pack's and the core's mirror) accept `lodging_fp`, and the places digest's accept `scouted`. They still refuse unknown keys.
   - **The line.** When C13's stale rule holds, `/trip`, each planned day's card and the morning message show: "⚠️ This plan was built for different lodging. Rebuild it with `/replan <first stored date still to come> <why>`."
3. **A2 (messages).** Every `/dates` refusal about a day's length says how to make the day valid, with its date filled in: `/dates <date> hours 07:30 10:30`.
4. **A10.** The owner's zone becomes the trip's when the trip's first day starts (its day start, else 09:00, in the trip's zone), not at midnight. A daily reminder never goes out within 12 hours of the previous one.
5. **A11.** A line cut for length is cut only in its visible text.
   - Never inside a tag or an entity, and every opened tag is closed.
   - A link survives whole or is dropped whole.
   - Apply this wherever the core cuts HTML.
6. **A16.** Add a parity test. Every length bound the core's mirror enforces must give the same answer as the pack's validator for kanji, emoji (surrogate pairs) and combining marks at the bound. Fix whichever side differs.
7. **Scout's words.**
   - Every `scout` request's `text` is the owner's words as typed (`/scout …`). An app scout writes `/scout <what> in <where>`, with no suffix.
   - `tgScoutParse` only words the acknowledgement and fills the old fields (`query`, `where`, `destination`, `trip`) for the current pin. The engine's parse of `text` (WP-13d) is the one that counts.
8. **Scouted candidates.**
   - The Places tab gains `scouted` as a new last column; old rows read as not scouted.
   - `/places` counts scouted candidates and shows them as their own group: "🔎 Scouted, not chosen yet".
   - The app's Places screen shows the same group.
   - A place leaves the group when the next places digest no longer marks it.
9. **Docs and registries.** Update `helper.json`, the pack README, SPEC (C13 and the new `/lodging` forms) and the command help.

**Tests.**
- **`/lodging`.** Every form and every refusal: add, replace on overlap, remove, clear, list with uncovered nights, a stay outside the trip, too many, too long.
- **Requests.**
  - `trip_update.lodging` validates against the request rules.
  - A fixed input gives a fixed fingerprint. Record the test vector in your decisions file.
  - The research line lists every stay.
- **The stale line.** It shows in each of C13's three cases, and never otherwise.
- **Old data.** Old lodging, digests and Places rows display exactly as before.
- **Reminders.** The travel day gets one reminder.
- **HTML.** A line with ten links over the limit stays valid HTML.
- **Parity.** The parity test passes.
- **Red team.**
  - Hostile stay text.
  - An oversized stay list.
  - A forged `lodging_fp` in a digest.
  - A scout `text` carrying markup.
- **Scout.** The text from the chat and from the app is as typed.

## WP-13d — Scout engine: been before, city days, one grammar, the vegetarian flag, own names · `hb-builder-opus`

**Paths you own.**
- `helpers/packs/tour-guide/scout/*`.
- `schemas/tour-guide-scout.schema.json` and the Scout checks in `schemas/tour-guide-checks.mjs`.
- A new dated section appended to `helpers/decisions/TG-SCOUT.md`.
- New invented fixtures under `fixtures/p13d-*`; the Scout engine tests; new tests `helpers/tests/pack_tour-guide_p13d_*.test.js`.

Keep the envelope schema unchanged unless a fix needs it. The core's mirror belongs to WP-13c, so anything the core must accept is a REQUEST.

**Evidence.**
- **Fault 8.** The private start driver knows which candidates are already in the owner's Places, but the engine has no input for it and never sets `seen_before`, although the label exists in the schema, the board and the chat.
- **Fault 9.** `tripHours` (`scout/scout-board.mjs`) shows at most seven dates. The closed-on-your-days screen and penalty (`screenReason`, `rankScout`) use every trip date, including dates spent in another city.
- **Fault 11, and the second reviewer's case.** `parseScoutText` (`scout/scout-text.mjs`) and the core's `tgScoutParse` disagree at the edges. "<what> near <area>, <city>" leaves no way to tell the area from the city, so the private driver files the picks under the area.
- **B11.** `screenReason` and the labels count Google's `servesVegetarianFood` alone as vegetarian-likely, even for a party whose diet has a hidden-stock rule (fish stock in a broth, for example).
- **B9 (Scout).** `scoutPlaceFields` (`scout/scout-payload.mjs`) writes Google's display name into `places/` as the place's name, though the repo stores only Google's place id.

**Build.**
1. **Been before.** `rankScout` and `scoutPayload` take `known` (the place ids already in the owner's Places) and label those picks `seen_before`.
2. **City dates.** An optional `city_dates` lists the dates the owner is in the searched city. When it is given:
   - the board's hours show every one of those dates, with no seven-date cap; consecutive dates with the same hours share a row;
   - the closed-on-your-days screen and penalty use only those dates.

   Without it, today's behaviour stays (the trip's dates), minus the seven-date cap.
3. **One grammar.** `parseScoutText` strips a leading `/scout`, covers every case `tgScoutParse` handles, and returns `{ what, where, city, area }`:
   - "<what> near <area>, <city>": the city is the last comma part, the area the rest;
   - "<what> in <city>", "<what> @ <city>" and "<what>, <city>" name the city alone;
   - "<what>" alone leaves the place empty.

   Record the grammar in `TG-SCOUT.md`.
4. **B11.** `rankScout` takes the party's `diet_rule` (the profile's hidden-stock rule, a string or absent).
   - With a rule, Google's flag alone no longer passes the food screen or earns `veg_likely`. Such a pick is left out as `diet_unproven`: "vegetarian not confirmed".
   - A pick whose topic is a café word (`CAFE_WORDS`) keeps today's behaviour. The owner approved a later item that reworks drinks, sweets and cafés; do not build it here.
   - Without a rule, nothing changes.
5. **B9 (Scout).**
   - A pick's place file takes its name from the judgment's own `name`: the place's name in the skill's words, from the place's own site or a local source, at most 120 characters. It never takes Google's name.
   - `scoutPlaceFields` returns `{ place: null, reason: 'no_own_name' }` for a pick without an own name. Such a pick is not written to `places/`, and the private driver counts these picks in its log.
   - A payload item's `name` is the own name when the judgment gives one, else Google's name as today (shown for that board only).

**Tests.** Write one test per item:
- **Been before.** A known place carries `seen_before`.
- **City dates.**
  - Ten city dates all show hours on the board, with identical days grouped.
  - A place closed only on a date in another city is not penalised.
- **Grammar.** A table of cases, including the `/scout` prefix and "<what> near <area>, <city>".
- **B11.** With a rule, without one, and the café exception.
- **B9.** An own name is saved as the place's name; a pick without one is not saved, with its reason.

## Coordinator — merge, probe, push, then the private repo

1. **Merge.** Squash-merge `wp-13a`, `wp-13b`, `wp-13c` and `wp-13d`, in that order, into this session's `claude/*` branch, rebased on `origin/main`.
   - Resolve conflicts by ownership.
   - Run the three checks after each merge.
   - Act on each REQUEST.
   - Check every test a builder changed outside its own paths.
2. **Wiring at the merge.**
   - WP-13b's `irregular_note` reaches the stop's check line in `planner-input.mjs`, after the place's `opening_note` and before the default text, with a test.
   - A parity test runs the core's acknowledgement parse and the engine's grammar on the cases both handle.
3. **The probe** (row P), on invented data in a zone far from UTC.
   - **The trip.** A four-day trip with two stays, and a departure on its last day too early to fit. Day 2 has a booking at its edge; the trip also has an irregular place and a dinner place whose menu was never checked.
   - **The plan.** The trip builds. The last day comes back empty with its alert; the booking is kept with its warning; the irregular place is planned with its check line; the dinner carries its caveat.
   - **Through the core.** Turn the plan into a digest (the Phase 12 end-to-end test's `digestOf`), pass it through the envelope handler and store it. Change a stay: the stale line shows on `/trip`, the day card and the morning message. A `replan` request carries the new fingerprint, and the digest that answers it clears the line.
   - **Scout.** A scout from the chat and one from the app carry the owner's words. The engine files "<what> near <area>, <city>" under the city.
4. **The push.** Do the bookkeeping per `CLAUDE.md` in the single push commit:
   - the repo version;
   - the CHANGELOG with the owner's prompt, personal details redacted;
   - the README timestamp, and tree entries for new files;
   - `helpers/BUILD-STATE.md` (row 13 and a log entry);
   - `helpers/decisions/TG-PHASE-13.md`;
   - the helper app's version file, meta tag and page changelog, if WP-13c changed the page.

   Push, then confirm that **Deploy helper** and `helpers-dist` ran.
5. **The private repo** (WP-13p: the coordinator or one `hb-builder-opus` in a private worktree, and one pull request for the owner).
   - Re-pin with `/update-helpers`.
   - **Stays.** The trip update applies `trip_update.lodging` together with the dates.
     - A refusal names the nights no stay covers, in plain words.
     - A new or changed stay is located once and counted on the Maps ledger.
     - The owner's stay text is kept in the private trip file only.
   - **Trip research.** It re-locates a stay whose text changed.
   - **Plan-days.** It copies `lodging_fp` and answers with `in_reply_to`.
   - **The trip check.** It flags a plan built for other lodging.
   - **Scout's drivers.**
     - They pass `known`, `city_dates`, `diet_rule` and own names.
     - They take the city from the engine's parse.
     - They match a city against the trip's stays and day towns.
   - **The places digest.** Its builder sets `scouted`.
   - **The private findings.** B12, B14, B17 and B18, and the Google-content cleanup.
   - **The owner's data pass** (item 8) rides the same pull request.
   - Dry runs on invented fixtures leave `log/` clean.
6. **After the owner merges.**
   - One re-plan of the day the data pass changed.
   - Then the Phase 12 rehearsal: `/morning <date>`, running late 30, and `/checkin <date>`.
   - Record each result in `helpers/decisions/TG-PHASE-13.md` and BUILD-STATE row 13.

## Rules (every WP)

- **Public repo.** Never commit names, places, dates, hotels, ids, e-mail addresses, phone numbers, or anything from the private repo or the review. Fixtures are invented: invented cities, places, dates, zones, stations and menus.
- **Own paths only.** Edit only the paths you own. Anything else is a REQUEST line in your status file (file, change, why).
  - `fixtures/index.mjs` and the shared fixture loaders are nobody's this phase: load your new fixtures from your own tests.
  - An export you need from another WP's `index.mjs` is a REQUEST; meanwhile, import from the module directly.
- **Tests outside your paths.**
  - Never edit a test that another WP of this phase owns.
  - A test that no WP of this phase owns (an end-to-end test, or an earlier phase's) may be updated only when it breaks because of a change a finding asks for. Mark each changed assertion with the finding id, and list the test in your status file.
  - Never weaken a test to make it pass.
- **Off limits.** Never push and never commit to `main`.
  - Never touch `.github/workflows/`, `repository-information/`, the root `README.md`, `helpers/BUILD-STATE.md`, `helpers/prompts/` or `live-site-pages/`. The exception is WP-13c's Places screen in `helper-app.html`, without its version file or changelog.
  - Only WP-13c touches `gas/` and `helpers/core/`. The coordinator does the bookkeeping.
- **Backward compatible.** The core deploys on the push, and the private repo stays on its current pin until its pull request merges. Everything the old code wrote must still load and display: every row, envelope, digest, plan and request. The old pin's payloads must still validate.
- **No network** except recorded fixtures: no live Google, Telegram, Drive, Open-Meteo or Claude API calls, and no package installs.
  - `/mnt/project-files` is read-only to you. Read the review there for context if you need it; copy nothing personal from it.
- **Commits and records.** Commit to your worktree branch as you go: small commits, plain messages without a version prefix, each ending with the session's attribution trailer.
  - Keep `helpers/status/WP-13x.md` current after each step (done, next, REQUESTs), with your own letter for x.
  - Record every default you pick, with its reason, in `helpers/decisions/WP-13x.md`.
  - `Developed by: LightAISolutions` is the last line of every new file.
- **Real tests.** Tests verify real behaviour (the `CLAUDE.md` test-quality rule): call the real function with controlled input and check its output or side effect.
- **When you finish,** the three checks are clean in your worktree. Your last message says:
  - what you built;
  - what you decided;
  - every REQUEST;
  - every test outside your paths that you changed.


Developed by: LightAISolutions
