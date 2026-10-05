# Phase 18 decisions — brochures as instructions for the day

The owner shared a day plan written in a chat (a theme-park day) and asked for Tour Guide's brochures to be as useful.
The finding: the gap is content and structure, not design. That plan reads as instructions for the day (what is fixed,
what to carry, when to wake, what to do in a gap, how to get out); our brochure describes the day. Thirteen changes were
proposed and approved whole (2026-10-05), built in three waves. Coordinator and builders **Opus 5.5 · high** (no Fable,
the owner's limit). The reference plan's specifics never enter this repo: fixtures are invented (Harrowmere).

| # | Change | Wave |
|---|--------|------|
| 1 | Answer-first day titles, a lead sentence and key-time tiles; contents rows named after decisions | 2 |
| 2 | Today's checklist: must-dos, what to carry (tickets from bookings), hard constraints | 1 |
| 3 | Night-before and morning countdown, worked back from the first fixed time | 1 |
| 4 | Fixed vs flexible times: bold = fixed by a booking, a timed entry or a train | 1 |
| 5 | Field notes on the timeline rows (cash, gate, last entry) | 1 |
| 6 | Planned free windows: a name, the length and 2–4 nearby options with walk minutes and open status | 1 |
| 7 | Food on your route: diet-fit dish, price, where it fits, caveats | 2 |
| 8 | If-then rules plus a bail-out | 2 |
| 9 | Departure worked backward: two scenarios with spare minutes, plus fallback departures when known | 1 |
| 10 | A "Why this plan" box | 2 |
| 11 | A day survival kit: weather °C/°F, sunset, layers, cash and transit card, lockers, closures | 2 |
| 12 | Day book `/daybook <date>`: one day in full depth | 3 |
| 13 | 24-hour clock and °F next to °C as settings | 1 |

## 1 Contract C18 — wave 1 (kit model)
Every field is optional. `usesC18(model)` (kit `lib/model.mjs`) is true when any of them is present; without them a model
renders byte for byte as before (the C11/C12 rule). Texts are `short` (≤ 160) unless said.

**Trip**
- `clock`: `"12h" | "24h"` — every time in the brochure; absent = the locale's clock (today's behaviour).
- `temp`: `"c" | "f" | "both"` — every temperature ("12 °C", "54 °F", "12 °C · 54 °F"); absent = `c`.

**Day**
- `checklist`: `{ must: [≤ 6], carry: [≤ 8], constraints: [≤ 6] }` (strings) — "Today's checklist", the first thing on
  the day after its header: what must happen at a set time, what to have on you, the limits that hold all day.
- `prep`: `{ night_before: [≤ 6 strings], steps: [≤ 6 { time, text }] }` — "Night before · This morning", worked back from
  the first fixed time; step times in time order.
- `departure`: `{ to, at, by, scenarios: [≤ 2 { label, steps: [≤ 5 strings], spare_min }], fallbacks: [≤ 4 strings],
  note }` — "Getting out" at the end of a day that ends at a departure: `at` the departure time, `by` the leave-by time
  (`by ≤ at`), `spare_min` 0–240.
- `stops[].fixed`, `meals[].fixed`, `start.fixed`, `end.fixed`: `true` (const) — the time cannot slide (a booking, a timed
  entry, a train). Fixed times print bold with a small "fixed" tag; a day with any adds one legend line: "Bold times are
  fixed by a booking, a timed entry or a train; the rest can slide."
- `stops[].tip`, `meals[].tip` (≤ 160) — a field note under the row ("Cash only", "Enter by the north gate").
- `free[].title` (≤ 60) and `free[].options`: `[≤ 4 { name, place?, km?, walk_min? (0–120), open? (short), note?, url? }]`
  — a named window with its length and what is nearby.

## 2 Where wave 1's values come from (pack, computed from data already there)
- **Planner** (`planner-free.mjs`, DayPlan `free[].title`, `free[].options`): for each free window of at least 30 min,
  saved / Later / shortlisted places not on the day, within 1.2 km in a straight line of the window's anchor (the stop
  before it, else the one after), open at least 30 min inside the window, with a round trip (walk there and back + 20
  min) that fits; walk minutes from distance × 1.25 at 4.8 km/h; nearest first, at most 4, none twice in a day.
- **brochure-map**: `fixed` from a booked stop, a meal whose booking record for that date is `booked`, and a day's
  real start or end with its own time; `tip` from the place's facts (payment, gate); `checklist` (fixed items in time
  order; booked tickets for the date with how to show them, cash when a stop takes cash only, the transit card on a
  transit day, the bag step on a moving day; the travellers' diet, last entries and check-on-the-day lines); `prep`
  (the steps back from leaving the lodging: wake at leave − 75 min or breakfast − 45, breakfast, leave, the first fixed
  thing; the night before: the alarm, tickets to have ready, bags on a moving day); `departure` (the planned leg into
  the day's end and a "latest safe" one that leaves 15 min spare; fallbacks from the trip's `day_overrides[].fallbacks`).
- **Display settings** (item 13): core command `/units` (`/units 24h|12h`, `/units c|f|both`), shown in the app's
  Settings and in the state snapshot as `tour_guide.display = { clock, temp }`; the private brochure routine passes them
  to the build. Default **24 h and both temperatures**: a traveller reads local timetables in 24 h and thinks in their
  home unit.

## 3 Contract C18 — wave 2 (the written briefing)
Items 1, 7, 8, 10 and 11 need judgment, not arithmetic, so the private brochure routine writes them: one briefing JSON
per build, `{ v: 1, days: { "<date>": { … } } }`, passed to brochure-map as `options.briefing`. brochure-map clips and
drops what does not fit (unknown keys, a `place` with no card, over-long text) and the kit validates the result. All
fields optional, on the kit day:
- `lead` (≤ 240): the answer first — what the day is and the one thing to get right. `theme` stays the headline and the
  routine may rewrite it answer-first. `key_times`: `[≤ 4 { label (≤ 30), time }]`, tiles under the header.
  `contents` (≤ 80): the day's row in the contents, named after its decision.
- `food`: `[≤ 6 { name, place?, dish, price?, fits, caveat? }]` — "Food on your route": a dish that fits the travellers'
  diet, where it fits in the day ("lunch, 12:00–13:00"), price and caveats (queue, cash, closes early).
- `if_then`: `[≤ 6 { if, then }]` and `bail_out` (≤ 240): what to do when the day goes wrong, and how to cut it short.
- `why`: `[≤ 4 strings]` — "Why this plan": the choices the planner and Compare made, in plain words.
- `kit`: `{ weather?: { high_c, low_c, rain_pct?, note? }, items: [≤ 6], closures: [≤ 4], not_missing: [≤ 4] }` — the day
  survival kit; temperatures obey `trip.temp`; sunset comes from `day.sunset`.

## 4 Wave 3 — the Day book
`/daybook <date>` asks for one day in full depth: the routine writes a briefing at the Day book caps (food ≤ 10, if-then
≤ 10, and `stops[].inside`: `[≤ 10 { time?, text }]`, the order of things inside a big place) and the kit renders a
single-day book (`book: "day"`: cover, the day, its cards). First test: 19 Nov, side by side with the reference plan.

## 5 Release
Wave 1 = WP-18a (kit), WP-18b (planner, brochure-map), WP-18c (`/units`, app Settings), then one private PR (the
driver passes `c18`, `clock`, `temp`, and later the briefing). Coordinator and builders Opus 5.5 · high.

## 6 Choices made while building wave 1
**WP-18a (kit).**
- A new one-line text `$defs/line` caps C18 strings at 160 characters (`short` stays 300).
- `departure` needs `to` and `at`; `by` is optional and its lead then reads "For X, departs …".
- The checklist groups read Must · Carry · Limits, and empty groups are left out. The brief is two columns when there is
  a prep box, one otherwise. The prep box is titled after what it holds: "Night before", "This morning" or both.
- The clock setting reaches every time through a locale hour-cycle extension, so existing time code follows it unchanged.
- A fixed stop never prints as an "about" time. The legend appears once per day, only on a day with a fixed time.
- "Getting out" sits on the rail before the first row at or after the leave-by time, and never after the day's end.
- On a C18 model every free window uses the new row ("Title · length — note"); a window with no title reads "Free".
- The semantic checks also refuse an option naming an unknown place, walk minutes outside 0–120 and an option name
  repeated in a day.
- `temp` changes the season page's figures only. Weather prose the planner wrote is printed as written.
- The C18 stylesheet is added only when `usesC18` is true. Every older model, on Letter and A4, renders byte for byte
  as before, pinned by hash.

**WP-18c (`/units`).**
- `/units` also reads 24/12, °c/°f and both settings at once (`/units 12h f`); anything else gets the usage line.
- Settings `tg_units_clock` and `tg_units_temp`, with an unknown stored value read as the default.
- The app's Settings has a Display section with a Brochures row and two button rows. App v01.20w.

**WP-18b (planner, brochure-map).**
- Everything C18 is behind a switch: the planner's free options behind `input.c18 === true`, brochure-map's fields
  behind `options.c18 === true` (`clock` and `temp` are explicit options and need none). Old plans and brochures stay
  byte for byte; the private side passes the switch.
- A free window's anchor is where the traveller is at its start (the end of the last leg arrived by then), else the stop
  after it, the day's start, the lodging. Places with unknown hours, places planned on any day and rejected places are
  never offered; Later wins over saved, saved over shortlist; ties go by slug. `open` reads "open all day",
  "open until HH:MM" or "open HH:MM–HH:MM". brochure-map drops an option planned elsewhere (a journey can make it stale).
- Fixed: a booked stop, a meal whose booking record is booked, the override's start and end (a lodging breakfast is
  not). Tip: the payment, then "Enter by <gate>"; a meal at one of the day's stops leaves the tip to the stop.
- Checklist: tickets from bookings of kind sight, experience, train and other; a booked stop with no record carries
  its booking text. Prep: its last step is the first fixed thing within 3 hours of leaving (`PREP.NEXT_WITHIN`), so an
  evening train never lands in the morning countdown. Departure: only with a leg into the day's end; "Latest safe"
  leaves 15 minutes spare and shows only when it is at least 10 minutes from the plan.
- `day_overrides[].fallbacks` needs the override's `end`. Core `/dates` does not write it yet.

**Integration.** With `clock: "24h"`, Google's 12-hour hours text ("9:30 AM – 5:00 PM") is rewritten to the 24-hour
clock on the rail and the cards (`retimeText`), so one brochure never mixes the two.

**WP-18d (wave 2, the briefing).**
- Placement: the lead replaces the summary under the day title, with the key-time tiles under it. "Why this plan" and
  the day kit sit at the top of the rail column, beside the aside, not inside it: the aside cannot split and is nearly a
  page on busy days, and a full-width kit made it taller than a page. Food, then if-then with the bail-out as its last
  row, are full-width blocks after the rail. On a phone: head, why, kit, aside, rail, food (cards), if-then (one column).
  The glance page uses `contents` in place of the theme.
- Day kit: every list optional, empty groups left out; the sunset follows the evening rule (none when the day ends at a
  departure before sunset); temperatures follow `trip.temp`. A food caveat prints on its own small row; the If / Then
  head row is left out when there is only a bail-out.
- Caps live in the kit as `BRIEF_CAPS`, with `briefCaps(book)` for the Day book's own caps; a test keeps the kit and the
  pack schema in step.
- Merge (lenient where the pack schema is strict; every drop or clip is a "briefing: …" warning): the briefing is ignored
  unless it is v1 with `days`, its `build_id` is the plan's and `options.c18` is set; dates that are not brochure days
  (free days too) and unknown keys are dropped; times in texts follow the clock, then texts are clipped with "…";
  unusable list entries go before the caps; key times keep the first 4 valid, sorted by time; a food place with no card
  keeps its name without the link; weather with the low above the high, or a rain chance outside 0–100, is dropped;
  `theme` replaces the plan's theme; an empty kit is left out. `buildModel(args)` returns `{ model, warnings }`.

**WP-18e (wave 3, the Day book).**
- Kit: `book: "day"` at the top of the model; a Day book holds exactly one day. Its sections are a cover of its own (the
  day's number, weekday and date in the corner, "Day book" in the eyebrow, the day's theme over the trip's title, and
  Date · Day runs · Night · Travelling), the day spread, that day's cards and the sources. The glance page, season,
  Later lists and practical pages are never printed; a model that carries them gets one "day book: … left out" warning
  each. The title reads "<trip> — Day book, <long date>".
- `days[].number` (1–31, Day book only) keeps the day's place in the trip — its numeral, hue and the cards' "Day N" —
  so day 3's book still says Day 3. Without it the day is Day 1.
- `stops[].inside` (`[≤ 10 { time?, text ≤ 160 }]`, Day book only) prints as "Inside, in order" under the stop's row: a
  numbered list, time in the trip's clock or an empty cell, then the step. Given times are in order and within the
  stop's arrive – depart (semantic checks).
- Caps: `BRIEF_CAPS.day` raises food and if-then to 10 and adds `inside: 10`; the brochure row has `inside: 0`. The
  schema's food and if-then maxItems are now 10 (the largest row); a brochure is still held at 6 by semanticErrors().
  Food and if-then stay unsplittable blocks: at 10 rows each they still fit a page.
- Styles: a `C18D` block after `C18B`, added only to a Day book, so every older model is byte for byte as before
  (pinned, with the wave-2 fixture and pack samples, in `kit_brochure_daybook.test.js`).
- Pack: brochure-map `options.book: 'day'` with `options.date` builds the Day book (C18 implied). The day's number is
  its position among the days with stops; only the places the day refers to and their sources are kept. A bad book, no
  date, a date not in the plan and a free day throw; a lone `options.date` is a warning.
- Briefing: `book` (`brochure` | `day`) and, per date, `inside` keyed by the stop's place slug. Merge: a briefing
  written for the other book still merges, at the build's caps, with a warning; `inside` outside a Day book is dropped
  with a warning; a slug that is not a stop of the day is dropped; a step's bad, out-of-order or out-of-span time is
  removed from the step and the step kept. Checks: a Day book briefing has one date; per-book caps (6 or 10);
  `inside` only in a Day book, its times in order.
- GAS: `/daybook <date>` (the date words of /replan: `YYYY-MM-DD`, `day N`, `N`, `today`, `tomorrow`) opens request
  kind `daybook` `{ trip, date, build_id? }` for BROCHURE. Bare `/daybook` is today's while today is a day of the plan,
  else the usage line; a date outside the plan or a free day gets a plain reply and no request. The reply's
  `drive_file_ids` go to the chat as any reply's do; the Day book is not stored on the trip, so it never replaces the
  brochure. Guide entry (group trip, two forms with `{ tpl }`, no `opens`/`wait`) and keywords added.

## 7 Status
- **Wave 1 built** (v01.79r, app v01.20w). Its private side (the plan skill passes `c18`; the brochure build passes
  `c18`, `clock`, `temp` from `state.json` `tour_guide.display`) is the private repo's PR #29, waiting on the owner.
- **Wave 2 built** (v01.80r). Its private side (a context mode in the brochure driver; the routine writes the briefing
  by its skill's authoring rules; `--briefing`) is in the same PR #29.
- **Wave 3 built** (v01.81r): the Day book and `/daybook`. Next: its private side, the brochure routine takes request
  kind `daybook` (`options.book: 'day'`, `options.date`, a `book: "day"` briefing with `inside`) and replies with the
  PDF; then the first Day book of the owner's 19 Nov plan, side by side with the reference plan.


Developed by: LightAISolutions
