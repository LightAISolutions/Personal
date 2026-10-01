# WP-1b — Core flows + document delivery: status

**State: done** (2026-10-01). Branch `wp-1b`, worktree `/home/user/wt-4b-1b` (based on `c17cd68`, v01.19r), never pushed.
Design choices and reasons: `helpers/decisions/WP-1b.md`.

## Contract (TG-PHASE-4B.md row 1b)
| Item | State |
|---|---|
| `core/15_flows.js`: `registerFlow(name, {start, next, onDone?, ttl_min?})`, `flowStart`, `flowActive`, `flowResume`, `flowCancel` | done |
| Step shape `{prompt, keyboard?, expect: button\|text\|any, state, done?, result?, pause?}` | done — `{text, value}` rows encoded by the core as `fl:<step>:<value>` (≤64 bytes via `cbEncode`); `{text, url}` rows pass through |
| Router: active flow has first claim on free text and `fl` callbacks, after commands, before message handlers and before a request opens | done — `flowClaimText(ctx)` in `10_router.js`; `registerCallback('fl', …)` in `15_flows.js` |
| `/cancel` | done — registered in `15_flows.js` (see decisions); `11_commands_builtin.js` untouched |
| State in the `Flows` tab, survives a fresh execution, expires after `ttl_min` (default 1 440) | done — `SHEETS.FLOWS`, headers `chat_id flow step expect state_json updated_at expires_at` |
| `expireFlows()` in the sweep: tells the owner once, audits each | done — `12_wake.js` `r.flows_expired`; audit `flow_expired` per row |
| `pause` keeps state, releases the text claim until `flowResume` | done — stored as `expect = paused` |
| `tgSendDocument(chatId, {driveFileId \| blob, filename, caption})` multipart `sendDocument`, ≤50 MB, larger → Drive link + audit `document_too_large` | done — plus `tgSendOwnerDocument(spec)`, `tgApiMultipart(method, params)` |
| `reply` payload `drive_file_ids?: {<label>: <id>}` (SPEC §2) | done — validated in `09_mailbox.js`; each sent as a silent captioned document after the text |
| Tests: three-step flow, expiry, `/cancel`, command interrupt, state across executions, pause + resume; `sendDocument` body + size fallback | done — `tests/core_flows.test.js` (8 tests) |
| SPEC §2 / §5 / §6 / §8 / §16 / §18 | done |

## Files
- New: `helpers/core/15_flows.js`, `helpers/tests/core_flows.test.js`, this file, `helpers/decisions/WP-1b.md`.
- Edited: `helpers/core/00_config.js` (five `LIMITS`, `SHEETS.FLOWS`, headers), `02_registry.js` (bucket `flow`), `05_telegram.js`, `09_mailbox.js`, `10_router.js`, `12_wake.js`, `helpers/SPEC.md`, `helpers/tests/harness/gas-mocks.js` (`loadGas({state})` reuses a prior load's state = fresh execution against the same data), `helpers/tests/core_setup.test.js` and `core_store.test.js` (six core tabs).

## Checks (run from /home/user/wt-4b-1b/helpers)
- `node --test tests/` → 235 tests, 234 pass, 1 skipped (pre-existing), 0 fail.
- `node tools/bundle.mjs --all && node tools/bundle.mjs --all --check` → `ok: hello — 17 files`, `ok: tour-guide — 16 files`.
- `node tools/boundary-check.mjs` → clean.

## Requests to the coordinator
- README tree entries for the two new core/test files and the two WP files (bookkeeping, push time).
- Phase 5 (Telegram commands) should build its interview, choose and replan conversations on `registerFlow` rather than on ad-hoc message handlers; `fl` is reserved.
- `helpers/packs/tour-guide/` (WP-4c) may now emit `reply` envelopes with `drive_file_ids` for notes and brochures instead of pasting Drive links into the text.

Developed by: LightAISolutions
