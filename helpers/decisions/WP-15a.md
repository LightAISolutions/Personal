# WP-15a decisions — Day trip (item 19) and the rail estimate

Brief: `helpers/prompts/TG-PHASE-15.md` "WP-15a" and Contract C15. Each default below names its reason.

## Rail estimate (change R)

1. **`RAIL.CITY_FULL_KM = 15`, and the band formula exactly as the brief gives it.** Up to 15 km a ride costs
   `city(km)` (the formula `rideMinutes` used up to `INTERCITY_KM`); from 15 to 40 km it costs
   `min(city(km), max(city(15), conventional(km)))`; above 40 km nothing changes. `city` and `conventional` are the two
   module-private helpers `rideMinutes` now calls, each the exact `Math.ceil` expression it computed before, so the
   rides it leaves alone keep their numbers to the minute. Why this shape: both arms rise with distance, so their min
   does too (the band never falls); the min caps it at the old city figure (no ride costs more than before); and at
   40 km it meets `conventional(40) = 68` against `conventional(41) = 70`. Figures: 8 km → 31, 15 → 49, 17 → 49,
   25 → 50, 30 → 56, 35 → 62, 40 → 68, 41 → 70.
2. **The flat stretch from 15 to about 24 km (49 minutes) is accepted.** `max(city(15), conventional(km))` holds the
   15 km figure until the conventional line overtakes it near 24 km. The brief asks for exactly this; a flat stretch is
   "rises steadily" in the never-falls sense the band test pins.
3. **No other test pinned a minute figure for a 15–40 km ride**: the whole suite passed after the change. Only the A9
   list `[0.5, 3, 8, 25, 40]` → `[0.5, 3, 8, 15]` changed (marked `C15`), as the brief says.

## The words (`parseDaytripText` / `tgDaytripParse`)

4. **The two clauses close the text, each at most once, in either order** (`… under 45 min on 5/13` and
   `… on 5/13 under 45 min` both work). A clause in the middle stays part of the base: a place name may contain
   "on" or "under" ("Stoke on Wyvern"), so only a clause at the very end, with a date or a number after it, counts.
5. **`under N` without a unit is minutes; `m` is minutes, any `h…` unit is hours**; the result is rounded and
   clamped to 30–180 (the brief's "clamped"), never refused. A bad date, a past date or a base over 80 characters is
   refused in words and nothing is asked.
6. **`M/D` is the next such date from today, today included**, tried for up to 8 years so `2/29` finds the next leap
   year; "today" is the current trip's zone (`tgTripToday`), else the owner's (`getTz`). An ISO date in the past is
   refused (`past_date`), not moved to next year: the owner typed the year.
7. **The text is cleaned the same way on both sides** (controls to spaces, whitespace collapsed, a leading
   `/daytrip[@bot]` and trailing `?.!` dropped, a leading `from` dropped from the base). The request still carries the
   owner's words as typed; the engine's parse is the one that counts (Scout's rule).

## The engine

8. **Screens run in the brief's order and each candidate gets the first reason that fits** (`duplicate`, `no_rail`,
   `too_far`, `closed_on_dates`, `out_of_season`); `left_out` keeps the first 20. A duplicate is the same slug or the
   same name after case folding and dropping accents; the first one seen stays.
9. **`closed_on_dates` without a date needs every trip day closed**, and with no trip days and no date nothing is
   closed. With a date, a candidate closed then is left out, so an item carries `closed` only without a date: the trip
   days it is closed on (≤ 7; it is open on at least one). The fixture's first board follows that rule (no `date`,
   Saltmere Head closed on one trip day), so it reads like a board the engine could make.
10. **The score uses the unrounded reach part; `parts` are rounded for display.** Ties: shorter ride, then the name
    (case-folded). `veg_easy` is added when the food is confirmed and is kept even when the judgment sent four labels
    (the lowest-priority label makes room); labels come out in the C15 enum order.
11. **Ride minutes are clamped to 1–600** before they reach the payload, so an estimator edge case cannot make an
    invalid envelope.

## The payload and the validators

12. **`schemas/index.mjs` stays frozen**; the rules the subset cannot say (rank order, unique slugs and labels, real
    dates, 20 000 characters, Google field names) live in both validators, and `checkDaytrip(p)` is exported for that
    file to call (a REQUEST). Both validators say the same words; the parity test holds them to it.
13. **The core's handler also refuses a board whose `trip` the core does not know** (the vegcard rule), with
    `trip: unknown trip "<slug>"`; `null` is always accepted. The pinned payloads test makes `quillmere-2027` known.
14. **The core's size message comes twice for a payload over 60 000 characters** (the shared `tgEnvSize` and then
    the 20 000 limit); the pack validator says the same two lines so the words match.

## The core: store, card, buttons

15. **The `DayTrips` row stores the whole validated payload** (≤ 20 000 characters, well under a cell) and Maps
    links are filtered where they are shown (`tgCmdHref`, `tgAppMaps`), as Scout does. `kept_json` entries are
    `{ n, slug, date?, at }` in board order; a re-delivery keeps entries whose slug is still on the board, with the new
    `n`, their date and their `at`.
16. **The card shows "🚆 ~42 min"**: plain minutes, with `~` when `ride.estimated` is true (Scout's mark for an
    estimate), so the owner can tell the estimator's figure from a timetable's. "under N min" in the header is the
    asked limit in minutes.
17. **`more` gets one line in the chat** ("…and 2 more within reach.") — it is a count, not something left out; what
    was left out appears only in the app, as the brief says.
18. **Board keys are always `k` + 12 hex** (the ids run to 52 characters, so the id itself never fits a callback).
    A day button is `dt:<key>:<n>.<d>`, `d` the planned day's number at the time of the tap; a day that is no longer
    planned is answered "That day has changed".
19. **The day question follows a keep only on the board's own trip** while it is on file and not done, and only when
    it has planned days (`tgDigestDays`); a board without a trip never asks. The replan's `dates` are the new date and,
    when the kept entry already had another date, that old date too, so the old day is re-planned without the trip.
20. **An un-keep forgets the entry's date** and opens no replan: the old day keeps its plan until the owner re-plans
    it; nothing is undone behind their back.
21. **`/daytrips` lists the kept trips of the last 10 boards first**, one ✅ line each (name, base, ride, date when
    set), then one line per board with its 🚆 button.
22. **`daytrips_kept`** walks the boards newest first, skips boards whose trip is done or no longer on file, and sorts
    by `kept_at` newest first (a stable sort keeps board order for ties); `stops` carry only `name` and `place_id`.

## The app

23. **`daytrip.get` returns the board's head plus `items`, `more`, `left_out` (each with `words`), `kept_entries`,
    `trip_title` and `days`** (the planned days of the board's trip, for the day picker; `[]` without a trip).
24. **`daytrip.keep` needs `keep` (boolean) and an integer `n` 1–8**; a `date` with `keep: false`, or an unreal date,
    is `400 bad_args`; an item not on the board is `404 no_item`; a date on a board without a live trip is
    `409 no_trip`; a date that is not a planned day is `400 no_day`.
25. **`daytrip.new { under }` is a number of minutes, clamped to 30–180 like the chat's words**; `date` accepts the
    command's words (`YYYY-MM-DD`, `M/D`, `today`, `tomorrow`). The request text reads
    `/daytrip [from <base> ]under <N> min[ on <date>]`. No base and no trip is `400 no_trip`.
26. **`daytrip.list` also returns `kept_trips`**, built by the same function as state.json's `daytrips_kept`
    (`tgDaytripKeptSnapshot`), so the screen's kept list and what the planner reads cannot disagree.

## The Day trips screen

27. **The screen has two levels, as Scout does**: the list (a form, the kept trips, the boards) and one board
    (`S.daytrip`, also reachable from the chat's 📱 button as `?screen=daytrip&daytrip=<id>`). The nav's Day trips button
    always opens the list. The wiring outside the section is the minimum: the `SCREENS` entry, `DAYTRIP_ID_RE` beside
    `SCOUT_ID_RE`, `S.daytrip`, the `readParams` line, `go()`'s map and the nav reset.
28. **The form asks with a select of ride limits (30, 45, 60, 90, 120, 180 min; 90 first)** rather than free minutes:
    the six values the chat's clamp keeps meaningful, and no number to mistype on a phone. From and date are free text
    in the command's words; blank fields are left out, so the core answers from where the trip stays.
29. **The day picker sits on every item when the board's trip has planned days**, not only after a keep: one tap keeps
    the trip on that day and opens the replan (the chat's two taps in one). The kept day is marked; tapping it again
    does nothing. Without planned days, Keep still works and no picker shows.
30. **Refusals are read in the section's own words (`DAYTRIP_WHY`), falling back to the shared `why()`**, so the
    shared `WHY` table (also edited by WP-15b) stays untouched. `bad_date` there means an outline day, not a typed date.
31. **A kept trip's ride shows without `~`**: `daytrips_kept` carries `ride_minutes` but not `estimated`, so the list
    does not claim an estimate it cannot know; the board itself shows the mark.
32. **`go()` dispatches `daytrip: showDaytrip` directly**, which breaks the Veg card test's fake `go()` context; its
    list of show functions gains `showDaytrip` (marked `C15`). WP-15b likely adds its own entry to the same line.

Developed by: LightAISolutions
