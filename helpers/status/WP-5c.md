# WP-5c — status

**State:** done. Lane B, /smart, /route, decisions, mock end to end and the /plan trigger measurement are all in. `node --test helpers/tests/`: 373 tests, 372 pass, 1 skipped (pre-existing), 0 fail. Bundle check and boundary check are clean.

## Built
- `helpers/packs/tour-guide/gas/30_chat_api.js`:
  - Message handler `tg_lane_b` (Claude API). Sonnet 5.5 by default, Haiku 4.5 for short fact lookups; no tools or web; small `max_tokens`; `muteHttpExceptions`. Any error, refusal or `NEEDS_DEEP` returns false, so Lane C opens the `message` request instead.
  - `/smart on|off` stored in Settings `tg_smart`.
  - Renderer `core_status`.
  - Per-day usage in Settings `tg_chat_usage`, plus a cooldown and a daily cap.
- `helpers/packs/tour-guide/gas/31_route.js`:
  - `/route A → B [walk|transit|drive]`.
  - `tgRoute(from, to, mode)` via `Maps.newDirectionFinder`.
  - 6 h cache, daily cap, hotel resolution from the current trip.
  - A slug-like destination is written as words.
- Tests:
  - `helpers/tests/pack_tour-guide_gas_chat.test.js` (12).
  - `helpers/tests/pack_tour-guide_gas_route.test.js` (5).
  - `helpers/tests/pack_tour-guide_gas_e2e.test.js` (5): interview → prefs → /profile; the full /plan journey with trigger counting, /today and /brochure; places digest → /places → 🔁 check; review offer → fl ratings → one prefs request; refusals (shortlist `rating`, place `hours`) plus the throttled-wake +1 fallback.
- `helpers/decisions/WP-5c.md`: decisions 1–14 and §M trigger minutes, including §M.2 (/plan measured) and §M.3.

## Measured
- /plan with one More round: 4 requests, 4 routine fires, **9 one-off trigger runs ≈ 45 s**, plus 3 wake-route runs (web app, not trigger time).
- Lane B: 0 trigger runs.
- Lane C answered on time: 2 runs ≈ 10 s.

## Bugs found in WP-5a / WP-5b
None. Every scenario of the brief passes against the merged 5a + 5b code (`claude/project-thread-m0kbpq` merged into wp-5c); no test is marked todo.

## Requests to other owners
- **Harness owner (`helpers/tests/harness/gas-mocks.js`).** Mock Drive files take `created`/`updated` from the wall clock (`new Date()`), not the test clock. Under a 2027 test clock, the first sweep of a day therefore runs `core_prune_mailbox`, which trashes every `req_` file and every archived envelope as "months old". The e2e works around this by running `ctx.runDailyJobs()` once in `fresh()`. Proposed patch: give `DFile`/`DFolder` access to `state.now` and use `created: new Date(state.now()), updated: new Date(state.now())` (and the same in `setContent`).
- **Tour Guide setup notes (pack/docs owner).** Recommend `MAX_ROUTINE_FIRES_PER_DAY` = 20–24 for this helper; see decisions §M.2. The default of 12 across all routines is used up by about two full `/plan`s plus a few deep questions. Past the cap, requests wait until they expire after 24 h.
- (done by coordinator) core `redactSecrets()` covers `*_API_KEY`.
- (done, contract §1.6) free-text capture handlers are named `tg_capture_*`, so they sort before `tg_lane_b`.

Developed by: LightAISolutions
