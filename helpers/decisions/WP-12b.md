# WP-12b decisions — Core: the morning message, running late, re-plan from here, the evening check-in

Brief: `helpers/prompts/TG-PHASE-12.md` (WP-12b). Status: `helpers/status/WP-12b.md`. Every default below is mine unless
it says the brief fixed it.

## 1. C12 in the digest

- **Fields.** Exactly the brief's output table: top `country_code` (`^[A-Z]{2}$`); day `leave_by` (time) and `areas`
  (1–2 strings of 1–60); stop `visited` (`true` only), `local_name` (1–80), `address` (1–160), `payment` (1–80), `close`
  (time); leg `stations` `{ from, to, from_line?, to_line? }` (each 1–60). A leg's `from`/`to` may be `here`: it is
  already a valid slug, so neither validator needed a change for it.
- **Dinner place facts (my addition).** The morning message must show the dinner's local name and address and put its
  payment and price in the 💴 section, but C12 lists those fields on stops only. I added the same four optional fields to
  the digest's `dinner` (`local_name`, `address`, `payment`, `price_line`, same bounds). Optional, so nothing old
  breaks; REQUEST to the coordinator / WP-12c to fill them from the dinner place's own facts.
- **`stations` only on a TRANSIT leg.** Enforced in `checkPlanDigest` (the pack) and in `tgEnvLegC12` (the core's
  mirror): the schema subset cannot express "only when mode is TRANSIT".
- **Storage.** `country_code` is a new Trips column (last, so old sheets gain it through `_tgEnsureCols`); a digest
  without it leaves the stored value alone (like `tz`). `leave_by` and `areas` live in the day's `meta_json` next to
  C11's day fields (`TG_DAY_META_C12`); stop, leg and dinner fields ride inside their JSON columns unchanged.
- **Parts.** `country_code` is part of the top fields every part must repeat, but only when sent, so a build staged
  before this deploy compares unchanged.

## 2. Weather (Open-Meteo)

- **What the coordinator checked on 2026-10-03** (recorded as the brief asks): free for non-commercial use (this
  one-owner helper qualifies); under 10 000 calls a day, 5 000 an hour and 600 a minute; no key; data under CC BY 4.0,
  credited as "Weather data by Open-Meteo.com" with a link to https://open-meteo.com/; the geocoding names come from
  GeoNames, also CC BY 4.0. The credit line also links GeoNames (https://www.geonames.org/) for the place names.
- **Place.** Geocoding with the brief's URL (`count=5&language=en&format=json&countryCode=<cc>`), first result; the
  coordinates are cached in Settings `tg_geo`, keyed `CC|town (lower case)`, newest 100 kept. GeoNames data, not Google
  content.
- **Town.** The owner's `/dates <date> weather <town>` (≤ 60 characters, hidden characters stripped) wins for that
  date; else the day's `areas` (1–2). Stored in Settings `tg_weather_town` `{ trip: { date: town } }`; never a
  `day_overrides` field, never sent to the brain. `/dates <date> weather clear` removes it.
- **Forecast cache.** Settings `tg_weather`, one entry per country, town, date and *asking day* (the trip's today when
  asked). A rehearsal days ahead therefore never stands in for the morning's own, fresher forecast; an entry is dropped
  once its asking day is older than yesterday ("cached until the date ends"); newest 80 kept.
- **Rain line.** "Rain likely from HH:00" names the first hour from 06:00 whose chance reaches **50 %**
  (`TG_WX.RAIN_PCT`, `RAIN_FROM_HOUR`); otherwise the WMO code's emoji and words. Temperatures rounded, °F computed.
- **Window.** A date more than **15** days after the trip's today (16 days counting today) says "Forecast not
  available yet" without a call; so does a 400 "out of allowed range" answer.
- **Failures.** A failed fetch, a non-200, an answer of another shape, a missing `country_code` or no town → no line
  (audited as `tg_weather_*`), never a lost message. The attempt is marked *before* the calls, at most **2** tries per
  town, date and asking day, not sooner than **10 min** apart (so the morning's 15-minute backstop run may try once more), so an execution killed inside a slow call does not retry
  for ever. A safety cap of **60** outside weather calls a day (`tg_weather_calls`), far under the service's limits.
- **Calls per trip day.** Expected about 4: a geocode per town once per trip (cached), then one forecast per town for
  the morning message (1 town, 2 on a moving day), plus one more if a rehearsal or a retry runs on the same day.

## 3. Running late (`gas/19_late.js`)

- **An overlay, never an edit.** Settings `tg_late` `{ "<trip>|<date>": { taps: [{ t, m }], base, at } }`; `base` is 12 hex
  of the stored day's stops, legs, dinner and end, so a new digest that changes the day voids it (`tgLateOnDigest`
  deletes it as the digest is stored) and one that leaves the day as it was keeps it. Taps add up; at most **20** a day
  (then "📍 Re-plan from here builds a fresh day"); overlays older than **3** days are pruned.
- **What stays put.** A stop or dinner booked in the core's bookings (status booked, its place, that date or no date);
  a stop whose `time_style` is `exact`; the day's own end (its `end.time` departure, else the day's or the trip's hours).
  Nothing moves earlier. A dinner without an end counts **60 min**.
- **What drops, with its reason** (in the day's order): a moved stop now starting after its own `last_entry`, ending
  after its own `close`, or — with the leg's minutes — running into the next fixed item or the day's end. A stop with
  no hours of its own keeps its slot and says "check the hours" (I cannot know they are fine). The legs around a dropped
  stop join into one leg, with stations when both ends have them, and "travel time not recalculated" (no Maps call).
- **The tap's time** is the trip-local wall clock now; on a rehearsal date the time of day now stands in, as the brief
  says. A stop ends "by now" when its `depart` ≤ that time.
- **Buttons** `rl:<trip key>:<yyyymmdd>:<15|30|60|u>`; the reply carries ↩️ Undo and 📍 Re-plan from here (none on a
  rehearsal, where there is nothing to undo).

## 4. The morning message (`gas/18_morning.js`)

- **Which dates.** Each trip not done, its today and tomorrow (its own zone) with a stored day, not yet sent, before
  **12:00** local (a run delayed past noon skips the date: no breakfast message at tea time).
- **When.** The owner's time (default **07:00**, `/morning at HH:MM` between 05:00 and 11:59) or 30 min before
  `leave_by` when that is earlier, never before 05:00. `/morning off|on` is the owner's switch.
- **Order of the content** (the brief's list, plus the day's 🏁 end line, which the day card already shows): rehearsal
  header · date, Day n of m, towns · theme · running-late line · 🚪 Leave by · weather and credit · 💴 **Paying** (each
  stop's and the dinner's `payment` and `price_line`) · bookings · stops (time, name, local name, last entry; 📍 address
  and 🗺 map; check on the day; moved by running late) · dropped stops · 🚆 Trains · dinner · 🏁 end · 🌅 sunset.
- **Trains.** Only from a leg's `stations` (the places' own access notes, C12): "from X (line) to Y (line) — for Dest";
  a transit leg without them says "To Dest: use the route link". No station is ever inferred.
- **A free day** has the date, weather, bookings and "Free day." — and no buttons (nothing to be late for).
- **Pin.** The first chunk, silently (`disable_notification`); the previous morning message is unpinned first. A failed
  unpin is audited (`tg_morning_unpin_fail`) and ignored; a failed pin is audited (`tg_morning_pin_fail`) and the
  stored pin cleared. The keyboard rides on the last chunk (`tgCmdMessages`).
- **Sent** is marked only when every chunk went out, so a failed send retries on the next alarm (the date stays pending
  until noon). `/morning` today counts as sent. The alarm's run first arms a **15-minute backstop** (`alarmArm` with a
  floor) because the one alarm trigger is deleted as the run starts and a run killed inside a slow weather call would
  otherwise leave none.
- **Rehearsal** (`/morning day N` or any date not today): headed "Rehearsal", never pinned or marked; the buttons stay
  so the owner can try them (their own rehearsal rules apply).

## 5. Re-plan from here (`gas/24_here.js`)

- **The current stop** is the one under way at the trip-local time now (overlay applied), else the last one started.
  `visited` is the stops ended by now, in order, plus the current stop when the re-plan starts from it.
- **Choices.** 📍 From <current stop> and ☔ Rain are offered only when there is a current stop: the planner ignores
  `rain` and `visited` without `from` (WP-12a's contract), so a rain choice before the first stop would do nothing.
  Share my location is a one-time reply keyboard (`one_time_keyboard`, `resize_keyboard`, `request_location`); Cancel
  removes it. The question waits **10 min** (alarm `tg_here`), then says it timed out and removes the keyboard.
- **The request.** `replan` with `dates: [today]`, the `/replan` deliverables, `from` (`{time, place}` or
  `{time, point}`), `visited` (≤ 25), `rain: true` when chosen, and a one-line `reason`; checked before it leaves by
  `tgHereCheck`, which mirrors WP-12a's `restartErrors` bounds. Opened with `tgOpenKindRequest('replan', …)` like
  `/replan`, so the routine, the dedupe and the "fired" note are the existing ones.
- **The location's one path.** The point is rounded to **5 decimals** (about a metre) and travels only inside that
  request file in Drive. The Requests sheet's `text_preview` is "re-plan from here · <date>", the audit row has the
  choice and counts only, the wait in Settings holds labels and no coordinates, and the queue copy of the update is
  stripped (below). The test scans every sheet, property, log, reply and Drive file but the request for the
  coordinates.
- **Refused** while a flow is active ("Finish the current conversation first"), on another date ("works on the day
  itself") and before the trip is in progress. No `/here` command: the 📍 buttons are the way in.
- **Message handler name** `tg_a_here`, so it runs before the other pack handlers (name order).

## 6. The core router (`helpers/core/10_router.js`) — why a pack could not do it

- A Telegram update that the webhook cannot handle at once is queued; the queue row is a Sheet row, so a location in
  it would be kept. Only the router builds that row, so `routeTg` now enqueues a copy with `location` / `venue` taken
  out and `hb_location_withheld: true`; when it is processed the handler asks the owner to share it again.
- A location-only message (no text) is no longer offered to the active flow (a flow would read it as an empty answer)
  and, when no message handler claims it, is ignored without a word instead of being forwarded to the inbound routine.
  The hello pack used to answer such a message "I only read text"; now it says nothing. Both changes are in the core
  because flows and the inbound forwarding are core behaviour; the pack only registers its handler.

## 7. The evening check-in (`gas/25_checkin.js`)

- **When.** 21:00, or **15 min** after the planned end when later, capped at **22:30** — the planned end is the latest
  of the stops' departures, the dinner's end (or start + 60) and the end anchor, with the running-late overlay applied.
  Today and tomorrow are considered so the next one is always armed; a run after **23:30** local skips the date.
- **Layout.** Up to **12** stops a message (7 buttons a row; Telegram allows 100 buttons and 8 a row); each message its
  own ✅ Done. At most 40 stops a day (the review's cap). Names ≤ 80 characters, escaped.
- **Buttons.** `ci:<trip key>:<yyyymmdd>[r]:<i>.<tag4>:<code>` — `i` the stop's index in the **stored** day (so a
  running-late drop after sending cannot shift the buttons), `tag4` the slug's 4-hex tag; `r` after the date marks a
  rehearsal. Codes: the review's `u d s` and `l r h`, and `i` for the number (answers with the stop's name). Done is
  `ci:<trip key>:<yyyymmdd>[r]:<chunk>:ok`. Worst case 59 bytes at a 36-character trip key (tested).
- **Storage.** Choices run `checkin`, kind `review` (an existing kind; no new column), key `<date>|<slug>`, value the
  rating, text the time: one row per stop, so "at most two taps per stop" (a rating and a time) and the latest of each
  wins. ⏭ clears the time; a time on a skipped stop is refused with "tap 👍 or 👎 first". A time without a rating is
  kept (the review asks that stop anyway). No tap clears a choice (a re-tap keeps it).
- **In place.** A tap redraws only the keyboard (`editMessageReplyMarkup`), rebuilt from the keyboard Telegram sends
  back: this check-in's rating buttons get "✓", every other button is kept as it was. Without that keyboard the toast is
  the only feedback (the tap is still saved). Done edits the text into a summary and removes the buttons.
- **Rehearsal** (`/checkin day N`, any date not today): its ticks live only in its own keyboard; nothing is saved,
  nothing marked. `/checkin` today is the real one (counts as sent) and shows the saved ticks.
- **Real taps on another day.** A real check-in's buttons keep working the next morning (the date is in the button).

## 8. The review uses the check-ins (`gas/13_flow_review.js`)

- `tgRvCheckins(trip)`: per slug the latest check-in tap (any date) that has a rating; its time only with 👍 or 👎.
- `/review` and `tg_review_offer` skip those stops; the head of a stop asked again shows "Evening check-in: 👍 ⏩ — kept
  unless you change it". Starting a review clears only the review's own run (as before).
- **All rated.** The review opens with 📨 Send my ratings / 🔁 Review again; the daily offer's button is then
  `rv:send:<trip key>` and sends in **one tap** (a second tap, once the trip is done, answers "Already sent"). With a
  flow active it opens the review instead.
- **Merge.** Items over every stop in stop order: the review's rating wins; its time too, and when it gave none
  ("Not sure", or ⏭) the check-in's time stays — except for a skip, which never carries a time. Same request shape and
  routine as before; the private repo needs no change. Nothing in the repo validates that request, so the test checks it
  against the shape `/review` has always sent (keys, enums, unique slugs of the trip, stop order, ≤ 40).

## 9. Registries and limits

- Alarms `tg_morning`, `tg_checkin`, `tg_here`; commands `/morning`, `/late`, `/checkin`, and `/dates <date> weather`;
  callbacks `rl`, `rp`, `ci` (free after Phase 11) and `rv:send`; message handler `tg_a_here`.
- Settings keys: `tg_late`, `tg_geo`, `tg_weather`, `tg_weather_town`, `tg_weather_calls`, `tg_morning`,
  `tg_morning_sent`, `tg_morning_pin`, `tg_here_wait`, `tg_checkin_sent`.
- Limits: `TG_LATE` (5–240 min, 20 taps, 3 days), `TG_WX` (15 days ahead, 2 tries 10 min apart, 60 calls a day, 50 %
  rain, towns ≤ 60), `TG_MORNING` (07:00, ≥ 05:00, 30 min lead, noon cutoff, 15 min backstop, 60 kept), `TG_HERE`
  (10 min, 25 visited, 5 decimals, names ≤ 40 on a button), `TG_CHECKIN` (21:00, +15, ≤ 22:30, cutoff 23:30, 12 a
  message, 40 a day, names ≤ 80, 60 kept).
- `helper.json` has no registry fields (SPEC §4 rejects unknown keys), so only its description changed; the registries
  are listed in SPEC §5 and the pack README.

Developed by: LightAISolutions
