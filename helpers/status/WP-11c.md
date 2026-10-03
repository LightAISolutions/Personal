# WP-11c — core: storing and showing C11, plans in parts, moving-day commands

**State: done.**
- Brief: `helpers/prompts/TG-PHASE-11.md` (Contract C11, WP-11c). Decisions and defaults: `helpers/decisions/WP-11c.md`.
- Branch `worktree-agent-aad4a7b34ce9dbfe1`, worktree `/home/user/Personal/.claude/worktrees/agent-aad4a7b34ce9dbfe1`.

## Done
- Validators: the plan-digest and shortlist JSON schemas, `checkPlanDigest` and the GAS validator (`20_envelopes.js`) accept every C11 field with its bounds and still reject unknown keys. `checkPlanDigest` enforces part/parts pairing, the Later list only in part 1, and a real-date `menu_checked`. It only changed at line 285+, clear of WP-11b's `checkTrip`/`checkPlace`.
- Storage: the C11 day fields go in `meta_json`, now chunked like the other JSON columns. `tgDigestDays` returns them only when present, and stop fields pass through inside `stops[]`.
- Plans in parts (`gas/23_plan_parts.js`): the `DigestParts` staging tab, join and checks, supersede, duplicate and refuse, 24 h expiry through the `tg_digest_parts` alarm, and one owner notice.
- Display: the day card shows the start line with bags, the end line, last entry, booking, crowd, dinner, "If you have energy" and sunset. An old day renders unchanged. The shortlist shows "local favourite", and the app's `trip.digest` carries the C11 day and stop fields.
- `/dates <date> start|end|hours|bags|clear` with validation, the `tg_trip_days` setting and `trip_update.day_overrides`. `/dates` with no argument lists the day settings.
- Docs: SPEC §5 (plans in parts), §16 (WP-11c row, plus the WP-11b `facts/` and `season/` rows the coordinator relayed), §18 (pack constants). The pack README covers payloads, the gas table, per-day settings, tests, and the WP-11b `facts/`, `season/`, `out_of_season` and screen-flag entries the coordinator relayed.
- Tests: `helpers/tests/pack_tour-guide_gas_c11.test.js` (19 tests).

## Checks (final run)
- `node --test helpers/tests/`: green.
- `node helpers/tools/bundle.mjs --all --check`: ok.
- `node helpers/tools/boundary-check.mjs`: clean.

## REQUESTs
- None.

Developed by: LightAISolutions
