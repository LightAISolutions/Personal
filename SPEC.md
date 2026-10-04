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
| `registerMessageHandler` | `(name, fn(ctx) → true \| false)` | Owner free text; handlers run in name order; first `true` wins; otherwise the core opens a request for the inbound routine. A message with a `location` or `venue` and no text (Phase 12) skips the active flow, goes to the handlers, and when none claims it is dropped without a word — never forwarded. An update the webhook queues is stored without its `location` / `venue` (`message.hb_location_withheld: true`), so a location is never kept in a Sheet row |
| `registerQueueHandler` | `(kind, fn(item) → result)` | `item = {id, kind, source, payload, attempts, created_at}`; items come from `enqueue(kind, payload, source)` |
| `registerDailyJob` | `(name, fn)` | Runs once per local day inside the first sweep of that day |
| `registerSetupStep` | `(name, {label, description?, run() → string})` | One extra button on the setup page under "Pack steps" |
| `registerSheet` | `(name, headers[])` | A new tab, or extra columns appended to a core tab (never reordered) |
| `registerSnapshotProvider` | `(name, fn() → object)` | Merged into `state.json` under `name` (§3) |
| `registerRenderer` | `(name, fn(payload) → html)` | Shared HTML renderers other pack files reuse (`getRenderer(name)`) |
| `registerProposalGuard` | `(name, fn(env, proposal) → null \| reason)` | Runs inside the core `proposal` handler before anything is proposed; a string refuses and audits `proposal_refused` |
| `registerEnvelopeObserver` | `(name, fn(env, result))` | After any envelope handler returned without throwing |
| `registerHelp` | `(line)` | Extra `/help` line not tied to a command |
| `registerAlarm` | `(name, {next(nowMs) → ms \| null, run(nowMs)})` | Pack code that must run at a time (`core/17_alarms.js`). Name `^[a-z][a-z0-9_]{0,31}$`. All alarms share **one** pending `alarmTrigger` set at the earliest `next()` (never sooner than `ALARM_MIN_LEAD_SEC`); when it fires, every alarm with `next() ≤ now + ALARM_EARLY_SEC` runs, then the trigger is re-armed. Triggers run at or after their time, sometimes minutes late, so `run()` must compare against `now` and never assume exact timing; an alarm still due right after its run waits `ALARM_RETRY_MIN`. Call `alarmArm()` after a change that moves a `next()` |
| `registerRoute` | `(name, {methods, auth, handler(req) → {status, body}})` | An extra `?route=<name>` on the web app (§6). `methods` a non-empty subset of `['GET','POST']`; `auth` `'none'` \| `'admin'` (`?k=ADMIN_SECRET`) \| `'webapp'` (Telegram Mini App `initData` in the POST body `{initData, op, args}`, verified by `tgVerifyInitData` before the handler; POST only); `req = {method, params, body, user, auth_date, start_param}`; `body` is JSON-serialised by the router. Name `^[a-z][a-z0-9_-]{0,31}$`; the core names in `CORE_ROUTES` (`tg`, `wake`, `setup`, `health`, `upload`) throw at load time and are never looked up at run time |

Renderer names the core itself looks up: **`core_start`** — `fn({chatId}) → '' | html | {html, keyboard?}`, sent after the `/start` greeting and after pairing (`startExtras()` in `core/11_commands_builtin.js`; a throw is audited `start_extras_error`). A pack uses it to offer its first step (the tour-guide pack offers the interview). **`core_status`** — `fn() → '' | html` (escaped lines), appended to `/status` (`statusExtras()`; a throw is audited `status_extras_error`). The tour-guide pack shows its answer mode there.

**Plans in parts (tour-guide, Phase 11, `packs/tour-guide/gas/23_plan_parts.js`).** A `plan_digest` too large for one envelope arrives as parts (`part`, `parts` 1–8, one `build_id`). The pack stages each part in its own tab **`DigestParts`** (`registerSheet`; columns `trip build_id part parts chunk json top env_id in_reply_to received_at`, one row per ≤ 45 000-character chunk of the part's JSON — a Sheets cell holds 50 000) and registers the alarm **`tg_digest_parts`**: a build still incomplete **24 h** after its first part is dropped, audited `tg_parts_dropped`, and the owner told once ("a plan arrived incomplete; /replan tries again"). When the last part arrives the days are joined in part order, checked as one plan (date order, no duplicates, ≤ 31 days), stored once and delivered once (one notice or one plan-flow event); a re-sent part replaces its own rows; a part of another build discards the earlier build's staged rows (`tg_parts_superseded`); parts whose top fields differ drop the build; a part of a dropped build is refused (`tg_parts_refused`, Settings `tg_digest_dropped`, last 20). A digest without `parts` (or `parts` 1) stores as before.

**Outlines and day versions (tour-guide, Phase 11, `packs/tour-guide/gas/17_journey.js`, `36_journey_app.js`).** The pack's ninth and tenth envelope types. **Off until the owner sends `/journey on`** (Settings `tg_journey` = `on`; unset or anything else is off): the private routine answers these requests only after its Phase 11 update. While off, ✅ Done choosing sends the plan request exactly as before, and `/outline`, `/versions`, the `ol:` / `dv:` buttons (all but ⏩) and the app's Compare operations answer in one line that they are off and how to turn them on, sending no request (`journey.get` answers `on: false`; the others refuse `409 off`). With it on, on a dated trip of **3–31 days**, Done choosing asks the brain for an `outline` (request kind `outline` on routine PLAN: `{trip, dates, picks, later, skip}`) — up to three ways to shape the whole trip (keys `A`–`C`, one day per trip date in each; one when the trip has only one shape, which the core takes as it is while the flow waits for outlines, asking for the day versions at once); the owner takes one (✅ `ol:<trip key>:<tag>:<key>`, `/outline B` or `/outline A 2B` to take day 2 from B, or the Mini App's Compare screen), which asks for `day_versions` (request kind `day_versions`: the same fields plus `outline {build_id, base, mix?}`) — up to three versions of each date (one when the day has one way to go, shown with no choice to make, so the build offer never waits on it); per date the owner picks one (`dv:<trip key>:<tag>:<mmdd>:<key>`), and 🧱 **Build my plan** (`dv:<trip key>:b`) sends the plan request as before plus `outline` and `versions [{date, build_id, key}]`; one digest and one brochure follow. A trip of 1–2 days skips the outline; an undated trip, one over 31 days, the switch off, or ⏩ **Plan straight away** (in the choose step, `ol:<trip key>:d` on the waiting and outline messages) sends the plan request unchanged. `/versions <date>` on a planned day lists its versions and a choice replans that day (request kind `replan` plus `alternative {date, build_id, key}`). Outlines are stored in the tab **`Journeys`** (`trip build_id part json choice_json received_at chosen_at`), versions in **`DayVersions`** (`trip build_id date part json chosen received_at chosen_at`); the newest `KEEP_BUILDS` (6) builds per trip are kept. Both types carry `trip_update` like `research`. Payload bounds: `schemas/tour-guide-{outline,day-versions}.schema.json` and `checkOutline` / `checkDayVersions`; the core's validators mirror them and refuse unknown keys. Defaults and reasons: `decisions/WP-11f.md`.

**Trip days (tour-guide, Phase 12, `packs/tour-guide/gas/{15_weather,18_morning,19_late,24_here,25_checkin,26_lodging}.js`).** What the core does on its own while a trip is in progress, with no routine and no Claude usage. Alarms: **`tg_morning`** — each trip date with a stored day, the morning message at the owner's time (default 07:00; `/morning at HH:MM`, 05:00–11:59) or 30 min before the day's `leave_by` when earlier, never before 05:00, skipped after noon, once per date (Settings `tg_morning_sent`), its first chunk pinned silently and the previous one unpinned (`tg_morning_pin`); `/morning [day N\|date]` sends now (another date is a rehearsal: never pinned or marked), `/morning off\|on` (Settings `tg_morning`). **`tg_checkin`** — each trip date with stops at 21:00, or 15 min after the planned end (overlay included) when later, never after 22:30, once per date (`tg_checkin_sent`); `/checkin [day N]` (another date is a rehearsal whose taps are not saved). **`tg_here`** — the 10-minute life of a re-plan question. Running late: `/late <5–240> [day N]` and the buttons `rl:<trip key>:<yyyymmdd>:<15\|30\|60\|u>` keep an overlay per trip and date (Settings `tg_late`) that `/today`, the day card, the morning message and the check-in apply; a new digest for the date clears it. Re-plan from here: `rp:<trip key>:<yyyymmdd>` asks where from (the current stop, a shared location through a one-time `request_location` reply keyboard, ☔ rain, cancel; the open question in Settings `tg_here_wait`, no coordinates) and opens a `replan` request for that one date with C12's `from` (`{time, place}` \| `{time, point: {lat, lng}}`, 5 decimals), `visited` (≤ 25 slugs) and `rain` (`true`), checked against WP-12a's `restartErrors` bounds; the point travels only in that request file. The check-in's buttons are `ci:<trip key>:<yyyymmdd>[r]:<i>.<tag4>:<u\|d\|s\|l\|r\|h\|i>` and `ci:<trip key>:<yyyymmdd>[r]:<chunk>:ok`; taps are Choices run `checkin` (kind `review`, key `<date>\|<slug>`), and `/review` skips the stops they rated and merges both into its one `prefs` request (`rv:send:<trip key>` sends in one tap when every stop is rated). Weather: the core's one new outside call, Open-Meteo (no key; geocoding with the digest's `country_code`, Settings `tg_geo`; forecasts cached in `tg_weather`; the owner's `/dates <date> weather <town>` in `tg_weather_town`; ≤ 60 calls a day in `tg_weather_calls`; every weather line credits "Weather data by Open-Meteo.com" with a link to https://open-meteo.com/). Message handler `tg_a_here`. A lodging change: after a `/lodging` change on a trip whose stored plan days are not all over, the reply offers `lg:<trip key>:<yyyymmdd>` (one `replan` request for every stored day from that date — after a dated stay, from its first night — and the trip's today on; the new lodging is named in its `reason`, and since Phase 13 a dated stay list also travels as C13's `trip_update.lodging`) and `lg:<trip key>:k` (keep the plan); either tap edits the message so it cannot be tapped twice. Until the private repo pins Phase 12, its PLAN routine does not read `from`, `visited` or `rain`, so a re-plan from here re-plans the whole date. Defaults and reasons: `decisions/WP-12b.md`, `decisions/WP-12r.md` (the lodging offer).

**Stays and stale plans (tour-guide, Phase 13, Contract C13, `packs/tour-guide/gas/26_lodging.js`).** `/lodging` keeps the trip's stays: `/lodging <words> <first night> to <check-out>` adds one (dates `YYYY-MM-DD`, `today`, `tomorrow` — the trip's own day — or `day N`, N = 1 the trip's first day; the separator may be `to`, `→`, `–` or `-`) and replaces every stored stay whose nights overlap it, naming them; `/lodging remove <first night>` removes one, `/lodging clear` all; `/lodging` alone lists the stays with their nights, the trip nights no stay covers and any stay outside the trip's dates. `/lodging <words>` with no dates keeps the Phase 12 behaviour while no stay is set (≤ 300 characters) and is refused with the dated form and `clear` once stays exist. A stay is ≤ 200 characters with hidden characters stripped; a trip holds ≤ 12 stays; every refusal saves nothing. The trip row's `lodging` cell holds `{ text, nights?, stays: [{ text, from, to }], set_at }`, where `text` is one summary line per stay and `nights` their sum, so older readers still show the stays. Every request kind that carries a `trip_update` (research, plan, replan, outline, day_versions) sends `trip_update.lodging` — the whole sorted list, 1–12 stays — once a stay is set and the list passes the C13 check; after `clear` nothing is sent. `/route hotel` uses tonight's stay. **The fingerprint**: `lfp1:` and the 8-hex FNV-1a 32 of the stays, each normalised as `from|to|text` (lower-cased, whitespace collapsed, trimmed), in `from` order, joined by `\n`, over UTF-8 bytes the core encodes itself (no TextEncoder in Apps Script); without stays, of the undated text; no lodging → none. `plan` and `replan` requests carry it as `lodging_fp` (stamped in `tgOpenKindRequest`; a caller's value is replaced); Settings `tg_req_lodging` keeps it per request id (newest 60) and `tg_plan_lodging` keeps, per trip, the fingerprint a stored plan was built for and when it arrived — the digest's own `lodging_fp` (optional on `plan_digest`'s top and in its parts' top fields), else its request's, else none. **Stale**: a stored plan with a day still to come (the trip's today or later) is "built for different lodging" when that fingerprint differs from the current one; with none, only when the lodging's `set_at` is later than the plan's arrival (lodging saved before Phase 13 has no `set_at` and never shows the line). No lodging at all (after `clear`, or removing the last stay) never shows it: C13 never sends "no stays", so the routine keeps the old stays and the reply says so. Then `/trip`, every day card and the morning message show "⚠️ This plan was built for different lodging. `/lodging` offers to re-plan the days that changed or to keep the plan." **Re-plan or keep**: each change notes in `tg_plan_lodging` the earliest night it touched (`changed`: a new stay's first night, the first night of a stay it replaces, a removed stay's, the earliest cleared one; undated text → the trip's today) and offers 🔁 Re-plan N days from the earliest night any change touched since the plan arrived, with Keep the plan; `/lodging` alone repeats that offer while the line shows. A re-plan tap sends one `replan` for every stored day from there (and the trip's today) on. Keep sets `kept` to the current fingerprint and drops `changed`, so the line stops until the stays change again; nothing is sent. A `replan` that leaves out some of those days (a one-day `/replan`) carries the stored plan's own fingerprint, so its digest keeps the line; a digest whose fingerprint equals the stored record's keeps `changed` and `kept`. **Scouted candidates**: a `places_digest` place may carry `scouted: true`; the `Places` tab's new last column `scouted` stores it (`'true'` or empty; a tab made earlier gains the column on the next places digest and its rows read as not scouted), a digest that lists the place without the mark clears it, and `/places` and the app's Places screen show those places as their own group "🔎 Scouted, not chosen yet". Scout requests carry the owner's words as typed (`/scout …`; the app writes `/scout <what> in <where>`). Defaults and reasons: `decisions/WP-13c.md`.

Core helpers a pack may call: `tgSendOwner(html, opts)`, `tgSend(chatId, html, opts)` (owner chat only — the core never messages anyone else), `tgSendDocument(chatId, {driveFileId | blob, filename?, caption?, replyTo?, silent?})` / `tgSendOwnerDocument(spec)` (Telegram `sendDocument` multipart, ≤ `DOCUMENT_MAX_BYTES`; a larger Drive file is sent as its link and audited `document_too_large`), `tgEscape(text)` (mandatory on every untrusted string; parse mode is HTML), `tgKeyboard(rows)` (rows of `{text, data}` \| `{text, url}` \| `{text, web_app: {url}}` — a Mini App button, https only), `tgVerifyInitData(initData, {maxAgeSec?})` → `{ok, user, auth_date, start_param, reason}`, `tgSetMenuButton(url, text)` / `tgMenuButtonDefault()` (the owner chat's menu button opens a Mini App / Telegram's default), `flowStart(chatId, name, seed)` / `flowActive(chatId)` / `flowResume(chatId, input)` / `flowCancel(chatId)` (§5 `registerFlow`), `enqueue()`, `proposeAction(spec)`, `openRequest(spec)`, `getRequest(id)` (the Requests row: kind, status, chat — no payload) / `mailboxReadRequest(id)` (the request envelope read back from `to-brain/req_<id>.json`, `null` once archived — for a `registerEnvelopeObserver` that needs the request's payload, e.g. the tour-guide pack storing a `brochure` reply's `drive_file_ids` on the trip), `fireRoutine(name, text)`, `settingGet/settingSet`, `alarmArm()` / `alarmPending()` (§5 `registerAlarm`), the zone helpers `isoDateIn(tz, date?)` / `isValidTz(tz)` / `isoDateAdd(iso, days)` / `msAtLocal(tz, iso, hh, mm)`, `storeAppend/storeFind/storeUpdate/...` (§8), `audit(event, ref, detail)`, `getProp(propName('MY_KEY'))` for pack-specific properties, `HELPER.*`, `LIMITS.*`.

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

A handler's own refusals use the same shape with the statuses `400` (bad or unknown arguments, `bad_args {field}` / `missing_arg`), `404` (unknown operation or row), `409` (state conflicts such as `no_flow`, `no_more`, `busy {flow}`) and `503 busy` (the script lock is held). A route that writes declares `lock: true`, or `lock: function (req) → boolean` to lock only the calls that write; the router then takes the script lock after authentication and the daily cap (waiting up to `LIMITS.ROUTE_LOCK_WAIT_MS`, 10 s), answers `503 busy` when it cannot, and releases it after the handler, even when the handler throws. A predicate that throws locks. The tour-guide pack's `app` route (`packs/tour-guide/gas/32_app_api.js` and the files that add to `TG_APP_OPS`, 29 operations) is documented in `decisions/WP-9b.md`, its later operations in the decisions file of the WP that added them (the Compare screen's `journey.get`, `outline.choose`, `versions.get`, `versions.choose`, `versions.done`: `decisions/WP-11f.md`; while `/journey` is off `journey.get` answers `on: false` and the other four refuse `409 off`); the shell page that calls it is `live-site-pages/helper-app.html` (`decisions/WP-9c.md`).

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

There is no time-driven trigger. Every one-off trigger is created with `scheduleOneOff(fn, minutes)` (`ScriptApp.newTrigger(fn).timeBased().after(…)`), restricted to `ONE_OFF_HANDLERS = ['queueTrigger', 'wakeTrigger', 'alarmTrigger']` (the alarm trigger alone uses `timeBased().at(<time>)`), and deletes itself when it fires (`deleteOneOffTrigger(e)` — Apps Script leaves fired one-off triggers behind otherwise).

| Who schedules | Handler | When | Guard against pile-up |
|---|---|---|---|
| `enqueue()` | `queueTrigger` (+1 min) | A queue item was added | at most one outstanding (`q:scheduled` cache key); the worker reschedules itself while the queue is non-empty |
| `openRequest()` | `wakeTrigger` (+3 and +10 min) | A request was written | per request |
| `wakeSweep('wake')` | `wakeTrigger` (+1 min) | The wake route found the lock busy or was throttled | once per 90 s |
| any sweep | `wakeTrigger` (+60 min) | Requests are still open | once per hour |
| `/wake` command | `wakeTrigger` (+1 min) | Owner asked | the webhook handler holds the script lock, so it schedules instead of sweeping |
| `alarmArm()` (after each alarm run, after pack code changes a `next()`, and in the first sweep of each local day as a backstop) | `alarmTrigger` (at the earliest `registerAlarm` `next()`) | A pack alarm is due (e.g. the tour-guide booking alerts and 09:00 reminder) | exactly one pending: `alarmArm()` deletes every `alarmTrigger` before creating one; a busy lock leaves one retry in `ALARM_RETRY_MIN`; past `ALARM_MAX_RUNS_PER_DAY` runs the next waits 6 h |
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
| `helpers/core/17_alarms.js`, `registerAlarm` in `helpers/core/02_registry.js`, the `ALARM_*` limits in `helpers/core/00_config.js`, `alarmTrigger` in `ONE_OFF_HANDLERS` and the daily backstop in `helpers/core/12_wake.js`, zone helpers (`isoDateIn`, `isValidTz`, `isoDateAdd`, `msAtLocal`) in `helpers/core/01_util.js`, `helpers/tests/core_alarm.test.js`, `helpers/packs/tour-guide/gas/14_bookings.js`, the `bookings` handler in `helpers/packs/tour-guide/gas/20_envelopes.js`, Trips `tz` / `tgTripTz` / `tgOwnerTz` in `helpers/packs/tour-guide/gas/21_sheets.js`, `helpers/packs/tour-guide/schemas/tour-guide-{booking,bookings,plan-digest,trip}.schema.json`, `helpers/packs/tour-guide/brochure-map/brochure-map-bookings.mjs`, `helpers/tests/pack_tour-guide_gas_{bookings,trip_tz}.test.js`, `helpers/tests/pack_tour-guide_brochure-map_bookings.test.js`, `helpers/status/WP-10a.md`, `helpers/decisions/WP-10a.md` | WP-10a Trip zones, Contract C10, bookings (Phase 10) | The sixteenth registry (`registerAlarm`) and the one alarm trigger; the pack's `Bookings` tab and reminders |
| `helpers/packs/tour-guide/planner/planner-{buffer,category,notes}.mjs` and the honest-leg and tidy-up changes in `helpers/packs/tour-guide/planner/planner-{legs,day,hours,input,rain,budget,solve}.mjs`, `helpers/packs/tour-guide/fixtures/hill-town/`, the C10 fields in `helpers/packs/tour-guide/schemas/tour-guide-{day-plan,place}.schema.json`, `tgCmdDayMessages` and the `tgCmdDay…` helpers in `helpers/packs/tour-guide/gas/10_commands.js`, the C10 fields in `helpers/kits/brochure/` (schema, model, day and at-a-glance sections) and `helpers/packs/tour-guide/brochure-map/brochure-map-days.mjs`, `helpers/tests/pack_tour-guide_{planner_legs,planner_tidy,planner_notes,brochure_legs}.test.js`, `helpers/tests/pack_tour-guide_note_table.js`, `helpers/status/WP-10b.md`, `helpers/decisions/WP-10b.md` | WP-10b Honest legs and the tidy-up (Phase 10) | Google walking routes, flags, taxi time, buffers and spare time; new categories, covered-sight rain swaps, the note guard, shortfall offers, check-on-the-day lines, "about" times |
| `helpers/tests/pack_tour-guide_phase10_e2e.test.js`, the `bookingsSection` wiring in `helpers/packs/tour-guide/brochure-map/index.mjs`, `helpers/decisions/TG-PHASE-10.md` | Phase 10 coordinator | The end-to-end test across WP-10a and WP-10b and the merge choices |
| `helpers/packs/tour-guide/planner/planner-{anchors,chain,crowd,dinner,evening,facts,sun}.mjs` and the C11 changes in `helpers/packs/tour-guide/planner/planner-{day,input,assign,budget,hours,solve}.mjs` and `planner/index.mjs`, the Japan visit lengths in `helpers/packs/tour-guide/estimator/estimator-{defaults,minutes,build}.mjs`, `helpers/packs/tour-guide/fixtures/moving-day/` and `loadFixture`'s `dinners`, the C11 fields of `helpers/packs/tour-guide/schemas/tour-guide-day-plan.schema.json`, `helpers/tests/pack_tour-guide_planner_c11{,_units}.test.js`, `helpers/status/WP-11a.md`, `helpers/decisions/WP-11a.md` | WP-11a Planner: real starts and ends, bags, dinners, evenings, facts and crowd timing (Phase 11) | A day's own hours, arrival and departure points and bag step; a real dinner from the dinner pool; sunset and evening extras; the place's own close, last entry and visit length; crowd magnets in a quiet slot |
| `helpers/packs/tour-guide/facts/*` (`normalizeFacts`, `factsLines`, `menuLine`, `factsStale`, `factsConflict`, `facts/README.md`, fixtures), the C11 fields of `helpers/packs/tour-guide/schemas/tour-guide-{trip,place}.schema.json` with `checkTrip`'s day overrides and season and `checkPlace`'s facts in `helpers/packs/tour-guide/schemas/tour-guide-checks.mjs`, the gem screen's `out_of_season`, `local_favourite` and `crowd_magnet` in `helpers/packs/tour-guide/gems/gems-{screen,flags,line,project,record,weights}.mjs`, `helpers/tests/pack_tour-guide_{facts,c11_inputs,gems_c11}.test.js`, `helpers/status/WP-11b.md`, `helpers/decisions/WP-11b.md` | WP-11b Place facts and research inputs (Phase 11) | C11 `place.facts`: a place's own visit facts, display lines, staleness and conflicts with Google hours (the one conflict rule; the planner's `ownHoursConflict` calls it); library only |
| `helpers/packs/tour-guide/season/*` (`normalizeSeason`, `eventsOn`, `bloomOn`, `outOfSeason`, `season/README.md`, fixtures) | WP-11b Season sheet (Phase 11) | C11 `trip.season`: weather, blooms and dated events; the gem screen's `out_of_season` drop; library only |
| `helpers/packs/tour-guide/gas/23_plan_parts.js`, the C11 digest and shortlist fields in `helpers/packs/tour-guide/schemas/tour-guide-{plan-digest,shortlist}.schema.json`, `checkPlanDigest` in `helpers/packs/tour-guide/schemas/tour-guide-checks.mjs`, the C11 lines of `helpers/packs/tour-guide/gas/{10_commands,12_flow_plan,20_envelopes,21_sheets,22_people,32_app_api}.js` (day card, `/dates <date> …`, `tg_trip_days`, `trip_update.day_overrides`, "local favourite", `trip.digest`), `helpers/tests/pack_tour-guide_gas_c11.test.js`, `helpers/status/WP-11c.md`, `helpers/decisions/WP-11c.md` | WP-11c Core: C11 storage and display, plans in parts, per-day `/dates` (Phase 11) | The `DigestParts` tab and the `tg_digest_parts` alarm (§5, §18) |
| `helpers/kits/brochure/lib/sections/season.mjs`, the C11 fields in `helpers/kits/brochure/{schema/brochure.schema.json,lib/model.mjs,lib/render.mjs,lib/css.mjs,lib/icons.mjs,lib/mapframe.mjs,lib/sketch.mjs,lib/sections/day.mjs,lib/sections/cards.mjs,README.md}`, `helpers/packs/tour-guide/brochure-map/brochure-map-{facts,sample-c11}.mjs` and the C11 mapping in `helpers/packs/tour-guide/brochure-map/{brochure-map-days,brochure-map-cards,brochure-map-attribution,index}.mjs`, `helpers/tests/kit_brochure_c11.test.js`, `helpers/tests/pack_tour-guide_brochure-map_c11.test.js`, `helpers/status/WP-11d.md`, `helpers/decisions/WP-11d.md` | WP-11d Brochure: the design pass for the C11 facts (Phase 11) | Day start and end, bags, last entry, dinner card, "This evening", place facts with sources, the season page; every fact and season line goes through `brochure-map-facts.mjs` (bound to `facts/` and `season/`); a plan without C11 fields renders the same HTML |
| `helpers/tests/pack_tour-guide_phase11_e2e.test.js`, `helpers/tests/pack_tour-guide_phase11_wave2_e2e.test.js`, `helpers/tests/harness/tour-guide-digest.js`, the brochure's "Free days" line (`freeDay` in `helpers/packs/tour-guide/brochure-map/brochure-map-days.mjs`), `checkDayChain` / `dinnerOut` and the generalised `checkDayPlan` / `checkPlan` in `helpers/packs/tour-guide/schemas/tour-guide-checks.mjs` (moved from `planner/planner-chain.mjs`, which re-exports it), the planner's `ownHoursConflict` on `factsConflict`, the 30-leg digest cap in `helpers/packs/tour-guide/schemas/tour-guide-plan-digest.schema.json` and `helpers/packs/tour-guide/gas/20_envelopes.js`, the brochure adapter's binding to `facts/` and `season/`, the day card's leg placement in `helpers/packs/tour-guide/gas/10_commands.js` (each walk once, before what it leads to), rain swaps on the place's own facts in `helpers/packs/tour-guide/planner/planner-rain.mjs`, the closed-day Later reason in `helpers/packs/tour-guide/planner/planner-assign.mjs`, `helpers/decisions/TG-PHASE-11.md` | Phase 11 coordinator | The end-to-end tests across WP-11a–WP-11d and across the wave-2 journey, the fixes they found and the merge choices |
| `helpers/packs/tour-guide/journey/*` (`outlineDraft`, `outlineInput`, `checkOutline`, `planVersions`, `checkDayVersions`, `cachedMaps`, `assembleChosen`), `helpers/packs/tour-guide/planner/planner-outline.mjs` and the `outline` hooks in `helpers/packs/tour-guide/planner/planner-{assign,day,dinner,solve}.mjs` and `planner/index.mjs` (`planDates`, `outlinePools`, `versionSetBudget`), `helpers/packs/tour-guide/fixtures/two-stays/` with `JOURNEY_FIXTURE_NAMES`, `helpers/tests/pack_tour-guide_journey.test.js`, `helpers/status/WP-11e.md`, `helpers/decisions/WP-11e.md` | WP-11e Journey: outlines, day versions, the chosen mix (Phase 11) | Library only: the brain's plan routine builds the `outline` and `day_versions` payloads and the plan from the chosen versions; no call of its own but the planner's route requests, counted for the whole set before the first |
| `helpers/packs/tour-guide/gas/{17_journey,36_journey_app}.js` and the journey lines of `helpers/packs/tour-guide/gas/{00_common,12_flow_plan,32_app_api}.js`, `helpers/packs/tour-guide/schemas/tour-guide-{outline,day-versions}.schema.json` with `checkOutline` / `checkDayVersions` in `helpers/packs/tour-guide/schemas/tour-guide-checks.mjs` and their entries in `schemas/index.mjs`, the two types in `helpers/packs/tour-guide/helper.json`, the Compare screen and chat-style day cards in `live-site-pages/helper-app.html` (with its version file and changelog), `helpers/tests/pack_tour-guide_{gas_journey,journey_payloads}.test.js`, `helpers/tests/shell_helper-app_compare.playwright.mjs`, `helpers/status/WP-11f.md`, `helpers/decisions/WP-11f.md` | WP-11f Core and Mini App: compare outlines and days (Phase 11) | The `outline` and `day_versions` envelopes, the outline → versions → Build my plan path in the chat and the app, `/outline`, `/versions <date>` |
| `helpers/packs/tour-guide/gas/{15_weather,18_morning,19_late,24_here,25_checkin}.js`, the Phase 12 lines of `helpers/packs/tour-guide/gas/{10_commands,13_flow_review,20_envelopes,21_sheets,23_plan_parts}.js`, the C12 output fields of `helpers/packs/tour-guide/schemas/tour-guide-plan-digest.schema.json` and `checkPlanDigest`, the location withholding in `helpers/core/10_router.js`, `location` / `venue` in `helpers/tests/harness/gas-mocks.js`, `helpers/tests/pack_tour-guide_phase12_world.js`, `helpers/tests/pack_tour-guide_gas_{c12,late,morning,here,checkin}.test.js`, `helpers/status/WP-12b.md`, `helpers/decisions/WP-12b.md` | WP-12b Trip days in the core (Phase 12) | The morning message and weather, running late, re-plan from here, the evening check-in and the review's merge (§5 "Trip days") |
| `helpers/packs/tour-guide/gas/*` (the Phase 13 lines: stays in `26_lodging.js`, the fingerprint stamp in `00_common.js`, the stale line in `10_commands.js` and `18_morning.js`, `scouted` in `21_sheets.js`, `20_envelopes.js` and `32_app_api.js`, A10 in `14_bookings.js` and `21_sheets.js`, A11 in `00_common.js`, A2 in `10_commands.js`, Scout's words in `16_scout.js` and `35_scout_app.js`), the C13 fields of `helpers/packs/tour-guide/schemas/tour-guide-{plan-digest,places-digest}.schema.json`, the Places screen of `live-site-pages/helper-app.html`, `helpers/tests/pack_tour-guide_p13c_*.test.js` and `pack_tour-guide_p13c_world.js`, `helpers/status/WP-13c.md`, `helpers/decisions/WP-13c.md` | WP-13c Core: stays, stale plans, messages, Scout's raw text and group (Phase 13) | `/lodging` stays and C13's `trip_update.lodging`, `lodging_fp` and the stale-plan line, `scouted` places, A2 · A10 · A11 · A16 (§5 "Stays and stale plans") |
| `helpers/tools/new-branch.mjs`, `helpers/tools/branch-templates/`, `helpers/tools/README.md`, `helpers/tests/tools_new_branch.test.js`, `helpers/status/WP-14a.md`, `helpers/decisions/WP-14a.md` | WP-14a Branch scaffold (Phase 14) | `node helpers/tools/new-branch.mjs <name>` writes a pack branch (core module, app ops, schema, validators, tests, private skill); `--check <name>` names a missing part, and the core module's `@branch` line marks the parts left out on purpose |
| `helpers/packs/tour-guide/scout/scout-{weights,rank,text,payload,board}.mjs` and `scout/index.mjs` (the C14 ranking), the C14 `parts.local` and `not_judged` label in `helpers/packs/tour-guide/schemas/tour-guide-scout.schema.json` and `gas/16_scout.js`, the Scout bars of `live-site-pages/helper-app.html`, `helpers/tests/pack_tour-guide_p14b_scout.test.js`, `helpers/status/WP-14b.md`, `helpers/decisions/WP-14b.md` | WP-14b Scout's ranking (Phase 14) | Quality bar per group, chain and crowd penalties, the relevance rescue, the local part, `estimateReach` and `kindLikely` (`decisions/TG-SCOUT.md`) |
| `helpers/packs/tour-guide/vegcard/*`, `helpers/packs/tour-guide/schemas/tour-guide-veg-card.schema.json` and its `PAYLOAD_KINDS` entry, `veg_card` in `helper.json`, `helpers/packs/tour-guide/gas/{27_vegcard,37_vegcard_app}.js`, the C14 lines of `gas/{18_morning,32_app_api}.js` (the morning line, `has_vegcard`, `brochure.pdf`), the Veg card screen and brochure PDF button of `live-site-pages/helper-app.html`, `helpers/tests/pack_tour-guide_vegcard{,_gas,_app}.test.js`, `helpers/status/WP-14c.md`, `helpers/decisions/WP-14c.md` | WP-14c Veg card and brochure PDF (Phase 14) | `/vegcard`, the `veg_card` envelope and the VegCards tab; the app's `vegcard.get` and `brochure.pdf` ops |
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
| `ALARM_EARLY_SEC` | 60 | An alarm whose `next()` is at most this far ahead runs when `alarmTrigger` fires |
| `ALARM_MIN_LEAD_SEC` | 60 | The alarm trigger is never set sooner than this from now (a past `next()` arms one minute out) |
| `ALARM_RETRY_MIN` | 15 | An alarm still due right after its run, or an alarm run that found the lock busy, waits this long |
| `ALARM_MAX_RUNS_PER_DAY` | 48 | `alarmTrigger` runs per local day; past it the next run waits 6 h (trigger-quota guard) |

Pack constants of the tour-guide pack that bound the same paths (they live in the pack's `gas/*.js`, not in `LIMITS`, and change with a pack release):

| Constant | Value | Where it bites |
|---|---|---|
| `TG_ENV_DIGEST_MAX_CHARS` | 60 000 | One `plan_digest` payload — for a plan in parts, each part |
| `TG_ENV_PARTS_MAX` | 8 | `part` and `parts` of a plan in parts |
| `TG_PARTS.TTL_MS` | 86 400 000 (24 h) | A plan still incomplete this long after its first part is dropped (§5, `tg_digest_parts`) |
| `TG_PARTS.MAX_DAYS` | 31 | Days in a joined plan |
| `TG_CELL_CHUNK` / `TG_CELL_MAX` | 45 000 / 50 000 | Chunk size of a `DayPlans` JSON cell and a `DigestParts` row; Google Sheets' per-cell limit |
| `TG_TRIP_DAY_PLACE_MAX` / `TG_TRIP_DAY_NOTE_MAX` | 120 / 120 | The place words and the bags note of a `/dates <date>` form (Settings `tg_trip_days`) |
| `TG_JY.OUTLINE_MIN_DAYS` / `TG_JY.MAX_DAYS` | 3 / 31 | A dated trip this long gets outlines first; shorter gets day versions straight away; longer plans directly (§5) |
| `TG_JY.KEEP_BUILDS` | 6 | Outline and day-version builds kept per trip in `Journeys` / `DayVersions` |
| `TG_JY.BUILD_MAX` | 120 | Characters of an outline's or a day-versions' `build_id` |
| `TG_LATE.MIN` / `MAX` / `TAPS_MAX` / `KEEP_DAYS` | 5 / 240 / 20 / 3 | `/late` minutes; taps kept per day; days an overlay is kept (§5 "Trip days") |
| `TG_WX.AHEAD_DAYS` / `TRIES` / `RETRY_MIN` | 15 / 2 / 10 | A date further ahead says "not available yet"; Open-Meteo calls tried per town, date and asking day, and the gap between them |
| `TG_WX.MAX_CALLS_PER_DAY` | 60 | Outside weather calls a day (Settings `tg_weather_calls`); the service allows 10 000 |
| `TG_WX.TOWN_MAX` | 60 | A `/dates <date> weather <town>` |
| `TG_MORNING.EARLIEST` / `CUTOFF_HOUR` / `LEAD_MIN` / `BACKSTOP_MIN` | 05:00 / 12 / 30 / 15 | The morning message: never before 05:00, skipped after noon, 30 min before `leave_by`, the backstop run after a killed one |
| `TG_HERE.WAIT_MIN` / `VISITED_MAX` / `POINT_DECIMALS` | 10 / 25 / 5 | Re-plan from here: the question's life, `visited` length, a shared point's rounding |
| `TG_CHECKIN.AT` / `LATEST` / `CUTOFF` / `PER_MESSAGE` / `STOPS_MAX` | 21:00 / 22:30 / 23:30 / 12 / 40 | The evening check-in: earliest and latest time, the run cutoff, stops a message and a day |

Developed by: LightAISolutions
