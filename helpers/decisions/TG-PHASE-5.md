# Phase 5 — Chatbot feature pack (`helpers/packs/tour-guide/gas/`): decisions

> Coordinator: Opus 5.5 · high (thread "Phase 5 Telegram commands", 2026-10-01). Prompt `helpers/prompts/TG-PHASE-5.md`. Work packages in worktrees, never pushed on their own: **5a** commands and flows, **5b** envelope handlers and sheets, **5c** Lane B, `/route`, measurement and the mock end-to-end (each `hb-builder-opus`). Per-WP reasons: `helpers/decisions/WP-5{a,b,c}.md`; state and requests: `helpers/status/WP-5{a,b,c}.md`. No live Telegram, Drive, Maps, Claude API, wake-route or routine call was made in this phase.

## 1. Cross-WP contract (written before the fan-out; WPs build against it)

### 1.1 Files and owners (extends `helpers/SPEC.md` §16)
| Path | Owner |
|---|---|
| `gas/00_common.js` (routing map, `tgOpenKindRequest`, `tgSlug`, `tgOwnerChat`, `tgLines`, `TG_SETTINGS`), `helper.json`, the pack README, `helpers/decisions/TG-PHASE-5.md` | coordinator |
| `gas/10_commands.js`, `gas/11_flow_interview.js`, `gas/12_flow_plan.js`, `gas/13_flow_review.js`, `gas/40_interview_bank.js` (generated), the generator step in `helpers/tools/bundle.mjs` + its test in `helpers/tests/tools_bundle.test.js`, `helpers/tests/pack_tour-guide_gas_{commands,interview,plan,review}.test.js`, `helpers/status/WP-5a.md`, `helpers/decisions/WP-5a.md` | WP-5a |
| `gas/20_envelopes.js`, `gas/21_sheets.js`, `helpers/tests/pack_tour-guide_gas_{envelopes,sheets}.test.js`, `helpers/status/WP-5b.md`, `helpers/decisions/WP-5b.md` | WP-5b |
| `gas/30_chat_api.js`, `gas/31_route.js`, `helpers/tests/pack_tour-guide_gas_{chat,route,e2e}.test.js`, `helpers/status/WP-5c.md`, `helpers/decisions/WP-5c.md` | WP-5c |

### 1.2 Request routing (`00_common.js`)
`research → RESEARCH`, `plan · replan → PLAN`, `notes → NOTES`, `brochure → BROCHURE`, `prefs → PREFS`, `places → PLACES`, `message · ask → CHAT` (the private repo's `routines/README.md`). Every pack request goes through `tgOpenKindRequest(kind, payload, { chat, text, ack, replyTo })`; payload fields are exactly TG-PHASE-4B §5.

### 1.3 Storage API (WP-5b, `21_sheets.js`; everyone else calls these, never `storeAppend` on a pack tab)
| Function | Returns / does |
|---|---|
| `tgTripGet(slug)` · `tgTripList()` · `tgTripUpsert(obj)` · `tgTripCurrent()` | Trip row objects (`Trips` columns); upsert by `slug`; current = `Settings.tg_current_trip` if that row exists and is not `done`, else the trip whose `start ≤ today ≤ end`, else the next upcoming, else null |
| `tgTripSetStatus(slug, status)` | status ∈ `intake · researched · choosing · planned · delivered · done` |
| `tgDigestStore(payload)` · `tgDigestDays(slug)` · `tgDigestDay(slug, n \| 'YYYY-MM-DD')` | stores a `plan_digest` (Trips + `DayPlans` rows, split per day under the 50 000-char cell limit, + `Later`); days come back `{ date, n, theme, stops[], legs[], warnings[] }` |
| `tgLaterList(slug)` · `tgLaterAdd(slug, { place_slug, name, reason })` | `Later` rows |
| `tgPlacesUpsert(digest)` · `tgPlacesSearch(query, { destination?, limit? })` · `tgPlacesGet(slug)` · `tgPlacesCounts()` | `Places` tab (upsert by `slug`, own data only — refuses Google fields); search on name, tags, area, case-insensitive, current trip's destination first, ≤ 8; counts `{ <destination>: n }` |
| `tgChoiceSet(trip, run, kind, key, value, text?)` · `tgChoiceList(trip, run, kind)` · `tgChoiceClear(trip, run, kind)` | `Choices` tab — the tap store for flows: `kind` ∈ `fact · shortlist · review`; a tap overwrites the same `(trip, run, kind, key)` |
| `tgProfileSummaryGet()` | `{ text, dimensions_count?, updated?, received_at }` or null (`Settings.tg_profile_summary`) |
| `tgShortlistStore(payload)` · `tgShortlistItems(trip, run)` | `Shortlist` tab: one row per item of a round (`trip run round group n slug name gem payload_json`), so buttons resolve `n → slug` without the flow state |

### 1.4 Envelope → flow hand-off (WP-5b handlers, WP-5a flows)
- Flow names: `interview`, `plan`, `review` (WP-5a). A `plan` flow's state always carries `trip` (the slug) and `stage` ∈ `intake · confirm · research · choose · planning`.
- Every pack handler (WP-5b) first validates (a hand-written mirror of the payload schema: required keys, enums, sizes) and stores (trip status, digest, places, profile summary, shortlist rows). Then, for `trip_facts`, `shortlist`, `plan_digest`: when `flowActive(owner)` is the `plan` flow and its `state.trip === payload.trip`, it calls `flowResume(owner, { type: 'resume', event: '<envelope type>', payload, env_id, in_reply_to })` and the flow renders. Otherwise it renders through `getRenderer('tg_<type>')` (registered by WP-5a in `12_flow_plan.js`; `fn(payload) → { messages: [{ html, keyboard? }] }` — the keyboard is a `tgKeyboard()` object built from pack callback prefixes, never `fl`) and sends each message to the owner; with no renderer, one plain line.
- `profile_summary` → cached in Settings and sent to the owner (no flow; the interview flow has already ended with "building your profile…"). `prefs_review` → WP-5b renders the items itself with `pf:<cid>:y|e|n`. `places_digest` → `tgPlacesUpsert`; when an open `places` request with `scope: check` is answered (`in_reply_to`) or a flow asked for it, WP-5b sends the "still open / changed: …" lines; otherwise silent except a one-line count.
- The `reply` envelope stays the core's: its text and `drive_file_ids` documents (labels `plan`, `brochure_html`, `brochure_pdf`, `notes`) are sent by the core. The pack never re-sends those documents on arrival; `tgSendDocument` is used only for an on-demand resend (📄 button / `/brochure` when a `drive_brochure_pdf` id is stored) — Drive ids for the Trips row come from `plan_digest.drive`.

### 1.5 Callback prefixes (all in the FINALIZE table)
`sl` shortlist taps, `tf` fact taps, `lt` later-list promote, `pl` plan actions, `dy` day, `ps` places, `rv` review — WP-5a. `pf` prefs review — WP-5b. Callback data parts only `[A-Za-z0-9_.|-]`, ≤ 64 bytes: buttons carry short keys (`run` ids ≤ 12 chars, item numbers, `cid`s), never names.

### 1.6 Commands and jobs
WP-5a: `/interview`, `/profile`, `/plan`, `/seed`, `/trip`, `/today`, `/day`, `/later`, `/place`, `/replan`, `/notes`, `/brochure`, `/places`, `/review`, `/lodging` (R1), help lines; daily job `tg_review_offer`. WP-5c: `/route` (command + function `tgRoute(from, to, mode)`), message handler `tg_lane_b` (returns false when `CHAT_API_ENABLED` is not `true`, so the core opens a `message` request as today). WP-5b: daily job none; snapshot provider `tour_guide`. `/start`: the core owns `/start` and pairing; the coordinator added a generic hook — the core sends the output of the renderer **`core_start`** (`fn({chatId}) → '' | html | {html, keyboard?}`) after the `/start` greeting and after pairing (SPEC §5). WP-5a registers `core_start` (the interview offer with one button when no profile summary is cached, else '').

### 1.7 Building in parallel
Each WP works in `../wt-5<x>` on `wp-5<x>`. WP-5a and WP-5c may `git merge wp-5b` into their worktree once `helpers/status/WP-5b.md` says the storage API is done (5b lands its storage API first); until then they write code against §1.3 and test what does not need it. WP-5c writes the end-to-end tests last, after merging `wp-5a` and `wp-5b`. A WP never edits another WP's files; a need goes in its status file.
