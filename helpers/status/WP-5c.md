# WP-5c — status

**State:** in progress (paused on the usage-limit cue, 2026-10-01) — nothing built yet; orientation done.

## Where I stopped
- Read: the shared rules, `helpers/prompts/TG-PHASE-5.md` (row 5c), `helpers/decisions/TG-PHASE-5.md` §1, SPEC §5/§8/§9, core `00_config` `01_util` `02_registry` `03_store` `05_telegram` `10_router` `11_commands_builtin` `12_wake` `13_routines` `15_flows`, the harness, `core_flows.test.js`, plan §5.8/§5.9/§8 and decision 6, AB `docs/SPEC.md` §8 (12–24 of 90 trigger-min/day; web-app executions do not count).
- No file of `gas/30_chat_api.js`, `gas/31_route.js` or the tests written yet. WP-5a and WP-5b had no commits yet when I looked.

## Next steps (in order)
1. `gas/30_chat_api.js` — message handler `tg_lane_b` (off unless `CHAT_API_ENABLED === 'true'` and `CLAUDE_API_KEY` set; no current trip → false; cooldown and daily cap → false; Sonnet 5.5 default, Haiku 4.5 for short lookup questions; `thinking: between_tools` + effort low on Sonnet; `NEEDS_DEEP` sentinel → false so the core opens the `message` request; refusal / error → false; usage per day in Settings `tg_chat_usage`; own redaction of the key).
2. `gas/31_route.js` — `/route A → B [walk|transit|drive]` (also `->`, ` to `), `tgRoute(from, to, mode)`, Maps link, cache 6 h, daily cap; mock `Maps` set on the vm ctx in the test (no harness change needed).
3. Tests `pack_tour-guide_gas_{chat,route}.test.js` incl. the Lane C baseline measurement (count triggers via a `scheduleOneOff` spy, UrlFetch calls); `helpers/decisions/WP-5c.md` with defaults and the trigger-minute note; commit.
4. After WP-5b / WP-5a say done: merge, write `pack_tour-guide_gas_e2e.test.js`.

## Requests to other owners (planned)
- Core (coordinator): `redactSecrets()` does not cover `CLAUDE_API_KEY` / `MAPS_API_KEY` (`SECRET_PROP_KEYS` holds only core keys; tour-guide `property_prefix` is ''). Proposed patch: in `01_util.js` match `/ROUTINE_FIRE_TOKEN_|_API_KEY$/` alongside `SECRET_PROP_KEYS`. 30_chat_api.js redacts its own key meanwhile.
- WP-5b / WP-5a: any free-text capture handler (✏️ edits) must sort before `tg_lane_b` (e.g. `tg_capture_*`), or Lane B (when on) would answer the edit text.
