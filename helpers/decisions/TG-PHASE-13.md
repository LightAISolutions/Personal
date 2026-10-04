# Phase 13 decisions — the fix package (trip-breakers, real stays, the vegetarian gaps, hours and rail, messages, Scout's faults)

Brief: `helpers/prompts/TG-PHASE-13.md`. Four framework work packages built in parallel by `hb-builder-opus` (Opus 5.5 · high), each in its own worktree from `origin/main` at v01.63r; the coordinator on Opus 5.5; no Fable anywhere (the owner's rule for this phase). All data in the tests is invented.

## 1 Work-package decisions
- WP-13a (the planner's day shape): `helpers/decisions/WP-13a.md`, status `helpers/status/WP-13a.md`.
- WP-13b (hours, season, rail, dinner menus, fact dates): `helpers/decisions/WP-13b.md`, status `helpers/status/WP-13b.md`.
- WP-13c (the core: stays, the lodging fingerprint, messages, Scout's words, the scouted group): `helpers/decisions/WP-13c.md`, status `helpers/status/WP-13c.md`.
- WP-13d (the Scout engine): `helpers/decisions/WP-13d.md`, status `helpers/status/WP-13d.md`.

## 2 Merge choices (coordinator)
- **Order.** WP-13b, WP-13d, WP-13a, WP-13c, squash-merged in turn onto v01.63r on the coordinator's branch. WP-13a's planner calls WP-13b's helpers (`factsStale` with its zone, the per-weekday hours wording), so WP-13b went first; WP-13d touches only the Scout engine; WP-13c, the largest and the owner of the pack README this phase, went last. Each WP kept to its own paths; the tests WP-13b changed outside them are listed in its status file.
- **The coordinator's own changes**, each with tests:
  - The journey reads a place's `facts.irregular` when it clusters candidates, so a place whose own site says its days vary is not read as closed on every journey day (WP-13b REQUEST 5, `journey/journey-areas.mjs`; `pack_tour-guide_p13_coord`).
  - The planner passes the plan's day and the party's diet to the dinner pool at all three calls (WP-13b REQUEST 1), so a stale or never-checked menu is judged in `planTrip`, `replan` and the budget path; a place's `facts.irregular_note` is the stop's check line after its own `opening_note` (WP-13b REQUEST 3, WP-13a REQUEST 4: `placeCheckNote` in `planner-input.mjs`); the planner index re-exports the new hours, facts and dinner helpers (WP-13b REQUEST 2).
  - The prefs kit takes an optional subject on apply, interview and a new `refresh` command: a profile about a companion names them in its heading ("<subject> — <title>"), its opening line and the `/profile` count line; without a subject every line reads as before. A kit-made profile is renamed on its next apply or refresh; a hand-edited one is still refused. The morning review found a companion's profile reading as the owner's.
  - A parity test holds the core's `tgScoutParse` and the engine's `parseScoutText` to the same what and where over WP-13d's grammar cases (WP-13d REQUEST 3, `pack_tour-guide_p13_parity`).
  - From probe P (§3): the morning message on moving and departure days, the dinner's menu caveat in the morning, the shared test digest's `check_on_day`, and the stale line's re-plan prompt (below).
  - **No lodging, no line.** After `/lodging clear` (or removing the last stay) the core shows no stale line. C13 carries 1–12 stays and never "no stays", so the routine keeps the stays it has and a rebuild would use them; the clear's reply says so ("The plan keeps using the old stays until you add new ones."). This answers WP-13c REQUEST 1: C13 stays at 1–12 for now, since clearing the trip file's stays is not something the owner has asked for.
  - **The stale line's prompt.** WP-13c's line named `/replan <first date still to come> <why>`. But `/replan` rebuilds one day, so following the line cleared it for the whole plan while the other changed days still started and ended at the old stay; and "Keep the plan" never cleared it. Now:
    - The line reads "⚠️ This plan was built for different lodging. `/lodging` offers to re-plan the days that changed or to keep the plan."; `/lodging` alone repeats the re-plan offer while the line shows.
    - Each change notes in `tg_plan_lodging` the earliest night it touched (`changed`: a new stay's first night, the first night of a stay it replaces, a removed stay's, the earliest cleared one; undated text, the trip's today), and the offer starts at the earliest night any change touched since the plan arrived. A change the owner let pass is no longer dropped by the next one.
    - Keep the plan sets `kept` to the current fingerprint: the line stops until the stays change again. Nothing is sent.
    - A `replan` that leaves out some of the touched days (a one-day `/replan`, a promoted rain option) carries the stored plan's own fingerprint (`tgLgStampFp`), so its digest does not clear the line; a digest with the stored record's fingerprint keeps `changed` and `kept`.
  - Docs: SPEC's stays paragraph; the pack README's "day's shape" paragraph (WP-13a REQUEST 2), the stays row and paragraph, and the new tests; WP-13c's decisions carry superseded notes on the line and the clear.
- **REQUESTs and where each went:**
  - WP-13a: (1) a trip check that still refuses an inverted or short override would stop the private routine before the planner's clamp: the private side's trip update already leaves such an override out with a reason and the run goes on (WP-13p item 7, §5), and the core keeps refusing it from `/dates`. (2) README: done here. (3) No change needed. (4) Done here.
  - WP-13b: (1)–(3) and (5) done here; (4) no change needed.
  - WP-13c: (1) decided above. (2) The private side applies `trip_update.lodging`, copies `lodging_fp`, sets `scouted` and gives Scout its inputs: WP-13p part 2. (3) The research request's lodging line can reach about 3000 characters with twelve stays: WP-13p part 2 checks the routine's limits. (4) The helper app's version, meta tag and changelog for the Places screen's scouted group: done in this phase's push.
  - WP-13d: (1) README Scout inputs: done by WP-13c. (2) The 🔁 "seen before" mark on the ranked chat line: done by WP-13c. (3) Done here. (4) The private drivers pass `known`, `city_dates`, `diet_rule` and own names, and take the city from `parseScoutText`: WP-13p part 2.

## 3 Probe P
The brief's probe: "A four-day trip with two stays, and a departure on its last day too early to fit. Day 2 has a booking at its edge; the trip also has an irregular place and a dinner place whose menu was never checked." Played on the invented "two-stays" fixture cut to four days (one night in the first town, then two in the second), with an airport added that a 110-minute train reaches five minutes too late, through the planner, the shared test digest (two parts) and the core: the day cards, the morning messages, `/trip`, then a stay change and its re-plans, and Scout's request text. It is kept as `pack_tour-guide_p13_probe` (4 tests).
- **Held as built:** the departure day comes back without stops, one transit leg to the airport and the alert "Reaches <airport> at 11:25, 5 min after the 11:20 needed for 11:30. Start earlier: /dates <day> hours 08:55 11:30"; the day-2 booking keeps its exact 17:30 and widens the day with its info line; the irregular place is planned with its own words as the check line and an `hours_unknown` info; the dinner's note says "menu not checked for vegetarian"; facts checked five days before the build raise no "facts are old"; every day passes the day-plan schema and `checkDayChain`; the core's fingerprint matches an independent FNV-1a; both digest parts pass the pack's and the core's validators; the chat sends the owner's Scout words as typed and the app writes "/scout <what> in <the trip's town>".
- **Found and fixed (§2):**
  - The morning message on the moving day said "Leave by" with the day's own start time at the station, as if that were the time to leave the lodging; it now shows the day card's start line ("🚩 Starts 12:30 at <station> · Leave your bags at <lodging> before the first sight").
  - The departure day's morning showed only the date, weather, bookings and "Free day.": no train to the airport, no end time and no alert. A day without stops that still goes somewhere now keeps its trains, its end and its warnings before "Free day."; a rest day is as it was.
  - The dinner's menu caveat was on the day card but not in the morning message.
  - The shared test digest dropped the stop's `check_on_day`, so the day card and the morning never showed the irregular line in tests (the private digest builder already passes it).
  - The stale line's prompt (`/replan` of one day) and Keep the plan, as described in §2.
- **Seen, not changed this phase:** a place the planner leaves out as `day_full` is not tried on another day; on the probe trip places near the first stay were planned on days spent at the second (each such day still passed its checks). Neither is a trip-breaker; both go to the tuning after the trip (§8). And "<what> in <a>, <b>" keeps the city "<a>, <b>" by design, so the private drivers match any comma part of `city` against the stays' and days' towns.

## 4 Checks
`node --test helpers/tests/` after each step on the coordinator's branch (the one skip throughout is the Maps live smoke, which runs only by hand):

| After | Tests | Pass | Skipped |
|---|---|---|---|
| v01.63r (the base) | 882 | 881 | 1 |
| WP-13b | 898 | 897 | 1 |
| WP-13d | 904 | 903 | 1 |
| WP-13a, with the journey's irregular-days fix | 923 | 922 | 1 |
| WP-13c, with the dinner, profile and parity changes | 972 | 971 | 1 |
| Probe P and its fixes (this push) | 978 | 977 | 1 |

`node helpers/tools/bundle.mjs --all --check` is clean (hello 19 files, tour-guide 42 files) and `node helpers/tools/boundary-check.mjs` finds nothing.

**The vendored run (v01.65r).** The private repo's re-pin runs the same tests from `vendor/helpers/`, which holds `helpers/` without `BUILD-STATE.md`, `decisions/`, `prompts/`, `status/` and `dist/`. There `pack_tour-guide_p13c_scouted` failed to load: its app-page test read `live-site-pages/helper-app.html`, outside `helpers/`. Every check above ran only in this repo's layout. The page test now skips when the page is absent; a copy laid out like helpers-dist counts 978 tests, 976 pass, 2 skipped (the live smoke and that page test), and this repo's count is unchanged. The coordinator now runs that copy before each push.

## 5 Private repo (WP-13p)
Built by `hb-builder-opus` (Opus 5.5 · high) in the private repo, on its pin, then reviewed by the coordinator; its decisions are in the private repo (`repository-information/decisions/WP-13p.md`). The owner merges its pull request.
- **Part 1, on the old pin** (nothing under `vendor/helpers/` changed): day anchors named in a CJK script are searched as words in that script (B12; the search's language code is an inference, not checked live); the routine docs name the keys and the Maps ledger the Scout answer needs (B14); owner notes keep their own labels and the owner's zone is recorded on the first run that reads the core's state (B17); the log refuses to write without a valid zone, through one log tool, so no line lands under the wrong day (B18); a lodging keeps the owner's own name and no Google address, with its coordinates refetched after 30 days (B9); one category table serves picks, skips and the post-trip review, and a single held skip stays held (B10). The plan run's trip update already leaves an override shorter than two hours out with a reason instead of stopping (item 7, WP-13a REQUEST 1). The trip's own data was corrected from its sources in the same branch (the brief's item 8). Checks: the vendored suite (879, 878 pass, 1 skipped), the journey, integration and part-1 dry runs, the boundary check; `log/` untouched.
- **Part 2, after this push** (re-pinned to this version): apply `trip_update.lodging` with its dates, with a plain refusal naming the nights no stay covers; copy `lodging_fp` into the digest's top and every part's top; re-locate a changed stay; a trip check that compares each planned day's start and end lodging with the stay covering its night; Scout's drivers (`known`, `city_dates`, `diet_rule`, own names, the city from `parseScoutText`); `scouted` on the places digest; the companion's profile refreshed through the prefs kit with its subject; the research request's longer lodging line; plain words for a skipped override instead of a schema path.
- **Merged.** Both parts went up as one pull request (the private repo's PR #24), pinned to v01.65r; the owner merged it on 2026-10-04.

## 6 Live checks
*Filled after the owner rebuilds the trip with the new stays.* The pull request is merged (§5); the owner was sent the rebuild (the day's start and bags with `/dates`, the dated stay with `/lodging`, then its 🔁 Re-plan button) and the rehearsal commands (`/morning`, `/late 30`, `/checkin` with the day's date).

## 7 Old output that moves
- **Plans that failed now build.** A departure day the plan cannot reach comes back without stops and with the `over_long_day` alert and its fix; before, the whole plan failed. An override whose end is not after its start is clamped with a warning instead of failing; `/dates` refusals end with one valid command to send.
- **Bookings.** A booking at the edge of its day keeps its time and widens the day with an info line, where it used to go to Later as outside the day; a booking dated outside the trip says so in Later instead of "closed on every day".
- **The day's end.** On a day with a hard end the last leg leaves as late as allowed, after "free time near <place> before you leave for <end>" (the spare time used to show at the end point). Evening extras no longer start before the day's start and its start step.
- **Facts and hours.** Own facts checked more than 90 days before the plan's day add "facts are old: …" and a check line. Google's "hours might differ" counts only for its own weekday. A place whose own site says its days vary is planned, with its own words as the check line. Fact dates use the local day.
- **Dinners** rank by their menu within each of the owner's ranks; a menu never checked, unknown or more than 30 days old says "menu not checked for <the diet>". The morning message now shows that note too.
- **Season and rail.** Roses run to November and autumn-flowering cherries from October to December; rail estimates between 40 and 150 km run on a conventional line (about 122 minutes for 85 km), so several between-town legs got longer.
- **Messages.** A line with many links is cut only in its visible text, so a day card with ten map links stays valid HTML. On a trip in a zone ahead of home the travel day gets one booking reminder, not two. A moving day's morning message shows the day's own start instead of "Leave by"; a departure day's shows its trains, end and alert before "Free day.".
- **Stays.** `/lodging` takes dated stays, lists them and offers re-plans; a plan built for other lodging carries the stale line in `/trip`, the day card and the morning message; `/lodging clear` and removing the last stay say the plan keeps the old stays.
- **Scout.** Chat requests carry the owner's words as typed and the app writes "/scout <what> in <where>"; the ranked chat line marks a place seen before with 🔁; the board's hours cover every date the owner spends in that city; "<topic> near <area>, <city>" belongs to the city; with a hidden-stock diet rule Google's vegetarian flag alone no longer passes a meal topic; a new place is named by its own name. `/places` and the app's Places screen show scouted candidates as their own group.
- **Profiles.** A profile written about a companion names them in its heading and its `/profile` line.

## 8 Carried on
- **The private side, part 2** (§5), then the owner's rebuild of the trip with its real stays; the live checks (§6) follow from that rebuild and the rehearsal before the trip.
- **Seen in probe P, not changed** (§3): a place left out as `day_full` is not tried on another day, and places near one stay can be planned on days spent at another. Both go to the tuning after the trip.
- **C13 and an empty stay list** (WP-13c REQUEST 1): kept at 1–12. Revisit only if the owner wants `/lodging clear` to empty the trip file's stays.
- **The rest of the approved review items** follow in the review's order.
- **A vendored-layout run in CI** (proposed, not added): Helpers CI could run the tests in a copy laid out like helpers-dist, so a test that reads outside `helpers/` fails here before the private repo sees it. It changes a workflow, so it waits for the owner's word.

Developed by: LightAISolutions
