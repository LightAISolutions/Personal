# Phase 14 decisions — the branch scaffold, Scout's ranking, the veg card and the brochure PDF (wave 1); lists, compare and one Discover routine (wave 2)

Brief: `helpers/prompts/TG-PHASE-14.md`. The owner's review items 15, 7, 10 and 22's note (wave 1) and 11, 12 and 16 (wave 2). Wave 1: three framework work packages built in parallel, each in its own worktree from `origin/main` at v01.65r: WP-14a and WP-14c by `hb-builder-opus` (Opus 5.5 · high), WP-14b by `hb-builder-opus-medium` (Opus 5.5 · medium); the coordinator on Opus 5.5; no Fable anywhere (the owner's rule for this phase). All data in the tests and probes is invented.

## 1 Work-package decisions
- WP-14a (the branch scaffold, item 15): `helpers/decisions/WP-14a.md`, status `helpers/status/WP-14a.md`.
- WP-14b (Scout's ranking, item 7): `helpers/decisions/WP-14b.md`, status `helpers/status/WP-14b.md`; the contract change in `helpers/decisions/TG-SCOUT.md` §10.
- WP-14c (the veg card and the brochure PDF, item 10 and 22's note): `helpers/decisions/WP-14c.md`, status `helpers/status/WP-14c.md`.

## 2 Merge choices (coordinator)
- **Order.** WP-14b, WP-14a, WP-14c, squash-merged in the order they finished onto v01.65r on the coordinator's branch (the brief asked for a, b, c). WP-14b touches only Scout's files and the Scout bars in the app; WP-14a only `helpers/tools/`; WP-14c went last as the largest. No conflict; the app's `go()` table took `vegcard` beside WP-14b's bars.
- **The coordinator's own changes**:
  - `--force` rewrites only a core module that carries the template's header ("a branch written by helpers/tools/new-branch.mjs"). A hand-built branch may carry an `@branch` line so `--check` knows its names without becoming rewritable; the veg card carries one (`gas/27_vegcard.js`). `--check scout` and `--check vegcard` both report complete.
  - **The pinned type lists stay pinned** (WP-14a's REQUEST R1, declined). Three tests hold the pack's exact envelope types and payload kinds (`pack_tour-guide_payloads`, `pack_tour-guide_schemas`, `tools_envelope`). They are a deliberate tripwire: a new envelope type is a contract change and gets reviewed in those three places. The tools README names them; WP-14c updated all three for `veg_card`, each line marked C14.
  - WP-14c's REQUESTs accepted: the three-line C14 edit to `schemas/index.mjs` (eleven payload kinds); two identical morning lines in `gas/18_morning.js`, because a free day returns early; the ownership map (SPEC §16) and the pack README name the Phase 14 paths; the app's version bump at this push.
  - WP-14b's REQUEST (the private Scout driver calls `estimateReach`) goes to WP-14p (§5).
- **Wiring at the merge.** WP-14a's `tools_new_branch` test generates four branch shapes in a temporary copy of the tree and runs each one's check, its own test, the bundle and boundary checks and the whole suite there; it ran green on the merged tree.

## 3 Probes (coordinator, invented data)
- **The veg card.** `/vegcard` opens one request, routed to trip research. A vegetarian party of two with one extra limit (alcohol), for country code JP, gets a valid card (`lang` ja; sections intro, avoid, ok, ask, thanks). The core stores it, sends it once and closes the request; the same card again with no request stays silent; `/vegcard` then shows the stored card without a new request. The morning message has its line; `vegcard.get` answers; `brochure.pdf` with no PDF starts a build, and a second tap inside a minute is refused (`too_soon`).
- **Scout.** On a tea board every item has five parts; a new place with six ratings that its judgment vouches for is rescued; a tea house is likely for the vegetarian pair; a shop name seen three times is labelled `chain` and `not_judged` and earns no local part. On a ramen board Google's vegetarian flag alone does not pass the strict meal screen (`diet_unproven`); a verified vegetarian broth passes. `estimateReach` is exported.

## 4 Checks
- `node --test helpers/tests/`: 1024 tests, 1023 pass, 1 skipped (the Maps live smoke). `bundle.mjs --all --check` ok (tour-guide 44 files); `boundary-check.mjs` clean (656 files).
- A copy laid out like helpers-dist (`<tmp>/vendor/helpers`, `node --test vendor/helpers/tests/`): 1024 tests, 1014 pass, 10 skipped (the tests that read `live-site-pages/`, which helpers-dist does not carry, and the live smoke).
- `new-branch.mjs --check scout` and `--check vegcard`: complete.

## 5 Private repo (WP-14p, wave 1)
One pull request for the owner after this push: the re-pin; a `vegcard` skill with no judgment step (the travellers' diets through `partyDiet`, then `vegCard`), sent unasked with `--dedupe-key vegcard:<trip>:<fp>` and, answering a `vegcard` request or `rebuild`, with `--in-reply-to <id>` and `--dedupe-key vegcard:<trip>:<fp>:<id>` (the core drops a repeated key for six hours, so an unchanged card answering `/vegcard rebuild` would otherwise never arrive); plan-days sends the card after a plan or re-plan; the brochure appends `vegCardHtml(card)` as its last page; Scout's driver calls the engine's `estimateReach` instead of its own estimator; the `vegcard` row in the routines table (trip research until Discover).

## 6 Wave 2, corrected against wave 1
Before spawning WP-14d and WP-14e the coordinator checked their briefs against what wave 1 built (the brief's "Checked against what wave 1 built" block):
- **File numbers.** Dry runs of both generator commands on the merged tree would both take `28_`, so WP-14d runs with `--prefix 28` (`gas/28_lists.js`) and WP-14e with `--prefix 29` (`gas/29_compare.js`). The 10–29 band is then full; the next branch takes 41.
- **Generate once.** `--force` rewrites a generated branch from the template, so neither WP re-runs the generator after filling in; both keep the `@branch` line and run `--check <name>` before finishing.
- **No new envelope type** in wave 2: the lists answer with `reply` and `places_digest`, compare with `scout`; the three pinned type lists stay as they are.
- **Routing today.** `tgKindRoutine` sends `scout` to `SCOUT` when that routine is set, else trip research; every other kind goes by `TG_KIND_ROUTINE`, else the pack's inbound routine. WP-14e's Discover table sits in front of both.
- `--discover` (WP-14e) adds `discover=yes` to the `@branch` line and a "discover routing" row to `--check`; a line without the key still parses, and output without the flag stays byte for byte the same.
- Compare's warnings reuse the words the left-out list already uses, in all three maps (the chat card, the app's Scout screen, the board).

## 7 The owner's order after this phase
The owner chose (card, 2026-10-04) to build Day trip (item 19) and What's on (item 20) before the trip: right after wave 2, ahead of Quiet (13) and Menu check (14). Then the rehearsal; after the trip, items 9, 18 and 21.

## 8 Carried on
- Wave 2's live results (the Discover routine, a Takeout export read, `/lists`, `/compare`) go in §6 and BUILD-STATE row 14 as they come.
- WP-14p wave 1 either stacks on the open Phase 13 pull request or waits for its merge.

Developed by: LightAISolutions
