# Helper framework — SPEC v1

> The contract every helper, kit, pack, skill and build session relies on. Code is the ground truth (`helpers/core/*.js`, `helpers/tools/*.mjs`); when this file and the code disagree, fix one of them in the same commit. Section numbers are referenced from code comments, tools and the private-repo template, so keep them stable.
>
> Version: SPEC v1 · `CORE_VERSION` 1.0.0 (`helpers/core/00_config.js`). This repo is public: nothing in this file, in `helpers/` or in `helpers-dist` names a person, trip, place, account, id or secret.

## Contents

1. [The three homes](#1-the-three-homes)
2. [Envelope v1](#2-envelope-v1)
3. [Mailbox, requests and the snapshot](#3-mailbox-requests-and-the-snapshot)
4. [Pack manifest (`helper.json`)](#4-pack-manifest-helperjson)
5. [Registries — the only extension point](#5-registries--the-only-extension-point)
6. [Web-app routes and the wake contract](#6-web-app-routes-and-the-wake-contract)
7. [Script Properties](#7-script-properties)
8. [State Sheet](#8-state-sheet)
9. [Triggers and sweeps (no permanent tick)](#9-triggers-and-sweeps-no-permanent-tick)
10. [Firing routines](#10-firing-routines)
11. [Proposals and the executor](#11-proposals-and-the-executor)
12. [Setup page](#12-setup-page)
13. [Tools](#13-tools)
14. [Tests, CI, `helpers-dist` and deploys](#14-tests-ci-helpers-dist-and-deploys)
15. [How a private repo carries the framework](#15-how-a-private-repo-carries-the-framework)
16. [File-ownership map (Phase 2 onward)](#16-file-ownership-map-phase-2-onward)
17. [How a new helper is added](#17-how-a-new-helper-is-added)
18. [Limits table](#18-limits-table)

## 1. The three homes

A **helper** is one Telegram bot + one Apps Script web app (the **core** bundled with the helper's **pack**) + one or more Claude Code **Routines** (the **brain**) that talk through a Drive **mailbox**. Everything lives in exactly one of three places, and the split is enforced by `tools/boundary-check.mjs` in CI, not just remembered:

| Public framework repo (`LightAISolutions/Personal`, this repo, `helpers/`) | The helper's private repo (one per helper, from `templates/private-repo/`) | The owner's Google account |
|---|---|---|
| `core/` (Apps Script core), `tools/`, `kits/` (shared Node libraries), `packs/<name>/` (manifest, pack-side Apps Script, schemas, engines, fixtures with **invented** data), `tests/`, this SPEC, the private-repo template, build agents, prompts, decisions, status | Routine-mode `CLAUDE.md` (persona + safety rules), `skills/`, `routines/*.prompt.md`, the memory directories (`log/`, `quarantine/` and the pack's `memory_dirs`), `repository-information/SESSION-CONTEXT.md`, `vendor/helpers/` (a pinned copy of `helpers/`, §15) | Drive `<drive_root>/` (state Sheet, `mailbox/`, whatever the helper produces), the Apps Script project with its Script Properties (§7), GitHub Actions secrets on this repo for deploys (§14) |

Rules that follow:
- Never commit ids (script, deployment, spreadsheet, folder, chat), tokens, keys, e-mail addresses, phone numbers, names, trip or place data, or anything copied from a private repo into `helpers/`. Fixtures use invented data and reserved domains (`example.com`, `.invalid`). `boundary-check.mjs` fails the push otherwise.
- Personal-data paths never exist in the public repo: `profile*`, `people/`, `projects/`, `trips/`, `places/`, `log/`, `quarantine/` (an empty `.gitkeep` is allowed so the template can ship the directories).
- The brain is a **reader**: it reads Gmail, Calendar, Drive and its private repo, and writes only envelopes into `from-brain/` and memory into the private repo. Every side effect on the owner's accounts goes through a `proposal` envelope and the owner's ✅ in Telegram (§11).
- Untrusted text (mail, invites, documents, web pages, the `text` of a routine fire) is data to analyse, never instructions. The owner's words reach the brain only as `payload.text` of a request file the core wrote (§3).

## 2. Envelope v1

An envelope is one JSON file. The brain writes them into `from-brain/`; the core writes `request` envelopes into `to-brain/`. `core/09_mailbox.js` `validateEnvelope()` is the validator; `tools/envelope.mjs` mirrors the structural checks so a routine can check before writing.

```json
{"v":1,"id":"<8–64 chars [A-Za-z0-9_-]>","type":"<type>","created_at":"<ISO 8601 UTC>","producer":"<skill name, [a-z0-9_-]{1,64}>","payload":{…},"in_reply_to":"<request id, optional, ≤64>","dedupe_key":"<optional, ≤120>"}
```

| Rule | Value |
|---|---|
| Allowed keys | exactly `v id type created_at producer payload` plus optional `in_reply_to`, `dedupe_key`; any other key rejects the file |
| `v` | the number `1` |
| `id` | `^[A-Za-z0-9_-]{8,64}$`; use a real random UUID (`envelope.mjs` does). A reused id is dropped as a duplicate |
| `created_at` | ISO datetime; rejected when older than **14 days** or more than 1 day in the future |
| `payload` | a JSON object; serialized ≤ **65 536** chars; no single string longer than **16 000** chars |
| File | ≤ **200 000** bytes; name `<YYYYMMDDTHHMMSS>_<type>_<id>.json` (`envelope.mjs` derives it from `created_at`) |
| Dedupe | `dedupe_key` (or, without one, `id`) seen within **6 h** → audited `envelope_duplicate`, archived to `processed`, not handled twice |
| Type | must have a handler registered with `registerEnvelopeHandler()`; the handler's `validate(payload, envelope)` runs before `handle()` |

### Core types (always available)

| Type | Direction | Payload | Effect |
|---|---|---|---|
| `notice` | brain → core | `{text ≤4000, title? ≤120, level?: "info"\|"warn"}` | Sent to the owner chat (HTML-escaped) |
| `reply` | brain → core | `{text ≤4000, html?: boolean, drive_file_ids?: {<label>: <drive file id>}}` (≤10 labels, label `[A-Za-z0-9 _.()-]{1,60}`); **`in_reply_to` required** | Sent as a Telegram reply to the message that opened the request; the request row becomes `answered`. Each `drive_file_ids` entry is then sent as a silent captioned document via `tgSendDocument` (§5 helpers; files over `DOCUMENT_MAX_BYTES` fall back to the Drive link) |
| `proposal` | brain → core | `{action: <ACTION_ALLOWLIST>, payload: {…}, rationale? ≤300, idempotency_key? ≤120, expires_in_min?}` | Validated by the action's `validate()`, screened by every `registerProposalGuard()`, then a PendingActions row + Telegram message with ✅ / ❌ (§11) |
| `request` | core → brain | `{kind, text, chat: {chat_id, message_id, ts} \| null, requested_at, …}` | Written by the core as `to-brain/req_<id>.json`; never accepted from the brain |

A pack adds its own types by listing them in `helper.json` `envelope_types` and registering a handler for each (§5). A pack cannot redefine a core type. Any envelope whose `in_reply_to` names an open request marks it answered, whatever its type.

### Outcome of a file in `from-brain/`

`processed` (handled, moved to `archive/processed/`), `rejected` (not a `.json` file or invalid; `archive/rejected/`, audited with the reasons), `failed` (the handler threw; `archive/failed/`, audited), `duplicate` (dedupe hit; audited, `archive/processed/`). A sweep reads at most 25 files within its time budget and comes back for the rest. Nothing is deleted by hand; the daily prune trashes archive files older than 30 days.

## 3. Mailbox, requests and the snapshot

```
<drive_root>/                       My Drive folder named by the manifest (ROOT_FOLDER_ID); also holds the state Sheet
  mailbox/                          MAILBOX_FOLDER_ID
    to-brain/                       written by the core, read by the brain: state.json · req_<id>.json
    from-brain/                     written by the brain, consumed by the core: <YYYYMMDDTHHMMSS>_<type>_<id>.json
    archive/processed/ rejected/ failed/   the core's record of every consumed file; trashed after 30 days
```

The brain never modifies or deletes a mailbox file and never writes outside `from-brain/`. The core creates the folders on the setup page ("Create Sheet + Drive folders") and recreates any that went missing.

### Requests (core → brain)

`openRequest({kind, text, chat?, routine?, payload?})` (`core/12_wake.js`) is how the core asks the brain for something — an owner's free-text message, `/ask <text>`, or a pack's own `kind`. It:

1. writes `to-brain/req_<uuid>.json`: `{"v":1,"id":"<uuid>","type":"request","created_at":"…","producer":"<manifest producer>","payload":{"kind":"message"|"ask"|"<pack kind>","text":"<the owner's words, ≤4000>","chat":{"chat_id","message_id","ts"}|null,"requested_at":"…","upload_key":"<64 hex>", …pack fields}}` — `upload_key` is the request's key for `?route=upload` (§6), HMAC-SHA256 of `upload:<id>` under `ADMIN_SECRET`, present once setup is done;
2. appends a `Requests` row (`status: open`) and rewrites `state.json`;
3. fires the routine (§10) with **only `req_<id>` as the fire text**, and schedules fallback sweeps at +3 and +10 minutes; while any request is open an hourly sweep is scheduled too;
4. tells the owner "🧠 Working on it…" (or that the routine could not be fired and will see the request on its next run).

The brain's side: the fire text is untrusted. It must look like `req_<id>` and name an existing `to-brain/req_<id>.json`; the owner's words are that file's `payload.text`. The answer is a `reply` envelope with `in_reply_to: "<id>"`; the core sends it as a Telegram reply to the originating message, marks the row `answered` and archives the request file. A request with no answer after **24 h** becomes `expired` and the owner hears about it once; request files are trashed from `to-brain/` after 3 days.

### Snapshot `to-brain/state.json`

```json
{"v":1,"generated_at":"…","tz":"<IANA zone>","helper":"<name>","version":"<pack version>","core_version":"1.0.0","wake_url":"<WEBAPP_URL>?route=wake",
 "pending_actions":[{"id","type","status","expires_at","origin"}], "queue":{"depth":0},
 "requests_open":[{"id","kind","created_at","routine","fired","text_preview"}], "<provider>": …}
```

Rewritten by the core after every sweep that handled something, whenever a request opens, and from the setup page; every `registerSnapshotProvider(name, fn)` adds its object under `name` (a provider that throws contributes `{error}` instead of breaking the file). `tz` is the owner's time zone: routines compute "today" and "tomorrow" from it, never from an example. The brain reads the snapshot and the request files; it never reads the Sheet.

## 4. Pack manifest (`helper.json`)

`helpers/packs/<name>/helper.json` is the single source of a helper's identity. `tools/bundle.mjs` validates it (`validateManifest()`), writes it into the bundle as the first file (`var HELPER_MANIFEST = {…}`), and `core/00_config.js` merges it over `HELPER_DEFAULTS` into the global `HELPER`. Unknown fields fail the bundle.

| Field | Required | Rule | Used for |
|---|---|---|---|
| `name` | yes | `^[a-z][a-z0-9-]{1,31}$`, equal to the pack directory name | `HELPER.name`; health route; snapshot `helper`; test and dist naming |
| `display_name` | yes | 1–60 chars, no newline | Telegram texts, setup page title, Sheet title (`<display_name> — state`) |
| `drive_root` | yes | `^[A-Za-z0-9][A-Za-z0-9 _-]{0,39}$` | Folder under My Drive that holds `mailbox/` and everything the helper writes |
| `version` | yes | `^\d+\.\d+\.\d+$` | `/ping`, health route, snapshot `version` |
| `producer` | no (default `helper-core`) | `^[a-z0-9_-]{1,64}$` | `producer` on `request` envelopes the core writes |
| `property_prefix` | no (default `HELPER`) | `^([A-Z][A-Z0-9_]{0,15})?$`; `""` = no prefix | Prefix of every Script Property (§7) |
| `timezone` | no (default `Etc/UTC`) | IANA zone, e.g. `America/New_York` | `appsscript.json` `timeZone`; overridable at run time by the `TIMEZONE` property |
| `inbound_routine` | no (default `CHAT`) | `^[A-Z][A-Z0-9_]{0,31}$` | Routine fired for free text and `/ask` when no message handler claims the message (§10) |
| `envelope_types` | no | each `^[a-z][a-z0-9_]{0,39}$`, no core type, no duplicates | Extra from-brain types the pack registers handlers for |
| `action_allowlist` | no | same rule; `drive_create_file` is already core | Extra action types the pack registers; the executor refuses anything else |
| `memory_dirs` | no | each `^[a-z][a-z0-9_-]{0,31}$`; `log`, `quarantine`, `vendor`, `skills`, `routines` are reserved | Private-repo memory directories besides `log/` and `quarantine/`; substituted into the template's merge script and `CLAUDE.md` |
| `scopes` | no | `https://www.googleapis.com/auth/…` | Extra OAuth scopes merged into `appsscript.json` (core minimum: `script.external_request`, `spreadsheets`, `drive`, `script.scriptapp`) |
| `private_repo` | no | `Org/Repo` | Informational: where the helper's brain side lives; filled into the template |
| `description` | no | ≤300 chars | Pack README |

`appsscript.json` is generated, never hand-edited: `runtimeVersion V8`, `webapp.executeAs USER_DEPLOYING`, `webapp.access ANYONE_ANONYMOUS` (Telegram and the brain call the web app without a Google login), `exceptionLogging STACKDRIVER`.

## 5. Registries — the only extension point

Pack files (`helpers/packs/<name>/gas/*.js`) load after every core file and extend it only by calling the functions in `core/02_registry.js` at top level. A pack never edits a core file and never reads or writes `HB_REGISTRY` directly (the hello-pack test asserts this). Registering the same key twice throws, so ownership conflicts are loud.

| Function | Signature | Notes |
|---|---|---|
| `registerEnvelopeHandler` | `(type, fn \| {validate(payload, env) → string[], handle(env) → any})` | `type` must be a core type or listed in the manifest's `envelope_types` |
| `registerAction` | `(type, {validate(payload) → string[], preview(payload) → html, execute(payload, ctx) → result})` | `type` must be core or in `action_allowlist`; `execute` runs only after the owner's ✅ (§11); `result.summary` is shown to the owner |
| `registerCommand` | `('/cmd', fn(ctx), helpLine?)` | `ctx = {chatId, from, text, args, argv, message, chat, reply(html, opts)}`; command names `^/[a-z0-9_]{1,31}$`; `helpLine` lands in `/help` |
| `registerCallback` | `('prefix', fn(ctx))` | Inline-button data `<prefix>:<part>:<part>` (≤64 bytes, `cbEncode`/`cbDecode`); prefix `^[a-z][a-z0-9]{0,7}$`; `a` is taken by the executor and `fl` by flows |
| `registerFlow` | `(name, {start(seed, fctx) → step, next(state, input, fctx) → step, onDone?(state, fctx), ttl_min?})` | A multi-step conversation (`core/15_flows.js`). `step = {prompt: html, keyboard?: rows of {text, value} \| {text, url}, expect: 'button' \| 'text' \| 'any', state, done?: true, result?, pause?: true}`; `input = {type: 'button', value}` \| `{type: 'text', text}` \| `{type: 'resume', …}`. Name `^[a-z][a-z0-9_-]{0,31}$`; one active flow per chat, state in the `Flows` tab (§8), expires after `ttl_min` (default `FLOW_DEFAULT_TTL_MIN`) |
| `registerMessageHandler` | `(name, fn(ctx) → true \| false)` | Owner free text; handlers run in name order; first `true` wins; otherwise the core opens a request for the inbound routine |
| `registerQueueHandler` | `(kind, fn(item) → result)` | `item = {id, kind, source, payload, attempts, created_at}`; items come from `enqueue(kind, payload, source)` |
| `registerDailyJob` | `(name, fn)` | Runs once per local day inside the first sweep of that day |
| `registerSetupStep` | `(name, {label, description?, run() → string})` | One extra button on the setup page under "Pack steps" |
| `registerSheet` | `(name, headers[])` | A new tab, or extra columns appended to a core tab (never reordered) |
| `registerSnapshotProvider` | `(name, fn() → object)` | Merged into `state.json` under `name` (§3) |
| `registerRenderer` | `(name, fn(payload) → html)` | Shared HTML renderers other pack files reuse (`getRenderer(name)`) |
| `registerProposalGuard` | `(name, fn(env, proposal) → null \| reason)` | Runs inside the core `proposal` handler before anything is proposed; a string refuses and audits `proposal_refused` |
| `registerEnvelopeObserver` | `(name, fn(env, result))` | After any envelope handler returned without throwing |
| `registerHelp` | `(line)` | Extra `/help` line not tied to a command |
| `registerRoute` | `(name, {methods, auth, handler(req) → {status, body}})` | An extra `?route=<name>` on the web app (§6). `methods` a non-empty subset of `['GET','POST']`; `auth` `'none'` \| `'admin'` (`?k=ADMIN_SECRET`) \| `'webapp'` (Telegram Mini App `initData` in the POST body `{initData, op, args}`, verified by `tgVerifyInitData` before the handler; POST only); `req = {method, params, body, user, auth_date, start_param}`; `body` is JSON-serialised by the router. Name `^[a-z][a-z0-9_-]{0,31}$`; the core names in `CORE_ROUTES` (`tg`, `wake`, `setup`, `health`, `upload`) throw at load time and are never looked up at run time |

Renderer names the core itself looks up: **`core_start`** — `fn({chatId}) → '' | html | {html, keyboard?}`, sent after the `/start` greeting and after pairing (`startExtras()` in `core/11_commands_builtin.js`; a throw is audited `start_extras_error`). A pack uses it to offer its first step (the tour-guide pack offers the interview). **`core_status`** — `fn() → '' | html` (escaped lines), appended to `/status` (`statusExtras()`; a throw is audited `status_extras_error`). The tour-guide pack shows its answer mode there.

Core helpers a pack may call: `tgSendOwner(html, opts)`, `tgSend(chatId, html, opts)` (owner chat only — the core never messages anyone else), `tgSendDocument(chatId, {driveFileId | blob, filename?, caption?, replyTo?, silent?})` / `tgSendOwnerDocument(spec)` (Telegram `sendDocument` multipart, ≤ `DOCUMENT_MAX_BYTES`; a larger Drive file is sent as its link and audited `document_too_large`), `tgEscape(text)` (mandatory on every untrusted string; parse mode is HTML), `tgKeyboard(rows)` (rows of `{text, data}` \| `{text, url}` \| `{text, web_app: {url}}` — a Mini App button, https only), `tgVerifyInitData(initData, {maxAgeSec?})` → `{ok, user, auth_date, start_param, reason}`, `tgSetMenuButton(url, text)` / `tgMenuButtonDefault()` (the owner chat's menu button opens a Mini App / Telegram's default), `flowStart(chatId, name, seed)` / `flowActive(chatId)` / `flowResume(chatId, input)` / `flowCancel(chatId)` (§5 `registerFlow`), `enqueue()`, `proposeAction(spec)`, `openRequest(spec)`, `getRequest(id)` (the Requests row: kind, status, chat — no payload) / `mailboxReadRequest(id)` (the request envelope read back from `to-brain/req_<id>.json`, `null` once archived — for a `registerEnvelopeObserver` that needs the request's payload, e.g. the tour-guide pack storing a `brochure` reply's `drive_file_ids` on the trip), `fireRoutine(name, text)`, `settingGet/settingSet`, `storeAppend/storeFind/storeUpdate/...` (§8), `audit(event, ref, detail)`, `getProp(propName('MY_KEY'))` for pack-specific properties, `HELPER.*`, `LIMITS.*`.

## 6. Web-app routes and the wake contract

`core/10_router.js` — `doGet`/`doPost` dispatch on `?route=`:

| Route | Method | Auth | Behaviour |
|---|---|---|---|
| `?route=tg` | POST | `?k=<WEBHOOK_SECRET>`; then `from.id` must equal `OWNER_CHAT_ID` (before pairing, only `/start <PAIR_CODE>` from a private chat is accepted, once) | Telegram webhook. Always answers HTTP 200 `OK` (HtmlService) so Telegram never retries. `update_id` deduped for 6 h. Commands → `registerCommand` (always first; `/cancel` ends an active flow); then an active, non-paused flow claims free text and `fl:` buttons; otherwise inline buttons → `registerCallback`; free text → message handlers, else a request. If the script lock is busy for 15 s the update is queued as `tg_update_deferred` and handled by the worker |
| `?route=wake` | GET or POST | none | The wake contract below |
| `?route=setup` | GET / POST | `?k=<ADMIN_SECRET>` | Owner setup page (§12) |
| `?route=upload` | POST | the request's `upload_key` (in the body) | A routine stores one file it made under the helper's Drive root (`core/16_upload.js`), so a `reply` can name it in `drive_file_ids`. Body (JSON): `{req, key, name, mime, data (base64), folder?}`; `mime` is `application/pdf`, `text/html` or `application/json` with a matching extension; `folder` is ≤ 3 lowercase parts (default `files`, never `mailbox`). The request must be open or answered within `UPLOAD_AFTER_ANSWER_MIN`, and younger than `REQUEST_MAX_AGE_HOURS`; at most `UPLOAD_MAX_PER_REQUEST` files. Never overwrites or deletes. Answers `{ok, file_id, url, name, bytes}` or `{ok:false, status, reason}`; refusals are audited `upload_refused`. Routines call it through `tools/upload.mjs` |
| `?route=<name>` registered by a pack | per `registerRoute` | `none` · `admin` (`?k=<ADMIN_SECRET>`) · `webapp` (Mini App `initData`, see below) | The pack's handler, see "Registered routes" below. The tour-guide pack registers `app` (POST, `webapp`) for its Mini App |
| anything else | GET | none | Health JSON `{ok:true, app, version, core, ts}` — no secrets, no state. (The core names `tg`, `wake`, `setup`, `health`, `upload` — `CORE_ROUTES` — belong to the core; a POST to an unregistered name answers `{ok:false, status:404, reason:"not_found"}`) |

### Registered routes (`registerRoute`)

`routeRegistered()` in `core/10_router.js` runs, in this order: method check (`405 method_not_allowed`) → POST body parse (`400 bad_json` for anything but a JSON object, `400 body_too_large` past `ROUTE_BODY_MAX_CHARS`) → auth → the handler. Apps Script web apps always answer HTTP 200 (ContentService cannot set a status), so **the status travels in the JSON**: every error is `{ok:false, status, reason}` with a short reason word — never a stack, never the request. A handler returns `{status, body}`; a non-200 status gets `ok`/`status`/`reason` filled in when the body lacks them; a throw is audited `route_error` and answered `{ok:false, status:500, reason:"internal"}`. Every answer is ContentService JSON, which a browser on another origin can read (GitHub Pages → Apps Script works with a `text/plain` POST body and no custom header, so there is no preflight; HtmlService answers are **not** readable cross-origin — verified live in Phase 9).

`auth: 'webapp'` — the POST body is `{initData, op, args}`; `tgVerifyInitData(initData)` runs before the handler: parse the query string, drop `hash`, sort the remaining `key=value` pairs, join with `\n`, `secret = HMAC-SHA256(key "WebAppData", message BOT_TOKEN)`, `hash = hex(HMAC-SHA256(secret, data_check_string))`, constant-time compare; then `auth_date` must be within `INITDATA_MAX_AGE_SEC` (24 h) and `user.id` must equal `OWNER_CHAT_ID`. A failure answers `{ok:false, status:403, reason:"forbidden"}` and is audited `route_auth_fail` with the verification reason (`missing`, `malformed`, `missing_hash`, `missing_field`, `bad_hash`, `bad_auth_date`, `expired`, `bad_user`, `not_owner`, `too_long`) at most once per 6 h per reason, so a stranger cannot grow the AuditLog. Verified calls count against `MAX_APP_CALLS_PER_DAY` (Settings key `app_calls`); past it the router answers `{ok:false, status:429, reason:"daily_cap"}`, audited `app_cap_reached` once a day. The handler sees `req.user` (the Mini App's user object), `req.auth_date` and `req.start_param`.

`auth: 'admin'` — `?k=<ADMIN_SECRET>` as on the setup page; a wrong key is `403 forbidden`, audited `route_auth_fail` once per 6 h.

A handler's own refusals use the same shape with the statuses `400` (bad or unknown arguments, `bad_args {field}` / `missing_arg`), `404` (unknown operation or row), `409` (state conflicts such as `no_flow`, `no_more`, `busy {flow}`) and `503 busy` (the script lock is held). A route that writes declares `lock: true`, or `lock: function (req) → boolean` to lock only the calls that write; the router then takes the script lock after authentication and the daily cap (waiting up to `LIMITS.ROUTE_LOCK_WAIT_MS`, 10 s), answers `503 busy` when it cannot, and releases it after the handler, even when the handler throws. A predicate that throws locks. The tour-guide pack's `app` route (`packs/tour-guide/gas/32_app_api.js`, 16 operations) is documented in `decisions/WP-9b.md`; the shell page that calls it is `live-site-pages/helper-app.html` (`decisions/WP-9c.md`).

Strangers: an unpaired or foreign sender gets no reply; the first message from each sender per 6 h is audited (`tg_unauthorized`), later ones are dropped silently so a spammer cannot grow the AuditLog.

### Wake contract (`?route=wake`)

The brain calls it once after writing envelopes: `GET <wake_url>` (the snapshot's `wake_url`). It is **unauthenticated, idempotent and rate-limited**, and it does one thing: a sweep (`wakeSweep('wake')`: read `from-brain/` → expire stale proposals, requests and flows → run the day's daily jobs once → rewrite `state.json` when something changed). A stranger who finds the URL can only cause a sweep that would happen anyway.

| Response | Meaning |
|---|---|
| `{"ok":false,"error":"not set up"}` | storage not created yet |
| `{"ok":true,"throttled":true,"retry_in_sec":15}` | called within `WAKE_MIN_INTERVAL_SEC` of the previous wake; a follow-up sweep is scheduled (+1 min), so the caller need not retry |
| `{"ok":false,"throttled":true,"reason":"daily_cap"}` | `MAX_WAKES_PER_DAY` reached (audited once) |
| `{"ok":true,"processed":N,"skipped":"busy","open_requests":N,"remaining":N}` | another execution held the lock; a follow-up sweep is scheduled |
| `{"ok":true,"processed":N,"open_requests":N,"remaining":N}` | the sweep ran; `processed` counts files handled, rejected, failed or duplicate plus expiries |

Wakes are audited when they processed something and otherwise once per hour. A wake that fails or is throttled is not an error for the brain: the fallback triggers (§9) sweep anyway.

## 7. Script Properties

Every property name is `<property_prefix>_<KEY>` (`propName()`); with `property_prefix: ""` the names are exactly the keys below. The setup page lists the resolved names. Secret keys are redacted from every audit row, preview and page (`redactSecrets()`).

| Key | Set by | Meaning |
|---|---|---|
| `BOT_TOKEN` 🔒 | setup page step 1 | Telegram bot token from BotFather |
| `OWNER_CHAT_ID` | pairing (`/start <code>`) | The one chat the core talks to |
| `WEBHOOK_SECRET` 🔒 | generated | `?k=` on the Telegram webhook URL; rotate from the setup page |
| `ADMIN_SECRET` 🔒 | generated | `?k=` on the setup page URL |
| `PAIR_CODE` 🔒 | generated; deleted after pairing | One-time pairing code; "Reset pairing" issues a new one |
| `SHEET_ID`, `ROOT_FOLDER_ID`, `MAILBOX_FOLDER_ID` | setup page step 2 | Storage ids |
| `WEBAPP_URL` | setup page step 0 | The `/exec` URL. Stored because `ScriptApp.getService().getUrl()` can return the `/dev` URL, which needs a Google login |
| `TIMEZONE` | owner, optional | Overrides the manifest's zone |
| `SHEET_TZ` | core | The zone last given to the state Sheet: `getSpreadsheet()` keeps the Sheet on `getTz()` so date cells read back as the day written |
| `ROUTINE_FIRE_URL_<NAME>`, `ROUTINE_FIRE_TOKEN_<NAME>` 🔒 | owner, one pair per routine | Fire URL and bearer token of a Claude Code Routine (`<NAME>` upper-case, e.g. `CHAT`); `routineNames()` lists the configured ones |
| `MAX_ROUTINE_FIRES_PER_DAY` | owner, optional (default 12) | Daily cap on routine fires |
| `MAX_PROPOSALS_PER_DAY` | owner, optional (default 30) | Daily cap on new proposals |
| `MAX_WAKES_PER_DAY`, `WAKE_MIN_INTERVAL_SEC` | owner, optional (defaults 500, 15) | Wake-route limits |
| `APP_SHELL_URL` | owner, optional | The https address of the helper's Mini App page (the shell on GitHub Pages). Empty → the pack sends no `web_app` button and sets no menu button |
| `MAX_APP_CALLS_PER_DAY` | owner, optional (default 2000) | Daily cap on verified `auth:'webapp'` route calls (`429 daily_cap` past it) |

Pack-specific properties use the same prefix and are read with `getProp(propName('MY_KEY'))`; a pack documents them in its README (the tour-guide pack plans `MAPS_API_KEY`, `CLAUDE_API_KEY` and `CHAT_API_ENABLED`). Pack secret keys must be named so that `redactSecrets()` sees them before they are logged anywhere: it redacts the exact value of every property whose name ends in `_API_KEY`, besides the core's secret keys and the routine tokens.

## 8. State Sheet

One spreadsheet, `<display_name> — state`, created by the setup page inside `<drive_root>/`. The header row is the schema; `core/03_store.js` maps rows to objects keyed by header (`_row` is the 1-based sheet row). `ensureSheets()` creates missing tabs and appends missing columns; it never reorders or deletes. Packs add tabs or columns with `registerSheet()`.

| Tab | Columns | Rows |
|---|---|---|
| `Queue` | `id created_at kind source status attempts payload_json last_error claimed_at processed_at result_json` | `new → processing → done \| failed (retried, back to new) \| dead`; pruned after 7 days |
| `PendingActions` | `id created_at type status preview payload_json idempotency_key expires_at decided_at executed_at result_json error tg_chat_id tg_message_id origin` | `pending → approved → executed \| failed`; `pending → rejected \| expired` |
| `Requests` | `id created_at kind status routine fired answered_at tg_chat_id tg_message_id text_preview` | `open → answered \| expired` |
| `Flows` | `chat_id flow step expect state_json updated_at expires_at` | One row per chat with an active flow (`expect` = `button \| text \| any \| paused`; `state_json` ≤ `FLOW_STATE_MAX_CHARS`); the row is deleted when the flow finishes, is cancelled or expires (`expireFlows()` in the sweep tells the owner once) |
| `AuditLog` | `id ts actor event ref detail_json ok` | Every side effect, rejection and auth failure (secrets redacted) |
| `Settings` | `key value updated_at note` | `last_sweep`, `last_daily_date`, `webhook_set_at`, per-day counters (`wakes`, `routine_fires`, `action_proposals`), pack settings via `settingGet/settingSet` |

Non-primitive values are JSON-stringified on write; date cells come back as ISO strings. The Sheet is the core's memory only — the brain reads the snapshot (§3), never the Sheet.

## 9. Triggers and sweeps (no permanent tick)

There is no time-driven trigger. Every one-off trigger is created with `scheduleOneOff(fn, minutes)` (`ScriptApp.newTrigger(fn).timeBased().after(…)`), restricted to `ONE_OFF_HANDLERS = ['queueTrigger', 'wakeTrigger']`, and deletes itself when it fires (`deleteOneOffTrigger(e)` — Apps Script leaves fired one-off triggers behind otherwise).

| Who schedules | Handler | When | Guard against pile-up |
|---|---|---|---|
| `enqueue()` | `queueTrigger` (+1 min) | A queue item was added | at most one outstanding (`q:scheduled` cache key); the worker reschedules itself while the queue is non-empty |
| `openRequest()` | `wakeTrigger` (+3 and +10 min) | A request was written | per request |
| `wakeSweep('wake')` | `wakeTrigger` (+1 min) | The wake route found the lock busy or was throttled | once per 90 s |
| any sweep | `wakeTrigger` (+60 min) | Requests are still open | once per hour |
| `/wake` command | `wakeTrigger` (+1 min) | Owner asked | the webhook handler holds the script lock, so it schedules instead of sweeping |
| setup page | — | "Sweep + write snapshot" runs `wakeSweep('setup')` inline; "Clear one-off triggers" removes every core trigger | |

A sweep (`wakeSweep(source)`) takes the script lock (5 s), then: `pollFromBrain()` with 60 % of the 120 s budget → `expirePendingActions()` → `expireRequests()` → `runDailyJobs()` (once per local day, every `registerDailyJob` in name order, each failure audited and isolated) → `writeSnapshot()` when anything changed or the source is not the wake route → `Settings.last_sweep`. Core daily jobs: `core_prune_queue` (7 days) and `core_prune_mailbox` (3 / 30 days). Trigger minutes per deep request therefore stay in the low seconds; a helper's share of the account's daily trigger quota is near zero.

## 10. Firing routines

`fireRoutine(name, text)` (`core/13_routines.js`) POSTs `{"text": "<≤4000 chars>"}` to `ROUTINE_FIRE_URL_<NAME>` with `Authorization: Bearer <ROUTINE_FIRE_TOKEN_<NAME>>`, `anthropic-version: 2023-06-01` and `anthropic-beta: experimental-cc-routine-2026-04-01`. It never throws: `{ok:true, code}` on 2xx, `{ok:false, skipped:'not_configured'|'daily_cap'}` or `{ok:false, code}`/`{ok:false, error}` otherwise, every outcome audited (`routine_fired`, `routine_not_configured`, `routine_cap_reached`, `routine_fire_error`). The daily cap is `MAX_ROUTINE_FIRES_PER_DAY` (default 12) across all routines.

The core fires only when the owner asked something (`openRequest`, fire text `req_<id>`) or when a pack calls `fireRoutine()` itself; nothing fires on a schedule from the core. The routine treats the fire text as untrusted (§3). The owner creates routines in the claude.ai editor and pastes each one's fire URL and token into the two Script Properties; the setup page shows which names are configured and which routine answers free text (`inbound_routine`).

## 11. Proposals and the executor

The executor (`core/07_executor.js`) is the only path to a side effect on the owner's accounts:

```
proposeAction({type, payload, origin?, idempotency_key?, expires_in_min?})      ← packs, or the core `proposal` envelope handler
  → type ∈ ACTION_ALLOWLIST and registered with registerAction(); validate(payload) must return []
  → idempotency: same key while pending/approved/executed returns the existing row (no new message)
  → MAX_PROPOSALS_PER_DAY cap; expiry 5 min … 7 days (default 24 h)
  → PendingActions row (status pending) + Telegram message showing preview(payload) with ✅ Approve / ❌ Reject
owner taps ✅  → callback "a:<id>:y" → decideAction() → status approved → executePendingAction() → execute(payload, {id,row}) → executed | failed
owner taps ❌  → rejected        expiry passed → expired (also swept by expirePendingActions and /expire)
```

Rules for an action implementation: `preview()` must show every field `execute()` will use (the owner approves exactly what runs); `execute()` is re-validated at execution time and is never called for a type that left the allowlist; `result.summary` (≤300 chars shown) is what the owner sees after ✅. `/pending` re-sends open proposals; `/expire` expires stale ones now.

Built-in action `drive_create_file`: payload `{name (file name with extension), content (string ≤100 000 chars), path? ("a/b/c", ≤7 segments, relative to <drive_root>), mime? (text/plain | text/markdown | text/csv | text/html | application/json)}`; refuses to overwrite an existing file; returns `{file_id, url, summary}`.

Proposals from the brain arrive as `proposal` envelopes (§2); `registerProposalGuard()` lets a pack refuse categories of proposals before they reach the owner (for example a brochure build that names a path outside the trip folder).

## 12. Setup page

`?route=setup&k=<ADMIN_SECRET>` — the owner's only administrative surface; there is no public page and no dashboard.

- **Bootstrap:** run `printSetupUrl()` once in the Apps Script editor; it generates `ADMIN_SECRET`, `WEBHOOK_SECRET` and a `PAIR_CODE` if missing and logs the URL. If the URL is the `/dev` one, the page says so and asks for the `/exec` URL first (step 0).
- **Steps, in order:** 0 save deployment URL (`WEBAPP_URL`) · 1 save bot token (tolerates a sloppy BotFather paste) · 2 create Sheet + Drive folders · 3 set Telegram webhook (`?route=tg&k=<WEBHOOK_SECRET>`) · 4 pair: send `/start <pair code>` to the bot · 5 sweep + write snapshot · 6 send test message.
- **Pack steps:** one button per `registerSetupStep()`. **Maintenance:** clear one-off triggers · reset pairing · rotate webhook secret (re-sets the webhook).
- **Status table:** web app URL, wake URL (copy it into the routine skill), token set, owner chat, Sheet and mailbox links, webhook time, last sweep with queue/pending/open-request/trigger counts, configured routines and the inbound routine name, time zone, the resolved property names.
- **Lessons baked in:** every form and link targets the top window (`<base target="_top">`, the page is served inside Apps Script's sandbox frame); secrets stay collapsed until clicked; the time zone shown is the one the snapshot carries; every action is audited (`setup_action`), every bad key too (`setup_auth_fail`).

## 13. Tools

All tools are zero-dependency Node ≥ 22 ESM scripts under `helpers/tools/`, runnable from any directory (they locate `helpers/` relative to themselves, so they work unchanged from `vendor/helpers/` in a private repo). Exit code 0 = ok, 1 = a finding or failure, 2 = usage.

| Tool | Usage | Does |
|---|---|---|
| `bundle.mjs` | `node helpers/tools/bundle.mjs <pack> [--out DIR] [--check]` · `--all [--check]` | Validates `helper.json`, parses every file, emits `helpers/dist/<pack>/Code.gs` + `appsscript.json` (or only checks with `--check`). The bundle is one Apps Script file: banner → `HELPER_MANIFEST` block → `core/*.js` sorted → `packs/<pack>/gas/*.js` sorted. `helpers/dist/` is git-ignored |
| `envelope.mjs` | `node helpers/tools/envelope.mjs <type> <producer> <payload.json> [--pack NAME] [--dedupe-key K] [--in-reply-to ID] [--out DIR]` | Stamps a real UUID, the real clock and the canonical file name; prints `{"file_name","content","errors"}` and, with `--out`, writes the file. Rejects unknown types (`--pack` adds the pack's), a `reply` without `--in-reply-to`, oversize payloads. Routines keep payload and output files outside the repo |
| `new-helper.mjs` | `node helpers/tools/new-helper.mjs <name> [--display D] [--drive-root R] [--prefix P] [--routine CHAT] [--memory a,b] [--types x,y] [--private-repo Org/Repo] [--framework-repo Org/Repo] [--private-out DIR] [--force]` | Scaffolds `helpers/packs/<name>/` (manifest, `gas/<name>.js`, README) and, with `--private-out`, the private repo from `templates/private-repo/` with every `{{PLACEHOLDER}}` filled (fails if one is left). Never overwrites without `--force` |
| `upload.mjs` | `node helpers/tools/upload.mjs --wake-url <state.json wake_url> --req <id> --key-from <saved req_<id>.json> --file <path> [--name N] [--folder trips/<slug>] [--dry-run]` (`--key <payload.upload_key>` still works; not both) | Reads the key from the saved request itself, so it never appears on a command line or in a routine transcript; POSTs a routine-made `.pdf`/`.html`/`.json` (≤ 30 MB) to `?route=upload` with curl (honours the proxy, follows the Apps Script 302) and prints the core's answer; the `file_id` goes in the reply's `drive_file_ids`. Checks name, folder, id and key shape first; never prints the key |
| `boundary-check.mjs` | `node helpers/tools/boundary-check.mjs [--root DIR] [--allowlist FILE] [--quiet] [path ...]` | Fails on personal-data paths and on secret/PII patterns in file contents (bot tokens, Google/Anthropic/GitHub/OAuth keys, private keys, Apps Script and Drive ids, e-mail addresses outside allowlisted domains, phone numbers, every `deny` pattern). Matches are printed redacted. `tools/boundary-allowlist.txt` lines: `domain <d>` · `literal <s>` · `path <p>` · `deny <regex>`; a custom `--allowlist` **replaces** the default |

## 14. Tests, CI, `helpers-dist` and deploys

**Tests.** `node --test helpers/tests/` (from the repo root; `tests/index.js` loads every `*.test.js`). Suites run core and pack code inside `node:vm` against in-memory Apps Script mocks (`tests/harness/gas-mocks.js`: Properties, Cache, Lock, Drive, Spreadsheet, UrlFetch with a Telegram/routine recorder, triggers). Naming: `core_<area>.test.js`, `tools_<tool>.test.js`, `pack_<name>*.test.js`, `kit_<kit>*.test.js`. Fixtures are invented; e-mail fixtures use reserved domains only; anything that must look like a secret is assembled at run time so the boundary check never trips on a test file.

**CI** — `.github/workflows/helpers-ci.yml` runs on every push and pull request that touches `helpers/**` or the workflow: `node --test helpers/tests/` → `node helpers/tools/bundle.mjs --all --check` → `node helpers/tools/boundary-check.mjs`. Read-only token. The boundary test plants a fake secret and a personal-data path in a temp tree and asserts the check fails on them; the real tree must pass.

**`helpers-dist`** — `.github/workflows/helpers-dist.yml` publishes the `helpers/` tree as the orphan branch `helpers-dist` (what private repos vendor, §15) after each change on `main`: it runs on `workflow_run` of the auto-merge workflow (pushes made with `GITHUB_TOKEN` and `[skip ci]` never trigger a plain `push:` workflow), on a direct push to `main` touching `helpers/**`, and by hand. The branch holds the framework files only — `core/`, `tools/`, `kits/`, `packs/`, `templates/`, `tests/`, `SPEC.md`, `README.md`; **not** `BUILD-STATE.md`, `decisions/`, `prompts/`, `status/`, `dist/`. One commit per change (`helpers-dist: publish helpers/ @ <sha>`), fast-forward only; no commit when the tree is unchanged.

**Deploy** — `.github/workflows/deploy-helper.yml` (from `clasp-deploy-pilot.yml` and the first helper's deploy workflow): a `discover` job lists `helpers/packs/*/helper.json`; a matrix job per pack runs the tests and `bundle.mjs <pack>`, then `clasp push --force` + `clasp deploy --deploymentId` onto the pack's **pinned** deployment so the `/exec` URL (Telegram webhook, wake URL) never changes. Only on `main` (the same `workflow_run` + `push: main` + `workflow_dispatch` triggers; never on pull requests, this repo is public), in the `production` environment (the owner restricts it to `main`), `umask 077`, credentials removed `if: always()`. Secrets, named in the workflow and created by the owner at switch-on: `CLASPRC_JSON` (shared), `<HELPER>_SCRIPT_ID`, `<HELPER>_DEPLOYMENT_ID` where `<HELPER>` is the pack name upper-cased with non-alphanumerics removed (`hello` → `HELLO_SCRIPT_ID`, `tour-guide` → `TOURGUIDE_SCRIPT_ID`). A pack whose secrets are not set is skipped green with a notice; a pack with a script id but no deployment id is pushed but not deployed (warning). First deploy of a new helper: `clasp create --type webapp` by the owner → script id → first manual deployment → deployment id → the three secrets.

## 15. How a private repo carries the framework

Routines attach only the helper's private repo (this repo's development `CLAUDE.md` must never load inside a routine), so the private repo carries the framework at `vendor/helpers/`, pinned to a commit of `helpers-dist`.

**Decision (Phase 1, measured):** `git subtree` pin, bumped on purpose by a development session. Clone-at-run was measured and rejected.

| | `git subtree` pin at `vendor/helpers/` (chosen) | shallow clone of `helpers-dist` at run start |
|---|---|---|
| Size in the private repo | 54 files, 488 KB working tree; +404 KB of loose objects (≈ 0.9 MB `.git` for the whole skeleton) | nothing committed; 1.3 MB per run (`.git` 0.8 MB) in the routine's checkout |
| Time | `subtree add` 0.14 s, `subtree pull` 0.24 s against a local bare repo; the GitHub fetch adds the ~1 s a shallow fetch costs | ≈ 2.0 s per run over the network (`--depth 1 --filter=blob:none --sparse` 1.37 s + sparse-checkout 0.62 s; a full shallow clone of this repo's `main` 1.07 s, 3.9 MB) |
| Offline / network failure | Works: the files are in the checkout | The run has no tools at all (clone fails immediately; measured against an unreachable host) |
| Determinism | Every run uses exactly the pinned commit until a session bumps it | Every run takes whatever `helpers-dist` is at that moment; an upstream regression hits a routine with no review |
| How a bump shows | `git diff --stat <before> HEAD -- vendor/helpers` lists the changed files; the squash commit records `Squashed 'vendor/helpers/' changes from <old>..<new>` (`git-subtree-split` trailer) — reviewable, revertable with `git reset --hard <before>` before pushing | Not in git; only the run log says which commit was fetched |
| Cost of keeping | A development session runs `/update-helpers` at most once per session | None, and no record |

Numbers measured 2026-10-01 in the Claude HQ environment with a scratch copy of `helpers-dist` built from the Phase 1 tree (the branch itself is first published by the merge that lands this SPEC) and, for the network timings, a shallow clone of this repo's `main`.

**Procedure (also in the template's `vendor/helpers/README.md` and `repository-information/DEV-SESSION.md`):**

```
# first pin — the template ships a placeholder README; subtree add refuses an existing prefix
git rm -r vendor/helpers && git commit -m "Remove vendor/helpers placeholder before the first subtree pin"
git subtree add  --prefix vendor/helpers https://github.com/LightAISolutions/Personal.git helpers-dist --squash

# /update-helpers — development sessions only, at most once per session; routines never do this
before=$(git rev-parse HEAD)
git subtree pull --prefix vendor/helpers https://github.com/LightAISolutions/Personal.git helpers-dist --squash
git diff --stat "$before" HEAD -- vendor/helpers        # review; git reset --hard "$before" to back out
node vendor/helpers/tests/                               # if present; a failure is reported upstream, never fixed in vendor/
git push -u origin <session branch>                      # the owner merges; the memory workflow ignores non-memory branches
```

Nothing under `vendor/helpers/` is edited by hand: a change is made here under `helpers/`, lands on `helpers-dist` through the merge, and arrives through the next pull. Private-repo code calls the tools as `node vendor/helpers/tools/<tool>.mjs …` and the kits as `node vendor/helpers/kits/<kit>/…`.


## 16. File-ownership map (Phase 2 onward)

One owner per path. A work package (WP) edits only the paths it owns; anything else it needs changed is written as a request in its `helpers/status/WP-<id>.md` and the coordinator makes the change. The map below is the Phase 2 assignment; later phases extend it in the same table in their own `decisions/` file.

| Path | Owner | Notes |
|---|---|---|
| `helpers/core/`, `helpers/tools/`, `helpers/tests/harness/`, `helpers/tests/core_*`, `helpers/tests/tools_*`, `helpers/packs/hello/`, `helpers/SPEC.md`, `helpers/README.md`, `helpers/templates/private-repo/`, `.claude/agents/hb-*.md`, `.github/workflows/helpers-*.yml`, `.github/workflows/deploy-helper.yml` | architect / Phase 2 coordinator | Contract files. A WP that finds a bug here files it in its status file with a proposed patch; it does not edit |
| `helpers/core/15_flows.js`, `tgSendDocument`/`tgApiMultipart` in `helpers/core/05_telegram.js`, `drive_file_ids` in `helpers/core/09_mailbox.js`, `helpers/tests/core_flows.test.js`, `helpers/status/WP-1b.md`, `helpers/decisions/WP-1b.md` | WP-1b Core flows + document delivery (Phase 4b) | Multi-step conversations (`registerFlow`, `Flows` tab, `fl` callback prefix, `/cancel`, `expireFlows()` in the sweep) and Telegram document delivery |
| `helpers/kits/maps/`, `helpers/tests/kit_maps_*.test.js`, `helpers/status/WP-2a.md`, `helpers/decisions/WP-2a.md` | WP-2a Maps kit | Places (New) + Routes client, fixed field masks, SKU counter and hard stop, 30-day snapshot purge, Maps URL builder |
| `helpers/kits/research/`, `helpers/tests/kit_research_*.test.js`, `helpers/status/WP-2b.md`, `helpers/decisions/WP-2b.md` | WP-2b Research kit | Run contract: budgets, source ledger, two-source rule, confidence labels, injection tests |
| `helpers/kits/brochure/`, `helpers/tests/kit_brochure_*.test.js`, `helpers/status/WP-2c.md`, `helpers/decisions/WP-2c.md` | WP-2c Brochure kit | Design tokens, type scale, print CSS, HTML renderer, PDF step, attribution block |
| `helpers/kits/prefs/`, `helpers/tests/kit_prefs_*.test.js`, `helpers/status/WP-2d.md`, `helpers/decisions/WP-2d.md` | WP-2d Prefs kit | Connector-reader pattern: evidence → quarantine → owner-confirmed profile |
| `helpers/packs/tour-guide/` | Phase 3 onward (planner, estimator, feature pack) | Not touched in Phase 2 |
| `registerRoute`/`getRoute`/`CORE_ROUTES` in `helpers/core/02_registry.js`, `routeRegistered`/`routeError` in `helpers/core/10_router.js`, `tgVerifyInitData`/`tgSetMenuButton`/`tgMenuButtonDefault` and the `web_app` button shape in `helpers/core/05_telegram.js`, `APP_SHELL_URL`/`MAX_APP_CALLS_PER_DAY` in `helpers/core/00_config.js`, `initData`/`appPost` and the HMAC mock in `helpers/tests/harness/gas-mocks.js`, `helpers/tests/core_routes.test.js`, `helpers/tests/core_initdata.test.js`, `helpers/status/WP-9a.md`, `helpers/decisions/WP-9a.md` | WP-9a Core route contract (Phase 9) | The fifteenth registry and the Mini App auth |
| `helpers/packs/tour-guide/gas/32_app_api.js`, the `app_menu_button` setup step, the `web_app` buttons in `helpers/packs/tour-guide/gas/{10_commands,12_flow_plan,20_envelopes}.js`, `helpers/tests/pack_tour-guide_gas_app.test.js`, `helpers/status/WP-9b.md`, `helpers/decisions/WP-9b.md` | WP-9b Pack app API (Phase 9) | `?route=app` and its ops; adds nothing to `helpers/core/` |
| `live-site-pages/helper-app.html`, `live-site-pages/html-versions/helper-apphtml.version.txt`, `live-site-pages/html-changelogs/helper-apphtml.changelog.md` (+ archive), `helpers/status/WP-9c.md`, `helpers/decisions/WP-9c.md` | WP-9c Shell (Phase 9) | The one static page every helper's Mini App opens; carries no helper-specific text, key or URL |
| `helpers/BUILD-STATE.md`, `helpers/prompts/`, `repository-information/CHANGELOG.md`, `README.md`, `repository-information/repository.version.txt`, `repository-information/REPO-ARCHITECTURE.md` | coordinator, at push time only | Repo bookkeeping is done once per push, never inside a WP worktree |

**Kit layout.** Every kit is a Node module with no build step:

```
helpers/kits/<kit>/
  README.md        contract: what it does, inputs and outputs, budgets and caps, what it never does, dependencies
  index.mjs        CLI entry — node helpers/kits/<kit>/index.mjs <command> …   (node vendor/helpers/kits/<kit>/index.mjs … from a private repo; Node does not run a directory's index.mjs)
  lib/             implementation, plain ESM, one concern per file
  fixtures/        invented data only (reserved domains, made-up places and names); the boundary check scans it
helpers/tests/kit_<kit>_*.test.js   node:test suites; network calls are mocked, live calls live behind an explicit flag
```

Dependencies: a kit has **no runtime npm dependencies** unless its README names each one and the WP's decisions file records how it is installed where routines run (Phase 2c owns the first case: Playwright for the PDF step, with the pre-installed Chromium at `/opt/pw-browsers/chromium`). Nothing under `helpers/` ships a `package.json` lockfile that a routine would have to install from.

**Worktrees and landing.** Each WP works in its own worktree and branch — `git worktree add ../wt-2<x> -b wp-2<x>` — and never pushes that branch. When a WP reports done in its status file, the coordinator merges `wp-2<x>` into the session's `claude/*` branch, runs `node --test helpers/tests/` and `node helpers/tools/boundary-check.mjs`, does the bookkeeping row above and pushes once (push-once rule in `CLAUDE.md`). Two WPs never own the same file, so these merges do not conflict; a conflict means the map was violated and the coordinator resolves it by the map, not by the diff.

## 17. How a new helper is added

1. **Scaffold** — `node helpers/tools/new-helper.mjs <name> --display "<Display Name>" --drive-root <Root> --prefix <PREFIX> --routine CHAT --memory <dirs> --types <types> --private-repo <Org>/<Repo> --private-out ../<Repo>`. It writes `helpers/packs/<name>/{helper.json, README.md, gas/<name>.js}` and, with `--private-out`, the private repo skeleton from `helpers/templates/private-repo/` with every `{{…}}` placeholder filled.
2. **Fill the pack** — edit `helper.json` (§4) and `gas/<name>.js` (registries only, §5). Add `helpers/tests/pack_<name>_*.test.js` using the harness (`H.loadGas({ pack: '<name>' })`). Run `node helpers/tools/bundle.mjs <name> --check`, `node --test helpers/tests/` and `node helpers/tools/boundary-check.mjs`; all three must be clean before the pack is pushed.
3. **Publish** — push the session branch; the merge to `main` runs `helpers-ci`, then `helpers-dist` republishes the `helpers-dist` branch with the new pack.
4. **Private repo** — create the repository on GitHub (private), push the skeleton from step 1, then pin the framework per §15 (first pin: remove the placeholder, `git subtree add … helpers-dist --squash`).
5. **Apps Script project** — in the owner's Google account: `clasp create --type webapp` (or the editor), note the **script id**; push the bundle once (`node helpers/tools/bundle.mjs <name>` then `clasp push` from `helpers/dist/<name>/`), deploy as a web app (execute as me, anyone) and note the **deployment id**. In the public repo's `production` environment add `<HELPER>_SCRIPT_ID` and `<HELPER>_DEPLOYMENT_ID` (name rule in §14); `CLASPRC_JSON` is shared by every helper. From then on `deploy-helper` redeploys the pack after each merge to `main` that touches it.
6. **Setup page** — run `printSetupUrl()` in the editor, open the logged URL, and work down the page (§12): save the deployed `WEBAPP_URL`, save the bot token, create the Drive root + state Sheet, set the webhook, send a test message, pair with `/start <code>` from Telegram.
7. **Routines** — create each routine in Claude HQ with the private repo attached (its `routines/README.md` lists them), paste each fire URL and token into Script Properties as `<PREFIX>_ROUTINE_FIRE_URL_<NAME>` / `_TOKEN_<NAME>` (§7), and confirm "Routines configured" on the setup page lists them.
8. **Bookkeeping** — the pack and its tests are new files in this repo: README tree, CHANGELOG, version bump per `CLAUDE.md`. The private repo keeps its own `repository-information/SESSION-CONTEXT.md` and nothing else of the template machinery.

The hello pack (`helpers/packs/hello/`) is the worked example for steps 1–3; it has no private repo, Apps Script project or routines.

## 18. Limits table

Constants in `helpers/core/00_config.js` (`LIMITS`). The five marked ⚙ can be raised or lowered per helper through the Script Property of the same name (§7); the rest change only with a core release.

| Constant | Value | Where it bites |
|---|---|---|
| `TG_MAX_CHARS` / `TG_SPLIT_AT` | 4096 / 3900 | Telegram message length; longer text is split at 3900 characters |
| `CB_DATA_MAX_BYTES` | 64 | Inline-button callback data (`a:<id>:y`), Telegram's own ceiling |
| `ENVELOPE_MAX_FILE_BYTES` | 200 000 | A from-brain file larger than this is rejected unread |
| `ENVELOPE_MAX_PAYLOAD_CHARS` | 65 536 | Serialized `payload` |
| `ENVELOPE_MAX_TEXT_CHARS` | 16 000 | Any single string inside `payload` |
| `ENVELOPE_MAX_AGE_DAYS` | 14 | `created_at` older than this → rejected |
| `DEDUPE_TTL_SEC` | 21 600 (6 h) | Window in which a repeated `dedupe_key` or `id` is a duplicate |
| `QUEUE_MAX_PAYLOAD_CHARS` | 32 768 | A queued job's payload |
| `QUEUE_MAX_ATTEMPTS` | 3 | A job failing this often is parked `failed` and audited |
| `QUEUE_BATCH` | 20 | Jobs taken per queue run |
| `QUEUE_STALE_MIN` | 10 | A job `running` longer than this is retried |
| `QUEUE_KEEP_DAYS` | 7 | Finished queue rows older than this are pruned daily |
| `SWEEP_BUDGET_MS` | 120 000 | Wall-clock budget of one sweep (the mailbox gets 60 % of it) |
| `MAILBOX_BATCH` | 25 | From-brain files read per sweep; the rest wait for the next wake |
| `MAILBOX_TO_BRAIN_KEEP_DAYS` | 3 | `req_*.json` files older than this are trashed daily |
| `MAILBOX_ARCHIVE_KEEP_DAYS` | 30 | Archived envelopes older than this are trashed daily |
| `PENDING_DEFAULT_EXPIRY_MIN` / `PENDING_MAX_EXPIRY_MIN` | 1 440 / 10 080 | A proposal without `expires_in_min` expires in 24 h; nothing lives past 7 days (floor 5 min) |
| `PENDING_PREVIEW_CHARS` | 3 000 | Payload preview shown to the owner under the ✅ / ❌ buttons |
| `AUDIT_DETAIL_CHARS` | 2 000 | `detail` column of the AuditLog |
| `MAX_ROUTINE_FIRES_PER_DAY` ⚙ | 12 | `fireRoutine()` refuses past this per local day |
| `MAX_PROPOSALS_PER_DAY` ⚙ | 30 | `proposeAction()` refuses past this per local day |
| `MAX_WAKES_PER_DAY` ⚙ | 500 | `?route=wake` answers `daily_cap` past this |
| `WAKE_MIN_INTERVAL_SEC` ⚙ | 15 | Wakes closer than this are `throttled` (a follow-up sweep is scheduled instead) |
| `WAKE_AUDIT_TTL_SEC` | 3 600 | An idle wake (nothing processed) is audited at most once an hour |
| `MAX_APP_CALLS_PER_DAY` ⚙ | 2 000 | Verified `auth:'webapp'` route calls per local day; past it the router answers `429 daily_cap` |
| `INITDATA_MAX_AGE_SEC` | 86 400 | A Mini App `initData` whose `auth_date` is older than this is `expired` |
| `INITDATA_MAX_CHARS` | 4 096 | Longer `initData` strings are refused unparsed (`too_long`) |
| `ROUTE_BODY_MAX_CHARS` | 65 536 | POST body of a registered route; larger is `400 body_too_large` |
| `FLOW_STATE_MAX_CHARS` | 40 000 | `state_json` of a `Flows` row; a step whose state exceeds it throws and the flow is not advanced |
| `FLOW_DEFAULT_TTL_MIN` | 1 440 | A flow without `ttl_min` expires 24 h after its last step |
| `DOCUMENT_MAX_BYTES` | 52 428 800 | `tgSendDocument` attaches up to 50 MB; a larger Drive file is sent as its link (`document_too_large`) |
| `DOCUMENT_CAPTION_CHARS` | 1 024 | Caption of a `sendDocument` call (Telegram's limit) |
| `REPLY_MAX_DOCUMENTS` | 10 | `drive_file_ids` entries accepted on one `reply` envelope |
| `REQUEST_TEXT_CHARS` | 4 000 | `text` of a `req_<id>.json` request |
| `REQUEST_MAX_AGE_HOURS` | 24 | An open request older than this is expired and the owner told once |
| `UPLOAD_MAX_BYTES` | 31 457 280 | One file through `?route=upload` (decoded) |
| `UPLOAD_MAX_BODY_CHARS` | 44 040 192 | The JSON body carrying it as base64 |
| `UPLOAD_MAX_PER_REQUEST` | 6 | Files one request may upload |
| `UPLOAD_AFTER_ANSWER_MIN` | 60 | An answered request still takes uploads this long (a reply may be written before its files) |
| `FALLBACK_SWEEP_MIN` | [3, 10] | One-off sweeps scheduled when a request opens, in case the wake never comes |
| `HOURLY_SWEEP_MIN` | 60 | Follow-up sweep interval while any request is open |

Developed by: LightAISolutions
