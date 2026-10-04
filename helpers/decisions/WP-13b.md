# WP-13b — decisions and defaults (planner: hours, facts, season, rail, dinner)

Brief: `helpers/prompts/TG-PHASE-13.md` (WP-13b, Contract C13), read from the coordinator's commit 8a29e0a. State,
checks and REQUESTs: `helpers/status/WP-13b.md`.

## Process
1. **Ownership.** Edited only WP-13b paths: `planner-hours.mjs`, `planner-facts.mjs`, `planner-dinner.mjs`,
   `planner-rain.mjs`, `planner-rail.mjs`; `season/*`, `facts/*`; the place schema and `checkPlace`; three new test
   files `pack_tour-guide_p13b_*.test.js`; the existing tests of these modules (rail, season). Two tests no WP of this
   phase owns changed because a finding changed their behaviour (listed in the status file, each assertion marked).
   No new fixture directory: the tests build their invented data inline (the shared loaders are nobody's this phase).
2. **No network, no installs, no live API.** Maps answers come from the planner world's responder or a fake client.
   The rail and bloom figures below are from general knowledge, **not from a fetched source**.
3. **Invented data only.** Minibury (the existing test world), invented restaurants and gardens, dates in 2027 and
   2031. Weekdays checked with `date -d` (2027-06-07 is a Monday).
4. **Each finding reproduced first.** Every new test was run against the unchanged code and failed for the reason the
   finding gives, then the fix made it pass.

## A7 — irregular wording on one weekday line
5. **Line → weekday.** A line that starts with a weekday name (English, full or short; the Japanese 月曜 … forms) maps
   to that weekday; a line without a name maps by Google's order, Monday first (`lineForWeekday`). A positional line
   that names another weekday is not used for this one. The same mapping now also reads the "Closed" line when Google
   has no periods (it used the position only).
6. **What makes a weekday irregular.** `IRREGULAR_LINE_RE` on that weekday's line (`isIrregularLine`). A line that says
   "Closed" and whose only irregular wording is Google's holiday caveat "Hours might differ" stays closed — that is
   the review's case (the museum's Monday). A closed line with stronger wording ("Closed (irregular)", "seasonal")
   still varies. An irregular weekday is never closed and takes the known windows (`knownWindows`), as Phase 10 did.
7. **`irregularText` kept as it was** (any line), exported; `hoursOn` now reads `irregularWeekdays`. The place's own
   flag (`{ irregular: true }`) still makes every date irregular, unchanged.

## B7 — posted opening days (C13 `facts.irregular`, `facts.irregular_note`)
8. **Schema.** `irregular` is `const: true` (C13 types it `true`; `false` is refused, absence means not irregular);
   `irregular_note` 1–160. `checkPlace` also refuses a note of spaces only (the schema counts spaces; `normalizeFacts`
   trims first, so it refuses it through the schema). Unknown keys stay refused.
9. **`placeFacts`** returns `irregular` (true for `facts.irregular` or the Place's `opening_days: "irregular"`),
   `irregular_note` (trimmed, ≤ 160, else null) and `menu_checked` (for the dinner order).
10. **`factsHours`.** Own `closed_weekdays` count only when they leave a weekday open (`closedWeekdaysOf`: seven listed
    → none). A date Google calls closed or unknown becomes `irregular` with Google's known windows. A date Google lists
    as open stays `open` (the brief's rule, as `hoursOn` does), so it gets no check line from `checkOnDay`; recorded as
    a known limit, not changed. If the place's own closing time cuts every known window, the date stays `irregular`
    with the own close and last entry as bounds (never `closed`).
11. **No `closed_day` conflict** for an irregular place, in `factsConflict` (`facts.irregular === true`) and so in
    `ownHoursConflict` (which passes the flag). `google_closed`, `close_time` and `last_entry_after_close` stay.
12. **Facts line.** `Opening days vary: <note>` (or `Opening days vary`) leads the facts line only when
    `facts.irregular` is set; "closed every day" is not shown for such a place. Any other place's lines are byte for
    byte the same (pinned in the test from the code before this phase).
13. **The check line.** `placeCheckNote(place)` (planner-facts.mjs) → `opening_note`, else `facts.irregular_note`,
    trimmed to 160, else null. The coordinator sets `cand.opening_note = placeCheckNote(p)` in `planner-input.mjs`
    at the merge; `checkOnDay` then falls back to its default text as today.

## A14 — rain swaps
14. `rainSwaps` passes `irregular` = the Place's `opening_days === 'irregular'` or the facts' `irregular`, as the
    planner reads it; an irregular place then reads `hours: 'unknown'` in the options. Its own closed weekday still
    rules it out.

## A9 — a conventional line between towns
15. **The model.** A ride over `INTERCITY_KM` (40) and up to `SHINKANSEN_KM` (150) straight-line km:
    `ceil(CONVENTIONAL_EXTRA_MIN + km × CONVENTIONAL_DETOUR / CONVENTIONAL_KMH × 60)` with 20 min, 1.2 and 60 km/h.
    80 km → 116 min, 85 km → 122, 100 km → 140, 150 km → 200. It is always slower than the old regional figure.
16. **Source: general knowledge, not fetched.** Limited expresses on conventional (narrow-gauge) lines average roughly
    55–70 km/h over the timetable including stops, less on winding secondary lines; their track runs some 15–35 %
    longer than the straight line between towns in hilly country; trains run about hourly or less, so the average
    wait plus a likely change adds 15–30 minutes. 60 km/h, 1.2 and 20 min sit in the middle of those ranges and put
    ~85 km inside the brief's 115–130 minutes.
17. **Kept.** The city band, the high-speed band (`SHINKANSEN_KMH`, the 15-min extra and the 1.15 factor) and every
    existing `RAIL` number are unchanged; `REGIONAL_KMH` (75) stays exported for reference but is no longer used. The
    jump at 150 km (conventional 200 min → high speed ~77 min) is wider than before; it is the existing threshold's
    assumption that a long trip has a high-speed line, left alone.

## A6 — roses and autumn cherries
18. **Roses** May–November (was May–October): repeat-flowering roses have an autumn flush from late September into
    November in temperate climates, and rose gardens hold autumn shows in October–November. General knowledge, not
    fetched. December stays out.
19. **Autumn-flowering cherries** (Prunus × subhirtella 'Autumnalis', shikizakura, jugatsuzakura, fuyuzakura,
    kofukuzakura) flower from about October to December and again in spring. A cherry place whose name or tags name
    one (`AUTUMN_CHERRY_WORDS`: "autumn(-flowering) cherry", "fall-blooming cherry", "autumnalis", the romanised
    shiki-/jugatsu-/fuyu-/kofuku-zakura, and 四季桜, 十月桜, 冬桜, 子福桜 with their kana) is in season in its spring months
    and October–December, shifted six months south of the equator like every bloom. General knowledge, not fetched.
20. The trip's forecast still wins when it speaks for cherry; `bloomKindOf` and the drop detail are unchanged.

## A4 and A5 (menus) — the dinner order
21. **Order inside each owner rank** (picks, Later, the rest): a current `yes`, then a current `partly`, then
    unchecked (`unknown`, no menu, no facts, or a check more than `MENU_MAX_AGE_DAYS` (30) days before the plan's day);
    nearest first within each. The outline's own dinner and the rainy-day indoor rule still come first, as before.
    `no` stays excluded.
22. **The plan's day** is a new optional `today` (YYYY-MM-DD) on `prepareDinners`, with `diet`. Without `today` the age
    is not judged (unknown and missing menus still go last). `planner/index.mjs` is WP-13a's, so passing
    `today: ctx.today` and `diet: profile.diet` is a REQUEST; until it is wired, a stale menu ranks as current in
    `planTrip`.
23. **The note.** `<name> · menu not checked for <diet>` (`unknown` or missing; diet from the profile's `diet`, else
    "your diet") or `<name> · menu last checked <YYYY-MM-DD>` (an ISO date, as in the other planner notes; a stale
    `partly` loses its "partly fits" note in favour of this). A current `partly` keeps "the menu partly fits your
    diet". `dinnerMenu(facts, { today, diet })` returns the group and the caveat.
24. A pool entry built without `menu_rank` (an old caller's) is ordered by `dinnerMenu` without a plan day.

## A15 — the local day
25. `dateOf(now, timeZone?)`: a Date or a timestamp gives its day in that IANA zone (Intl, no library); without a zone,
    exactly as before (the UTC day); a calendar date is returned unchanged; an unknown zone throws. `factsStale(facts,
    now, timeZone?)`, `factsLines` and `menuLine` (`{ timeZone }`) pass it through. Every existing call is unchanged.

Developed by: LightAISolutions
