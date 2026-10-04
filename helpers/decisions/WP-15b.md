# WP-15b — decisions (What's on, the season sheet and the evening)

Brief: `helpers/prompts/TG-PHASE-15.md` "WP-15b" (item 20), Contract C15. Every default picked while building, with its
reason.

## The season sheet
1. **`chosen_on` is checked in `checkSeason`, not by the schema alone.** The schema says "a date"; the range rule
   (`from ≤ chosen_on ≤ to`) needs the event's own dates, so it sits next to the other cross-field rules. A
   `chosen_on` that is not a calendar date is refused there too, at the same path.

## The evening (change E)
2. **"Under way" means it starts before the earliest time you can get there**, `from = max(finish + AFTER_MIN, ready)`,
   not just before `finish`. An event starting between the finish and `from` is offered at `from`. Since `from ≥ ready`,
   this includes A12's rule unchanged.
3. **An event that is under way but has no end time is not offered.** We cannot tell how much of it is left. A12
   already treated it this way.
4. **`finish` is the planner's own `evening.finish`, the time back at the end point before dinner.** Saved places already
   use it, so the extras keep one time base. An extra may still overlap dinner, as saved places could before. The day
   view lists dinner first, so the owner sees both.
5. **A chosen event the planner cannot locate is skipped without a warning.** Its distance is unknown, and an
   unchosen event with no location is skipped the same way. The warning is for a choice we know is far.
6. **A chosen event that is not an evening choice is never considered as an extra**, not even on its `chosen_on`. Chosen
   events are sorted by distance among themselves. The warning's N is `Math.round(km)`. It is pushed only while the day
   has fewer than 40 warnings (the schema's cap), and only when the caller passes `warnings`. `planner/index.mjs` passes
   the day's own list.
7. **⭐ replaces ✨** on a chosen event in the chat and the app, one emoji per line. A chosen event that is not first (an
   older build's order) keeps its ⭐ under the usual heading. "This evening" applies only when the first extra is chosen,
   as the brief says.
8. **The app's day view gets `chosen` only once `32_app_api.js` `tgAppDayC11` passes it through.** That file is not mine,
   so this is a REQUEST in the status file. Until then the app shows the old heading and ✨ for every event, which is
   still correct. The renderer is tested directly.

## The owner's words (`parseWhatsonText` and the core's `tgWhatsonParse`)
9. **The window is the longest run of words at the end that reads as a `<when>`; the rest, minus a leading "in", is the
   place.** "Old Quay" stays a place; "30 Feb" and "2027-02-30" are not dates, so they stay part of the place.
10. **A year-less end date is the first one on or after the start,** except that the same month with an earlier day
    ("May 20-10") reads as reversed rather than jumping a year.
11. **`this week` and `this weekend` on a Sunday mean today.** `next week` is always the coming Monday to Sunday.
12. **The checks run in this order: reversed, past, then a start before today is moved to today, then too long**
    (`to − from > 30`). So "2027-05-01 to 2027-05-20" on 12 May asks for 12–20 May. A place over 80 characters is
    refused (`long_place`), since the request's `place` is 1–80.
13. **"Today" is the current trip's today when there is a trip, else the home zone's.** With no `<when>` and a trip that
    is over or has no dates, the window is today and the next 6 days. The request carries `trip` when no place is named
    or when the window meets the trip's dates.

## The engine
14. **`eventId` falls back to `e` + FNV-1a hex** for a name with no Latin letters or digits, so it is still a stable slug.
    Names are folded with NFKD and the marks removed, for ids and for duplicate matching alike.
15. **Duplicates: the confirmed one wins, then the one with more fields, then the first.** A find that cannot become an
    item (no url, a bad date) goes to `left_out` as `other`; a find with a blank name is dropped, as it has nothing to
    name. Two different events that would share an id get `-2`, `-3`.
16. **`whatsonPayload` trims items from the end until the board fits 40 000 characters** and counts them in `more`.
17. **`toSeasonEvent` narrows an item with `days` to its chosen day** (the season event has one run), and throws on a
    day the item does not run. **`mergeChosen` treats the choices as the whole current set:** a `wo-` event no longer
    chosen is dropped, any other event loses its `chosen_on`. It reports these as `unmarked`, besides the brief's
    `{ season, added, marked, dropped }`. With no sheet yet it starts one (`checked` = the newest `chosen_on`).
18. **The fixture keeps the rules a JSON schema cannot say in a separate `semantic` list.** The schema subset accepts
    them; both validators and `checkWhatson` refuse them. `checkWhatson` is ready for `schemas/index.mjs` KINDS (a
    REQUEST). `whatson-payload.mjs` checks the schema itself (`validateSubset`), so it never imports `schemas/index.mjs`.

## The core
19. **The board key is always `k` + 12 hex of the board id**, never the id itself. Buttons carry the item's 1-based
    position on the board plus `tgCmdTag(item id)`, like the Later list's, so a re-delivered board cannot make them pick
    the wrong item.
20. **The days an item can be chosen for are its days in the window, within the trip's start..end when the board's trip
    is on file with dates.** No such day: refused ("It runs on none of the trip's days").
21. **A re-delivered board keeps a choice only while its item is on the board and still runs on the chosen day.** A choice
    outside the item's run could not become a valid `season_event` (`checkSeason` refuses it).
22. **Item names and sources link to their own https pages.** The validators allow https only, and Telegram shows the
    address before it opens a link; a Maps-only rule (`tgCmdHref`) would leave every name unlinked. Places keep the
    Maps rule.
23. **The card is one message:** its cap is the smaller of 4 000 and the core's split point (`LIMITS.TG_SPLIT_AT`, 3 900),
    so the "… and N more in the app" line is never split off. Each item is numbered in the card's order; the ➕ buttons
    show the same numbers. A line "· N days" is added when an item runs on several but not all days of the window.
24. **The weekly check runs from the trip's today** (`from = max(today, first day)`) and records that date. A trip whose
    today is past its last day has no check. While its last request is open, a trip is held back an hour at a time. A
    newly added trip whose first check day has passed is checked at the next alarm run.
25. **An `auto` board is compared with the stored board of the same id, else the newest with the same trip and place
    slug.** With none, every item is new. Every auto board is stored.
26. **The snapshot keeps boards without a trip and boards whose trip is not done (or is not on file).** `chosen_at` is the
    choice's own time; ties keep the board list's order.
27. **`whatson.new` builds the same words the command takes** (`<place> <from> to <to>`) and uses the command's resolver,
    so the app and the chat cannot disagree. `whatson.choose` answers 409 `which_day` with the days when more than one
    fits and none was given.
28. **Two bookings test files set `whatson_auto` off in their setup.** Their trips start within 21 days, so the weekly
    check is due at once and takes the one alarm trigger first; the tests watch the bookings alarm alone (C15).

## The screen (`helper-app.html`)
29. **The screen says the core's reasons in its own words first (`WO_WHY`), then falls back to the shared `WHY`.** The
    shared map's `too_long` means a typed text over 80 characters; for What's on it means a window over 31 days. The shared
    map and the page's CSS are left alone, so the screen's lines stay inside its own section (date fields and button rows
    are styled inline: the page's input rule covers text and search only, and rows must wrap on a phone).
30. **A tap on Choose for an item with one day sends no `chosen_on`; the core picks the day.** With several days the
    screen asks "Which day?" (the first 8) without a call. A `which_day` answer from the core (the trip changed since the
    board was drawn) shows the core's days.
31. **Re-plan shows on every chosen item whose day is in the board's `planned` dates**, not only right after the choice,
    so a choice made in the chat can be re-planned from the app. It calls `whatson.choose` with `choose: true`, the
    chosen day and `replan: true`; that refreshes the choice's `at`, which only orders the snapshot.
32. **After a choice the board is redrawn in place from the answer's `board`,** so the page keeps its scroll position. The
    confidence shows as a pill ("confirmed" or "dates not yet confirmed"), labels in words, and `more` as "… and N more
    that did not fit". A board opens from `&board=` (or `board=` in `start_param`) only when it is a board id.

Developed by: LightAISolutions
