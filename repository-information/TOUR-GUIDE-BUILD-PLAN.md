# Tour Guide — Phased Build Plan (and the shared helper framework)

> **Status:** plan only, nothing built yet · written 2026-09-30 · repo `v01.06r`
> **Scope:** a personal Tour Guide helper (preference-aware research, visit-time estimates, route-optimized day plans, a "saved for later" list, personalized place notes, brochure-quality output, and a Telegram chatbot) built on **reusable helper infrastructure** in this repo so later helpers (personal knowledge wiki first) can share it.
> **Reference, not modified:** `LightAISolutions/AssistantBrain` (the Chief of Staff). Its patterns are reused; its code and data are not changed by this plan.

## Contents

1. [The one rule that shapes everything: this repo is public](#1-the-one-rule-that-shapes-everything-this-repo-is-public)
2. [What we reuse from Assistant Brain](#2-what-we-reuse-from-assistant-brain)
3. [Verified platform facts (2026-09-30)](#3-verified-platform-facts-2026-09-30)
4. [Architecture](#4-architecture)
5. [How each requirement is met](#5-how-each-requirement-is-met)
6. [Phases, with model and effort](#6-phases-with-model-and-effort)
7. [Environments, keys and network](#7-environments-keys-and-network)
8. [Costs and quotas](#8-costs-and-quotas)
9. [Risks](#9-risks)
10. [Decisions for the owner](#10-decisions-for-the-owner)

## 1. The one rule that shapes everything: this repo is public

`LightAISolutions/Personal` is **public** (confirmed on GitHub 2026-09-30), and GitHub Pages here is public too. The roadmap already set the rule (`PERSONAL-ASSISTANT-ROADMAP.md` §3.11): generic code may live here; personal data, persona/prompt files, memory and secrets may not. So the build splits cleanly:

| Lives in `Personal` (public) | Lives somewhere private |
|---|---|
| Helper framework: Apps Script core, Telegram client, queue, Drive-mailbox bridge, envelope/bundle tools, test harness, deploy workflow | **New private repo `LightAISolutions/TourGuide`** (owner creates it; the GitHub integration cannot create repos): routine persona `CLAUDE.md`, skills, travel profile, trip memory, place notes |
| Shared kits: Maps (Places + Routes client, cache, budget guard), research, brochure renderer and design system, preference-reader pattern | **Owner's Google Drive** `TourGuide/` folder: state Sheet (trips, places, lists, day plans), research dossiers, finished brochures (PDF + HTML) |
| Tour Guide generic code: data schemas, visit-time estimator, day planner and route solver, brochure templates, the helper's Apps Script feature pack | **Script Properties / Claude environment API credentials:** bot token, Maps API key, admin secret, routine fire tokens |
| Docs and this plan | Optional: brochure also published as a private Claude Artifact (Artifacts are private by default) |

A CI check (Phase 1) fails any push to `Personal` that adds files under personal-data paths or matches secret/PII patterns, so the boundary is enforced, not just remembered. The brochure's *template* is public; a filled-in brochure never touches this repo or GitHub Pages.

## 2. What we reuse from Assistant Brain

Read from `AssistantBrain` `BUILD-STATE.md`, `PROJECT-BRIEF.md`, `docs/SPEC.md`, `docs/SECURITY.md`, `decisions/` and `profile.md` on 2026-09-30.

| Pattern (AB source) | How the Tour Guide uses it |
|---|---|
| **Two lanes / Rule of Two** — routines only *read* accounts; Apps Script core executes only allowlisted actions after an owner ✅ (`docs/SECURITY.md` §1) | Same. Research/planning routines read Gmail/Calendar/Drive and the web; the chatbot proposes, the owner taps ✅. The Tour Guide needs almost no account writes (Drive file create for brochures is the only one), so its allowlist is tiny |
| **Drive mailbox bridge** + envelope v1 (`SPEC.md` §2) and **`tools/envelope.mjs`** (Phase 4 fix: routines invented ids/timestamps) | Generalized into the framework with a per-helper `Assistant/`-style root (`TourGuide/mailbox/...`). Envelope stamping by tool from day one |
| **Telegram web app** in Apps Script, reply-fast-then-enqueue, dedupe + lock, pairing, callback buttons, feedback 👍/👎 (`SPEC.md` §5–§6) | Same core, new bot (separate BotFather bot so chats and approvals never mix with the Chief of Staff) |
| **Registries / extension points** (`SPEC.md` §10) — features register handlers without editing core | Becomes the framework's plug-in contract: each helper is a "helper pack" of registered commands, envelope types, queue handlers, gates |
| **Routines** created in the claude.ai UI, `CRON_TZ=` for schedules, gate-fired routines via `/fire` + bearer token (`decisions/PHASE-3.md`) | Same. Heavy work (research, planning, brochure, chat answers) runs as routines; Apps Script fires them |
| **Untrusted-text-stays-data + quarantine** (routine CLAUDE.md) | Web pages and email bodies are content, never instructions; anything derived from them that should become memory goes to `quarantine/` for owner promotion |
| **Memory-merge workflow** (`decisions/PHASE-4.md` Finding 3: per-run branches never reached `main`) | Built into the private repo from day one |
| **Phase structure** — architect builds foundation (Fable 5.1 · Xhigh), builders fan out (Opus 5.5 · High), integration + red-team (Fable 5.1 · Xhigh), owner switch-on session, then a live-day review | Same shape below |
| **Lessons:** `getUrl()` returns `/dev` → set `WEBAPP_URL`; setup page needs `<base target="_top">`; owners screenshot secrets → click-to-reveal; skills must read the owner's time zone from state, never hardcode one | Baked into the framework's setup page and skill template |

Not reused: AB's email triage, ledger, money/tax modules (Chief-of-Staff specific). **AB itself is not migrated** onto the new framework in this plan; that is an optional later decision (§10).

## 3. Verified platform facts (2026-09-30)

Checked on the web this session. Items marked *inference* are not confirmed by a source and get verified in the phase named.

| Fact | Source | Design consequence |
|---|---|---|
| **No official API returns "people typically spend X here."** Place Details fields cover address, location, hours, rating, review count, website, reviews, editorial summary; nothing on visit duration or popular times. Only third-party scrapers expose `typical_time_spent` | [Place Details (New)](https://developers.google.com/maps/documentation/places/web-service/place-details); [SearchApi docs](https://www.searchapi.io/docs/google-maps-place) | Visit duration is a *research* result (§5.3), not an API call. No scraper dependency |
| Place Details tiers: `formattedAddress`/`location` = Essentials; `regularOpeningHours`, `currentOpeningHours`, `rating`, `userRatingCount`, `websiteUri`, `priceLevel` = **Enterprise**; `reviews`, `editorialSummary` = Enterprise + Atmosphere | Place Details (New) | Every itinerary stop needs the Enterprise SKU → strict field masks and one details call per place per plan |
| Free monthly caps per SKU: Essentials 10,000 · Pro 5,000 · Enterprise 1,000; then roughly $5 / $17 / $25 per 1,000 (Place Details) and $5 / $10 / $15 per 1,000 (Compute Routes / Route Matrix) at the lowest volume band | [Maps pricing](https://developers.google.com/maps/billing-and-pricing/pricing) (updated 2026-09-24) | A normal trip (≤150 places researched) fits the free caps; a budget guard still hard-stops spending (§8) |
| Routes API `optimizeWaypointOrder` reorders intermediates; billed at **Compute Routes Pro**; cannot combine with `TRAFFIC_AWARE_OPTIMAL` or `via` waypoints | [Optimize waypoints](https://developers.google.com/maps/documentation/routes/opt-way) | Usable for driving/walking days |
| **Waypoint optimization is not supported for transit** (Directions API ignores `waypoints`/`optimizeWaypoints` in transit mode; Routes waypoint optimization lists driving, two-wheeler, cycling, walking) | [Directions (Legacy)](https://developers.google.com/maps/documentation/directions/get-directions); [Routes Preferred](https://developers.google.com/maps/documentation/routes_preferred/waypoint_optimization_proxy_api) | Our own solver orders the stops from a travel-time matrix, then asks for real transit legs pair by pair (§5.4). *Inference to verify in Phase 2:* Route Matrix accepts `TRANSIT` and its element limit |
| Place IDs may be stored indefinitely; coordinates cached ≤30 days; other Places content (name, address, rating, photos) has no general caching exception | [Maps Service Specific Terms](https://cloud.google.com/maps-platform/terms/maps-service-terms/index-20230828) and summaries | Store `place_id` + our own notes permanently; re-fetch Google content when a plan or brochure is built; purge cached Google fields after 30 days. Brochure pages carry Google attribution. *Exact reading of the terms re-checked in Phase 2* |
| Apps Script has a built-in Maps service (no API key) with a consumer quota of **1,000 direction queries/day**; UrlFetch 20,000/day; **trigger runtime 90 min/day shared by every script on the account** | [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas) (updated 2026-09-03) | The chatbot can answer quick "how far is X from Y" without the paid key. The Tour Guide's triggers share the 90 min/day with Assistant Brain's 5-minute tick, so the Tour Guide must not add a second always-on tick (§5.8) |
| Routines: no daily run cap in the official docs; **hourly** limits (30 Run now/API fires per routine, 100 API fires per account); runs draw on subscription usage; minimum schedule interval 1 hour; fire `text` arrives as untrusted data unless the prompt opts in | [Routines docs](https://code.claude.com/docs/en/routines) | A chat message can fire a routine, but each one is a full session (slow, uses subscription). Quick commands stay in Apps Script (§5.8). *Third-party blogs still cite "15 runs/day on Max"; the official page no longer does* |
| Routines on Pro/Max should hold API keys as the environment's **API credentials**, not plain environment variables (visible to anyone using the environment) | Routines docs → cloud environments | Maps key goes in Claude HQ's API credentials (§7) |
| A routine may republish an existing private Artifact without asking (single page, not publicly shared) | Routines docs | Optional "live brochure" Artifact per trip, refreshed by the planner routine |

## 4. Architecture

```
Owner phone ──Telegram (Tour Guide bot)──► tourguide-core  (Apps Script web app, built from Personal/helpers/core + packs/tour-guide)
                                             router · Telegram · queue · executor (✅ only) · mailbox relay · setup page
                                             quick commands answered here: /trip /day /later /place /route (Maps service)
                                             heavy asks → fire a routine (on-demand, no always-on tick)
                                                   │  Drive TourGuide/mailbox/{to-brain, from-brain, archive}
                                                   ▼
                     Claude Code Routines (environment: Claude HQ, full network + Maps key as API credential)
                     repos: TourGuide (private: persona, skills, memory)  +  Personal (public: tools, kits, templates)
                     connectors: Gmail · Calendar · Drive (read; Drive create for brochures)
                        prefs-build · trip-research · place-notes · plan-days · brochure-build · chat
                        │  node Personal/helpers/kits/maps  → Places API (New) + Routes API
                        │  node Personal/helpers/packs/tour-guide/planner → day plans
                        │  Playwright (Chromium preinstalled) → brochure PDF
                        ▼
                     Drive TourGuide/  state Sheet · dossiers · brochures      (+ optional private Artifact per trip)
```

### 4.1 Repository layout in `Personal` (new top-level `helpers/`)

```
helpers/
  README.md                 framework overview + "how to add a helper"
  core/                     generic Apps Script core (from AB's gas/core, generalized, no helper-specific code)
  tools/                    bundle.mjs (per-helper manifest), envelope.mjs, new-helper scaffold script
  kits/
    maps/                   Places (New) + Routes client, field masks, 30-day cache policy, budget guard, Maps URLs
    research/               research-run contract: source ledger, citations, confidence, injection handling, budgets
    brochure/               design system (CSS tokens, type scale, print CSS), HTML renderer, Playwright → PDF
    prefs/                  connector-reader pattern: evidence → quarantine → owner-confirmed profile
  packs/
    tour-guide/             schemas, estimator, planner + solver, brochure templates, Apps Script feature pack
  templates/private-repo/   skeleton for a helper's private repo (CLAUDE.md persona, skills/, memory dirs, merge workflow)
  tests/                    node --test suites + Apps Script mocks (from AB's harness)
.github/workflows/
  helpers-ci.yml            tests + public/private boundary check on every push
  deploy-helper.yml         bundles and deploys one helper's Apps Script project (clasp; secrets in Actions)
```

A future helper (the knowledge wiki) adds `packs/wiki/` and a private repo from `templates/private-repo/`, and reuses core, tools, research and prefs as-is.

### 4.2 Data model (state Sheet in Drive; schemas in `packs/tour-guide/schemas/`)

| Entity | Key fields |
|---|---|
| `Trip` | id, title, destination(s), start/end dates, travelers, pace (relaxed/normal/packed), day start/end times, base lodging per night, transport modes allowed, budget notes, status |
| `Place` | place_id (permanent), our category/tags, why it fits the owner, source trip, **status**: candidate · scheduled · saved-for-later · rejected, notes doc link |
| `VisitEstimate` | place_id, activity (e.g. "museum highlights", "full hike"), typical min/max minutes, chosen minutes, sources (URLs), confidence, owner calibration |
| `PlaceNote` | place_id, personalized note (why you, what to do, what to skip, best time, tips, booking needs), last researched |
| `DayPlan` | trip id, date, ordered stops (arrive/depart), legs (mode, minutes, Google Maps link), meals, free-time blocks, warnings (closed day, tight connection) |
| `LaterList` | named lists (e.g. "Kyoto — next time", "Rainy-day options"), place ids, reason not scheduled |

Google-sourced fields (hours, rating, review count, website, address) are fetched fresh when a plan or brochure is built and kept only in the per-build snapshot, per §3.

## 5. How each requirement is met

**5.1 Understand preferences from approved connectors.** Skill `prefs-build` (private repo) reads only connectors the owner enabled for the routine: Gmail (hotel/flight/restaurant/ticket confirmations, tours booked), Calendar (past trips, events), Drive (trip docs). Optional inputs: a Google Takeout export of Maps "Saved" lists and reviews dropped into Drive (no connector exposes them), and, with the owner's OK, the travel-relevant lines of Assistant Brain's `profile.md`. Output: evidence-backed candidate preferences in `quarantine/` → owner confirms in Telegram (✅/✏️/❌) → `travel-profile.md` (pace, interests, food, budget band, mobility, crowds, early/late person, must-avoid). Same untrusted-content rules as AB.

**5.2 Autonomous deep web research.** Routines run without permission prompts, so research needs no approvals once the routine exists. Skill `trip-research` follows the research kit's contract: per-run budgets (searches, fetches, wall time), a source ledger (URL, date, what it supported), at least two independent sources for any fact the plan depends on, confidence labels, and injection handling (page text is data). It proposes candidate places scored against `travel-profile.md` and writes a dossier to Drive.

**5.3 Average visit duration.** No API provides it (§3), so the estimator triangulates: Google's "people typically spend" line when it appears in search results, attraction-site guidance ("allow 2 hours"), TripAdvisor/Viator suggested durations, and travel guides → a min/max range, a chosen value adjusted by the owner's pace and interest, and the sources. After each trip, the owner's actual times (a one-tap "longer/shorter/about right" per stop) calibrate future estimates.

**5.4 Route optimization with Google Maps.** The planner (node, tested) (a) filters stops by opening hours and closed days for the date, (b) clusters the trip's places into days by geography and constraints, (c) orders each day with a time-window-aware solver over a travel-time matrix from the Routes API (walking/driving, and transit if the matrix supports it — Phase 2 check), (d) fetches the actual legs pair by pair in the chosen mode, (e) inserts meals and free-time blocks by pace, and (f) produces a Google Maps directions link per leg and one for the whole day (Maps URLs need no key). Driving days may use `optimizeWaypointOrder` as a cross-check.

**5.5 Saved-for-later lists.** Every researched place keeps its status. Anything researched but not scheduled goes to a named Later list with the reason ("closed that day", "too far", "rainy-day backup"). `/later` in Telegram lists, moves, and promotes places back into a trip.

**5.6 Personalized notes per location.** Skill `place-notes` writes a note per place from the profile + research: why it's on your list, what to do/see/eat, what to skip, best time of day, tickets/reservations, accessibility, nearby pairings. Notes live in the private repo (`places/<slug>.md`) and are embedded in the brochure.

**5.7 Daily action plans + brochure.** `plan-days` assembles each day: address, hours, closed days, Google rating and review count, website, activity and time budget, transit mode and minutes with the Maps link, free time. `brochure-build` renders it with the brochure kit into a magazine-grade HTML document and a print PDF (cover, trip-at-a-glance, day spreads with a timeline rail and route map, place cards, "saved for later" appendix, practical info), saved to Drive and optionally a private Artifact. Design quality is a dedicated phase with visual review, not an afterthought.

**5.8 Chatbot like the Chief of Staff.** A separate Telegram bot on the shared core. Instant answers from Apps Script for structured asks (`/trip`, `/today`, `/day 3`, `/later`, `/place <name>`, `/route A → B` via the free Maps service, "save this place", "move X to tomorrow"). Open questions and changes ("find a quieter lunch spot near stop 3", "rework day 2 for rain") fire the `chat` routine with the owner's message; the answer comes back through the mailbox. To stay inside the shared 90 min/day trigger budget, the Tour Guide polls the mailbox only while a request is pending (a one-off `after()` trigger created when a routine is fired) instead of a permanent 5-minute tick — *inference, validated in Phase 5.* A faster direct-API chat lane is an optional later add (§10).

## 6. Phases, with model and effort

Same shape as the Assistant Brain build: the architect lays the foundation, builders fan out in parallel worktrees, an integration pass red-teams it, then the owner switches it on with a real trip. Each phase runs in a **new session** started from a prompt file the previous phase writes (`helpers/prompts/TG-PHASE-<n>.md`), and a build tracker (`helpers/BUILD-STATE.md`, generic progress only) records status. "Owner" rows are what only you can do.

| Phase | What gets built | Model · effort | Needs from owner | Done when |
|---|---|---|---|---|
| **0 — Setup + decisions** (~30–45 min, interactive) | Nothing in code. Confirm §10 decisions; owner creates the private repo, Google Cloud project + key, Telegram bot; session writes `TourGuide` skeleton from the plan and `TG-PHASE-1.md` | Opus 5.5 · Medium | Create private `LightAISolutions/TourGuide` and add it to this project; Google Cloud project with **Places API (New)** + **Routes API** enabled, API key restricted to those two APIs, budget alert (§8); add the key to Claude HQ as an **API credential**; BotFather → new bot token (kept for Phase 6) | Decisions recorded in `TourGuide/decisions/PHASE-0.md`; both repos attached |
| **1 — Helper framework foundation** (`helpers/core`, `tools`, `templates/private-repo`, CI) | Generalize AB's Apps Script core into a helper-agnostic core (per-helper root folder, bot, property prefix, registries); per-helper bundle manifest; envelope tool; Apps Script mocks + test harness; setup page with AB's lessons built in; `deploy-helper.yml`; **public/private boundary check**; `helpers/README.md` + framework SPEC; security model doc | **Fable 5.1 · Xhigh** (architect) | Approve copying AB's generic core code into this public repo after the phase's scrub report (no secrets, ids or personal strings) | Tests green; a "hello" pack bundles and runs in mocks; boundary check blocks a planted fake secret |
| **2 — Shared kits** (parallel work packages) | **2a Maps kit** — Places/Routes client, field masks, SKU-aware budget guard with monthly counter + hard stop, 30-day purge, Maps URL builder; verifies transit matrix support and caching terms (Opus 5.5 · High). **2b Research kit** — skill template, source ledger schema, budgets, injection tests (Opus 5.5 · Medium). **2c Brochure kit** — design system, print CSS, renderer, Playwright PDF, attribution block; visual review with screenshots (**Fable 5.1 · High**, design-heavy; uses the `frontend-design` skill). **2d Prefs kit** — connector-reader pattern, evidence/quarantine/confirm flow (Opus 5.5 · Medium) | coordinator: Opus 5.5 · High | A few test places for live Maps calls (costs stay inside free caps) | Each kit's tests green; one live Places + Routes smoke call from Claude HQ; a sample brochure PDF from fixture data |
| **3 — Tour Guide engine** (`packs/tour-guide`) | Schemas; visit-time estimator + calibration; **day planner and solver** (hours/closed-day filter, day clustering, time-window ordering, meals, free time, warnings); Later lists; plan → brochure data mapping; fixture trips (a city-on-transit trip, a driving road trip) | **Fable 5.1 · High** for the solver; Opus 5.5 · High for the rest | — | Planner produces feasible plans for both fixtures (no stop outside its hours, no closed-day visits, legs match the matrix); property tests green |
| **4 — Brain side** (private `TourGuide` repo) | Routine persona `CLAUDE.md`; skills `prefs-build`, `trip-research`, `place-notes`, `plan-days`, `brochure-build`, `chat`; memory dirs + memory-merge workflow; routine prompt texts for the owner to paste | Opus 5.5 · High | — | Each skill dry-runs end to end in a build session against fixtures; envelopes validate |
| **5 — Chatbot** (`packs/tour-guide/gas`) | Tour Guide Apps Script feature pack: commands, inline buttons, ✅ proposals, fire-a-routine flow, on-demand mailbox polling, `/route` via the built-in Maps service, trip/day/later views | Opus 5.5 · High | — | Mock e2e: message → routine fire → envelope → reply; trigger-runtime estimate documented against the shared 90 min/day |
| **6 — Integration, red-team, switch-on guide** | End-to-end tests across packs; prompt-injection red-team on research and chat; cost and quota audit; `helpers/docs/TG-SWITCH-ON.md` | **Fable 5.1 · Xhigh** (architect) | — | All suites green; findings fixed or listed; switch-on guide written |
| **7 — Owner switch-on** (~60 min, interactive) | Deploy the Apps Script project, set Script Properties, pair the bot, create the routines in the claude.ai UI (`CRON_TZ=America/Los_Angeles`), run `prefs-build` and confirm the profile, **pilot a real upcoming trip** | Opus 5.5 · High | Owner at the keyboard: Apps Script authorization, routine creation, profile confirmation, pick the pilot trip | Pilot trip has a brochure you'd hand to a friend; everything in the guide verified live |
| **8 — Live review + tuning** | Review the pilot (planning quality, brochure polish, estimate accuracy, costs, trigger runtime), fix what hurt | Opus 5.5 · High (Fable 5.1 · High for another brochure design pass if needed) | Feedback from the pilot, ideally after the trip (actual visit times) | Tuning items closed in `TourGuide/decisions/PHASE-8.md` |

**Routine runtime models** (set per routine in the claude.ai UI during Phase 7): `trip-research` and `plan-days` Opus 5.5 (depth matters, runs rarely); `place-notes`, `prefs-build`, `chat` Opus 5.5; `brochure-build` Opus 5.5 (the template does the design work). Revisit after Phase 8 with real cost data.

**Finish priority if usage runs short:** Phase 1 → 2a → 3 → 4 (`plan-days`, `trip-research`) → 2c + `brochure-build` → 5 → 2d/`prefs-build` → 6. A usable text-only plan in Drive exists after Phase 4 even if the chatbot and brochure slip.

## 7. Environments, keys and network

| Environment | Used for | Needs |
|---|---|---|
| **Claude HQ** (full network, this project's environment) | All build phases 0–6 and 8; the Tour Guide routines (research needs open web; Maps calls go to `places.googleapis.com` / `routes.googleapis.com`) | **Phase 0:** add `GOOGLE_MAPS_API_KEY` as an **API credential** (not a plain variable; §3). **Phase 2c:** Chromium is preinstalled for Playwright PDFs; no setup script needed unless fonts are self-hosted (then a setup script caches them). Connector write tools stay blocked account-wide as set during the AB switch-on; Drive "create file" stays allowed for brochures |
| **AB build / AB routines** | Untouched | — |
| **Possible separate "TG routines" environment (later)** | Only if you want the Tour Guide routines isolated from build sessions (Claude HQ variables and credentials are visible to anything using it) | Same key as an API credential; Full or Custom network (`*.googleapis.com` + open web for research, which in practice means Full) — decide in Phase 7 |
| **Apps Script (owner's Google account)** | `tourguide-core` web app | Script Properties: bot token, admin secret, `WEBAPP_URL`, routine fire URLs/tokens, optional Maps key for server-side lookups. Deploy via `deploy-helper.yml` needs clasp credentials as GitHub Actions secrets on this repo (Phase 1 documents the exact steps; secrets never appear in the repo) |

Phases that call live Google APIs: **2a** (smoke tests), **7** and **8**. Everything else runs on fixtures and mocks.

## 8. Costs and quotas

- **Google Maps Platform:** a trip with ~100–150 candidate places, ~40 scheduled stops and ~60 legs is roughly 150 Enterprise Place Details + a few Text Searches + ~5 route matrices + ~60 Compute Routes → inside the free monthly caps (§3). Guards: API key restricted to Places + Routes; **per-API daily quota caps** in the Cloud console; a **budget alert** at a small amount (e.g. $10); the kit's own monthly counter refuses calls past a configured ceiling. *Estimate, not a quote; Phase 8 reports real usage.*
- **Apps Script:** the Tour Guide shares the account's 90 min/day trigger runtime with Assistant Brain. Design target: no permanent tick; on-demand polling only while a request is pending (§5.8). Phase 5 documents the measured budget.
- **Claude usage:** research and planning routines are the expensive part and run per trip, not daily. Chat messages that need the brain each start a session; instant commands cost nothing. No always-on Tour Guide schedules are planned except an optional weekly "upcoming trip check".

## 9. Risks

| Risk | Mitigation |
|---|---|
| Personal travel data leaks into this public repo | Split in §1; CI boundary check; brochures and notes only in Drive / private repo |
| Web pages or emails steer the research agent (prompt injection) | Untrusted-data rules, quarantine for memory, no account writes from routines, Phase 6 red-team |
| Visit-time estimates are wrong | Ranges + sources + confidence; pace settings; post-trip calibration |
| Google data is stale (hours changed, place closed) | Fresh details at plan/brochure build; `businessStatus` check; brochure shows "verified on <date>" |
| Transit timing differs by departure time | Legs computed for the planned departure; buffer minutes per leg by pace |
| Maps costs spike (loop bug) | Budget guard + console quota caps + budget alert |
| Trigger quota contention with the Chief of Staff | On-demand polling; measured in Phase 5 |
| Terms of service on caching/display of Places content | Store only place IDs long-term; attribution on every page; Phase 2a re-reads the terms |

## 10. Decisions for the owner

Phase 0 records answers; the recommendation is what the build assumes if you don't change it.

1. **Private repo name.** Recommended: `LightAISolutions/TourGuide` (one private repo per helper, created from `helpers/templates/private-repo/`).
2. **Separate Telegram bot.** Recommended: yes, a dedicated Tour Guide bot (clean approvals, independent pairing).
3. **Reading Assistant Brain's `profile.md` for preferences.** Recommended: yes, travel-relevant lines only, as a one-time seed you confirm.
4. **Google Maps Takeout import** of your saved lists/reviews. Recommended: yes, once, in Phase 7 (it's the richest preference signal and no connector reaches it).
5. **Brochure delivery.** Recommended: PDF + HTML in Drive, plus an optional private Artifact per trip that the planner keeps current.
6. **Fast chat lane via the Claude API** (paid per token, outside the subscription) for instant free-text answers. Recommended: not now; revisit after Phase 8.
7. **Migrate Assistant Brain onto the shared framework later.** Recommended: not in this build; decide after the Tour Guide has run on it for a few weeks.
8. **Pilot trip for Phase 7.** Your pick: the next real trip on your calendar, or a sample city if none is planned.

**Suggested first move:** start a new session in this project (Claude HQ) on **Opus 5.5 · Medium**, paste `Read repository-information/TOUR-GUIDE-BUILD-PLAN.md and run Phase 0 with me.`, and have the private repo, Google Cloud key and bot token ready.

Developed by: LightAISolutions
