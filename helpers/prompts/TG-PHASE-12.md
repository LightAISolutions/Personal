# Phase 12 — Usefulness pass, step 3: the morning message, "running late", re-plans from where you are, the evening check-in, and a rehearsal

> Written 2026-10-03 by the coordinator of the owner's usefulness review, at the end of Phase 11. This phase is the review's **step 3**: suggestion 9 (a morning message, a "running late" button and re-plans that start from where you are) and suggestion 10 (a two-tap evening check-in), then a rehearsal of one trip day, all before the owner's trip. Model rule (owner, 2026-10-03): coordinator Opus 5.5, builders `hb-builder-opus` (Opus 5.5 · high), **no Fable anywhere**. Start with `Read helpers/prompts/TG-PHASE-12.md and execute it exactly.` Progress in `helpers/BUILD-STATE.md`.

Phases 10 and 11 made a planned day right and worth having. Step 3 makes it work on the day, on a phone, often without signal. Today nothing arrives on a trip morning unless the owner asks: `/today` shows the day card on request, and the only message the core sends on its own is the booking reminder (alarm `tg_bookings`, `gas/14_bookings.js`). Every change runs as a routine, which takes minutes and uses the owner's Claude usage. A re-plan rebuilds the whole day from the lodging at the day's start, even at 2 pm: `/replan` sends `{ trip, dates, deliverables, reason }` (`gas/10_commands.js`) and `replanDays(plan, dates, input)` (`planner/index.mjs`) takes dates, not a time or a place. The only feedback is the post-trip `/review`, days after each stop has faded. And the digest lacks what a day on foot needs: the name in the local script and the address (to show a taxi driver or match a sign), the stations at both ends of a train leg (to save the route in a timetable app), what to pay in cash (`facts.payment` reaches only `price_line`, which the chat card leaves out), and when to leave (the plan's legs carry `depart_at`; the digest's legs do not).

The phase runs as **one wave**: two framework work packages in parallel, WP-12a (planner and contracts) and WP-12b (core), each in its own worktree, both started from `origin/main` **after Phase 11's wave-2 push** (WP-12b's paths overlap WP-11f's). The coordinator merges them, adds the rehearsal test, fixes the brochure's phone clock, pushes once, opens the private repo's PR (WP-12c) and then rehearses a trip day with the owner.

## Done when (the owner's criteria, generalised for this public repo)

| # | Suggestion | Done when |
|---|---|---|
| 9a | Morning message | On each trip morning, unasked, one Telegram message carries the whole day: each stop with its name in the local script, its address and its last entry; the day's bookings; the weather with its source; what to pay in cash; when to leave; and, for each train leg, the stations at both ends. It reads in full with the phone in airplane mode, and it costs no Claude usage |
| 9b | Running late | At 1 pm trip time, "running late 30" moves the rest of the day within seconds, drops what no longer fits (past its own last entry or closing time, past a booked dinner, past the day's end) and says why; Undo restores the day; no Claude usage |
| 9c | Re-plans from where you are | A re-plan of today starts at the current stop (or at a location the owner shares) at the current time, keeps the stops already visited, and a rain re-plan fills the rest of the day with indoor and covered places first |
| 10 | Evening check-in | Each trip evening one message lists the day's stops with 👍 or 👎 and "longer / about right / shorter"; a day's taps take under a minute; the post-trip `/review` skips stops already rated and still sends one set of ratings |
| R | Rehearsal | A test plays one full trip day through the bot in the trip's zone (the morning message, running late at 1 pm, a re-plan from the current stop, the evening check-in, the post-trip review), and the owner can try the same day on the phone before the trip (`/morning <date>`, `/checkin <date>`) |

## Contract C12 — new optional fields

Every field is optional, so old trips, places, digests, requests, the private repo's old pin and the live core keep working. Bounds are exact: a validator accepts a field only with the type and limits below, and still rejects unknown keys. Times are `HH:MM` in the trip's zone, dates `YYYY-MM-DD`.

**Inputs** (trip and place memory, the planner's input and the core's requests):

| Where | Field | Type | Meaning |
|---|---|---|---|
| place `facts` | `local_name` | string 1–80 | The place's name in the local script, as its own site writes it |
| place `facts` | `address` | string 1–160 | The address as the place publishes it (the local script allowed) |
| place `facts` | `access` | array ≤ 2 of `{ station 1–60, line? 1–60, exit? 1–20, walk_minutes? 0–60 }` | How the place's own site says to reach it by train |
| trip lodging | `access` | as facts `access` | The lodging's own access note (its site or the owner's booking) |
| trip lodging | `area` | string 1–60 | The town or city the lodging is in, in plain words: the weather's place and the morning header |
| trip | `country_code` | string matching `^[A-Z]{2}$` | ISO 3166-1 alpha-2 of the destination, for the weather lookup |
| planner input, `replan` request | `from` | `{ time, place? (slug), point? { lat, lng } }`, exactly one of `place` and `point` | Where and when a re-plan of today starts |
| planner input, `replan` request | `visited` | array ≤ 25 of slugs, in visit order | That day's stops already done; kept as they were |
| planner input, `replan` request | `rain` | `true` | Fill the rest of the day with indoor and covered places first |

**Outputs** (the DayPlan and the `plan_digest` use the same names where both have a field):

| Where | Field | Type | Meaning |
|---|---|---|---|
| DayPlan day, digest day | `leave_by` | time | The departure of the day's first leg (from the lodging or the day's start) |
| DayPlan day, digest day | `areas` | array 1–2 of string 1–60 | The morning lodging's `area`, then the night lodging's when it differs (a moving day) |
| DayPlan stop, digest stop | `visited` | `true` | Kept from before a re-plan from the current time |
| DayPlan leg, digest leg | `from`, `to` | may also be the reserved slug `here` | A re-plan that started from a shared location |
| digest top | `country_code` | as on the trip | The weather lookup's country |
| digest stop | `local_name`, `address`, `payment`, `close` | strings ≤ 80, ≤ 160, ≤ 80; a time | From the place's own facts; `close` and `last_entry` drive "running late" |
| digest leg | `stations` | `{ from 1–60, to 1–60, from_line? 1–60, to_line? 1–60 }`, on a train leg only | The stations at both ends, from own access notes only |

**Stations come from own research only.** The planner's train estimates name their stations from Google's station places (`planner/planner-rail.mjs`), and the Maps terms do not let us store Google content beyond place ids (and coordinates for 30 days). So a digest leg's `stations` are built only from the two ends' own `access` notes, or from a day start or end the owner named; a leg whose ends have no access note has no `stations`, and the morning message says to use the route link.

**Who does what.** WP-12a owns the trip, place, DayPlan and Plan schemas, `normalizeFacts` for the three new facts fields, `checkTrip`, `checkPlace`, `checkDayPlan` and `checkDayChain`, and the planner. WP-12b owns the digest schema and its checks in both validators, storage, the requests the core sends, and every Telegram behaviour. Each builds against these tables with its own invented fixtures; the coordinator's rehearsal test joins them; the private repo fills and maps the fields after the push (WP-12c).

## Step 0 — Orient (every WP)

1. Read `CLAUDE.md`, `helpers/SPEC.md` (§5 registries, §16 ownership map, §18 limits), `helpers/packs/tour-guide/README.md`, `helpers/decisions/TG-PHASE-10.md`, `TG-PHASE-11.md`, `WP-11a.md`, `WP-11c.md` and `WP-11f.md`, Contract C12 above, and every file your section names. Name functions when you cite code; line numbers moved in Phase 11.
2. In your worktree run `node --test helpers/tests/`, `node helpers/tools/bundle.mjs --all --check` and `node helpers/tools/boundary-check.mjs`. All three must be clean before you start; if not, stop and write why in your status file.

## WP-12a — Planner and contracts: when to leave, the day's town, re-plans from where you are · `hb-builder-opus`

**Paths you own.** `helpers/packs/tour-guide/planner/*`, `estimator/*`, `facts/*`, `fixtures/*` (add invented fixtures: places with local names, addresses and access notes, lodging with access and an area, a day re-planned at midday); the schemas `tour-guide-trip.schema.json`, `tour-guide-place.schema.json`, `tour-guide-day-plan.schema.json` and `tour-guide-plan.schema.json`; in `schemas/tour-guide-checks.mjs` only `checkTrip`, `checkPlace`, `checkDayPlan` and `checkDayChain` (add any helper next to them); the planner and facts tests; new test files.

**Evidence.** `replanDays(plan, dates, input)` (`planner/index.mjs`) rebuilds a whole day from its morning lodging at its start time, so a re-plan at 2 pm schedules the morning again. The day's first departure exists only as `legs[0].depart_at`. Place facts have no local name, address or access note (`tour-guide-place.schema.json`, `facts`), and a lodging has an `address` but no access note or town (`tour-guide-trip.schema.json`, `lodging`). Rainy-day swaps already know which places are covered (`isIndoor` and `isCoveredSight`, `planner/planner-rain.mjs`).

**Build.**
- Schemas: every C12 input and output above, with its exact bounds; `normalizeFacts` accepts and bounds `local_name`, `address` and `access`; `factsLines` is unchanged (an old place's lines stay byte for byte the same). `checkTrip` keeps a lodging's `access` within its bounds; `checkDayPlan` and `checkDayChain` accept `visited` stops and the reserved slug `here`.
- `leave_by` on every day that has a first leg: that leg's `depart_at`.
- `areas`: the morning lodging's `area`, then the night lodging's when the two differ; absent when the lodging has no `area`. A day override's `start` or `end` does not change it.
- Re-plan from where you are: `replanDays(plan, [date], { ...input, from, visited, rain })` for one date. The `visited` stops, in their order, keep their times, legs and fields and carry `visited: true`; the rest of the day is planned from `from.place` (that place's own coordinates from its snapshot) or from `from.point` (the reserved slug `here`; its name is "where you were", never an address) at `from.time`, under the day's end, dinner and Phase 10–11 rules as before; a visited place is never scheduled again that day; a place the core had dropped for running late is a candidate again. With `rain`, the rest of the day takes covered places (`isCoveredSight`) and indoor meals first, outdoor ones only when nothing covered fits, and the day's `rain_swaps` are left out. What no longer fits goes to the Later list with its reason. Without `from`, `replanDays` behaves exactly as before. Count any extra route requests against the day's budget, as Phase 11 did for dinner, and record it.

**Tests.** Every new schema field accepted at its bounds and rejected past them or as an unknown key; an old trip, place and plan still validate. `leave_by` equals the first leg's departure; `areas` on a normal day, a moving day and a day without areas. A midday re-plan keeps the visited stops verbatim, starts from the given place or point at the given time, never repeats a visited place, honours the day's end and dinner, and passes `checkDayChain`; with `rain` the rest of the day is covered places first; a re-plan without `from` is byte for byte today's. An old fixture plans exactly as before.

## WP-12b — Core: the morning message, running late, re-plan from here, the evening check-in · `hb-builder-opus`

**Paths you own.** `helpers/packs/tour-guide/gas/*`, the pack's `helper.json` and `README.md`, `helpers/SPEC.md`, `tour-guide-plan-digest.schema.json`, `schemas/index.mjs` and, in `schemas/tour-guide-checks.mjs`, the digest checks only (WP-12a owns `checkTrip`, `checkPlace`, `checkDayPlan` and `checkDayChain`), `helpers/tests/harness/*`, the core and GAS tests, the schema and payload tests for the digest, new test files. `helpers/core/*` only where a pack cannot do the job; say why in your decisions file. Not `live-site-pages/`: this phase changes no page.

**Evidence.** On a trip day the only message the core sends unasked is the booking reminder (`tgBkSendDaily`, alarm `tg_bookings`, `gas/14_bookings.js`). The day card goes out only on request (`/today` → `tgCmdDayMessages`, `gas/10_commands.js`). There is no weather anywhere. The core holds no Maps key and calls no Google service; keep it that way. `/replan` re-plans whole dates through a routine. The only feedback is the post-trip review (`gas/13_flow_review.js`, Choices run `review`, codes in `TG_RV_RATING` and `TG_RV_CAL`), offered by the daily job `tg_review_offer`. Its start clears earlier taps (`tgChoiceClear`), and its end sends one `prefs` request `{ review: { trip, items: [{ slug, rating, calibration? }] } }`. No code pins a message or asks for a location yet; `tgApi` passes any Bot API method.

**Build.**
1. **C12 in the digest.**
   - The digest schema and both digest validators (the pack's and the core's mirror) accept C12's output fields at their exact bounds and still refuse unknown keys. Storage keeps the new fields. An old digest reads exactly as before.
   - Every string from a digest is escaped (HTML parse mode); every link must be https.
2. **Weather from Open-Meteo, the core's only new outside call.**
   - Record in your decisions file what the coordinator checked on 2026-10-03:
     - free for non-commercial use (this one-owner helper qualifies);
     - under 10,000 calls a day, 5,000 an hour and 600 a minute;
     - no key;
     - data under CC BY 4.0, credited as "Weather data by Open-Meteo.com" with a link to https://open-meteo.com/;
     - its geocoding names come from GeoNames, also CC BY 4.0.
   - **Place.** Look up each name in the day's `areas` with `https://geocoding-api.open-meteo.com/v1/search?name=<area>&count=5&language=en&format=json&countryCode=<country_code>` and take the first result.
     - Cache each place's coordinates in Settings, keyed by country and name. These are GeoNames data, not Google content.
     - `/dates <date> weather <town>` names the town for one date (the owner's words, ≤ 60 characters); `/dates <date> weather clear` removes it. This setting stays in the core: it is not a `day_overrides` field and never goes to the brain.
   - **Forecast.** Call `https://api.open-meteo.com/v1/forecast?latitude=…&longitude=…&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&hourly=precipitation_probability&timezone=<trip zone>&start_date=<date>&end_date=<date>`.
     - Write one line per area, like `☀️ Clear, 9–17 °C (48–63 °F) · rain 10%` or `🌧 Rain likely from 15:00, 8–12 °C (46–54 °F) · rain 80%`.
     - WMO codes map to a few plain words and one emoji.
     - "Rain likely from HH:00" names the first hour that reaches your recorded threshold.
     - A moving day shows both areas.
   - **Limits.** At most one forecast per area per date, cached until the date ends; record the calls per trip day (expect about 4).
     - The forecast reaches 16 days ahead, so a rehearsal of a later date says "forecast not available yet".
     - A failed call, an unexpected answer or a missing `country_code` or `areas` drops the weather line, never the message.
     - Validate the answer's shape and treat its strings as data.
   - **Answer shapes, recorded by the coordinator on 2026-10-03.** Build your test fixtures to these shapes, with invented places and values; tests never call the service.
     - Geocoding answers `{ results: [{ id, name, latitude, longitude, elevation, feature_code, country_code, admin1, timezone, population?, … }], generationtime_ms }`. With no match, `results` is absent.
     - The forecast answers `{ latitude, longitude, timezone, utc_offset_seconds, daily_units, daily: { time: [date], weather_code: [n], temperature_2m_max: [°C], temperature_2m_min: [°C], precipitation_probability_max: [%] }, hourly_units, hourly: { time: ['YYYY-MM-DDTHH:00' × 24], precipitation_probability: [% × 24] } }`.
     - A date outside the forecast window gets HTTP 400 with `{ error: true, reason: "Parameter 'start_date' is out of allowed range from <date> to <date>" }`. The window ran from about three months back to 15 days ahead.
     - One forecast call took over 20 seconds before answering: Apps Script cannot shorten a fetch's timeout, so make the alarm survive a slow or failed call.
3. **The morning message** (alarm `tg_morning`).
   - **When.** On each date of a trip in progress, in the trip's zone.
     - Send at the owner's morning time (default 07:00, `/morning at HH:MM`), or 30 minutes before `leave_by` when that is earlier. Never before 05:00.
     - Once per date: mark a date sent only when every send succeeded, as `tgBkSendDaily` does.
     - `/morning off` and `/morning on` (default on).
     - A date with no stored digest gets nothing.
   - **What, in this order.**
     - The date, "Day n of m" and the `areas`.
     - "Leave by HH:MM".
     - The weather lines and their credit link.
     - 💴 What to pay in cash: each stop's and the dinner's `payment` and `price_line`, only where present.
     - The day's bookings (`tgBkDayLines`).
     - Each stop: its time (in its `time_style`), name, `local_name`, `address`, "last entry HH:MM", `check_on_day` and a map link.
     - 🚆 For each train leg: "from <station> (<line>) to <station> (<line>)". A train leg without `stations` shows "use the route link".
     - Dinner: name, local name, address and booking line.
     - Sunset.
     - A free day (no stops) gets the date, the weather, the bookings and "Free day".
   - **Keyboard and delivery.**
     - The keyboard: ⏰ Running late 15 · 30 · 60 and 📍 Re-plan from here.
     - A long day splits at `TG_SPLIT_AT` like the day card, with the keyboard on the last chunk.
     - Pin the first chunk without a notification and unpin the previous morning message. A failed pin or unpin is logged and ignored.
   - **`/morning [date]`** sends that date's message now. Today's is the real one and counts as sent. Any other date is a rehearsal, headed "Rehearsal", never pinned and never marked sent.
   - It costs no Claude usage: it reads only what the core has stored.
4. **Running late** (`/late <minutes>`, 5–240, and the buttons).
   - **What moves.** At the tap's trip time, every stop, meal and leg of today that has not ended moves later by that many minutes; taps add up.
     - Fixed items stay put: a dinner or other timed entry in the core's bookings, and the day's own end (`end.time`, such as a departure).
   - **What drops.** A moved stop is dropped when it now starts after its own `last_entry`, ends after its own `close`, or (counting the leg's minutes to it) runs into a fixed item or past the day's end. The reason is named, for example "last entry 16:30", "your 19:00 dinner booking" or "the 17:30 departure".
     - A dropped stop frees its time; nothing moves earlier.
     - A stop without its own times keeps its slot with "check the hours".
     - A leg that now joins two stops that were not neighbours shows its stations when both ends have them, and "travel time not recalculated".
   - **Storage.** Keep the result as an overlay next to the stored day, never as a change to it; pick where and record it.
     - `/today`, the day card and the evening check-in show the day with the overlay.
     - ↩️ Undo removes the overlay. A new digest for that date (a re-plan) clears it.
   - **The reply** lists the moved day and the dropped stops with their reasons, with ↩️ Undo and 📍 Re-plan from here.
   - **Other dates.** On a date other than today it is a rehearsal: shown, headed "Rehearsal", not saved. The time of day now, in the trip's zone, stands in for the tap's time.
5. **Re-plan from here** (📍, today only, while the trip is in progress).
   - **The question.** One message asks where to start:
     - 📍 From <the current stop>: the stop the day (overlay included) has the owner at, or the last one started;
     - Share my location: a one-time reply keyboard button with `request_location`;
     - ☔ Rain: indoor places first, from the current stop;
     - Cancel.
   - **The request.** A `replan` request with `dates: [today]`, the deliverables `/replan` sends, and C12's new fields:
     - `from`: `{ time: now, place }`, or `{ time: now, point: { lat, lng } }` for a shared location;
     - `visited`: the slugs of the stops ended by now, in order, plus the current stop when starting from it;
     - `rain: true` when chosen.
   - **A shared location** serves that one request only.
     - Never store it in Settings, a sheet, the audit log or a reply. Check that the router's logging does not keep it.
     - A location that arrives when no re-plan is waiting is ignored without a word.
     - Remove the reply keyboard afterwards (`remove_keyboard`); also on Cancel and when the wait times out (pick and record the time).
   - **The confirmation** says the re-plan runs in the background and the day card updates when it is ready.
   - **Old pin.** Until the private repo's Phase 12 update merges, its routine reads only `trip`, `dates`, `promote`, `demote`, `reason` and `trip_update`, so it re-plans the whole day. Say so in SPEC and the pack README.
6. **The evening check-in** (alarm `tg_checkin`).
   - **When.** On each trip date with stops, at 21:00, or 15 minutes after the day's planned end (overlay included) when that is later, but never after 22:30.
     - Once per date.
     - `/checkin [date]` sends it now. On another date it is a rehearsal whose taps are not saved.
   - **The message** lists the day's stops, numbered, leaving out dropped ones.
     - One keyboard row per stop: its number, 👍 👎 ⏭, then ⏩ needed longer, 👌 about right, ⏪ less was fine. Use the review's codes.
     - ✅ Done.
     - A tap edits the message in place and ticks the chosen buttons.
   - **Taps** are stored as Choices run `checkin` per trip, date and slug; the latest tap wins. At most two taps per stop.
   - A check-in sends no request and never marks the trip done.
7. **The review uses the check-ins.**
   - `/review` and `tg_review_offer` skip stops already rated in a check-in.
   - When every stop is rated, the review offers 📨 Send my ratings (one tap) or Review again (every stop, keeping check-in answers until changed).
   - Starting a review no longer clears check-in taps.
   - Finishing sends one `prefs` request in today's shape. Its `items` merge both sources, and the review's answer wins for a stop rated twice. The private repo needs no change for this.
8. **Registries and docs.**
   - Register the alarms `tg_morning` and `tg_checkin`, and the commands `/morning`, `/late`, `/checkin` and `/dates … weather`.
   - Callback prefixes: check what `gas/*.js` uses after Phase 11 (`ol` and `dv` are new; `rl`, `rp` and `ci` look free). Keep every encoding within 64 bytes at the longest trip key `tgCmdTripKey` allows, and test the worst case.
   - Settings keys, the new request fields and your `TG_…` limits.
   - Update `helper.json`, SPEC §5, §16 and §18, and the pack README.

**Tests.**
- **Alarms.** Each fires once per date at the right trip-local time (`__TEST_NOW`, a zone far from UTC).
- **The morning message.**
  - Its content with a weather fixture and with a failed weather call.
  - The credit link is present and escaping holds.
  - A long day splits, with the buttons on the last chunk.
  - Pin and unpin, including a failed pin.
  - A free day.
  - A rehearsal is neither pinned nor marked sent.
- **Running late.**
  - The moves and each drop reason.
  - A fixed dinner and a fixed departure stay put.
  - Undo works, and a new digest clears the overlay.
  - A rehearsal is not saved.
- **Re-plan from here.**
  - The request's fields for each choice.
  - A location's path: used once, kept nowhere, keyboard removed, and a stray location ignored.
- **The check-in.**
  - Taps are stored and edited in place.
  - A rehearsal saves nothing.
  - The review skips rated stops, "Send my ratings" works, and the merged payload validates as today's `prefs` request.
- **Compatibility.** An old digest and an old trip behave exactly as before.
- **Red team.** Hostile strings in names and addresses; a forged or oversized callback; a location from another chat.

## Coordinator — merge, rehearse, push, then the private repo

1. Squash-merge `wp-12a`, then `wp-12b`, into this session's `claude/*` branch, rebased on `origin/main`. Resolve conflicts by ownership, run the three checks after each merge, and act on each REQUEST.
2. **The rehearsal test** (row R), on invented data in a zone far from UTC: one trip day played through the bot.
   - Plan an invented trip with a moving day, access notes and local names (WP-12a's fixtures). Turn its digest into the private repo's shape (extend the Phase 11 end-to-end test's `digestOf` for C12, stations from access notes only), pass it through the envelope handler and store it.
   - At 06:59 trip time on day 2, `tg_morning` sends the morning message, using a recorded weather fixture.
   - At 13:00, running late 30 drops a stop with its reason; Undo; then running late 30 again.
   - A re-plan from the current stop writes a request. Feed its `from` and `visited` to `replanDays`; the new digest keeps the visited stops and clears the overlay, and the day card shows it.
   - At 21:00 the check-in is sent and its taps go to Choices.
   - After the trip, `/review` skips the rated stops and sends one `prefs` payload that validates.
3. **The brochure's phone clock.** On a 390 px phone, the clock beside a numbered stop badge is cut short ("10:00a"), in old plans too (found by WP-11d, carried here from Phase 11 §7).
   - Fix it in the brochure kit and update the pinned old-HTML hashes deliberately, saying why in the test.
   - Read screenshots at 390 px and on A4 before and after.
   - **Phase 11's other carried items** (`TG-PHASE-11.md` §7): Later reasons and the "Taken off the plan" note with the day's name instead of `YYYY-MM-DD`; a booking with no date shown on the day its place is planned; the rehearsal checks that the trip record spans the whole journey (reminders follow the home zone until a trip is in progress); a lodging change offering to re-plan the days it touches. Fix those that are small after the merge, say so in the CHANGELOG when old output moves, and record the rest in `TG-PHASE-12.md` §7.
4. **The push.** Do the bookkeeping per `CLAUDE.md` in the single push commit:
   - the repo version;
   - the CHANGELOG with the owner's prompt, personal details redacted;
   - the README timestamp and tree entries for new files;
   - `helpers/BUILD-STATE.md` (row 12 and a log entry);
   - `helpers/decisions/TG-PHASE-12.md`.

   Push, then confirm that **Deploy helper** and `helpers-dist` ran.
5. **The private repo** (WP-12c: the coordinator or one `hb-builder-opus` in a private worktree; a pull request for the owner).
   - Re-pin with `/update-helpers`.
   - The digest builder maps C12. A train leg's `stations` come only from the two ends' own access notes (a place's `facts.access`, the lodging's `access`) or a day start or end the owner named, never from the planner's rail estimates.
   - Place research fills `local_name`, `address` and `access` from each place's own site for scheduled stops and dinner places, with sources, through `normalizeFacts`.
   - Trip research writes the lodging's `access` and `area` (from the owner's booking or the lodging's own site) and the trip's `country_code`.
   - `plan-days` answers a re-plan with `from`, `visited` and `rain`. A shared point is used only for routing and is never written to `trips/`, `places/`, `log/` or the reply.
   - A second ratings request for the same trip replaces the first, stop by stop, instead of adding to it.
   - Dry runs on invented fixtures leave `log/` clean.
   - Seed nothing the owner has not said.
6. **The rehearsal with the owner, before the trip.** Ask the owner to merge WP-12c's pull request first. Then:
   - `/morning <a trip date>`, read with the phone in airplane mode;
   - running late 30 on it;
   - `/checkin <a trip date>` and a few taps.

   The re-plan from here needs a real trip day, so it is checked on the first morning of the trip. Record each result in `helpers/decisions/TG-PHASE-12.md` and BUILD-STATE row 12.

## Rules (every WP)

- **Public repo.** Never commit names, places, dates, hotels, ids, e-mail addresses, phone numbers or anything from the private repo or the review. Fixtures are invented: invented cities, places, dates, zones, stations and weather.
- **Own paths only.** Edit only the paths you own. Anything else is a REQUEST line in your status file (file, change, why).
  - If a test outside your paths breaks because of your change, fix your change or file a REQUEST. Never edit another WP's tests.
- **Off limits.** Never push and never commit to `main`.
  - Never touch `.github/workflows/`, `repository-information/`, the root `README.md`, `helpers/BUILD-STATE.md`, `helpers/prompts/` or `live-site-pages/`.
  - Only WP-12b touches `gas/` and `helpers/core/`. The coordinator does the bookkeeping.
- **Backward compatible.** The core deploys on the push, and the private repo stays on its current pin until WP-12c merges. Every row, envelope, digest, plan and request the old code wrote must still load and display, and the old pin's payloads must still validate.
- **No network** except recorded fixtures: no live Google, Telegram, Drive, Open-Meteo or Claude API calls, and no package installs.
  - `/mnt/project-files` is read-only to you. Read the review there for context if you need it; copy nothing personal from it.
- **Commits and records.** Commit to your worktree branch as you go: small commits, plain messages without a version prefix, ending with the session's attribution trailer.
  - Keep `helpers/status/WP-12x.md` current after each step (done, next, REQUESTs), with your own letter for x.
  - Record every default you pick, with its reason, in `helpers/decisions/WP-12x.md`.
  - `Developed by: LightAISolutions` is the last line of every new file.
- **Real tests.** Tests verify real behaviour (the `CLAUDE.md` test-quality rule): call the real function with controlled input and check its output or side effect.
- **When you finish**, the three checks are clean in your worktree and your last message says what you built, what you decided, and every REQUEST.


Developed by: LightAISolutions
