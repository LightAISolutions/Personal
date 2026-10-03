# WP-12r decisions — the rehearsal: one trip day played through the bot

Brief: `helpers/prompts/TG-PHASE-12.md` (coordinator step 2, row R). Status: `helpers/status/WP-12r.md`. Every default
below is mine unless it says the brief or the coordinator fixed it. All data is invented (the rehearsal-day fixture's
Rehearsal Isles, Quillmere and Tarnwick, country ZZ, reserved for user assignment).

## 1. The rehearsal set-up

- **Zones.** Trip `Etc/GMT+10` (the fixture's zone, UTC-10 all year, so wall times never shift); home `Etc/GMT-3`
  (UTC+3), thirteen hours away, so a reminder in the wrong zone lands at a visibly wrong hour (09:00 trip time is 22:00
  at home). Fixed offsets keep the test free of daylight-saving dates.
- **The fixture as the owner would have it (test-local, fixture files unchanged).** No day-2 start at the station (the
  owner leaves the Quillmere lodging on foot, so the first leg starts at the lodging); `modes.by_date` makes the moving
  day a train day; the two museums carry `scheduled_hint` for that day; the print gallery is booked 15:45 for 60 min;
  Google's TRANSIT answers between the towns are added to the routes table (from the fixture's own travel model) on a
  line named "Coastal Line". Why: the fixture as shipped plans the moving day by car with no booking, which exercises
  neither the stations nor a booking that must hold when running late.
- **Plan time** `2027-10-30T09:00Z`, seed 7, build ids `rh-1` (plan), `rh-2`/`rh-3` (re-plans).
- **Weather.** `pack_tour-guide_phase12_rehearsal_weather.js`: the coordinator's recorded Open-Meteo shapes with invented
  towns, coordinates and weather for 2027-11-09 (Quillmere partly cloudy 20 %, Tarnwick showers from 16:00, 70 %). Any
  other date answers 400 like the live API out of range.
- **06:59.** The brief's time. The core runs alarms up to `ALARM_EARLY_SEC` (60 s) early by design, so the morning
  message also goes at 06:58; the test checks 06:57 (nothing) and 06:59 (sent), and 20:58 / 21:00 for the check-in.

## 2. `digestOf` (the shared harness) maps C12

The harness stands in for the private repo's digest builder, so it maps exactly what the plan and the places' own facts
say, and nothing else:
- **Day.** `leave_by` from the plan day; `areas` = the plan day's areas, at most 2.
- **Stops.** `visited` (only `true`); `local_name` (≤80), `address` (≤160), `payment` (≤80) from the place's own facts;
  `close` only when the facts give an `HH:MM`.
- **Dinner.** The same three lines (no `close`) plus `price_line` from the facts lines, so the morning's 💴 section has
  the dinner's price as well.
- **Stations (TRANSIT legs only), from own access notes only.** An end's notes: a place's `facts.access`; the lodging's
  `access` when the day has one lodging, or the morning lodging on the day's first leg / the night lodging on its last
  (with no owner-named start/end); a moving day's mid-day `lodging` end is ambiguous and gets none; an owner-named
  `day-start`/`day-end` gives its own name as the station; `here` never has one. Pairing: the first pair of stations on
  one line, else the first station of each end; none when either end has no note or both name the same station. The
  routes table's `line` is never read: a station named from Google's route answer would be a guess, and C12 asks for the
  owner's own notes. Tested with a changed route line (no change) and a removed note (no stations).
- **Warnings** are clipped to 20 items of at most 200 characters (with "…"). The planner allows 400 and the core
  rejected the whole digest for one long `order_disagreement` warning — the first fault the rehearsal found (REQUEST 3
  so the private builder does the same).
- **`country_code`** at the top only when it is two capital letters.
- Old fixtures (moving-day, two-stays, transit-city, hill-town, driving-loop) digest exactly as before apart from the
  new C12 keys (checked key by key during the work; the test keeps three of them validating).

## 3. Faults the rehearsal found and fixed in owned paths

- **Paying said the same thing twice** ("Cash only at the door · Cash only at the door"): the stop's `payment` and its
  facts `price_line` both carry the payment words. `tgMorningPaying` (`gas/18_morning.js`) shows the payment, then only
  the price-line parts that are not the same words (case-insensitive).
- **A train leg joined with a walk read "walk"** after running late dropped the stop between them (`gas/19_late.js`).
  The joined leg now takes the first of TRANSIT, DRIVE present on either side (`tgLateJoinMode`), else the shared mode.
  WP-12b's `pack_tour-guide_gas_late.test.js` line 48 asserted the old "↳ walk" on such a join; I changed that one
  assertion to "↳ transit · travel time not recalculated" with a comment (the coordinator may want WP-12b to know).
- **The digest was rejected for a 400-character warning** — fixed in the harness (§2), REQUEST 3 for the real builder.

## 4. Faults found outside my paths (REQUESTs, each with a `todo` test holding the failing assertion)

- **A booked stop is not kept on a re-plan.** Re-planning day 2 from the tide museum at 14:31 kept the clock museum
  (15:16–16:56) and dropped the print gallery booked for 15:45 ("did not fit: 60 min short"), which then shows under
  "If you have energy" while the day card still lists the booking as ✅ booked. The solver gives `must` only to outline
  anchors (`planner-day.mjs` line ~159: `c.anchor === date`); a booking on that date gets only its priority weight. The
  same happens from a shared location. REQUEST 1 (planner owner): `must: true` also when `c.booking` is on `date`.
  Confidence: the cause is read from the code; that `must` alone keeps the gallery here is an inference (it fits:
  arrival in Tarnwick about 15:16).
- **The chosen dinner is swapped on a re-plan.** `prepareDinners` (`planner-dinner.mjs`) reads the dinner's status from
  `places` (the plan's places, where it is `scheduled`) rather than the input's `chosen`, so it ranks below a saved-for-
  later dinner and Tarnwick Terrace Grill gives way to Tarnwick Cellar Soup. REQUEST 2: treat a `scheduled` dinner as
  the status it had when chosen (or prefer the input's own status).

## 5. Undated bookings on the day card (the coordinator's extra task, WP-12d's REQUEST 2)

- `tgBkPlannedDate(b, days)` (`gas/14_bookings.js`): for a booking with a place and no real `for_date`, the first stored
  day whose stops' `slug` or `dinner.slug` is that place — read only, never written into `for_date` (the row and
  `record_json` stay undated, so a later plan can move it). A dated booking always shows on its own date only;
  `not_needed` bookings show nowhere (as before). The day list is loaded once per call, lazily.
- `tgBkLine` adds "   planned for <Tue 16 Mar>" (the day card's date words, `tgCmdDate`) under such a booking in /trip
  and the booking reminders, so the owner sees which day it was put on and that it is not a date they gave.

## 6. Task 2: a lodging change offers to re-plan the days it touches (`gas/26_lodging.js`)

- **Which days.** /lodging words are trip-wide and carry no start date (only an optional "N nights"), so the days touched
  are every stored plan day from the trip's today on — all of them before the trip, none after it. The button carries
  the first date; the request is recomputed at tap time, so a button tapped later re-plans only the days not yet over.
- **Buttons.** `lg:<trip key>:<yyyymmdd>` "🔁 Re-plan N days from <day>" and `lg:<trip key>:k` "Keep the plan", under the
  unchanged /lodging reply with one added line. Both edit the message (no second tap); Keep sends nothing. Without a
  plan, or with all days over, the reply is exactly as before (no keyboard). ≤ 52 bytes with the longest trip key.
- **The request** is the existing `replan` kind through `tgOpenKindRequest` (so `trip_update`, the routine and the
  ack/failure messages are the same as /replan): `{ trip, dates, deliverables, reason: "The lodging changed: <words>.
  Re-plan these days to start and end there." }`, no `from` (whole days). `trip_update` has no lodging field, so the
  lodging travels in the reason (REQUEST 4: the private routine reads it there, or the contract gains a field).
- **No lodging saved** (a forged or stale button): "No lodging is saved — /lodging <where>." and nothing is sent.

## 7. What the rehearsal test asserts (`helpers/tests/pack_tour-guide_phase12_rehearsal.test.js`)

Digest (C12 fields, stations from own notes only, private-schema valid, compatibility without any C12 field) · the
envelope handler and the trip record (start/end from the days, trip zone, country) · 06:59 morning (leave by, two towns
with recorded weather and credit, paying, local names, trains, booking, dinner, buttons; forecasts asked in the trip
zone) · 13:00 late 30 → drop with reason, Undo, late 30 again · 14:30 re-plan from the current stop → request → the
private-side `replanDays(plan, [date], { ...input, from, visited, rain, places: plan.places })` → new digest keeps the
visited stop, clears the overlay, the day card shows the re-planned day; Later reasons in the day card's date words
(`dayDate`) · shared-location variant (`from.point` 5 decimals → `here` leg without an origin; coordinates nowhere in
the plan, digest, sheets, properties, logs, replies or Drive except the request file) · 21:00 check-in of the
re-planned day, taps to Choices, Done · /review after the trip skips the 2 rated stops and sends one valid prefs request
of all 10 · zones: home before and after, trip zone for bookings/morning/check-in during the trip · two `todo` tests for
REQUESTs 1–2 · task 2.

Developed by: LightAISolutions
