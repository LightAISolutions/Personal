# WP-1b — Core flows + document delivery: decisions

All choices are defaults the coordinator may overturn; none needed the owner.

1. **Extra `expect` column.** The `Flows` tab carries `expect` (`button | text | any | paused`) beside the contract's six columns so the router can decide whether to claim free text without parsing `state_json`. `pause` is stored as `expect = paused`, not as a separate flag.
2. **Step counter in the callback data.** Buttons are `fl:<step>:<value>`; a tap whose step is not the current one is answered "That question has moved on." and ignored, so stale keyboards from earlier steps cannot advance the flow. The tapped message's keyboard is cleared with `editMessageReplyMarkup`.
3. **The core encodes keyboards.** Packs write `{text, value}` rows; the core builds the `fl:` data. A pack cannot register its own `fl` prefix (`_regPut` throws on the duplicate), so the flow claim cannot be bypassed.
4. **`/cancel` lives in `15_flows.js`**, not `11_commands_builtin.js`, keeping every flow concern in one file; the builtin-commands file is unchanged. "Nothing to cancel." when no flow is active.
5. **Commands always win.** A command during a flow runs normally and the flow stays where it was; only free text and `fl` buttons are claimed. A text message while `expect = button` gets "Please use the buttons above, or send /cancel to stop." and does not open a request.
6. **An error in `next()` ends the flow.** The row is deleted, `flow_error` is audited and the owner is told `⚠️ <flow> stopped: <reason>`; `flowResume` returns `{done: true, error}`. A flow stuck on a throwing step would otherwise hold the text claim for 24 h.
7. **`flowStart` replaces a running flow** (audit `flow_replaced`) rather than refusing — the newer intent wins, as with a fresh `/plan` over a half-answered interview.
8. **Oversize state throws** before the row is written (`state_json` > `FLOW_STATE_MAX_CHARS` 40 000); the previous step stays current.
9. **`flow_done` audits `{steps}` only** — the result is the pack's to persist in `onDone`; audit rows stay small.
10. **`drive_file_ids` are sent after the text, silently, captioned with the label**, one `sendDocument` each, at most `REPLY_MAX_DOCUMENTS` (10). A missing file audits `document_not_found` and the reply is still delivered.
11. **Blob-only oversize has no link fallback** (`{ok: false, description: 'document_too_large'}`) — there is no Drive URL to send; Drive-backed files fall back to `📎 <name> (N MB, too large to attach)` + the file URL.
12. **`reply_to_message_id` is stringified** like the rest of the multipart params; Telegram accepts it.
13. **`flows_active` snapshot provider** exposes `{chat_id, flow, step, expect, updated_at, expires_at}` so the brain can see a conversation is mid-way without reading the Sheet.
14. **Harness `loadGas({state})`** reuses a prior load's mock state; it is how "state survives a fresh execution" is tested without a real Sheet.
15. **`fctx.chatId` is passed through as given** (string from Telegram, whatever the pack passed to `flowStart`); packs should `String()` it when comparing.

Developed by: LightAISolutions
