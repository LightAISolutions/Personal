# Tour Guide — switch-on guide

*For the owner. Plain steps, no personal data: every id, token and key below is a placeholder you fill in from your own accounts. Phase 7 (`helpers/prompts/TG-PHASE-7.md`) walks through this guide with you live, about 90 minutes; the first thing after pairing is the interview. Framework reference: `helpers/SPEC.md` §6, §7, §12, §14, §17; pack reference: `helpers/packs/tour-guide/README.md`; cost and quota audit with every figure cited: `helpers/decisions/TG-PHASE-6.md` §3.*

## 0 Before you start

- **Merge the private repo's branches.** TourGuide PR #3 (the review-decision path, `prefs-build-ingest.mjs --decisions`) and PR #4 (the Phase 5 framework pin and the Phase 6 integration tools) must be on TourGuide `main` before the routines are created — a routine checks out `main`. Merge #3 first, then #4 (it was branched from #3's head).
- **Personal `main` carries Phase 6** (`repository-information/repository.version.txt` ≥ `v01.28r`), so `helpers-dist` holds the hardened core the private repo pins and `deploy-helper.yml` deploys the same code.
- **A Google Cloud project** with these APIs enabled: Places API (New), Routes API, Places Aggregate API, Maps Static API. Two keys: the **Maps key** (restricted to Places API (New), Routes API and Places Aggregate API) goes into the Claude environment's API credentials for the hosts `places.googleapis.com`, `routes.googleapis.com` and `areainsights.googleapis.com` — the proxy injects it, no routine ever sees it; the **Static Maps key** (restricted to Maps Static API) becomes the environment variable `MAPS_STATIC_KEY`. Set a billing budget alert on the project (a few dollars a month) as the last line of defence; the kits stop at 80 % of each free tier on their own.
- **A Telegram bot** from BotFather (`/newbot`) — keep the token for the setup page, nowhere else.
- **A Google account** for the Apps Script project (the consumer quotas in the audit assume a gmail.com account), `clasp login` done once on your machine, and a GitHub `production` environment in the Personal repo restricted to `main`.
- **A Claude environment** for the routines (the one holding the API credentials above), with the TourGuide repo attached.

## 1 Deploy the core (`.github/workflows/deploy-helper.yml`)

1. In the Apps Script editor (or `clasp create --type webapp`), create the project and note its **script id**.
2. One first push by hand: `node helpers/tools/bundle.mjs tour-guide` in Personal, then `clasp push --force` from `helpers/dist/tour-guide/` with a `.clasp.json` naming the script id. Deploy it as a web app — *execute as me*, *anyone* — and note the **deployment id**. The `/exec` URL of that deployment is the one Telegram and the routines will use; it never changes because the workflow always redeploys the same deployment.
3. In Personal → Settings → Environments → `production`, add the secrets `CLASPRC_JSON` (the contents of `~/.clasprc.json`), `TOURGUIDE_SCRIPT_ID` and `TOURGUIDE_DEPLOYMENT_ID`.
4. Run **Deploy helper** by hand once (Actions → Deploy helper → Run workflow). From then on every merge to `main` that touches `helpers/core/**` or `helpers/packs/**` redeploys the pack.
5. Check: open `<WEBAPP_URL>` in a browser — it answers `{"ok":true,"app":"tour-guide","version":…}` with no state and no secrets.

## 2 Script Properties

Set them in the Apps Script editor → Project settings → Script properties (`property_prefix` is empty for this pack, so the names are exactly these). The setup page (§3) writes most of the core's; you type the rest.

| Property | Required | Secret | Set by / value |
|---|---|---|---|
| `WEBAPP_URL` | yes | no | setup page step 0 — the `/exec` URL |
| `BOT_TOKEN` | yes | **yes** | setup page step 1 — the BotFather token |
| `ADMIN_SECRET`, `WEBHOOK_SECRET`, `PAIR_CODE` | generated | **yes** | `printSetupUrl()` generates them; `PAIR_CODE` is deleted once you have paired |
| `SHEET_ID`, `ROOT_FOLDER_ID`, `MAILBOX_FOLDER_ID` | yes | no | setup page step 2 creates the state Sheet and the Drive folders `TourGuide/` and `TourGuide/mailbox/` |
| `OWNER_CHAT_ID` | yes | no | pairing (`/start <code>`) |
| `TIMEZONE` | recommended | no | your IANA zone, e.g. `America/New_York`; the routines' `CRON_TZ` must match it |
| `ROUTINE_FIRE_URL_<NAME>` / `ROUTINE_FIRE_TOKEN_<NAME>` | yes, one pair per routine | URL no / **token yes** | from the claude.ai routine editor (§4); names `CHAT`, `RESEARCH`, `PLAN`, `NOTES`, `BROCHURE`, `PREFS`, `PLACES` |
| `MAX_ROUTINE_FIRES_PER_DAY` | recommended | no | **`24`** for Tour Guide (the core default is 12; a full `/plan` with two More rounds uses 6 fires, every free-text question in the free lane uses 1) |
| `MAX_PROPOSALS_PER_DAY`, `MAX_WAKES_PER_DAY`, `WAKE_MIN_INTERVAL_SEC` | optional | no | defaults 30 / 500 / 15 are fine |
| `CLAUDE_API_KEY` | only for `/smart` | **yes** | a Claude API key from platform.claude.com; without it `/smart on` refuses and answers stay free |
| `CHAT_API_ENABLED` | optional | no | `true` turns the paid lane on before any `/smart`; default `false` |
| `CHAT_API_MODEL`, `CHAT_API_MODEL_LOOKUP`, `CHAT_API_MAX_PER_DAY` | optional | no | defaults `claude-sonnet-5-5`, `claude-haiku-4-5-20251001`, `60`; set `CHAT_API_MODEL_LOOKUP=claude-haiku-4-5` when the dated Haiku snapshot is retired (not before 2026-10-15) |

Secrets are redacted from every audit row, preview and page; every property whose name ends in `_API_KEY` is redacted too.

## 3 Setup page and pairing

1. In the Apps Script editor run `printSetupUrl()` once. It generates `ADMIN_SECRET`, `WEBHOOK_SECRET` and a `PAIR_CODE` if they are missing and logs the setup URL (`<WEBAPP_URL>?route=setup&k=<ADMIN_SECRET>`). If the logged URL is the `/dev` one, open it anyway: step 0 asks for the `/exec` URL and the page moves there.
2. Work down the page in order: **0** save the deployment URL · **1** paste the bot token (a sloppy BotFather paste is tolerated) · **2** create the Sheet and the Drive folders · **3** set the Telegram webhook · **4** pair: open your bot in Telegram and send `/start <pair code>` from the page · **5** sweep and write the first `state.json` · **6** send a test message.
3. The status table at the bottom shows the web-app URL, the **wake URL** (the routines need it — it is also in `state.json` as `wake_url`), the owner chat, the Sheet and mailbox links and, later, the configured routines. Maintenance buttons: clear one-off triggers, reset pairing (issues a new code), rotate the webhook secret.
4. Until you pair, the bot answers nobody; after pairing it answers only your chat. A stranger's first message in six hours is audited (`tg_unauthorized`), the rest are dropped.

## 4 The seven routines (claude.ai routine editor)

For each row: new routine → attach **only** the private repo `LightAISolutions/TourGuide` (never Personal) → paste the prompt from `routines/<name>.prompt.md` (shape: `Run the skill at skills/<name>/SKILL.md in this repository, following CLAUDE.md ROUTINE MODE. Do only what that skill says, then end.`) → pick the model and effort → set the trigger → enable only the listed connectors → choose the environment from §0. For an API-triggered routine the editor shows its **fire URL** and **token**: paste them into Script Properties as `ROUTINE_FIRE_URL_<NAME>` and `ROUTINE_FIRE_TOKEN_<NAME>`. Then reload the setup page: "Routines configured" must list all seven (`CHAT` is the inbound one).

| Routine | Fire name | Trigger | Connectors | Model · effort |
|---|---|---|---|---|
| `prefs-build` | `PREFS` | API (the core fires it for `prefs` requests: interview, review, decisions) | Google Drive; Gmail and Google Calendar read-only for the connector window | Opus 5.5 · high |
| `trip-research` | `RESEARCH` | API (`research`) | Google Drive, web search and fetch; Gmail and Google Calendar read-only (used by the `intake` step only) | Opus 5.5 · high (Fable 5.1 · high for a trip that matters) |
| `plan-days` | `PLAN` | API (`plan`, `replan`) | Google Drive | Opus 5.5 · high |
| `place-notes` | `NOTES` | API (`notes`) | Google Drive, web search and fetch | Opus 5.5 · high |
| `brochure-build` | `BROCHURE` | API (`brochure`) | Google Drive | Opus 5.5 · high |
| `chat` | `CHAT` | API (free text: `message`, `ask`) | Google Drive, web search and fetch | Opus 5.5 · medium |
| `trip-check` | `PLACES` | API (`places`) **and** a schedule: `CRON_TZ=<your zone>` then `0 7 * * 1` (Mondays 07:00) | Google Drive | Opus 5.5 · high |

Environment variables (in the Claude environment, never in a file): `MAPS_USAGE_LEDGER=log/maps-usage-ledger.json`, `MAPS_SNAPSHOT_STORE=/tmp/tour-guide/snapshots.json`, `MAPS_STATIC_KEY=<static maps key>`, `PREFS_REF_SALT=<any long random string>` (prefs-build only; it salts the hashes that stand in for e-mail ids in the prefs ledger). The fire `text` of an API run is only a request id; the routine reads the request from the Drive mailbox and treats everything else as data.

Before Phase 7 trusts the funnel, run one live smoke from a TourGuide checkout in the same environment: `node vendor/helpers/kits/maps/index.mjs aggregate --live …` (see the kit's `--help`) — if `areainsights.googleapis.com` is not in the credential's hosts the call fails closed and the funnel falls back to rating-count percentiles.

## 5 First thing after pairing: the interview

Right after `/start` the bot offers it: *"🧭 To make plans fit you, start with a short interview — 39 quick questions, one at a time, skip any."* Tap the button or send `/interview`. Thirteen sections (pace, food, activities, climate, mobility, crowds and timing, budget, lodging, companions, must-avoid, planning style, hidden gems, past favourites); pick and scale questions are one tap, multi-choice toggles then **Done**, text questions take your words (split on commas and newlines into at most five values), **Skip** is on every question. `/interview <section>` re-asks one section, `/interview restart` starts over, `/cancel` stops; the interview resumes where it was for seven days.

When you finish, the bot says "building your profile…" and fires the `PREFS` routine. Within a few minutes two things arrive: the **profile summary** (also under `/profile`) and, if any of your text answers produced wording the kit was not sure about, a **review**: *"🧭 N preferences to review — ✅ keep · ✏️ change · ❌ drop"*, one message per candidate with three buttons. ✅ confirms the statement, ❌ drops it, ✏️ asks for your wording as the next message (≤ 200 characters, within 30 minutes). When every candidate in the batch is decided the bot sends your decisions back as a `prefs` request and the routine applies them; nothing enters the profile that you did not confirm. Repeat the review whenever a trip's choices or a post-trip review produce new candidates.

## 6 A `/plan` walkthrough

1. **`/plan <destination>`** (e.g. `/plan Lisbon`). The bot opens an *intake* research request; the `RESEARCH` routine reads your calendar and mail through the connectors for anything already booked and answers with the **trip facts**: a numbered list (dates, flights, lodging, bookings) with `n ✅` confirm · `n ✏️` edit (your next message replaces it) · `n ❌` drop taps, then **▶️ Continue**.
2. **Questions for what is missing** — dates first (typed), then skippable ones (**⏭ Skip**). `/lodging <where>` sets where you stay at any time; the planner needs it before building days.
3. **Research** (`research new`, a few minutes; the bot says so). The **shortlist** arrives as one message per group — *Activities* and *Food* — eight numbered places per message: name, minutes, area, label and a "why you" line from your profile; 💎 marks a hidden gem with its line (our own words, never Google's numbers). Under each line: `n ✅ Want` · `n 🔖 Later` · `n ❌ Skip`. The summary line keeps count ("So far: 3 ✅ · 1 🔖 · 2 ❌").
4. **More**: **➕ More options** or **💎 More gems** asks for another round (three rounds at most per plan); type a place name to add your own pick and tap **🔎 Look up my picks**; `/seed <names>` does the same.
5. **✅ Done choosing** sends the `plan` request with your picks, laters and skips. The `PLAN` routine fetches fresh hours, solves the days, writes the notes and builds the brochure in one run (five to fifteen minutes for a week-long trip).
6. The **plan digest**: *"🗓 Trip — N days"*, one line per day with its theme and stop count, ⚠️ notes where something did not fit, then **📄 Brochure** · **🔁 Replan a day** · **🔖 Later** and one button per day. The files follow as documents: `plan-<build>.json`, the brochure HTML and PDF, the notes.
7. **Living with the plan**: `/today` and `/day <n>` show a day with ◀ ▶ navigation; `/later` lists what you kept for later with ⬆️ buttons to promote a place onto a day (a `replan` of that day); `/place <name>` and `/places` browse the places repository (📝 full note · ➕ add · 🔁 re-check); `/notes [names]` writes notes; `/replan` and `/brochure` rebuild; `/trip` switches trips. A re-sent brochure (📄 or `/brochure`) uses the stored PDF — no rebuild — and only asks the routine when there is none yet.
8. **After the trip**, the day after it ends the bot offers **⭐ Review the trip** once: per stop **👍 Worth it** · **👎 Not really** · **⏭ Skipped it**, then **⏩ Needed longer** · **⏪ Less was fine** · **👌 About right** to calibrate the visit lengths; **✅ Finish** sends one `prefs` request and the trip becomes `done`. The next `/plan` to the same destination lists the places you already know first (*seen before*) and tells you if one has closed.

## 7 `/smart` — the paid answer lane and what it costs

Free text that is not a command normally becomes a `message` request answered by the `CHAT` routine inside your claude.ai subscription (two to ten minutes, nothing per use). `/smart on` answers quick questions in the chat at once through the Claude API, paid per use; `/smart off` returns to the free lane; `/smart` alone shows the mode, today's count and the dollar estimate; `/status` shows the mode on its *Answers:* line. It needs `CLAUDE_API_KEY` in Script Properties — without the key `/smart on` refuses and nothing changes.

What it costs (list prices verified 2026-10-01, `helpers/decisions/TG-PHASE-6.md` §3.2): one answer on `claude-sonnet-5-5` ≈ **$0.025** (≤ 8k input tokens of trip context at $2 per million, ≤ 900 output tokens at $10 per million); a trivial lookup on `claude-haiku-4-5-20251001` ≈ $0.01. The cap `CHAT_API_MAX_PER_DAY` (60) bounds a day at ≈ $1.50, a week at ≈ $10.50; five questions a day ≈ $0.90 a week. Questions longer than 1,500 characters, anything the model marks as needing the deep lane, and every failure fall back to the free lane, so you never lose an answer. Smart answers hold the webhook for up to 25 s and use no trigger minutes.

## 8 How to tell when something is stuck

- **`/status`** — *Open requests* is the number of questions and plans still waiting for a routine; *Routine fires today* against your cap; *Last sweep* (a healthy bot sweeps within 3 and 10 minutes of every request and hourly while one is open); *One-off triggers* (0–3 is normal); *Answers:* free or smart.
- **`/pending`** — proposals waiting for your ✅ (Tour Guide proposes nothing in v1, so this is normally empty); **`/wake`** — forces a mailbox sweep within a minute, the first thing to try when an answer seems late.
- **The wake route** — `GET <wake_url>` answers `{"ok":true,"processed":N,"open_requests":N,"remaining":N}`; `throttled` means two wakes within 15 s (a follow-up sweep is already scheduled), `daily_cap` means 500 wakes today, `"not set up"` means step 2 of the setup page was never completed.
- **What the bot tells you** — *"⏳ Saved, but no routine answers `<kind>` yet — set `ROUTINE_FIRE_URL_<NAME>` and …"* means that routine's fire URL and token are missing (§4); *"⏳ Saved — the routine could not be fired right now (daily_cap)"* means `MAX_ROUTINE_FIRES_PER_DAY` is used up — raise it or wait for midnight in your zone; the request stays open 24 hours and the next sweep delivers the answer if the routine runs anyway. *"too large to attach"* with a Drive link means a file passed Telegram's 50 MB.
- **The AuditLog tab** of the state Sheet names the cause: `routine_not_configured`, `routine_cap_reached`, `routine_fire_error` (the fire URL or token is wrong, or the routine was deleted), `envelope_rejected` (the routine wrote a payload the core refused — the field is named; the routine's own run log in claude.ai shows why), `request_expired` (24 hours without an answer), `document_too_large`, `tg_api_error`.
- **On the routine side** — the routine's run history in the claude.ai editor, and in TourGuide `log/<date>.md` (one line per run) and `TourGuide/mailbox/archive/rejected/` on Drive (payloads the core refused).

## 9 What a week costs and what stops a runaway

Expected bill **$0–1 a week** (`helpers/decisions/TG-PHASE-6.md` §3.4): Maps calls stay inside the free tier (a research round ≈ $3.93 and a plan ≈ $1.55 at list price, $0 billed; the kit's ledger stops every SKU at 80 % of its free cap, so at most about 13 research rounds a month), routines run inside the subscription, Apps Script is free, `/smart` costs only what §7 says. Worst case ≈ $11 a week with `/smart` at its cap every day. Stops: the Maps ledger ceilings and `PlanBudgetError`, `MAX_ROUTINE_FIRES_PER_DAY`, `CHAT_API_MAX_PER_DAY` and its cooldown, the research kit's 20 searches / 40 fetches / 30 minutes per run, `MAX_WAKES_PER_DAY`, the `/route` cap of 200 a day — and your Cloud billing alert.

## 10 Google content

Places data from Google (hours, ratings, photos) is shown to you at build time and otherwise lives only in the build's scratch snapshot store; memory keeps `place_id` and coordinates for up to 30 days, as the Maps Platform terms allow. The brochure is the one document that keeps Google hours and ratings (`show_google_content`, default yes). The chat has no button for it yet: tell the Tour Guide in a message that you want a brochure without Google hours and ratings, or ask a development session to set the trip's standing answer, and the plan routine builds it that way — a button is a Phase 8 item. The 💎 gem lines use our own words, never Google's numbers.

Developed by: LightAISolutions
