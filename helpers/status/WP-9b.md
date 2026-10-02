# WP-9b — the Tour Guide pack's app route and its operations

**State: done.**
- `?route=app` serves 16 operations: the 15 the coordinator listed, plus `places.note`.
- Also in this WP: the setup step `app_menu_button`, the `web_app` buttons in the shortlist, plan_digest and `/places` messages, and the chat keyboard refresh after an app choice.
- The REQUESTs below are for other owners.
- Assumptions and every default: `helpers/decisions/WP-9b.md`.

## Tests
| file | tests |
|---|---|
| `helpers/tests/pack_tour-guide_gas_app.test.js` | 12 |

- **Full suite:** before, 494 tests (493 pass, 1 skipped). Now 506 (505 pass, 1 skipped, 0 fail).
- `node helpers/tools/bundle.mjs --all --check`: ok (tour-guide 26 → 27 files).
- `node helpers/tools/boundary-check.mjs`: clean.
- No existing test was changed.

**What the tests cover** (Apps Script mocks, invented fixtures):
- Every operation once, with a valid `initData`.
- A stranger's `initData` (`userId: 1`) and a tampered one → 403.
- 400 for:
  - an unknown op, a prototype name and a missing op
  - non-object args and an unknown argument name
  - a missing argument and the wrong type
  - an oversize argument, including a 2 000-character `places.search` query
  - too many entries
- `shortlist.choose` / `choose_many`:
  - observed in the Choices rows, by the chat's `sl:` lookup and by the plan flow (which builds from them)
  - the chat keyboard re-marked with `editMessageReplyMarkup` on exactly the right message ids, on both the flow path and the renderer path
- `shortlist.more` (both more and gems) and its round limit.
- `shortlist.done`:
  - inside a flow
  - adopting a round that has no flow
  - `no_picks`, `busy` with another flow open, and a round that is not the latest
- A held lock → 503, and reads still answer.
- `facts.get` / `facts.confirm`:
  - refused entries leave the flow where it was
  - a good batch moves the flow on to its questions
  - the edited dates reach the research request
  - `advance:false`
- `trip.digest` (stops, legs, rain, warnings, Later reasons).
- `brochure.get`: inline, over the size limit as a link, outside the Drive folder (refused and audited), missing, none stored.
- `places.search` (query, filters, newest 24 of 29, `total`), `places.get` (+ `note:true`), `places.note`, and `places.check` (mixed destinations, unknown slug, too many, dedup).
- `interview.bank` (with an interview in progress) and `interview.submit`:
  - every refusal
  - the exact `prefs` payload, in bank order with typed "other" values
  - the chat interview cancelled
- The setup step: without the property, with an http property, with an https property.
- `web_app` buttons:
  - only with the property, for each message type
  - without the property, messages identical byte for byte
  - the adopt re-map carries the button through
  - an http shell gives no button and an audit row
- Grep: no `photo`, `place_id` or `MAPS_API_KEY` and no `UrlFetchApp` in `32_app_api.js`; no write call carries `maps_`; the stored message ids and the Choices rows hold no Maps link.

## Files
- `helpers/packs/tour-guide/gas/32_app_api.js` (new): the route, the 16 operations, the setup step, `tgAppRows`, and the message-id store with `tgAppSendRound`, `tgAppRememberRound` and `tgAppRefresh`.
- `helpers/packs/tour-guide/gas/12_flow_plan.js`:
  - the shortlist's last message gets the app row
  - the adopt re-map goes through `tgPlanRowsOf`, which keeps `web_app` and `url` buttons
  - the digest gets the app row
  - `tgPlanOnShortlist` sends with `tgAppSendRound`
- `helpers/packs/tour-guide/gas/20_envelopes.js`: `tgEnvRender` / `tgEnvDeliver` take an optional `onSent(pairs)` hook, which runs in its own try. The shortlist handler uses it to remember message ids.
- `helpers/packs/tour-guide/gas/10_commands.js`: the `/places` overview and search list get the app row (`tgCmdAppRows`, which returns `[]` without the property).
- `helpers/packs/tour-guide/README.md`: the short "## The app" section.
- `helpers/tests/pack_tour-guide_gas_app.test.js`, `helpers/status/WP-9b.md`, `helpers/decisions/WP-9b.md` (new).

## For the coordinator / WP-9c (the shell)
- **Statuses beyond 400/404:**
  - **409** for state conflicts: `no_flow` (with `stage`), `no_more`, and `busy {flow}` when another flow is open in the chat.
  - **503 `busy`** when the script lock is held. The shell should offer a retry.
  - Every refusal is `{ ok:false, reason, status, … }`, so treating any `ok:false` the same way is safe.
- **Additions the shell may use** (all optional; nothing was renamed):
  - `shortlist.more { run, gems: true }` for 💎 More gems
  - `shortlist.get` → `flow` (whether *Done choosing* / *More* can act) and per item `gem_line`, `seen_before`, `changes`, `round`
  - `shortlist.done` → `adopted`
  - `places.note { slug }`, or `places.get { slug, note: true }`, for 📝
  - `facts.confirm { …, advance: false }` to save without moving on, and `facts.get` → `edited` / `original`
  - `interview.bank` → `in_progress`
- **`shortlist.done` with no flow** works only for the latest round of a trip still in `choosing`, and only when no other flow is open (decisions §19). `facts.confirm` advances the flow unless an entry was refused or `advance:false` is sent (§20). The brochure limit is 200 000 characters; above it the answer is a `{ link }`, and a file outside the helper's Drive folder is `no_brochure` (§25).
- **Telegram calls in the live check (Step 4):** a choice in the app makes one `editMessageReplyMarkup` per affected chat message. It never sends a new message.

## Requests to other owners
**R1 — coordinator (bookkeeping, at merge):**
- In the pack README's `## Chatbot — gas/` table, add a row for `32_app_api.js`: "`?route=app` for the Mini App (16 operations, see "The app"), setup step `app_menu_button`, the 📱 `web_app` buttons and the shortlist message-id store `tg_app_sl_msgs`".
- In the same README's `## Tests` list, add `pack_tour-guide_gas_app`.
- Both are outside the one section this WP may edit.

**R2 — coordinator (TG-PHASE-9 decisions / SPEC §5–§7 at merge): record two choices.**
- **Typed "other" polarity.** A typed "other" interview value takes the question's first option's polarity, as the chat does, not `'+'` as the coordinator's message said (decisions §22).
- **Status codes.** The route uses 409 and 503 in addition to 400 and 404 (decisions §7).

**R3 — WP-9c (optional): the shell's button for the brochure screen.** The digest's app button opens `screen=brochure&trip=<slug>`. When `brochure.get` answers `no_brochure`, the shell can still show the days from `trip.digest`, since the plan exists before any brochure is built.

**R4 — core (optional, later):** a registered `webapp` route has to take the script lock itself (the router takes it only for `?route=tg`). A `lock: true` flag on `registerRoute` would let packs drop their own `tryLock` code. This is not needed now.

Developed by: LightAISolutions
