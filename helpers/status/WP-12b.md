# WP-12b status — Core: the morning message, running late, re-plan from here, the evening check-in

Branch `worktree-agent-aa370866e8cba184f` (worktree of `origin/main` at v01.55r). Brief: `helpers/prompts/TG-PHASE-12.md`.
Decisions and defaults: `helpers/decisions/WP-12b.md`.

## Step 0
- Read CLAUDE.md, SPEC §5/§16/§18, the pack README, TG-PHASE-10/11, WP-11a/11c/11f and every file the section names.
- Baseline in the worktree: `node --test helpers/tests/` 781 tests (780 pass, 1 skipped), `bundle.mjs --all --check` ok,
  `boundary-check.mjs` clean.

## Done
- C12 in the digest: schema, `checkPlanDigest`, the GAS mirror, storage, dinner place facts (`pack_tour-guide_gas_c12`).
- Weather from Open-Meteo, `/dates <date> weather <town>` (`15_weather.js`).
- Running late: overlay, `/late`, `rl` buttons, Undo, the day card (`19_late.js`).
- The morning message: alarm `tg_morning`, `/morning`, pin and unpin (`18_morning.js`).
- Re-plan from here: `rp`, the question, the C12 `replan` request, the location's one path; core router withholds
  locations from the queue and drops unclaimed location-only messages (`24_here.js`, `core/10_router.js`).
- The evening check-in: alarm `tg_checkin`, `/checkin`, `ci` buttons edited in place, Choices run `checkin`
  (`25_checkin.js`); the review skips rated stops, 📨 Send my ratings (`rv:send`), Review again, the merge
  (`13_flow_review.js`).
- Docs: SPEC §5 ("Trip days", the message-handler row), §16 (WP-12b row), §18 (pack limits); pack README; `helper.json`
  description.
- Checks: `node --test helpers/tests/` 820 pass, 0 fail; `bundle.mjs --all --check` ok; `boundary-check.mjs` clean.

## REQUESTs
1. **Coordinator / WP-12c — fill the digest's C12 fields** in the private repo's `digestOf` (and the Phase 12
   rehearsal): `country_code`, day `areas` and `leave_by`, stop `local_name` / `address` / `payment` / `price_line` /
   `close` / `visited`, leg `stations` **from the places' own access notes only**, and the four dinner fields I added
   (`local_name`, `address`, `payment`, `price_line` on `dinner`, same bounds) from the dinner place's own facts.
2. **Coordinator — the old pin.** Until the private repo pins Phase 12, a re-plan from here re-plans the whole date
   (the old PLAN routine does not read `from`, `visited`, `rain`; unverified against the private repo, which this WP
   cannot read). Either land the pin with this merge or add a line to the confirmation message; I left it unchanged.
3. **Coordinator — the rehearsal (row R).** `planner.replanDays` ignores `rain` and `visited` without `from`, so the core
   offers ☔ Rain only when there is a current stop. Feed the request's `from` / `visited` straight to `replanDays`; a
   shared point arrives as `from.point` rounded to 5 decimals.
4. **Coordinator — the hello pack.** The router change means a location-only message to the hello pack is now ignored
   silently (it used to answer "I only read text"). Its tests still pass; say so in the CHANGELOG if you want it noted.

Developed by: LightAISolutions
