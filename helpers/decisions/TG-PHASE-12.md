# Phase 12 decisions — usefulness pass, step 3 (the morning message, running late, re-plans from where you are, the evening check-in, a rehearsal)

Brief: `helpers/prompts/TG-PHASE-12.md`. Every work package was built by `hb-builder-opus` (Opus 5.5 · high) from `origin/main` at v01.55r or from the merge before it; no Fable anywhere (the owner's rule for this phase). All data in the tests is invented.

## 1 Work-package decisions
- WP-12a: `helpers/decisions/WP-12a.md`.
- WP-12b: `helpers/decisions/WP-12b.md`.
- WP-12d: `helpers/decisions/WP-12d.md`.
- WP-12r: `helpers/decisions/WP-12r.md`.

## 2 Merge choices (coordinator)
- **Order.** WP-12a, then WP-12b, squash-merged in turn onto v01.55r on a local integration branch; then WP-12d (built from WP-12a's merge), then WP-12r (built from WP-12b's merge, with WP-12d merged in while it worked). Each WP kept to its own paths and no merge needed conflict resolution. The one edit outside an owner's paths: WP-12r changed one assertion in WP-12b's running-late test, because its join-mode fix moves that output (§6).
- **The coordinator's own changes**, each with tests:
  - Journey plans write the "no room left on <day> for …" Later reason in the day card's words, as the planner now does (WP-12d REQUEST 1, `journey/journey-assemble.mjs`).
  - A booked stop is a must for the day's solver on any plan, as an outline anchor is (WP-12r REQUEST 1, `planner/planner-day.mjs`). A booked place only ever reaches its booking's own date (`planner-assign.mjs`), so the booking is that day's. Before, a re-plan from 14:31 kept an unbooked museum and dropped the gallery booked for 15:45, which then sat under "If you have energy" while the day card said ✅ booked. No fixture's first plan moved.
  - On a re-plan the owner's chosen dinner keeps its rank (WP-12r REQUEST 2, `planner/planner-dinner.mjs` `prepareDinners`). A re-plan passes `places: plan.places` (WP-12a REQUEST 3), where the planner itself wrote the evening's dinner as `scheduled`; that status now gives way to the input list's own (`chosen`), so a saved-for-later dinner no longer takes its place.
  - The rehearsal's two `todo` tests became ordinary tests, and its `/review` test now expects the kept gallery among the stops it asks about.
  - Docs: SPEC §5 gains the `lg` callback and `26_lodging`; the pack README gains the brochure's undated-booking and day-words sentence (WP-12d REQUEST 3), the undated booking on the day card, the Paying dedupe, the joined-leg mode rule, `gas/26_lodging.js` and the new tests (WP-12r REQUEST 5).
- **REQUESTs and where each went:**
  - WP-12a: (1) the brochure names a `here` end and shows visited stops: done by WP-12d. (2) The digest maps `leave_by`, `areas`, `visited` and `here`, and the `replan` request is checked with the planner's own bounds: done by WP-12b. (3) Re-plans pass `places: plan.places`: done in the rehearsal; the private routine is WP-12c's.
  - WP-12b: (1) the private digest builder fills C12, stations from the places' own access notes only: WP-12c (the rehearsal's shared `digestOf` already does). (2) Until the private repo pins Phase 12, a re-plan from here would re-plan the whole date: WP-12c re-pins before the trip, and the core refuses a re-plan from here except on a trip day while the trip is in progress (`gas/24_here.js`), so none reaches the old routine before then (§7). (3) Feed `from`, `visited` and `rain` straight to `replanDays`: done in the rehearsal, WP-12c in the private routine. (4) A location-only message to the hello pack is now ignored silently (it used to answer "I only read text"): noted in the CHANGELOG.
  - WP-12d: (1) journey reasons in day words: done here. (2) The Telegram day card shows an undated booking on the day its place is planned: done by WP-12r ("planned for <day>"). (3) README sentence: done here.
  - WP-12r: (1) and (2) the planner faults: done here; (7) follows from (1). (3) The private digest builder maps C12 as the shared `digestOf` does and clips day warnings to 20 × 200 characters with "…" (the core rejected a whole digest for one long `order_disagreement` warning): WP-12c. (4) A lodging-change `replan` carries the new lodging only in `reason`: WP-12c reads it there (§7). (5) SPEC and README: done here. (6) WP-12b's late test line: accepted as it stands.
- **Phase 11's carried items** (`TG-PHASE-11.md` §7), all met in this phase:
  - The phone clock beside a numbered stop badge: WP-12d (one rule in the phone media query; A4 pixel-identical; golden hashes moved deliberately, with a proof that reverting the rule gives the old ones back).
  - Later reasons and the "Taken off the plan for …" note in the day card's words: WP-12d (planner and brochure) and the coordinator (journey).
  - A booking with no date: shown on the first day its place is planned, never written into `for_date` (a dated booking becomes an anchor): WP-12d (planner and brochure) and WP-12r (the Telegram day card and booking reminders).
  - The home zone: the rehearsal checks that the trip record spans the whole journey, that reminders use the home zone before and after it, and the trip's zone for bookings, the morning message and the check-in during it.
  - A lodging change: after `/lodging` on a trip with planned days not yet over, the reply offers to re-plan every planned day from the trip's today on, or to keep the plan (WP-12r, `gas/26_lodging.js`).

## 3 Checks
`node --test helpers/tests/`, `node helpers/tools/bundle.mjs --all --check` and `node helpers/tools/boundary-check.mjs`, after each merge:
- v01.55r (the start): 781 tests, 780 pass, 1 skipped (the live Maps smoke, by hand only).
- WP-12a: 805 tests, 804 pass, 1 skipped. WP-12b: 845, 844 pass, 1 skipped. WP-12d: 862, 861 pass, 1 skipped. WP-12r: 879, 876 pass, 1 skipped, 2 `todo` (its two planner REQUESTs). Bundle ok and boundary clean each time.
- After the coordinator's fixes, before the push: 879 tests, 878 pass, 1 skipped, 0 `todo`; bundle ok (hello 19 files, tour-guide 42 files); boundary clean (591 files). The Chromium phone-clock test (`kit_brochure_c12.test.js`) runs here, and each planner fix fails its rehearsal test without it.

## 4 Private repo (WP-12c)
*Filled when its pull request is up.*

## 5 Live checks
*Filled after the owner merges WP-12c's pull request and runs the rehearsal steps (the brief's coordinator step 6).*

## 6 Old output that moves
The morning message, running late, the re-plan from here and the check-in are new, so none of their output moved. What existed before and now reads differently:
- Later reasons ("no room left on Thu 10 Jun for …", "closed on Mon 18 Oct") and the brochure's "Taken off the plan for Fri 14 May." note name the day as the day card does, instead of `YYYY-MM-DD`. A reason stored by an earlier build keeps its text until the next build or re-plan; the note changes at once.
- The brochure's phone layout: the clock beside a numbered stop badge is whole, so old plans' HTML hashes changed (A4 is pixel-identical). The Bookings page's day labels use the day card's month words ("Sep", where ICU printed "Sept").
- A booking with a place and no date now shows on the first day its place is planned: on the stop's row and the Bookings page ("Planned for <day>."), on the day card and in booking reminders ("planned for <day>").
- When a day is too full, a booked stop now outranks every unbooked one, on a first plan or a re-plan (no fixture's plan moved), and a re-plan keeps the owner's chosen dinner.
- `/lodging` on a trip with planned days not yet over adds one line and two buttons (re-plan those days, or keep the plan); otherwise its reply is as before.
- The hello pack ignores a location-only message silently (it used to answer "I only read text").

## 7 Carried on
- **The private side must merge before the trip.** Until the private repo pins v01.56r (WP-12c), its routine ignores a re-plan's `from`, `visited` and `rain` and would re-plan the whole date, and it plans a lodging change from the lodging it already knows. The core refuses a re-plan from here before the trip, but a lodging-change re-plan can be tapped at any time.
- **The new lodging travels only in the `replan` request's `reason`** (`trip_update` has no lodging field). If the private side finds the words too loose to plan from, a `lodging` field in the contract is the next step.
- **The re-plan from here needs a real trip day**, so it is first checked on the trip's first morning; what that shows goes to Phase 8 part 2 with the rest of the trip's notes.

Developed by: LightAISolutions
