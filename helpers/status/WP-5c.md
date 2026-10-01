# WP-5c — status

**State:** in progress — Lane B, /smart, /route, decisions done; mock e2e waits on WP-5a / WP-5b.

## Built
- `helpers/packs/tour-guide/gas/30_chat_api.js` — message handler `tg_lane_b` (Claude API; Sonnet 5.5 default, Haiku 4.5 for short fact lookups; no tools/web; small `max_tokens`; `muteHttpExceptions`; any error / refusal / `NEEDS_DEEP` → false so Lane C opens the `message` request), `/smart on|off` (Settings `tg_smart`; `on` without `CLAUDE_API_KEY` stores nothing and names the property), renderer `core_status` (`Answers: free (routines)` / `Answers: smart (Claude API, paid per use)` / key-not-set note), per-day token + $ usage in Settings `tg_chat_usage` (35 days), cooldown, daily cap.
- `helpers/packs/tour-guide/gas/31_route.js` — `/route A → B [walk|transit|drive]` (also `->`, ` to `), `tgRoute(from, to, mode) → {ok, minutes, distance_m, mode, maps_url, summary, error?}` via `Maps.newDirectionFinder`, 6 h cache, daily cap, hotel/lodging resolution from the current trip.
- `helpers/tests/pack_tour-guide_gas_chat.test.js` (12), `helpers/tests/pack_tour-guide_gas_route.test.js` (5).
- `helpers/decisions/WP-5c.md` — decisions 1–14 and §M trigger-minute measurement.

## Next
1. When `WP-5b` and `WP-5a` say done: `git merge wp-5b wp-5a`, write `pack_tour-guide_gas_e2e.test.js` (interview → prefs → /profile; /plan journey; places; review offer; wake + after() fallbacks; validate refusals), count /plan trigger runs and complete §M.2.
2. Bugs found in 5a/5b → listed here with patches, affected test marked todo.

## Requests to other owners
- (done by coordinator) core `redactSecrets()` covers `*_API_KEY`.
- (done, contract §1.6) free-text capture handlers named `tg_capture_*` so they sort before `tg_lane_b`.

Developed by: LightAISolutions
