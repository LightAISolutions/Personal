# WP-12d — decisions and defaults (brochure: the re-planned day, the phone clock, dates in words, undated bookings)

Brief: the coordinator's WP-12d message (Phase 12; Rules in `helpers/prompts/TG-PHASE-12.md`). State, checks and
REQUESTs: `helpers/status/WP-12d.md`.

## Process
1. **Ownership.** Only `helpers/kits/brochure/`, `helpers/packs/tour-guide/brochure-map/`, the Later-reason wording in
   `helpers/packs/tour-guide/planner/`, their tests and this WP's status and decisions files are edited.
2. **Invented data only, no network.** Tests use the kit fixture, the pack's invented samples and WP-12a's invented
   `rehearsal-day` fixture (fixture responder for every Maps request).

## 1. A re-planned day in the brochure (WP-12a's REQUEST 1)
3. **`here` is a kit concept, not a pack hack.** The kit gets a reserved leg start `here` next to `day-start` /
   `day-end`: it resolves to `{ name: "where you were", here: true }`, never coordinates. `legRow` already prints a
   point's name, so the rail reads "Walk 9 min, 640 m from where you were to …". The pack's `mapDay` maps the DayPlan's
   `here` to the kit's `here` (before, `ends()` dropped it and the leg rendered with no start).
4. **Links.** The planner's leg link (no origin, WP-12a decision 16) passes through as before. When a model has no link,
   the kit's `directionsUrl` builds one with `destination` only for a `here` start (Google then starts from the viewer's
   location); no `origin` and no `origin_place_id`. A test searches the model and the HTML for the shared point's digits.
5. **`here` only starts a leg.** `to: "here"` is a semantic error in the kit; `mapDay` drops it as an unknown end (as
   any unknown end). `here` is reserved only while no place is keyed `here`, so an old model with such a key (none is
   known; the planner reserves the slug) keeps meaning that place.
6. **Visited stops: quietly done.** The row keeps its number (the map markers and the cards use it) and its times; it
   is muted (name, activity, clock), its badge turns hollow, and a small "✓ visited" tag follows the name. The glance
   list gets the same tick. Schema: `stops[].visited` is `const: true` (C12 says `visited: true`).
7. **No C12 rules for old models.** The C12 CSS is added only when `usesC12(model)` (a visited stop, or a leg from the
   reserved `here`), as C11 did. The existing golden hashes (`kit_brochure_c11`, `pack_tour-guide_brochure-map_c11`)
   still passed unchanged after this step (commit "WP-12d: a re-planned day in the brochure").

## 2. The phone clock
8. **Cause.** At ≤ 760 px the rail's time column was `--tcol: 2.6rem` (41.6 px). A two-digit en-US time with its
   suffix ("10:00am", "12:30pm") is 56.3 px wide in Charter at 1rem, so it ran 15 px past its column and under the
   numbered badge (which sits above it, `z-index: 1`): "10:00a". Measured in Chromium at 390 px: before, 11 of 20 clock
   cells of the pack sample and 22 of 38 of the kit fixture overflowed their column, 2 and 4 ran under a badge.
9. **Fix: a wider time column on phones, no wrap** — `html:not(.paged) .rail{--tcol:3.6rem}` (57.6 px) and
   `html:not(.paged) .ti-time .t{white-space:nowrap}`, both inside the phone media query. Chosen over a smaller clock
   font (the rail's clock is the day's main reading on a phone, and a leg's smaller clock would need a second override)
   and over moving the suffix under the time (two lines per stop). The rail body loses 16 px at 390 px.
10. **Print is untouched.** Paged mode (`html.paged`, the PDF) and browser print at A4 / Letter width (> 760 px) never
   match the rule. All 21 A4 sheet screenshots of both samples are pixel-identical before and after (`cmp`).
11. **Golden hashes moved deliberately**, only by that rule: `kit_brochure_c11.test.js` (kit fixture, with and without
   fonts) and `pack_tour-guide_brochure-map_c11.test.js` (the pack sample, Letter and A4) pin the new hashes and also
   check that putting the old rule back gives the WP-11d hashes. A Chromium test (`kit_brochure_c12.test.js`, skipped
   without the global Playwright) checks every rail time at 390 px is on one line, inside its column and clear of the
   badge; it fails with the old rule.
12. **Screenshots** (session scratchpad, outside the repo): `…/scratchpad/wp12d/before/` and `…/after/`:
   `pack-phone390-day1.png`, `kit-phone390-day2.png`, `pack-a4-sheet04.png`, and a re-planned day (C12)
   `after/extra-phone390-day1.png`.

## 3. Dates in words
13. **The format is the Telegram day card's.** The day card names its day with `tgCmdDate` (`gas/10_commands.js`,
   Apps Script `Utilities.formatDate(…, 'EEE d MMM')`): "Wed 12 May". The Later reasons are read mostly in Telegram's
   /later list, next to the digest's day lines that use that format. So the reasons use it too. A Node twin is needed
   because the GAS function cannot be imported. `dayDate()` is in `planner/planner-time.mjs` and exported from the
   planner index. It uses fixed English day and month names, as Apps Script prints them (ICU's en-GB would print
   "Sept"). A test runs `tgCmdDate` in the GAS harness and checks every day of 2027 and 2028 gives the same string.
   This is one format with two implementations that a test keeps equal, not a second format.
14. **Fixed where the text is made.** These reasons now call `dayDate`:
   - `planner-assign.mjs`: `closed_day` ("… is closed on Mon 18 Oct, the day you are near it") and `day_full`
     ("no room left on Mon 18 Oct, the closest day for …");
   - `planner-day.mjs`: "the real route times on … left no room for …" and "no room left on … for …".
   The re-plan prefix ("re-planned at HH:MM: …") wraps those reasons unchanged. No other planner reason contains a
   date (`outside_day` shows a clock window).
15. **The brochure note uses the same helper:** "Taken off the plan for Fri 14 May." I did not use the kit's
   `shortDate(locale)` ("Fri, May 14" in en-US). The note sits right under a reason that now reads "… on Fri 14 May …",
   and two formats on one Later item would read as two different things. The brochure's own day folios keep the kit's
   locale format, unchanged.
16. **Bounds.** "Wed 12 May" is never longer than "2027-05-12" (checked on every date), so no string grows past its
   bound. Reasons are still clipped at 300 in the planner and at SHORT in the brochure; the note is clipped at TEXT.
17. **Older plans are not rewritten.** A reason stored by an earlier build keeps its YYYY-MM-DD until the next build or
   re-plan makes it again. The brochure shows stored reasons as stored. Only the note, which the brochure builds itself
   from `from_date`, changes at once. A value that is not a real date is shown as given. Old plans and digests still
   load, validate and render.
18. **Outputs that moved, each updated with a comment:**
   - `pack_tour-guide_planner_c11_units.test.js`:
     - the `closed_day` reason expectation;
     - the GOLDEN_683C9E6 plan hashes. Only `driving-loop:plan` and `driving-loop:replan` have dated reasons: three
       and two `day_full` items ("no room left on Thu 10 Jun / Fri 11 Jun for …"). The hashes are kept; the test puts
       each day's words back to YYYY-MM-DD before hashing, which proves nothing else in those plans moved.
       transit-city, hill-town, the budgets and the mini worlds have no dated reason and are unaffected.
   - `pack_tour-guide_planner_tidy.test.js` (d): "no room left on Mon 7 Jun for Green Park".
   - `pack_tour-guide_brochure-map.test.js`: the sample's Later note, "Taken off the plan for Fri 14 May.".
   - `pack_tour-guide_brochure-map_c11.test.js`: the sample's HTML hashes, Letter `0077a7ac…` and A4 `15e2529a…`.
     Reverting the note gives the phone-clock hashes; reverting the clock rule as well gives the WP-11d hashes.
   - `pack_tour-guide_phase11_e2e.test.js` (outside this WP's test list; edited only because its expected text
     follows from this change): the museum's `closed_day` reason, and the same reason in the digest's Telegram
     summary ("closed on Mon 18 Oct"). The summary's day lines already read "Mon 18 Oct".
   - New: `pack_tour-guide_planner_dates.test.js`.
19. **Not mine to change (REQUEST):** `journey/journey-assemble.mjs:83` builds the same "no room left on ${date} for …"
   reason for journey plans. The fix is one call to `dayDate(date)` (import from `../planner/planner-time.mjs`).

## 4. A booking with no date
20. **Where bookings reach a day.** A `trip.bookings` record (`for_date` and `place` both optional) reaches a day in
   four places, and each one matched `for_date` only:
   - the Telegram day card: `tgBkDayLines` in `gas/14_bookings.js`, `b.rec.for_date === d`;
   - the planner's dinner booking line (`planner-dinner.mjs` `dinnerBooking`), shown on the day card's 🍽 line and on
     the brochure's dinner card;
   - the brochure's Bookings page ("For <day>.");
   - the brochure's stops, which showed no booking record at all: only the stop's `booked` and the facts line.
   So a record with a place but no date (for example "the walk on Lark Hill, opens 7 days ahead", day not yet fixed)
   showed on no day.
21. **Rule: an undated booking belongs to the first day its place is planned on.** That means a stop, or failing that
   the evening's dinner. The rule is computed, never stored. Writing the planned date into `for_date` would turn the
   record into a dated booking, which the outline and the planner pin as an anchor (journey-outline,
   planner/index.mjs), so the place could never move on a later re-plan. A dated record still wins on its own date and
   never moves to another day. A record with no place has no day.
22. **Pack side (done):**
   - planner: `bookingFor(bookings, place, date, firstDay?)` and `bookingRecordLine(b)` in `planner-dinner.mjs`,
     exported from the planner index. `dinnerBooking` uses them, so the undated record's line ("To book: … · by phone ·
     from 2 people") reaches the dinner on the evening the place is planned;
   - brochure: a stop's `booking_line` is now its record for that day (dated that day, or undated on the place's first
     planned day), else the facts line as before. A `booked` stop is unchanged;
   - brochure Bookings page: an undated record whose place is planned says "Planned for Fri 14 May." ("For" stays for
     dated records). Its day label now uses `dayDate` as well, so September reads "Sep" as on the day card (ICU's en-GB
     printed "Sept"). No test or golden output moved.
   Tests: `pack_tour-guide_brochure-map_undated_booking.test.js`. The planner case fails with the old `dinnerBooking`.
23. **Telegram day card (REQUEST, gas is not mine):** `tgBkDayLines` should also take an undated record whose `place`
   is on that stored day. The exact change is in the status file's REQUEST 2.

Developed by: LightAISolutions
