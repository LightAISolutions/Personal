# Tour Guide — Phased Build Plan (and the shared helper framework)

> **Status:** plan only, nothing built yet · written 2026-09-30 · authored on **Fable 5.1 · effort xhigh**
> **Supersedes:** the v01.06r draft at this same path, written on Opus 5.5 · Medium. Its structure was kept where it held up; every web-sourced fact was re-checked this session (§3) and several were corrected (§11). Version bookkeeping for this file is done by the coordinating session, not here. After authoring, the coordinating session (Opus 5.5 · xhigh, after a model fallback) made one fact correction: Chromium *is* pre-installed in this environment's image (fact 10), which it checked on the machine; it also re-checked the Maps prices in fact 3 against the pricing page.
> **Scope:** a personal Tour Guide helper (preference-aware research, visit-time estimates, route-optimized day plans, "saved for later" lists, personalized place notes, brochure-quality output, and a Telegram chatbot) built on **reusable helper infrastructure** in this repo so later helpers (the personal knowledge wiki in `FUTURE-CONSIDERATIONS.md` first) share it.
> **Reference, not modified:** `LightAISolutions/AssistantBrain` (the Chief of Staff). Its patterns and generic code are reused; its code, data and environments are not changed by this plan.

## Contents

1. [The rule that shapes everything: this repo is public](#1-the-rule-that-shapes-everything-this-repo-is-public)
2. [What we reuse (Assistant Brain and this repo)](#2-what-we-reuse-assistant-brain-and-this-repo)
3. [Verified platform facts (checked 2026-09-30)](#3-verified-platform-facts-checked-2026-09-30)
4. [Architecture, repo layout and data model](#4-architecture-repo-layout-and-data-model)
5. [How each requirement is met](#5-how-each-requirement-is-met)
6. [Phases, with model and effort](#6-phases-with-model-and-effort)
7. [Environments, keys and network](#7-environments-keys-and-network)
8. [Costs and quotas](#8-costs-and-quotas)
9. [Risks](#9-risks)
10. [Decisions for the owner (with defaults)](#10-decisions-for-the-owner-with-defaults)
11. [What changed versus the v01.06r draft](#11-what-changed-versus-the-v0106r-draft)
12. [Kickoff for the next session](#12-kickoff-for-the-next-session)

How to read this: tables are the contract, prose is the reasoning. "Owner" means the person who owns this repo and the Google account; no personal detail appears here because the repo and its GitHub Pages site are public.

## 1. The rule that shapes everything: this repo is public

`LightAISolutions/Personal` is public and so is its GitHub Pages site. `PERSONAL-ASSISTANT-ROADMAP.md` §3.11 already sets the rule: generic code may live here; personal data, persona and prompt files, memory and secrets may not. The build therefore splits into three homes, and the split is enforced by a CI check (Phase 1), not just remembered.

| Lives in `Personal` (public) | Lives in the private repo (`LightAISolutions/TourGuide`, owner-created) | Lives in the owner's Google account |
|---|---|---|
| Helper framework: generic Apps Script core, Telegram client, queue, Drive-mailbox bridge, envelope and bundle tools, test harness, deploy workflow, build agents and prompts | Routine-mode `CLAUDE.md` (persona + safety rules), skills, travel profile, per-trip memory, place notes, quarantine, daily log, `SESSION-CONTEXT.md` for build sessions | Drive `TourGuide/`: state Sheet, mailbox, research dossiers, finished brochures (HTML + PDF) |
| Shared kits: Maps client with budget guard, research contract, brochure design system and renderer, preference-reader pattern | `vendor/helpers/` — a pinned copy of `Personal/helpers/` so routines run the tools without loading this repo (§4.3) | Script Properties of the `tourguide-core` Apps Script project: bot token, admin secret, routine fire tokens, optional Maps and Claude API keys |
| Tour Guide generic code: schemas, visit-time estimator, planner and solver, brochure templates, the Apps Script feature pack, fixture trips with invented data | Routine prompt texts the owner pastes into the claude.ai routine editor | Claude HQ environment: Maps key as an **API credential** (§7); GitHub Actions secrets on this repo for clasp deploys (secrets are never readable from the public repo) |

Two consequences: the brochure *template* is public but a filled brochure never touches this repo or GitHub Pages; and this plan names no trip, place, person or account. The CI boundary check fails any push that adds files under personal-data paths (`profile*`, `people/`, `projects/`, `trips/`, `log/`, `quarantine/`) or matches secret and PII patterns (tokens, keys, e-mail addresses, phone numbers), with a planted-fake test proving it works.

## 2. What we reuse (Assistant Brain and this repo)

Read on 2026-09-30 from `AssistantBrain`: `BUILD-STATE.md`, `PROJECT-BRIEF.md`, `docs/SPEC.md`, `docs/SECURITY.md`, `docs/DEPLOY.md`, `docs/DEV-SESSION.md`, `decisions/PHASE-1..4.md`, `.claude/agents/*.md`, `.github/workflows/*.yml`, `tools/envelope.mjs`, `skills/README.md`, `skills/deep-task/SKILL.md`, the ROUTINE MODE section of `CLAUDE.md`. No personal line from `profile.md` is carried over.

| Pattern (source in `AssistantBrain` unless noted) | How the Tour Guide uses it |
|---|---|
| **Two lanes / Rule of Two** — routines only read accounts; Apps Script executes only allowlisted actions after an owner ✅ (`docs/SECURITY.md`, `docs/SPEC.md` §7) | Same. The Tour Guide's action allowlist is tiny: create a Drive file (brochure, dossier), move a place between lists, save a note. Nothing sends mail or touches Calendar |
| **Drive mailbox + envelope v1** (`docs/SPEC.md` §2) and **`tools/envelope.mjs`** (uuid, timestamp and file name stamped by the tool; Phase 4 fix for invented ids) | Copied verbatim into `helpers/tools/envelope.mjs`; per-helper root (`TourGuide/mailbox/{to-brain,from-brain,archive}`); requests to the brain are `req_<id>.json` envelopes, never raw text (§5.8) |
| **Telegram web app** in Apps Script: fast `OK` reply then enqueue, `?k=` secret, `from.id` allowlist, dedupe, LockService, pairing, callback buttons, 👍/👎 (`docs/SPEC.md` §5–§6) | Same core, new bot so approvals and chats never mix with the Chief of Staff |
| **Registries and extension points** (`gas/core/02_registry.js`, `docs/SPEC.md` §10) | Becomes the framework's plug-in contract: a helper pack registers commands, envelope types, queue handlers and gates without editing core |
| **Gate-fired routines** via the `/fire` API with a bearer token in Script Properties, `MAX_ROUTINE_FIRES_PER_DAY`, `CRON_TZ=` schedules (`decisions/PHASE-3.md`) | Same mechanism for research, planning and deep chat (§5.8) |
| **Trigger budget accounting** (`docs/SPEC.md` §8: AB's 5-minute tick uses roughly 12–24 of the account's 90 trigger-minutes per day) | The Tour Guide adds **no permanent tick**; it uses a wake route plus one-off `after()` triggers (§5.8) and Phase 5 records the measured cost next to AB's |
| **Untrusted text stays data**, `injection_suspect`, `quarantine/` (`CLAUDE.md` ROUTINE MODE) | Identical rules in the private repo's `CLAUDE.md`; web pages and mail bodies never become memory without owner promotion |
| **Memory-merge workflow** (`.github/workflows/merge-routine-memory.yml`, `.gitattributes` `merge=union` for daily logs) | Shipped in `helpers/templates/private-repo/` so the private repo has it from day one |
| **Dual-mode `CLAUDE.md`** ("Which mode are you in?" → ROUTINE MODE vs development, `docs/DEV-SESSION.md`) | Same shape in the private repo; plus a three-line routine-mode guard at the top of *this* repo's `CLAUDE.md` as defense in depth (§4.3) |
| **Build process**: `.claude/agents/ab-architect.md` (Fable 5.1 · xhigh), builders (Opus 5.5 · high/medium) with `disallowedTools` for readers, `prompts/PHASE-N.md`, `decisions/` + `status/` per work package, worktrees per WP | Adopted as generic `.claude/agents/hb-*.md`, `helpers/prompts/TG-PHASE-<n>.md`, `helpers/decisions/`, `helpers/status/`, `helpers/BUILD-STATE.md` (§6) |
| **Deploy workflow** (`.github/workflows/deploy-assistant-core.yml`: test gate, `environment: production` locked to `main`, `umask 077`, credential cleanup; `docs/DEPLOY.md` step list) | Merged with this repo's clasp pilot into `deploy-helper.yml` (next table) |
| **Setup-page lessons**: `getUrl()` returns `/dev` so store `WEBAPP_URL`; `<base target="_top">`; click-to-reveal secrets; read `tz` from state, never hardcode | Baked into the framework's setup page and skill template |
| **`skills/deep-task`** (long single-request work with a written result) | Model for the `chat` routine's contract: one request envelope in, one answer envelope out |

| Already in this repo | Reused or not |
|---|---|
| `.github/workflows/clasp-deploy-pilot.yml` + `repository-information/CLASP-PUSH-PILOT-SETUP.md` (`npx @google/clasp@2 push --force` then `deploy`, secrets `CLASPRC_JSON`, script and deployment ids) | **Reused** as the base of `deploy-helper.yml`, generalized to one job per helper (matrix over `helpers/packs/*/helper.json`) and given AB's test gate and hygiene |
| `.github/workflows/auto-merge-claude.yml` (`claude/**` → `main`) | **Unchanged.** `helpers/` lands through normal `claude/*` branches; `deploy-helper.yml` runs after the merge on `main` only |
| `scripts/setup-gas-project.sh`, `googleAppsScripts/Testauthhtml1` auth template, `Globalacl` / `MasterACL` | **Not reused.** They exist for embedded GitHub Pages pages with a sign-in wall; the Tour Guide has no web page (a public page could leak trip data). Its access control is Telegram pairing plus the admin secret on the Apps Script setup page |
| `.claude/skills/remember-session` + `repository-information/SESSION-CONTEXT.md` | **Reused** for build sessions here and copied into the private-repo template (§6, "Session context") |
| `.claude/skills/imported--frontend-design` | **Reused** in Phase 2c (brochure design) |

Not reused from AB: email triage, ledger, money and tax modules. **AB is not migrated** onto the framework in this build (§10, decision 9).

## 3. Verified platform facts (checked 2026-09-30)

Every row was read on the official page this session (date checked: 2026-09-30). Rows marked **Inference** were not confirmed by a source and name the phase that verifies them before anything depends on them.

| # | Fact | Source | Design consequence |
|---|---|---|---|
| 1 | **No Google API returns visit duration or popular times.** Place Details (New) fields cover address, location, hours, rating, review count, website, reviews, editorial summary, review summary, nothing on time spent. Google's own "visit duration" is derived from aggregated Location History and is shown only in Maps and Business Profile, with no API | [Place data fields](https://developers.google.com/maps/documentation/places/web-service/data-fields) · [Business Profile help: popular times, wait times, visit duration](https://support.google.com/business/answer/6263531) | Visit duration is a *research* result with sources and a range (§5.3). A third-party scraper API (e.g. SearchApi's `typical_time_spent`) is an optional, off-by-default source, never a dependency |
| 2 | Place Details tiers: `id`, `location`, `formattedAddress`, `businessStatus` = **Essentials**; `displayName`, `primaryType`, photos = **Pro**; `regularOpeningHours`, `currentOpeningHours`, `nationalPhoneNumber`, `priceLevel`, `rating`, `userRatingCount`, `websiteUri` = **Enterprise**; `reviews`, `editorialSummary`, `reviewSummary` = **Enterprise + Atmosphere**. A request is billed at the highest SKU its field mask touches | [Place Details (New)](https://developers.google.com/maps/documentation/places/web-service/place-details) · [Places usage and billing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing) | Every itinerary stop needs one Enterprise call (hours, rating, website); reviews are requested only by `place-notes` for shortlisted places. Field masks are fixed constants in the Maps kit, never free-form |
| 3 | Pricing (page updated 2026-09-24): monthly free calls per SKU **Essentials 10,000 · Pro 5,000 · Enterprise 1,000**; then per 1,000 at the lowest band: Place Details $5 / $17 / **$20** (Enterprise + Atmosphere **$25**); Text Search Pro $32, Enterprise $35; Compute Routes Essentials $5, Pro $10; Route Matrix $5 / $10 / $15; Geocoding $5 | [Maps Platform pricing](https://developers.google.com/maps/billing-and-pricing/pricing) | A normal trip fits inside the free caps (§8). The kit's budget guard counts by SKU, not by request |
| 4 | Routes `computeRoutes` with `optimizeWaypointOrder: true` reorders intermediates; billed as **Compute Routes Pro**; up to **25 intermediate waypoints** (11–25 is itself Pro); incompatible with `via` waypoints and `TRAFFIC_AWARE_OPTIMAL` | [Optimize waypoint order](https://developers.google.com/maps/documentation/routes/opt-way) · [Routes usage and billing](https://developers.google.com/maps/documentation/routes/usage-and-billing) | Used for driving and walking days as a cross-check of our own solver |
| 5 | `TRANSIT` routes accept **no intermediate waypoints**; they take `departureTime` or `arrivalTime` and `transitPreferences` (modes, routing preference) | [Transit routes](https://developers.google.com/maps/documentation/routes/transit-route) | Transit days are ordered by our solver, then legs are fetched pair by pair with the planned departure time (§5.4) |
| 6 | **Route Matrix supports `TRANSIT`.** Element limit 625 per request, **100 when the travel mode is TRANSIT** or the routing preference is `TRAFFIC_AWARE_OPTIMAL`; at most 50 origins + destinations when given as place IDs or addresses. Pro = traffic-aware or location modifiers | [Compute a route matrix](https://developers.google.com/maps/documentation/routes/compute_route_matrix) | The draft's open question is closed: one 10×10 transit matrix per day-cluster (100 elements) is enough; larger clusters are split |
| 7 | Caching: the General Service Terms' "Google ID caching" clause lets place IDs from Places, Directions, Geolocation and Routes be cached; the Places policies page states place IDs are exempt from caching restrictions and require attribution when content is shown. **Inference (Phase 2a):** the per-API "may temporarily cache latitude/longitude for up to 30 consecutive calendar days" clause applies to Places and Routes results; the exact sentence was not captured this session | [Maps Platform Terms](https://cloud.google.com/maps-platform/terms) · [Places API policies](https://developers.google.com/maps/documentation/places/web-service/policies) | Store `place_id` and our own notes permanently; keep Google fields only in a per-build snapshot that is refetched when a plan or brochure is built; purge snapshots after 30 days; attribution block on every brochure page |
| 8 | Apps Script quotas (page updated 2026-09-03): **triggers total runtime 90 min/day per account**, script runtime 6 min per execution, UrlFetch 20,000 calls/day, built-in Maps service 1,000 direction queries and 1,000 geocodes per day (no API key), 100 e-mail recipients/day, 30 simultaneous executions, 20 triggers per user per script. **Inference (Phase 5):** UrlFetch waits at most about 60 s for a response | [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas) | `/route` from Telegram uses the free Maps service; the Tour Guide must not add an always-on trigger (§5.8); the optional fast chat lane must answer inside the UrlFetch window (§5.8) |
| 9 | Claude Code **Routines** (research preview; Pro, Max, Team, Enterprise): minimum schedule interval 1 hour; **no daily run cap in the docs**; hourly limits 100 scheduled runs per account, 30 Run-now + API fires per routine, 100 API fires per account; runs draw on subscription usage; a **model selector per routine, no effort control**; connectors write without prompts; `/fire` needs the beta header `experimental-cc-routine-2026-04-01`; fire `text` arrives wrapped as untrusted `<routine-fire-payload>` while the saved prompt is trusted; an existing private Artifact may be republished without asking only if it is a single page with no supporting files, not publicly shared, viewers do not auto-see new versions and no connector grants are needed, otherwise a new publish asks | [Routines](https://code.claude.com/docs/en/routines) | Chat can fire a routine, but each fire is a full session (slow, subscription usage), so quick answers stay in Apps Script (§5.8). Fire `text` carries only a request id; the request itself is an envelope. The brochure Artifact must be one self-contained HTML page; the owner publishes it once in Phase 7 |
| 10 | Cloud environments: on Pro and Max an environment stores **API credentials** the proxy attaches to requests whose host matches the credential's host list (default a `Bearer` header; other header types offered); those hosts bypass the network allowlist; the value is never visible to the session; credentials are added on an existing environment only. Plain environment variables are visible to anyone using the environment. The **Trusted** default allowlist already includes `*.googleapis.com`. The docs' pre-installed tool list (Node 20/21/22, Python, chromedriver and more) does not mention Playwright browsers, but **this session's image has Chromium pre-installed** at `/opt/pw-browsers` with `PLAYWRIGHT_BROWSERS_PATH` set and `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` (observed 2026-09-30) | [Cloud environments](https://code.claude.com/docs/en/cloud-environments) | Maps key as an API credential with hosts `places.googleapis.com` and `routes.googleapis.com` (§7). **Inference (Phase 0):** the header type can be set to `X-Goog-Api-Key`; if not, fall back to an environment variable (owner-only account) and rotate the key. Brochure PDFs use that Chromium (launch with `executablePath: '/opt/pw-browsers/chromium'` if the pinned Playwright version differs). **Inference (Phase 2c):** routine runs get the same image; if not, the setup script adds `npx playwright install chromium` |
| 11 | `CLAUDE.md` loading: files from the launch directory and its ancestors load at start, subdirectory `CLAUDE.md` files load on demand, and directories added with `--add-dir` are not loaded by default. **Inference (Phase 1):** a routine with two attached repos loads only the primary repo's `CLAUDE.md` | [Manage Claude's memory](https://code.claude.com/docs/en/memory) | Routines attach only the private repo; tools are vendored into it (§4.3); a routine-mode guard in this repo's `CLAUDE.md` covers the case where it is loaded anyway |
| 12 | Google's **Grounding Lite MCP** (`https://mapstools.googleapis.com/mcp`: search places, weather, compute routes for driving and walking; API key via `X-Goog-Api-Key` or OAuth; pay-as-you-go; 300 QPM) and **Code Assist MCP** (`https://mapscodeassist.googleapis.com/mcp`, documentation grounding) are official. **Inference (Phase 2a spike, optional):** a claude.ai custom connector can carry the key so a routine calls Grounding Lite without our client | [Grounding Lite MCP](https://developers.google.com/maps/ai/grounding-lite/mcp) · [Code Assist MCP](https://developers.google.com/maps/ai/code-assist) | Not on the critical path: it has no opening hours or transit, so the Places/Routes client is built regardless. Code Assist MCP is worth attaching to Phase 2a builder sessions |
| 13 | Claude API list prices per million tokens (input / output): Fable 5.1 $10 / $50, Opus 5.5 $4 / $20, Sonnet 5.5 $2 / $10, Haiku 4.5 $1 / $5; Batch API 50% off; web search $10 per 1,000 searches | [Claude pricing](https://docs.claude.com/en/docs/about-claude/pricing) | Sizes the optional fast chat lane (§5.8, §8) |
| 14 | The GitHub connector in this project exposes `create_repository`, so the draft's "the integration cannot create repos" was untested. Default stays: the owner creates the private repo by hand (visibility must be verified as private before anything is pushed) | Tool list of this session | §10 decision 1 |

## 4. Architecture, repo layout and data model

```
Owner's phone ──Telegram (Tour Guide bot)──► tourguide-core   Apps Script web app, bundled from Personal/helpers/core + packs/tour-guide/gas
                                              router · Telegram · queue · executor (✅ only) · mailbox relay · setup page
                                              Lane A  instant: /trip /today /day 3 /later /place /route (built-in Maps service), buttons
                                              Lane B  optional fast free-text answers via the Claude API (Script Properties key)
                                              Lane C  deep asks → write req envelope → /fire the routine → "working on it"
                                                    │   Drive TourGuide/mailbox/{to-brain, from-brain, archive}
                                                    ▼
                      Claude Code Routines (environment: Claude HQ · Full network · Maps key as API credential)
                      repo attached: TourGuide (private) with vendor/helpers/ = pinned copy of Personal/helpers/
                      connectors: Gmail · Calendar · Drive (read; Drive create-file for brochures and dossiers)
                      routines: prefs-build · trip-research · place-notes · plan-days · brochure-build · chat · (weekly trip-check)
                         │  node vendor/helpers/kits/maps      → Places API (New) + Routes API
                         │  node vendor/helpers/packs/tour-guide/planner → day plans (solver, hours, meals, free time)
                         │  node vendor/helpers/kits/brochure  → HTML brochure; Playwright Chromium → PDF
                         ▼
                      Drive TourGuide/  state Sheet · dossiers · brochures   →  GET WEBAPP_URL?route=wake  (core delivers replies)
                      optional: one private Artifact per trip (single self-contained page) refreshed by brochure-build
```

### 4.1 Layout in `Personal` (new top-level `helpers/`, plus build agents)

```
helpers/
  README.md                  framework overview, "how to add a helper", public/private rules
  SPEC.md                    framework contract: envelope v1, mailbox, registries, pack manifest, setup page, wake route
  BUILD-STATE.md             phase tracker for this build (generic progress only)
  prompts/TG-PHASE-<n>.md    the prompt each phase's session starts from (written by the previous phase)
  decisions/ · status/       one file per phase / work package, AB style
  core/                      generic Apps Script core from AB's gas/core (per-helper root folder, bot, property prefix, registries)
  tools/                     bundle.mjs (reads a pack's helper.json), envelope.mjs (verbatim from AB), new-helper scaffold, boundary-check.mjs
  kits/
    maps/                    Places (New) + Routes client, fixed field masks, SKU counter + hard stop, 30-day snapshot purge, Maps URL builder
    research/                research-run contract: budgets, source ledger, two-source rule, confidence labels, injection tests
    brochure/                design tokens, type scale, print CSS, HTML renderer, PDF step, attribution block
    prefs/                   connector-reader pattern: evidence → quarantine → owner-confirmed profile
  packs/tour-guide/          helper.json, schemas/, estimator/, planner/ (solver), brochure-templates/, gas/ (feature pack), fixtures/
  templates/private-repo/    skeleton for a helper's private repo (dual-mode CLAUDE.md, skills/, memory dirs, merge workflow, SESSION-CONTEXT.md, vendor/)
  tests/                     node --test suites + Apps Script mocks (from AB's harness)
.claude/agents/hb-architect.md · hb-builder-fable.md · hb-builder-opus.md · hb-reader.md   (model, effort, disallowedTools per role)
.github/workflows/helpers-ci.yml      tests + boundary check on every push touching helpers/
.github/workflows/deploy-helper.yml   bundle + clasp push/deploy per helper on main (from the clasp pilot + AB's deploy workflow)
.github/workflows/helpers-dist.yml    publishes helpers/ as the `helpers-dist` branch after each merge to main (what private repos vendor)
```

A future helper (the knowledge wiki) adds `packs/wiki/` and a private repo from `templates/private-repo/`, reusing core, tools, research and prefs unchanged.

### 4.2 Layout in the private repo (`TourGuide`, from the template)

```
CLAUDE.md               "Which mode are you in?" → ROUTINE MODE (persona, two-lane rules, mailbox protocol, memory conventions) / development
skills/<name>/SKILL.md  prefs-build · trip-research · place-notes · plan-days · brochure-build · chat · trip-check
profile/travel-profile.md   owner-confirmed preferences (≤ 2k tokens)   trips/<slug>.md   places/<slug>.md   quarantine/   log/
vendor/helpers/         pinned copy of Personal/helpers (§4.3)          repository-information/SESSION-CONTEXT.md + BUILD-STATE.md
.github/workflows/merge-routine-memory.yml   .gitattributes (log merge=union)   routines/*.prompt.md (texts to paste into the routine editor)
```

### 4.3 How routines get the tools without loading this repo's `CLAUDE.md`

This repo's development `CLAUDE.md` (session-start checklist, bookends, pre-commit rules) would be harmful inside a routine. Two measures, both cheap:

1. **Routines attach only the private repo.** `helpers-dist.yml` publishes `helpers/` as a `helpers-dist` branch of this repo (public, so no credentials needed), and the private repo vendors it at `vendor/helpers/` with `git subtree` pinned to a commit. A `/update-helpers` step in each Phase 4+ session (and later a skill) bumps the pin with a reviewable diff. Phase 1 measures the alternative, a shallow clone of `helpers-dist` at run start, and picks one; the default is the subtree because it works offline, is deterministic and shows up in `git diff`.
2. **Routine-mode guard in this repo's `CLAUDE.md`** (Phase 1, three lines at the very top): if the session was started by a routine, ignore the rest of the file and follow the attached helper repo's `CLAUDE.md`. Defense in depth for the case where a routine attaches both repos anyway (fact 11 is partly an inference).

### 4.4 Data model (state Sheet in Drive; JSON schemas in `packs/tour-guide/schemas/`)

| Entity | Key fields |
|---|---|
| `Trip` | id, title, destination(s), destination time zone, start/end dates, travelers, pace (relaxed · normal · packed), day start/end, lodging per night (place_id), allowed transport modes, budget notes, status |
| `Place` | place_id (kept forever), our category and tags, why it fits the profile, source trip, **status**: candidate · scheduled · saved-for-later · rejected, note path |
| `VisitEstimate` | place_id, activity ("museum highlights", "full hike"), typical min/max minutes, chosen minutes, sources (URLs, date), confidence, owner calibration (longer / shorter / about right) |
| `PlaceNote` | place_id, personalized note (why you, what to do, what to skip, best time, tickets, accessibility, pairings), last researched |
| `DayPlan` | trip id, date, build id, ordered stops (arrive/depart), legs (mode, minutes, Maps link, planned departure), meals, free-time blocks, warnings (closed day, tight connection), `verified_on` |
| `LaterList` | named lists ("next time", "rainy-day options"), place ids, reason not scheduled |
| `GoogleSnapshot` | build id, place_id, hours, rating, review count, website, address, `businessStatus`, fetched_at — purged after 30 days (fact 7) |

Google-sourced fields live only in `GoogleSnapshot`; plans and brochures always read the freshest snapshot for their build.

## 5. How each requirement is met

**5.1 Preferences from approved connectors.** Skill `prefs-build` reads only the connectors the owner enabled for that routine: Gmail (hotel, flight, restaurant, ticket and tour confirmations), Calendar (past trips, events), Drive (trip documents). Optional inputs: a Google Takeout export of Maps saved lists and reviews dropped into Drive (no connector exposes them), and, with the owner's OK, the travel-relevant lines of Assistant Brain's profile as a one-time seed. Output: evidence-backed candidate preferences in `quarantine/` → owner confirms in Telegram (✅ ✏️ ❌) → `profile/travel-profile.md` (pace, interests, food, budget band, mobility, crowds, early or late person, must-avoid). Untrusted-content rules apply to every source.

**5.2 Autonomous deep web research.** Routines run without permission prompts, so research needs no approvals once the routine exists. Skill `trip-research` follows the research kit's contract: per-run budgets (searches, fetches, wall time), a source ledger (URL, date, what it supported), two independent sources for any fact the plan depends on, confidence labels, and injection handling (page text is data). It scores candidate places against the travel profile and writes a dossier to Drive plus `trips/<slug>.md`.

**5.3 Average visit duration.** No API provides it (fact 1), so the estimator triangulates: Google's "people typically spend" line when it appears in a search result snippet, the attraction's own guidance ("allow two hours"), tour and review sites' suggested durations, and travel guides → a min/max range, a chosen value adjusted by pace and interest, and the sources. After each trip a one-tap "longer / shorter / about right" per stop calibrates future estimates for that category.

**5.4 Route optimization with Google Maps.** The planner (node, tested on fixtures) (a) drops stops closed on the date or outside their hours, (b) clusters the trip's places into days by geography, lodging and constraints, (c) orders each day with a time-window-aware solver over a Route Matrix in the day's mode, including transit (fact 6: 100 elements per transit matrix, so clusters are capped at 10 stops or split), (d) fetches the real legs pair by pair with the planned departure time (fact 5), (e) inserts meals and free-time blocks by pace, and (f) emits a Google Maps directions link per leg and one per day (Maps URLs need no key). Driving and walking days also ask `optimizeWaypointOrder` (fact 4) and the plan explains any disagreement with the solver.

**5.5 Saved-for-later lists.** Every researched place keeps a status. Anything researched but not scheduled lands in a named Later list with the reason ("closed that day", "too far from day 2", "rainy-day backup"). `/later` lists, moves and promotes places back into a trip; promotions trigger a re-plan of the affected day only.

**5.6 Personalized notes per location.** Skill `place-notes` writes `places/<slug>.md` from the profile plus research: why it is on the list, what to do, see or eat, what to skip, best time of day, tickets and reservations, accessibility, nearby pairings. Notes are embedded in the brochure and shown by `/place`.

**5.7 Daily action plans and the brochure.** `plan-days` assembles each day: address, hours, closed days, Google rating and review count, website, activity and time budget, transit mode and minutes with the Maps link, free time, warnings, and a "verified on" date. `brochure-build` renders it with the brochure kit into one self-contained HTML document (inlined CSS and images, so it can also be a private Artifact, fact 9) and a print PDF: cover, trip at a glance, day spreads with a timeline rail and route sketch, place cards, "saved for later" appendix, practical info, attribution. Design quality gets its own work package with screenshot review (Phase 2c) and a second pass after the pilot (Phase 8).

**5.8 A chatbot like the Chief of Staff — three lanes.**
- **Lane A, instant (Apps Script, free):** structured asks are answered from the Sheet in under a second: `/trip`, `/today`, `/day 3`, `/later`, `/place <name>`, `/route A → B` (built-in Maps service, fact 8), "save this place", "move X to tomorrow" (a ✅ proposal when it changes a plan).
- **Lane B, fast free-text (optional, Claude API from Apps Script):** open questions that only need the current trip state ("what's near stop 3 with vegetarian food?", "how much free time on Thursday?") are answered by Sonnet 5.5 (Haiku 4.5 for trivial lookups) with the trip's plan JSON and notes as context, no tools, no web, inside the UrlFetch window (fact 8 inference). Key in Script Properties, off by default behind `CHAT_API_ENABLED` (decision 6). Paid per token outside the subscription (§8).
- **Lane C, deep (routine):** research, re-planning and anything needing the web or connectors ("find a quieter lunch near stop 3", "rework day 2 for rain") is written as a `req_<id>.json` envelope to `to-brain/`, then core fires the `chat` routine with only the request id as `text` (fact 9: fire text is untrusted, the envelope is the owner's words) and replies "working on it, ~N minutes". The routine answers with an envelope in `from-brain/` and then calls `WEBAPP_URL?route=wake`, an unauthenticated, idempotent, rate-limited route that only sweeps the mailbox and delivers replies (nothing a stranger could misuse). Fallback if the wake never arrives: one-off `after()` triggers at +3 and +10 minutes created at fire time, plus an hourly sweep while any request is open. **No permanent tick**, so the Tour Guide's share of the 90 trigger-minutes per day stays near zero (fact 8); Phase 5 measures it.

Why not route every message through a routine (the draft's implicit default): a routine run is a full session, takes minutes and draws on subscription usage, so it would make the bot feel broken for simple asks and burn usage on lookups. Lanes A and B give the Chief-of-Staff feel; Lane C gives the depth.

## 6. Phases, with model and effort

Same shape as the Assistant Brain build: the architect lays the foundation, builders fan out in parallel worktrees (`git worktree add ../wt-<wp> -b wp-<wp>`), an integration pass red-teams it, then the owner switches it on with a real trip. Each phase runs in a **new session** started from `helpers/prompts/TG-PHASE-<n>.md`, written by the previous phase; `helpers/BUILD-STATE.md` records status; every phase ends with a `decisions/` entry and a `remember-session` run. Model choices: **Fable 5.1 · xhigh** where a wrong contract is expensive to undo (foundation, integration), Fable 5.1 · high where judgment matters but the contract exists (design, solver, setup), Opus 5.5 · high for well-specified building, Opus 5.5 · medium for narrow packages.

| Phase | What gets built | Model · effort (why) | Owner actions | Env / keys / network | Done when |
|---|---|---|---|---|---|
| **0 — Setup + decisions** (~45 min, interactive) | No product code. Confirm §10; create the private repo from the plan's §4.2 skeleton; write `helpers/BUILD-STATE.md`, `helpers/decisions/TG-PHASE-0.md`, `helpers/prompts/TG-PHASE-1.md` | **Fable 5.1 · high** — it fixes names, contracts and the phase prompts everything else inherits, but the design work was done here at xhigh, so high is enough | Create private `LightAISolutions/TourGuide` (or let the session do it via the GitHub connector, then verify it is private) and attach it to the Claude HQ project; Google Cloud project with **Places API (New)** and **Routes API** enabled, key restricted to those two, per-API daily caps and a budget alert; add the key to Claude HQ as an API credential; BotFather → new bot token (kept for Phase 7) | Claude HQ. Adds the Maps API credential (verifies fact 10's header-type inference) | Decisions recorded; both repos attached; `TG-PHASE-1.md` exists |
| **1 — Helper framework foundation** | `helpers/core` generalized from AB's `gas/core`; `tools/` (bundle, envelope, scaffold, boundary check); `templates/private-repo/`; setup page with AB's lessons; `helpers/SPEC.md` (incl. wake route, pack manifest); `.claude/agents/hb-*.md`; `helpers-ci.yml`, `helpers-dist.yml`, `deploy-helper.yml`; routine-mode guard in `CLAUDE.md`; subtree-vs-clone decision (§4.3) | **Fable 5.1 · xhigh** (architect) — every later package builds on these contracts | Approve the scrub report before AB's generic core is copied into this public repo (no ids, secrets or personal strings) | Claude HQ; no keys. Playwright not needed yet | Tests green; a "hello" pack bundles and runs in mocks; boundary check blocks a planted fake secret; `helpers-dist` branch publishes |
| **2 — Shared kits** (four parallel WPs, one coordinator) | **2a Maps kit** — Places/Routes client, field masks, SKU counter + hard stop, snapshot purge, Maps URLs; confirms fact 7's 30-day clause and the header type; optional Grounding Lite spike. **2b Research kit** — contract, ledger schema, budgets, injection tests. **2c Brochure kit** — design system, print CSS, renderer, Playwright PDF, attribution; screenshot review with the `frontend-design` skill. **2d Prefs kit** — evidence → quarantine → confirm flow | Coordinator **Opus 5.5 · high**; 2a **Opus 5.5 · high**; 2b **Opus 5.5 · medium**; 2c **Fable 5.1 · high** (design taste is the deliverable); 2d **Opus 5.5 · medium** | Nothing beyond Phase 0's key. Optionally name three test places for the smoke calls | 2a: live smoke calls to `places.googleapis.com` / `routes.googleapis.com` through the API credential (inside free caps). 2c: confirms the pre-installed Chromium inside a routine run (setup-script install only if it is missing) | Each kit's tests green; one live Places + Routes call from Claude HQ; a sample brochure PDF from fixture data that the owner rates "would hand to a friend" |
| **3 — Tour Guide engine** (`packs/tour-guide`) | Schemas; estimator + calibration; **planner and solver** (hours and closed-day filter, day clustering, time-window ordering over a matrix, meals, free time, warnings, `optimizeWaypointOrder` cross-check); Later lists; plan → brochure mapping; two fixture trips with invented data (a transit city, a driving loop) | Solver **Fable 5.1 · high**; rest **Opus 5.5 · high** | — | Claude HQ; fixtures and recorded API responses only | Feasible plans for both fixtures (no stop outside hours, no closed-day visit, legs match the matrix); property tests green |
| **4 — Brain side** (private repo) | Routine-mode `CLAUDE.md`; skills `prefs-build`, `trip-research`, `place-notes`, `plan-days`, `brochure-build`, `chat`, `trip-check`; memory dirs, merge workflow, `SESSION-CONTEXT.md`; `routines/*.prompt.md`; vendored helpers pinned | `trip-research` and `plan-days` skills **Fable 5.1 · high** (prompt quality decides research depth); the rest **Opus 5.5 · high** | — | Claude HQ with the private repo attached; dry runs against fixtures | Each skill dry-runs end to end in a build session; envelopes validate with `envelope.mjs`; no personal data in the public repo (boundary check) |
| **5 — Chatbot** (`packs/tour-guide/gas`) | Feature pack: commands, inline buttons, ✅ proposals, request envelopes + `/fire`, wake route, `after()` fallbacks, `/route` via the Maps service, Lane B behind `CHAT_API_ENABLED` | **Opus 5.5 · high** | Decide whether Lane B is switched on at all (decision 6) | Claude HQ; mocks. Lane B needs a Claude API key in Script Properties only if enabled | Mock e2e: message → envelope → fire → reply → wake; measured trigger minutes per request documented against AB's 12–24 |
| **6 — Integration, red-team, switch-on guide** | End-to-end across packs; prompt-injection red-team on research, notes and chat; cost and quota audit; `helpers/docs/TG-SWITCH-ON.md` (Apps Script deploy via `deploy-helper.yml`, properties, pairing, routine creation, first run) | **Fable 5.1 · xhigh** (architect) | — | Claude HQ | All suites green; findings fixed or listed; guide complete |
| **7 — Owner switch-on** (~60–90 min, interactive) | Deploy `tourguide-core`, set Script Properties, pair the bot, create routines in the claude.ai editor (`CRON_TZ=` the owner's zone, models per the table below), run `prefs-build` and confirm the profile, publish the brochure Artifact once, **pilot a real upcoming trip** | **Opus 5.5 · high** — procedural, guide-driven | At the keyboard: clasp login + GitHub secrets (from `CLASP-PUSH-PILOT-SETUP.md`), Apps Script authorization, routine creation, profile confirmation, pick the pilot trip | Claude HQ; GitHub Actions secrets on this repo; Apps Script project | Pilot trip has a brochure in Drive and a working bot; everything in the guide verified live |
| **8 — Live review + tuning** | Review planning quality, brochure polish, estimate accuracy, costs, trigger minutes; fix what hurt; decide on Lane B, a separate routines environment and AB migration with real data | **Opus 5.5 · high**; brochure design pass **Fable 5.1 · high** if needed | Feedback after the trip (actual visit times via the calibration taps) | Claude HQ | Tuning items closed in `helpers/decisions/TG-PHASE-8.md` |

**Routine runtime models** (set per routine in the claude.ai editor in Phase 7; routines have a model selector but no effort control, fact 9): default **Opus 5.5** for every routine. `trip-research` may be switched to **Fable 5.1** for a trip that matters (deeper source work per run); `chat` may drop to **Sonnet 5.5** if Phase 8 shows latency matters more than depth. Revisit with Phase 8 cost data.

**Finish priority if usage runs short:** 1 → 2a → 3 → 4 (`plan-days`, `trip-research`) → 2c + `brochure-build` → 5 → 2d + `prefs-build` → 6. A usable text plan in Drive exists after Phase 4 even if the chatbot and brochure slip.

**Session context across repos.** Build sessions in this repo keep using `remember-session` → `repository-information/SESSION-CONTEXT.md` (2-session cap) plus `helpers/BUILD-STATE.md` for phase status. The private repo template ships its own `repository-information/SESSION-CONTEXT.md` and a trimmed copy of the `remember-session` skill (no version bookkeeping), so Phase 4 sessions there save context the same way. Routines never write session context; they use the AB memory conventions (`log/YYYY-MM-DD.md`, `trips/`, `places/`, `quarantine/`) merged by the memory workflow. Every phase prompt starts with "read `helpers/BUILD-STATE.md`, the previous phase's `decisions/` file and `SESSION-CONTEXT.md`".

## 7. Environments, keys and network

| Environment | Used for | Needs |
|---|---|---|
| **Claude HQ** (`Claude HQ - full network access`, this project's environment) | Build phases 0–8 and, by default, the Tour Guide routines (research needs the open web, so Full is required; Maps hosts would work even at Trusted, fact 10) | **Phase 0:** `GOOGLE_MAPS_API_KEY` as an **API credential** for hosts `places.googleapis.com` and `routes.googleapis.com`, header `X-Goog-Api-Key` if the dialog allows it (else the documented fallback). **Phase 2c:** Chromium is already in the image (`/opt/pw-browsers`, fact 10); a setup script is needed only if a routine run turns out not to have it. The owner's account-wide block on connector write tools set during the AB switch-on stays; Drive create-file remains allowed for brochures and dossiers |
| **AB build / AB routines** | Untouched | — |
| **Optional "TG routines" environment** (decision 10) | Only if the owner wants routine runs isolated from build sessions (anything using Claude HQ can call its credentials) | Same key as an API credential; Full network (research); the private repo attached |
| **Apps Script project `tourguide-core`** (owner's Google account, separate from Assistant Core) | The web app behind the bot | Script Properties: `BOT_TOKEN`, `ADMIN_SECRET`, `WEBAPP_URL`, `ROUTINE_FIRE_URL_*` + bearer tokens, `MAX_ROUTINE_FIRES_PER_DAY`, optional `MAPS_API_KEY` (server-side lookups), optional `CLAUDE_API_KEY` + `CHAT_API_ENABLED`. Deployed by `deploy-helper.yml` using GitHub Actions secrets `CLASPRC_JSON`, `TOURGUIDE_SCRIPT_ID`, `TOURGUIDE_DEPLOYMENT_ID` in a `production` environment locked to `main` (AB's `docs/DEPLOY.md` steps, adapted). This repo is public, so the workflow runs only on `push` to `main`, never on pull requests |

Phases that touch live Google APIs: **2a** (smoke tests), **7**, **8**. Everything else runs on fixtures, recorded responses and mocks. Nothing in this plan needs a new Google Cloud project beyond the one Maps project, and no phase needs changes to the AB environments.

## 8. Costs and quotas

- **Google Maps Platform** (prices from fact 3): a trip with ~150 candidate places, ~40 scheduled stops and ~60 legs is about 150 Enterprise Place Details (+ ≤30 Atmosphere for notes), ~5 Text Searches, ~6 transit or driving matrices and ~60 Compute Routes calls → inside the monthly free caps (Enterprise 1,000, Pro 5,000, Essentials 10,000). Even at list price that volume is under $10. Guards, in layers: key restricted to Places + Routes; **per-API daily caps** in the Cloud console; a **budget alert** at a small amount; the kit's SKU counter refuses calls past a configured monthly ceiling. *Estimate, not a quote; Phase 8 reports real usage.*
- **Apps Script:** no permanent tick. Per deep request: the webhook execution, one `/fire` call, and at most two `after()` triggers of a few seconds each if the wake route fails, so the Tour Guide's trigger minutes stay near zero next to AB's 12–24 of 90 per day. Built-in Maps service: 1,000 direction queries per day is far above chat use.
- **Claude usage:** research, planning and brochure routines run per trip, not daily; a weekly `trip-check` is the only schedule. Each Lane C chat message is one routine run (subscription usage). Lane B, if enabled: ~200 questions a month at ~8k input / 1k output tokens on Sonnet 5.5 ≈ $5 per month at list price (fact 13); Haiku 4.5 halves it.
- **GitHub Actions:** public repo minutes are free; the deploy job runs only when `helpers/` changes on `main`.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Personal travel data leaks into this public repo | Three-home split (§1); CI boundary check with planted-fake test; fixtures use invented data; brochures and notes only in Drive and the private repo |
| Web pages, invites or mail steer the research agent (prompt injection) | Untrusted-data rules, `injection_suspect`, quarantine for memory, no account writes from routines, request-by-envelope (never by fire text), Phase 6 red-team |
| Visit-time estimates are wrong | Ranges, sources and confidence; pace settings; post-trip calibration taps |
| Google data is stale (hours changed, place closed) | Fresh snapshot at plan and brochure build; `businessStatus` check; "verified on" date on every day page |
| Transit timing differs by departure time | Legs fetched for the planned departure; buffer minutes per leg by pace; 100-element transit matrix cap honored by cluster size |
| Maps costs spike (loop bug) | SKU counter hard stop + console caps + budget alert |
| Trigger quota contention with the Chief of Staff | No tick; wake route + bounded `after()` fallbacks; Phase 5 measurement |
| API credential cannot carry an `X-Goog-Api-Key` header (fact 10 inference) | Phase 0 checks the dialog; fallback is an environment variable on an owner-only environment plus key rotation |
| Chromium missing or version-mismatched in routine runs | Use the pre-installed `/opt/pw-browsers/chromium` via `executablePath`; Phase 2c checks inside a routine; fallbacks are a setup-script install or HTML-only delivery with the owner printing to PDF |
| Routines are a research preview and limits change | Facts re-checked at Phase 7; design keeps quick paths in Apps Script so the bot degrades gracefully |
| This repo's dev `CLAUDE.md` loads inside a routine | Routines attach only the private repo; routine-mode guard (§4.3) |
| Terms of service on caching and display of Places content | Place IDs only long-term; snapshots purged; attribution on every page; Phase 2a reads the exact clause |

## 10. Decisions for the owner (with defaults)

Phase 0 records the answers in `helpers/decisions/TG-PHASE-0.md`; the default is what the build assumes if nothing is said.

1. **Private repo.** Default: `LightAISolutions/TourGuide`, created by the owner (or by the Phase 0 session through the GitHub connector, then checked to be private), one private repo per helper from `helpers/templates/private-repo/`.
2. **Separate Telegram bot.** Default: yes, a dedicated Tour Guide bot with its own pairing.
3. **Seed preferences from Assistant Brain's profile.** Default: yes, travel-relevant lines only, once, confirmed line by line in Telegram.
4. **Google Maps Takeout import** of saved lists and reviews. Default: yes, once, in Phase 7 (richest signal; no connector reaches it).
5. **Brochure delivery.** Default: HTML + PDF in Drive, plus one private Artifact per trip published by the owner in Phase 7 and refreshed by `brochure-build`.
6. **Lane B fast chat via the Claude API** (paid per token, outside the subscription). Default: built in Phase 5 behind `CHAT_API_ENABLED=false`; switched on only if Phase 8 shows Lane C is too slow for everyday questions.
7. **How the private repo gets the tools.** Default: `git subtree` pin of the `helpers-dist` branch at `vendor/helpers/`; Phase 1 may switch to clone-at-run if measurements favor it.
8. **Grounding Lite MCP spike** in Phase 2a. Default: yes, time-boxed to one session; it never replaces the Places/Routes client.
9. **Migrate Assistant Brain onto the framework.** Default: not in this build; decide after the Tour Guide has run for a few weeks.
10. **Separate "TG routines" environment.** Default: no, routines run in Claude HQ; revisit in Phase 8.
11. **Routine models.** Default: Opus 5.5 everywhere; Fable 5.1 for `trip-research` on trips that matter.
12. **Third-party visit-duration scraper** (paid, scrapes Maps). Default: off; the research triangulation is the source.
13. **Pilot trip for Phase 7.** Owner's pick: the next real trip, or a sample city if none is planned. The trip is never named in this repo.

## 11. What changed versus the v01.06r draft

- **Model for the important phases.** Phase 0 moves from Opus 5.5 · Medium to Fable 5.1 · high; this plan itself was written at Fable 5.1 · xhigh; Phase 4's two core skills (`trip-research`, `plan-days`) get Fable 5.1 · high. Routine runtimes stay Opus 5.5 by default, with Fable 5.1 as a per-trip option (routines expose a model selector but no effort control, fact 9).
- **Facts corrected after re-checking the sources:** Enterprise Place Details is $20 per 1,000, not $25 ($25 is Enterprise + Atmosphere); Route Matrix `TRANSIT` support and its 100-element cap are now confirmed, not an open question; `optimizeWaypointOrder` caps at 25 intermediates; the 30-day coordinate-caching allowance is downgraded to an inference (the draft cited a 2023 snapshot of the terms) and place-ID caching is cited from the current terms; the draft's "Chromium is preinstalled" holds for this environment's image (observed, not documented), so it stays with a Phase 2c check inside a routine run; the claim that the GitHub integration cannot create repos was untested; the Artifact republish conditions are spelled out (single page, no supporting files, not public).
- **Chat design.** Three lanes (instant Apps Script, optional fast Claude API lane, deep routine) instead of "instant commands or fire a routine"; requests to the brain travel as envelopes with only an id in the fire text; replies come back through a wake route instead of polling while pending.
- **Routines attach only the private repo.** The draft attached both repos to every routine, which would drag this repo's development `CLAUDE.md` into routine runs. Tools are vendored (`helpers-dist` → `vendor/helpers/`) and a routine-mode guard is added here as a backstop.
- **Reuse is explicit.** `deploy-helper.yml` is derived from this repo's clasp pilot plus AB's deploy workflow rather than written from scratch; `auto-merge-claude.yml` is untouched; `setup-gas-project.sh` and the GlobalACL / MasterACL machinery are named as not reused, with the reason.
- **Build process imported from AB:** `.claude/agents/hb-*.md` (model, effort, `disallowedTools`), `helpers/prompts/TG-PHASE-<n>.md`, `decisions/` + `status/` per work package, worktrees, `helpers/BUILD-STATE.md`; plus a stated way for both repos to keep `SESSION-CONTEXT.md`-style context.
- **Data model** gains `GoogleSnapshot` (so the 30-day purge is a table, not a habit), a destination time zone on `Trip`, and build ids on `DayPlan`.
- **Environment detail** added: Maps hosts are reachable even at Trusted network level, the API-credential header type is a Phase 0 check, the brochure PDF step uses the pre-installed Chromium with a Phase 2c check, and the trigger-minute accounting is stated against AB's 12–24 of 90 per day.

## 12. Kickoff for the next session

Start a **new session in this project on Claude HQ** with **Fable 5.1 · effort high** and paste:

```
Read repository-information/TOUR-GUIDE-BUILD-PLAN.md and run Phase 0 with me: walk through the §10 decisions one at a time (defaults unless I object), create or verify the private TourGuide repo from §4.2, and write helpers/BUILD-STATE.md, helpers/decisions/TG-PHASE-0.md and helpers/prompts/TG-PHASE-1.md. Do not start Phase 1.
```

Have ready: a private repo (or permission for the session to create one), a Google Cloud project with Places API (New) and Routes API enabled and a restricted key, and a new bot token from BotFather. Phase 1 then starts from `helpers/prompts/TG-PHASE-1.md` on **Fable 5.1 · xhigh**.

Developed by: LightAISolutions
