# WP-13a — decisions and defaults

Brief: `helpers/prompts/TG-PHASE-13.md` (WP-13a, Rules). Findings A1, A2, A3, A5 (hours), A8, A12, A13.
Status: `helpers/status/WP-13a.md`. All fixtures used are the invented moving-day fixture, mutated in the tests.

## A1 — an unreachable hard end
1. `solveDay` returns `{ order: [], items: [], finish: departAt + travel(S, E), hasLunch: false, value: 0, overrun: true }`
   when no state (not even the empty day) ends by `dayEnd + maxSpill`. It still throws "no feasible day" only when
   `travel('S', 'E')` is Infinity (the start cannot reach the end at all). The "no route" errors of `fetchLeg` are untouched.
2. `planDay` treats `overrun` as "drop every stop": each pool candidate goes to Later with "even with no stops <day>
   reaches <end> late, so there is no room for <name>" (code `day_full`); a booked one gets the booking text (A3).
   The day keeps its start step, then the start → end legs (a locker or hotel bag step still runs).
3. The alert (`overrunText`, ≤ 200 chars): "Reaches <end name ≤ 40> at HH:MM, N min after the HH:MM needed for HH:MM.
   Start earlier: /dates <date> hours <start> <end>", the suggested start = the day's start minus the overrun, rounded
   down to five minutes (and, when the earlier start crosses LATE_START, also by the breakfast it brings back). With a
   fixed start too: "Its start (HH:MM at <start>) is fixed too: check both times with /dates <date>"; when the
   suggested start would fall before 00:00, "Too far to reach by HH:MM: check the end with /dates <date>".
4. `checkDayChain` skips the "arrives after the end" error only on a day with no stops and an `over_long_day` alert
   (the A1 day). Every other check (chain, timeline order, margin on days with stops) is unchanged.
5. `spare_minutes` is 0 on an overrun day.

## A2 — an override whose end is not after its start
6. `withOverride` (now exported) calls `clampOverride` when `dayEnd <= dayStart`:
   - only `end.time` fixed, or neither side fixed: the end stays, the start moves to `CLAMP_MINUTES` (120) before it, never
     before 00:00;
   - only `start.time` fixed (an arrival after the trip's end, say): the start stays, the end moves to 120 minutes after
     it, at most 23:59 (the brief names only the end-kept case; a fixed arrival cannot be moved either);
   - both fixed: `noStops` — `assign` gives the day capacity 0 (its candidates go elsewhere or to Later as `day_full`) and
     the day carries an `over_long_day` alert; the A1 alert is not added on top.
7. Warn text: "<Ddd d Mmm>: the hours given end at GE, before they start at GS; planned S–E. To change it: /dates <date>
   hours S E" (code `other`, ≤ 200). It is the day's first warning.
8. `checkTrip`'s override rule (at least two hours, `checkDayOverrides`) stays as it was: the trip file check still
   reports such an override to whoever wrote it, while the planner no longer throws on it. See REQUEST 1.
9. Trip-level hours under two hours still fail in `buildDays` ("day_end must be at least two hours after day_start").

## A3 — a booking at the edge of its day
10. `assign`: a booked candidate is judged on its own day against the window stretched to the booking
    (`bookedCode`): start = min(day start + start step, booking), end = max(day end, booking end) unless the day has a
    hard end. Codes: `booking_early` (a fixed start after the booking time) and `booking_late` (a hard end before the
    booking can finish), both mapped to Later code `outside_day`, with reasons "<name>'s HH:MM booking on <day> cannot
    finish before HH:MM, when the day ends at <end>" and "… is before the day starts at HH:MM at <start>".
11. `planDay` widens before solving, from the Route Matrix (no extra request): on a day without a fixed start the
    departure (and the start step with it) moves earlier by what the booking needs (booking − leg from the start −
    the earliest departure); on a day without a hard end the end moves to booking end + the matrix leg back. The
    pre-events and bag step shift with the start. A day with a hard end never moves its end.
12. The info warning: "Day hours widened to HH:MM–HH:MM to hold your booking(s) at <names>" (the widened window).
13. A booked candidate the real legs still cannot fit goes to Later with the booking-miss text, code `outside_day`.
14. Non-booked `outside_day` reasons: the named day's window when the candidate has a booking or an anchor
    ("HH:MM–HH:MM on <day>"); the shared window when every day has the same hours (the old text, so old plans are
    unchanged); else "earliest start–latest end across the trip".

## A13
15. Checked before anything else in `assign` against all trip dates (`tripDates`, which `build` passes, so a re-plan of
    some days still knows the whole trip). Date shown with `dayDate` ("Mon 25 Oct"), plus the year when it differs
    from the trip's.

## A8 — the last leg of a hard-end day
16. Applies when the day has a hard end, no overrun, and hard − finish ≥ FREE_MIN. The tail (the legs and bag events
    after the last stop or lunch) moves later by the spare time; the time before it becomes free time "free time near
    <last place> before you leave for <end name>" (`spareEvents`).
17. When the day has no lunch and the spare time spans the lunch window with room for it, a lunch is placed inside it
    (marked `added`); without that the old day would have kept its lunch elsewhere anyway.
18. TRANSIT, a single-leg tail and no locker: the leg is fetched again at its new departure (one `getLeg`, counted in
    the day's `route_calls`); it is used only when the arrival still leaves ≥ FREE_MIN spare time before the margin,
    else the first timing stays (delta 0). WALK and DRIVE legs keep their minutes; a locker day's way back keeps its.
19. Budget: `budgetFor` adds `late_leg_calls: 1` on every TRANSIT day with an `end` override (a ceiling, as for
    `dinner_calls`).
20. Old fixtures change only on their hard-end days (two-stays' last day, moving-day's last day); every other day and
    the whole plans of transit-city, driving-loop, hill-town and rehearsal-day hash as before (p13a_old_fixtures).

## A12
21. `planDay` hands `evening.ready` = the day's departure after its start step (bag step included). An event that
    starts before it is offered from `ready` when at least `MIN_OPEN` minutes of it remain (an event under way at
    arrival), else it is not offered; saved places start no earlier than `ready`.

## A5 (hours)
22. "Using own facts" = facts that set hours (closed weekdays, close, last entry) or the visit length (only when the
    length came from the facts, not a booking). Menus, booking and price facts do not count (A4/A5 menus are WP-13b's).
23. The plan's day: `planToday(input.now, trip.timezone)` (trip-zone date of `now`); `factsStale(rawFacts, today)` is
    called as it is with that date string. A missing `checked` counts as old ("checked an unknown date"), as
    `factsStale` says.
24. Dates in the texts are ISO (`2027-06-23`), as `facts.checked` is written; the warning carries `place`.
25. Dinners: after `addDinners`, each chosen dinner whose own facts (the place record, else the dinner list entry) set
    hours and are old adds the same warning to that day (capped at 40 warnings).
26. The stop's check line is set only when `checkOnDay` gave none (irregular or unknown hours keep theirs).

## Tests outside my modules' tests
27. `pack_tour-guide_phase11_wave2_e2e.test.js` (no WP owns it this phase): the Free days line of the two-stays
    departure day now reads "free time near Quillbay Inn before you leave for Quillbay Station" (A8, marked).
28. `pack_tour-guide_planner_c11.test.js` (my module's test): the departure-day spare note assertion now checks the late
    leg and the free time before it (A8, marked).

Developed by: LightAISolutions
